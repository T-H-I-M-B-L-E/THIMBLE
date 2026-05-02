# THIMBLE

THIMBLE is a fashion creative platform built with:

- Next.js frontend in the repo root
- Go backend in `backend/`
- PostgreSQL for backend data
- Clerk for authentication
- Uploadcare for image uploads

## Repo Structure

```text
THIMBLE/
├── app/                  # Next.js app router frontend
├── components/           # UI components
├── hooks/                # Frontend hooks
├── lib/                  # Frontend shared helpers
├── backend/              # Go API + WebSocket server
├── package.json          # Frontend scripts
└── README.md
```

## How To Think About Hosting

Keep **one GitHub repo**, but deploy **two separate services**:

- Frontend service: Vercel
- Backend service: Railway

That means:

- you still edit frontend and backend together in one codebase
- you still push to one GitHub repo
- Vercel deploys the frontend
- Railway deploys the backend

You do **not** need two repos right now.

## Local Development

Frontend:

```bash
pnpm install
pnpm dev
```

Backend:

```bash
cd backend
go run main.go
```

## Environment Variables

Use the example files as templates:

- frontend example: `.env.example`
- backend example: `backend/.env.example`

## Deploy Separately From The Same Repo

### Frontend on Vercel

1. Push this repo to GitHub.
2. Go to Vercel.
3. Click `Add New Project`.
4. Import this GitHub repo.
5. Leave the **Root Directory** as the repo root.
6. Vercel should detect Next.js automatically.
7. Add the frontend environment variables from `.env.example`.
8. Deploy.

Your frontend will become something like:

```text
https://thimble.vercel.app
```

### Backend on Railway

1. Go to Railway.
2. Click `New Project`.
3. Choose `Deploy from GitHub Repo`.
4. Select this same repo.
5. In Railway service settings, set the **Root Directory** to:

```text
backend
```

6. Add the backend environment variables from `backend/.env.example`.
7. Add a PostgreSQL service in Railway, or connect an external Postgres DB.
8. Deploy.

Your backend will become something like:

```text
https://thimble-api.up.railway.app
```

## Connect Frontend To Backend

After Railway gives you the backend URL, add these values in Vercel:

```env
NEXT_PUBLIC_API_BASE_URL=https://thimble-api.up.railway.app
NEXT_PUBLIC_WS_URL=wss://thimble-api.up.railway.app
```

Then redeploy the frontend.

## Recommended Deployment Order

Do it in this order:

1. Deploy backend on Railway
2. Get backend URL
3. Add backend URL to Vercel env vars
4. Deploy frontend on Vercel
5. Test signup, login, onboarding, feed, gigs, and chat

## Important Notes

### 1. Frontend can still work without the backend URL

The app now has fallback behavior for demo use in parts of the UI.
If `NEXT_PUBLIC_API_BASE_URL` is not set, some frontend pages can still render using local fallback data.

### 2. Clerk stays on the frontend side

Clerk is used in the Next.js app. Set Clerk keys in Vercel for the frontend deployment.

### 3. Backend needs a real database in production

The Go service uses Postgres for:

- posts
- gigs
- messages

So Railway backend deployment is not complete until `DATABASE_URL` is set.

## Suggested Production Setup

### Frontend

- Host: Vercel
- Root directory: repo root

### Backend

- Host: Railway
- Root directory: `backend`

### Database

- Railway Postgres, Neon, or Supabase Postgres

### Images

- Uploadcare

## Beginner Workflow Going Forward

When you make changes:

- edit frontend files in `app/`, `components/`, `hooks/`, `lib/`
- edit backend files in `backend/`
- commit both together if the feature touches both
- push once to GitHub

Then:

- Vercel redeploys frontend
- Railway redeploys backend

## Checklist Before Public Demo

- Clerk keys added in Vercel
- Uploadcare key added in Vercel
- Backend deployed on Railway
- `DATABASE_URL` set for backend
- `CORS_ALLOWED_ORIGINS` set for backend
- `NEXT_PUBLIC_API_BASE_URL` set in Vercel
- `NEXT_PUBLIC_WS_URL` set in Vercel
- Signup works
- Login works
- Forgot password works
- Onboarding saves correctly
- Feed loads
- Gigs load
- Chat connects
