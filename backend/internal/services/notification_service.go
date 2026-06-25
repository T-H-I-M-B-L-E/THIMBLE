package services

import (
	"context"

	"chat-app/internal/models"
	"chat-app/internal/repositories"
)

func ListNotifications(ctx context.Context, userID string) ([]models.Notification, *ServiceError) {
	if userID == "" {
		return nil, NewError(400, "missing_userid", "userId query parameter required")
	}
	notifications, err := repositories.ListNotifications(ctx, userID)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch notifications")
	}
	return notifications, nil
}

func MarkNotificationRead(ctx context.Context, notificationID, userID string) *ServiceError {
	if err := repositories.MarkNotificationRead(ctx, notificationID, userID); err != nil {
		return NewError(500, "db_failed", "failed to mark notification as read")
	}
	return nil
}
