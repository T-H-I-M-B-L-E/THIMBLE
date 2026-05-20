package main

import (
	"sync"
	"time"

	"github.com/gofiber/websocket/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	clients   = make(map[*websocket.Conn]string)        // legacy global broadcast
	rooms     = make(map[int]map[*websocket.Conn]string) // conversationId → conn → userId
	clientsMu sync.RWMutex

	dbPool    *pgxpool.Pool
	jwtSecret string
	resendKey string

	// One-time WebSocket tickets — avoids exposing long-lived JWT in URL query params
	wsTickets   = make(map[string]wsTicket)
	wsTicketsMu sync.Mutex
)

type wsTicket struct {
	UserID    string
	ExpiresAt time.Time
}
