package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"chat-app/internal/db"
	"chat-app/internal/metrics"
	"chat-app/internal/services"
)

type uptimeMonitor struct {
	ID                  int64  `json:"id"`
	FriendlyName        string `json:"friendly_name"`
	URL                 string `json:"url"`
	Status              int    `json:"status"`
	CustomUptimeRatio   string `json:"custom_uptime_ratio"`
	AverageResponseTime string `json:"average_response_time"`
}

type uptimeResp struct {
	Stat     string          `json:"stat"`
	Monitors []uptimeMonitor `json:"monitors"`
}

// fetchUptimeRobot queries the UptimeRobot API for current monitor status.
// Returns nil if the key is unset so the dashboard degrades gracefully.
func fetchUptimeRobot() *uptimeResp {
	key := os.Getenv("UPTIMEROBOT_API_KEY")
	if key == "" {
		return nil
	}
	form := url.Values{}
	form.Set("api_key", key)
	form.Set("format", "json")
	form.Set("custom_uptime_ratios", "1-7-30")
	client := http.Client{Timeout: 5 * time.Second}
	req, _ := http.NewRequest("POST", "https://api.uptimerobot.com/v2/getMonitors", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := client.Do(req)
	if err != nil {
		return nil
	}
	defer res.Body.Close()
	var out uptimeResp
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return nil
	}
	if out.Stat != "ok" {
		return nil
	}
	return &out
}

// AdminTestAlert fires a manual test alert email so admins can verify the
// alerting pipeline without waiting for a real outage.
func AdminTestAlert(c *fiber.Ctx) error {
	if err := services.SendTestAlert(c.Context()); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true, "message": "Test alert email sent to all admins"})
}

// fetchEmailStats counts email_log rows grouped by day window.
type emailStats struct {
	SentToday  int64  `json:"sentToday"`
	SentWeek   int64  `json:"sentWeek"`
	SentTotal  int64  `json:"sentTotal"`
	LastSentAt string `json:"lastSentAt"`
}

func fetchEmailStats(ctx context.Context) emailStats {
	var s emailStats
	var lastTime *time.Time
	db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '24 hours'),
			COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '7 days'),
			COUNT(*),
			MAX(sent_at)
		FROM email_log
	`).Scan(&s.SentToday, &s.SentWeek, &s.SentTotal, &lastTime)
	if lastTime != nil {
		s.LastSentAt = lastTime.UTC().Format(time.RFC3339)
	}
	return s
}

// fetchUserActivity returns active-user counts based on last_login_at.
type userActivity struct {
	Active24h   int64 `json:"active24h"`
	Active7d    int64 `json:"active7d"`
	NewToday    int64 `json:"newToday"`
	NewThisWeek int64 `json:"newThisWeek"`
	Total       int64 `json:"total"`
	Banned      int64 `json:"banned"`
}

func fetchUserActivity(ctx context.Context) userActivity {
	var u userActivity
	db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '24 hours'),
			COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '7 days'),
			COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'),
			COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'),
			COUNT(*),
			COUNT(*) FILTER (WHERE is_banned = TRUE)
		FROM users
	`).Scan(&u.Active24h, &u.Active7d, &u.NewToday, &u.NewThisWeek, &u.Total, &u.Banned)
	return u
}

// fetchTableSizes returns the top 10 largest tables by total size.
type tableSize struct {
	Name      string `json:"name"`
	Size      string `json:"size"`
	SizeBytes int64  `json:"sizeBytes"`
	RowCount  int64  `json:"rowCount"`
}

func fetchTableSizes(ctx context.Context) []tableSize {
	rows, err := db.Pool.Query(ctx, `
		SELECT
			relname,
			pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
			pg_total_relation_size(c.oid) AS size_bytes,
			COALESCE(n_live_tup, 0) AS row_count
		FROM pg_class c
		LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
		WHERE c.relkind = 'r'
		  AND c.relnamespace = 'public'::regnamespace
		ORDER BY pg_total_relation_size(c.oid) DESC
		LIMIT 10
	`)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []tableSize
	for rows.Next() {
		var t tableSize
		if err := rows.Scan(&t.Name, &t.Size, &t.SizeBytes, &t.RowCount); err == nil {
			out = append(out, t)
		}
	}
	return out
}

// fetchR2Stats queries the Cloudflare API for R2 bucket size and request counts.
// Returns nil if Cloudflare credentials aren't configured.
type r2Stats struct {
	BucketName    string `json:"bucketName"`
	SizeBytes     int64  `json:"sizeBytes"`
	SizePretty    string `json:"sizePretty"`
	ObjectCount   int64  `json:"objectCount"`
	Configured    bool   `json:"configured"`
}

