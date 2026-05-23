package repositories

import (
	"context"

	"chat-app/internal/db"
	"chat-app/internal/models"
)

func GetLatestVerificationRequest(ctx context.Context, userID string) (*models.VerificationRequest, error) {
	var r models.VerificationRequest
	err := db.Pool.QueryRow(ctx, `
		SELECT id, user_id, status, full_name, email, id_document_url, reason,
		       COALESCE(admin_note,''), reviewed_by, reviewed_at, created_at
		FROM verification_requests
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, userID).Scan(&r.ID, &r.UserID, &r.Status, &r.FullName, &r.Email, &r.IDDocumentURL, &r.Reason,
		&r.AdminNote, &r.ReviewedBy, &r.ReviewedAt, &r.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func CountPendingVerificationsForUser(ctx context.Context, userID string) int {
	var count int
	db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM verification_requests WHERE user_id = $1 AND status = 'pending'`,
		userID).Scan(&count)
	return count
}

func IsUserBadgeVerified(ctx context.Context, userID string) bool {
	var verified bool
	db.Pool.QueryRow(ctx, `SELECT is_verified FROM users WHERE id = $1`, userID).Scan(&verified)
	return verified
}

func InsertVerificationRequest(ctx context.Context, userID, fullName, email, idDocURL, reason string) (int64, error) {
	var id int64
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO verification_requests (user_id, status, full_name, email, id_document_url, reason)
		VALUES ($1, 'pending', $2, $3, $4, $5)
		RETURNING id
	`, userID, fullName, email, idDocURL, reason).Scan(&id)
	return id, err
}

func ListVerificationRequests(ctx context.Context, status string) ([]models.VerificationRequest, error) {
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

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.VerificationRequest{}
	for rows.Next() {
		var r models.VerificationRequest
		if err := rows.Scan(&r.ID, &r.UserID, &r.Status, &r.FullName, &r.Email, &r.IDDocumentURL, &r.Reason,
			&r.AdminNote, &r.ReviewedBy, &r.ReviewedAt, &r.CreatedAt,
			&r.UserFullName, &r.UserEmail, &r.UserAvatar, &r.UserRole); err == nil {
			out = append(out, r)
		}
	}
	return out, nil
}

type VerificationReviewTarget struct {
	UserID        string
	Status        string
	IDDocumentURL string
}

func GetVerificationReviewTarget(ctx context.Context, id string) (*VerificationReviewTarget, error) {
	v := &VerificationReviewTarget{}
	err := db.Pool.QueryRow(ctx,
		`SELECT user_id, status, COALESCE(id_document_url,'') FROM verification_requests WHERE id = $1`, id,
	).Scan(&v.UserID, &v.Status, &v.IDDocumentURL)
	if err != nil {
		return nil, err
	}
	return v, nil
}

// ReviewVerificationRequest finalises a verification application: it
// updates the request row and (on approval) flips users.is_verified.
// Done in one transaction so the badge and the request status can't diverge.
func ReviewVerificationRequest(ctx context.Context, id, newStatus, adminNote, adminID, userID string) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Clear id_document_url at the same time we mark the row reviewed —
	// the document is no longer needed once a decision has been made, and
	// the public URL stops working as soon as the object is deleted from R2.
	if _, err = tx.Exec(ctx, `
		UPDATE verification_requests
		SET status = $1, admin_note = $2, reviewed_by = $3, reviewed_at = NOW(),
		    id_document_url = '', updated_at = NOW()
		WHERE id = $4
	`, newStatus, adminNote, adminID, id); err != nil {
		return err
	}

	if newStatus == "approved" {
		if _, err = tx.Exec(ctx, `UPDATE users SET is_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, userID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
