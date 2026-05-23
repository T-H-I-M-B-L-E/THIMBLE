package repositories

import (
	"context"

	"chat-app/internal/db"
	"chat-app/internal/models"
)

func ListGigs(ctx context.Context) ([]models.Gig, error) {
	rows, err := db.Pool.Query(ctx,
		"SELECT id, title, description, location, payment, posted_by, posted_by_role, posted_by_avatar, applications, created_at FROM gigs ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var gigs []models.Gig
	for rows.Next() {
		var g models.Gig
		if err := rows.Scan(&g.Id, &g.Title, &g.Description, &g.Location, &g.Payment, &g.PostedBy, &g.PostedByRole, &g.PostedByAvatar, &g.Applications, &g.CreatedAt); err == nil {
			gigs = append(gigs, g)
		}
	}
	if gigs == nil {
		gigs = []models.Gig{}
	}
	return gigs, nil
}
