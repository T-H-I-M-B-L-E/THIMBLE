package repositories

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"chat-app/internal/db"
	"chat-app/internal/models"
)

// FetchAdminStats issues every counter query on the admin dashboard.
// Errors on individual queries are intentionally ignored so a single
// broken counter doesn't blank the whole panel.
func FetchAdminStats(ctx context.Context) (models.AdminStats, error) {
	var stats models.AdminStats

	db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&stats.TotalUsers)
	db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE").Scan(&stats.TodaySignups)
	db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'").Scan(&stats.WeekSignups)
	db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM verification_requests WHERE status = 'pending'").Scan(&stats.PendingVerifications)
	db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE is_verified = TRUE").Scan(&stats.VerifiedUsers)
	db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE is_verified = FALSE").Scan(&stats.UnverifiedUsers)
	db.Pool.QueryRow(ctx, "SELECT COALESCE(SUM(total_logins), 0) FROM users").Scan(&stats.TotalLogins)
	db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE is_admin = true").Scan(&stats.AdminCount)
	db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE total_logins > 1").Scan(&stats.ReturnedUsers)
	db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE last_login_at IS NULL").Scan(&stats.NeverLoggedIn)
	db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM posts").Scan(&stats.TotalPosts)
	db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM posts WHERE created_at >= NOW() - INTERVAL '7 days'").Scan(&stats.PostsThisWeek)
	db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM gigs").Scan(&stats.TotalGigs)

	if rows, err := db.Pool.Query(ctx, `
		SELECT COALESCE(NULLIF(role,''), 'unset'), COUNT(*)
		FROM users GROUP BY 1 ORDER BY 2 DESC`); err == nil {
		defer rows.Close()
		for rows.Next() {
			var rc models.RoleCount
			if rows.Scan(&rc.Role, &rc.Count) == nil {
				stats.RoleBreakdown = append(stats.RoleBreakdown, rc)
			}
		}
	}

	if rows, err := db.Pool.Query(ctx, `
		SELECT TO_CHAR(d::date, 'Mon DD') AS label, COALESCE(COUNT(u.id), 0)
		FROM generate_series(NOW() - INTERVAL '6 days', NOW(), '1 day') AS d
		LEFT JOIN users u ON u.created_at::date = d::date
		GROUP BY d ORDER BY d`); err == nil {
		defer rows.Close()
		for rows.Next() {
			var dc models.DailyCount
			if rows.Scan(&dc.Date, &dc.Count) == nil {
				stats.DailySignups = append(stats.DailySignups, dc)
			}
		}
	}

	return stats, nil
}

