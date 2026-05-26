package services

import (
	"context"
	"errors"

	"chat-app/internal/models"
	"chat-app/internal/repositories"
)

// ListGigs returns every gig, with HasApplied filled in for callerID
// (empty string for unauthenticated callers — all flags will be false).
func ListGigs(ctx context.Context, callerID string) ([]models.Gig, *ServiceError) {
	gigs, err := repositories.ListGigs(ctx)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch gigs")
	}
	if callerID == "" {
		return gigs, nil
	}
	applied, err := repositories.ListAppliedGigIDs(ctx, callerID)
	if err == nil {
		for i := range gigs {
			if applied[gigs[i].Id] {
				gigs[i].HasApplied = true
			}
		}
	}
	return gigs, nil
}

// ApplyToGig records an application for the caller. Idempotent at the
// API level: a second call returns 200 with already=true rather than
// surfacing the constraint error.
func ApplyToGig(ctx context.Context, gigID int, callerID string) (already bool, _ *ServiceError) {
	if callerID == "" {
		return false, NewError(401, "unauthorized", "sign in to apply")
	}
	if err := repositories.ApplyToGig(ctx, gigID, callerID); err != nil {
		switch {
		case errors.Is(err, repositories.ErrAlreadyApplied):
			return true, nil
		case errors.Is(err, repositories.ErrGigNotFound):
			return false, NewError(404, "not_found", "gig not found")
		default:
			return false, NewError(500, "db_failed", "failed to apply")
		}
	}
	return false, nil
}
