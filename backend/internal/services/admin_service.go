package services

import (
	"context"
	"fmt"
	"time"

	"chat-app/internal/models"
	"chat-app/internal/repositories"
)

// MonthlyEmailLimit is how many sends our Resend tier supports per
// calendar month. Surfaced to the admin UI as the headroom number.
const MonthlyEmailLimit = 3000

func AdminStats(ctx context.Context) (models.AdminStats, *ServiceError) {
	stats, err := repositories.FetchAdminStats(ctx)
	if err != nil {
		return models.AdminStats{}, NewError(500, "db_failed", "failed to fetch stats")
	}
	return stats, nil
}

func AdminAuditLog(ctx context.Context) []models.AuditLog {
	logs, err := repositories.ListAuditLog(ctx)
	if err != nil {
		return []models.AuditLog{}
	}
	return logs
}

func AdminListUsers(ctx context.Context, search, role, adminOnly string) ([]models.AdminUserView, *ServiceError) {
	users, err := repositories.AdminListUsers(ctx, search, role, adminOnly)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch users")
	}
	return users, nil
}

func AdminGetUser(ctx context.Context, id string) (*models.AdminUserView, *ServiceError) {
	u, err := repositories.AdminGetUser(ctx, id)
	if err != nil {
		return nil, NewError(404, "not_found", "user not found")
	}
	return u, nil
}

func AdminUpdateUser(ctx context.Context, adminID, id string, patch repositories.AdminUserPatch) *ServiceError {
	rows, err := repositories.AdminUpdateUser(ctx, id, patch)
	if err != nil {
		return NewError(500, "db_failed", "failed to update user")
	}
	if rows == 0 && (patch.Role != nil || patch.VerificationStatus != nil || patch.IsVerified != nil || patch.IsAdmin != nil) {
		return NewError(404, "not_found", "user not found")
	}
	if rows == 0 {
		return NewError(400, "no_fields", "no fields to update")
	}

	targetName := repositories.GetUserFullName(ctx, id)
	repositories.WriteAuditLog(ctx, adminID, "update_user", id, targetName, fmt.Sprintf("%v", patch))
	return nil
}

func AdminBanUser(ctx context.Context, adminID, id string, durationHours int, message string) *ServiceError {
	var bannedUntil *time.Time
	if durationHours > 0 {
		t := time.Now().UTC().Add(time.Duration(durationHours) * time.Hour)
		bannedUntil = &t
	}

	rows, err := repositories.AdminBanUser(ctx, id, bannedUntil, message)
	if err != nil {
		return NewError(500, "db_failed", "failed to ban user")
	}
	if rows == 0 {
		return NewError(404, "not_found", "user not found")
	}

	targetName := repositories.GetUserFullName(ctx, id)
	dur := "permanent"
	if durationHours > 0 {
		dur = fmt.Sprintf("%dh", durationHours)
	}
	repositories.WriteAuditLog(ctx, adminID, "ban_user", id, targetName, fmt.Sprintf("duration=%s msg=%q", dur, message))
	return nil
}

func AdminUnbanUser(ctx context.Context, adminID, id string) *ServiceError {
	rows, err := repositories.AdminUnbanUser(ctx, id)
	if err != nil {
		return NewError(500, "db_failed", "failed to unban user")
	}
	if rows == 0 {
		return NewError(404, "not_found", "user not found")
	}
	targetName := repositories.GetUserFullName(ctx, id)
	repositories.WriteAuditLog(ctx, adminID, "unban_user", id, targetName, "ban lifted")
	return nil
}

func AdminDeleteUser(ctx context.Context, adminID, id string) *ServiceError {
	targetName := repositories.GetUserFullName(ctx, id)
	rows, err := repositories.AdminDeleteUser(ctx, id)
	if err != nil {
		return NewError(500, "db_failed", "failed to delete user")
	}
	if rows == 0 {
		return NewError(404, "not_found", "user not found")
	}
	repositories.WriteAuditLog(ctx, adminID, "delete_user", id, targetName, "user deleted")
	return nil
}

func AdminGetSettings(ctx context.Context) (map[string]string, *ServiceError) {
	settings, err := repositories.GetSettings(ctx)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch settings")
	}
	return settings, nil
}

func AdminUpdateSettings(ctx context.Context, adminID string, body map[string]string) {
	for k, v := range body {
		repositories.UpsertSetting(ctx, k, v)
	}
	repositories.WriteAuditLog(ctx, adminID, "update_settings", "", "", fmt.Sprintf("%v", body))
}

// AdminEmailStatsResult is the shape the panel expects (calculated
// remaining included so the UI doesn't repeat the math).
type AdminEmailStatsResult struct {
	ThisMonth    int            `json:"thisMonth"`
	LastMonth    int            `json:"lastMonth"`
	Total        int            `json:"total"`
	MonthlyLimit int            `json:"monthlyLimit"`
	Remaining    int            `json:"remaining"`
	Breakdown    map[string]int `json:"breakdown"`
}

func AdminEmailStats(ctx context.Context) AdminEmailStatsResult {
	s := repositories.FetchEmailStats(ctx)
	return AdminEmailStatsResult{
		ThisMonth:    s.ThisMonth,
		LastMonth:    s.LastMonth,
		Total:        s.Total,
		MonthlyLimit: MonthlyEmailLimit,
		Remaining:    MonthlyEmailLimit - s.ThisMonth,
		Breakdown:    s.Breakdown,
	}
}
