# Tvimble — Project Handover

This document covers everything needed to understand, maintain, and continue building Tvimble. It was written at handover time so nothing gets lost.

---

## What is Tvimble

A fashion creative platform connecting Designers, Models, Manufacturers, Photographers, and Fashion Brands in one place. Users can post work, follow each other, message directly, apply to gigs, and get verified.

---

## Stack

| Layer | Technology | Hosted on |
|---|---|---|
| Frontend | Next.js 15 (App Router, TypeScript) | Vercel |
| Backend | Go (Fiber framework) | Fly.io |
| Database | PostgreSQL | Neon (serverless) |
| File storage | Cloudflare R2 | Cloudflare |
| Email | Resend | Resend |
| Video calls | LiveKit | LiveKit Cloud |
| AI (ARIA) | Groq (llama-3.3-70b) | Groq |
| News digest | NewsAPI | NewsAPI |

---

## Accounts you need access to

These are the services the app depends on. You need login access to all of them.

| Service | What it's for | URL |
|---|---|---|
| **Vercel** | Hosts the frontend, manages env vars | vercel.com |
| **Fly.io** | Hosts the Go backend | fly.io |
| **Neon** | PostgreSQL database | neon.tech |
| **Cloudflare** | R2 file storage (avatars, post images, ID docs) | cloudflare.com |
| **Resend** | Transactional emails (signup, reset password, broadcasts) | resend.com |
| **GitHub** | Source code + CI/CD | github.com/T-H-I-M-B-L-E/THIMBLE |
| **Groq** | Powers ARIA (the admin AI) | console.groq.com |
| **LiveKit** | Video/audio calls | livekit.io |
| **NewsAPI** | Fashion news digest emails | newsapi.org |

---

## Monthly costs (approximate)

| Service | Free tier | When you'll need to pay |
|---|---|---|
| Vercel | Free for hobby | When you need team features or exceed bandwidth |
| Fly.io | ~$5–10/month | Already on paid plan (backend server) |
| Neon | 100 compute-hours/month free | ~150–200 daily active users |
| Cloudflare R2 | 10GB storage, 1M requests/month free | When storage exceeds 10GB |
| Resend | 3,000 emails/month free | When you exceed that |
| Groq | Generous free tier | Only if ARIA usage is very heavy |
| LiveKit | Free tier available | When call minutes exceed free limits |
| NewsAPI | 100 requests/day free | Unlikely to hit this |

**The only service currently costing money is Fly.io** (~$5–10/month for the backend server).

---

## Repository structure

```
THIMBLE/
├── app/                    # Next.js frontend (pages, API routes, components)
│   ├── admin/              # Admin dashboard (AI, broadcasts, users, verification)
│   ├── api/                # Next.js API routes (proxies to Go backend)
│   ├── auth/               # Login, signup, password reset
│   ├── feed/               # Main feed
│   ├── gigs/               # Gig board
│   ├── messages/           # Direct messages
│   ├── profile/            # User profiles
│   └── upload/             # Post creation
├── backend/
│   ├── internal/
│   │   ├── config/         # Env var loading
│   │   ├── db/             # Database pool (Neon/pgx)
│   │   ├── handlers/       # HTTP handlers (one file per feature)
│   │   ├── middleware/      # JWT auth, admin check, rate limiting
│   │   ├── models/         # Shared data structs
│   │   ├── repositories/   # All database queries
│   │   ├── services/       # Business logic
│   │   └── metrics/        # In-memory request counters
│   ├── migrations/         # SQL migration files (run automatically on startup)
│   └── main.go             # Server entry point + all routes
├── components/             # Shared React components
├── lib/                    # Shared frontend utilities (auth, API clients, R2)
└── .github/workflows/      # CI (ci.yml) and deploy (fly-deploy.yml)
```

---

## How deploys work

**You never need to deploy manually.** Every push to `main` on GitHub:

1. Runs CI checks (Go build, TypeScript build, Go tests, linting)
2. If CI passes, Fly.io automatically deploys the backend
3. Vercel automatically deploys the frontend

If a deploy fails, check the **Actions** tab on GitHub for CI, and the **Fly dashboard** for backend deploys.

---

## Environment variables

### Vercel (frontend)
Set these in the Vercel dashboard under Project → Settings → Environment Variables:

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Go backend URL (e.g. `https://your-app.fly.dev`) |
| `API_BASE_URL` | Same, for server-side Next.js calls |
| `JWT_SECRET` | Must match the backend JWT secret exactly |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API key |
| `R2_SECRET_ACCESS_KEY` | R2 API secret |
| `R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_URL` | Public CDN URL for R2 (e.g. `https://media.tvimble.tech`) |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | Same as above (used client-side) |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit server URL |
| `ADMIN_SECRET` | Secret for admin login |

### Fly.io (backend)
Set these with `fly secrets set KEY=value`:

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Neon pooler connection string |
| `JWT_SECRET` | Must match Vercel's JWT_SECRET exactly |
| `RESEND_API_KEY` | Resend email API key |
| `GROQ_API_KEY` | Groq API key for ARIA |
| `NEWS_API_KEY` | NewsAPI key for fashion digest |
| `NEON_API_KEY` | Neon API key (for infra dashboard) |
| `NEON_PROJECT_ID` | Neon project ID |
| `LIVEKIT_URL` | LiveKit server URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins |
| `ENVIRONMENT` | Set to `production` |

