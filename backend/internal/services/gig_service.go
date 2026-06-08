package services

import (
	"context"
	"errors"

	"chat-app/internal/db"
	"chat-app/internal/models"
	"chat-app/internal/repositories"
)

// callerProfile fetches name, role, avatar for a user ID.
func callerProfile(ctx context.Context, userID string) (name, role, avatar string) {
	db.Pool.QueryRow(ctx,
		"SELECT COALESCE(full_name,''), COALESCE(role,''), COALESCE(avatar_url,'') FROM users WHERE id = $1",
		userID).Scan(&name, &role, &avatar)
	return
}

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
			if gigs[i].PosterID == callerID {
				gigs[i].IsOwner = true
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
	owner, ownerErr := repositories.GigOwner(ctx, gigID)
	if ownerErr != nil {
		return false, NewError(404, "not_found", "gig not found")
	}
	if owner == callerID {
		return false, NewError(400, "own_gig", "you can't apply to your own gig")
	}
	name, role, avatar := callerProfile(ctx, callerID)
	if err := repositories.ApplyToGig(ctx, gigID, callerID, name, avatar, role); err != nil {
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

// CreateGig posts a new gig as the caller.
func CreateGig(ctx context.Context, input repositories.GigInput, callerID string) (models.Gig, *ServiceError) {
	if callerID == "" {
		return models.Gig{}, NewError(401, "unauthorized", "sign in to post a gig")
	}
	name, role, avatar := callerProfile(ctx, callerID)
	gig, err := repositories.CreateGig(ctx, input, callerID, name, role, avatar)
	if err != nil {
		return models.Gig{}, NewError(500, "db_failed", "failed to create gig")
	}
	gig.IsOwner = true
	return gig, nil
}

// CloseGig marks a gig as closed. Only the poster can close it.
func CloseGig(ctx context.Context, gigID int, callerID string) *ServiceError {
	if err := repositories.CloseGig(ctx, gigID, callerID); err != nil {
		return NewError(403, "forbidden", err.Error())
	}
	return nil
}

// DeleteGig permanently removes a gig. Only the poster can delete.
func DeleteGig(ctx context.Context, gigID int, callerID string) *ServiceError {
	if err := repositories.DeleteGig(ctx, gigID, callerID); err != nil {
		return NewError(403, "forbidden", err.Error())
	}
	return nil
}

// ListApplicants returns applicants for a gig. Only the poster can view.
func ListApplicants(ctx context.Context, gigID int, callerID string) ([]models.GigApplicant, *ServiceError) {
	applicants, err := repositories.ListApplicants(ctx, gigID, callerID)
	if err != nil {
		if errors.Is(err, repositories.ErrGigNotFound) {
			return nil, NewError(404, "not_found", "gig not found")
		}
		return nil, NewError(403, "forbidden", err.Error())
	}
	return applicants, nil
}

func UpdateApplicantStatus(ctx context.Context, gigID int, applicantUserID, callerID, status string) *ServiceError {
	if err := repositories.UpdateApplicantStatus(ctx, gigID, applicantUserID, callerID, status); err != nil {
		if err.Error() == "invalid status" {
			return NewError(400, "invalid_status", "invalid status value")
		}
		return NewError(403, "forbidden", "not allowed")
	}
	return nil
}
