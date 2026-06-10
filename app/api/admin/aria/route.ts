import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Groq from 'groq-sdk'
import type { ChatCompletionTool } from 'groq-sdk/resources/chat/completions'

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

// ── Tool registry — single source of truth ──────────────────────────────────
// These are passed directly to the Groq API as native function-call tools.
// The model uses these schemas to produce structured JSON — no XML parsing needed.

const ARIA_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'send_broadcast',
      description: 'Send an email (and optional in-app banner) to users. Use for announcements, updates, or campaigns.',
      parameters: {
        type: 'object',
        properties: {
          subject:        { type: 'string', description: 'Email subject line' },
          body:           { type: 'string', description: 'Email body — warm, on-brand for THIMBLE (creative professional platform)' },
          roles:          { type: 'array', items: { type: 'string', enum: ['designer','model','manufacturer','photographer','brand'] }, description: 'Target roles. Empty array = ALL users.' },
          verified_only:  { type: 'boolean', description: 'Only send to verified users' },
          send_email:     { type: 'boolean', description: 'Send as email (default true)' },
          show_banner:    { type: 'boolean', description: 'Also show in-app banner' },
          banner_message: { type: 'string',  description: 'Short one-line in-app banner text' },
          banner_type:    { type: 'string',  enum: ['info','success','warning','critical'] },
          banner_hours:   { type: 'number',  description: 'How long banner shows (hours). 0 = no expiry.' },
          reason:         { type: 'string',  description: 'One sentence: why you are sending this' },
        },
        required: ['subject', 'body', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_alert_email',
      description: 'Send an infrastructure alert or report email to admins only (not users). Use for system alerts, summaries, incident reports.',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Email subject' },
          body:    { type: 'string', description: 'Email body (HTML supported)' },
          reason:  { type: 'string', description: 'Why you are sending this alert' },
        },
        required: ['subject', 'body', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_only',
      description: 'Show a drafted email or message for the admin to review before anything is sent. Use this when the admin has NOT yet confirmed they want to send.',
      parameters: {
        type: 'object',
        properties: {
          subject:              { type: 'string', description: 'Draft subject' },
          body:                 { type: 'string', description: 'Draft body' },
          audience_description: { type: 'string', description: 'Who this would go to' },
          reason:               { type: 'string', description: 'Why you drafted this' },
        },
        required: ['subject', 'body', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_user',
      description: 'Ban, unban, verify, or look up a specific user by their UUID. Always look_up first to confirm their identity before taking any action.',
      parameters: {
        type: 'object',
        properties: {
          action:         { type: 'string', enum: ['ban','unban','verify','look_up'], description: 'What to do' },
          user_id:        { type: 'string', description: 'The user UUID' },
          duration_hours: { type: 'number', description: 'For ban: hours (0 = permanent)' },
          reason:         { type: 'string', description: 'Why this action is being taken' },
        },
        required: ['action', 'user_id', 'reason'],
      },
    },
  },
]

// ── Autonomy rules — what needs approval vs auto-executes ───────────────────
// Approval is enforced on the FRONTEND (ActionCard). The backend executes
// whatever the frontend sends — the frontend only sends after user clicks Approve.
export const TOOL_REQUIRES_APPROVAL: Record<string, boolean> = {
  send_broadcast:   true,   // always confirm before emailing users
  send_alert_email: false,  // admin emails are low-risk, auto-ok
  draft_only:       false,  // no-op, just shows preview
  manage_user:      true,   // ban/verify always needs confirmation
}

// ── POST: chat ───────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { prompt: string; history?: { role: string; content: string }[] }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 })

  const client = new Groq({ apiKey })

  // Build message history for multi-turn context (last 10 messages)
  const historyMessages = (body.history ?? []).slice(-10).map(m => ({
    role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.content,
  }))

  const response = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    max_tokens: 1400,
    tools: ARIA_TOOLS,
    tool_choice: 'auto',
    messages: [
      {
        role: 'system',
        content: `You are ARIA — the autonomous AI operator for THIMBLE, a platform for creative professionals (designers, models, manufacturers, photographers, brands). You have full access to live platform metrics and can take real actions.

INTENT CLASSIFICATION — for every message, decide if it is:
• QUESTION → answer directly from the data, no tool needed
• ACTION REQUEST → use a tool (subject to approval rules below)
• AUTOMATION TRIGGER → describe the automation you would set up and draft the action

AUTONOMY RULES:
• send_broadcast (email ALL users) → always show preview first, only execute after admin says "yes/send/go/confirm"
• send_alert_email (admin only) → can propose and execute in one step, low risk
• draft_only → use when admin hasn't confirmed yet, or for any first-time proposal
• manage_user → always look_up first to confirm identity, then propose ban/verify with reason

BEHAVIOR:
• Be concise and direct — no fluff
• Use **bold** for section headers
• When drafting emails, write warm professional copy suited to a creative community
• When you call a tool, ALSO write what you are doing in your text reply so the admin sees context
• If data shows something unusual, proactively flag it
• You DO NOT need to apologise or add disclaimers — just act professionally`,
      },
      ...historyMessages,
      { role: 'user', content: body.prompt },
    ],
  })

  const choice = response.choices[0]
  const textContent = choice.message.content ?? ''

  // Extract native tool call if model used it
  let parsedAction: ActionPayload | null = null
  const toolCall = choice.message.tool_calls?.[0]
  if (toolCall?.function) {
    try {
      const params = JSON.parse(toolCall.function.arguments) as Record<string, unknown>
      const { reason, ...rest } = params
      parsedAction = {
        tool:   toolCall.function.name,
        params: rest,
        reason: (reason as string) ?? '',
      }
    } catch {
      // malformed tool arguments — ignore
    }
  }

  // Also check for legacy <action> tag fallback (in case model ignores tool_choice)
  if (!parsedAction) {
    const tagMatch = textContent.match(/<action>([\s\S]*?)<\/action>/)
    if (tagMatch) {
      try {
        const parsed = JSON.parse(tagMatch[1].trim()) as ActionPayload
        if (ARIA_TOOLS.some(t => t.function!.name === parsed.tool)) {
          parsedAction = parsed
        }
      } catch { /* ignore */ }
    }
  }

  const cleanText = textContent.replace(/<action>[\s\S]*?<\/action>/g, '').trim()

  return NextResponse.json({
    result: cleanText || (parsedAction ? `Executing: ${parsedAction.tool}` : 'No response.'),
    action: parsedAction,
    requiresApproval: parsedAction ? (TOOL_REQUIRES_APPROVAL[parsedAction.tool] ?? true) : null,
  })
}

