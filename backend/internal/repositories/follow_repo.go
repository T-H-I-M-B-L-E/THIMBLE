package repositories

import (
	"context"
	"log"

	"chat-app/internal/db"
)

func IsFollowing(ctx context.Context, followerID, followingID string) bool {
	var exists bool
	db.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2)`,
		followerID, followingID).Scan(&exists)
	return exists
}

type FollowingUser struct {
	UserID     string `json:"userId"`
	UserName   string `json:"userName"`
	UserAvatar string `json:"userAvatar"`
	Role       string `json:"role"`
}

func ListFollowing(ctx context.Context, followerID string) ([]FollowingUser, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT u.id, u.full_name, COALESCE(u.avatar_url,''), COALESCE(u.role,'')
		 FROM follows f JOIN users u ON u.id = f.following_id
		 WHERE f.follower_id = $1 ORDER BY f.created_at DESC`, followerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []FollowingUser
	for rows.Next() {
		var fu FollowingUser
		if err := rows.Scan(&fu.UserID, &fu.UserName, &fu.UserAvatar, &fu.Role); err != nil {
			return nil, err
		}
		list = append(list, fu)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []FollowingUser{}
	}
	return list, nil
}

// Follow inserts the follows row. The boolean indicates whether a new
// row was created (false means follower was already following).
func Follow(ctx context.Context, followerID, followingID string) (bool, error) {
	tag, err := db.Pool.Exec(ctx,
		`INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		followerID, followingID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// Unfollow deletes the row. The boolean is true if a row was actually removed.
func Unfollow(ctx context.Context, followerID, followingID string) bool {
	tag, err := db.Pool.Exec(ctx,
		`DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
		followerID, followingID)
	if err != nil {
		log.Printf("unfollow failed (follower=%s following=%s): %v", followerID, followingID, err)
		return false
	}
	return tag.RowsAffected() > 0
}

// RefreshFollowCounts recomputes the denormalised followers/following
// columns on both sides of an edge.
func RefreshFollowCounts(ctx context.Context, followerID, followingID string) {
	if _, err := db.Pool.Exec(ctx, `UPDATE users SET following = (SELECT COUNT(*) FROM follows WHERE follower_id = $1) WHERE id = $1`, followerID); err != nil {
		log.Printf("refresh following count failed (user=%s): %v", followerID, err)
	}
	if _, err := db.Pool.Exec(ctx, `UPDATE users SET followers = (SELECT COUNT(*) FROM follows WHERE following_id = $1) WHERE id = $1`, followingID); err != nil {
		log.Printf("refresh followers count failed (user=%s): %v", followingID, err)
	}
}
