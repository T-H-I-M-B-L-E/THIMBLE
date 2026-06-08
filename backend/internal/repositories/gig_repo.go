package repositories

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"chat-app/internal/db"
	"chat-app/internal/models"
)

var ErrAlreadyApplied = errors.New("already applied")
var ErrGigNotFound = errors.New("gig not found")

// GigInput is what the create endpoint accepts.
type GigInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Location    string `json:"location"`
	Payment     string `json:"payment"`
	RoleWanted  string `json:"roleWanted"`
}

// CreateGig inserts a new gig posted by the caller.
func CreateGig(ctx context.Context, input GigInput, posterID, posterName, posterRole, posterAvatar string) (models.Gig, error) {
	var g models.Gig
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO gigs (title, description, location, payment, role_wanted,
		                  posted_by, posted_by_role, posted_by_avatar, poster_id, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open')
		RETURNING id, title, description, location, payment,
		          COALESCE(role_wanted,''), COALESCE(status,'open'),
		          posted_by, posted_by_role, posted_by_avatar,
		          COALESCE(poster_id,''), applications, created_at
	`, input.Title, input.Description, input.Location, input.Payment, input.RoleWanted,
		posterName, posterRole, posterAvatar, posterID,
	).Scan(&g.Id, &g.Title, &g.Description, &g.Location, &g.Payment,
		&g.RoleWanted, &g.Status,
		&g.PostedBy, &g.PostedByRole, &g.PostedByAvatar, &g.PosterID,
		&g.Applications, &g.CreatedAt)
	if err != nil {
		return g, err
	}
	g.IsOwner = true
	return g, nil
}

// CloseGig marks the gig as closed. Only the poster can close it.
func CloseGig(ctx context.Context, gigID int, posterID string) error {
	tag, err := db.Pool.Exec(ctx,
		"UPDATE gigs SET status = 'closed' WHERE id = $1 AND poster_id = $2",
		gigID, posterID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("gig not found or not owned by you")
	}
	return nil
}

// DeleteGig permanently removes a gig. Only the poster can delete.
func DeleteGig(ctx context.Context, gigID int, posterID string) error {
	tag, err := db.Pool.Exec(ctx,
		"DELETE FROM gigs WHERE id = $1 AND poster_id = $2",
		gigID, posterID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("gig not found or not owned by you")
	}
	return nil
}

// GigOwner returns the poster_id for a gig, or ErrGigNotFound if it doesn't exist.
func GigOwner(ctx context.Context, gigID int) (string, error) {
	var owner string
	if err := db.Pool.QueryRow(ctx,
		"SELECT COALESCE(poster_id,'') FROM gigs WHERE id = $1", gigID).Scan(&owner); err != nil {
		return "", ErrGigNotFound
	}
	return owner, nil
}

// ListApplicants returns everyone who applied to a gig. Only the poster can call.
func ListApplicants(ctx context.Context, gigID int, posterID string) ([]models.GigApplicant, error) {
	owner, err := GigOwner(ctx, gigID)
	if err != nil {
		return nil, err
	}
	if owner != posterID {
		return nil, errors.New("forbidden")
	}
	rows, err := db.Pool.Query(ctx, `
		SELECT ga.user_id,
		       COALESCE(u.full_name, ga.applicant_name, ''),
		       COALESCE(u.avatar_url, ga.applicant_avatar, ''),
		       COALESCE(u.role, ga.applicant_role, ''),
		       ga.created_at,
		       ga.status
		FROM gig_applications ga
		LEFT JOIN users u ON u.id = ga.user_id
		WHERE ga.gig_id = $1
		ORDER BY ga.created_at DESC
	`, gigID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.GigApplicant
	for rows.Next() {
		var a models.GigApplicant
		if err := rows.Scan(&a.UserID, &a.Name, &a.Avatar, &a.Role, &a.AppliedAt, &a.Status); err == nil {
			out = append(out, a)
		}
	}
	if out == nil {
		out = []models.GigApplicant{}
	}
	return out, nil
}

var validApplicantStatuses = map[string]bool{
	"pending": true, "shortlisted": true, "hired": true, "rejected": true,
}

// UpdateApplicantStatus lets the poster change the status of a single applicant.
func UpdateApplicantStatus(ctx context.Context, gigID int, applicantUserID, posterID, status string) error {
	if !validApplicantStatuses[status] {
		return errors.New("invalid status")
	}
	owner, err := GigOwner(ctx, gigID)
	if err != nil {
		return err
	}
	if owner != posterID {
		return errors.New("forbidden")
	}
	_, err = db.Pool.Exec(ctx,
		`UPDATE gig_applications SET status = $1 WHERE gig_id = $2 AND user_id = $3`,
		status, gigID, applicantUserID)
	return err
}

func ListGigs(ctx context.Context) ([]models.Gig, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, title, description, location, payment,
		       COALESCE(role_wanted,''), COALESCE(status,'open'),
		       posted_by, posted_by_role, posted_by_avatar,
		       COALESCE(poster_id,''), applications, created_at
		FROM gigs
		WHERE COALESCE(status,'open') = 'open'
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var gigs []models.Gig
	for rows.Next() {
		var g models.Gig
		if err := rows.Scan(&g.Id, &g.Title, &g.Description, &g.Location, &g.Payment,
			&g.RoleWanted, &g.Status,
			&g.PostedBy, &g.PostedByRole, &g.PostedByAvatar,
			&g.PosterID, &g.Applications, &g.CreatedAt); err == nil {
			gigs = append(gigs, g)
		}
	}
	if gigs == nil {
		gigs = []models.Gig{}
	}
	return gigs, nil
}

func ListAppliedGigIDs(ctx context.Context, userID string) (map[int]bool, error) {
	rows, err := db.Pool.Query(ctx,
		"SELECT gig_id FROM gig_applications WHERE user_id = $1", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int]bool{}
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err == nil {
			out[id] = true
		}
	}
	return out, nil
}

func ApplyToGig(ctx context.Context, gigID int, userID, userName, userAvatar, userRole string) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`INSERT INTO gig_applications (gig_id, user_id, applicant_name, applicant_avatar, applicant_role)
		 VALUES ($1, $2, $3, $4, $5)`,
		gigID, userID, userName, userAvatar, userRole)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			if pgErr.Code == "23505" {
				return ErrAlreadyApplied
			}
			if pgErr.Code == "23503" {
				return ErrGigNotFound
			}
		}
		return err
	}

	tag, err := tx.Exec(ctx,
		"UPDATE gigs SET applications = applications + 1 WHERE id = $1", gigID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrGigNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		if errors.Is(err, pgx.ErrTxClosed) {
			return nil
		}
		return err
	}
	return nil
}
