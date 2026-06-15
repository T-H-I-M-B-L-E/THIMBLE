---
name: pwa-reminder
description: PWA conversion is the final step before launch — remind user when app is feature-complete
metadata:
  type: project
---

Convert THIMBLE to a PWA as the very last task before launch.

**Why:** User wants it done only when the app is fully complete — it's the final polish step.

**How to apply:** When the app feels feature-complete (messaging, calling, gigs, feed, auth, profiles all working and stable), remind the user: "Hey, the app is looking solid — ready to convert to a PWA now?"

**What's needed when the time comes:**
- `next-pwa` package (~1 hr)
- `/public/manifest.json` with name, colors, icons
- Icons at 192×192 and 512×512 (generate from existing SVG)
- Service worker for offline caching
- Push notifications via Web Push API + VAPID keys (~1-2 days)
