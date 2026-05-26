package services

import (
	"context"

	"chat-app/internal/repositories"
)

// BlockUser is the "full mute + invisible" path. The block is one-way at
// creation time but reads check both directions (see IsBlockedBetween),
// so once A blocks B, neither side sees the other anywhere.
//
// Side-effect: unfollow in both directions so social state matches the
// muted reality.
func BlockUser(ctx context.Context, blockerID, blockedID string) *ServiceError {
	if blockerID == "" || blockedID == "" || blockerID == blockedID {
		return NewError(400, "invalid_block", "cannot block this user")
	}
	if err := repositories.CreateBlock(ctx, blockerID, blockedID); err != nil {
		return NewError(500, "db_failed", "failed to block user")
	}
	// Drop existing follow edges in both directions. Errors are non-fatal
	// — the block itself succeeded.
	repositories.Unfollow(ctx, blockerID, blockedID)
	repositories.Unfollow(ctx, blockedID, blockerID)
	return nil
}

func UnblockUser(ctx context.Context, blockerID, blockedID string) *ServiceError {
	if err := repositories.RemoveBlock(ctx, blockerID, blockedID); err != nil {
		return NewError(500, "db_failed", "failed to unblock user")
	}
	return nil
}

func ListBlocked(ctx context.Context, blockerID string) []repositories.BlockedUser {
	users, err := repositories.ListBlockedUsers(ctx, blockerID)
	if err != nil {
		return []repositories.BlockedUser{}
	}
	return users
}
