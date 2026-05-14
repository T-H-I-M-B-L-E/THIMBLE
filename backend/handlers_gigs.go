package main

import (
	"context"

	"github.com/gofiber/fiber/v2"
)

func handleListGigs(c *fiber.Ctx) error {
	rows, err := dbPool.Query(context.Background(),
		"SELECT id, title, description, location, payment, posted_by, posted_by_role, posted_by_avatar, applications, created_at FROM gigs ORDER BY created_at DESC")
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch gigs"})
	}
	defer rows.Close()

	var gigs []Gig
	for rows.Next() {
		var g Gig
		if err := rows.Scan(&g.Id, &g.Title, &g.Description, &g.Location, &g.Payment, &g.PostedBy, &g.PostedByRole, &g.PostedByAvatar, &g.Applications, &g.CreatedAt); err == nil {
			gigs = append(gigs, g)
		}
	}
	if gigs == nil {
		gigs = []Gig{}
	}
	return c.JSON(gigs)
}
