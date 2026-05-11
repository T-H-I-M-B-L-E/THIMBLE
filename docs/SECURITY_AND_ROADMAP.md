# T H I M B L E — Security Audit & Development Roadmap

**Prepared by**: Adegbola Anjolaoluwa, Full Stack Developer  
**Date**: May 10, 2026  
**Classification**: Internal

---

## Part 1: Security Vulnerabilities & Gaps

### 🔴 CRITICAL (Fix Immediately)

#### 1. **No Rate Limiting**
**Risk**: Attackers can brute-force passwords, spam verification codes, flood endpoints  
**What's Missing**:
- No per-IP request throttling on `/auth/login`
- No per-email code requests on `/auth/signup` (attacker can spam codes)
- No WebSocket message rate limit
- Admin endpoints have no protection against enumeration attacks

**How to Fix**:
```go
// Add Redis or in-memory rate limiter
// Example: 5 login attempts per minute per IP
// 3 signup codes per email per hour
```

#### 2. **Weak File Upload Validation**
**Risk**: Users could upload malware, execute code, crash the server  
**What's Missing**:
- No file size limit check
- No file type validation (MIME type spoofing)
- No image dimensions check (could cause memory exhaustion)
- Uploaded files may not be scanned for malware
- No antivirus integration

**How to Fix**:
```go
// Validate before upload:
// - Max file size: 10 MB
// - Only JPEG, PNG, WebP allowed
// - Re-check MIME type server-side (not just file extension)
// - Resize images to max 4000x3000 to prevent memory attacks
// - Optional: scan with ClamAV or VirusTotal API
```

#### 3. **No CSRF Protection on State-Changing Routes**
**Risk**: A malicious website could trick a logged-in user into changing their password or banning a member  
**What's Missing**:
- POST/PATCH/DELETE routes don't validate a CSRF token
- Admin endpoints are especially vulnerable

**How to Fix**:
```typescript
// Add CSRF token to every form
// In Next.js: use SameSite=Strict cookies (already there, but verify)
// On backend: validate x-csrf-token header on state changes
```

#### 4. **No Input Sanitization (XSS Risk)**
**Risk**: Attackers could inject malicious JavaScript into posts, bios, or chat messages  
**What's Missing**:
- User inputs (bio, post descriptions, gig titles) are not sanitized
- Chat messages are not HTML-escaped
- Admin ban message is not sanitized

**How to Fix**:
```go
// Before storing to DB, sanitize all text inputs:
input := sanitizeHTML(userInput)  // remove script tags, etc.

// On frontend, use textContent instead of innerHTML:
div.textContent = message.content  // safe
// NOT: div.innerHTML = message.content  // dangerous
```

---

### 🟠 HIGH (Fix This Month)

#### 5. **No Email Domain Verification**
**Risk**: Someone could sign up with a fake email (e.g., `ceo@thimble.tech` without owning it)  
**What's Missing**:
- Verification code is sent but the email itself is not validated
- No check for disposable email services (10minutemail.com, etc.)

**How to Fix**:
```go
// 1. Check email format strictly
// 2. Block known disposable email domains
// 3. Optional: verify DNS MX records exist
// 4. Send confirmation emails from noreply@thimble.tech only
```

#### 6. **No API Versioning**
**Risk**: Breaking changes to the API could crash mobile apps or integrations  
**What's Missing**:
- All routes are unversioned (`/api/conversations`)
- If we change the response format, existing clients break

**How to Fix**:
```
POST /api/v1/auth/login       (current version)
POST /api/v2/auth/login       (future version with changes)
// Keep v1 working for 6+ months during transition
```

#### 7. **No 2FA for Admin Accounts**
**Risk**: A stolen admin password gives full platform access  
**What's Missing**:
- Admin login is just email + password
- No TOTP (authenticator app), SMS, or backup codes

