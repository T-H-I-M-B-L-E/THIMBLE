package repositories

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"chat-app/internal/db"
	"chat-app/internal/models"
)

// ErrAdNotFound is returned by ad-repo functions when the target ad row
// doesn't exist.
var ErrAdNotFound = errors.New("ad not found")

// AdCreateInput is the shape services hand to CreateAd. All fields are
// required except VideoUrl. Defaults are filled at the service layer.
type AdCreateInput struct {
	Id          string
	Title       string
	SponsorName string
	Description string
	ImageUrl    string
	VideoUrl    string
	RedirectUrl string
	Placement   string
	IsActive    bool
	StartDate   time.Time
	EndDate     time.Time
	CreatedBy   string
}

// AdPatch carries optional fields for an UPDATE. Nil pointers leave the
// existing column untouched (COALESCE in SQL).
type AdPatch struct {
	Title       *string
	SponsorName *string
	Description *string
	ImageUrl    *string
	VideoUrl    *string
	RedirectUrl *string
	Placement   *string
	IsActive    *bool
	StartDate   *time.Time
	EndDate     *time.Time
}

func scanAd(row pgx.Row) (*models.Ad, error) {
	var a models.Ad
	var videoUrl *string
	err := row.Scan(
		&a.Id, &a.Title, &a.SponsorName, &a.Description, &a.ImageUrl, &videoUrl,
		&a.RedirectUrl, &a.Placement, &a.IsActive, &a.StartDate, &a.EndDate,
		&a.ClickCount, &a.ImpressionCount, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if videoUrl != nil {
		a.VideoUrl = *videoUrl
	}
	return &a, nil
}

const adSelectCols = `
	id, title, sponsor_name, description, image_url, video_url,
	redirect_url, placement, is_active, start_date, end_date,
	click_count, impression_count, created_at, updated_at`

func CreateAd(ctx context.Context, in AdCreateInput) (*models.Ad, error) {
	row := db.Pool.QueryRow(ctx, `
		INSERT INTO ads (id, title, sponsor_name, description, image_url, video_url,
		                 redirect_url, placement, is_active, start_date, end_date, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING `+adSelectCols,
		in.Id, in.Title, in.SponsorName, in.Description, in.ImageUrl, in.VideoUrl,
		in.RedirectUrl, in.Placement, in.IsActive, in.StartDate, in.EndDate, in.CreatedBy,
	)
	return scanAd(row)
}

func ListAdsAdmin(ctx context.Context) ([]models.Ad, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT `+adSelectCols+` FROM ads ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Ad{}
	for rows.Next() {
		ad, err := scanAd(rows)
		if err == nil {
			out = append(out, *ad)
		}
	}
	return out, nil
}

func GetAdByID(ctx context.Context, id string) (*models.Ad, error) {
	ad, err := scanAd(db.Pool.QueryRow(ctx,
		`SELECT `+adSelectCols+` FROM ads WHERE id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAdNotFound
		}
		return nil, err
	}
	return ad, nil
}

// UpdateAd applies the patch with COALESCE so nil pointers leave fields
// alone. Returns ErrAdNotFound if no row matched.
func UpdateAd(ctx context.Context, id string, p AdPatch) (*models.Ad, error) {
	row := db.Pool.QueryRow(ctx, `
		UPDATE ads SET
			title        = COALESCE($2, title),
			sponsor_name = COALESCE($3, sponsor_name),
			description  = COALESCE($4, description),
			image_url    = COALESCE($5, image_url),
			video_url    = COALESCE($6, video_url),
			redirect_url = COALESCE($7, redirect_url),
			placement    = COALESCE($8, placement),
			is_active    = COALESCE($9, is_active),
			start_date   = COALESCE($10, start_date),
			end_date     = COALESCE($11, end_date),
			updated_at   = NOW()
		WHERE id = $1
		RETURNING `+adSelectCols,
		id, p.Title, p.SponsorName, p.Description, p.ImageUrl, p.VideoUrl,
		p.RedirectUrl, p.Placement, p.IsActive, p.StartDate, p.EndDate,
	)
	ad, err := scanAd(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAdNotFound
		}
		return nil, err
	}
	return ad, nil
}

func DeleteAd(ctx context.Context, id string) error {
	tag, err := db.Pool.Exec(ctx, `DELETE FROM ads WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrAdNotFound
	}
	return nil
}

// ToggleAdActive flips is_active and returns the updated row.
func ToggleAdActive(ctx context.Context, id string) (*models.Ad, error) {
	row := db.Pool.QueryRow(ctx, `
		UPDATE ads SET is_active = NOT is_active, updated_at = NOW()
		WHERE id = $1
		RETURNING `+adSelectCols, id)
	ad, err := scanAd(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAdNotFound
		}
		return nil, err
	}
	return ad, nil
}

// ListActiveForPlacement returns up to `limit` active ads for the given
// placement, ordered "least recently served first" so rotation is
// fair. Empty placement matches "feed" by default.
func ListActiveForPlacement(ctx context.Context, placement string, limit int) ([]models.Ad, error) {
	if placement == "" {
		placement = "feed"
	}
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	rows, err := db.Pool.Query(ctx, `
		SELECT `+adSelectCols+`
		FROM ads
		WHERE is_active = TRUE
		  AND placement = $1
		  AND start_date <= NOW()
		  AND end_date   >= NOW()
		ORDER BY last_served_at NULLS FIRST, created_at DESC
		LIMIT $2`, placement, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Ad{}
	for rows.Next() {
		ad, err := scanAd(rows)
		if err == nil {
			out = append(out, *ad)
		}
	}
	return out, nil
}

// MarkServed stamps last_served_at = NOW() for an ad. Called after an
// ad is selected for inclusion in a feed response.
func MarkServed(ctx context.Context, id string) {
	db.Pool.Exec(ctx, `UPDATE ads SET last_served_at = NOW() WHERE id = $1`, id)
}

// RecordClick increments click_count atomically. Returns ErrAdNotFound
// if the ad doesn't exist or isn't currently servable (caller policy:
// we still track clicks on paused ads — admins want to see traffic
// landing on disabled creatives — but inactive ad clicks should still
// 404 the redirect at the handler layer).
func RecordClick(ctx context.Context, id string) error {
	tag, err := db.Pool.Exec(ctx,
		`UPDATE ads SET click_count = click_count + 1 WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrAdNotFound
	}
	return nil
}

// RecordImpression increments impression_count if the (ad, user, today)
// triple is unseen. Uses the ad_impressions table for de-dupe so the
// number reflects unique daily impressions, not page renders.
//
// userID may be "" for anonymous callers — in that case dedupe by
// (ad, "anon", today) which is much coarser but stops a single
// anonymous client from inflating the counter on every scroll.
func RecordImpression(ctx context.Context, adID, userID string) error {
	if userID == "" {
		userID = "anon"
	}
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		`INSERT INTO ad_impressions (ad_id, user_id) VALUES ($1, $2)
		 ON CONFLICT (ad_id, user_id, served_on) DO NOTHING`,
		adID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 1 {
		// First impression today — bump the counter.
		if _, err := tx.Exec(ctx,
			`UPDATE ads SET impression_count = impression_count + 1 WHERE id = $1`, adID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
