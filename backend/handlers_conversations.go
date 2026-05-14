package main

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
)

func handleListConversations(c *fiber.Ctx) error {
	userId := c.Query("userId")
	if userId == "" {
		userId, _ = c.Locals("userId").(string)
	}
	ctx := context.Background()
	rows, err := dbPool.Query(ctx, `
		SELECT c.id, c.updated_at
		FROM conversations c
		JOIN conversation_participants cp ON cp.conversation_id = c.id
		WHERE cp.user_id = $1
		ORDER BY c.updated_at DESC`, userId)
	if err != nil {
		return c.JSON([]Conversation{})
	}
	defer rows.Close()

	var convs []Conversation
	for rows.Next() {
		var conv Conversation
		var updatedAt time.Time
		rows.Scan(&conv.ID, &updatedAt)
		conv.UpdatedAt = updatedAt.Format(time.RFC3339)

		pRows, _ := dbPool.Query(ctx,
			"SELECT id, conversation_id, user_id, user_name, user_avatar, joined_at FROM conversation_participants WHERE conversation_id = $1", conv.ID)
		if pRows != nil {
			for pRows.Next() {
				var p ConversationParticipant
				var joinedAt time.Time
				pRows.Scan(&p.ID, &p.ConversationID, &p.UserID, &p.UserName, &p.UserAvatar, &joinedAt)
				p.JoinedAt = joinedAt.Format(time.RFC3339)
				conv.Participants = append(conv.Participants, p)
			}
			pRows.Close()
		}
		if conv.Participants == nil {
			conv.Participants = []ConversationParticipant{}
		}

		var lm ConvMessage
		err := dbPool.QueryRow(ctx,
			"SELECT id, conversation_id, user_id, name, content, timestamp FROM conversation_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 1", conv.ID).
			Scan(&lm.ID, &lm.ConversationID, &lm.UserID, &lm.Name, &lm.Content, &lm.Timestamp)
		if err == nil {
			conv.LastMessage = &lm
		}

		convs = append(convs, conv)
	}
	if convs == nil {
		convs = []Conversation{}
	}
	return c.JSON(convs)
}