**How to Fix**:
```go
// After password verification, check for 2FA
if user.TwoFAEnabled {
    // send TOTP code or SMS
    // require code before issuing JWT
}
```

#### 8. **No Content Moderation Tooling**
**Risk**: Posts, gigs, and messages could contain spam, harassment, or illegal content  
**What's Missing**:
- No flag/report system for users
- No content review queue for admins
- No automated spam detection

**How to Fix**:
```go
// Add tables:
// - reports (user reports post/message/profile)
// - moderation_queue (items awaiting admin review)
// Add endpoints:
// - POST /api/posts/:id/report
// - GET /admin/moderation/queue
// - PATCH /admin/moderation/:id (approve/reject/delete)
```

#### 9. **Ban Logic Uses Timestamps (Can Fail)**
**Risk**: If server clock is wrong, bans expire early or don't expire  
**What's Missing**:
- Ban expiry relies on `NOW()` function
- If clock drifts, ban logic breaks

**How to Fix**:
```go
// More robust: store ban_expires_at, then:
if user.BannedUntil != null && user.BannedUntil > time.Now() {
    return bannedError
}
// Or use a cron job to auto-delete expired bans
```

#### 10. **Admin Team Chat Has No Encryption**
**Risk**: Admin messages are readable to anyone with database access  
**What's Missing**:
- Messages stored as plain text
- No end-to-end encryption

**How to Fix**:
```go
// Not critical since it's admin-only, but for sensitive discussions:
// - Use TLS in transit (already done)
// - Encrypt messages at rest in DB (optional)
// - Log who accessed the chat for audit
```

---

### 🟡 MEDIUM (Fix Next Quarter)

#### 11. **No Pagination on Message History**
**Risk**: If a conversation has 100k+ messages, loading all 100 could crash the browser or be very slow  
**What's Missing**:
- `GET /api/conversations/:id/messages` returns unlimited (capped at 100 in code, but still)
- No cursor-based pagination for efficient loading

**How to Fix**:
```go
// Current:
// GET /api/conversations/1/messages → returns last 100

// Better:
// GET /api/conversations/1/messages?after=42&limit=20
// Returns 20 messages after id 42
```

#### 12. **No Image Optimization / CDN**
**Risk**: Large images slow down the platform; users on slow connections suffer  
**What's Missing**:
- Images stored at full resolution
- No caching headers set
- No image compression

**How to Fix**:
```
// Use Cloudinary, Imgix, or similar:
// 1. Upload image → service resizes + compresses
// 2. Get back multiple versions (thumbnail, medium, full)
// 3. Store URLs in DB
// 4. Serve right size to right device
```

#### 13. **No Comprehensive Logging**
**Risk**: Can't diagnose issues or detect attacks after the fact  
**What's Missing**:
- No request logging (IP, endpoint, response code, duration)
- No error logging with stack traces
- No security event logging (failed logins, admin actions)

**How to Fix**:
```go
// Add structured logging:
// - All requests logged with timing
// - Errors logged with full context
// - Security events (login, ban, admin action) logged separately
// - Store in centralized log service (e.g., Datadog, Papertrail)
```

#### 14. **No Analytics / Observability**
**Risk**: Can't spot performance problems or usage patterns  
**What's Missing**:
- No response time monitoring
- No database query performance tracking
- No memory usage alerts
- No endpoint popularity data

**How to Fix**:
```
// Integrate monitoring:
// - Prometheus for metrics collection
// - Grafana for dashboards (response times, error rates)
// - Alert if response time > 500ms or errors > 1%
```

---

### 🔵 LOW (Nice to Have, Plan for Next Year)

#### 15. **No WebSocket Reconnection Logic**
- If connection drops, user has to refresh
- Could auto-reconnect with exponential backoff

#### 16. **No Search Functionality**
- Users can't search for members by name/skills
- Can't search gigs or posts by keyword

#### 17. **No Analytics for Members**
- Users can't see who viewed their profile
- No post engagement metrics