// ── PUT: execute a confirmed action ─────────────────────────────────────────
export async function PUT(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { action: ActionPayload }
  const { action } = body

  // Validate tool is in registry
  const knownTool = ARIA_TOOLS.find(t => t.function!.name === action.tool)
  if (!knownTool) {
    return NextResponse.json({
      ok: false,
      error: `Unknown tool: "${action.tool}". Known tools: ${ARIA_TOOLS.map(t => t.function!.name).join(', ')}`,
    }, { status: 400 })
  }

  switch (action.tool) {

    case 'send_broadcast': {
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
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      return NextResponse.json({ ok: res.ok, data })
    }

    case 'send_alert_email': {
      const p = action.params as unknown as AlertParams
      const res = await fetch(`${api()}/admin/aria/email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: p.subject, body: p.body }),
      })
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      return NextResponse.json({ ok: res.ok, data })
    }

    case 'draft_only':
      // No execution — just acknowledge
      return NextResponse.json({ ok: true, data: { message: 'Draft acknowledged' } })

    case 'manage_user': {
      const p = action.params as unknown as UserActionParams
      const res = await fetch(`${api()}/admin/aria/user-action`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:         p.action,
          user_id:        p.user_id,
          duration_hours: p.duration_hours ?? 0,
          reason:         p.reason ?? '',
        }),
      })
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      return NextResponse.json({ ok: res.ok, data })
    }

    default:
      return NextResponse.json({ ok: false, error: `Tool "${action.tool}" has no executor` }, { status: 400 })
  }
}

// ── GET: return tool registry for frontend display ───────────────────────────
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  void request
  return NextResponse.json({
    tools: ARIA_TOOLS.map(t => ({
      name:             t.function!.name,
      description:      t.function!.description,
      requiresApproval: TOOL_REQUIRES_APPROVAL[t.function!.name] ?? true,
    })),
  })
}

// ── Types ────────────────────────────────────────────────────────────────────

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

interface UserActionParams {
  action: 'ban' | 'unban' | 'verify' | 'look_up'
  user_id: string
  duration_hours?: number
  reason?: string
}