func handleCreateConversation(c *fiber.Ctx) error {
	userId, _ := c.Locals("userId").(string)
	ctx := context.Background()

	var req struct {
		Participants []ConversationParticipant `json:"participants"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	var convId int
	err := dbPool.QueryRow(ctx, "INSERT INTO conversations DEFAULT VALUES RETURNING id").Scan(&convId)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create conversation"})
	}

	var creatorName, creatorAvatar string
	dbPool.QueryRow(ctx, "SELECT full_name, COALESCE(avatar_url, '') FROM users WHERE id = $1", userId).Scan(&creatorName, &creatorAvatar)
	dbPool.Exec(ctx,
		"INSERT INTO conversation_participants (conversation_id, user_id, user_name, user_avatar) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
		convId, userId, creatorName, creatorAvatar)

	seen := map[string]bool{userId: true}
	for _, p := range req.Participants {
		if seen[p.UserID] {
			continue
		}
		seen[p.UserID] = true
		dbPool.Exec(ctx,
			"INSERT INTO conversation_participants (conversation_id, user_id, user_name, user_avatar) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
			convId, p.UserID, p.UserName, p.UserAvatar)
	}

	return c.Status(201).JSON(fiber.Map{"id": convId})
}

func handleGetConversationMessages(c *fiber.Ctx) error {
	convId := c.Params("id")
	ctx := context.Background()
	rows, err := dbPool.Query(ctx,
		"SELECT id, conversation_id, user_id, name, content, timestamp FROM conversation_messages WHERE conversation_id = $1 ORDER BY timestamp ASC LIMIT 100", convId)
	if err != nil {
		return c.JSON([]ConvMessage{})
	}
	defer rows.Close()
	var msgs []ConvMessage
	for rows.Next() {
		var m ConvMessage
		rows.Scan(&m.ID, &m.ConversationID, &m.UserID, &m.Name, &m.Content, &m.Timestamp)
		msgs = append(msgs, m)
	}
	if msgs == nil {
		msgs = []ConvMessage{}
	}
	return c.JSON(msgs)
}

func handleConversationWS(c *websocket.Conn) {
	userId, _ := c.Locals("userId").(string)
	convIdStr := c.Query("conversationId")
	var convId int
	fmt.Sscanf(convIdStr, "%d", &convId)

	clientsMu.Lock()
	if convId > 0 {
		if rooms[convId] == nil {
			rooms[convId] = make(map[*websocket.Conn]string)
		}
		rooms[convId][c] = userId
	} else {
		clients[c] = userId
	}
	clientsMu.Unlock()

	defer func() {
		clientsMu.Lock()
		if convId > 0 {
			delete(rooms[convId], c)
		} else {
			delete(clients, c)
		}
		clientsMu.Unlock()
		c.Close()
	}()

	for {
		mt, msgBytes, err := c.ReadMessage()
		if err != nil {
			break
		}

		var eventMap map[string]interface{}
		if err := json.Unmarshal(msgBytes, &eventMap); err != nil {
			continue
		}

		if eventType, ok := eventMap["type"].(string); ok && eventType == "typing" {
			clientsMu.RLock()
			for conn := range rooms[convId] {
				if conn != c {
					conn.WriteMessage(mt, msgBytes)
				}
			}
			clientsMu.RUnlock()
			continue
		}

		var msg ConvMessage
		if err := json.Unmarshal(msgBytes, &msg); err != nil {
			continue
		}
		msg.UserID = userId
		if msg.ConversationID == 0 {
			msg.ConversationID = convId
		}
		if msg.Timestamp == 0 {
			msg.Timestamp = time.Now().UnixMilli()
		}

		var insertedID int
		dbPool.QueryRow(context.Background(),
			"INSERT INTO conversation_messages (conversation_id, user_id, name, content, timestamp) VALUES ($1, $2, $3, $4, $5) RETURNING id",
			msg.ConversationID, msg.UserID, msg.Name, msg.Content, msg.Timestamp).Scan(&insertedID)
		msg.ID = insertedID

		dbPool.Exec(context.Background(),
			"UPDATE conversations SET updated_at = NOW() WHERE id = $1", msg.ConversationID)

		out, _ := json.Marshal(msg)

		clientsMu.RLock()
		for conn := range rooms[convId] {
			conn.WriteMessage(mt, out)
		}
		clientsMu.RUnlock()
	}
}

// handleAdminChatHistory and handleAdminWS live here since they share the same domain.

var (
	adminRoom   = make(map[*websocket.Conn]string)
	adminRoomMu sync.RWMutex
)

func handleAdminChatHistory(c *fiber.Ctx) error {
	rows, err := dbPool.Query(context.Background(),
		"SELECT id, user_id, user_name, content, timestamp FROM admin_chat_messages ORDER BY timestamp ASC LIMIT 100")
	if err != nil {
		return c.JSON([]fiber.Map{})
	}
	defer rows.Close()
	var msgs []fiber.Map
	for rows.Next() {
		var id int
		var userId, userName, content string
		var ts int64
		if rows.Scan(&id, &userId, &userName, &content, &ts) == nil {
			msgs = append(msgs, fiber.Map{"id": id, "userId": userId, "name": userName, "content": content, "timestamp": ts})
		}
	}
	if msgs == nil {
		msgs = []fiber.Map{}
	}
	return c.JSON(msgs)
}

func handleAdminWS(c *websocket.Conn) {
	userId, _ := c.Locals("userId").(string)
	var userName string
	dbPool.QueryRow(context.Background(), "SELECT full_name FROM users WHERE id = $1", userId).Scan(&userName)

	adminRoomMu.Lock()
	adminRoom[c] = userId
	adminRoomMu.Unlock()

	defer func() {
		adminRoomMu.Lock()
		delete(adminRoom, c)
		adminRoomMu.Unlock()
		c.Close()
	}()

	for {
		_, msgBytes, err := c.ReadMessage()
		if err != nil {
			break
		}

		var raw map[string]interface{}
		if err := json.Unmarshal(msgBytes, &raw); err != nil {
			continue
		}

		content, _ := raw["content"].(string)
		if content == "" {
			continue
		}

		ts := time.Now().UnixMilli()
		var insertedID int
		dbPool.QueryRow(context.Background(),
			"INSERT INTO admin_chat_messages (user_id, user_name, content, timestamp) VALUES ($1, $2, $3, $4) RETURNING id",
			userId, userName, content, ts).Scan(&insertedID)

		out, _ := json.Marshal(fiber.Map{
			"id": insertedID, "userId": userId, "name": userName, "content": content, "timestamp": ts,
		})

		adminRoomMu.RLock()
		for conn := range adminRoom {
			conn.WriteMessage(websocket.TextMessage, out)
		}
		adminRoomMu.RUnlock()
	}
}
