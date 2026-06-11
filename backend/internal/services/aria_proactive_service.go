package services

import (
	"context"
	"fmt"
	"log"
	"time"

	"chat-app/internal/db"
	"chat-app/internal/metrics"
	"chat-app/internal/models"
	"chat-app/internal/repositories"
)

// StartARIAProactive starts background goroutines for:
//   - Churn detection at 9:00am UTC (flags users inactive 14+ days)
//   - Mid-day health check at 13:00 UTC (sends alert if thresholds crossed)
func StartARIAProactive(ctx context.Context) {
	go runChurnDetection(ctx)
	go runMidDayHealthCheck(ctx)
}

// ── Churn detection ──────────────────────────────────────────────────────────

func runChurnDetection(ctx context.Context) {
	for {
		now := time.Now().UTC()
		next := time.Date(now.Year(), now.Month(), now.Day(), 9, 0, 0, 0, time.UTC)
		if !next.After(now) {
			next = next.Add(24 * time.Hour)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Until(next)):
		}
		runChurnCheck(ctx)
	}
}

func runChurnCheck(ctx context.Context) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, email, full_name
		FROM users
		WHERE last_login_at IS NOT NULL
		  AND last_login_at < NOW() - INTERVAL '14 days'
		  AND created_at < NOW() - INTERVAL '14 days'
		  AND is_banned = false
		  AND is_admin = false
		LIMIT 500
	`)
	if err != nil {
		log.Printf("churn: query error: %v", err)
		return
	}
	defer rows.Close()

	type churnUser struct{ ID, Email, Name string }
	var atRisk []churnUser
	for rows.Next() {
		var u churnUser
		if err := rows.Scan(&u.ID, &u.Email, &u.Name); err == nil {
			atRisk = append(atRisk, u)
		}
	}

	if len(atRisk) == 0 {
		return
	}

	if !canAlert("churn_alert") {
		return
	}

	subject := fmt.Sprintf("✦ ARIA: %d users at churn risk", len(atRisk))

	var listHTML string
	limit := len(atRisk)
	if limit > 10 {
		limit = 10
	}
	for _, u := range atRisk[:limit] {
		listHTML += fmt.Sprintf("<li>%s (%s)</li>", u.Name, u.Email)
	}
	if len(atRisk) > 10 {
		listHTML += fmt.Sprintf("<li>...and %d more</li>", len(atRisk)-10)
	}

	body := fmt.Sprintf(`
<p style="font-family:sans-serif;color:#ccc">ARIA has detected <strong>%d users</strong> who haven't logged in for 14+ days.</p>
<ul style="font-family:sans-serif;color:#aaa">%s</ul>
<p style="font-family:sans-serif;color:#888">Consider sending a re-engagement email via ARIA → <a href="https://tvimble.tech/admin/ai" style="color:#c084fc">Open ARIA</a></p>
`, len(atRisk), listHTML)

	if err := SendARIAEmail(ctx, subject, body); err != nil {
		log.Printf("churn: email error: %v", err)
	}
	log.Printf("churn: flagged %d at-risk users, alert sent", len(atRisk))
}

// ── Mid-day health check ─────────────────────────────────────────────────────

func runMidDayHealthCheck(ctx context.Context) {
	for {
		now := time.Now().UTC()
		next := time.Date(now.Year(), now.Month(), now.Day(), 13, 0, 0, 0, time.UTC)
		if !next.After(now) {
			next = next.Add(24 * time.Hour)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Until(next)):
		}
		runMidDayAlert(ctx)
	}
}

func runMidDayAlert(ctx context.Context) {
	snap := metrics.Take()
	issues := []string{}

	// Alert if 5xx error count is high relative to total traffic
	total := snap.Req2xx + snap.Req4xx + snap.Req5xx
	if total > 100 && snap.Req5xx > 0 {
		rate := float64(snap.Req5xx) / float64(total) * 100
		if rate > 2.0 {
			issues = append(issues, fmt.Sprintf("High error rate: %.1f%% 5xx errors (%d errors / %d total)", rate, snap.Req5xx, total))
		}
	}

	if err := db.Pool.Ping(ctx); err != nil {
		issues = append(issues, "Database unreachable")
	}

	if len(issues) == 0 {
		return
	}

	if !canAlert("midday_alert") {
		return
	}

	var issueList string
	for _, iss := range issues {
		issueList += fmt.Sprintf("<li>%s</li>", iss)
	}

	subject := fmt.Sprintf("✦ ARIA Mid-day Alert — %d issue(s) detected", len(issues))
	body := fmt.Sprintf(`
