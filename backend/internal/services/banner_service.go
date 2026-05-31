package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"chat-app/internal/db"
)

type BannerInput struct {
	Message  string   `json:"message"`
	Type     string   `json:"type"`
	Audience Audience `json:"audience"`
	Hours    int      `json:"hours"` // 0 = no expiry
}

type Banner struct {
	ID         int64     `json:"id"`
	Message    string    `json:"message"`
	Type       string    `json:"type"`
	Audience   Audience  `json:"audience"`
	ExpiresAt  *time.Time `json:"expiresAt,omitempty"`
	TakenDown  bool      `json:"takenDown"`
	CreatedAt  time.Time `json:"createdAt"`
	CreatedBy  string    `json:"createdBy,omitempty"`
}

// validBannerTypes mirrors the union shipped to the frontend.
func validBannerTypes() map[string]bool {
	return map[string]bool{"info": true, "success": true, "warning": true, "critical": true}
}

// CreateBanner takes down any existing active banner (only one at a time)
// and inserts the new one.
func CreateBanner(ctx context.Context, adminID string, in BannerInput) (int64, error) {
	in.Message = strings.TrimSpace(in.Message)
	if in.Message == "" {
		return 0, fmt.Errorf("banner message is required")
	}
	if in.Type == "" {
		in.Type = "info"
	}
	if !validBannerTypes()[in.Type] {
		return 0, fmt.Errorf("invalid banner type %q", in.Type)
	}
	for _, r := range in.Audience.Roles {
		if !validRoles()[r] {
			return 0, fmt.Errorf("invalid role %q", r)
		}
	}

	// Take down any existing active banner — only one at a time.
	if _, err := db.Pool.Exec(ctx, `UPDATE banners SET taken_down = TRUE WHERE taken_down = FALSE`); err != nil {
		return 0, err
	}

	audienceJSON, _ := json.Marshal(in.Audience)
	var expiresAt *time.Time
	if in.Hours > 0 {
		t := time.Now().Add(time.Duration(in.Hours) * time.Hour)
		expiresAt = &t
	}

	var id int64
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO banners (message, banner_type, audience, expires_at, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, in.Message, in.Type, string(audienceJSON), expiresAt, adminID).Scan(&id)
	return id, err
}

// TakeDownBanner marks any active banner as taken down so the next public
// fetch returns nothing.
func TakeDownBanner(ctx context.Context) error {
	_, err := db.Pool.Exec(ctx, `UPDATE banners SET taken_down = TRUE WHERE taken_down = FALSE`)
	return err
}

// ActiveBannerFor returns the currently-active banner if it matches the
// audience filters for the given viewer, otherwise nil. Used by the public
// /api/banner endpoint that every page hits on load.
func ActiveBannerFor(ctx context.Context, viewerRole string, viewerVerified bool) (*Banner, error) {
	row := db.Pool.QueryRow(ctx, `
		SELECT id, message, banner_type, audience, expires_at, taken_down, created_at, COALESCE(created_by, '')
		FROM banners
		WHERE taken_down = FALSE
		  AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY created_at DESC
		LIMIT 1
	`)
	var b Banner
	var audienceJSON string
	err := row.Scan(&b.ID, &b.Message, &b.Type, &audienceJSON, &b.ExpiresAt, &b.TakenDown, &b.CreatedAt, &b.CreatedBy)
	if err != nil {
		return nil, nil // no active banner — not an error
	}
	if err := json.Unmarshal([]byte(audienceJSON), &b.Audience); err != nil {
		return nil, err
	}
	if !AudienceMatchesRole(b.Audience, viewerRole, viewerVerified) {
		return nil, nil
	}
	return &b, nil
}

// CurrentBanner returns the latest active banner (regardless of audience match)
// for the admin dashboard "Active banner" panel.
func CurrentBanner(ctx context.Context) (*Banner, error) {
	row := db.Pool.QueryRow(ctx, `
		SELECT id, message, banner_type, audience, expires_at, taken_down, created_at, COALESCE(created_by, '')
		FROM banners
		WHERE taken_down = FALSE
		  AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY created_at DESC
		LIMIT 1
	`)
	var b Banner
	var audienceJSON string
	err := row.Scan(&b.ID, &b.Message, &b.Type, &audienceJSON, &b.ExpiresAt, &b.TakenDown, &b.CreatedAt, &b.CreatedBy)
	if err != nil {
		return nil, nil
	}
	json.Unmarshal([]byte(audienceJSON), &b.Audience)
	return &b, nil
}
