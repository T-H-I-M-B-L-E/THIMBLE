package handlers

import (
	"github.com/gofiber/fiber/v2"

	"chat-app/internal/services"
)

// GetFollows is overloaded: a (followerId, followingId) pair queries a
// single edge; (followerId, type=following) lists who that user follows.
// Following lists are public — any authenticated user can view them.
func GetFollows(c *fiber.Ctx) error {
	callerID, _ := c.Locals("userId").(string)
	followerID := c.Query("followerId")
	followingID := c.Query("followingId")
	listType := c.Query("type")

	if followerID != "" && followingID != "" {
		return c.JSON(fiber.Map{"isFollowing": services.IsFollowing(c.Context(), followerID, followingID)})
	}

	if listType == "following" && followerID != "" {
		if callerID == "" {
			return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
		}
		list, err := services.ListFollowing(c.Context(), followerID)
		if err != nil {
			return respondError(c, err)
		}
		return c.JSON(list)
	}

	return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
}

func Follow(c *fiber.Ctx) error {
	followerID, ok := c.Locals("userId").(string)
	if !ok || followerID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	var body struct {
		FollowingID string `json:"followingId"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "followingId is required"})
	}
	if err := services.Follow(c.Context(), followerID, body.FollowingID); err != nil {
		return respondError(c, err)
	}
	return c.JSON(fiber.Map{"success": true})
}

func Unfollow(c *fiber.Ctx) error {
	followerID, ok := c.Locals("userId").(string)
	if !ok || followerID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	var body struct {
		FollowingID string `json:"followingId"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "followingId is required"})
	}
	if err := services.Unfollow(c.Context(), followerID, body.FollowingID); err != nil {
		return respondError(c, err)
	}
	return c.JSON(fiber.Map{"success": true})
}