#### 18. **No Mobile App**
- Currently web-only
- Native iOS/Android app would improve engagement

---

## Part 2: How to Work on the App Properly

### Development Workflow

#### **Step 1: Plan the Feature**
Before writing any code:
- Create a GitHub issue describing the feature
- Break it into small tasks
- Estimate time and effort
- Get CEO/PM approval if it affects the product

```
✏️  Good example:
Title: Add rate limiting to login endpoint
Description:
- Prevent brute force attacks
- Allow 5 attempts per minute per IP
- Return 429 (Too Many Requests) when limit exceeded
- Tasks:
  1. Add rate limiter middleware to Go backend
  2. Add tests for rate limiter
  3. Update error responses in frontend
  4. Document in API reference
Estimate: 4 hours
```

#### **Step 2: Create a Feature Branch**
```bash
git checkout -b feature/add-rate-limiting
# OR
git checkout -b fix/xss-in-posts
```

Branch naming:
- `feature/` — new feature
- `fix/` — bug fix
- `refactor/` — code cleanup
- `docs/` — documentation only

#### **Step 3: Write Tests First (TDD)**
Before touching the actual code, write failing tests:

```typescript
// __tests__/api/auth/login.test.ts
describe("POST /api/auth/login", () => {
  it("should return 429 after 5 failed attempts from same IP", async () => {
    for (let i = 0; i < 5; i++) {
      await loginRequest("user@example.com", "wrong-password");
    }
    const res = await loginRequest("user@example.com", "wrong-password");
    expect(res.status).toBe(429);
  });
});
```

#### **Step 4: Implement the Feature**
Now write the code to make the test pass:

```go
// backend/main.go
// Add rate limiter middleware
// Make the test pass
```

#### **Step 5: Run Tests Locally**
```bash
pnpm test          # Run all tests
pnpm test --watch  # Watch mode
```

Make sure:
- All new tests pass
- No existing tests break
- Coverage is > 80%

#### **Step 6: Code Review Checklist**
Before pushing, verify:

- [ ] Code follows the existing style
- [ ] No hardcoded secrets (passwords, API keys)
- [ ] Error handling is robust
- [ ] Security implications considered
- [ ] Tests cover happy path + edge cases
- [ ] Documentation/comments added
- [ ] No console.log() left behind
- [ ] Database migrations run cleanly

#### **Step 7: Commit with Clear Message**
```bash
git commit -m "feat: add rate limiting to login

- Max 5 failed attempts per IP per minute
- Return 429 Too Many Requests when limit exceeded
- Add tests for rate limiter behaviour
- Update error messages in frontend

Closes #42"
```

**Commit message format**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

