package services

import (
	"context"
	"testing"
)

// ── BlockUser validation ──────────────────────────────────────────────────────

func TestBlockUser_SelfBlock(t *testing.T) {
	err := BlockUser(context.TODO(), "user-1", "user-1")
	requireCode(t, err, 400, "invalid_block")
}

func TestBlockUser_EmptyBlockerID(t *testing.T) {
	err := BlockUser(context.TODO(), "", "user-2")
	requireCode(t, err, 400, "invalid_block")
}

func TestBlockUser_EmptyBlockedID(t *testing.T) {
	err := BlockUser(context.TODO(), "user-1", "")
	requireCode(t, err, 400, "invalid_block")
}

func TestBlockUser_BothEmpty(t *testing.T) {
	err := BlockUser(context.TODO(), "", "")
	requireCode(t, err, 400, "invalid_block")
}
