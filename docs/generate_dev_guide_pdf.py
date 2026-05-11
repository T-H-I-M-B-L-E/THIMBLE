from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether, Preformatted
)
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
import datetime

BLACK       = HexColor("#0A0A0A")
DARK_GREY   = HexColor("#1A1A1A")
MID_GREY    = HexColor("#4A4A4A")
LIGHT_GREY  = HexColor("#F5F5F5")
RULE_GREY   = HexColor("#DDDDDD")
ACCENT      = HexColor("#DC2626")   # red for dev/urgent items
WHITE       = colors.white

PAGE_W, PAGE_H = A4
MARGIN_L = 20 * mm
MARGIN_R = 20 * mm
MARGIN_T = 16 * mm
MARGIN_B = 16 * mm
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

class DevTemplate(SimpleDocTemplate):
    def __init__(self, filename):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=MARGIN_L,
            rightMargin=MARGIN_R,
            topMargin=MARGIN_T + 12 * mm,
            bottomMargin=MARGIN_B + 12 * mm,
        )

    def afterPage(self):
        self._drawHeaderFooter(self.canv, self.page)

    def _drawHeaderFooter(self, c, page_num):
        c.saveState()
        c.setFillColor(DARK_GREY)
        c.setFont("Courier", 7)
        c.drawString(MARGIN_L, PAGE_H - 13 * mm, "THIMBLE — DEVELOPER IMPLEMENTATION GUIDE")
        c.setFillColor(RULE_GREY)
        c.rect(MARGIN_L, PAGE_H - 15 * mm, CONTENT_W, 0.4, fill=1, stroke=0)
        c.setFillColor(RULE_GREY)
        c.rect(MARGIN_L, 14 * mm, CONTENT_W, 0.4, fill=1, stroke=0)
        c.setFillColor(MID_GREY)
        c.setFont("Courier", 7)
        c.drawString(MARGIN_L, 10 * mm, f"For: Development Team  |  4 Phases  |  12+ Weeks")
        c.drawRightString(PAGE_W - MARGIN_R, 10 * mm, f"Page {page_num}")
        c.restoreState()

def make_styles():
    base = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle("cover_title",
            fontName="Courier-Bold", fontSize=32, textColor=WHITE, leading=40,
            alignment=TA_CENTER, spaceAfter=12),
        "cover_subtitle": ParagraphStyle("cover_subtitle",
            fontName="Courier", fontSize=10, textColor=HexColor("#CCCCCC"),
            alignment=TA_CENTER, spaceAfter=24),
        "cover_label": ParagraphStyle("cover_label",
            fontName="Courier", fontSize=8, textColor=HexColor("#999999"),
            alignment=TA_CENTER, spaceAfter=2),
        "cover_value": ParagraphStyle("cover_value",
            fontName="Courier-Bold", fontSize=9.5, textColor=WHITE,
            alignment=TA_CENTER, spaceAfter=10),
        "h1": ParagraphStyle("h1",
            fontName="Courier-Bold", fontSize=16, textColor=DARK_GREY,
            leading=20, spaceAfter=6, spaceBefore=12),
        "h2": ParagraphStyle("h2",
            fontName="Courier-Bold", fontSize=11, textColor=DARK_GREY,
            leading=14, spaceBefore=10, spaceAfter=4),
        "h3": ParagraphStyle("h3",
            fontName="Courier-Bold", fontSize=9.5, textColor=MID_GREY,
            leading=12, spaceBefore=8, spaceAfter=3),
        "body": ParagraphStyle("body",
            fontName="Courier", fontSize=8.5, textColor=MID_GREY,
            leading=13, spaceAfter=5, alignment=TA_JUSTIFY),
        "bullet": ParagraphStyle("bullet",
            fontName="Courier", fontSize=8.5, textColor=MID_GREY,
            leading=13, spaceAfter=4, leftIndent=12, bulletIndent=0),
        "code_block": ParagraphStyle("code_block",
            fontName="Courier", fontSize=7.5, textColor=BLACK,
            leading=11, spaceAfter=6, backColor=LIGHT_GREY),
        "caption": ParagraphStyle("caption",
            fontName="Courier-Oblique", fontSize=7.5, textColor=HexColor("#888888"),
            leading=11, spaceAfter=4),
        "table_head": ParagraphStyle("table_head",
            fontName="Courier-Bold", fontSize=7.5, textColor=WHITE,
            leading=11, alignment=TA_LEFT),
        "table_cell": ParagraphStyle("table_cell",
            fontName="Courier", fontSize=7.5, textColor=DARK_GREY,
            leading=12, alignment=TA_LEFT),
        "table_cell_grey": ParagraphStyle("table_cell_grey",
            fontName="Courier", fontSize=7.5, textColor=MID_GREY,
            leading=12, alignment=TA_LEFT),
        "alert": ParagraphStyle("alert",
            fontName="Courier-Bold", fontSize=8.5, textColor=ACCENT,
            leading=13, spaceAfter=6),
        "phase_label": ParagraphStyle("phase_label",
            fontName="Courier-Bold", fontSize=9, textColor=WHITE,
            leading=12, alignment=TA_CENTER),
    }

