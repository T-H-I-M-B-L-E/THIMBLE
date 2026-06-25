# TVIMBLE Runbook

This document is for non-engineers on the team. It covers how to check if things are working, how to restart them, and who to call when they're not.

---

## The stack at a glance

| Layer | What it does | Where it lives |
|-------|-------------|----------------|
| Frontend | The website users see | Vercel — auto-deploys on push to `main` |
| Backend API | The server that handles data | Fly.io — `thimble-backend.fly.dev` |
| Database | Stores all user data | Neon (Postgres) — auto-suspends when idle |
| File storage | User uploads (images, videos) | Cloudflare R2 |
| Email | Transactional emails | Resend |

---

## Is the app down?

**Step 1 — Check the status pages first:**
- Vercel: vercel.com/status
- Fly.io: status.flyio.net
- Neon: neon.tech/status

If any of those are red, it's not your fault and there's nothing to do but wait.

**Step 2 — Check the frontend:**
Open `tvimble.tech` in an incognito window. If you see a blank page or error:
- Go to vercel.com → TVIMBLE project → Deployments
- Look for a red failed deployment — click it to see what went wrong
- If the latest deployment is green but the site is down, click "Redeploy" on the last green one

**Step 3 — Check the backend:**
Open `thimble-backend.fly.dev/health` in your browser. You should see `{"ok":true}`.
- If it times out or errors, follow the "Restart the backend" steps below

---

## Restart the backend

You need the Fly CLI installed. If you don't have it:
```
brew install flyctl
flyctl auth login
```

Then to restart:
```
flyctl restart --app thimble-backend
```

To check if it came back up:
```
flyctl status --app thimble-backend
```

Both machines should show `started`. Give it 30 seconds after restarting.

---

## Read the backend logs

If something is broken and you need to see what's happening:
```
flyctl logs --app thimble-backend
```

This streams live logs. Look for lines with `ERROR` or `panic`. Screenshot them and send to the dev.

To see the last 100 lines without streaming:
```
flyctl logs --app thimble-backend -n 100
```

---

## Roll back a bad deploy

**Frontend (Vercel):**
1. Go to vercel.com → TVIMBLE project → Deployments
2. Find the last deployment that was working (before the broken one)
3. Click the three dots `···` next to it → "Redeploy"
4. Done — takes about 60 seconds

**Backend (Fly.io):**
```
flyctl releases --app thimble-backend
```
This lists all past deploys with version numbers. To roll back to a specific version:
```
flyctl deploy --image thimble-backend:deployment-XXXXXXXXX --app thimble-backend
```
Replace `XXXXXXXXX` with the version number from the list.

---

## Check CI (did a push break anything?)

Go to `github.com/T-H-I-M-B-L-E/THIMBLE/actions`

- Green tick = all tests passed, deploy went out
- Red X = something failed, deploy was blocked (this is good — broken code didn't reach users)

Click a red run to see which step failed and send a screenshot to the dev.

---

## Scale the backend up/down

If traffic spikes and the backend is slow:
```
flyctl scale count 3 --app thimble-backend
```
This adds a third machine. To scale back down:
```
flyctl scale count 2 --app thimble-backend
```

Current setup runs 2 machines. Don't go below 1.

---

## Emergency contacts

| Problem | Who to contact |
|---------|---------------|
| App is down and won't restart | Dev (Anjee) |
| Database corrupted or data lost | Dev (Anjee) — do not touch anything |
| Someone reports a security issue | Dev (Anjee) immediately |
| Billing / cost spike on any service | Dev (Anjee) |

**Rule of thumb:** if you're not sure whether to touch something, don't. Screenshot it and send it to the dev instead. The 10 minutes it takes to ask is always less costly than the wrong action.

---

## Services and where to log in

| Service | URL | Who has access |
|---------|-----|---------------|
| Vercel | vercel.com | Both |
| Fly.io | fly.io | Both |
| Neon | console.neon.tech | Dev only |
| Cloudflare | cloudflare.com | Both |
| Resend | resend.com | Both |
| GitHub | github.com/T-H-I-M-B-L-E | Both |

---

## Things to never do

- **Never delete anything from the database directly.** If something needs to be removed, ask the dev to do it through the admin panel.
- **Never share or rotate API keys without telling the dev first.** Keys are wired into multiple services and rotating one breaks others.
- **Never push directly to `main` without the CI passing.** The branch is not protected by default — broken code can go live.
- **Never restart the database.** Neon manages this automatically. If it looks suspended, it will wake up on the first request (takes ~5 seconds).
