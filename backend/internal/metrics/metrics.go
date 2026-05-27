// Package metrics collects lightweight in-process counters that the
// /admin/infra endpoint exposes. Everything is lock-free via sync/atomic
// so there is zero overhead on the hot path.
package metrics

import (
	"sync/atomic"
	"time"
)

var startedAt = time.Now()

// request counters
var (
	total2xx atomic.Int64
	total4xx atomic.Int64
	total5xx atomic.Int64
)

// ws connection gauge
var wsConns atomic.Int64

func Inc2xx() { total2xx.Add(1) }
func Inc4xx() { total4xx.Add(1) }
func Inc5xx() { total5xx.Add(1) }

func IncWS() { wsConns.Add(1) }
func DecWS() { wsConns.Add(-1) }

type Snapshot struct {
	Req2xx  int64
	Req4xx  int64
	Req5xx  int64
	WSConns int64
	UptimeS int64
}

func Take() Snapshot {
	return Snapshot{
		Req2xx:  total2xx.Load(),
		Req4xx:  total4xx.Load(),
		Req5xx:  total5xx.Load(),
		WSConns: wsConns.Load(),
		UptimeS: int64(time.Since(startedAt).Seconds()),
	}
}
