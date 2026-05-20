package main

import "time"

type User struct {
	ID                 string  `json:"id"`
	Email              string  `json:"email"`
	FullName           string  `json:"fullName"`
	Role               string  `json:"role"`
	AvatarUrl          string  `json:"avatarUrl,omitempty"`
	Bio                string  `json:"bio,omitempty"`
	Location           string  `json:"location,omitempty"`
	Website            string  `json:"website,omitempty"`
	VerificationStatus string  `json:"verificationStatus"`
	Followers          int     `json:"followers"`
	Following          int     `json:"following"`
	Posts              int     `json:"posts"`
	IsBanned           bool    `json:"isBanned"`
	BannedUntil        *string `json:"bannedUntil,omitempty"`
	BanMessage         string  `json:"banMessage,omitempty"`
}

type AdminUserView struct {
	ID                 string     `json:"id"`
	Email              string     `json:"email"`
	FullName           string     `json:"fullName"`
	Role               string     `json:"role"`
	VerificationStatus string     `json:"verificationStatus"`
	IsAdmin            bool       `json:"isAdmin"`
	IsBanned           bool       `json:"isBanned"`
	BannedUntil        *string    `json:"bannedUntil,omitempty"`
	BanMessage         string     `json:"banMessage,omitempty"`
	CreatedAt          time.Time  `json:"createdAt"`
	LastLoginAt        *time.Time `json:"lastLoginAt"`
	TotalLogins        int        `json:"totalLogins"`
	Followers          int        `json:"followers"`
	Following          int        `json:"following"`
	Posts              int        `json:"posts"`
}

type AdminStats struct {
	TotalUsers           int          `json:"totalUsers"`
	TodaySignups         int          `json:"todaySignups"`
	WeekSignups          int          `json:"weekSignups"`
	PendingVerifications int          `json:"pendingVerifications"`
	VerifiedUsers        int          `json:"verifiedUsers"`
	UnverifiedUsers      int          `json:"unverifiedUsers"`
	TotalLogins          int          `json:"totalLogins"`
	AdminCount           int          `json:"adminCount"`
	ReturnedUsers        int          `json:"returnedUsers"`
	NeverLoggedIn        int          `json:"neverLoggedIn"`
	TotalPosts           int          `json:"totalPosts"`
	PostsThisWeek        int          `json:"postsThisWeek"`
	TotalGigs            int          `json:"totalGigs"`
	RoleBreakdown        []RoleCount  `json:"roleBreakdown"`
	DailySignups         []DailyCount `json:"dailySignups"`
}

type RoleCount struct {
	Role  string `json:"role"`
	Count int    `json:"count"`
}

type DailyCount struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

type AuditLog struct {
	ID         int       `json:"id"`
	AdminID    string    `json:"adminId"`
	AdminName  string    `json:"adminName"`
	Action     string    `json:"action"`
	TargetID   string    `json:"targetId"`
	TargetName string    `json:"targetName"`
	Details    string    `json:"details"`
	CreatedAt  time.Time `json:"createdAt"`
}

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

type Post struct {
	Id           int       `json:"id"`
	UserId       string    `json:"userId"`
	AuthorName   string    `json:"authorName"`
	AuthorAvatar string    `json:"authorAvatar"`
	ImageUrl     string    `json:"imageUrl"`
	Description  string    `json:"description"`
	Likes        int       `json:"likes"`
	CommentCount int       `json:"commentCount"`
	LikedByMe    bool      `json:"likedByMe"`
	TaggedUsers  []string  `json:"taggedUsers"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Gig struct {
	Id             int       `json:"id"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	Location       string    `json:"location"`
	Payment        string    `json:"payment"`
	PostedBy       string    `json:"postedBy"`
	PostedByRole   string    `json:"postedByRole"`
	PostedByAvatar string    `json:"postedByAvatar"`
	Applications   int       `json:"applications"`
	CreatedAt      time.Time `json:"createdAt"`
}

type SignupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"fullName"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type VerifyEmailRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type SignupResponse struct {
	VerificationRequired bool   `json:"verificationRequired"`
	ExpiresIn            string `json:"expiresIn"`
	Message              string `json:"message"`
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
