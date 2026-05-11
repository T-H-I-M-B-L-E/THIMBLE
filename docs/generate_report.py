from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
import datetime

# ── Colour palette ────────────────────────────────────────────────────────────
BLACK       = HexColor("#0A0A0A")
DARK_GREY   = HexColor("#1A1A1A")
MID_GREY    = HexColor("#4A4A4A")
LIGHT_GREY  = HexColor("#F5F5F5")
RULE_GREY   = HexColor("#DDDDDD")
ACCENT      = HexColor("#0A0A0A")   # keep monochrome / editorial feel
WHITE       = colors.white

PAGE_W, PAGE_H = A4
MARGIN_L = 22 * mm
MARGIN_R = 22 * mm
MARGIN_T = 18 * mm
MARGIN_B = 18 * mm
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R


# ── Page template with running header/footer ──────────────────────────────────
class ReportTemplate(SimpleDocTemplate):
    def __init__(self, filename):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=MARGIN_L,
            rightMargin=MARGIN_R,
            topMargin=MARGIN_T + 12 * mm,
            bottomMargin=MARGIN_B + 12 * mm,
        )

    def handle_pageBegin(self):
        super().handle_pageBegin()

    def afterPage(self):
        self._drawHeaderFooter(self.canv, self.page)

    def _drawHeaderFooter(self, c, page_num):
        c.saveState()
        # ── Header ────────────────────────────────────────────────
        c.setFillColor(DARK_GREY)
        c.setFont("Helvetica", 7)
        c.drawString(MARGIN_L, PAGE_H - 13 * mm, "T H I M B L E  —  PLATFORM TECHNICAL REPORT")
        c.setFillColor(RULE_GREY)
        c.rect(MARGIN_L, PAGE_H - 15 * mm, CONTENT_W, 0.4, fill=1, stroke=0)
        # ── Footer ────────────────────────────────────────────────
        c.setFillColor(RULE_GREY)
        c.rect(MARGIN_L, 14 * mm, CONTENT_W, 0.4, fill=1, stroke=0)
        c.setFillColor(MID_GREY)
        c.setFont("Helvetica", 7)
        c.drawString(MARGIN_L, 10 * mm, "Confidential — Prepared for Abba Mohammed Muktar, Chief Executive Officer")
        c.drawRightString(PAGE_W - MARGIN_R, 10 * mm, f"Page {page_num}")
        c.restoreState()