func fetchR2Stats(ctx context.Context) r2Stats {
	accountID := os.Getenv("R2_ACCOUNT_ID")
	apiToken := os.Getenv("CLOUDFLARE_API_TOKEN")
	bucket := os.Getenv("R2_BUCKET_NAME")
	if accountID == "" || apiToken == "" || bucket == "" {
		return r2Stats{BucketName: bucket, Configured: false}
	}
	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/r2/buckets/%s/usage", accountID, bucket)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+apiToken)
	client := http.Client{Timeout: 5 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return r2Stats{BucketName: bucket, Configured: true}
	}
	defer res.Body.Close()
	var body struct {
		Success bool `json:"success"`
		Result  struct {
			PayloadSize string `json:"payloadSize"`
			ObjectCount string `json:"objectCount"`
		} `json:"result"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil || !body.Success {
		return r2Stats{BucketName: bucket, Configured: true}
	}
	var size, count int64
	fmt.Sscanf(body.Result.PayloadSize, "%d", &size)
	fmt.Sscanf(body.Result.ObjectCount, "%d", &count)
	return r2Stats{
		BucketName:  bucket,
		SizeBytes:   size,
		SizePretty:  prettyBytes(size),
		ObjectCount: count,
		Configured:  true,
	}
}

func prettyBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

func AdminInfra(c *fiber.Ctx) error {
	// DB ping + pool stats
	dbStart := time.Now()
	dbOk := true
	dbErr := ""
	var dbOpen, dbIdle, dbTotal int32
	if err := db.Pool.Ping(context.Background()); err != nil {
		dbOk = false
		dbErr = err.Error()
	} else {
		stat := db.Pool.Stat()
		dbOpen = stat.AcquiredConns()
		dbIdle = stat.IdleConns()
		dbTotal = stat.TotalConns()
	}
	dbLatencyMs := time.Since(dbStart).Milliseconds()

	// Top slow queries from pg_stat_statements (may not be enabled on all hosts)
	type queryRow struct {
		Query       string  `json:"query"`
		Calls       int64   `json:"calls"`
		MeanMs      float64 `json:"meanMs"`
		TotalMs     float64 `json:"totalMs"`
		StddevMs    float64 `json:"stddevMs"`
	}
	var slowQueries []queryRow
	rows, qErr := db.Pool.Query(context.Background(), `
		SELECT LEFT(query, 120), calls,
		       mean_exec_time, total_exec_time, stddev_exec_time
		FROM pg_stat_statements
		WHERE query NOT LIKE '%pg_stat%'
		ORDER BY mean_exec_time DESC
		LIMIT 10
	`)
	if qErr == nil {
		defer rows.Close()
		for rows.Next() {
			var r queryRow
			if err := rows.Scan(&r.Query, &r.Calls, &r.MeanMs, &r.TotalMs, &r.StddevMs); err == nil {
				slowQueries = append(slowQueries, r)
			}
		}
	}

	// Go runtime
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	snap := metrics.Take()
	total := snap.Req2xx + snap.Req4xx + snap.Req5xx
	errRate := 0.0
	if total > 0 {
		errRate = float64(snap.Req4xx+snap.Req5xx) / float64(total) * 100
	}

	return c.JSON(fiber.Map{
		"backend": fiber.Map{
			"ok":        true,
			"uptime":    fmtUptime(time.Duration(snap.UptimeS) * time.Second),
			"uptimeSec": snap.UptimeS,
		},
		"database": fiber.Map{
			"ok":         dbOk,
			"error":      dbErr,
			"latencyMs":  dbLatencyMs,
			"connsOpen":  dbOpen,
			"connsIdle":  dbIdle,
			"connsTotal": dbTotal,
		},
		"runtime": fiber.Map{
			"goroutines":    runtime.NumGoroutine(),
			"heapAllocMB":   fmt.Sprintf("%.1f", float64(mem.HeapAlloc)/1024/1024),
			"heapSysMB":     fmt.Sprintf("%.1f", float64(mem.HeapSys)/1024/1024),
			"gcPauseLastMs": fmt.Sprintf("%.2f", float64(mem.PauseNs[(mem.NumGC+255)%256])/1e6),
			"gcRuns":        mem.NumGC,
		},
		"requests": fiber.Map{
			"total":      total,
			"ok":         snap.Req2xx,
			"err4xx":     snap.Req4xx,
			"err5xx":     snap.Req5xx,
			"errRatePct": fmt.Sprintf("%.1f", errRate),
		},
		"websockets": fiber.Map{
			"activeConns": snap.WSConns,
		},
		"recentErrors":   metrics.RecentErrors(),
		"recentSlows":    metrics.RecentSlows(),
		"slowQueries":    slowQueries,
		"slowestRoutes":  metrics.TopSlowestRoutes(10, 3),
		"uptimeRobot":    fetchUptimeRobot(),
		"emailStats":     fetchEmailStats(context.Background()),
		"userActivity":   fetchUserActivity(context.Background()),
		"tableSizes":     fetchTableSizes(context.Background()),
		"r2":             fetchR2Stats(context.Background()),
		"alerts": fiber.Map{
			"thresholds": fiber.Map{
				"errRatePct":   10,
				"slowMs":       metrics.SlowThresholdMs,
				"5xxThreshold": 5,
			},
		},
	})
}

func fmtUptime(d time.Duration) string {
	days := int(d.Hours()) / 24
	hours := int(d.Hours()) % 24
	mins := int(d.Minutes()) % 60
	if days > 0 {
		return fmt.Sprintf("%dd %dh %dm", days, hours, mins)
	}
	if hours > 0 {
		return fmt.Sprintf("%dh %dm", hours, mins)
	}
	return fmt.Sprintf("%dm", mins)
}
