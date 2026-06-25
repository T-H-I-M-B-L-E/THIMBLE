package services

import (
	"context"
	"testing"
)

// ── Follow validation ─────────────────────────────────────────────────────────

func TestFollow_SelfFollow(t *testing.T) {
	err := Follow(context.TODO(), "user-1", "user-1")
	requireCode(t, err, 400, "self_follow")
}

func TestFollow_EmptyFollowingID(t *testing.T) {
	err := Follow(context.TODO(), "user-1", "")
	requireCode(t, err, 400, "missing_field")
}

// ── Unfollow validation ───────────────────────────────────────────────────────

func TestUnfollow_EmptyFollowingID(t *testing.T) {
	err := Unfollow(context.TODO(), "user-1", "")
	requireCode(t, err, 400, "missing_field")
}
