package main

import (
	"context"

	"github.com/gofiber/fiber/v2"
)

func handleGetFollows(c *fiber.Ctx) error {
	followerID := c.Query("followerId")
	followingID := c.Query("followingId")
	listType := c.Query("type")

	if followerID != "" && followingID != "" {
		var exists bool
		dbPool.QueryRow(context.Background(),
			`SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2)`,
			followerID, followingID).Scan(&exists)
		return c.JSON(fiber.Map{"isFollowing": exists})
	}

	if listType == "following" && followerID != "" {
		type FollowingUser struct {
			UserID     string `json:"userId"`
			UserName   string `json:"userName"`
			UserAvatar string `json:"userAvatar"`
			Role       string `json:"role"`
		}
		rows, err := dbPool.Query(context.Background(),
			`SELECT u.id, u.full_name, COALESCE(u.avatar_url,''), COALESCE(u.role,'')
			 FROM follows f JOIN users u ON u.id = f.following_id
			 WHERE f.follower_id = $1 ORDER BY f.created_at DESC`, followerID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to fetch following"})
		}
		defer rows.Close()
		var list []FollowingUser
		for rows.Next() {
			var fu FollowingUser
			rows.Scan(&fu.UserID, &fu.UserName, &fu.UserAvatar, &fu.Role)
			list = append(list, fu)
		}
		if list == nil {
			list = []FollowingUser{}
		}
		return c.JSON(list)
	}

	return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
}

func handleFollow(c *fiber.Ctx) error {
	followerID, _ := c.Locals("userId").(string)
	var body struct {
		FollowingID string `json:"followingId"`
	}
	if err := c.BodyParser(&body); err != nil || body.FollowingID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "followingId is required"})
	}
	if followerID == body.FollowingID {
		return c.Status(400).JSON(fiber.Map{"error": "cannot follow yourself"})
	}
	ctx := context.Background()
	tag, err := dbPool.Exec(ctx,
		`INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		followerID, body.FollowingID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to follow"})
	}
	if tag.RowsAffected() > 0 {
		dbPool.Exec(ctx, `UPDATE users SET following = (SELECT COUNT(*) FROM follows WHERE follower_id = $1) WHERE id = $1`, followerID)
		dbPool.Exec(ctx, `UPDATE users SET followers = (SELECT COUNT(*) FROM follows WHERE following_id = $1) WHERE id = $1`, body.FollowingID)
	}
	return c.JSON(fiber.Map{"success": true})
}

func handleUnfollow(c *fiber.Ctx) error {
	followerID, _ := c.Locals("userId").(string)
	var body struct {
		FollowingID string `json:"followingId"`
	}
	if err := c.BodyParser(&body); err != nil || body.FollowingID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "followingId is required"})
	}
	ctx := context.Background()
	tag, _ := dbPool.Exec(ctx,
		`DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
		followerID, body.FollowingID)
	if tag.RowsAffected() > 0 {
		dbPool.Exec(ctx, `UPDATE users SET following = (SELECT COUNT(*) FROM follows WHERE follower_id = $1) WHERE id = $1`, followerID)
		dbPool.Exec(ctx, `UPDATE users SET followers = (SELECT COUNT(*) FROM follows WHERE following_id = $1) WHERE id = $1`, body.FollowingID)
	}
	return c.JSON(fiber.Map{"success": true})
}
