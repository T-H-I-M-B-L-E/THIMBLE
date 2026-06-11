package services

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/resend/resend-go/v2"

	"chat-app/internal/config"
	"chat-app/internal/db"
)

// Audience is a structured targeting filter shared by email broadcasts and
// in-app banners. Empty Roles means "all roles". VerifiedOnly is a modifier
// applied to the role set.
type Audience struct {
	Roles        []string `json:"roles"`        // designer | model | manufacturer | photographer | brand
	VerifiedOnly bool     `json:"verifiedOnly"`
}

// BroadcastInput is the admin-supplied payload for a broadcast send.
// SendEmail and ShowBanner can be combined (admin checks both checkboxes).
type BroadcastInput struct {
	Subject       string   `json:"subject"`
	Body          string   `json:"body"`          // plain text, newlines preserved
	Audience      Audience `json:"audience"`
	SendEmail     bool     `json:"sendEmail"`
	ShowBanner    bool     `json:"showBanner"`
	BannerMessage string   `json:"bannerMessage"` // short, single line
	BannerType    string   `json:"bannerType"`    // info | success | warning | critical
	BannerHours   int      `json:"bannerHours"`   // 0 = no expiry
}

func validRoles() map[string]bool {
	return map[string]bool{"designer": true, "model": true, "manufacturer": true, "photographer": true, "brand": true}
}

// AudienceLabel returns a human readable summary for the audit log.
func AudienceLabel(a Audience) string {
	parts := []string{}
	if len(a.Roles) == 0 {
		parts = append(parts, "all roles")
	} else {
		parts = append(parts, strings.Join(a.Roles, ", "))
	}
	if a.VerifiedOnly {
		parts = append(parts, "verified only")
	}
	return strings.Join(parts, " · ")
}

// BroadcastResult is what the handler returns to the admin UI.
type BroadcastResult struct {
	ID         int64 `json:"id"`
	Recipients int   `json:"recipients"`
	Succeeded  int   `json:"succeeded"`
	Failed     int   `json:"failed"`
	BannerID   int64 `json:"bannerId,omitempty"`
}

// SendBroadcast emails every opted-in user matching audience. Honours each
// user's product_updates preference so unsubscribed users are skipped.
//
// Sends via Resend in small batches with a tiny delay between batches to stay
// well within Resend's 10/sec rate limit. Logs the run in the broadcasts table.
func SendBroadcast(ctx context.Context, adminID string, input BroadcastInput) (*BroadcastResult, error) {
	if !input.SendEmail && !input.ShowBanner {
		return nil, fmt.Errorf("nothing to send — pick email, banner, or both")
	}
	if input.SendEmail && (strings.TrimSpace(input.Subject) == "" || strings.TrimSpace(input.Body) == "") {
		return nil, fmt.Errorf("subject and body are required for email")
	}
	if input.ShowBanner && strings.TrimSpace(input.BannerMessage) == "" {
		return nil, fmt.Errorf("banner message is required when showing a banner")
	}
	// Validate role list.
	valid := validRoles()
	for _, r := range input.Audience.Roles {
		if !valid[r] {
			return nil, fmt.Errorf("invalid role %q", r)
		}
	}

	result := &BroadcastResult{}
	audienceLabel := AudienceLabel(input.Audience)

	// ── 1. In-app banner ────────────────────────────────────────────────────
	if input.ShowBanner {
		bannerID, err := CreateBanner(ctx, adminID, BannerInput{
			Message:  input.BannerMessage,
			Type:     input.BannerType,
			Audience: input.Audience,
			Hours:    input.BannerHours,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create banner: %w", err)
		}
		result.BannerID = bannerID
	}

	// ── 2. Email broadcast ──────────────────────────────────────────────────
	if input.SendEmail {
		emails, err := resolveAudience(ctx, input.Audience)
		if err != nil {
			return nil, err
		}
		if len(emails) == 0 {
			return nil, fmt.Errorf("no recipients matched audience: %s", audienceLabel)
		}

		var broadcastID int64
		if err := db.Pool.QueryRow(ctx, `
			INSERT INTO broadcasts (sent_by, subject, body, audience, recipients)
			VALUES ($1, $2, $3, $4, $5) RETURNING id
		`, adminID, input.Subject, input.Body, audienceLabel, len(emails)).Scan(&broadcastID); err != nil {
			return nil, fmt.Errorf("failed to log broadcast: %w", err)
		}

		html := renderBroadcastHTML(input.Subject, input.Body)
		client := resend.NewClient(config.ResendKey())

		const batchSize = 8 // Resend's per-second rate limit is 10
		succeeded, failed := 0, 0
		type failedSend struct{ email, reason string }
		var failures []failedSend

		for i := 0; i < len(emails); i += batchSize {
			end := i + batchSize
			if end > len(emails) {
				end = len(emails)
			}
			for _, addr := range emails[i:end] {
				_, sendErr := client.Emails.Send(&resend.SendEmailRequest{
					From:    "THIMBLE <noreply@tvimble.tech>",
					To:      []string{addr},
					Subject: input.Subject,
					Html:    html,
				})
				if sendErr != nil {
					log.Printf("broadcast %d: send to %s failed: %v", broadcastID, addr, sendErr)
					failed++
					failures = append(failures, failedSend{email: addr, reason: sendErr.Error()})
				} else {
					succeeded++
				}
			}
			if end < len(emails) {
				time.Sleep(1100 * time.Millisecond)
			}
		}

		db.Pool.Exec(ctx, `UPDATE broadcasts SET succeeded = $1, failed = $2 WHERE id = $3`,
			succeeded, failed, broadcastID)

		// Persist per-recipient failure detail so it can be analysed later.
		for _, f := range failures {
			if _, err := db.Pool.Exec(ctx,
				`INSERT INTO broadcast_failures (broadcast_id, email, reason) VALUES ($1, $2, $3)`,
				broadcastID, f.email, f.reason); err != nil {
				log.Printf("broadcast %d: failed to log failure row for %s: %v", broadcastID, f.email, err)
			}
		}
		db.Pool.Exec(ctx, `INSERT INTO email_log (type, recipients) VALUES ('broadcast', $1)`, succeeded)

		result.ID = broadcastID
		result.Recipients = len(emails)
		result.Succeeded = succeeded
		result.Failed = failed
	}

	return result, nil
}

// resolveAudience returns the list of email addresses for the given audience,
// filtering out users who have opted out of product_updates and applying the
// role and verified-only filters.
func resolveAudience(ctx context.Context, a Audience) ([]string, error) {
	query := `
		SELECT email FROM users
		WHERE COALESCE((email_prefs->>'product_updates')::boolean, true) = true
		  AND is_banned = false
	`
	args := []any{}
	if len(a.Roles) > 0 {
		query += ` AND role = ANY($1)`
		args = append(args, a.Roles)
	}
	if a.VerifiedOnly {
		query += ` AND is_verified = true`
	}

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var e string
		if err := rows.Scan(&e); err == nil && e != "" {
			out = append(out, e)
		}
	}
	return out, nil
}

