package services

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/gofiber/websocket/v2"

	"chat-app/internal/models"
	"chat-app/internal/repositories"
)

// Conversation WS state: clients keyed by conn → userId, per-room maps
// (rooms[convId][conn] = userId). RWMutex because reads dominate.
var (
	clients   = make(map[*websocket.Conn]string)
	rooms     = make(map[int]map[*websocket.Conn]string)
	clientsMu sync.RWMutex
)

func ListConversations(ctx context.Context, userId string) []models.Conversation {
	// On error the original handler returned []. Keep that behaviour so
	// the empty-state UI renders instead of an error banner.
	convs, err := repositories.ListConversations(ctx, userId)
	if err != nil {
		return []models.Conversation{}
	}
	return convs
}

func CreateConversation(ctx context.Context, userId string, participants []models.ConversationParticipant) (int, *ServiceError) {
	convId, err := repositories.CreateConversation(ctx)
	if err != nil {
		return 0, NewError(500, "db_failed", "failed to create conversation")
	}

	creatorName, creatorAvatar := repositories.GetUserNameAndAvatarForConv(ctx, userId)
	repositories.AddParticipant(ctx, convId, userId, creatorName, creatorAvatar)

	seen := map[string]bool{userId: true}
	for _, p := range participants {
		if seen[p.UserID] {
			continue
		}
		seen[p.UserID] = true
		repositories.AddParticipant(ctx, convId, p.UserID, p.UserName, p.UserAvatar)
	}
	return convId, nil
}

// GetConversationMessages returns chat history, hiding messages the
// caller has soft-deleted via "delete for me".
func GetConversationMessages(ctx context.Context, convId, callerID string) []models.ConvMessage {
	msgs, err := repositories.GetConversationMessages(ctx, convId, callerID)
	if err != nil {
		return []models.ConvMessage{}
	}
	return msgs
}

// DeleteMessageForUser performs a soft delete. Returns NewError(404)
// when the caller doesn't own the message or it doesn't exist.
func DeleteMessageForUser(ctx context.Context, msgID, userID string) *ServiceError {
	rows, err := repositories.SoftDeleteMessageForUser(ctx, msgID, userID)
	if err != nil {
		return NewError(500, "db_failed", "failed to delete message")
	}
	if rows == 0 {
		return NewError(404, "not_found", "message not found or not yours")
	}
	return nil
}

// RestoreMessageForUser is the undo path for DeleteMessageForUser.
func RestoreMessageForUser(ctx context.Context, msgID, userID string) *ServiceError {
	if err := repositories.RestoreMessageForUser(ctx, msgID, userID); err != nil {
		return NewError(500, "db_failed", "failed to restore message")
	}
	return nil
}

// MarkConversationRead stamps read_at on every message addressed to
// readerID in the conversation. Returns the IDs that were freshly read.
// Used by the REST mark-read endpoint and (separately) by the WS
// "read" event handler.
func MarkConversationRead(ctx context.Context, convID int, readerID string) ([]int, *ServiceError) {
	ids, err := repositories.MarkRead(ctx, convID, readerID)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to mark read")
	}
	return ids, nil
}

// HandleConversationWS drives one WS connection: registers it in the
// room map, then loops reading messages until the client disconnects.
// "typing" events are forwarded; everything else is persisted as a
// ConvMessage and broadcast to the room.
func HandleConversationWS(c *websocket.Conn, userId string, convId int) {
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

		if eventType, ok := eventMap["type"].(string); ok {
			switch eventType {
			case "typing":
				broadcastToRoom(convId, c, mt, msgBytes)
				continue
			case "read":
				// Client reports that the user has the conversation open.
				// Mark every incoming-to-them message read, then broadcast a
				// receipt event so the sender's UI flips.
				updated, err := repositories.MarkRead(context.Background(), convId, userId)
				if err != nil || len(updated) == 0 {
					continue
				}
				receipt := models.ReceiptEvent{
					Type:           "read",
					ConversationID: convId,
					MessageIDs:     updated,
					Timestamp:      time.Now().UnixMilli(),
				}
				payload, _ := json.Marshal(receipt)
				broadcastToRoomIncludingSender(convId, mt, payload)
				continue
			}
		}

		var msg models.ConvMessage
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

		repositories.InsertConvMessage(context.Background(), &msg)

		out, _ := json.Marshal(msg)
		broadcastToRoomIncludingSender(convId, mt, out)

		// After broadcasting, mark delivered to any other connected
		// participant and notify the sender so the check turns to double.
		recipients := getRecipientIDs(convId, userId)
		if len(recipients) > 0 && msg.ID > 0 {
			for _, recipientID := range recipients {
				updated, err := repositories.MarkDelivered(context.Background(), convId, []int{msg.ID}, recipientID)
				if err != nil || len(updated) == 0 {
					continue
				}
				receipt := models.ReceiptEvent{
					Type:           "delivered",
					ConversationID: convId,
					MessageIDs:     updated,
					Timestamp:      time.Now().UnixMilli(),
				}
				payload, _ := json.Marshal(receipt)
				broadcastToRoomIncludingSender(convId, mt, payload)
			}
		}
	}
}

// getRecipientIDs returns the userIds of every connection in the room
// other than the sender. Used to mark delivered to live recipients.
func getRecipientIDs(convId int, senderID string) []string {
	clientsMu.RLock()
	defer clientsMu.RUnlock()
	out := make([]string, 0, len(rooms[convId]))
	seen := map[string]bool{}
	for _, uid := range rooms[convId] {
		if uid != senderID && !seen[uid] {
			seen[uid] = true
			out = append(out, uid)
		}
	}
	return out
}

func broadcastToRoom(convId int, sender *websocket.Conn, mt int, payload []byte) {
	clientsMu.RLock()
	targets := make([]*websocket.Conn, 0, len(rooms[convId]))
	for conn := range rooms[convId] {
		if conn != sender {
			targets = append(targets, conn)
		}
	}
	clientsMu.RUnlock()
	for _, conn := range targets {
		conn.WriteMessage(mt, payload)
	}
}

func broadcastToRoomIncludingSender(convId, mt int, payload []byte) {
	clientsMu.RLock()
	targets := make([]*websocket.Conn, 0, len(rooms[convId]))
	for conn := range rooms[convId] {
		targets = append(targets, conn)
	}
	clientsMu.RUnlock()
	for _, conn := range targets {
		conn.WriteMessage(mt, payload)
	}
}

// Admin chat: a separate single-room model used by the admin team. No
// rooms map — every connected admin sees every message.

var (
	adminRoom   = make(map[*websocket.Conn]string)
	adminRoomMu sync.RWMutex
)

func ListAdminChatHistory(ctx context.Context) []map[string]any {
	msgs, err := repositories.ListAdminChatHistory(ctx)
	if err != nil {
		return []map[string]any{}
	}
	return msgs
}

func HandleAdminWS(c *websocket.Conn, userId string) {
	nameCtx, nameCancel := context.WithTimeout(context.Background(), 5*time.Second)
	userName := repositories.GetUserFullName(nameCtx, userId)
	nameCancel()

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
		insertedID, _ := repositories.InsertAdminMessage(context.Background(), userId, userName, content, ts)

		out, _ := json.Marshal(map[string]any{
			"id": insertedID, "userId": userId, "name": userName, "content": content, "timestamp": ts,
		})

		adminRoomMu.RLock()
		for conn := range adminRoom {
			conn.WriteMessage(websocket.TextMessage, out)
		}
		adminRoomMu.RUnlock()
	}
}
