package models

import "time"

type User struct {
	ID                 string  `json:"id"`
	Email              string  `json:"email"`
	FullName           string  `json:"fullName"`
	Username           string  `json:"username"`
	UsernameChangedAt  *string `json:"usernameChangedAt,omitempty"`
	Role               string  `json:"role"`
	AvatarUrl          string  `json:"avatarUrl,omitempty"`
	Bio                string  `json:"bio,omitempty"`
	Location           string  `json:"location,omitempty"`
	Website            string  `json:"website,omitempty"`
	Instagram          string  `json:"instagram,omitempty"`
	VerificationStatus string  `json:"verificationStatus"`
	IsVerified         bool    `json:"isVerified"`
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
	IsVerified         bool       `json:"isVerified"`
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
