package models

import "time"

// Ad is the admin-facing shape of an advertisement.
type Ad struct {
	Id              string    `json:"id"`
	Title           string    `json:"title"`
	SponsorName     string    `json:"sponsorName"`
	Description     string    `json:"description"`
	ImageUrl        string    `json:"imageUrl"`
	VideoUrl        string    `json:"videoUrl,omitempty"`
	RedirectUrl     string    `json:"redirectUrl"`
	Placement       string    `json:"placement"`
	IsActive        bool      `json:"isActive"`
	StartDate       time.Time `json:"startDate"`
	EndDate         time.Time `json:"endDate"`
	ClickCount      int64     `json:"clickCount"`
	ImpressionCount int64     `json:"impressionCount"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// FeedItem is the tagged-union shape the feed endpoint returns once
// ads are interleaved. Exactly one of Post or Ad is populated per item.
type FeedItem struct {
	Type string `json:"type"` // "post" or "ad"
	Data any    `json:"data"`
}
