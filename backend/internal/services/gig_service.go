package services

import (
	"context"

	"chat-app/internal/models"
	"chat-app/internal/repositories"
)

func ListGigs(ctx context.Context) ([]models.Gig, *ServiceError) {
	gigs, err := repositories.ListGigs(ctx)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch gigs")
	}
	return gigs, nil
}
