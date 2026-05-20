package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

func handleAdminStats(c *fiber.Ctx) error {
	ctx := context.Background()
	var stats AdminStats

	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&stats.TotalUsers)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE").Scan(&stats.TodaySignups)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'").Scan(&stats.WeekSignups)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE verification_status = 'pending'").Scan(&stats.PendingVerifications)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE verification_status = 'verified'").Scan(&stats.VerifiedUsers)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE verification_status = 'unverified'").Scan(&stats.UnverifiedUsers)
	dbPool.QueryRow(ctx, "SELECT COALESCE(SUM(total_logins), 0) FROM users").Scan(&stats.TotalLogins)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE is_admin = true").Scan(&stats.AdminCount)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE total_logins > 1").Scan(&stats.ReturnedUsers)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE last_login_at IS NULL").Scan(&stats.NeverLoggedIn)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM posts").Scan(&stats.TotalPosts)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM posts WHERE created_at >= NOW() - INTERVAL '7 days'").Scan(&stats.PostsThisWeek)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM gigs").Scan(&stats.TotalGigs)

	rows, err := dbPool.Query(ctx, `
		SELECT COALESCE(NULLIF(role,''), 'unset'), COUNT(*)
		FROM users GROUP BY 1 ORDER BY 2 DESC`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var rc RoleCount
			if rows.Scan(&rc.Role, &rc.Count) == nil {
				stats.RoleBreakdown = append(stats.RoleBreakdown, rc)
			}
		}
	}

	rows2, err := dbPool.Query(ctx, `
		SELECT TO_CHAR(d::date, 'Mon DD') AS label, COALESCE(COUNT(u.id), 0)
		FROM generate_series(NOW() - INTERVAL '6 days', NOW(), '1 day') AS d
		LEFT JOIN users u ON u.created_at::date = d::date
		GROUP BY d ORDER BY d`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var dc DailyCount
			if rows2.Scan(&dc.Date, &dc.Count) == nil {
				stats.DailySignups = append(stats.DailySignups, dc)
			}
		}
	}

	return c.JSON(stats)
}

func handleAdminAuditLog(c *fiber.Ctx) error {
	ctx := context.Background()
	rows, err := dbPool.Query(ctx, `
		SELECT a.id, a.admin_id, u.full_name, a.action, a.target_id, a.target_name, a.details, a.created_at
		FROM admin_audit_log a
		LEFT JOIN users u ON u.id = a.admin_id
		ORDER BY a.created_at DESC LIMIT 50`)
	if err != nil {
		return c.JSON([]AuditLog{})
	}
	defer rows.Close()
	var logs []AuditLog
	for rows.Next() {
		var l AuditLog
		if rows.Scan(&l.ID, &l.AdminID, &l.AdminName, &l.Action, &l.TargetID, &l.TargetName, &l.Details, &l.CreatedAt) == nil {
			logs = append(logs, l)
		}
	}
	if logs == nil {
		logs = []AuditLog{}
	}
	return c.JSON(logs)
}

func writeAuditLog(ctx context.Context, adminID, action, targetID, targetName, details string) {
	dbPool.Exec(ctx,
		`INSERT INTO admin_audit_log (admin_id, action, target_id, target_name, details) VALUES ($1, $2, $3, $4, $5)`,
		adminID, action, targetID, targetName, details)
}

