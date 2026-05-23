package repositories

import (
	"context"
	"time"

	"chat-app/internal/db"
	"chat-app/internal/models"
)

func ListConversations(ctx context.Context, userId string) ([]models.Conversation, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT c.id, c.updated_at
		FROM conversations c
		JOIN conversation_participants cp ON cp.conversation_id = c.id
		WHERE cp.user_id = $1
		ORDER BY c.updated_at DESC`, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var convs []models.Conversation
	for rows.Next() {
		var conv models.Conversation
		var updatedAt time.Time
		rows.Scan(&conv.ID, &updatedAt)
		conv.UpdatedAt = updatedAt.Format(time.RFC3339)

		conv.Participants, _ = listParticipants(ctx, conv.ID)
		if conv.Participants == nil {
			conv.Participants = []models.ConversationParticipant{}
		}

		if lm, ok := lastMessage(ctx, conv.ID); ok {
			conv.LastMessage = &lm
		}
		convs = append(convs, conv)
	}
	if convs == nil {
		convs = []models.Conversation{}
	}
	return convs, nil
}

func listParticipants(ctx context.Context, conversationID int) ([]models.ConversationParticipant, error) {
	rows, err := db.Pool.Query(ctx,
		"SELECT id, conversation_id, user_id, user_name, user_avatar, joined_at FROM conversation_participants WHERE conversation_id = $1", conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.ConversationParticipant
	for rows.Next() {
		var p models.ConversationParticipant
		var joinedAt time.Time
		rows.Scan(&p.ID, &p.ConversationID, &p.UserID, &p.UserName, &p.UserAvatar, &joinedAt)
		p.JoinedAt = joinedAt.Format(time.RFC3339)
		out = append(out, p)
	}
	return out, nil
}

func lastMessage(ctx context.Context, conversationID int) (models.ConvMessage, bool) {
	var lm models.ConvMessage
	err := db.Pool.QueryRow(ctx,
		"SELECT id, conversation_id, user_id, name, content, timestamp FROM conversation_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 1", conversationID).
		Scan(&lm.ID, &lm.ConversationID, &lm.UserID, &lm.Name, &lm.Content, &lm.Timestamp)
	return lm, err == nil
}

func CreateConversation(ctx context.Context) (int, error) {
	var convId int
	err := db.Pool.QueryRow(ctx, "INSERT INTO conversations DEFAULT VALUES RETURNING id").Scan(&convId)
	return convId, err
}

func AddParticipant(ctx context.Context, convId int, userId, userName, userAvatar string) {
	db.Pool.Exec(ctx,
		"INSERT INTO conversation_participants (conversation_id, user_id, user_name, user_avatar) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
		convId, userId, userName, userAvatar)
}

// GetUserNameAndAvatarForConv returns name + avatar used when seeding the
// creator's row in conversation_participants.
func GetUserNameAndAvatarForConv(ctx context.Context, userId string) (name, avatar string) {
	db.Pool.QueryRow(ctx, "SELECT full_name, COALESCE(avatar_url, '') FROM users WHERE id = $1", userId).Scan(&name, &avatar)
	return
}

func GetConversationMessages(ctx context.Context, convId string) ([]models.ConvMessage, error) {
	rows, err := db.Pool.Query(ctx,
		"SELECT id, conversation_id, user_id, name, content, timestamp FROM conversation_messages WHERE conversation_id = $1 ORDER BY timestamp ASC LIMIT 100", convId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var msgs []models.ConvMessage
	for rows.Next() {
		var m models.ConvMessage
		rows.Scan(&m.ID, &m.ConversationID, &m.UserID, &m.Name, &m.Content, &m.Timestamp)
		msgs = append(msgs, m)
	}
	if msgs == nil {
		msgs = []models.ConvMessage{}
	}
	return msgs, nil
}

// InsertConvMessage writes a chat message and returns the assigned id.
// It also bumps conversations.updated_at so the conversation list re-sorts.
func InsertConvMessage(ctx context.Context, m *models.ConvMessage) error {
	if err := db.Pool.QueryRow(ctx,
		"INSERT INTO conversation_messages (conversation_id, user_id, name, content, timestamp) VALUES ($1, $2, $3, $4, $5) RETURNING id",
		m.ConversationID, m.UserID, m.Name, m.Content, m.Timestamp).Scan(&m.ID); err != nil {
		return err
	}
	db.Pool.Exec(ctx, "UPDATE conversations SET updated_at = NOW() WHERE id = $1", m.ConversationID)
	return nil
}

// ListAdminChatHistory returns the legacy admin chat backlog as raw maps
// because the handler ships them straight through fiber.JSON.
func ListAdminChatHistory(ctx context.Context) ([]map[string]any, error) {
	rows, err := db.Pool.Query(ctx,
		"SELECT id, user_id, user_name, content, timestamp FROM admin_chat_messages ORDER BY timestamp ASC LIMIT 100")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var msgs []map[string]any
	for rows.Next() {
		var id int
		var userId, userName, content string
		var ts int64
		if rows.Scan(&id, &userId, &userName, &content, &ts) == nil {
			msgs = append(msgs, map[string]any{"id": id, "userId": userId, "name": userName, "content": content, "timestamp": ts})
		}
	}
	if msgs == nil {
		msgs = []map[string]any{}
	}
	return msgs, nil
}

func InsertAdminMessage(ctx context.Context, userId, userName, content string, ts int64) (int, error) {
	var id int
	err := db.Pool.QueryRow(ctx,
		"INSERT INTO admin_chat_messages (user_id, user_name, content, timestamp) VALUES ($1, $2, $3, $4) RETURNING id",
		userId, userName, content, ts).Scan(&id)
	return id, err
}
