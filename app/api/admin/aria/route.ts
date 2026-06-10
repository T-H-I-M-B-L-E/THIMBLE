import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Groq from 'groq-sdk'

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

// ── ARIA tool definitions (sent to LLM so it knows what it can do) ──
const TOOLS = `
You have access to these ACTION TOOLS. When you decide to use one, respond with a JSON block
inside <action> tags at the END of your message. Never include personal data in your thinking.

<tools>
send_broadcast:
  description: Send an email (and optional in-app banner) to users. Use for announcements, alerts, updates.
  params:
    subject: string (email subject line)
    body: string (email body — be warm and on-brand for THIMBLE, a creative professional platform)
    roles: array of any of ["designer","model","manufacturer","photographer","brand"] — empty means ALL roles
    verified_only: boolean
    send_email: boolean
    show_banner: boolean
    banner_message: string (one line, shown in-app)
    banner_type: "info"|"success"|"warning"|"critical"
    banner_hours: number (0 = no expiry)

send_alert_email:
  description: Send an infrastructure alert email to admins only (not users).
  params:
    subject: string
    body: string

draft_only:
  description: Just show the user a drafted email/message for them to review — no send.
  params:
    subject: string
    body: string
    audience_description: string
</tools>

When you want to trigger an action, end your reply with:
<action>
{
  "tool": "<tool_name>",
  "params": { ... },
  "reason": "one sentence explaining why you're doing this"
}
</action>

IMPORTANT: ALWAYS show the full draft (subject + body) in your text reply BEFORE the <action> tag,
so the user can read it. Never execute without the user seeing the content.
If the user hasn't confirmed yet, use draft_only. Only use send_broadcast or send_alert_email
when the user explicitly says "yes", "send it", "confirm", "go ahead", or similar.
`

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    prompt: string
    mode: 'chat' | 'analyse'
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 })

  const client = new Groq({ apiKey })
  const response = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    max_tokens: 1200,
    messages: [
      {
        role: 'system',
        content: `You are ARIA, the AI operator for THIMBLE — a platform for creative professionals (designers, models, manufacturers, photographers, brands). You can analyse metrics AND take real actions.

${TOOLS}

Be concise, direct, and action-oriented. Use **bold** for headers. When drafting emails, write in a professional but warm tone that fits a creative platform. Always show the user what you will do before doing it.`,
      },
      { role: 'user', content: body.prompt },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ''

  // Parse out any <action> block
  const actionMatch = raw.match(/<action>([\s\S]*?)<\/action>/)
  const textContent = raw.replace(/<action>[\s\S]*?<\/action>/, '').trim()

  let parsedAction: ActionPayload | null = null
  if (actionMatch) {
    try {
      parsedAction = JSON.parse(actionMatch[1].trim()) as ActionPayload
    } catch {
      // malformed action JSON — ignore
    }
  }

  return NextResponse.json({ result: textContent, action: parsedAction })
}

// ── Execute a confirmed action ──
export async function PUT(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { action: ActionPayload }
  const { action } = body

  if (action.tool === 'send_broadcast') {
    const p = action.params as unknown as BroadcastParams
    const res = await fetch(`${api()}/admin/broadcast`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject:       p.subject,
        body:          p.body,
        audience:      { roles: p.roles ?? [], verifiedOnly: p.verified_only ?? false },
        sendEmail:     p.send_email ?? true,
        showBanner:    p.show_banner ?? false,
        bannerMessage: p.banner_message ?? '',
        bannerType:    p.banner_type ?? 'info',
        bannerHours:   p.banner_hours ?? 0,
      }),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: res.ok, data })
  }

  if (action.tool === 'send_alert_email') {
    const p = action.params as unknown as AlertParams
    const res = await fetch(`${api()}/admin/aria/email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: p.subject, body: p.body }),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: res.ok, data })
  }

  return NextResponse.json({ ok: false, error: 'Unknown tool' }, { status: 400 })
}

interface ActionPayload {
  tool: string
  params: Record<string, unknown>
  reason: string
}

interface BroadcastParams {
  subject: string; body: string; roles?: string[]
  verified_only?: boolean; send_email?: boolean
  show_banner?: boolean; banner_message?: string
  banner_type?: string; banner_hours?: number
}

interface AlertParams { subject: string; body: string }
