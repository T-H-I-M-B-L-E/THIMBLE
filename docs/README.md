# THIMBLE — App Documentation

THIMBLE is a fashion creative platform that connects designers, models, photographers, manufacturers, and brands. Users build verified profiles, share portfolio work, post and apply for gigs, and communicate in real time.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [Environment Variables](#environment-variables)
5. [Authentication](#authentication)
6. [User Roles & Permissions](#user-roles--permissions)
7. [Features](#features)
   - [Onboarding](#onboarding)
   - [Feed & Posts](#feed--posts)
   - [Gigs Marketplace](#gigs-marketplace)
   - [Messaging](#messaging)
   - [Profiles](#profiles)
8. [Admin System](#admin-system)
9. [API Reference](#api-reference)
10. [Database Schema](#database-schema)
11. [Frontend Architecture](#frontend-architecture)
12. [Testing](#testing)
13. [Deployment](#deployment)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 16 (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS 4, Radix UI primitives, shadcn/ui |
| State management | Zustand 5 with localStorage persistence |
| Animations | Framer Motion 12 |
| Backend | Go 1.26 with Fiber v2 |
| Database | PostgreSQL (pgx/v5 driver) |
| Real-time | WebSocket (gofiber/websocket/v2) |
| Auth | JWT (golang-jwt on Go, jose on Next.js) |
| Email | Resend API |
| Testing | Jest 30 + ts-jest, React Testing Library |
| Deployment | Vercel (frontend), standalone binary / Docker (backend) |

---

## Project Structure

```
THIMBLE/
├── app/                          # Next.js App Router
│   ├── (admin-auth)/             # Admin auth pages (login, splash)
│   ├── admin/                    # Admin dashboard (stats, users, chat)
│   ├── api/                      # Next.js API routes (proxy layer)
│   │   ├── auth/                 # signup, login, logout, me, verify-email, ...
│   │   ├── admin/                # admin stats, users, settings, ws-token, ...
│   │   ├── conversations/        # GET/POST conversations, messages
│   │   └── ws-token/             # Expose WS auth token to frontend
│   ├── auth/                     # Login, signup, forgot-password pages
│   ├── dashboard/[role]/         # Role-based dashboard (feed, gigs, messages, profile)
│   ├── onboarding/               # Multi-step new-user setup
│   └── (public pages)            # explore, feed, profile, upload
│
├── backend/
│   ├── main.go                   # All Go routes, handlers, WebSocket, DB setup
│   ├── schema.sql                # Reference schema
│   ├── auth_test.go              # Go-side auth tests
│   └── go.mod
│
├── components/
│   ├── ui/                       # Radix/shadcn primitives (50+ components)
│   ├── dashboard-layout.tsx
│   ├── sidebar.tsx
│   ├── bottom-nav.tsx
│   ├── feed-view.tsx
│   ├── post-card.tsx
│   ├── create-post-modal.tsx
│   ├── edit-profile-modal.tsx
│   ├── ban-wall.tsx
│   ├── verification-modal.tsx
│   ├── verification-banner.tsx
│   ├── welcome-overlay.tsx
│   └── user-sync.tsx
│
├── hooks/
│   ├── use-auth.ts               # Current user fetch + polling
│   ├── use-socket.ts             # WebSocket management
│   ├── use-conversations.ts      # Conversation list & message history
│   ├── use-mobile.ts             # Viewport detection
│   └── use-toast.ts
│
├── lib/
│   ├── store.ts                  # Zustand global store
│   ├── jwt-middleware.ts         # JWT verification (Next.js side)
│   ├── platform.ts               # URL helpers, routing helpers
│   ├── upload.ts                 # File upload helper
│   ├── theme-context.tsx         # Dark/light mode
│   └── utils.ts                  # cn() class helper
│
├── __tests__/                    # Jest test suite
├── middleware.ts                 # Next.js route protection
├── docs/
│   ├── README.md                 # This file
│   └── messaging.md              # Detailed messaging architecture
└── railpack.json
```

---

## Getting Started

### Prerequisites

- Node.js 20+ and pnpm
- Go 1.22+
- PostgreSQL 15+

### 1. Clone and install

```bash
git clone <repo>
cd THIMBLE
pnpm install
```

### 2. Configure environment

Copy the required variables (see [Environment Variables](#environment-variables)) into `.env.local` (frontend) and set the corresponding shell variables for the backend.

### 3. Start the Go backend

```bash
cd backend
go run main.go
# Starts on :8080 by default
# Auto-creates all database tables on first run
```

### 4. Start the Next.js frontend

```bash
pnpm dev
# Starts on :3000
```

### 5. Bootstrap the first admin (one-time)

```bash
curl -X POST http://localhost:8080/auth/make-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","secret":"<ADMIN_BOOTSTRAP_SECRET>"}'
```

---

## Environment Variables

### Frontend (`.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Go backend base URL, e.g. `http://localhost:8080` |
| `JWT_SECRET` | Must match the backend secret |

### Backend

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signs all user JWT tokens |
| `RESEND_API_KEY` | Email delivery via Resend |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins |
| `ADMIN_BOOTSTRAP_SECRET` | One-time secret for `POST /auth/make-admin` |
| `GITHUB_WEBHOOK_SECRET` | Validates GitHub push webhook signatures |
| `ENVIRONMENT` | `production` sets Secure flag on cookies |
| `PORT` | Server port (default `8080`) |

---

## Authentication

### Sign-up flow

```
POST /auth/signup
  → Hash password (bcrypt)
  → Store pending signup
  → Send 6-digit code via Resend email
  → Return { message: "verification email sent" }

POST /auth/verify-email  { email, code }
  → Validate code (10-min expiry)
  → Create user row
  → Generate 7-day JWT
  → Set auth_token httpOnly cookie
  → Return { user, token }
```

### Login flow

```
POST /auth/login  { email, password }
  → bcrypt.CompareHashAndPassword
  → Check is_banned + banned_until (403 if active ban)
  → Record last_login_at, increment total_logins
  → Generate JWT
  → Set auth_token httpOnly cookie
  → Return { user, token }
```

### Password reset

```
POST /auth/forgot-password  { email }
  → Generate 6-digit reset code, email it (10-min expiry)

POST /auth/reset-password  { email, code, newPassword }
  → Validate code
  → bcrypt new password, update users table
```

### JWT

- Issued and validated by the Go backend
- Payload: `userId`, `email`, `exp`
- Signed with `JWT_SECRET` (same value on both sides)
- Accepted from:
  - `Authorization: Bearer <token>` header
  - `auth_token` httpOnly cookie

### Route protection (Next.js middleware)

`middleware.ts` inspects the `auth_token` cookie before allowing access to:

- `/dashboard/*`
- `/onboarding`
- `/upload`
- `/explore`
- `/feed`
- `/profile`

Unauthenticated requests redirect to `/auth`.

### Admin authentication

- Stored on a separate `admin_token` cookie
- Admin pages require `is_admin = true` in the `users` table
- The Go `adminAuth` middleware re-checks the database on every request
- WebSocket endpoint `/admin/ws` uses `wsAdminAuth` which does the same DB check

### Ban enforcement

- Banned users receive a `403` response on login with `{ message, bannedUntil }`
- The frontend renders `<BanWall>` showing the message and expiry
- Temporary bans expire automatically; if `banned_until` is in the past the user can log in normally

---

## User Roles & Permissions

Users select one of five roles during onboarding:

| Role | Description |
|---|---|
| `model` | Fashion models seeking work |
| `designer` | Fashion designers showcasing collections |
| `photographer` | Photographers building portfolios |
| `manufacturer` | Manufacturers seeking collaborations |
| `brand` | Brands sourcing talent |

Role is stored in `users.role` and determines:
- Which quick-action shortcuts appear on the dashboard
- What information is highlighted on the profile page

### Verification

| Status | Meaning |
|---|---|
| `unverified` | Default; some features restricted |
| `pending` | User has requested verification |
| `verified` | Admin has approved the account |

Unverified users see a `<VerificationBanner>` and cannot access features like posting gigs or applying to jobs.

---

## Features

### Onboarding

File: `app/onboarding/page.tsx`

New users (those with an empty `role` field) are automatically redirected here. The wizard has 6 steps:

1. **Welcome** — Greeting screen
2. **Role selection** — Choose from the five roles
3. **Profile photo** — Upload via `lib/upload.ts`
4. **Bio** — Short personal description
5. **Social links** — Website / social handles
6. **Complete** — Success screen, redirects to dashboard

Each step calls `PATCH /users/:id` on the Go backend to persist progress. On completion, `platform.ts#getPostAuthPath()` routes the user to `/dashboard/[role]`.

---

### Feed & Posts

Files: `components/feed-view.tsx`, `components/post-card.tsx`, `components/create-post-modal.tsx`

The feed displays portfolio images posted by users. Each post shows:
- Author avatar, name, role badge
- Portfolio image
- Description
- Like count
- Tagged collaborators (stored as JSONB)

**Creating a post**: The `<CreatePostModal>` accepts an image upload and description, then calls `POST /api/posts`.

**Liking**: Calls the Go backend to increment `posts.likes`.

**Deleting**: Only the post owner can delete (`DELETE /api/posts/:id`); the backend validates ownership.

---

### Gigs Marketplace

File: `app/dashboard/[role]/gigs/page.tsx`

Users can browse and post short-term collaboration opportunities.

A gig record stores: title, description, location, payment, the poster's name/role/avatar, and an application count.

**Posting a gig**: `POST /api/gigs` (verified users only)  
**Browsing**: `GET /api/gigs` returns all gigs ordered by `created_at DESC`

---

### Messaging

Full detail: [docs/messaging.md](./messaging.md)

**Summary**:

- Conversations are persistent rooms stored in PostgreSQL
- History is loaded via REST (`GET /api/conversations/:id/messages`, last 100 messages)
- New messages are sent and received over WebSocket (`GET /ws`)
- Typing indicators are broadcast over WebSocket without being stored
- The frontend cannot read the httpOnly auth cookie, so it fetches a token from `GET /api/ws-token` before opening the socket

Key hooks:
- `useConversations(userId)` — list and create conversations
- `useMessages(conversationId, userId)` — load history
- `useSocket(url, conversationId, user)` — real-time messages + typing

---

### Profiles

Files: `app/dashboard/[role]/profile/page.tsx`, `components/edit-profile-modal.tsx`

A profile stores:
- `full_name`, `role`, `bio`, `location`, `website`
- `avatar_url`
- `verification_status`
- `followers`, `following`, `posts` counts

Users edit their profile through the `<EditProfileModal>`, which calls `PATCH /users/:id`.

---

## Admin System

Access: `/admin` (requires `is_admin = true`)

### Dashboard (`/admin`)

- **Stats cards**: total users, today's signups, week signups, logins today, total posts, total gigs
- **Verification funnel**: signed up → email verified → pending verification → verified
- **Retention**: users who have returned vs. never logged in again
- **Role breakdown**: count per role
- **7-day signup chart**: bar chart using Recharts
- **Admin accounts table**: all admin users with last login and total login count
- **Audit log**: recent admin actions

### User Management (`/admin/users`)

- Search by name or email
- Filter by role, verification status, admin flag
- **Edit modal**: change role, verification status, grant/revoke admin
- **Ban modal**: select duration (1 hour → permanent), enter a message shown to the user
- **Unban**: removes the ban immediately
- **Delete**: removes the user account permanently

### Settings

Stored as key-value pairs in the `settings` table.

| Key | Description |
|---|---|
| `commit_emails_enabled` | Whether GitHub push events trigger emails to admins |

### Audit Log

Every admin action is recorded in `admin_audit_log`:
- Which admin performed it
- Action type (update, ban, unban, delete, settings)
- Target user name and ID
- Free-text detail string
- Timestamp

### Email Stats

Tracks monthly email usage against a 3,000-message limit, broken down by type (verification, commit notification, etc.).

### Admin Chat

Private team chat at `/admin/chat`. Uses a dedicated WebSocket endpoint (`/admin/ws`) and a separate `admin_chat_messages` table. Only users with `is_admin = true` can connect.

### GitHub Webhook

`POST /webhooks/github` — when code is pushed to `main`/`master`, the backend:
1. Verifies the HMAC-SHA256 signature
2. Checks `commit_emails_enabled` in settings
3. Sends a notification email to all admin users via Resend

---

## API Reference

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | — | Begin signup; sends verification email |
| POST | `/auth/verify-email` | — | Verify code, create user, return JWT |
| POST | `/auth/login` | — | Login, return JWT |
| POST | `/auth/logout` | JWT | Clear auth cookie |
| POST | `/auth/forgot-password` | — | Send password reset code |
| POST | `/auth/reset-password` | — | Apply new password |
| POST | `/auth/make-admin` | bootstrap secret | One-time admin promotion |

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/:id` | JWT | Get profile |
| PATCH | `/users/:id` | JWT | Update profile fields |

### Conversations & Messaging

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/conversations` | JWT | List user's conversations |
| POST | `/api/conversations` | JWT | Create conversation |
| GET | `/api/conversations/:id/messages` | JWT | Last 100 messages |
| GET | `/ws?conversationId=&token=` | wsAuth | Real-time WebSocket |

### Posts

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/posts` | JWT | List all posts |
| POST | `/api/posts` | JWT | Create post |
| DELETE | `/api/posts/:id` | JWT | Delete own post |

### Gigs

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/gigs` | JWT | List all gigs |
| POST | `/api/gigs` | JWT + verified | Post a gig |

### Admin

All admin routes require JWT + `is_admin = true`.

| Method | Path | Description |
|---|---|---|
| GET | `/admin/stats` | Platform statistics |
| GET | `/admin/users` | List users (supports search + filter) |
| GET | `/admin/users/:id` | User details |
| PATCH | `/admin/users/:id` | Update role, verification, admin flag |
| POST | `/admin/users/:id/ban` | Ban user |
| DELETE | `/admin/users/:id/ban` | Unban user |
| DELETE | `/admin/users/:id` | Delete user |
| GET | `/admin/audit-log` | Audit log |
| GET | `/admin/settings` | Get settings |
| PATCH | `/admin/settings` | Update settings |
| GET | `/admin/email-stats` | Email usage |
| GET | `/admin/chat/history` | Admin chat history |
| GET | `/admin/ws?token=` | Admin chat WebSocket |
| POST | `/webhooks/github` | GitHub push webhook |

---

## Database Schema

All tables are created automatically by the Go backend on startup.

### `users`

```sql
CREATE TABLE users (
    id                  VARCHAR(36) PRIMARY KEY,
    email               VARCHAR(255) UNIQUE NOT NULL,
    password_hash       VARCHAR(255) NOT NULL,
    full_name           VARCHAR(255) NOT NULL,
    role                VARCHAR(50) DEFAULT 'model',
    avatar_url          VARCHAR(500),
    bio                 TEXT,
    location            VARCHAR(255),
    website             VARCHAR(255),
    verification_status VARCHAR(50) DEFAULT 'unverified',
    is_admin            BOOLEAN DEFAULT FALSE,
    is_banned           BOOLEAN DEFAULT FALSE,
    banned_until        TIMESTAMPTZ,
    ban_message         TEXT,
    followers           INT DEFAULT 0,
    following           INT DEFAULT 0,
    posts               INT DEFAULT 0,
    last_login_at       TIMESTAMPTZ,
    total_logins        INT DEFAULT 0,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
```

### `pending_signups`

Temporary storage while waiting for email verification. Deleted once the user is created.

```sql
CREATE TABLE pending_signups (
    email         TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### `email_verification_codes`

6-digit codes for signup and password reset. Expire after 10 minutes.

```sql
CREATE TABLE email_verification_codes (
    id         SERIAL PRIMARY KEY,
    email      VARCHAR(255) NOT NULL,
    code       VARCHAR(6) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);
```

### `conversations`

```sql
CREATE TABLE conversations (
    id         BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `conversation_participants`

```sql
CREATE TABLE conversation_participants (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    user_name       TEXT NOT NULL DEFAULT '',
    user_avatar     TEXT NOT NULL DEFAULT '',
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);
```

### `conversation_messages`

```sql
CREATE TABLE conversation_messages (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL DEFAULT '',
    content         TEXT NOT NULL,
    timestamp       BIGINT NOT NULL,   -- Unix milliseconds
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### `admin_chat_messages`

```sql
CREATE TABLE admin_chat_messages (
    id         BIGSERIAL PRIMARY KEY,
    user_id    TEXT NOT NULL,
    user_name  TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL,
    timestamp  BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `posts`

```sql
CREATE TABLE posts (
    id            BIGSERIAL PRIMARY KEY,
    user_id       TEXT NOT NULL,
    author_name   TEXT NOT NULL,
    author_avatar TEXT DEFAULT '',
    image_url     TEXT NOT NULL,
    description   TEXT DEFAULT '',
    likes         INT DEFAULT 0,
    tagged_users  JSONB DEFAULT '[]',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### `gigs`

```sql
CREATE TABLE gigs (
    id               BIGSERIAL PRIMARY KEY,
    title            TEXT NOT NULL,
    description      TEXT DEFAULT '',
    location         TEXT DEFAULT '',
    payment          TEXT DEFAULT '',
    posted_by        TEXT NOT NULL,
    posted_by_role   TEXT DEFAULT '',
    posted_by_avatar TEXT DEFAULT '',
    applications     INT DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### `admin_audit_log`

```sql
CREATE TABLE admin_audit_log (
    id          BIGSERIAL PRIMARY KEY,
    admin_id    TEXT NOT NULL,
    action      TEXT NOT NULL,
    target_id   TEXT DEFAULT '',
    target_name TEXT DEFAULT '',
    details     TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### `settings`

Key-value store for platform configuration.

```sql
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

### `email_log`

```sql
CREATE TABLE email_log (
    id         BIGSERIAL PRIMARY KEY,
    type       TEXT NOT NULL,
    recipients INT DEFAULT 1,
    sent_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Frontend Architecture

### Next.js API routes (proxy layer)

The files in `app/api/` are thin proxies — they verify the session cookie, then forward the request to the Go backend using the same token. They contain no business logic. This keeps authentication consistent (the Go backend is always the JWT authority) while letting the browser talk to a same-origin URL.

```
Browser → POST /api/auth/login
  Next.js verifies session (or creates one)
  → POST http://go-backend:8080/auth/login  (Authorization: Bearer <token>)
  ← { user, token }
```

### Zustand store (`lib/store.ts`)

Global client state persisted to `thimble-storage` in `localStorage`. Contains the current user, gigs, and design posts. Used for UI state and optimistic updates; the server is the source of truth for all data.

### `lib/platform.ts` — routing helpers

| Function | Returns |
|---|---|
| `getApiBaseUrl()` | Go backend URL from env |
| `getWebSocketUrl()` | WS URL derived from API base URL |
| `getPostAuthPath(user)` | `/onboarding` if role is empty, else `/dashboard/[role]` |
| `getDashboardFeedPath(role)` | `/dashboard/[role]/feed` |
| `normalizeWebsiteUrl(url)` | Ensures `https://` prefix |

### Custom hooks

| Hook | File | Purpose |
|---|---|---|
| `useAuth()` | `lib/useAuth.ts` | Fetch current user; polls every 30 s; refetch on focus |
| `useConversations(userId)` | `hooks/use-conversations.ts` | Conversation list and creation |
| `useMessages(conversationId, userId)` | `hooks/use-conversations.ts` | Load message history |
| `useSocket(url, conversationId, user)` | `hooks/use-socket.ts` | WebSocket connection, send, typing |
| `useIsMobile()` | `hooks/use-mobile.ts` | Responsive breakpoint detection |

### Route protection

`middleware.ts` runs on every request before the page renders. It reads the `auth_token` cookie and redirects unauthenticated users to `/auth`. Admin paths check the `admin_token` cookie instead.

### Theme

`lib/theme-context.tsx` wraps the app in a `next-themes` provider. Users can toggle dark/light mode; the preference is stored in `localStorage`.

---

## Testing

Test runner: **Jest 30** with `ts-jest`.

```bash
pnpm test          # Run all tests
pnpm test --watch  # Watch mode
```

Tests are in `__tests__/` and split by environment:

| Environment | What it tests |
|---|---|
| `node` | API route handlers, middleware, JWT utilities, platform helpers |
| `jsdom` | React hooks (`useAuth`, `useSocket`) |

Key test files:
- `__tests__/api/auth/` — signup, login, logout, verify-email, forgot-password
- `__tests__/api/admin/` — admin stats, user management
- `__tests__/lib/jwt-middleware.test.ts` — token parsing and validation
- `__tests__/lib/platform.test.ts` — URL and routing helpers
- `__tests__/middleware.test.ts` — route protection logic
- `__tests__/hooks/` — hook behaviour with mocked fetch

The Jose library is mocked in `__mocks__/jose.ts` to keep auth tests fast and deterministic.

---

## Deployment

### Frontend (Vercel)

The Next.js app deploys to Vercel with no custom configuration beyond the environment variables. `@vercel/analytics` is included for usage tracking.

Set these variables in the Vercel project settings:
- `NEXT_PUBLIC_API_BASE_URL` — URL of the deployed Go backend
- `JWT_SECRET` — same value as the backend

### Backend (Go)

The Go backend compiles to a single binary:

```bash
cd backend
go build -o thimble-api .
./thimble-api
```

It can also be run in Docker. On startup it connects to PostgreSQL and runs `CREATE TABLE IF NOT EXISTS` for every table — safe to run on an existing database.

Set these environment variables before starting:
```
DATABASE_URL
JWT_SECRET
RESEND_API_KEY
CORS_ALLOWED_ORIGINS
ENVIRONMENT=production
PORT=8080
```

### Database

Any managed or self-hosted PostgreSQL 14+ instance works. No migrations are needed — the backend creates all tables on first boot.

For production, set `ENVIRONMENT=production` to enable the `Secure` flag on the auth cookie (requires HTTPS).
