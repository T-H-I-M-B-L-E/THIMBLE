package services

import (
	"context"

	"chat-app/internal/repositories"
)

// IsFollowing answers the single-edge question (am I following X?).
func IsFollowing(ctx context.Context, followerID, followingID string) bool {
	return repositories.IsFollowing(ctx, followerID, followingID)
}

func ListFollowing(ctx context.Context, followerID string) ([]repositories.FollowingUser, *ServiceError) {
	list, err := repositories.ListFollowing(ctx, followerID)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch following")
	}
	return list, nil
}

func Follow(ctx context.Context, followerID, followingID string) *ServiceError {
	if followingID == "" {
		return NewError(400, "missing_field", "followingId is required")
	}
	if followerID == followingID {
		return NewError(400, "self_follow", "cannot follow yourself")
	}
	changed, err := repositories.Follow(ctx, followerID, followingID)
	if err != nil {
		return NewError(500, "db_failed", "failed to follow")
	}
	if changed {
		repositories.RefreshFollowCounts(ctx, followerID, followingID)
	}
	return nil
}

func Unfollow(ctx context.Context, followerID, followingID string) *ServiceError {
	if followingID == "" {
		return NewError(400, "missing_field", "followingId is required")
	}
	if repositories.Unfollow(ctx, followerID, followingID) {
		repositories.RefreshFollowCounts(ctx, followerID, followingID)
	}
	return nil
}
