package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"chat-app/internal/models"
	"chat-app/internal/repositories"
)

// Valid placements an admin can pick. Anything outside this set is
// rejected at create/update time.
var validPlacements = map[string]bool{
	"feed":    true,
	"banner":  true,
	"sidebar": true,
}

// AdInput is the shape both Create and Update accept from handlers.
// Pointers + the Patch flag let one type cover both flows: Create
// requires every field, Update applies only the non-nil ones.
type AdInput struct {
	Title       *string    `json:"title"`
	SponsorName *string    `json:"sponsorName"`
	Description *string    `json:"description"`
	ImageUrl    *string    `json:"imageUrl"`
	VideoUrl    *string    `json:"videoUrl"`
	RedirectUrl *string    `json:"redirectUrl"`
	Placement   *string    `json:"placement"`
	IsActive    *bool      `json:"isActive"`
	StartDate   *time.Time `json:"startDate"`
	EndDate     *time.Time `json:"endDate"`
}

func (in AdInput) validateForCreate() *ServiceError {
	if in.Title == nil || strings.TrimSpace(*in.Title) == "" {
		return NewError(400, "missing_title", "title is required")
	}
	if in.SponsorName == nil || strings.TrimSpace(*in.SponsorName) == "" {
		return NewError(400, "missing_sponsor", "sponsorName is required")
	}
	if in.ImageUrl == nil || strings.TrimSpace(*in.ImageUrl) == "" {
		return NewError(400, "missing_image", "imageUrl is required")
	}
	if in.RedirectUrl == nil || strings.TrimSpace(*in.RedirectUrl) == "" {
		return NewError(400, "missing_redirect", "redirectUrl is required")
	}
	if u := strings.TrimSpace(*in.RedirectUrl); !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
		return NewError(400, "bad_redirect", "redirectUrl must start with http:// or https://")
	}
	if in.StartDate == nil || in.EndDate == nil {
		return NewError(400, "missing_dates", "startDate and endDate are required")
	}
	if !in.EndDate.After(*in.StartDate) {
		return NewError(400, "bad_window", "endDate must be after startDate")
	}
	placement := "feed"
	if in.Placement != nil {
		placement = *in.Placement
	}
	if !validPlacements[placement] {
		return NewError(400, "bad_placement", "placement must be one of feed, banner, sidebar")
	}
	return nil
}

func (in AdInput) validateForUpdate() *ServiceError {
	if in.Placement != nil && !validPlacements[*in.Placement] {
		return NewError(400, "bad_placement", "placement must be one of feed, banner, sidebar")
	}
	if in.StartDate != nil && in.EndDate != nil && !in.EndDate.After(*in.StartDate) {
		return NewError(400, "bad_window", "endDate must be after startDate")
	}
	return nil
}

func CreateAd(ctx context.Context, callerID string, in AdInput) (*models.Ad, *ServiceError) {
	if verr := in.validateForCreate(); verr != nil {
		return nil, verr
	}
	placement := "feed"
	if in.Placement != nil {
		placement = *in.Placement
	}
	video := ""
	if in.VideoUrl != nil {
		video = strings.TrimSpace(*in.VideoUrl)
	}
	desc := ""
	if in.Description != nil {
		desc = *in.Description
	}
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	ad, err := repositories.CreateAd(ctx, repositories.AdCreateInput{
		Id:          uuid.NewString(),
		Title:       strings.TrimSpace(*in.Title),
		SponsorName: strings.TrimSpace(*in.SponsorName),
		Description: desc,
		ImageUrl:    strings.TrimSpace(*in.ImageUrl),
		VideoUrl:    video,
		RedirectUrl: strings.TrimSpace(*in.RedirectUrl),
		Placement:   placement,
		IsActive:    isActive,
		StartDate:   *in.StartDate,
		EndDate:     *in.EndDate,
		CreatedBy:   callerID,
	})
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to create ad")
	}
	return ad, nil
}

func ListAds(ctx context.Context) ([]models.Ad, *ServiceError) {
	ads, err := repositories.ListAdsAdmin(ctx)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch ads")
	}
	return ads, nil
}

func GetAd(ctx context.Context, id string) (*models.Ad, *ServiceError) {
	ad, err := repositories.GetAdByID(ctx, id)
	if err != nil {
		if errors.Is(err, repositories.ErrAdNotFound) {
			return nil, NewError(404, "not_found", "ad not found")
		}
		return nil, NewError(500, "db_failed", "failed to fetch ad")
	}
	return ad, nil
}

func UpdateAd(ctx context.Context, id string, in AdInput) (*models.Ad, *ServiceError) {
	if verr := in.validateForUpdate(); verr != nil {
		return nil, verr
	}
	ad, err := repositories.UpdateAd(ctx, id, repositories.AdPatch{
		Title:       in.Title,
		SponsorName: in.SponsorName,
		Description: in.Description,
		ImageUrl:    in.ImageUrl,
		VideoUrl:    in.VideoUrl,
		RedirectUrl: in.RedirectUrl,
		Placement:   in.Placement,
		IsActive:    in.IsActive,
		StartDate:   in.StartDate,
		EndDate:     in.EndDate,
	})
	if err != nil {
		if errors.Is(err, repositories.ErrAdNotFound) {
			return nil, NewError(404, "not_found", "ad not found")
		}
		return nil, NewError(500, "db_failed", "failed to update ad")
	}
	return ad, nil
}

func DeleteAd(ctx context.Context, id string) *ServiceError {
	if err := repositories.DeleteAd(ctx, id); err != nil {
		if errors.Is(err, repositories.ErrAdNotFound) {
			return NewError(404, "not_found", "ad not found")
		}
		return NewError(500, "db_failed", "failed to delete ad")
	}
	return nil
}

func ToggleAd(ctx context.Context, id string) (*models.Ad, *ServiceError) {
	ad, err := repositories.ToggleAdActive(ctx, id)
	if err != nil {
		if errors.Is(err, repositories.ErrAdNotFound) {
			return nil, NewError(404, "not_found", "ad not found")
		}
		return nil, NewError(500, "db_failed", "failed to toggle ad")
	}
	return ad, nil
}

// PickAdsForFeed returns up to `n` ads ready to be interleaved into a
// feed response. Ordered by least-recently-served so the same ad
// doesn't repeat back-to-back. Side-effect: stamps last_served_at on
// each chosen row.
func PickAdsForFeed(ctx context.Context, n int) ([]models.Ad, error) {
	if n <= 0 {
		return nil, nil
	}
	ads, err := repositories.ListActiveForPlacement(ctx, "feed", n)
	if err != nil {
		return nil, err
	}
	for i := range ads {
		repositories.MarkServed(ctx, ads[i].Id)
	}
	return ads, nil
}

// RecordAdClick is called by the user-facing tracking endpoint. We
// always count the click, then 200 with the redirect URL so the
// frontend can navigate.
func RecordAdClick(ctx context.Context, id string) (*models.Ad, *ServiceError) {
	ad, gerr := GetAd(ctx, id)
	if gerr != nil {
		return nil, gerr
	}
	if err := repositories.RecordClick(ctx, id); err != nil {
		// Tracking failure shouldn't break the user flow — log silently
		// and still return the redirect.
		_ = err
	}
	return ad, nil
}

func RecordAdImpression(ctx context.Context, adID, userID string) *ServiceError {
	if err := repositories.RecordImpression(ctx, adID, userID); err != nil {
		// Same posture: never bubble tracking failures up to the user.
		_ = err
	}
	return nil
}
