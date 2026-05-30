package metrics

import (
	"sort"
	"sync"
)

// routeStats tracks total latency, hit count, and max latency per normalised
// route. Bounded to 200 distinct routes to keep memory predictable.
var (
	routeMu     sync.Mutex
	routeTotals = map[string]*routeStat{}
)

type routeStat struct {
	Method   string
	Path     string
	Hits     int64
	TotalMs  int64
	MaxMs    int64
}

const maxRoutes = 200

// RecordRoute is called from the request-counting middleware in main.go.
func RecordRoute(method, path string, latencyMs int64) {
	if path == "" {
		return
	}
	routeMu.Lock()
	defer routeMu.Unlock()

	key := method + " " + path
	r, ok := routeTotals[key]
	if !ok {
		if len(routeTotals) >= maxRoutes {
			return // bounded — drop new routes once cap reached
		}
		r = &routeStat{Method: method, Path: path}
		routeTotals[key] = r
	}
	r.Hits++
	r.TotalMs += latencyMs
	if latencyMs > r.MaxMs {
		r.MaxMs = latencyMs
	}
}

type RouteRow struct {
	Method  string  `json:"method"`
	Path    string  `json:"path"`
	Hits    int64   `json:"hits"`
	AvgMs   float64 `json:"avgMs"`
	MaxMs   int64   `json:"maxMs"`
	TotalMs int64   `json:"totalMs"`
}

// TopSlowestRoutes returns the N routes with the highest average latency,
// excluding routes hit fewer than `minHits` times so noise is filtered out.
func TopSlowestRoutes(n int, minHits int64) []RouteRow {
	routeMu.Lock()
	defer routeMu.Unlock()

	rows := make([]RouteRow, 0, len(routeTotals))
	for _, r := range routeTotals {
		if r.Hits < minHits {
			continue
		}
		rows = append(rows, RouteRow{
			Method:  r.Method,
			Path:    r.Path,
			Hits:    r.Hits,
			AvgMs:   float64(r.TotalMs) / float64(r.Hits),
			MaxMs:   r.MaxMs,
			TotalMs: r.TotalMs,
		})
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].AvgMs > rows[j].AvgMs })
	if len(rows) > n {
		rows = rows[:n]
	}
	return rows
}
