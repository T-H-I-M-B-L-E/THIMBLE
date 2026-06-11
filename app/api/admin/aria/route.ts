import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash } from 'crypto'
import Groq from 'groq-sdk'
import type { ChatCompletionTool } from 'groq-sdk/resources/chat/completions'

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

// Model: 70b is free on Groq and far better at tool selection than 8b-instant.
const ARIA_MODEL = 'llama-3.3-70b-versatile'

// ── Idempotency guard — prevents the same action executing twice ─────────────
// Keyed by a hash of tool + params. An identical action within the window is
// blocked, so a double-click or retry can't send a broadcast twice.
const recentExecutions = new Map<string, number>()
const DEDUP_WINDOW_MS = 60_000 // 1 minute

function actionHash(action: ActionPayload): string {
  return createHash('sha256')
    .update(action.tool + JSON.stringify(action.params))
    .digest('hex')
    .slice(0, 16)
}

function alreadyExecuted(hash: string): boolean {
  const now = Date.now()
  // prune expired entries
  for (const [k, t] of recentExecutions) {
    if (now - t > DEDUP_WINDOW_MS) recentExecutions.delete(k)
  }
  return recentExecutions.has(hash)
}

function markExecuted(hash: string): void {
  recentExecutions.set(hash, Date.now())
}

// ── Lightweight decision logging — see what ARIA actually decided ────────────
function logDecision(stage: string, detail: Record<string, unknown>): void {
  console.log(`[ARIA:${stage}]`, JSON.stringify(detail))
}

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
const TOOL_REQUIRES_APPROVAL: Record<string, boolean> = {
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

  let response
  try {
    response = await client.chat.completions.create({
      model: ARIA_MODEL,
      temperature: 0.4,
      max_tokens: 1400,
      tools: ARIA_TOOLS,
      tool_choice: 'auto',
      messages: [
        {
          role: 'system',
          content: `You are ARIA — the AI operator for THIMBLE, a platform for creative professionals (designers, models, manufacturers, photographers, brands). You have live platform metrics and can take real actions through tools.

HOW TO DECIDE WHAT TO DO:
1. If the admin is ASKING for information ("how many users?", "any issues?", "is X ok?") → answer in plain text from the live data. Do NOT call a tool.
2. If the admin wants to SEND something but has NOT confirmed yet, or says "draft"/"write"/"show me" → call draft_only with the proposed subject + body.
3. If the admin EXPLICITLY confirms a send ("yes", "send it", "go ahead", "confirm", "do it") → call the real tool (send_broadcast or send_alert_email).
4. If the admin wants to act on ONE user (ban/verify/unban/look up) → call manage_user. Always look_up first if you don't already have their details.

TOOL PICKING RULES (follow exactly):
• "email/message all users" or a segment → send_broadcast
• "email/alert the admins" or "send me a report/summary" → send_alert_email
• "ban/verify/unban/find user X" → manage_user
• Anything not yet confirmed → draft_only
• A plain question → NO tool, just answer

NEVER invent a tool name. Only use: send_broadcast, send_alert_email, draft_only, manage_user.

STYLE:
• Be concise and direct. Use **bold** for headers.
• When you call a tool, ALSO write 1-2 sentences in plain text explaining what you're doing — never reply with only a tool call and no text.
• Email copy should be warm and professional, suited to a creative community.
• Flag anything unusual in the data proactively.`,
        },
        ...historyMessages,
        { role: 'user', content: body.prompt },
      ],
    })
  } catch (err) {
    logDecision('groq_error', { error: String(err) })
    return NextResponse.json({
      result: 'ARIA had trouble reaching its model. Try again in a moment.',
      action: null,
      requiresApproval: null,
    }, { status: 200 })
  }

  const choice = response.choices[0]
  const textContent = choice.message.content ?? ''
  const validToolNames = ARIA_TOOLS.map(t => t.function!.name)

  // Extract native tool call if model used it
  let parsedAction: ActionPayload | null = null
  const toolCall = choice.message.tool_calls?.[0]
  if (toolCall?.function) {
    // Reject hallucinated tool names before they reach the executor
    if (!validToolNames.includes(toolCall.function.name)) {
      logDecision('rejected_unknown_tool', { tool: toolCall.function.name })
    } else {
      try {
        const params = JSON.parse(toolCall.function.arguments) as Record<string, unknown>
        const { reason, ...rest } = params
        parsedAction = {
          tool:   toolCall.function.name,
          params: rest,
          reason: (reason as string) ?? '',
        }
      } catch (e) {
        logDecision('bad_tool_args', { tool: toolCall.function.name, error: String(e) })
      }
    }
  }

  // Legacy <action> tag fallback (in case model emits it as text)
  if (!parsedAction) {
    const tagMatch = textContent.match(/<action>([\s\S]*?)<\/action>/)
    if (tagMatch) {
      try {
        const parsed = JSON.parse(tagMatch[1].trim()) as ActionPayload
        if (validToolNames.includes(parsed.tool)) parsedAction = parsed
      } catch { /* ignore */ }
    }
  }

  const cleanText = textContent.replace(/<action>[\s\S]*?<\/action>/g, '').trim()

  // Sensible fallback text so the user never sees "Executing: send_broadcast"
  let resultText = cleanText
  if (!resultText && parsedAction) {
    const verb: Record<string, string> = {
      send_broadcast:   "I've drafted a broadcast for your review below.",
      send_alert_email: "I've prepared an admin alert email below.",
      draft_only:       "Here's a draft for you to review below.",
      manage_user:      "I've prepared a user action below.",
    }
    resultText = verb[parsedAction.tool] ?? 'Here is the proposed action below.'
  }
  if (!resultText) resultText = 'No response.'

  logDecision('chat', {
    hasAction: !!parsedAction,
    tool: parsedAction?.tool ?? null,
    requiresApproval: parsedAction ? (TOOL_REQUIRES_APPROVAL[parsedAction.tool] ?? true) : null,
  })

  return NextResponse.json({
    result: resultText,
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

  // Idempotency — block duplicate sends within the dedup window. Only guards
  // the irreversible/spammy actions; drafts and look-ups can repeat freely.
  const guarded = action.tool === 'send_broadcast' || action.tool === 'send_alert_email'
  const hash = actionHash(action)
  if (guarded) {
    if (alreadyExecuted(hash)) {
      logDecision('blocked_duplicate', { tool: action.tool, hash })
      return NextResponse.json({
        ok: false,
        error: 'This exact action was just sent moments ago — blocked to prevent a duplicate. Wait a minute if you really need to resend.',
      }, { status: 409 })
    }
    markExecuted(hash) // reserve immediately so a double-click can't slip through
  }

  logDecision('execute', { tool: action.tool, hash: guarded ? hash : null })

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
      if (!res.ok) recentExecutions.delete(hash) // failed — allow retry
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
      if (!res.ok) recentExecutions.delete(hash) // failed — allow retry
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
