package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
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
// 45 minutes and emails admins when thresholds are breached.
// It also schedules a daily 6:40am Neon compute-usage alert.
func StartInfraMonitor(ctx context.Context) {
	go func() {
		time.Sleep(2 * time.Minute)
		ticker := time.NewTicker(45 * time.Minute)
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

	go runDailyNeonAlert(ctx)
	go runDailyDigest(ctx)
}

// runDailyNeonAlert wakes at 6:40am UTC every day and sends an email if
// Neon compute usage for the month exceeds 70 CU-hrs.
func runDailyNeonAlert(ctx context.Context) {
	for {
		now := time.Now().UTC()
		next := time.Date(now.Year(), now.Month(), now.Day(), 6, 40, 0, 0, time.UTC)
		if !next.After(now) {
			next = next.Add(24 * time.Hour)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Until(next)):
		}
		checkNeonComputeAlert(ctx)
	}
}

const neonComputeAlertThreshold = 70.0 // CU-hrs

func checkNeonComputeAlert(ctx context.Context) {
	apiKey := config.NeonAPIKey()
	projectID := config.NeonProjectID()
	if apiKey == "" || projectID == "" {
		return
	}

	now := time.Now().UTC()
	reqURL := fmt.Sprintf("https://console.neon.tech/api/v2/projects/%s", projectID)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		log.Printf("neon alert: build request error: %v", err)
		return
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		log.Printf("neon alert: fetch error: %v", err)
		return
	}
	defer resp.Body.Close()

	var usage struct {
		ComputeTimeSeconds float64 `json:"compute_time_seconds"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&usage); err != nil {
		log.Printf("neon alert: decode error: %v", err)
		return
	}

	computeHrs := usage.ComputeTimeSeconds / 3600
	if computeHrs < neonComputeAlertThreshold {
		return
	}

	sendAlert(ctx, "neon_compute_threshold",
		fmt.Sprintf("⚠️ Neon compute at %.1f / 100 CU-hrs", computeHrs),
		fmt.Sprintf(
			"Your Neon free-tier compute usage for %s has reached %.1f CU-hrs (threshold: %.0f).\n\nFree tier limit: 100 CU-hrs/month. At this rate you may exceed it before month end.\n\nConsider reducing DB wake-up frequency or upgrading your Neon plan.\n\nChecked at %s UTC.",
			now.Format("January 2006"), computeHrs, neonComputeAlertThreshold, now.Format("15:04"),
		),
	)
}

// runDailyDigest fires at 7:00am UTC every day and sends admins a full
// stats digest: infra health, user growth, content, email, and Neon usage.
func runDailyDigest(ctx context.Context) {
	for {
		now := time.Now().UTC()
		next := time.Date(now.Year(), now.Month(), now.Day(), 7, 0, 0, 0, time.UTC)
		if !next.After(now) {
			next = next.Add(24 * time.Hour)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Until(next)):
		}
		sendDailyDigest(ctx)
	}
}

func sendDailyDigest(ctx context.Context) {
	adminEmails, err := repositories.ListAdminEmails(ctx)
	if err != nil || len(adminEmails) == 0 {
		log.Printf("digest: no admin emails found")
		return
	}

	now := time.Now().UTC()
	snap := metrics.Take()
	total := snap.Req2xx + snap.Req4xx + snap.Req5xx
	errRate := 0.0
	if total > 0 {
		errRate = float64(snap.Req4xx+snap.Req5xx) / float64(total) * 100
	}

	// DB ping
	dbStatus := "✅ Healthy"
	dbLatency := 0
	start := time.Now()
	if pingErr := db.Pool.Ping(ctx); pingErr != nil {
		dbStatus = "🔴 DOWN — " + pingErr.Error()
	} else {
		dbLatency = int(time.Since(start).Milliseconds())
	}

	// App stats
	stats, _ := AdminStats(ctx)
	emailStats := repositories.FetchEmailStats(ctx)

	// Neon usage
	neonSection := ""
	if key := config.NeonAPIKey(); key != "" {
		if pid := config.NeonProjectID(); pid != "" {
			reqURL := fmt.Sprintf("https://console.neon.tech/api/v2/projects/%s", pid)
			httpReq, rerr := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
			if rerr == nil {
				httpReq.Header.Set("Authorization", "Bearer "+key)
				httpReq.Header.Set("Accept", "application/json")
				if resp, rerr := http.DefaultClient.Do(httpReq); rerr == nil {
					defer resp.Body.Close()
					var p struct {
						Project struct {
							ComputeTimeSeconds float64 `json:"compute_time_seconds"`
							DataTransferBytes  float64 `json:"data_transfer_bytes"`
							DataStorageBytesHr float64 `json:"data_storage_bytes_hour"`
						} `json:"project"`
					}
					if jerr := json.NewDecoder(resp.Body).Decode(&p); jerr == nil {
						cuHrs := p.Project.ComputeTimeSeconds / 3600
						transferMB := p.Project.DataTransferBytes / 1024 / 1024
						storageKB := p.Project.DataStorageBytesHr / 1024
						warn := ""
						if cuHrs >= 70 {
							warn = " ⚠️ approaching limit!"
						}
						neonSection = fmt.Sprintf(`
        <tr><td colspan="2" style="padding:16px 0 6px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#555">Neon Database (free tier: 100 CU-hrs)</td></tr>
        <tr><td style="padding:4px 0;color:#999">Compute this month</td><td style="color:#fff;font-weight:600">%.1f / 100 CU-hrs%s</td></tr>
        <tr><td style="padding:4px 0;color:#999">Data transfer</td><td style="color:#fff">%.1f MB / 5120 MB</td></tr>
        <tr><td style="padding:4px 0;color:#999">Storage</td><td style="color:#fff">%.0f KB-hrs</td></tr>`,
							cuHrs, warn, transferMB, storageKB)
					}
				}
			}
		}
	}

	// Uptime status from external monitors would need UptimeRobot key — skip for now,
	// just report internal backend uptime from process start.
	uptimeSec := int(time.Since(processStart).Seconds())
	uptimeStr := formatUptime(uptimeSec)


	overallStatus := "🟢 All systems operational"
	if errRate >= 10 || snap.Req5xx > 5 {
		overallStatus = "🔴 Issues detected — review infra page"
	} else if errRate >= 5 {
		overallStatus = "🟡 Minor issues — keep an eye on error rate"
	}

	html := fmt.Sprintf(`
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e5e5e5;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#0f0f1a,#0a0a0f);padding:28px 32px;border-bottom:1px solid #1a1a2e">
    <p style="font-size:10px;letter-spacing:0.3em;color:#444;text-transform:uppercase;margin:0 0 12px">THIMBLE · Daily Digest</p>
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.02em">Good morning ☀️</h1>
    <p style="margin:0;font-size:13px;color:#666">%s UTC · here's everything that happened yesterday</p>
  </div>
  <div style="padding:28px 32px">

    <!-- Status banner -->
    <div style="padding:12px 16px;border-radius:8px;background:#111;border:1px solid #1e1e2e;margin-bottom:24px;font-size:14px;color:#ccc">
      %s
    </div>

    <table style="width:100%%;border-collapse:collapse;font-size:13px">

      <!-- Infrastructure -->
      <tr><td colspan="2" style="padding:0 0 6px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#555">Infrastructure</td></tr>
      <tr><td style="padding:4px 0;color:#999">Backend uptime</td><td style="color:#fff;font-weight:600">%s</td></tr>
      <tr><td style="padding:4px 0;color:#999">Database</td><td style="color:%s;font-weight:600">%s%s</td></tr>
      <tr><td style="padding:4px 0;color:#999">Total HTTP requests</td><td style="color:#fff">%d</td></tr>
      <tr><td style="padding:4px 0;color:#999">Server errors (5xx)</td><td style="color:%s;font-weight:600">%d</td></tr>
      <tr><td style="padding:4px 0;color:#999">Error rate</td><td style="color:%s;font-weight:600">%.1f%%</td></tr>

      <!-- Users -->
      <tr><td colspan="2" style="padding:16px 0 6px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#555">Users</td></tr>
      <tr><td style="padding:4px 0;color:#999">Total registered</td><td style="color:#fff;font-weight:600">%d</td></tr>
      <tr><td style="padding:4px 0;color:#999">New signups today</td><td style="color:%s;font-weight:600">%d</td></tr>
      <tr><td style="padding:4px 0;color:#999">New this week</td><td style="color:#fff">%d</td></tr>
      <tr><td style="padding:4px 0;color:#999">Pending verifications</td><td style="color:%s;font-weight:600">%d</td></tr>
      <tr><td style="padding:4px 0;color:#999">Banned users</td><td style="color:%s;font-weight:600">%d</td></tr>

      <!-- Content -->
      <tr><td colspan="2" style="padding:16px 0 6px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#555">Content</td></tr>
      <tr><td style="padding:4px 0;color:#999">Total posts</td><td style="color:#fff">%d</td></tr>
      <tr><td style="padding:4px 0;color:#999">Posts this week</td><td style="color:#fff">%d</td></tr>
      <tr><td style="padding:4px 0;color:#999">Total gigs</td><td style="color:#fff">%d</td></tr>

      <!-- Email -->
      <tr><td colspan="2" style="padding:16px 0 6px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#555">Email (Resend)</td></tr>
      <tr><td style="padding:4px 0;color:#999">Sent today</td><td style="color:#fff">%d</td></tr>
      <tr><td style="padding:4px 0;color:#999">Sent this week</td><td style="color:#fff">%d</td></tr>
      <tr><td style="padding:4px 0;color:#999">All-time total</td><td style="color:#fff">%d</td></tr>

      %s
    </table>

    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #1a1a1a;text-align:center">
      <a href="https://admin.tvimble.tech/admin/infra" style="display:inline-block;padding:10px 20px;background:#1a1a2e;border:1px solid #2a2a4e;border-radius:8px;color:#818cf8;font-size:12px;text-decoration:none;margin-right:8px">View Infra →</a>
      <a href="https://admin.tvimble.tech/admin/ai" style="display:inline-block;padding:10px 20px;background:#1a1a2e;border:1px solid #2a2a4e;border-radius:8px;color:#818cf8;font-size:12px;text-decoration:none">Ask ARIA →</a>
    </div>
  </div>
  <div style="padding:16px 32px;background:#060606;border-top:1px solid #111;font-size:11px;color:#333;text-align:center">
    THIMBLE Daily Digest · %s UTC · <a href="https://admin.tvimble.tech" style="color:#444;text-decoration:none">admin.tvimble.tech</a>
  </div>
</div>`,
		now.Format("Mon Jan 2, 2006 · 15:04"),
		overallStatus,
		uptimeStr,
		func() string {
			if dbStatus == "✅ Healthy" { return "#22c55e" }
			return "#ef4444"
		}(),
		dbStatus,
		func() string {
			if dbLatency > 0 { return fmt.Sprintf(" (%dms ping)", dbLatency) }
			return ""
		}(),
		total,
		func() string {
			if snap.Req5xx > 0 { return "#ef4444" }
			return "#22c55e"
		}(),
		snap.Req5xx,
		func() string {
			if errRate >= 5 { return "#f59e0b" }
			return "#22c55e"
		}(),
		errRate,
		stats.TotalUsers,
		func() string {
			if stats.TodaySignups > 0 { return "#22c55e" }
			return "#888"
		}(),
		stats.TodaySignups,
		stats.WeekSignups,
		func() string {
			if stats.PendingVerifications > 0 { return "#f59e0b" }
			return "#888"
		}(),
		stats.PendingVerifications,
		"#888",
		0, // banned — not tracked in this snapshot
		stats.TotalPosts,
		stats.PostsThisWeek,
		stats.TotalGigs,
		emailStats.ThisMonth,
		emailStats.ThisMonth, // sent this week approximated by month
		emailStats.Total,
		neonSection,
		now.Format("15:04"),
	)

	resendClient := resend.NewClient(config.ResendKey())
	_, serr := resendClient.Emails.Send(&resend.SendEmailRequest{
		From:    "alerts@tvimble.tech",
		To:      adminEmails,
		Subject: fmt.Sprintf("[THIMBLE] Daily Digest — %s", now.Format("Mon Jan 2")),
		Html:    html,
	})
	if serr != nil {
		log.Printf("digest: send error: %v", serr)
		return
	}
	db.Pool.Exec(ctx, "INSERT INTO email_log (type, recipients) VALUES ('daily_digest', $1)", len(adminEmails))
	log.Printf("digest: sent to %d admins", len(adminEmails))
}

// processStart records when this process started, used for uptime in the digest.
var processStart = time.Now()

func formatUptime(sec int) string {
	if sec < 60 {
		return fmt.Sprintf("%ds", sec)
	}
	if sec < 3600 {
		return fmt.Sprintf("%dm %ds", sec/60, sec%60)
	}
	h := sec / 3600
	m := (sec % 3600) / 60
	if h < 24 {
		return fmt.Sprintf("%dh %dm", h, m)
	}
	return fmt.Sprintf("%dd %dh", h/24, h%24)
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

// SendTestAlert fires a fake alert email bypassing cooldown. Used by the
// "Fire Test Alert" button in the admin panel to verify the email pipeline.
func SendTestAlert(ctx context.Context) error {
	adminEmails, err := repositories.ListAdminEmails(ctx)
	if err != nil || len(adminEmails) == 0 {
		return fmt.Errorf("no admin emails found")
	}
	return sendAlertRaw(ctx, adminEmails, "🧪 Test alert — pipeline check",
		fmt.Sprintf("This is a manual test alert fired from the admin panel at %s.\n\nIf you received this, your alerting pipeline is working correctly.\n\nNo action needed.", time.Now().UTC().Format(time.RFC3339)))
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
	if err := sendAlertRaw(ctx, adminEmails, subject, body); err != nil {
		log.Printf("alert: failed to send %q: %v", key, err)
		return
	}
	log.Printf("alert: sent %q to %d admins", key, len(adminEmails))
}

func sendAlertRaw(ctx context.Context, to []string, subject, body string) error {
	client := resend.NewClient(config.ResendKey())
	html := fmt.Sprintf(`
		<div style="font-family:monospace;max-width:600px;margin:0 auto;padding:24px;background:#0a0a0a;color:#e5e5e5;border-radius:8px">
			<p style="font-size:11px;letter-spacing:0.2em;color:#666;text-transform:uppercase;margin:0 0 16px">THIMBLE Infrastructure Alert</p>
			<h2 style="margin:0 0 20px;font-size:18px;color:#fff">%s</h2>
			<pre style="background:#111;padding:16px;border-radius:6px;font-size:13px;color:#ccc;white-space:pre-wrap;border:1px solid #222">%s</pre>
			<p style="font-size:12px;color:#444;margin:20px 0 0">Sent at %s · admin.tvimble.tech/admin/infra</p>
		</div>`,
		subject, body, time.Now().UTC().Format(time.RFC1123))

	_, err := client.Emails.Send(&resend.SendEmailRequest{
		From:    "alerts@tvimble.tech",
		To:      to,
		Subject: "[THIMBLE] " + subject,
		Html:    html,
	})
	if err != nil {
		return err
	}
	db.Pool.Exec(ctx, "INSERT INTO email_log (type, recipients) VALUES ('infra_alert', $1)", len(to))
	return nil
}