// CountAudience returns just the recipient count without sending. Powers the
// "this will send to N users" preview in the admin UI.
func CountAudience(ctx context.Context, a Audience) (int, error) {
	emails, err := resolveAudience(ctx, a)
	if err != nil {
		return 0, err
	}
	return len(emails), nil
}

// AudienceMatchesRole returns true if a user with the given role and verified
// flag is part of the audience. Used by the banner endpoint when deciding
// whether to surface a banner for the current viewer.
func AudienceMatchesRole(a Audience, role string, isVerified bool) bool {
	if a.VerifiedOnly && !isVerified {
		return false
	}
	if len(a.Roles) == 0 {
		return true
	}
	for _, r := range a.Roles {
		if r == role {
			return true
		}
	}
	return false
}

func renderBroadcastHTML(subject, body string) string {
	// Convert newlines to <br> and escape minimal HTML. Body is admin-authored
	// so we trust it, but still wrap it in a styled shell.
	bodyHTML := strings.ReplaceAll(body, "\n", "<br>")
	return fmt.Sprintf(`
<div style="font-family:-apple-system,system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#fafafa;color:#111">
  <p style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#999;margin:0 0 8px">THIMBLE</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;color:#000">%s</h1>
  <div style="font-size:15px;line-height:1.6;color:#222">%s</div>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0">
  <p style="font-size:11px;color:#888;margin:0">
    You're receiving this because you have product updates enabled on THIMBLE.<br>
    <a href="https://tvimble.tech/settings" style="color:#666">Manage your email preferences</a>
  </p>
</div>`, subject, bodyHTML)
}

// BroadcastSummary is a row in the recent-sends list shown above the
// compose form.
type BroadcastSummary struct {
	ID         int64     `json:"id"`
	SentBy     string    `json:"sentBy"`
	Subject    string    `json:"subject"`
	Audience   string    `json:"audience"`
	Recipients int       `json:"recipients"`
	Succeeded  int       `json:"succeeded"`
	Failed     int       `json:"failed"`
	CreatedAt  time.Time `json:"createdAt"`
}

func RecentBroadcasts(ctx context.Context, limit int) ([]BroadcastSummary, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := db.Pool.Query(ctx, `
		SELECT b.id, COALESCE(u.full_name, b.sent_by, ''),
		       b.subject, b.audience, b.recipients, b.succeeded, b.failed, b.created_at
		FROM broadcasts b
		LEFT JOIN users u ON u.id = b.sent_by
		ORDER BY b.created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []BroadcastSummary
	for rows.Next() {
		var s BroadcastSummary
		if err := rows.Scan(&s.ID, &s.SentBy, &s.Subject, &s.Audience, &s.Recipients, &s.Succeeded, &s.Failed, &s.CreatedAt); err == nil {
			out = append(out, s)
		}
	}
	return out, nil
}

// BroadcastFailure is one recipient that a broadcast failed to reach.
type BroadcastFailure struct {
	Email     string    `json:"email"`
	Reason    string    `json:"reason"`
	CreatedAt time.Time `json:"createdAt"`
}

// BroadcastFailuresFor returns the failed recipients for a broadcast. If
// broadcastID is 0, it returns failures from the most recent broadcast — which
// is what ARIA wants when the admin asks "which just failed and why".
func BroadcastFailuresFor(ctx context.Context, broadcastID int64) (int64, []BroadcastFailure, error) {
	if broadcastID == 0 {
		if err := db.Pool.QueryRow(ctx,
			`SELECT id FROM broadcasts ORDER BY created_at DESC LIMIT 1`).Scan(&broadcastID); err != nil {
			return 0, nil, nil // no broadcasts yet
		}
	}
	rows, err := db.Pool.Query(ctx,
		`SELECT email, reason, created_at FROM broadcast_failures
		 WHERE broadcast_id = $1 ORDER BY created_at`, broadcastID)
	if err != nil {
		return broadcastID, nil, err
	}
	defer rows.Close()
	var out []BroadcastFailure
	for rows.Next() {
		var f BroadcastFailure
		if err := rows.Scan(&f.Email, &f.Reason, &f.CreatedAt); err == nil {
			out = append(out, f)
		}
	}
	return broadcastID, out, nil
}
