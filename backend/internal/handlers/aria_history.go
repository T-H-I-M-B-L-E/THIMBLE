package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"chat-app/internal/db"
)

// ariaMessage is one persisted ARIA chat message for the current admin.
type ariaMessage struct {
	Role       string `json:"role"`        // "user" | "ai"
	Content    string `json:"content"`
	ActionJSON string `json:"actionJson"`  // serialized action payload, if any
	CreatedAt  string `json:"createdAt"`
}

// AdminARIAHistory returns the current admin's recent ARIA messages (oldest
// first), capped so a long history doesn't bloat the page load.
func AdminARIAHistory(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)
	if adminID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "no admin identity"})
	}
	rows, err := db.Pool.Query(c.Context(), `
		SELECT role, content, action_json, created_at
		FROM aria_messages
		WHERE admin_id = $1
		ORDER BY created_at DESC
		LIMIT 100
	`, adminID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load history"})
	}
	defer rows.Close()

	var out []ariaMessage
	for rows.Next() {
		var m ariaMessage
		var ts time.Time
		if err := rows.Scan(&m.Role, &m.Content, &m.ActionJSON, &ts); err == nil {
			m.CreatedAt = ts.Format(time.RFC3339)
			out = append(out, m)
		}
	}
	// Reverse to oldest-first for natural chat order.
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	if out == nil {
		out = []ariaMessage{}
	}
	return c.JSON(fiber.Map{"messages": out})
}

// AdminARIASaveMessage appends a single message to the admin's ARIA history.
func AdminARIASaveMessage(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)
	if adminID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "no admin identity"})
	}
	var body struct {
		Role       string `json:"role"`
		Content    string `json:"content"`
		ActionJSON string `json:"actionJson"`
	}
	if err := c.BodyParser(&body); err != nil || (body.Role != "user" && body.Role != "ai") {
		return c.Status(400).JSON(fiber.Map{"error": "role (user|ai) is required"})
	}
	if _, err := db.Pool.Exec(c.Context(),
		`INSERT INTO aria_messages (admin_id, role, content, action_json) VALUES ($1, $2, $3, $4)`,
		adminID, body.Role, body.Content, body.ActionJSON); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to save"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// AdminARIAClearHistory deletes the current admin's ARIA history.
func AdminARIAClearHistory(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)
	if adminID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "no admin identity"})
	}
	if _, err := db.Pool.Exec(c.Context(), `DELETE FROM aria_messages WHERE admin_id = $1`, adminID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to clear"})
	}
	return c.JSON(fiber.Map{"ok": true})
}
