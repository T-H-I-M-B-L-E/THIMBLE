package services

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/resend/resend-go/v2"

	"chat-app/internal/config"
	"chat-app/internal/db"
	"chat-app/internal/metrics"
	"chat-app/internal/repositories"
)

// Cooldown prevents repeated alerts for the same condition within 1 hour.
var (
	alertMu       sync.Mutex
	lastAlertSent = map[string]time.Time{}
)

const alertCooldown = 1 * time.Hour

func canAlert(key string) bool {
	alertMu.Lock()
	defer alertMu.Unlock()
	if t, ok := lastAlertSent[key]; ok && time.Since(t) < alertCooldown {
		return false
	}
	lastAlertSent[key] = time.Now()
	return true
}

// StartInfraMonitor runs a background goroutine that checks health every
// 60 seconds and emails admins when thresholds are breached.
func StartInfraMonitor(ctx context.Context) {
	go func() {
		// Wait 2 min after startup before first check so the server is warm.
		time.Sleep(2 * time.Minute)
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				checkAndAlert(ctx)
			}
		}
	}()
}

func checkAndAlert(ctx context.Context) {
	snap := metrics.Take()
	total := snap.Req2xx + snap.Req4xx + snap.Req5xx

	// 1. DB health
	if err := db.Pool.Ping(ctx); err != nil {
		sendAlert(ctx, "db_down", "🔴 Database is unreachable",
			fmt.Sprintf("The database failed a ping check at %s.\n\nError: %s\n\nThis will affect all API endpoints.", time.Now().UTC().Format(time.RFC3339), err.Error()))
	}

	// 2. Error rate > 10%
	if total > 50 {
		errRate := float64(snap.Req4xx+snap.Req5xx) / float64(total) * 100
		if errRate > 10 {
			sendAlert(ctx, "high_error_rate", "🟡 High API error rate",
				fmt.Sprintf("Error rate is %.1f%% (%d errors out of %d requests since last restart).\n\nBreakdown:\n- 4xx (client errors): %d\n- 5xx (server errors): %d",
					errRate, snap.Req4xx+snap.Req5xx, total, snap.Req4xx, snap.Req5xx))
		}
	}

	// 3. 5xx spike — more than 5 server errors since last check
	if snap.Req5xx > 5 {
		sendAlert(ctx, "5xx_spike", "🔴 Server errors detected",
			fmt.Sprintf("%d server-side (5xx) errors recorded since last restart.\n\nCheck the recent errors log at admin.tvimble.tech/admin/infra for details.", snap.Req5xx))
	}

	// 4. High goroutine count
	// (checked via runtime in the infra handler, but we can't import runtime here without overhead)
	// Skip for now — the infra page covers this visually.
}

func sendAlert(ctx context.Context, key, subject, body string) {
	if !canAlert(key) {
		return
	}
	adminEmails, err := repositories.ListAdminEmails(ctx)
	if err != nil || len(adminEmails) == 0 {
		log.Printf("alert: no admin emails found for alert %q", key)
		return
	}
	client := resend.NewClient(config.ResendKey())
	html := fmt.Sprintf(`
		<div style="font-family:monospace;max-width:600px;margin:0 auto;padding:24px;background:#0a0a0a;color:#e5e5e5;border-radius:8px">
			<p style="font-size:11px;letter-spacing:0.2em;color:#666;text-transform:uppercase;margin:0 0 16px">THIMBLE Infrastructure Alert</p>
			<h2 style="margin:0 0 20px;font-size:18px;color:#fff">%s</h2>
			<pre style="background:#111;padding:16px;border-radius:6px;font-size:13px;color:#ccc;white-space:pre-wrap;border:1px solid #222">%s</pre>
			<p style="font-size:12px;color:#444;margin:20px 0 0">Sent at %s · admin.tvimble.tech/admin/infra</p>
		</div>`,
		subject, body, time.Now().UTC().Format(time.RFC1123))

	_, sendErr := client.Emails.Send(&resend.SendEmailRequest{
		From:    "alerts@tvimble.tech",
		To:      adminEmails,
		Subject: "[THIMBLE] " + subject,
		Html:    html,
	})
	if sendErr != nil {
		log.Printf("alert: failed to send %q: %v", key, sendErr)
		return
	}
	db.Pool.Exec(ctx, "INSERT INTO email_log (type, recipients) VALUES ('infra_alert', $1)", len(adminEmails))
	log.Printf("alert: sent %q to %d admins", key, len(adminEmails))
}