---

## Database

- **Provider:** Neon (serverless PostgreSQL)
- **Connection:** Uses the `-pooler` endpoint (PgBouncer) for stability under load
- **Migrations:** Run automatically every time the backend starts. SQL files live in `backend/migrations/`. To add a new migration, create `023_your_change.sql` — it runs once and never again.
- **Free tier:** 100 compute-hours/month. The app is configured to let the DB sleep when idle (no traffic = no cost). Comfortable up to ~150 daily active users on free tier.

---

## Features built

### User-facing
- Signup / login / email verification / password reset
- Profile creation with role selection (Designer, Model, Manufacturer, Photographer, Brand)
- Post creation with image upload (Cloudflare R2)
- Feed, likes, comments, saves
- Follow / unfollow
- Direct messaging (WebSocket, real-time)
- Video/audio calls in conversations (LiveKit)
- Gig board — post and apply to opportunities
- Notifications
- Verification badge requests (upload ID, admin reviews)
- Email preferences
- Block / unblock users

### Admin dashboard (`/admin`)
- User management (ban, unban, delete, verify)
- Verification request review (approve/reject with note)
- Broadcast emails to all users
- Banner system (site-wide announcement)
- Ad management
- Audit log
- Infrastructure health dashboard (latency, error rates, DB status)
- **ARIA** — AI assistant that can send emails, manage users, and answer questions about the platform

### Automated background jobs
- Fashion news digest — emails users a curated digest of fashion news daily at 12:00 Nigeria time
- ARIA proactive monitoring — checks for anomalies and can alert the admin
- Infrastructure monitoring — tracks error rates, latency, DB health

---

## The admin AI (ARIA)

ARIA is an AI assistant in the admin dashboard (`/admin/ai`) powered by Groq (llama-3.3-70b).

**What it can do:**
- Answer questions about the platform (user counts, error rates, DB health)
- Send broadcast emails to all users (requires confirmation)
- Send alert emails to the admin
- Ban, unban, or suspend users
- Draft email content

**How it works:**
- Uses Groq's native function-calling API (not fragile string parsing)
- Has a spend guard — won't exceed daily/per-minute Groq limits
- Has an idempotency guard — won't send the same email twice within 60 seconds
- All actions are logged to the audit trail with the admin's ID
- Chat history is persisted in the database

---

## File storage (Cloudflare R2)

- **Avatars and post images** — stored publicly, served via CDN URL
- **Verification documents (ID photos)** — stored in R2 but never exposed publicly. Admin viewing generates a 15-minute signed URL that expires. Raw URL never reaches the browser.
- **Upload flow:** Browser requests a presigned PUT URL from the backend → uploads directly to R2 → stores the public CDN URL in the database

---

## Security notes

- JWT authentication on all protected routes
- Admin routes require both JWT + admin flag in the database
- Authorization lives in the service layer — user identity always comes from the verified JWT, never from query parameters (prevents IDOR attacks)
- Rate limiting: 10 req/min on auth routes, 300 req/min on API routes
- Verification documents served via short-lived signed URLs only
- R2 upload presign validates file type, size (10MB max), and folder

---

## What's left before launch

One remaining task:

**PWA (Progressive Web App)**
Make the app installable on mobile — users can add it to their home screen like a native app. Requires:
- A `manifest.json` file with app name, icons, theme colour
- A service worker (or use `next-pwa` package)
- Icons in various sizes (192x192, 512x512 minimum)

This is a half-day task and the last thing before the app is fully launch-ready.

---

## Common tasks

### Add a new backend route
1. Create a handler in `backend/internal/handlers/`
2. Add business logic in `backend/internal/services/` if needed
3. Add DB queries in `backend/internal/repositories/`
4. Register the route in `backend/main.go` in `registerRoutes()`

### Add a database column or table
1. Create `backend/migrations/0XX_description.sql`
2. Write the SQL (`CREATE TABLE IF NOT EXISTS` or `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
3. Push to main — migrations run automatically on next deploy

### Send a broadcast email
Go to `/admin/broadcasts` or ask ARIA in `/admin/ai`

### Check infrastructure health
Go to `/admin/infra` — shows live error rates, latency, DB ping, recent errors

### Ban a user
Go to `/admin/users`, find the user, click Ban — or ask ARIA

---

## If something breaks

1. Check `/admin/infra` first — it shows if the backend or DB is down
2. Check GitHub Actions for failed CI/deploy
3. Check Fly.io logs: `fly logs -a your-app-name`
4. Check Vercel's function logs in the Vercel dashboard
5. For DB issues, check the Neon dashboard — compute may need to be manually resumed if something went wrong

---

## Contact / credits

Built by a developer who is no longer actively maintaining this project. The codebase is clean, well-structured, and documented. A competent developer should be able to pick it up from this document.