def rule(color=RULE_GREY, thickness=0.5, space_before=4, space_after=8):
    return HRFlowable(width="100%", thickness=thickness, color=color,
                      spaceAfter=space_after, spaceBefore=space_before)

def draw_cover(c, doc):
    c.saveState()
    c.setFillColor(DARK_GREY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.rect(0, PAGE_H - 4, PAGE_W, 4, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Courier-Bold", 38)
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.70, "THIMBLE")
    c.setFillColor(HexColor("#AAAAAA"))
    c.setFont("Courier", 10)
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.64, "Developer Implementation Guide")
    detail_y = PAGE_H * 0.50
    line_h = 20
    def detail(label, value, y):
        c.setFont("Courier", 7)
        c.setFillColor(HexColor("#888888"))
        c.drawCentredString(PAGE_W / 2, y + 1, label.upper())
        c.setFont("Courier-Bold", 9)
        c.setFillColor(WHITE)
        c.drawCentredString(PAGE_W / 2, y - 10, value)
    detail("Status", "Phase 1 Ready", detail_y)
    detail("Timeline", "4 Weeks → 12+ Weeks", detail_y - line_h * 2)
    detail("Phases", "4 Phases", detail_y - line_h * 4)
    detail("Features", "Likes, Comments, Follows, Saves, Feed Algorithm", detail_y - line_h * 6)
    detail("Date", datetime.date.today().strftime("%B %d, %Y"), detail_y - line_h * 8)
    c.setFillColor(HexColor("#666666"))
    c.setFont("Courier", 7)
    c.drawCentredString(PAGE_W / 2, 18 * mm, "Keep this guide updated as items are completed")
    c.restoreState()

