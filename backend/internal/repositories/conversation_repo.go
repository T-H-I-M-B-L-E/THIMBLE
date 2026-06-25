package repositories

import (
	"context"
	"time"

	"chat-app/internal/db"
	"chat-app/internal/models"
)

func ListConversations(ctx context.Context, userId string) ([]models.Conversation, error) {
	// Single query: fetch conversations with all participants and the last
	// message in one round-trip using window functions.
	rows, err := db.Pool.Query(ctx, `
		WITH visible_convs AS (
			SELECT c.id, c.updated_at
			FROM conversations c
			JOIN conversation_participants cp ON cp.conversation_id = c.id
			WHERE cp.user_id = $1
			  AND (cp.hidden_at IS NULL OR c.updated_at > cp.hidden_at)
			  AND NOT EXISTS (
			    SELECT 1
			    FROM conversation_participants other
			    JOIN blocks b
			      ON (b.blocker_id = $1 AND b.blocked_id = other.user_id)
			      OR (b.blocker_id = other.user_id AND b.blocked_id = $1)
			    WHERE other.conversation_id = c.id AND other.user_id <> $1
			  )
		),
		last_msgs AS (
			SELECT DISTINCT ON (conversation_id)
			       id, conversation_id, user_id, name, content, image_url, timestamp
			FROM conversation_messages
			WHERE conversation_id IN (SELECT id FROM visible_convs)
			ORDER BY conversation_id, id DESC
		)
		SELECT
			vc.id, vc.updated_at,
			cp.id, cp.user_id, cp.user_name, cp.user_avatar, cp.joined_at,
			lm.id, lm.user_id, lm.name, lm.content, lm.image_url, lm.timestamp
		FROM visible_convs vc
		JOIN conversation_participants cp ON cp.conversation_id = vc.id
		LEFT JOIN last_msgs lm ON lm.conversation_id = vc.id
		ORDER BY vc.updated_at DESC, vc.id, cp.id`, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Collect rows into a map keyed by conversation ID to merge participants.
	type convEntry struct {
		conv    models.Conversation
		lastMsg *models.ConvMessage
	}
	order := []int{}
	convMap := map[int]*convEntry{}

	for rows.Next() {
		var convID int
		var updatedAt time.Time
		var p models.ConversationParticipant
		var joinedAt time.Time
		var lmID *int
		var lmConvID *int
		var lmUserID, lmName, lmContent, lmImageURL *string
		var lmTimestamp *int64

		if err := rows.Scan(
			&convID, &updatedAt,
			&p.ID, &p.UserID, &p.UserName, &p.UserAvatar, &joinedAt,
			&lmID, &lmUserID, &lmName, &lmContent, &lmImageURL, &lmTimestamp,
		); err != nil {
			return nil, err
		}
		_ = lmConvID
		p.ConversationID = convID
		p.JoinedAt = joinedAt.Format(time.RFC3339)

		entry, exists := convMap[convID]
		if !exists {
			entry = &convEntry{
				conv: models.Conversation{
					ID:        convID,
					UpdatedAt: updatedAt.Format(time.RFC3339),
				},
			}
			if lmID != nil {
				lm := models.ConvMessage{
					ID:             *lmID,
					ConversationID: convID,
					UserID:         *lmUserID,
					Name:           *lmName,
					Content:        *lmContent,
					ImageUrl:       *lmImageURL,
					Timestamp:      *lmTimestamp,
				}
				entry.lastMsg = &lm
			}
			convMap[convID] = entry
			order = append(order, convID)
		}
		entry.conv.Participants = append(entry.conv.Participants, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	convs := make([]models.Conversation, 0, len(order))
	for _, id := range order {
		e := convMap[id]
		if e.conv.Participants == nil {
			e.conv.Participants = []models.ConversationParticipant{}
		}
		if e.lastMsg != nil {
			e.conv.LastMessage = e.lastMsg
		}
		convs = append(convs, e.conv)
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
		if err := rows.Scan(&p.ID, &p.ConversationID, &p.UserID, &p.UserName, &p.UserAvatar, &joinedAt); err != nil {
			return nil, err
		}
		p.JoinedAt = joinedAt.Format(time.RFC3339)
		out = append(out, p)
	}
	return out, rows.Err()
}

func lastMessage(ctx context.Context, conversationID int) (models.ConvMessage, bool) {
	var lm models.ConvMessage
	err := db.Pool.QueryRow(ctx,
		"SELECT id, conversation_id, user_id, name, content, image_url, timestamp FROM conversation_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 1", conversationID).
		Scan(&lm.ID, &lm.ConversationID, &lm.UserID, &lm.Name, &lm.Content, &lm.ImageUrl, &lm.Timestamp)
	return lm, err == nil
}

func CreateConversation(ctx context.Context) (int, error) {
	var convId int
	err := db.Pool.QueryRow(ctx, "INSERT INTO conversations (user_one, user_two) VALUES (NULL, NULL) RETURNING id").Scan(&convId)
	return convId, err
}

// GetOrCreateConversation returns the existing 1-to-1 conversation between
// the two users, creating one if it doesn't exist. Safe to call concurrently
// — the unique index on (LEAST, GREATEST) prevents duplicates at the DB level.
func GetOrCreateConversation(ctx context.Context, userA, userB string) (int, error) {
	// Check for existing conversation between this exact pair.
	var existing int
	err := db.Pool.QueryRow(ctx, `
		SELECT a.conversation_id
		FROM conversation_participants a
		JOIN conversation_participants b
		  ON b.conversation_id = a.conversation_id AND b.user_id = $2
		WHERE a.user_id = $1
		LIMIT 1`, userA, userB).Scan(&existing)
	if err == nil {
		return existing, nil
	}

	// None found — create one and stamp user_one/user_two for the unique index.
	var convId int
	err = db.Pool.QueryRow(ctx, `
		INSERT INTO conversations (user_one, user_two)
		VALUES (LEAST($1,$2), GREATEST($1,$2))
		ON CONFLICT DO NOTHING
		RETURNING id`, userA, userB).Scan(&convId)
	if err != nil || convId == 0 {
		// Race: another request created it between our check and insert.
		err2 := db.Pool.QueryRow(ctx, `
			SELECT a.conversation_id
			FROM conversation_participants a
			JOIN conversation_participants b
			  ON b.conversation_id = a.conversation_id AND b.user_id = $2
			WHERE a.user_id = $1
			LIMIT 1`, userA, userB).Scan(&convId)
		if err2 != nil {
			return 0, err2
		}
	}
	return convId, nil
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

// GetConversationMessages returns the chat history for a conversation,
// hiding any messages the calling user has soft-deleted ("delete for me").
// Receipt timestamps are returned as nullable ms-epoch values.
func GetConversationMessages(ctx context.Context, convId, callerID string) ([]models.ConvMessage, error) {
	// Verify caller is a participant before returning any messages.
	var participantExists bool
	db.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2)`,
		convId, callerID).Scan(&participantExists)
	if !participantExists {
		return nil, nil
	}
	rows, err := db.Pool.Query(ctx, `
		SELECT id, conversation_id, user_id, name, content, image_url, timestamp,
		       delivered_at, read_at
		FROM conversation_messages
		WHERE conversation_id = $1
		  AND (deleted_by_user_id IS NULL OR deleted_by_user_id <> $2)
		ORDER BY timestamp ASC LIMIT 200`, convId, callerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var msgs []models.ConvMessage
	for rows.Next() {
		var m models.ConvMessage
		var delivered, read *time.Time
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.UserID, &m.Name, &m.Content, &m.ImageUrl, &m.Timestamp, &delivered, &read); err != nil {
			return nil, err
		}
		if delivered != nil {
			ms := delivered.UnixMilli()
			m.DeliveredAt = &ms
		}
		if read != nil {
			ms := read.UnixMilli()
			m.ReadAt = &ms
		}
		msgs = append(msgs, m)
	}
	if msgs == nil {
		msgs = []models.ConvMessage{}
	}
	return msgs, nil
}

// MarkDelivered stamps delivered_at on the given messages (if currently null)
// and returns the IDs that were actually updated, so the sender's receipt UI
// can flip only those bubbles.
func MarkDelivered(ctx context.Context, convID int, msgIDs []int, recipientID string) ([]int, error) {
	if len(msgIDs) == 0 {
		return nil, nil
	}
	rows, err := db.Pool.Query(ctx, `
		UPDATE conversation_messages
		   SET delivered_at = NOW()
		 WHERE conversation_id = $1
		   AND id = ANY($2::bigint[])
		   AND user_id <> $3        -- only mark messages sent TO this user
		   AND delivered_at IS NULL
		RETURNING id`, convID, msgIDs, recipientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var updated []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		updated = append(updated, id)
	}
	return updated, rows.Err()
}

// MarkRead stamps read_at on all messages addressed TO `readerID` in the
// conversation that aren't already read. Returns the affected IDs.
func MarkRead(ctx context.Context, convID int, readerID string) ([]int, error) {
	var participantExists bool
	db.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2)`,
		convID, readerID).Scan(&participantExists)
	if !participantExists {
		return nil, nil
	}
	rows, err := db.Pool.Query(ctx, `
		UPDATE conversation_messages
		   SET read_at = NOW(),
		       delivered_at = COALESCE(delivered_at, NOW())
		 WHERE conversation_id = $1
		   AND user_id <> $2
		   AND read_at IS NULL
		RETURNING id`, convID, readerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var updated []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		updated = append(updated, id)
	}
	return updated, rows.Err()
}

// HideConversationForUser marks the conversation hidden for a single
// participant. Returns rowsAffected so the caller can detect non-members.
func HideConversationForUser(ctx context.Context, convID, userID string) (int64, error) {
	tag, err := db.Pool.Exec(ctx,
		`UPDATE conversation_participants
		    SET hidden_at = NOW()
		  WHERE conversation_id = $1 AND user_id = $2`,
		convID, userID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// SoftDeleteMessageForUser hides a message from a specific user's view.
// Only the message author may delete; if a stranger tries, returns 0 rows.
func SoftDeleteMessageForUser(ctx context.Context, msgID, userID string) (int64, error) {
	tag, err := db.Pool.Exec(ctx,
		`UPDATE conversation_messages
		   SET deleted_by_user_id = $2
		 WHERE id = $1 AND user_id = $2`,
		msgID, userID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// RestoreMessageForUser is the undo path — clear the deleted marker.
func RestoreMessageForUser(ctx context.Context, msgID, userID string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE conversation_messages
		   SET deleted_by_user_id = NULL
		 WHERE id = $1 AND user_id = $2 AND deleted_by_user_id = $2`,
		msgID, userID)
	return err
}

// InsertConvMessage writes a chat message and returns the assigned id.
// It also bumps conversations.updated_at so the conversation list re-sorts.
func InsertConvMessage(ctx context.Context, m *models.ConvMessage) error {
	if err := db.Pool.QueryRow(ctx,
		"INSERT INTO conversation_messages (conversation_id, user_id, name, content, image_url, timestamp) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
		m.ConversationID, m.UserID, m.Name, m.Content, m.ImageUrl, m.Timestamp).Scan(&m.ID); err != nil {
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

// GetConversationParticipantIDs returns the user_id of every participant.
func GetConversationParticipantIDs(ctx context.Context, convID int) ([]string, error) {
	rows, err := db.Pool.Query(ctx,
		"SELECT user_id FROM conversation_participants WHERE conversation_id = $1", convID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// GetUserNameByID returns the full_name for a given user id.
func GetUserNameByID(ctx context.Context, userID string) (string, error) {
	var name string
	err := db.Pool.QueryRow(ctx,
		"SELECT full_name FROM users WHERE id = $1", userID).Scan(&name)
	return name, err
}