<p style="font-family:sans-serif;color:#ccc">ARIA detected <strong>%d issue(s)</strong> at the 1pm UTC health check:</p>
<ul style="font-family:sans-serif;color:#f87171">%s</ul>
<p style="font-family:sans-serif;color:#888">Check the infra dashboard → <a href="https://tvimble.tech/admin/infra" style="color:#c084fc">Open Dashboard</a></p>
`, len(issues), issueList)

	if err := SendARIAEmail(ctx, subject, body); err != nil {
		log.Printf("midday alert: email error: %v", err)
	}
}

// ── User management helpers (called by ARIA API handler) ─────────────────────

type ARIAUserActionInput struct {
	Action        string `json:"action"`         // "ban"|"unban"|"verify"|"look_up"
	UserID        string `json:"user_id"`        // UUID
	DurationHours int    `json:"duration_hours"` // for ban (0 = permanent)
	Reason        string `json:"reason"`
	AdminID       string `json:"-"`              // real admin who instructed ARIA (set server-side)
	Prompt        string `json:"prompt"`         // what the admin typed, for the audit trail
}

type ARIAUserActionResult struct {
	OK      bool               `json:"ok"`
	Message string             `json:"message"`
	User    *models.AdminUserView `json:"user,omitempty"`
}

func ExecuteARIAUserAction(ctx context.Context, input ARIAUserActionInput) ARIAUserActionResult {
	// Attribute to the real admin who instructed ARIA, falling back to the
	// system actor only if (somehow) no admin identity was passed.
	actor := input.AdminID
	if actor == "" {
		actor = "aria-system"
	}
	// Suffix appended to audit details so the trail shows it came through ARIA
	// and what the admin actually typed.
	via := "via ARIA"
	if input.Prompt != "" {
		via = fmt.Sprintf("via ARIA — admin asked: %q", input.Prompt)
	}

	switch input.Action {
	case "look_up":
		u, err := repositories.AdminGetUser(ctx, input.UserID)
		if err != nil {
			return ARIAUserActionResult{OK: false, Message: "User not found"}
		}
		return ARIAUserActionResult{OK: true, Message: "User found", User: u}

	case "ban":
		svcErr := AdminBanUser(ctx, actor, input.UserID, input.DurationHours, input.Reason)
		if svcErr != nil {
			return ARIAUserActionResult{OK: false, Message: svcErr.Message}
		}
		dur := "permanently"
		if input.DurationHours > 0 {
			dur = fmt.Sprintf("for %d hours", input.DurationHours)
		}
		repositories.WriteAuditLog(ctx, actor, "aria_ban_user", input.UserID,
			repositories.GetUserFullName(ctx, input.UserID), via)
		return ARIAUserActionResult{OK: true, Message: fmt.Sprintf("User banned %s", dur)}

	case "unban":
		svcErr := AdminUnbanUser(ctx, actor, input.UserID)
		if svcErr != nil {
			return ARIAUserActionResult{OK: false, Message: svcErr.Message}
		}
		repositories.WriteAuditLog(ctx, actor, "aria_unban_user", input.UserID,
			repositories.GetUserFullName(ctx, input.UserID), via)
		return ARIAUserActionResult{OK: true, Message: "User unbanned"}

	case "verify":
		_, err := db.Pool.Exec(ctx,
			`UPDATE users SET is_verified = true, verification_status = 'approved' WHERE id = $1`,
			input.UserID)
		if err != nil {
			return ARIAUserActionResult{OK: false, Message: "DB error: " + err.Error()}
		}
		repositories.WriteAuditLog(ctx, actor, "aria_verify_user", input.UserID,
			repositories.GetUserFullName(ctx, input.UserID), via)
		return ARIAUserActionResult{OK: true, Message: "User verified"}

	default:
		return ARIAUserActionResult{OK: false, Message: "Unknown action: " + input.Action}
	}
}
