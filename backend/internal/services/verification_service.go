package services

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"

	"chat-app/internal/models"
	"chat-app/internal/repositories"
)

// GetMyVerification returns the caller's most recent application or nil
// if they've never submitted one.
func GetMyVerification(ctx context.Context, userID string) (*models.VerificationRequest, *ServiceError) {
	if userID == "" {
		return nil, NewError(401, "unauthorized", "unauthorized")
	}
	r, err := repositories.GetLatestVerificationRequest(ctx, userID)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to load request")
	}
	return r, nil
}

type SubmitVerificationInput struct {
	FullName      string
	Email         string
	IDDocumentURL string
	Reason        string
}

func SubmitVerification(ctx context.Context, userID string, in SubmitVerificationInput) (int64, *ServiceError) {
	if userID == "" {
		return 0, NewError(401, "unauthorized", "unauthorized")
	}

	in.FullName = strings.TrimSpace(in.FullName)
	in.Email = strings.TrimSpace(in.Email)
	in.IDDocumentURL = strings.TrimSpace(in.IDDocumentURL)
	in.Reason = strings.TrimSpace(in.Reason)

	if in.FullName == "" || in.Email == "" || in.IDDocumentURL == "" || in.Reason == "" {
		return 0, NewError(400, "missing_fields", "all fields are required")
	}

	if repositories.CountPendingVerificationsForUser(ctx, userID) > 0 {
		return 0, NewError(409, "pending_exists", "you already have a pending verification request")
	}
	if repositories.IsUserBadgeVerified(ctx, userID) {
		return 0, NewError(409, "already_verified", "you already have a verified badge")
	}

	id, err := repositories.InsertVerificationRequest(ctx, userID, in.FullName, in.Email, in.IDDocumentURL, in.Reason)
	if err != nil {
		return 0, NewError(500, "db_failed", "failed to submit request")
	}
	return id, nil
}

func AdminListVerificationRequests(ctx context.Context, status string) ([]models.VerificationRequest, *ServiceError) {
	out, err := repositories.ListVerificationRequests(ctx, status)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to load requests")
	}
	return out, nil
}

// AdminReviewResult contains the new status plus the soon-to-be-deleted
// document URL. The caller (Next.js proxy) deletes the object from R2.
type AdminReviewResult struct {
	Status          string
	DeletedDocument string
}

func AdminReviewVerification(ctx context.Context, id, action, adminNote, adminID string) (*AdminReviewResult, *ServiceError) {
	if action != "approve" && action != "reject" {
		return nil, NewError(400, "invalid_action", "action must be 'approve' or 'reject'")
	}

	target, err := repositories.GetVerificationReviewTarget(ctx, id)
	if err == pgx.ErrNoRows {
		return nil, NewError(404, "not_found", "request not found")
	}
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to load request")
	}
	if target.Status != "pending" {
		return nil, NewError(409, "not_pending", "request is not pending")
	}

	newStatus := "approved"
	if action == "reject" {
		newStatus = "rejected"
	}

	if err := repositories.ReviewVerificationRequest(ctx, id, newStatus, adminNote, adminID, target.UserID); err != nil {
		return nil, NewError(500, "db_failed", "failed to update request")
	}

	targetName := repositories.GetUserFullName(ctx, target.UserID)
	repositories.WriteAuditLog(ctx, adminID, "verification_"+newStatus, target.UserID, targetName, adminNote)

	return &AdminReviewResult{Status: newStatus, DeletedDocument: target.IDDocumentURL}, nil
}
