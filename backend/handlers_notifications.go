package main

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
)

type NotificationSender struct {
	ID       string `json:"id"`
	FullName string `json:"fullName"`
	Avatar   string `json:"avatar"`
	Username string `json:"username"`
}

type Notification struct {
	ID        int64                 `json:"id"`
	Type      string                `json:"type"`
	Sender    NotificationSender    `json:"sender"`
	PostID    *int64                `json:"postId"`
	UserID    *string               `json:"userId"`
	CreatedAt string                `json:"createdAt"`
	Read      bool                  `json:"read"`
}

// GET /api/notifications
func handleListNotifications(c *fiber.Ctx) error {
	userID := c.Query("userId")
	if userID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "userId query parameter required"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := dbPool.Query(ctx, `
		SELECT
			n.id,
			n.type,
			n.user_id,
			n.sender_id,
			n.post_id,
			n.read,
			n.created_at,
			u.full_name,
			u.avatar_url,
			u.email
		FROM notifications n
		INNER JOIN users u ON n.sender_id = u.id
		WHERE n.user_id = $1
		ORDER BY n.created_at DESC
		LIMIT 50
	`, userID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch notifications"})
	}
	defer rows.Close()

	var notifications []Notification

	for rows.Next() {
		var n Notification
		var senderID, senderEmail string
		var postID *int64

		err := rows.Scan(
			&n.ID,
			&n.Type,
			&n.UserID,
			&senderID,
			&postID,
			&n.Read,
			&n.CreatedAt,
			&n.Sender.FullName,
			&n.Sender.Avatar,
			&senderEmail,
		)
		if err != nil {
			continue
		}

		n.Sender.ID = senderID
		n.Sender.Username = extractUsername(senderEmail)
		n.PostID = postID

		notifications = append(notifications, n)
	}

	return c.JSON(notifications)
}

// PATCH /api/notifications/:id/read
func handleMarkNotificationAsRead(c *fiber.Ctx) error {
	notificationID := c.Params("id")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := dbPool.Exec(ctx, `
		UPDATE notifications
		SET read = TRUE
		WHERE id = $1
	`, notificationID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to mark notification as read"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// Helper to extract username from email
func extractUsername(email string) string {
	for i, ch := range email {
		if ch == '@' {
			return email[:i]
		}
	}
	return email
}