func ListAuditLog(ctx context.Context) ([]models.AuditLog, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT a.id, a.admin_id, u.full_name, a.action, a.target_id, a.target_name, a.details, a.created_at
		FROM admin_audit_log a
		LEFT JOIN users u ON u.id = a.admin_id
		ORDER BY a.created_at DESC LIMIT 50`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var logs []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		if rows.Scan(&l.ID, &l.AdminID, &l.AdminName, &l.Action, &l.TargetID, &l.TargetName, &l.Details, &l.CreatedAt) == nil {
			logs = append(logs, l)
		}
	}
	if logs == nil {
		logs = []models.AuditLog{}
	}
	return logs, nil
}

// WriteAuditLog records an admin action. Failures are logged but don't
// abort the caller — audit-log writes are best-effort.
func WriteAuditLog(ctx context.Context, adminID, action, targetID, targetName, details string) {
	if _, err := db.Pool.Exec(ctx,
		`INSERT INTO admin_audit_log (admin_id, action, target_id, target_name, details) VALUES ($1, $2, $3, $4, $5)`,
		adminID, action, targetID, targetName, details); err != nil {
		log.Printf("failed to write audit log (admin=%s action=%s target=%s): %v", adminID, action, targetID, err)
	}
}

// AdminListUsers applies optional filters (search/role/adminOnly).
func AdminListUsers(ctx context.Context, search, role, adminOnly string) ([]models.AdminUserView, error) {
	query := `SELECT id, email, full_name, role, verification_status, is_verified, is_admin, is_banned, banned_until, ban_message, created_at, last_login_at, total_logins, followers, following, posts FROM users WHERE 1=1`
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

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.AdminUserView
	for rows.Next() {
		var u models.AdminUserView
		var bannedUntil *time.Time
		if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.VerificationStatus, &u.IsVerified, &u.IsAdmin,
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
		users = []models.AdminUserView{}
	}
	return users, nil
}

func AdminGetUser(ctx context.Context, id string) (*models.AdminUserView, error) {
	var u models.AdminUserView
	err := db.Pool.QueryRow(ctx,
		`SELECT id, email, full_name, role, verification_status, is_verified, is_admin, created_at, last_login_at, total_logins, followers, following, posts FROM users WHERE id = $1`, id).Scan(
		&u.ID, &u.Email, &u.FullName, &u.Role, &u.VerificationStatus, &u.IsVerified, &u.IsAdmin, &u.CreatedAt, &u.LastLoginAt, &u.TotalLogins, &u.Followers, &u.Following, &u.Posts)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

type AdminUserPatch struct {
	Role               *string
	VerificationStatus *string
	IsVerified         *bool
	IsAdmin            *bool
}

// AdminUpdateUser builds a SET clause dynamically based on which fields
// are non-nil in patch. Returns the rows-affected count.
func AdminUpdateUser(ctx context.Context, id string, patch AdminUserPatch) (int64, error) {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1
	if patch.Role != nil {
		setClauses = append(setClauses, fmt.Sprintf("role = $%d", argIdx))
		args = append(args, *patch.Role)
		argIdx++
	}
	if patch.VerificationStatus != nil {
		setClauses = append(setClauses, fmt.Sprintf("verification_status = $%d", argIdx))
		args = append(args, *patch.VerificationStatus)
		argIdx++
	}
	if patch.IsVerified != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_verified = $%d", argIdx))
		args = append(args, *patch.IsVerified)
		argIdx++
	}
	if patch.IsAdmin != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_admin = $%d", argIdx))
		args = append(args, *patch.IsAdmin)
		argIdx++
	}
	if len(setClauses) == 0 {
		return 0, nil
	}
	setClauses = append(setClauses, "updated_at = CURRENT_TIMESTAMP")
	query := fmt.Sprintf("UPDATE users SET %s WHERE id = $%d", strings.Join(setClauses, ", "), argIdx)
	args = append(args, id)

	result, err := db.Pool.Exec(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

func AdminBanUser(ctx context.Context, id string, bannedUntil *time.Time, message string) (int64, error) {
	if bannedUntil != nil {
		result, err := db.Pool.Exec(ctx,
			"UPDATE users SET is_banned = true, banned_until = $1, ban_message = $2, updated_at = NOW() WHERE id = $3",
			bannedUntil, message, id)
		if err != nil {
			return 0, err
		}
		return result.RowsAffected(), nil
	}
	result, err := db.Pool.Exec(ctx,
		"UPDATE users SET is_banned = true, banned_until = NULL, ban_message = $1, updated_at = NOW() WHERE id = $2",
		message, id)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

func AdminUnbanUser(ctx context.Context, id string) (int64, error) {
	result, err := db.Pool.Exec(ctx,
		"UPDATE users SET is_banned = false, banned_until = NULL, ban_message = '', updated_at = NOW() WHERE id = $1", id)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

func AdminDeleteUser(ctx context.Context, id string) (int64, error) {
	result, err := db.Pool.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

func GetUserFullName(ctx context.Context, id string) string {
	var name string
	if err := db.Pool.QueryRow(ctx, "SELECT full_name FROM users WHERE id = $1", id).Scan(&name); err != nil {
		return "[unknown]"
	}
	return name
}

func GetSettings(ctx context.Context) (map[string]string, error) {
	rows, err := db.Pool.Query(ctx, "SELECT key, value FROM settings")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[string]string{}
	for rows.Next() {
		var k, v string
		if rows.Scan(&k, &v) == nil {
			result[k] = v
		}
	}
	return result, nil
}

func UpsertSetting(ctx context.Context, k, v string) {
	db.Pool.Exec(ctx,
		"INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
		k, v)
}

// EmailStats are the counters powering the admin email-quota panel.
type EmailStats struct {
	ThisMonth int
	LastMonth int
	Total     int
	Breakdown map[string]int
}

func FetchEmailStats(ctx context.Context) EmailStats {
	var s EmailStats
	s.Breakdown = map[string]int{}
	db.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(recipients), 0) FROM email_log
		WHERE sent_at >= DATE_TRUNC('month', NOW())`).Scan(&s.ThisMonth)
	db.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(recipients), 0) FROM email_log
		WHERE sent_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
		  AND sent_at < DATE_TRUNC('month', NOW())`).Scan(&s.LastMonth)
	db.Pool.QueryRow(ctx, "SELECT COALESCE(SUM(recipients), 0) FROM email_log").Scan(&s.Total)

	if rows, err := db.Pool.Query(ctx, `
		SELECT type, COALESCE(SUM(recipients), 0)
		FROM email_log
		WHERE sent_at >= DATE_TRUNC('month', NOW())
		GROUP BY type ORDER BY 2 DESC`); err == nil {
		defer rows.Close()
		for rows.Next() {
			var t string
			var n int
			if rows.Scan(&t, &n) == nil {
				s.Breakdown[t] = n
			}
		}
	}
	return s
}

func ListAdminEmails(ctx context.Context) ([]string, error) {
	rows, err := db.Pool.Query(ctx, "SELECT email FROM users WHERE is_admin = true")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var email string
		if rows.Scan(&email) == nil {
			out = append(out, email)
		}
	}
	return out, nil
}

func GetSetting(ctx context.Context, key string) string {
	var v string
	db.Pool.QueryRow(ctx, "SELECT value FROM settings WHERE key = $1", key).Scan(&v)
	return v
}

func LogEmailSend(ctx context.Context, typ string, recipients int) {
	db.Pool.Exec(ctx, "INSERT INTO email_log (type, recipients) VALUES ($1, $2)", typ, recipients)
}
