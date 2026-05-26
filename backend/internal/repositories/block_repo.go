package repositories

import (
	"context"

	"chat-app/internal/db"
)

// CreateBlock inserts a block row. ON CONFLICT DO NOTHING keeps the
// operation idempotent — calling block twice is fine.
func CreateBlock(ctx context.Context, blockerID, blockedID string) error {
	_, err := db.Pool.Exec(ctx,
		`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)
		 ON CONFLICT DO NOTHING`,
		blockerID, blockedID)
	return err
}

// RemoveBlock clears the row. No-op if no block exists.
func RemoveBlock(ctx context.Context, blockerID, blockedID string) error {
	_, err := db.Pool.Exec(ctx,
		`DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
		blockerID, blockedID)
	return err
}

// IsBlockedBetween returns true if EITHER direction of a block exists
// between the two users. Use this on read paths so blocked content
// disappears whether you blocked them or they blocked you.
func IsBlockedBetween(ctx context.Context, a, b string) (bool, error) {
	if a == "" || b == "" || a == b {
		return false, nil
	}
	var exists bool
	err := db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
		  SELECT 1 FROM blocks
		   WHERE (blocker_id = $1 AND blocked_id = $2)
		      OR (blocker_id = $2 AND blocked_id = $1)
		)`, a, b).Scan(&exists)
	return exists, err
}

// ListBlocked returns the userIds that `blockerID` has blocked. Used in
// batch contexts where only IDs are needed (e.g. client-side filtering
// of cached feeds). For the settings UI, use ListBlockedUsers.
func ListBlocked(ctx context.Context, blockerID string) ([]string, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT blocked_id FROM blocks WHERE blocker_id = $1 ORDER BY created_at DESC`,
		blockerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		rows.Scan(&id)
		ids = append(ids, id)
	}
	return ids, nil
}

// BlockedUser is the enriched row shape returned by ListBlockedUsers.
type BlockedUser struct {
	ID        string `json:"id"`
	FullName  string `json:"fullName"`
	Username  string `json:"username"`
	AvatarUrl string `json:"avatarUrl"`
}

// ListBlockedUsers returns the users that `blockerID` has blocked, with
// name + avatar joined in for direct display in the settings UI.
func ListBlockedUsers(ctx context.Context, blockerID string) ([]BlockedUser, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT u.id, u.full_name, u.username, COALESCE(u.avatar_url,'')
		 FROM blocks b
		 JOIN users u ON u.id = b.blocked_id
		 WHERE b.blocker_id = $1
		 ORDER BY b.created_at DESC`,
		blockerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := []BlockedUser{}
	for rows.Next() {
		var u BlockedUser
		rows.Scan(&u.ID, &u.FullName, &u.Username, &u.AvatarUrl)
		users = append(users, u)
	}
	return users, nil
}