def build():
    out_path = "/home/user/THIMBLE/docs/THIMBLE_Developer_Guide.pdf"
    doc = DevTemplate(out_path)
    s = make_styles()
    story = []

    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────
    # SECTION 1: EXECUTIVE SUMMARY / AUDIT
    # ─────────────────────────────────────────────────────────────────
    story.append(Paragraph("AUDIT SUMMARY", s["h1"]))
    story.append(rule(thickness=1.5, color=DARK_GREY, space_before=2, space_after=8))

    audit_summary = [
        ["Issue", "Count", "Priority"],
        ["Broken / Fake Pages", "1", "CRITICAL"],
        ["Pages with Mock Fallback", "3", "CRITICAL"],
        ["Non-functional Buttons", "14+", "CRITICAL"],
        ["Missing Social Features", "4 (likes, comments, follows, saves)", "CRITICAL"],
        ["Mock Data Arrays to Delete", "3", "HIGH"],
        ["Hardcoded Stats", "7", "HIGH"],
        ["Missing Backend Routes", "8", "HIGH"],
    ]
    t = Table(audit_summary, colWidths=[CONTENT_W * 0.5, CONTENT_W * 0.2, CONTENT_W * 0.3])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK_GREY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
        ("GRID", (0, 0), (-1, -1), 0.3, RULE_GREY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("FONTNAME", (0, 0), (-1, 0), "Courier-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Courier"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
    ]))
    story.append(t)
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph("Broken Items Found in Codebase", s["h2"]))
    story.append(Paragraph("✗ Explore page is 100% hardcoded (9 fake posts, 7 fake categories)", s["bullet"]))
    story.append(Paragraph("✗ Right rail: fake stats, fake trending tags, fake suggested users", s["bullet"]))
    story.append(Paragraph("✗ Sidebar: fake trending topics, non-functional follow buttons", s["bullet"]))
    story.append(Paragraph("✗ Like button: toggles local state only, never hits database", s["bullet"]))
    story.append(Paragraph("✗ Save button: local state only, no API call", s["bullet"]))
    story.append(Paragraph("✗ Comments: hardcoded count always shows 18", s["bullet"]))
    story.append(Paragraph("✗ Gig apply: increments browser memory, resets on refresh", s["bullet"]))
    story.append(Paragraph("✗ Post composer: onClick={() {}} does nothing", s["bullet"]))
    story.append(Paragraph("✗ Follow buttons: no onClick handler at all (6+ buttons)", s["bullet"]))
    story.append(Paragraph("✗ Profile followers/following: always shows 0", s["bullet"]))
    story.append(Spacer(1, 8 * mm))

    # ─────────────────────────────────────────────────────────────────
    # SECTION 2: THE FOUR PHASES
    # ─────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("IMPLEMENTATION PHASES", s["h1"]))
    story.append(rule(thickness=1.5, color=DARK_GREY, space_before=2, space_after=8))

    phases = [
        ("PHASE 1", "Backend First", "Week 1", [
            "5 new database tables (likes, comments, follows, saves, applications)",
            "8 new API routes (like/comment/follow/save/apply/feed/explore/suggest)",
            "Engagement-based feed algorithm",
            "Do NOT touch frontend yet",
        ]),
        ("PHASE 2", "Clean Frontend", "Week 2-3", [
            "Delete all mock data from lib/store.ts",
            "Wire every button to real API",
            "Fix hardcoded stats (followers, comments count, etc.)",
            "Remove fallback to mock data",
            "Fix explore page, right rail, sidebar",
        ]),
        ("PHASE 3", "New Features", "Week 4", [
            "Public profile pages",
            "Notifications system",
            "S3 blob storage (ESSENTIAL for image uploads)",
            "Rate limiting on auth routes",
        ]),
        ("PHASE 4", "Polish", "Month 2-3", [
            "Hashtags / trending tags",
            "Search functionality",
            "Image optimization",
            "Advanced UX improvements",
        ]),
    ]

    for phase_name, title, timeline, items in phases:
        # Phase header box
        data = [[Paragraph(f"{phase_name}: {title}", s["phase_label"])]]
        t = Table(data, colWidths=[CONTENT_W])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(t)
        story.append(Spacer(1, 4 * mm))
        story.append(Paragraph(f"<b>Timeline:</b> {timeline}", s["body"]))
        story.append(Spacer(1, 3 * mm))
        for item in items:
            story.append(Paragraph(f"• {item}", s["bullet"]))
        story.append(Spacer(1, 8 * mm))

    # ─────────────────────────────────────────────────────────────────
    # SECTION 3: WEEK BY WEEK
    # ─────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("WEEK-BY-WEEK BREAKDOWN", s["h1"]))
    story.append(rule(thickness=1.5, color=DARK_GREY, space_before=2, space_after=8))

    weeks = [
        ("Week 1", "Backend Infrastructure", [
            "Add 5 DB tables: post_likes, post_comments, follows, saved_posts, gig_applications",
            "Add 8 backend API routes (Go code provided in guide)",
            "Test each route with curl or Postman",
        ]),
        ("Week 2", "Data Cleanup + First Features", [
            "Delete mockGigs array from lib/store.ts",
            "Delete mockDesignPosts array from lib/store.ts",
            "Delete hardcoded explore posts array",
            "Wire like button to /api/posts/:id/like",
            "Wire follow buttons to /api/users/:id/follow",
        ]),
        ("Week 3", "More Frontend Wiring", [
            "Wire comments UI to /api/posts/:id/comments",
            "Wire save button to /api/posts/:id/save",
            "Fix profile followers/following count (use real data from user object)",
            "Fix gig apply button to /api/gigs/:id/apply",
            "Fix post composer (Photo, Gig buttons should open modals)",
        ]),
        ("Week 4", "New Pages + Security", [
            "Build public profile pages (/profile/[userId])",
            "Fix explore page to use /api/explore (not hardcoded)",
            "Add rate limiting to auth endpoints",
            "Add feed mode toggle (For You / Following / Latest)",
            "Add input sanitization to prevent XSS",
        ]),
    ]

    for week, title, items in weeks:
        story.append(Paragraph(f"<b>{week}:</b> {title}", s["h2"]))
        for item in items:
            story.append(Paragraph(f"☐ {item}", s["bullet"]))
        story.append(Spacer(1, 6 * mm))

    # ─────────────────────────────────────────────────────────────────
    # SECTION 4: DATABASE SCHEMA
    # ─────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("NEW DATABASE TABLES", s["h1"]))
    story.append(rule(thickness=1.5, color=DARK_GREY, space_before=2, space_after=8))

    story.append(Paragraph("post_likes", s["h2"]))
    story.append(Preformatted("""CREATE TABLE post_likes (
    id         BIGSERIAL PRIMARY KEY,
    post_id    BIGINT NOT NULL,
    user_id    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);""", s["code_block"]))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("post_comments", s["h2"]))
    story.append(Preformatted("""CREATE TABLE post_comments (
    id         BIGSERIAL PRIMARY KEY,
    post_id    BIGINT NOT NULL,
    user_id    TEXT NOT NULL,
    user_name  TEXT NOT NULL,
    user_avatar TEXT DEFAULT '',
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);""", s["code_block"]))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("follows", s["h2"]))
    story.append(Preformatted("""CREATE TABLE follows (
    id          BIGSERIAL PRIMARY KEY,
    follower_id TEXT NOT NULL,
    followed_id TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, followed_id)
);""", s["code_block"]))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("saved_posts", s["h2"]))
    story.append(Preformatted("""CREATE TABLE saved_posts (
    id         BIGSERIAL PRIMARY KEY,
    post_id    BIGINT NOT NULL,
    user_id    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);""", s["code_block"]))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("gig_applications", s["h2"]))
    story.append(Preformatted("""CREATE TABLE gig_applications (
    id         BIGSERIAL PRIMARY KEY,
    gig_id     BIGINT NOT NULL,
    user_id    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(gig_id, user_id)
);""", s["code_block"]))

    # ─────────────────────────────────────────────────────────────────
    # SECTION 5: API ROUTES TO BUILD
    # ─────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("NEW API ROUTES (8 Total)", s["h1"]))
    story.append(rule(thickness=1.5, color=DARK_GREY, space_before=2, space_after=8))

    routes = [
        ("POST /api/posts/:id/like", "Toggle like on a post"),
        ("GET /api/posts/liked", "Get all post IDs the current user liked"),
        ("GET /api/posts/:id/comments", "Get all comments on a post"),
        ("POST /api/posts/:id/comments", "Create a comment on a post"),
        ("DELETE /api/posts/:id/comments/:commentId", "Delete a comment"),
        ("POST /api/users/:id/follow", "Toggle follow on a user"),
        ("GET /api/users/:id/followers", "Get followers of a user"),
        ("GET /api/users/:id/following", "Get users that a user follows"),
        ("POST /api/posts/:id/save", "Toggle save a post"),
        ("GET /api/posts/saved", "Get current user's saved posts"),
        ("POST /api/gigs/:id/apply", "Toggle apply to a gig"),
        ("GET /api/explore", "Get feed for discover page"),
        ("GET /api/users/suggested", "Get suggested users to follow"),
    ]

    routes_data = [["Endpoint", "Purpose"]]
    for endpoint, purpose in routes:
        routes_data.append([Paragraph(f"<font face='Courier'>{endpoint}</font>", s["table_cell"]),
                           Paragraph(purpose, s["table_cell"])])

    t = Table(routes_data, colWidths=[CONTENT_W * 0.35, CONTENT_W * 0.65])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK_GREY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
        ("GRID", (0, 0), (-1, -1), 0.3, RULE_GREY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
    ]))
    story.append(t)
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph("<b>Full Go code for all 13 routes is in the developer guide.</b>", s["alert"]))

    # ─────────────────────────────────────────────────────────────────
    # SECTION 6: WHAT NOT TO BUILD
    # ─────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("WHAT NOT TO BUILD (Zero Budget)", s["h1"]))
    story.append(rule(thickness=1.5, color=DARK_GREY, space_before=2, space_after=8))

    story.append(Paragraph("These features are expensive and can wait until there is budget:", s["body"]))
    story.append(Spacer(1, 4 * mm))

    dont_build = [
        ("Mobile App", "6+ months, requires React Native or Swift/Kotlin expertise"),
        ("Video Uploads", "S3 + transcoding costs multiply; need CDN bandwidth"),
        ("AI-Powered Feed", "Requires ML infrastructure; data science team needed"),
        ("Stories / Highlights", "Complex media pipeline; high storage + bandwidth"),
        ("Paid Jobs (Escrow)", "Requires Stripe + legal; payment disputes are costly"),
        ("SMS 2FA", "Costs per SMS; TOTP (authenticator app) is free"),
        ("Advanced Creator Analytics", "Requires event tracking pipeline; big project"),
    ]

    for feature, reason in dont_build:
        story.append(Paragraph(f"<b>{feature}</b>: {reason}", s["bullet"]))

    # ─────────────────────────────────────────────────────────────────
    # SECTION 7: TESTING CHECKLIST
    # ─────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("TESTING REQUIREMENTS", s["h1"]))
    story.append(rule(thickness=1.5, color=DARK_GREY, space_before=2, space_after=8))

    story.append(Paragraph("Every feature must have tests before it is marked done:", s["body"]))
    story.append(Spacer(1, 4 * mm))

    test_features = [
        "Like/Unlike toggle (happy path + double like = unlike)",
        "Comments CRUD (create, read, delete only by author)",
        "Follow/Unfollow toggle (can't follow yourself)",
        "Save/Unsave toggle",
        "Gig applications (can't apply twice)",
        "Feed algorithm (engagement-based ranking works)",
        "Unauthenticated access (should return 401)",
    ]

    for feature in test_features:
        story.append(Paragraph(f"☐ {feature}", s["bullet"]))

    # ─────────────────────────────────────────────────────────────────
    # SECTION 8: NEXT STEPS
    # ─────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("NEXT STEPS", s["h1"]))
    story.append(rule(thickness=1.5, color=DARK_GREY, space_before=2, space_after=8))

    story.append(Paragraph("1. Print or save this PDF", s["body"]))
    story.append(Paragraph("2. Read /docs/DEVELOPER_GUIDE.md (full implementation details)", s["body"]))
    story.append(Paragraph("3. Start Phase 1: Add database tables to backend/main.go", s["body"]))
    story.append(Paragraph("4. Test each backend route with curl before touching frontend", s["body"]))
    story.append(Paragraph("5. Follow the week-by-week breakdown in order", s["body"]))
    story.append(Paragraph("6. Check off items as completed", s["body"]))
    story.append(Spacer(1, 8 * mm))

    story.append(rule(thickness=1, color=DARK_GREY, space_before=4, space_after=4))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Full developer guide: /docs/DEVELOPER_GUIDE.md", s["caption"]))
    story.append(Paragraph(f"Generated: {datetime.date.today().strftime('%B %d, %Y')}", s["caption"]))

    doc.build(story, onFirstPage=draw_cover, onLaterPages=lambda c, d: None)
    print(f"PDF written to: {out_path}")

if __name__ == "__main__":
    build()