func handleAdminListUsers(c *fiber.Ctx) error {
	ctx := context.Background()
	search := c.Query("search", "")
	role := c.Query("role", "")
	adminOnly := c.Query("admin", "")

	query := `SELECT id, email, full_name, role, verification_status, is_admin, is_banned, banned_until, ban_message, created_at, last_login_at, total_logins, followers, following, posts FROM users WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		query += fmt.Sprintf(" AND (email ILIKE $%d OR full_name ILIKE $%d)", argIdx, argIdx+1)
		args = append(args, "%"+search+"%", "%"+search+"%")
		argIdx += 2
	}
	if role != "" {
		query += fmt.Sprintf(" AND role = $%d", argIdx)
		args = append(args, role)
		argIdx++
	}
	if adminOnly == "true" {
		query += " AND is_admin = true"
	}
	query += " ORDER BY created_at DESC"

	rows, err := dbPool.Query(ctx, query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch users"})
	}
	defer rows.Close()

	var users []AdminUserView
	for rows.Next() {
		var u AdminUserView
		var bannedUntil *time.Time
		if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.VerificationStatus, &u.IsAdmin,
			&u.IsBanned, &bannedUntil, &u.BanMessage,
			&u.CreatedAt, &u.LastLoginAt, &u.TotalLogins, &u.Followers, &u.Following, &u.Posts); err == nil {
			if bannedUntil != nil {
				s := bannedUntil.UTC().Format(time.RFC3339)
				u.BannedUntil = &s
			}
			users = append(users, u)
		}
	}
	if users == nil {
		users = []AdminUserView{}
	}
	return c.JSON(users)
}

func handleAdminGetUser(c *fiber.Ctx) error {
	ctx := context.Background()
	id := c.Params("id")

	var u AdminUserView
	err := dbPool.QueryRow(ctx,
		`SELECT id, email, full_name, role, verification_status, is_admin, created_at, last_login_at, total_logins, followers, following, posts FROM users WHERE id = $1`, id).Scan(
		&u.ID, &u.Email, &u.FullName, &u.Role, &u.VerificationStatus, &u.IsAdmin, &u.CreatedAt, &u.LastLoginAt, &u.TotalLogins, &u.Followers, &u.Following, &u.Posts)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}
	return c.JSON(u)
}

func handleAdminUpdateUser(c *fiber.Ctx) error {
	ctx := context.Background()
	id := c.Params("id")

	var body struct {
		Role               *string `json:"role"`
		VerificationStatus *string `json:"verificationStatus"`
		IsAdmin            *bool   `json:"isAdmin"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if body.Role != nil {
		setClauses = append(setClauses, fmt.Sprintf("role = $%d", argIdx))
		args = append(args, *body.Role)
		argIdx++
	}
	if body.VerificationStatus != nil {
		setClauses = append(setClauses, fmt.Sprintf("verification_status = $%d", argIdx))
		args = append(args, *body.VerificationStatus)
		argIdx++
	}
	if body.IsAdmin != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_admin = $%d", argIdx))
		args = append(args, *body.IsAdmin)
		argIdx++
	}

	if len(setClauses) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "no fields to update"})
	}

	setClauses = append(setClauses, "updated_at = CURRENT_TIMESTAMP")
	query := fmt.Sprintf("UPDATE users SET %s WHERE id = $%d", strings.Join(setClauses, ", "), argIdx)
	args = append(args, id)

	result, err := dbPool.Exec(ctx, query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to update user"})
	}
	if result.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	adminID, _ := c.Locals("userId").(string)
	var targetName string
	dbPool.QueryRow(ctx, "SELECT full_name FROM users WHERE id = $1", id).Scan(&targetName)
	writeAuditLog(ctx, adminID, "update_user", id, targetName, fmt.Sprintf("%v", body))

	return c.JSON(fiber.Map{"success": true})
}

