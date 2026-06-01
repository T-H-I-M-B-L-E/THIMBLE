package models

import "time"

type Gig struct {
	Id             int       `json:"id"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	Location       string    `json:"location"`
	Payment        string    `json:"payment"`
	RoleWanted     string    `json:"roleWanted"`
	Status         string    `json:"status"`
	PostedBy       string    `json:"postedBy"`
	PostedByRole   string    `json:"postedByRole"`
	PostedByAvatar string    `json:"postedByAvatar"`
	PosterID       string    `json:"posterId"`
	Applications   int       `json:"applications"`
	HasApplied     bool      `json:"hasApplied"`
	IsOwner        bool      `json:"isOwner"`
	CreatedAt      time.Time `json:"createdAt"`
}

type GigApplicant struct {
	UserID    string    `json:"userId"`
	Name      string    `json:"name"`
	Avatar    string    `json:"avatar"`
	Role      string    `json:"role"`
	AppliedAt time.Time `json:"appliedAt"`
}
