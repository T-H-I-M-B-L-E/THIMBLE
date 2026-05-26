package repositories

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"chat-app/internal/db"
	"chat-app/internal/models"
)

// ErrAlreadyApplied is returned when a user tries to apply to the same
// gig twice — the unique (gig_id, user_id) constraint catches this.
var ErrAlreadyApplied = errors.New("already applied")

// ErrGigNotFound is returned when the target gig row doesn't exist.
var ErrGigNotFound = errors.New("gig not found")

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

// ListAppliedGigIDs returns the set of gig ids the user has already
// applied to. Used to render disabled "Applied" state in the UI.
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

// ApplyToGig inserts a row in gig_applications and increments the gigs
// counter in a single transaction. Returns ErrAlreadyApplied on the
// unique-constraint clash and ErrGigNotFound if the gig is missing.
func ApplyToGig(ctx context.Context, gigID int, userID string) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		"INSERT INTO gig_applications (gig_id, user_id) VALUES ($1, $2)",
		gigID, userID)
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
		"UPDATE gigs SET applications = applications + 1 WHERE id = $1",
		gigID)
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