Where:
- `type`: feat, fix, refactor, docs, test, chore
- `scope`: auth, messages, admin, etc.
- `subject`: one line, present tense, lowercase
- `body`: what and why, not how
- `footer`: references to issues (Closes #42)

#### **Step 8: Push & Create Pull Request**
```bash
git push origin feature/add-rate-limiting
```

Open a PR on GitHub with:
- Clear description of the change
- Screenshots (if UI change)
- Testing instructions
- Link to issue being fixed

Wait for code review. Address feedback.

#### **Step 9: Merge & Deploy**
Once approved:
```bash
git merge --squash feature/add-rate-limiting
git push origin main
```

Deployment:
- Frontend auto-deploys to Vercel on push to main
- Backend: manual deployment (or auto via CI/CD)
- Check admin dashboard to confirm no errors

---

### Development Best Practices

#### **Never Push Directly to Main**
Always use a branch and PR. Main should only have reviewed, tested code.

#### **Keep Commits Small and Atomic**
Good:
```
commit 1: Add rate limiter middleware
commit 2: Add tests for rate limiter
commit 3: Update frontend error handling
```

Bad:
```
commit 1: Implemented entire feature including UI, API, DB, tests
```

#### **Write Tests for Critical Paths**
Must have tests:
- Authentication (sign up, login, password reset)
- Authorization (admins can't access user data)
- Message delivery
- Ban enforcement
- File upload validation

#### **Use TypeScript Everywhere**
- No `any` types
- Enable `strict: true` in tsconfig.json
- Backend should also use Go's strict type checking

#### **Handle Errors Explicitly**
```typescript
// ❌ Bad:
const data = await fetch("/api/users");

// ✅ Good:
try {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
} catch (error) {
  console.error("Failed to fetch users:", error);
  // Show user-friendly error, retry logic, etc.
}
```

#### **Validate All User Input**
```typescript
// ❌ Bad:
const email = req.body.email;
// might be null, undefined, not a string, not a valid email

// ✅ Good:
const email = z.string().email().parse(req.body.email);
// throws if invalid
```

---

## Part 3: Image Blob Storage Explained

### What Are Blobs?

**Blob** = Binary Large Object = any large binary file (images, videos, PDFs, etc.)

**Current System** (naive):
```
User uploads image
  ↓
Saved to... somewhere (probably a directory on the server)
  ↓
Path stored in database
  ↓
User requests page
  ↓
Server serves the image file
```

**Problems**:
- Server disk space fills up fast
- If server crashes, images are lost (unless backed up)
- Serving images from the app server is slow
- Can't easily scale (multiple servers need shared storage)
- Costs rise as images accumulate

### Blob Storage Solution

**New System** (professional):
```
User uploads image
  ↓
Sent to AWS S3 (or Google Cloud Storage, Azure Blob, etc.)
  ↓
S3 stores the file, returns a URL: https://mybucket.s3.amazonaws.com/abc123.jpg
  ↓
Only the URL is stored in database
  ↓
User requests page
  ↓
Frontend loads image directly from S3 (not from our server)
```

**Benefits**:
- Unlimited storage (pay only for what you use)
- Images served from CDN (fast, globally distributed)
- Server doesn't handle file serving (faster)
- Automatic backups
- Easy to scale to millions of users
- Cheap (AWS: ~$0.023 per GB per month)

### How It Works: Step-by-Step

#### **1. User uploads image in browser**
```typescript
// app/upload/page.tsx
const handleUpload = async (file: File) => {
  // Option A: Send to our server first
  const res = await fetch("/api/upload", {
    method: "POST",
    body: file,
  });
  const { imageUrl } = await res.json();
  // Now imageUrl is: https://mybucket.s3.amazonaws.com/abc123.jpg
};
```

#### **2. Server receives the file**
```go
// backend/main.go
app.Post("/api/upload", jwtAuth, func(c *fiber.Ctx) error {
  // Read the file from request
  file, err := c.FormFile("file")
  
  // Validate: size, type, etc.
  if file.Size > 10*1024*1024 {  // 10 MB max
    return c.Status(400).JSON(fiber.Map{"error": "file too large"})
  }
  
  // Upload to S3
  url, err := uploadToS3(file.Filename, file.Reader)
  
  // Return the URL
  return c.JSON(fiber.Map{"imageUrl": url})
});
```

#### **3. Upload to S3**
```go
import "github.com/aws/aws-sdk-go/aws/session"
import "github.com/aws/aws-sdk-go/service/s3/s3manager"

func uploadToS3(filename string, reader io.Reader) (string, error) {
  sess := session.Must(session.NewSession())
  uploader := s3manager.NewUploader(sess)
  
  // Generate unique key
  key := fmt.Sprintf("uploads/%s-%d", filename, time.Now().UnixNano())
  
  result, err := uploader.Upload(&s3manager.UploadInput{
    Bucket: aws.String("thimble-uploads"),
    Key:    aws.String(key),
    Body:   reader,
  })
  
  // result.Location = "https://thimble-uploads.s3.amazonaws.com/uploads/..."
  return result.Location, nil
}
```

#### **4. Store URL in database**
```go
// After upload succeeds, store the URL:
db.Exec(`
  UPDATE users SET avatar_url = $1 WHERE id = $2
`, imageUrl, userID)
```

#### **5. Frontend displays the image**
```jsx
// components/user-card.tsx
export function UserCard({ user }) {
  // user.avatarUrl = "https://thimble-uploads.s3.amazonaws.com/..."
  return <img src={user.avatarUrl} alt={user.name} />;
}
```

---

### Image Resizing & Optimization

For performance, resize images on upload:

```go
import "image"
import "image/jpeg"
import "github.com/nfnt/resize"

func uploadToS3(filename string, reader io.Reader) (string, error) {
  // Decode the image
  img, _, err := image.Decode(reader)
  
  // Resize to max 2000x2000
  thumbnail := resize.Thumbnail(2000, 2000, img, resize.Lanczos3)
  
  // Compress JPEG quality to 85
  buffer := new(bytes.Buffer)
  jpeg.Encode(buffer, thumbnail, &jpeg.Options{Quality: 85})
  
  // Upload the optimized image
  // ...
}
```

**Benefits**:
- Photos shrink from 5 MB to 200 KB
- Server resources stay low
- Faster downloads for users

---

### Multi-Size Serving (Advanced)

For even better performance, serve multiple sizes:

```go
// Generate 3 versions on upload:
// 1. thumbnail: 200x200
// 2. medium: 800x800
// 3. large: 2000x2000

// Store all 3 URLs:
{
  "avatar_thumb": "https://s3.../thumb.jpg",
  "avatar_medium": "https://s3.../medium.jpg",
  "avatar_full": "https://s3.../full.jpg"
}

// Frontend chooses the right size:
// Mobile: use thumb
// Desktop: use full
```

---

## Implementation Priority

### Phase 1: NOW (Next 2 Weeks) — Security Critical
1. **Add rate limiting** to login, signup, password reset
2. **Implement input sanitization** (prevent XSS in posts/messages)
3. **Add file upload validation** (size, type, scan for malware)
4. **Enable HTTPS everywhere** (enforce Secure flag on cookies)

### Phase 2: This Month
5. Add CSRF protection on state-changing routes
6. Implement blob storage (S3) for user-uploaded images
7. Add email domain verification
8. Enable 2FA for admin accounts
9. Add API versioning

### Phase 3: Next Quarter
10. Comprehensive request logging
11. Content moderation tooling
12. Message pagination
13. Image optimization / CDN
14. Application monitoring (Prometheus/Grafana)

---

## Testing Standards

Every code change must have:

| Component | Min Coverage |
|---|---|
| Authentication | 95% |
| Authorization | 95% |
| Message delivery | 90% |
| Admin functions | 85% |
| Utilities | 80% |
| UI components | 70% |

```bash
# Run coverage report
pnpm jest --coverage

# Example output:
# Statements   : 82.5% ( 1200/1456 )
# Branches     : 76.3% ( 450/590 )
# Functions    : 85.2% ( 180/211 )
# Lines        : 83.1% ( 1100/1324 )
```

---

## Deployment Checklist

Before every production deploy:

- [ ] All tests passing locally
- [ ] Code reviewed and approved
- [ ] No console.log() or debugging code
- [ ] Database migrations tested
- [ ] New secrets added to .env
- [ ] Feature flags set correctly
- [ ] Admin notified of deploy time
- [ ] Rollback plan documented

---

## Questions for Leadership

1. **Should we add blob storage now or wait?** (Now: we need it; users will upload profile photos)
2. **Do we need mobile app?** (Affects tech decisions)
3. **What's the user growth target?** (Affects scaling decisions)
4. **Is there a budget for security tools?** (WAF, malware scanning, etc.)
5. **Do we need SOC 2 / GDPR compliance?** (Affects audit logging, data deletion)

---

**Prepared by:** Adegbola Anjolaoluwa  
**Date:** May 10, 2026
