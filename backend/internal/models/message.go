package models

type Message struct {
	UserId    string `json:"userId"`
	Name      string `json:"name"`
	Content   string `json:"content"`
	Timestamp int64  `json:"timestamp"`
}

type TypingEvent struct {
	Type           string `json:"type"`
	ConversationId int    `json:"conversationId"`
	UserId         string `json:"userId"`
	Name           string `json:"name"`
	IsTyping       bool   `json:"isTyping"`
}

type ConversationParticipant struct {
	ID             int    `json:"id"`
	ConversationID int    `json:"conversationId"`
	UserID         string `json:"userId"`
	UserName       string `json:"userName"`
	UserAvatar     string `json:"userAvatar"`
	JoinedAt       string `json:"joinedAt"`
}

type Conversation struct {
	ID           int                       `json:"id"`
	Participants []ConversationParticipant `json:"participants"`
	LastMessage  *ConvMessage              `json:"lastMessage,omitempty"`
	UpdatedAt    string                    `json:"updatedAt"`
}

type ConvMessage struct {
	ID             int    `json:"id"`
	ConversationID int    `json:"conversationId"`
	UserID         string `json:"userId"`
	Name           string `json:"name"`
	Content        string `json:"content"`
	ImageUrl       string `json:"imageUrl,omitempty"`
	Timestamp      int64  `json:"timestamp"`
	// Receipt timestamps (ms epoch). Nil when not yet delivered/read.
	DeliveredAt    *int64 `json:"deliveredAt,omitempty"`
	ReadAt         *int64 `json:"readAt,omitempty"`
}

// ReceiptEvent is the WS payload for delivered/read updates. Sent
// recipient → server when "read", and server → sender for both states.
type ReceiptEvent struct {
	Type           string `json:"type"` // "delivered" | "read"
	ConversationID int    `json:"conversationId"`
	MessageIDs     []int  `json:"messageIds"`
	Timestamp      int64  `json:"timestamp"`
}
