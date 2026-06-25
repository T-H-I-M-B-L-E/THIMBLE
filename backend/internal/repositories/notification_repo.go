package repositories

import (
	"context"

	"chat-app/internal/db"
	"chat-app/internal/models"
	"chat-app/internal/utils"
)

// ListNotifications joins to users to embed the sender record on each row.
// senderEmail is consumed locally to derive a username and is not returned.
func ListNotifications(ctx context.Context, userID string) ([]models.Notification, error) {
	rows, err := db.Pool.Query(ctx, `
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
		return nil, err
	}
	defer rows.Close()

	var notifications []models.Notification
	for rows.Next() {
		var n models.Notification
		var senderID, senderEmail string
		var postID *int64
		err := rows.Scan(
			&n.ID, &n.Type, &n.UserID, &senderID, &postID, &n.Read, &n.CreatedAt,
			&n.Sender.FullName, &n.Sender.Avatar, &senderEmail,
		)
		if err != nil {
			continue
		}
		n.Sender.ID = senderID
		n.Sender.Username = utils.ExtractUsername(senderEmail)
		n.PostID = postID
		notifications = append(notifications, n)
	}
	return notifications, nil
}

func MarkNotificationRead(ctx context.Context, notificationID, userID string) error {
	_, err := db.Pool.Exec(ctx, `UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2`, notificationID, userID)
	return err
}
