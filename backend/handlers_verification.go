package main

import (
	"context"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

type VerificationRequest struct {
	ID            int64      `json:"id"`
	UserID        string     `json:"userId"`
	Status        string     `json:"status"`
	FullName      string     `json:"fullName"`
	Email         string     `json:"email"`
	IDDocumentURL string     `json:"idDocumentUrl"`
	Reason        string     `json:"reason"`
	AdminNote     string     `json:"adminNote,omitempty"`
	ReviewedBy    *string    `json:"reviewedBy,omitempty"`
	ReviewedAt    *time.Time `json:"reviewedAt,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`

	// Joined user info (for admin list)
	UserFullName string `json:"userFullName,omitempty"`
	UserEmail    string `json:"userEmail,omitempty"`
	UserAvatar   string `json:"userAvatar,omitempty"`
	UserRole     string `json:"userRole,omitempty"`
}

// GET /api/verification/me  — current user's most-recent application (if any)
func handleGetMyVerification(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID, _ := c.Locals("userId").(string)
	if userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	var r VerificationRequest
	err := dbPool.QueryRow(ctx, `
		SELECT id, user_id, status, full_name, email, id_document_url, reason,
		       COALESCE(admin_note,''), reviewed_by, reviewed_at, created_at
		FROM verification_requests
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, userID).Scan(&r.ID, &r.UserID, &r.Status, &r.FullName, &r.Email, &r.IDDocumentURL, &r.Reason,
		&r.AdminNote, &r.ReviewedBy, &r.ReviewedAt, &r.CreatedAt)

	if err == pgx.ErrNoRows {
		return c.JSON(fiber.Map{"request": nil})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load request"})
	}
	return c.JSON(fiber.Map{"request": r})
}

// POST /api/verification — submit a new application
func handleSubmitVerification(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID, _ := c.Locals("userId").(string)
	if userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	var body struct {
		FullName      string `json:"fullName"`
		Email         string `json:"email"`
		IDDocumentURL string `json:"idDocumentUrl"`
		Reason        string `json:"reason"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	body.FullName = strings.TrimSpace(body.FullName)
	body.Email = strings.TrimSpace(body.Email)
	body.IDDocumentURL = strings.TrimSpace(body.IDDocumentURL)
	body.Reason = strings.TrimSpace(body.Reason)

	if body.FullName == "" || body.Email == "" || body.IDDocumentURL == "" || body.Reason == "" {
		return c.Status(400).JSON(fiber.Map{"error": "all fields are required"})
	}

	// Block if user already has a pending request
	var pendingCount int
	dbPool.QueryRow(ctx,
		`SELECT COUNT(*) FROM verification_requests WHERE user_id = $1 AND status = 'pending'`,
		userID).Scan(&pendingCount)
	if pendingCount > 0 {
		return c.Status(409).JSON(fiber.Map{"error": "you already have a pending verification request"})
	}

	// Block if already verified
	var status string
	dbPool.QueryRow(ctx, `SELECT verification_status FROM users WHERE id = $1`, userID).Scan(&status)
	if status == "verified" {
		return c.Status(409).JSON(fiber.Map{"error": "your account is already verified"})
	}

	var id int64
	err := dbPool.QueryRow(ctx, `
		INSERT INTO verification_requests (user_id, status, full_name, email, id_document_url, reason)
		VALUES ($1, 'pending', $2, $3, $4, $5)
		RETURNING id
	`, userID, body.FullName, body.Email, body.IDDocumentURL, body.Reason).Scan(&id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to submit request"})
	}

	// Reflect pending status on the user record
	dbPool.Exec(ctx, `UPDATE users SET verification_status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, userID)

	return c.JSON(fiber.Map{"id": id, "status": "pending"})
}

// GET /admin/verification-requests?status=pending
func handleAdminListVerificationRequests(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	status := c.Query("status", "")
	query := `
		SELECT v.id, v.user_id, v.status, v.full_name, v.email, v.id_document_url, v.reason,
		       COALESCE(v.admin_note,''), v.reviewed_by, v.reviewed_at, v.created_at,
		       u.full_name, u.email, COALESCE(u.avatar_url,''), COALESCE(u.role,'')
		FROM verification_requests v
		LEFT JOIN users u ON u.id = v.user_id
	`
	args := []interface{}{}
	if status != "" {
		query += " WHERE v.status = $1"
		args = append(args, status)
	}
	query += " ORDER BY CASE WHEN v.status = 'pending' THEN 0 ELSE 1 END, v.created_at DESC LIMIT 200"

	rows, err := dbPool.Query(ctx, query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load requests"})
	}
	defer rows.Close()

	out := []VerificationRequest{}
	for rows.Next() {
		var r VerificationRequest
		if err := rows.Scan(&r.ID, &r.UserID, &r.Status, &r.FullName, &r.Email, &r.IDDocumentURL, &r.Reason,
			&r.AdminNote, &r.ReviewedBy, &r.ReviewedAt, &r.CreatedAt,
			&r.UserFullName, &r.UserEmail, &r.UserAvatar, &r.UserRole); err == nil {
			out = append(out, r)
		}
	}
	return c.JSON(out)
}

// PATCH /admin/verification-requests/:id — { action: 'approve' | 'reject', adminNote?: string }
func handleAdminReviewVerification(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	id := c.Params("id")
	adminID, _ := c.Locals("userId").(string)

	var body struct {
		Action    string `json:"action"`
		AdminNote string `json:"adminNote"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if body.Action != "approve" && body.Action != "reject" {
		return c.Status(400).JSON(fiber.Map{"error": "action must be 'approve' or 'reject'"})
	}

	// Look up target user id + ensure request is pending
	var userID, status string
	err := dbPool.QueryRow(ctx, `SELECT user_id, status FROM verification_requests WHERE id = $1`, id).Scan(&userID, &status)
	if err == pgx.ErrNoRows {
		return c.Status(404).JSON(fiber.Map{"error": "request not found"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load request"})
	}
	if status != "pending" {
		return c.Status(409).JSON(fiber.Map{"error": "request is not pending"})
	}

	newStatus := "approved"
	if body.Action == "reject" {
		newStatus = "rejected"
	}

	tx, err := dbPool.Begin(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to start tx"})
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		UPDATE verification_requests
		SET status = $1, admin_note = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
		WHERE id = $4
	`, newStatus, body.AdminNote, adminID, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to update request"})
	}

	userVerification := "unverified"
	if newStatus == "approved" {
		userVerification = "verified"
	}
	_, err = tx.Exec(ctx, `UPDATE users SET verification_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
		userVerification, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to update user"})
	}

	if err := tx.Commit(ctx); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to commit"})
	}

	var targetName string
	dbPool.QueryRow(ctx, "SELECT full_name FROM users WHERE id = $1", userID).Scan(&targetName)
	writeAuditLog(ctx, adminID, "verification_"+newStatus, userID, targetName, body.AdminNote)

	return c.JSON(fiber.Map{"success": true, "status": newStatus})
}
