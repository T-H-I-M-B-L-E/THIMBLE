package metrics

import (
	"sync"
	"time"
)

const ringSize = 50

// ErrorEntry records a single 5xx response.
type ErrorEntry struct {
	Time      time.Time `json:"time"`
	Method    string    `json:"method"`
	Path      string    `json:"path"`
	Status    int       `json:"status"`
	LatencyMs int64     `json:"latencyMs"`
}

// SlowEntry records a request that exceeded the slow threshold.
type SlowEntry struct {
	Time      time.Time `json:"time"`
	Method    string    `json:"method"`
	Path      string    `json:"path"`
	Status    int       `json:"status"`
	LatencyMs int64     `json:"latencyMs"`
}

type ringBuf[T any] struct {
	mu   sync.Mutex
	buf  [ringSize]T
	head int
	n    int
}

func (r *ringBuf[T]) push(v T) {
	r.mu.Lock()
	r.buf[r.head%ringSize] = v
	r.head++
	if r.n < ringSize {
		r.n++
	}
	r.mu.Unlock()
}

func (r *ringBuf[T]) snapshot() []T {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]T, r.n)
	for i := 0; i < r.n; i++ {
		idx := (r.head - r.n + i + ringSize*2) % ringSize
		out[i] = r.buf[idx]
	}
	// reverse so newest is first
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out
}

var errors ringBuf[ErrorEntry]
var slows ringBuf[SlowEntry]

const SlowThresholdMs = 500

func PushError(e ErrorEntry)  { errors.push(e) }
func PushSlow(s SlowEntry)    { slows.push(s) }
func RecentErrors() []ErrorEntry { return errors.snapshot() }
func RecentSlows() []SlowEntry   { return slows.snapshot() }
