package handlers

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"

	"chat-app/internal/models"
	"chat-app/internal/services"
)

func ListConversations(c *fiber.Ctx) error {
	userId := c.Query("userId")
	if userId == "" {
		userId, _ = c.Locals("userId").(string)
	}
	return c.JSON(services.ListConversations(c.Context(), userId))
}

func CreateConversation(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	var req struct {
		Participants []models.ConversationParticipant `json:"participants"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	convId, err := services.CreateConversation(c.Context(), userId, req.Participants)
	if err != nil {
		return respondError(c, err)
	}
	return c.Status(201).JSON(fiber.Map{"id": convId})
}

func GetConversationMessages(c *fiber.Ctx) error {
	userId, _ := c.Locals("userId").(string)
	return c.JSON(services.GetConversationMessages(c.Context(), c.Params("id"), userId))
}

func DeleteConversationMessage(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	if err := services.DeleteMessageForUser(c.Context(), c.Params("msgId"), userId); err != nil {
		return respondError(c, err)
	}
	return c.SendStatus(204)
}

func RestoreConversationMessage(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	if err := services.RestoreMessageForUser(c.Context(), c.Params("msgId"), userId); err != nil {
		return respondError(c, err)
	}
	return c.SendStatus(204)
}

// ConversationWS is the per-conversation WebSocket entrypoint. The
// upgrade is already gated by middleware.RequireWSAuth, which stamped
// c.Locals("userId"). conversationId comes from the query string.
func ConversationWS(c *websocket.Conn) {
	userId, _ := c.Locals("userId").(string)
	var convId int
	fmt.Sscanf(c.Query("conversationId"), "%d", &convId)
	services.HandleConversationWS(c, userId, convId)
}

func AdminChatHistory(c *fiber.Ctx) error {
	return c.JSON(services.ListAdminChatHistory(c.Context()))
}

func AdminWS(c *websocket.Conn) {
	userId, _ := c.Locals("userId").(string)
	services.HandleAdminWS(c, userId)
}
