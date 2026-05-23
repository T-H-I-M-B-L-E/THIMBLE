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
	Timestamp      int64  `json:"timestamp"`
}