# ── Style helpers ─────────────────────────────────────────────────────────────
def make_styles():
    base = getSampleStyleSheet()

    def ps(name, **kw):
        return ParagraphStyle(name, **kw)

    styles = {
        "cover_company": ps("cover_company",
            fontName="Helvetica-Bold", fontSize=36,
            textColor=WHITE, leading=44, alignment=TA_CENTER,
            letterSpacing=18,
        ),
        "cover_tagline": ps("cover_tagline",
            fontName="Helvetica", fontSize=11,
            textColor=HexColor("#CCCCCC"), leading=18, alignment=TA_CENTER,
            spaceAfter=6,
        ),
        "cover_label": ps("cover_label",
            fontName="Helvetica", fontSize=8,
            textColor=HexColor("#999999"), leading=12, alignment=TA_CENTER,
            spaceAfter=2,
        ),
        "cover_value": ps("cover_value",
            fontName="Helvetica-Bold", fontSize=10,
            textColor=WHITE, leading=15, alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "section_num": ps("section_num",
            fontName="Helvetica", fontSize=9,
            textColor=MID_GREY, leading=12, spaceAfter=1,
        ),
        "h1": ps("h1",
            fontName="Helvetica-Bold", fontSize=18,
            textColor=DARK_GREY, leading=24, spaceAfter=4,
        ),
        "h2": ps("h2",
            fontName="Helvetica-Bold", fontSize=12,
            textColor=DARK_GREY, leading=16, spaceBefore=14, spaceAfter=4,
        ),
        "h3": ps("h3",
            fontName="Helvetica-Bold", fontSize=10,
            textColor=MID_GREY, leading=14, spaceBefore=10, spaceAfter=3,
        ),
        "body": ps("body",
            fontName="Helvetica", fontSize=9.5,
            textColor=MID_GREY, leading=15, spaceAfter=6,
            alignment=TA_JUSTIFY,
        ),
        "body_bold": ps("body_bold",
            fontName="Helvetica-Bold", fontSize=9.5,
            textColor=DARK_GREY, leading=15, spaceAfter=6,
        ),
        "bullet": ps("bullet",
            fontName="Helvetica", fontSize=9.5,
            textColor=MID_GREY, leading=15, spaceAfter=4,
            leftIndent=12, bulletIndent=0,
        ),
        "caption": ps("caption",
            fontName="Helvetica-Oblique", fontSize=8,
            textColor=HexColor("#888888"), leading=12, spaceAfter=6,
        ),
        "table_head": ps("table_head",
            fontName="Helvetica-Bold", fontSize=8,
            textColor=WHITE, leading=12, alignment=TA_LEFT,
        ),
        "table_cell": ps("table_cell",
            fontName="Helvetica", fontSize=8.5,
            textColor=DARK_GREY, leading=13, alignment=TA_LEFT,
        ),
        "table_cell_grey": ps("table_cell_grey",
            fontName="Helvetica", fontSize=8.5,
            textColor=MID_GREY, leading=13, alignment=TA_LEFT,
        ),
        "kpi_number": ps("kpi_number",
            fontName="Helvetica-Bold", fontSize=22,
            textColor=DARK_GREY, leading=28, alignment=TA_CENTER,
        ),
        "kpi_label": ps("kpi_label",
            fontName="Helvetica", fontSize=8,
            textColor=MID_GREY, leading=12, alignment=TA_CENTER,
        ),
        "quote": ps("quote",
            fontName="Helvetica-Oblique", fontSize=10,
            textColor=MID_GREY, leading=16, spaceAfter=6,
            leftIndent=14, rightIndent=14,
        ),
        "footer_note": ps("footer_note",
            fontName="Helvetica", fontSize=8,
            textColor=HexColor("#888888"), leading=12,
            alignment=TA_CENTER, spaceAfter=4,
        ),
    }
    return styles


# ── Reusable flowable builders ────────────────────────────────────────────────
def rule(color=RULE_GREY, thickness=0.5, space_before=4, space_after=8):
    return HRFlowable(
        width="100%", thickness=thickness,
        color=color, spaceAfter=space_after, spaceBefore=space_before,
    )


def section_heading(num, title, s):
    return KeepTogether([
        Paragraph(f"SECTION {num}", s["section_num"]),
        Paragraph(title, s["h1"]),
        rule(thickness=1.5, color=DARK_GREY, space_before=2, space_after=10),
    ])


def sub_heading(title, s):
    return Paragraph(title, s["h2"])


def body(text, s, bold=False):
    key = "body_bold" if bold else "body"
    return Paragraph(text, s[key])


def bullet(text, s):
    return Paragraph(f"• &nbsp; {text}", s["bullet"])


def spacer(h_mm=4):
    return Spacer(1, h_mm * mm)


def info_table(rows, s, col_widths=None):
    if col_widths is None:
        col_widths = [CONTENT_W * 0.38, CONTENT_W * 0.62]
    data = []
    for label, value in rows:
        data.append([
            Paragraph(f"<b>{label}</b>", s["table_cell"]),
            Paragraph(str(value), s["table_cell_grey"]),
        ])
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GREY),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT_GREY]),
        ("GRID", (0, 0), (-1, -1), 0.4, RULE_GREY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def full_table(headers, rows, s, col_widths=None):
    if col_widths is None:
        w = CONTENT_W / len(headers)
        col_widths = [w] * len(headers)
    data = [[Paragraph(h, s["table_head"]) for h in headers]]
    for i, row in enumerate(rows):
        data.append([Paragraph(str(cell), s["table_cell"]) for cell in row])
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK_GREY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
        ("GRID", (0, 0), (-1, -1), 0.4, RULE_GREY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def highlight_box(text, s):
    data = [[Paragraph(text, s["quote"])]]
    t = Table(data, colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_GREY),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LINEAFTER", (0, 0), (0, -1), 3, DARK_GREY),
    ]))
    return t


def kpi_row(items, s):
    """items = [(number, label), ...]"""
    cells = []
    for num, label in items:
        inner = Table(
            [[Paragraph(str(num), s["kpi_number"])],
             [Paragraph(label, s["kpi_label"])]],
            colWidths=[CONTENT_W / len(items)],
        )
        inner.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ]))
        cells.append(inner)
    outer = Table([cells], colWidths=[CONTENT_W / len(items)] * len(items))
    outer.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, RULE_GREY),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_GREY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return outer


