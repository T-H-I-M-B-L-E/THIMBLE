package middleware

import (
	"context"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"chat-app/internal/db"
)

// One-time WebSocket tickets — avoids exposing long-lived JWT in URL query
// params. Tickets live in process memory and expire after ~60s.

type wsTicket struct {
	UserID    string
	ExpiresAt time.Time
}

var (
	wsTickets   = make(map[string]wsTicket)
	wsTicketsMu sync.Mutex
)

// IssueWSTicket is the HTTP handler behind POST /api/ws-ticket. It mints a
// short-lived ticket that the client immediately trades for a WS upgrade.
func IssueWSTicket(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	ticket := uuid.New().String()
	wsTicketsMu.Lock()
	wsTickets[ticket] = wsTicket{UserID: userId, ExpiresAt: time.Now().Add(5 * time.Minute)}
	wsTicketsMu.Unlock()
	return c.JSON(fiber.Map{"ticket": ticket})
}

// SweepExpiredTickets is a long-running goroutine that drops expired
// tickets every 5 minutes. Started once from main via `go SweepExpiredTickets()`.
func SweepExpiredTickets() {
	for range time.Tick(5 * time.Minute) {
		now := time.Now()
		wsTicketsMu.Lock()
		for k, t := range wsTickets {
			if now.After(t.ExpiresAt) {
				delete(wsTickets, k)
			}
		}
		wsTicketsMu.Unlock()
	}
}

// RequireWSAuth accepts a one-time ticket (preferred) or a JWT token
// (legacy fallback). Used as the gate before the WS upgrade.
func RequireWSAuth(c *fiber.Ctx) error {
	if ticket := c.Query("ticket"); ticket != "" {
		wsTicketsMu.Lock()
		t, ok := wsTickets[ticket]
		if ok {
			delete(wsTickets, ticket)
		}
		wsTicketsMu.Unlock()
		if !ok || time.Now().After(t.ExpiresAt) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		c.Locals("userId", t.UserID)
		return c.Next()
	}
	token := c.Query("token")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	claims, err := ValidateJWT(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	c.Locals("userId", claims.UserID)
	return c.Next()
}

// RequireWSAdminAuth is the admin equivalent of RequireWSAuth — JWT only,
// plus an is_admin DB lookup.
func RequireWSAdminAuth(c *fiber.Ctx) error {
	token := c.Query("token")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	claims, err := ValidateJWT(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	var isAdmin bool
	db.Pool.QueryRow(context.Background(), "SELECT is_admin FROM users WHERE id = $1", claims.UserID).Scan(&isAdmin)
	if !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}
	c.Locals("userId", claims.UserID)
	return c.Next()
}
