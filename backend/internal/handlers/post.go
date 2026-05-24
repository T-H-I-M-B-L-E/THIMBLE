package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"chat-app/internal/middleware"
	"chat-app/internal/models"
	"chat-app/internal/services"
)

// ListPosts is reachable unauthenticated. If the caller has a token we
// use their id to populate liked-by-me; otherwise the field is false.
func ListPosts(c *fiber.Ctx) error {
	callerID := optionalCallerID(c)
	posts, err := services.ListPosts(c.Context(), callerID, c.Query("before"), c.Query("userId"))
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(posts)
}

func GetPost(c *fiber.Ctx) error {
	callerID := optionalCallerID(c)
	post, err := services.GetPost(c.Context(), callerID, c.Params("id"))
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(post)
}

func TrendingTags(c *fiber.Ctx) error {
	tags, err := services.TrendingTags(c.Context())
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(tags)
}

func CreatePost(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	var p models.Post
	if err := c.BodyParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := services.CreatePost(c.Context(), userId, &p); err != nil {
		return respondError(c, err)
	}
	return c.Status(201).JSON(p)
}

func DeletePost(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	if err := services.DeletePost(c.Context(), userId, c.Params("id")); err != nil {
		return respondError(c, err)
	}
	return c.SendStatus(204)
}

func GetPostLikes(c *fiber.Ctx) error {
	likers, err := services.ListPostLikers(c.Context(), c.Params("id"))
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(likers)
}

func LikePost(c *fiber.Ctx) error    { return togglePostLike(c, true) }
func UnlikePost(c *fiber.Ctx) error  { return togglePostLike(c, false) }

func togglePostLike(c *fiber.Ctx, liked bool) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	count, err := services.SetPostLike(c.Context(), userId, c.Params("id"), liked)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(fiber.Map{"likes": count})
}

func GetPostComments(c *fiber.Ctx) error {
	comments, err := services.ListPostComments(c.Context(), c.Params("id"))
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(comments)
}

func CreatePostComment(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	var body struct {
		Content string `json:"content"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "content is required"})
	}
	cm, err := services.CreatePostComment(c.Context(), userId, c.Params("id"), body.Content)
	if err != nil {
		return respondError(c, err)
	}
	return c.Status(201).JSON(cm)
}

func SavePost(ctx *fiber.Ctx) error   { return togglePostSave(ctx, true) }
func UnsavePost(ctx *fiber.Ctx) error { return togglePostSave(ctx, false) }

func togglePostSave(c *fiber.Ctx, save bool) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	if err := services.SetPostSave(c.Context(), userId, c.Params("id"), save); err != nil {
		return respondError(c, err)
	}
	return c.JSON(fiber.Map{"saved": save})
}

func GetSavedPosts(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	posts, err := services.ListSavedPosts(c.Context(), userId)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(posts)
}

// optionalCallerID returns the user id if the request carries a valid
// token (header or cookie), otherwise empty string. Used by routes that
// are public but personalise on auth.
func optionalCallerID(c *fiber.Ctx) string {
	authHeader := c.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		if claims, err := middleware.ValidateJWT(strings.TrimPrefix(authHeader, "Bearer ")); err == nil {
			return claims.UserID
		}
	}
	if tok := c.Cookies("auth_token"); tok != "" {
		if claims, err := middleware.ValidateJWT(tok); err == nil {
			return claims.UserID
		}
	}
	return ""
}