# ── Cover page (drawn directly on canvas) ────────────────────────────────────
def draw_cover(c, doc):
    c.saveState()

    # Full-bleed black background
    c.setFillColor(DARK_GREY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Thin horizontal accent line top
    c.setFillColor(HexColor("#444444"))
    c.rect(0, PAGE_H - 3, PAGE_W, 3, fill=1, stroke=0)

    # Company name
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 42)
    name = "T  H  I  M  B  L  E"
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.72, name)

    # Thin rule under name
    c.setFillColor(HexColor("#555555"))
    c.rect(MARGIN_L + 30 * mm, PAGE_H * 0.695, CONTENT_W - 60 * mm, 0.8, fill=1, stroke=0)

    # Tagline
    c.setFillColor(HexColor("#BBBBBB"))
    c.setFont("Helvetica", 11)
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.655,
                        "Fashion Creative Platform  —  Platform Technical Report")

    # Document details block
    detail_y = PAGE_H * 0.46
    line_h = 22

    def detail(label, value, y):
        c.setFont("Helvetica", 7.5)
        c.setFillColor(HexColor("#888888"))
        c.drawCentredString(PAGE_W / 2, y + 1, label.upper())
        c.setFont("Helvetica-Bold", 10.5)
        c.setFillColor(WHITE)
        c.drawCentredString(PAGE_W / 2, y - 12, value)

    detail("Prepared for",    "Abba Mohammed Muktar",    detail_y)
    detail("Title",           "Chief Executive Officer", detail_y - line_h * 2)
    detail("Prepared by",     "Adegbola Anjolaoluwa",    detail_y - line_h * 4)
    detail("Role",            "Full Stack Developer",    detail_y - line_h * 6)
    detail("Date",            datetime.date.today().strftime("%B %d, %Y"), detail_y - line_h * 8)
    detail("Classification",  "Confidential",            detail_y - line_h * 10)

    # Bottom rule
    c.setFillColor(HexColor("#333333"))
    c.rect(0, 20 * mm, PAGE_W, 0.8, fill=1, stroke=0)

    # Bottom text
    c.setFont("Helvetica", 7)
    c.setFillColor(HexColor("#666666"))
    c.drawCentredString(PAGE_W / 2, 13 * mm, "T H I M B L E  —  All rights reserved")

    c.restoreState()


