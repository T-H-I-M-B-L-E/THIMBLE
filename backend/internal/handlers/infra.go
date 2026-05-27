package handlers

import (
	"context"
	"fmt"
	"runtime"
	"time"

	"github.com/gofiber/fiber/v2"

	"chat-app/internal/db"
	"chat-app/internal/metrics"
)

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

	// Go runtime memory
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
