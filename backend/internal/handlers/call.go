package handlers

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/livekit/protocol/auth"

	"chat-app/internal/config"
	"chat-app/internal/repositories"
	"chat-app/internal/services"
)

// CreateCall issues a LiveKit token for the caller and broadcasts a
// call-invite over the existing WS room so the callee gets a banner.
//
// POST /api/conversations/:id/call
// Body: { "kind": "video" | "audio" }
func CreateCall(c *fiber.Ctx) error {
	callerID, ok := c.Locals("userId").(string)
	if !ok || callerID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	cfg := config.Get()
	if cfg.LiveKitAPIKey == "" || cfg.LiveKitAPISecret == "" {
		return c.Status(503).JSON(fiber.Map{"error": "calling not configured"})
	}

	var body struct {
		Kind string `json:"kind"`
	}
	if err := c.BodyParser(&body); err != nil || (body.Kind != "video" && body.Kind != "audio") {
		body.Kind = "video"
	}

	var convID int
	fmt.Sscanf(c.Params("id"), "%d", &convID)
	if convID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "invalid conversation id"})
	}

	participantIDs, err := repositories.GetConversationParticipantIDs(c.Context(), convID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "db_failed"})
	}
	isMember := false
	for _, p := range participantIDs {
		if p == callerID {
			isMember = true
			break
		}
	}
	if !isMember {
		return c.Status(403).JSON(fiber.Map{"error": "not a participant"})
	}

	roomName := fmt.Sprintf("conv-%d-%d", convID, time.Now().UnixMilli())

	callerToken, err := makeLiveKitToken(cfg, roomName, callerID, true)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "token_failed"})
	}

	callerName, _ := repositories.GetUserNameByID(c.Context(), callerID)
	services.BroadcastCallInvite(convID, callerID, callerName, roomName, body.Kind)

	return c.JSON(fiber.Map{
		"room":  roomName,
		"token": callerToken,
		"lkUrl": cfg.LiveKitURL,
		"kind":  body.Kind,
	})
}

// JoinCall issues a LiveKit token for the callee joining an existing room.
//
// POST /api/conversations/:id/call/join
// Body: { "room": "<roomName>" }
func JoinCall(c *fiber.Ctx) error {
	userID, ok := c.Locals("userId").(string)
	if !ok || userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	cfg := config.Get()
	if cfg.LiveKitAPIKey == "" || cfg.LiveKitAPISecret == "" {
		return c.Status(503).JSON(fiber.Map{"error": "calling not configured"})
	}

	var convID int
	fmt.Sscanf(c.Params("id"), "%d", &convID)
	if convID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "invalid conversation id"})
	}

	participantIDs, err := repositories.GetConversationParticipantIDs(c.Context(), convID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "db_failed"})
	}
	isMember := false
	for _, p := range participantIDs {
		if p == userID {
			isMember = true
			break
		}
	}
	if !isMember {
		return c.Status(403).JSON(fiber.Map{"error": "not a participant"})
	}

	var body struct {
		Room string `json:"room"`
	}
	if err := c.BodyParser(&body); err != nil || body.Room == "" {
		return c.Status(400).JSON(fiber.Map{"error": "room required"})
	}

	token, err := makeLiveKitToken(cfg, body.Room, userID, true)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "token_failed"})
	}

	return c.JSON(fiber.Map{
		"token": token,
		"lkUrl": cfg.LiveKitURL,
	})
}

// EndCall broadcasts a call-end event so both sides close the call UI,
// then writes a system message into the conversation thread.
//
// DELETE /api/conversations/:id/call
// Body: { "room": "<roomName>", "durationSecs": 42, "missed": false }
func EndCall(c *fiber.Ctx) error {
	userID, ok := c.Locals("userId").(string)
	if !ok || userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	var body struct {
		Room         string `json:"room"`
		DurationSecs *int   `json:"durationSecs"`
		Missed       bool   `json:"missed"`
	}
	if err := c.BodyParser(&body); err != nil || body.Room == "" {
		return c.Status(400).JSON(fiber.Map{"error": "room required"})
	}

	var convID int
	fmt.Sscanf(c.Params("id"), "%d", &convID)

	services.BroadcastCallEnd(convID, userID, body.Room, body.DurationSecs)

	// Persist a system message so both parties see the call event in chat.
	var content string
	if body.Missed {
		content = "📵 Missed call"
	} else if body.DurationSecs != nil && *body.DurationSecs > 0 {
		mins := *body.DurationSecs / 60
		secs := *body.DurationSecs % 60
		if mins > 0 {
			content = fmt.Sprintf("📞 Call ended · %dm %ds", mins, secs)
		} else {
			content = fmt.Sprintf("📞 Call ended · %ds", secs)
		}
	} else {
		content = "📞 Call ended"
	}
	go repositories.InsertSystemCallMessage(c.Context(), convID, content, body.DurationSecs)

	return c.SendStatus(204)
}

func makeLiveKitToken(cfg config.Config, room, userID string, canPublish bool) (string, error) {
	at := auth.NewAccessToken(cfg.LiveKitAPIKey, cfg.LiveKitAPISecret)
	pub := canPublish
	grant := &auth.VideoGrant{
		RoomJoin:   true,
		Room:       room,
		CanPublish: &pub,
	}
	at.SetVideoGrant(grant).
		SetIdentity(userID).
		SetValidFor(2 * time.Hour)
	return at.ToJWT()
}
