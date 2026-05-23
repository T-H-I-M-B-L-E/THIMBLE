package models

type NotificationSender struct {
	ID       string `json:"id"`
	FullName string `json:"fullName"`
	Avatar   string `json:"avatar"`
	Username string `json:"username"`
}

type Notification struct {
	ID        int64              `json:"id"`
	Type      string             `json:"type"`
	Sender    NotificationSender `json:"sender"`
	PostID    *int64             `json:"postId"`
	UserID    *string            `json:"userId"`
	CreatedAt string             `json:"createdAt"`
	Read      bool               `json:"read"`
}
