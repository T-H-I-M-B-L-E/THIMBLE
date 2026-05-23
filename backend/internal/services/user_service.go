package services

import (
	"context"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"chat-app/internal/models"
	"chat-app/internal/repositories"
	"chat-app/internal/utils"
)

// UserProfilePatch is what users can change via PATCH /users/:id.
// Optional fields are pointers so absent and zero values are
// distinguishable (only present pointers are written).
type UserProfilePatch struct {
	Role     *string
	Bio      *string
	Avatar   *string
	Website  *string
	Location *string
	Username *string
}

// UpdateUserProfile applies the patch. Username updates run first
// because they require validation and a cooldown check that returns
// specific error codes the modal listens for.
func UpdateUserProfile(ctx context.Context, callerID, id string, patch UserProfilePatch) *ServiceError {
	if callerID != id {
		return NewError(403, "forbidden", "forbidden")
	}

	if patch.Username != nil {
		newName := strings.ToLower(strings.TrimSpace(*patch.Username))
		if !utils.UsernameRe.MatchString(newName) {
			return NewError(400, "invalid_username",
				"Usernames are 3–30 characters: lowercase letters, numbers, underscore, or dot. Must start and end with a letter or number.")
		}

		currentName, changedAt, err := repositories.GetUsernameAndChangedAt(ctx, id)
		if err != nil {
			log.Printf("Failed to read username for %s: %v", id, err)
			return NewError(500, "db_read_failed", "failed to update profile")
		}

		// Treat no-op as success so the modal can submit other fields
		// without tripping the cooldown.
		if newName != currentName {
			if changedAt != nil {
				nextAllowed := changedAt.Add(utils.UsernameCooldownDays * 24 * time.Hour)
				if time.Now().Before(nextAllowed) {
					return NewError(409, "username_cooldown",
						"You can only change your username once every 30 days.")
				}
			}

			if err := repositories.UpdateUsername(ctx, id, newName); err != nil {
				var pgErr *pgconn.PgError
				if errors.As(err, &pgErr) && pgErr.Code == "23505" {
					return NewError(409, "username_taken", "That username is already taken.")
				}
				log.Printf("Failed to update username for %s: %v", id, err)
				return NewError(500, "db_write_failed", "failed to update profile")
			}
		}
	}

	if patch.Role != nil || patch.Bio != nil || patch.Avatar != nil || patch.Website != nil || patch.Location != nil {
		if err := repositories.UpdateProfileFields(ctx, id, patch.Role, patch.Bio, patch.Avatar, patch.Website, patch.Location); err != nil {
			log.Printf("Failed to update user %s: %v", id, err)
			return NewError(500, "db_write_failed", "failed to update profile")
		}
	}

	return nil
}

func GetUserProfile(ctx context.Context, id string) (*models.User, *ServiceError) {
	u, err := repositories.FindUserByID(ctx, id)
	if err != nil {
		return nil, NewError(404, "not_found", "user not found")
	}
	return u, nil
}

func SuggestUsers(ctx context.Context, userId string) ([]repositories.SuggestedUser, *ServiceError) {
	users, err := repositories.SuggestUsers(ctx, userId)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch suggestions")
	}
	return users, nil
}

func ListAllUsers(ctx context.Context) ([]repositories.UserSummary, *ServiceError) {
	users, err := repositories.ListAllUsers(ctx)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch users")
	}
	return users, nil
}

// MakeAdmin elevates a user to admin. Available only when ADMIN_BOOTSTRAP_SECRET
// is set; treat the secret check as the auth layer.
func MakeAdmin(ctx context.Context, email string) *ServiceError {
	rows, err := repositories.PromoteToAdmin(ctx, email)
	if err != nil || rows == 0 {
		return NewError(404, "not_found", "user not found")
	}
	return nil
}
