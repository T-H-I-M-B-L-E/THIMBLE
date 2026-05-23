package models

import "time"

type VerificationRequest struct {
	ID            int64      `json:"id"`
	UserID        string     `json:"userId"`
	Status        string     `json:"status"`
	FullName      string     `json:"fullName"`
	Email         string     `json:"email"`
	IDDocumentURL string     `json:"idDocumentUrl"`
	Reason        string     `json:"reason"`
	AdminNote     string     `json:"adminNote,omitempty"`
	ReviewedBy    *string    `json:"reviewedBy,omitempty"`
	ReviewedAt    *time.Time `json:"reviewedAt,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`

	UserFullName string `json:"userFullName,omitempty"`
	UserEmail    string `json:"userEmail,omitempty"`
	UserAvatar   string `json:"userAvatar,omitempty"`
	UserRole     string `json:"userRole,omitempty"`
}