# ── Build document ────────────────────────────────────────────────────────────
def build():
    out_path = "/home/user/THIMBLE/docs/THIMBLE_Platform_Report.pdf"
    doc = ReportTemplate(out_path)
    s = make_styles()
    story = []

    # ── Cover (blank placeholder page that canvas draws over) ─────────────────
    def cover_page(c, d):
        draw_cover(c, d)
    story.append(PageBreak())   # page 1 = cover (we draw it via onFirstPage)

    # ─────────────────────────────────────────────────────────────────────────
    # We use a custom build so we can inject the cover.
    # ─────────────────────────────────────────────────────────────────────────

    # ── Executive Summary ─────────────────────────────────────────────────────
    story.append(section_heading("01", "Executive Summary", s))
    story.append(highlight_box(
        "T H I M B L E is a digital platform built specifically for the global fashion industry. "
        "It gives designers, models, photographers, manufacturers, and brands one single place to "
        "meet, showcase their work, find opportunities, and collaborate — all in real time.",
        s
    ))
    story.append(spacer(6))
    story.append(body(
        "Think of T H I M B L E the way you might think of LinkedIn, but designed entirely for "
        "fashion creatives rather than office professionals. A designer can upload images of their "
        "latest collection. A photographer can build a portfolio. A brand can post a casting call. "
        "And everyone can message each other directly — instantly, without picking up the phone "
        "or sending an email.",
        s
    ))
    story.append(body(
        "This report explains how the platform works, what it is built with, and what it is capable "
        "of — written in plain language so that you, as CEO, have a clear picture of the technology "
        "underpinning T H I M B L E and can make confident decisions about its future.",
        s
    ))
    story.append(spacer(6))
    story.append(kpi_row([
        ("5", "User Roles Supported"),
        ("2", "Communication Channels"),
        ("100%", "Custom-Built Platform"),
        ("Real-Time", "Messaging Technology"),
    ], s))
    story.append(spacer(8))

    # ── Section 02 — What the Platform Does ───────────────────────────────────
    story.append(PageBreak())
    story.append(section_heading("02", "What the Platform Does", s))
    story.append(body(
        "T H I M B L E is designed around the way fashion professionals actually work. "
        "Every feature on the platform was chosen to solve a real problem that creatives face "
        "when trying to find work, hire talent, or get their work seen.",
        s
    ))

    story.append(sub_heading("2.1  User Profiles & Roles", s))
    story.append(body(
        "When someone joins T H I M B L E, they choose one of five roles that best describes "
        "who they are in the industry. Their entire experience on the platform — the jobs they "
        "see, the features available to them, and how they appear to others — is shaped by "
        "that role.",
        s
    ))
    story.append(full_table(
        ["Role", "Who It Is For"],
        [
            ["Model",        "Fashion models looking for castings, editorial work, and brand campaigns"],
            ["Designer",     "Fashion designers showcasing collections and seeking manufacturers or collaborators"],
            ["Photographer", "Photographers building a portfolio and finding shoot opportunities"],
            ["Manufacturer", "Production houses and factories seeking design clients"],
            ["Brand",        "Fashion labels sourcing models, photographers, and other creative talent"],
        ],
        s,
        col_widths=[CONTENT_W * 0.22, CONTENT_W * 0.78],
    ))

    story.append(sub_heading("2.2  Portfolio Feed", s))
    story.append(body(
        "The feed is the heart of T H I M B L E. It works much like an Instagram feed: users "
        "post images of their work — a new clothing line, a photography shoot, a runway look — "
        "and everyone on the platform can see, like, and engage with it. Each post shows the "
        "creator's name, role, and a description, and can tag collaborators so that everyone "
        "involved gets credit.",
        s
    ))

    story.append(sub_heading("2.3  Gigs Marketplace", s))
    story.append(body(
        "The gigs section works like a job board for the fashion world. A brand can post a "
        "paid opportunity — a casting call, a product shoot, a manufacturing contract — and "
        "other members can apply. Every listing shows the role of the person posting it, the "
        "location, and payment details. This keeps the marketplace transparent and "
        "professional.",
        s
    ))

    story.append(sub_heading("2.4  Direct Messaging", s))
    story.append(body(
        "Members can start a private conversation with anyone on the platform. Messages are "
        "delivered instantly — there is no page refresh required. You can see when someone is "
        "typing a reply, and the full history of every conversation is saved so nothing is "
        "ever lost.",
        s
    ))

    story.append(sub_heading("2.5  Verification System", s))
    story.append(body(
        "To maintain the quality of the community, T H I M B L E uses a verification system. "
        "New members start as unverified. They can request verification, and once the "
        "T H I M B L E team approves their profile, they receive a verified status. "
        "Verification unlocks additional features, such as posting gigs, giving the badge "
        "real weight and keeping the platform professional.",
        s
    ))

    story.append(sub_heading("2.6  Onboarding", s))
    story.append(body(
        "When a new member joins, the platform walks them through a guided setup process: "
        "choosing their role, uploading a profile photo, writing a short bio, and adding "
        "their website or social links. This ensures every profile on the platform is "
        "complete and ready to make an impression from day one.",
        s
    ))

    # ── Section 03 — How Members Join ─────────────────────────────────────────
    story.append(PageBreak())
    story.append(section_heading("03", "How Members Join & Stay Secure", s))
    story.append(body(
        "Security and trust are built into the foundation of T H I M B L E. "
        "The sign-up process is designed to ensure that every account belongs to a real "
        "person with a valid email address.",
        s
    ))

    story.append(sub_heading("3.1  Sign-Up Process", s))
    story.append(info_table([
        ["Step 1 — Register",       "The user enters their name, email address, and a password."],
        ["Step 2 — Email Check",    "The platform sends a 6-digit code to their email. This code expires in 10 minutes."],
        ["Step 3 — Verify",         "The user enters the code. Only then is their account created."],
        ["Step 4 — Onboarding",     "They are guided through the profile setup wizard."],
        ["Step 5 — Dashboard",      "They land on their personalised dashboard, ready to use the platform."],
    ], s))

    story.append(spacer(4))
    story.append(sub_heading("3.2  Logging In", s))
    story.append(body(
        "Logging in is straightforward: email and password. The platform checks the password "
        "against its securely stored (encrypted) version, and if correct, issues the user a "
        "secure session token — essentially a digital key that proves their identity for up to "
        "seven days without them needing to log in again.",
        s
    ))

    story.append(sub_heading("3.3  Password Reset", s))
    story.append(body(
        "If a member forgets their password, they can request a reset. A 6-digit code is "
        "emailed to them. Once entered correctly, they can set a new password. The old password "
        "is immediately invalidated.",
        s
    ))

    story.append(sub_heading("3.4  Ban System", s))
    story.append(body(
        "The admin team can ban any member who violates the platform's standards. Bans can be "
        "temporary (as short as one hour, as long as 30 days) or permanent. A banned user sees "
        "a message explaining why they cannot access the platform and when, if ever, the ban "
        "will be lifted. This protects the quality of the community.",
        s
    ))

    # ── Section 04 — Admin Control Panel ──────────────────────────────────────
    story.append(PageBreak())
    story.append(section_heading("04", "The Admin Control Panel", s))
    story.append(body(
        "The T H I M B L E admin panel is the backstage area of the platform — visible only to "
        "designated administrators. It gives the team full visibility and control over "
        "everything happening on the platform.",
        s
    ))

    story.append(sub_heading("4.1  Platform Statistics Dashboard", s))
    story.append(body(
        "The first thing an admin sees is a live overview of the platform's health. "
        "This includes:",
        s
    ))
    for item in [
        "Total number of members and how many joined today and this week",
        "How many members logged in today",
        "Total posts and gigs on the platform",
        "A breakdown of how many members are verified, pending, or unverified",
        "A chart showing new sign-ups over the last 7 days",
        "Retention insight: how many members have come back vs. never returned",
    ]:
        story.append(bullet(item, s))

    story.append(spacer(4))
    story.append(sub_heading("4.2  User Management", s))
    story.append(body(
        "Admins can search for any member by name or email, filter by role or verification "
        "status, and take action on their account. Available actions include:",
        s
    ))
    story.append(full_table(
        ["Action", "What It Does"],
        [
            ["Edit Profile",       "Change a user's role, or update their verification status (approve/reject)"],
            ["Grant Admin Access", "Promote a trusted team member to admin so they can manage the platform"],
            ["Ban User",           "Suspend access for a set period with a message shown to the user"],
            ["Unban User",         "Remove a ban immediately, restoring access"],
            ["Delete User",        "Permanently remove an account and all associated data"],
        ],
        s,
        col_widths=[CONTENT_W * 0.28, CONTENT_W * 0.72],
    ))

    story.append(sub_heading("4.3  Audit Log", s))
    story.append(body(
        "Every action taken by an admin — banning a user, changing a role, updating settings — "
        "is recorded permanently in an audit log. This creates a clear, tamper-proof record of "
        "who did what and when, which is essential for accountability and governance.",
        s
    ))

    story.append(sub_heading("4.4  Platform Settings", s))
    story.append(body(
        "Admins can toggle platform-wide behaviours. For example, they can enable or disable "
        "automated email notifications that are sent to the team when new code updates are "
        "deployed — useful for keeping leadership informed of development activity.",
        s
    ))

    story.append(sub_heading("4.5  Admin Team Chat", s))
    story.append(body(
        "There is a private, real-time chat channel exclusively for the admin team. This lets "
        "the team communicate internally about platform issues, moderation decisions, or "
        "day-to-day operations — entirely within the T H I M B L E platform itself.",
        s
    ))

    story.append(sub_heading("4.6  Email Usage Tracking", s))
    story.append(body(
        "The platform uses a third-party email service to send verification codes and "
        "notifications. Admins can see a monthly breakdown of how many emails have been sent, "
        "broken down by type, so there are no surprises with usage limits or costs.",
        s
    ))

    # ── Section 05 — Technology Behind the Platform ───────────────────────────
    story.append(PageBreak())
    story.append(section_heading("05", "The Technology Behind the Platform", s))
    story.append(body(
        "This section explains what the platform is built with, in plain terms. "
        "No prior technical knowledge is required to understand it.",
        s
    ))

    story.append(sub_heading("5.1  How a Website Works — The Basics", s))
    story.append(highlight_box(
        "Every website has two parts: the front end (what you see in your browser) and "
        "the back end (the engine running behind the scenes). T H I M B L E is a fully "
        "custom-built platform — both parts were written from scratch by the development team.",
        s
    ))
    story.append(spacer(4))

    story.append(sub_heading("5.2  The Front End — What Users See", s))
    story.append(body(
        "The front end of T H I M B L E is built with Next.js and React — two of the most "
        "widely used, modern web technologies in the world. Think of React as the building "
        "blocks of every button, card, and page the user interacts with, and Next.js as the "
        "framework that holds them all together efficiently.",
        s
    ))
    story.append(body(
        "The interface is fully responsive, meaning it works well on desktop computers, "
        "tablets, and mobile phones without any extra effort from the user. On mobile, a "
        "bottom navigation bar replaces the sidebar — so the experience feels native.",
        s
    ))

    story.append(sub_heading("5.3  The Back End — The Engine", s))
    story.append(body(
        "The back end is the part of the platform that users never see, but it is doing the "
        "heavy lifting: checking passwords, saving messages, running searches, and enforcing "
        "rules (like whether a user is banned).",
        s
    ))
    story.append(body(
        "T H I M B L E's back end is written in Go — a programming language created by Google "
        "that is known for being extremely fast and reliable. This means the platform can handle "
        "many users at once without slowing down.",
        s
    ))

    story.append(sub_heading("5.4  The Database — Where Everything Is Stored", s))
    story.append(body(
        "All data — user profiles, messages, posts, gigs — is stored in a PostgreSQL database. "
        "PostgreSQL is one of the most trusted databases in the world, used by companies like "
        "Instagram, Spotify, and Reddit. It stores data in organised tables (similar to "
        "spreadsheets) and retrieves it instantly when needed.",
        s
    ))
    story.append(full_table(
        ["What Is Stored", "Where It Lives"],
        [
            ["User accounts, passwords, profiles",    "Users table"],
            ["Conversations between members",          "Conversations table"],
            ["Chat messages",                          "Messages table"],
            ["Portfolio posts",                        "Posts table"],
            ["Job / gig listings",                     "Gigs table"],
            ["Admin action history",                   "Audit log table"],
            ["Platform-wide settings",                 "Settings table"],
            ["Email usage records",                    "Email log table"],
        ],
        s,
        col_widths=[CONTENT_W * 0.45, CONTENT_W * 0.55],
    ))

    story.append(sub_heading("5.5  Real-Time Messaging", s))
    story.append(body(
        "T H I M B L E's messaging system uses a technology called WebSocket. Unlike a normal "
        "website where you have to refresh the page to see new content, WebSocket keeps a "
        "permanent open line between your browser and the server — like a phone call that stays "
        "connected. This is how messages appear instantly without any refresh, and how the "
        "'is typing…' indicator works in real time.",
        s
    ))

    story.append(sub_heading("5.6  Email Delivery", s))
    story.append(body(
        "All platform emails (verification codes, password resets, admin notifications) are "
        "sent through Resend — a professional email delivery service. This ensures emails "
        "arrive reliably in inboxes rather than spam folders, and gives the admin team "
        "visibility into email usage.",
        s
    ))

    story.append(sub_heading("5.7  Security", s))
    story.append(body(
        "Security is not an afterthought on T H I M B L E — it is built into every layer:",
        s
    ))
    for item in [
        "Passwords are never stored as plain text. They are encrypted using a technique called bcrypt, "
        "which means even if the database were ever accessed without authorisation, passwords could not be read.",
        "Session tokens (the digital keys that keep users logged in) are short-lived and cryptographically signed.",
        "The admin panel is protected by a separate authentication system — regular users cannot access it under any circumstances.",
        "All admin actions are permanently logged so there is always a clear record.",
        "Email verification ensures that only real people with valid email addresses can create accounts.",
    ]:
        story.append(bullet(item, s))

    # ── Section 06 — How the Platform Is Deployed ─────────────────────────────
    story.append(PageBreak())
    story.append(section_heading("06", "Deployment & Infrastructure", s))
    story.append(body(
        "This section explains how T H I M B L E is hosted and made available to users on "
        "the internet.",
        s
    ))

    story.append(sub_heading("6.1  Front End Hosting — Vercel", s))
    story.append(body(
        "The user-facing part of T H I M B L E (everything the member sees in their browser) "
        "is hosted on Vercel — a global hosting platform used by some of the world's largest "
        "companies. Vercel automatically distributes the platform across servers in multiple "
        "countries, so users in London, Lagos, or Los Angeles all get a fast experience. "
        "It also supports preview deployments, meaning developers can test changes in a "
        "live-like environment before they go out to real users.",
        s
    ))

    story.append(sub_heading("6.2  Back End Hosting", s))
    story.append(body(
        "The back-end engine (the Go server) can be deployed as a single, self-contained "
        "programme on any cloud server. It is designed to start quickly, use minimal resources, "
        "and scale up if the user base grows significantly.",
        s
    ))

    story.append(sub_heading("6.3  Database", s))
    story.append(body(
        "The PostgreSQL database can be hosted on any managed cloud database service "
        "(such as AWS RDS, Supabase, or Railway). On first start, the back end automatically "
        "creates all the necessary database tables — no manual database setup is required.",
        s
    ))

    story.append(sub_heading("6.4  GitHub Integration", s))
    story.append(body(
        "The development team's code is stored and version-controlled on GitHub. T H I M B L E "
        "has a direct integration: every time a developer pushes an update to the main codebase, "
        "an automatic email notification is sent to all admins. This keeps leadership informed "
        "of development activity without needing to check GitHub manually. This feature can be "
        "turned on or off from the admin settings panel.",
        s
    ))

    # ── Section 07 — Testing & Quality Assurance ──────────────────────────────
    story.append(PageBreak())
    story.append(section_heading("07", "Testing & Quality Assurance", s))
    story.append(body(
        "T H I M B L E is developed with quality assurance built into the process. "
        "A suite of automated tests runs against the platform's code to catch problems "
        "before they ever reach a real user.",
        s
    ))
    story.append(body(
        "These tests check every critical area of the platform: the sign-up and login "
        "process, the route protection system (ensuring non-admin users cannot access the "
        "admin panel), the messaging system, and the utility functions that the platform "
        "relies on every day.",
        s
    ))
    story.append(highlight_box(
        "Automated testing means that when a developer changes one part of the platform, "
        "the system automatically checks that the change has not accidentally broken "
        "anything else. This reduces the risk of bugs reaching users.",
        s
    ))

    # ── Section 08 — Summary & Recommendations ────────────────────────────────
    story.append(PageBreak())
    story.append(section_heading("08", "Summary & Recommendations", s))
    story.append(body(
        "T H I M B L E is a fully custom, production-ready platform built on modern, "
        "industry-standard technology. It is secure, scalable, and designed specifically "
        "for the fashion industry's unique needs.",
        s
    ))

    story.append(sub_heading("Platform Strengths", s))
    for item in [
        "Built entirely from scratch — no dependence on third-party platform limitations",
        "Real-time messaging gives users an experience comparable to WhatsApp or iMessage",
        "The verification system and ban controls keep the community professional",
        "The admin panel gives leadership full visibility and control without requiring technical knowledge",
        "Automated tests and audit logs support responsible, accountable development",
        "Deployment architecture is cloud-ready and can scale with user growth",
    ]:
        story.append(bullet(item, s))

    story.append(spacer(4))
    story.append(sub_heading("Areas to Consider for Future Growth", s))
    for item in [
        "Mobile application (iOS / Android) — the platform is web-based today; a native app could increase engagement",
        "Search & discovery — a dedicated search feature would help members find talent and opportunities faster",
        "Analytics for members — showing users how many people viewed their profile or post could drive engagement",
        "Payment integration — enabling brands to pay talent directly through the platform",
    ]:
        story.append(bullet(item, s))

    story.append(spacer(8))
    story.append(rule(thickness=1, color=DARK_GREY))
    story.append(spacer(4))
    story.append(Paragraph(
        "This report was prepared by Adegbola Anjolaoluwa, Full Stack Developer, T H I M B L E.",
        s["caption"]
    ))
    story.append(Paragraph(
        f"Dated {datetime.date.today().strftime('%B %d, %Y')}  —  Confidential",
        s["caption"]
    ))

    # ── Build with cover ───────────────────────────────────────────────────────
    doc.build(
        story,
        onFirstPage=cover_page,
        onLaterPages=lambda c, d: None,  # header/footer via afterPage
    )
    print(f"PDF written to: {out_path}")


if __name__ == "__main__":
    build()
