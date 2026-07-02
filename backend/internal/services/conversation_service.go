package services

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gofiber/websocket/v2"

	"chat-app/internal/db"
	"chat-app/internal/models"
	"chat-app/internal/repositories"
)

// Conversation WS state: clients keyed by conn → userId, per-room maps
// (rooms[convId][conn] = userId). RWMutex because reads dominate.
// userConns tracks every active connection per user across all rooms so
// call-invite events can be delivered even when the callee isn't viewing
// the specific conversation.
var (
	clients   = make(map[*websocket.Conn]string)
	rooms     = make(map[int]map[*websocket.Conn]string)
	userConns = make(map[string][]*websocket.Conn)
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
	// For 1-to-1 conversations (the only kind THIMBLE supports) always
	// get-or-create so the same pair can never produce a second conversation.
	if len(participants) == 1 {
		convId, err := repositories.GetOrCreateConversation(ctx, userId, participants[0].UserID)
		if err != nil {
			return 0, NewError(500, "db_failed", "failed to get or create conversation")
		}
		// Ensure both participants are recorded (idempotent ON CONFLICT DO NOTHING).
		creatorName, creatorAvatar := repositories.GetUserNameAndAvatarForConv(ctx, userId)
		repositories.AddParticipant(ctx, convId, userId, creatorName, creatorAvatar)
		repositories.AddParticipant(ctx, convId, participants[0].UserID, participants[0].UserName, participants[0].UserAvatar)
		return convId, nil
	}

	// Group conversations (future): fall back to creating a new one.
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

// HideConversationForUser is the "delete for me" path. The other
// participant still sees the chat; sending a new message will resurface
// it on this user's side because ListConversations only hides chats
// where updated_at <= hidden_at.
func HideConversationForUser(ctx context.Context, convID, userID string) *ServiceError {
	rows, err := repositories.HideConversationForUser(ctx, convID, userID)
	if err != nil {
		return NewError(500, "db_failed", "failed to delete conversation")
	}
	if rows == 0 {
		return NewError(404, "not_found", "conversation not found")
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
	if convId > 0 {
		var ok bool
		db.Pool.QueryRow(context.Background(),
			`SELECT EXISTS(SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2)`,
			convId, userId).Scan(&ok)
		if !ok {
			c.Close()
			return
		}
	}
	clientsMu.Lock()
	if convId > 0 {
		if rooms[convId] == nil {
			rooms[convId] = make(map[*websocket.Conn]string)
		}
		rooms[convId][c] = userId
	} else {
		clients[c] = userId
	}
	userConns[userId] = append(userConns[userId], c)
	clientsMu.Unlock()

	defer func() {
		clientsMu.Lock()
		if convId > 0 {
			delete(rooms[convId], c)
		} else {
			delete(clients, c)
		}
		conns := userConns[userId]
		for i, conn := range conns {
			if conn == c {
				userConns[userId] = append(conns[:i], conns[i+1:]...)
				break
			}
		}
		if len(userConns[userId]) == 0 {
			delete(userConns, userId)
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

		if err := repositories.InsertConvMessage(context.Background(), &msg); err != nil {
			log.Printf("failed to persist conversation message (conv=%d user=%s): %v", convId, userId, err)
		}

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

// BroadcastCallInvite sends a call-invite WS event to every participant of
// the conversation except the caller, delivered to any active WS connection
// that user has open (regardless of which conversation they're currently viewing).
func BroadcastCallInvite(convID int, callerID, callerName, room, kind string) {
	participantIDs, err := repositories.GetConversationParticipantIDs(context.Background(), convID)
	if err != nil {
		log.Printf("[call] BroadcastCallInvite: db error for conv %d: %v", convID, err)
		return
	}
	log.Printf("[call] BroadcastCallInvite: conv=%d caller=%s participants=%v", convID, callerID, participantIDs)
	payload, _ := json.Marshal(map[string]any{
		"type":       "call-invite",
		"callerID":   callerID,
		"callerName": callerName,
		"room":       room,
		"kind":       kind,
		"convID":     convID,
	})
	clientsMu.RLock()
	targets := make([]*websocket.Conn, 0)
	for _, uid := range participantIDs {
		if uid == callerID {
			continue
		}
		conns := userConns[uid]
		log.Printf("[call] callee=%s has %d active WS connections", uid, len(conns))
		targets = append(targets, conns...)
	}
	clientsMu.RUnlock()
	log.Printf("[call] sending invite to %d connections", len(targets))
	for _, conn := range targets {
		conn.WriteMessage(websocket.TextMessage, payload)
	}
}

// BroadcastCallEnd notifies all participants (via any active WS connection)
// that the call is over so both sides close the LiveKit modal.
func BroadcastCallEnd(convID int, senderID, room string, durationSecs *int) {
	participantIDs, err := repositories.GetConversationParticipantIDs(context.Background(), convID)
	if err != nil {
		// Fall back to room-scoped broadcast if DB lookup fails
		payload, _ := json.Marshal(map[string]any{"type": "call-end", "senderID": senderID, "room": room})
		broadcastToRoomIncludingSender(convID, websocket.TextMessage, payload)
		return
	}
	payload, _ := json.Marshal(map[string]any{
		"type":         "call-end",
		"senderID":     senderID,
		"room":         room,
		"durationSecs": durationSecs,
	})
	clientsMu.RLock()
	targets := make([]*websocket.Conn, 0)
	for _, uid := range participantIDs {
		targets = append(targets, userConns[uid]...)
	}
	clientsMu.RUnlock()
	for _, conn := range targets {
		conn.WriteMessage(websocket.TextMessage, payload)
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