func handleAdminBanUser(c *fiber.Ctx) error {
	ctx := context.Background()
	id := c.Params("id")

	var body struct {
		DurationHours int    `json:"durationHours"`
		Message       string `json:"message"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	var bannedUntil *time.Time
	if body.DurationHours > 0 {
		t := time.Now().UTC().Add(time.Duration(body.DurationHours) * time.Hour)
		bannedUntil = &t
	}

	var result interface{ RowsAffected() int64 }
	var err error
	if bannedUntil != nil {
		result, err = dbPool.Exec(ctx,
			"UPDATE users SET is_banned = true, banned_until = $1, ban_message = $2, updated_at = NOW() WHERE id = $3",
			bannedUntil, body.Message, id)
	} else {
		result, err = dbPool.Exec(ctx,
			"UPDATE users SET is_banned = true, banned_until = NULL, ban_message = $1, updated_at = NOW() WHERE id = $2",
			body.Message, id)
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to ban user"})
	}
	if result.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	adminID, _ := c.Locals("userId").(string)
	var targetName string
	dbPool.QueryRow(ctx, "SELECT full_name FROM users WHERE id = $1", id).Scan(&targetName)
	dur := "permanent"
	if body.DurationHours > 0 {
		dur = fmt.Sprintf("%dh", body.DurationHours)
	}
	writeAuditLog(ctx, adminID, "ban_user", id, targetName, fmt.Sprintf("duration=%s msg=%q", dur, body.Message))

	return c.JSON(fiber.Map{"success": true})
}

func handleAdminUnbanUser(c *fiber.Ctx) error {
	ctx := context.Background()
	id := c.Params("id")

	result, err := dbPool.Exec(ctx,
		"UPDATE users SET is_banned = false, banned_until = NULL, ban_message = '', updated_at = NOW() WHERE id = $1", id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to unban user"})
	}
	if result.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	adminID, _ := c.Locals("userId").(string)
	var targetName string
	dbPool.QueryRow(ctx, "SELECT full_name FROM users WHERE id = $1", id).Scan(&targetName)
	writeAuditLog(ctx, adminID, "unban_user", id, targetName, "ban lifted")

	return c.JSON(fiber.Map{"success": true})
}

func handleAdminDeleteUser(c *fiber.Ctx) error {
	ctx := context.Background()
	id := c.Params("id")

	var targetName string
	dbPool.QueryRow(ctx, "SELECT full_name FROM users WHERE id = $1", id).Scan(&targetName)

	result, err := dbPool.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to delete user"})
	}
	if result.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	adminID, _ := c.Locals("userId").(string)
	writeAuditLog(ctx, adminID, "delete_user", id, targetName, "user deleted")

	return c.SendStatus(204)
}

func handleAdminGetSettings(c *fiber.Ctx) error {
	rows, err := dbPool.Query(context.Background(), "SELECT key, value FROM settings")
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch settings"})
	}
	defer rows.Close()
	result := map[string]string{}
	for rows.Next() {
		var k, v string
		if rows.Scan(&k, &v) == nil {
			result[k] = v
		}
	}
	return c.JSON(result)
}

func handleAdminUpdateSettings(c *fiber.Ctx) error {
	var body map[string]string
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	for k, v := range body {
		dbPool.Exec(context.Background(),
			"INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
			k, v)
	}
	adminID, _ := c.Locals("userId").(string)
	writeAuditLog(context.Background(), adminID, "update_settings", "", "", fmt.Sprintf("%v", body))
	return c.JSON(fiber.Map{"success": true})
}

func handleAdminEmailStats(c *fiber.Ctx) error {
	ctx := context.Background()
	var thisMonth, lastMonth, total int
	dbPool.QueryRow(ctx, `
		SELECT COALESCE(SUM(recipients), 0) FROM email_log
		WHERE sent_at >= DATE_TRUNC('month', NOW())`).Scan(&thisMonth)
	dbPool.QueryRow(ctx, `
		SELECT COALESCE(SUM(recipients), 0) FROM email_log
		WHERE sent_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
		  AND sent_at < DATE_TRUNC('month', NOW())`).Scan(&lastMonth)
	dbPool.QueryRow(ctx, "SELECT COALESCE(SUM(recipients), 0) FROM email_log").Scan(&total)

	rows, err := dbPool.Query(ctx, `
		SELECT type, COALESCE(SUM(recipients), 0)
		FROM email_log
		WHERE sent_at >= DATE_TRUNC('month', NOW())
		GROUP BY type ORDER BY 2 DESC`)
	breakdown := map[string]int{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var t string
			var n int
			if rows.Scan(&t, &n) == nil {
				breakdown[t] = n
			}
		}
	}

	const monthlyLimit = 3000
	return c.JSON(fiber.Map{
		"thisMonth":    thisMonth,
		"lastMonth":    lastMonth,
		"total":        total,
		"monthlyLimit": monthlyLimit,
		"remaining":    monthlyLimit - thisMonth,
		"breakdown":    breakdown,
	})
}
