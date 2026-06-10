'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Sparkles, Send, RefreshCw, Users, Activity, Database, Cloud,
  Zap, TrendingUp, AlertTriangle, CheckCircle, XCircle, Edit3,
  Mail, Bot, ChevronRight, Shield, Eye
} from 'lucide-react'
import { adminFetch } from '@/lib/adminFetch'

/* ── types ── */
interface InfraData {
  backend:      { ok: boolean; uptime: string; uptimeSec: number }
  database:     { ok: boolean; error: string; latencyMs: number; connsOpen: number; connsTotal: number }
  runtime:      { goroutines: number; heapAllocMB: string; heapSysMB: string }
  requests:     { total: number; ok: number; err4xx: number; err5xx: number; errRatePct: string }
  websockets:   { activeConns: number }
  recentErrors: { time: string; method: string; path: string; status: number; latencyMs: number }[]
  recentSlows:  { time: string; method: string; path: string; status: number; latencyMs: number }[]
  slowestRoutes:{ method: string; path: string; hits: number; avgMs: number; maxMs: number }[] | null
  alerts:       { thresholds: { errRatePct: number; slowMs: number } }
  uptimeRobot:  { monitors: { friendly_name: string; status: number; custom_uptime_ratio: string; average_response_time: string }[] } | null
  emailStats:   { sentToday: number; sentWeek: number; sentTotal: number; lastSentAt: string }
  userActivity: { active24h: number; active7d: number; newToday: number; newThisWeek: number; total: number; banned: number }
  tableSizes:   { name: string; size: string; rowCount: number }[] | null
}

interface AppStats {
  totalUsers: number; todaySignups: number; weekSignups: number
  pendingVerifications: number; verifiedUsers: number
  totalPosts: number; postsThisWeek: number; totalGigs: number
  totalLogins: number; returnedUsers: number; neverLoggedIn: number
  adminCount: number
  roleBreakdown: { role: string; count: number }[]
  dailySignups:  { date: string; count: number }[]
}

interface NeonUsage {
  compute_time_seconds?: number
  data_transfer_bytes?: number
  data_storage_bytes_hour?: number
}

interface AllData { infra: InfraData | null; stats: AppStats | null; neon: NeonUsage | null; fetchedAt: string }

interface ActionPayload {
  tool: string
  params: Record<string, unknown>
  reason: string
}

type MessageStatus = 'pending' | 'approved' | 'executing' | 'done' | 'failed' | 'cancelled' | 'editing'

interface ChatMessage {
  role: 'user' | 'ai' | 'system'
  text: string
  ts: number
  action?: ActionPayload
  actionStatus?: MessageStatus
  actionResult?: string
  editedParams?: Record<string, unknown>
}

/* ── context builder ── */
function buildContext(d: AllData): string {
  const i = d.infra; const s = d.stats; const n = d.neon
  if (!i || !s) return 'Data not yet loaded.'
  const computeHrs = n?.compute_time_seconds != null ? (n.compute_time_seconds / 3600).toFixed(1) : 'unknown'
  const transferMB = n?.data_transfer_bytes != null ? (n.data_transfer_bytes / 1024 / 1024).toFixed(1) : 'unknown'
  const monitor = i.uptimeRobot?.monitors[0]
  const ratios = monitor ? (monitor.custom_uptime_ratio || '').split('-') : []
  return `You are ARIA, the AI operator for THIMBLE — a platform for creative professionals. You have full access to all live metrics AND can take real actions.

=== LIVE DATA (${d.fetchedAt}) ===
INFRA: backend ${i.backend.ok ? 'UP' : 'DOWN'} (${i.backend.uptime}), DB ping ${i.database.latencyMs}ms (${i.database.ok ? 'healthy' : 'ERROR'}), goroutines ${i.runtime.goroutines}, heap ${i.runtime.heapAllocMB}MB
HTTP: ${i.requests.total} requests, ${i.requests.err5xx} 5xx errors, ${i.requests.errRatePct}% error rate, ${i.websockets.activeConns} websockets
UPTIME: 24h ${ratios[0] ? parseFloat(ratios[0]).toFixed(2) + '%' : 'unknown'}, 7d ${ratios[1] ? parseFloat(ratios[1]).toFixed(2) + '%' : 'unknown'}, 30d ${ratios[2] ? parseFloat(ratios[2]).toFixed(2) + '%' : 'unknown'}
USERS: ${s.totalUsers} total, ${s.todaySignups} new today, ${s.weekSignups} this week, ${i.userActivity.active24h} active 24h, ${i.userActivity.banned} banned, ${s.pendingVerifications} pending verification
CONTENT: ${s.totalPosts} posts (${s.postsThisWeek} this week), ${s.totalGigs} gigs
EMAIL: ${i.emailStats.sentToday} sent today, ${i.emailStats.sentWeek} this week, ${i.emailStats.sentTotal} total
NEON: ${computeHrs}/100 CU-hrs compute, ${transferMB}MB data transfer
ROLES: ${s.roleBreakdown.map(r => `${r.role || 'none'}:${r.count}`).join(', ')}
${i.tableSizes?.length ? 'TABLES: ' + i.tableSizes.slice(0,3).map(t => `${t.name}(${t.size})`).join(', ') : ''}
=== END DATA ===

ACTIONS YOU CAN TAKE:
- send_broadcast: Email users (segment by role/verified), optionally add in-app banner
- send_alert_email: Email all admins (for alerts/reports)
- draft_only: Show a draft for the user to review before you send

RULES:
- ALWAYS show the full draft (subject + body) in your message text before proposing an action
- Use draft_only first, then send_broadcast/send_alert_email only when user confirms
- When you propose an action, end with: <action>{"tool":"...","params":{...},"reason":"..."}</action>
- Be warm and professional — THIMBLE is a creative community`
}

/* ── helpers ── */
function formatText(text: string) {
  return text.split('\n').map((line, i) => {
    const boldHeader = line.match(/^\*\*(.+)\*\*$/)
    if (boldHeader) return <div key={i} style={{ fontWeight: 700, color: '#ededef', marginTop: i > 0 ? 10 : 0, marginBottom: 2 }}>{boldHeader[1]}</div>
    const inlineBold = line.match(/\*\*(.+?)\*\*/)
    if (inlineBold) {
      const parts = line.split(/\*\*(.+?)\*\*/)
      return <div key={i} style={{ color: '#cfcfd3', marginTop: 2 }}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: '#ededef' }}>{p}</strong> : p)}</div>
    }
    if (line.startsWith('- ') || line.startsWith('• ')) return <div key={i} style={{ display: 'flex', gap: 8, color: '#b5b5ba', marginTop: 3 }}><span style={{ color: '#5a5a60', flexShrink: 0 }}>·</span><span>{line.slice(2)}</span></div>
    if (line.trim() === '') return <div key={i} style={{ height: 5 }} />
    return <div key={i} style={{ color: '#cfcfd3' }}>{line}</div>
  })
}

const TOOL_LABELS: Record<string, string> = {
  send_broadcast:   'Send to Users',
  send_alert_email: 'Email Admins',
  draft_only:       'Draft Preview',
}

const TOOL_ICONS: Record<string, React.ElementType> = {
  send_broadcast:   Users,
  send_alert_email: Shield,
  draft_only:       Eye,
}

const TOOL_COLORS: Record<string, string> = {
  send_broadcast:   '#6366f1',
  send_alert_email: '#f59e0b',
  draft_only:       '#22d3ee',
}

function ActionCard({ msg, onApprove, onCancel, onEdit }: {
  msg: ChatMessage
  onApprove: (editedParams?: Record<string, unknown>) => void
  onCancel: () => void
  onEdit: () => void
}) {
  const action = msg.action!
  const status = msg.actionStatus ?? 'pending'
  const color = TOOL_COLORS[action.tool] ?? '#6366f1'
  const Icon = TOOL_ICONS[action.tool] ?? Bot
  const label = TOOL_LABELS[action.tool] ?? action.tool
  const isDraft = action.tool === 'draft_only'

  const params = (msg.editedParams ?? action.params) as {
    subject?: string; body?: string; roles?: string[]
    verified_only?: boolean; send_email?: boolean
    show_banner?: boolean; banner_message?: string
    audience_description?: string
  }

  const [editing, setEditing] = useState(false)
  const [editSubject, setEditSubject] = useState(params.subject ?? '')
  const [editBody, setEditBody]     = useState(params.body ?? '')

  const statusConfig = {
    pending:   { label: 'Awaiting approval', color: '#f59e0b', icon: AlertTriangle },
    approved:  { label: 'Approved',          color: '#22c55e', icon: CheckCircle },
    executing: { label: 'Executing…',         color: '#6366f1', icon: RefreshCw },
    done:      { label: 'Done',              color: '#22c55e', icon: CheckCircle },
    failed:    { label: 'Failed',            color: '#ef4444', icon: XCircle },
    cancelled: { label: 'Cancelled',         color: '#5a5a60', icon: XCircle },
    editing:   { label: 'Editing',           color: '#22d3ee', icon: Edit3 },
  }
  const sc = statusConfig[status]
  const StatusIcon = sc.icon

  return (
    <div style={{
      border: `1px solid ${color}33`, borderRadius: 12, overflow: 'hidden',
      background: '#0a0a12', marginTop: 8,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: `${color}0e`, borderBottom: `1px solid ${color}22` }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={13} style={{ color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ededef' }}>{label}</div>
          <div style={{ fontSize: 11, color: '#5a5a60' }}>{action.reason}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <StatusIcon size={12} style={{ color: sc.color, animation: status === 'executing' ? 'spin 0.8s linear infinite' : 'none' }} />
          <span style={{ fontSize: 11, color: sc.color, fontWeight: 600 }}>{sc.label}</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px' }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={editSubject} onChange={e => setEditSubject(e.target.value)}
              placeholder="Subject"
              style={{ background: '#111', border: '1px solid #2a2a3e', borderRadius: 8, padding: '8px 12px', color: '#ededef', fontSize: 13, outline: 'none' }} />
            <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={6}
              style={{ background: '#111', border: '1px solid #2a2a3e', borderRadius: 8, padding: '8px 12px', color: '#ededef', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setEditing(false); onApprove({ ...action.params, subject: editSubject, body: editBody }) }}
                style={{ flex: 1, padding: '8px', background: '#22c55e20', border: '1px solid #22c55e40', borderRadius: 8, color: '#22c55e', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                ✓ Save & Send
              </button>
              <button onClick={() => setEditing(false)}
                style={{ padding: '8px 14px', background: '#1a1a1d', border: '1px solid #2a2a2e', borderRadius: 8, color: '#8a8a90', fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {params.subject && <div style={{ fontSize: 12, color: '#8a8a90', marginBottom: 4 }}>Subject</div>}
            {params.subject && <div style={{ fontSize: 13, fontWeight: 600, color: '#ededef', marginBottom: 10 }}>{params.subject}</div>}
            {params.body && <div style={{ fontSize: 12, color: '#8a8a90', marginBottom: 4 }}>Body</div>}
            {params.body && (
              <div style={{ fontSize: 13, color: '#b5b5ba', lineHeight: 1.65, whiteSpace: 'pre-wrap', background: '#0e0e18', border: '1px solid #1e1e2e', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                {params.body}
              </div>
            )}
            {params.audience_description && (
              <div style={{ fontSize: 12, color: '#5a5a60', marginBottom: 10 }}>Audience: {params.audience_description}</div>
            )}
            {params.roles !== undefined && (
              <div style={{ fontSize: 12, color: '#5a5a60', marginBottom: 6 }}>
                Audience: {(params.roles as string[]).length === 0 ? 'All users' : (params.roles as string[]).join(', ')}
                {params.verified_only ? ' · Verified only' : ''}
                {params.show_banner ? ' · + In-app banner' : ''}
              </div>
            )}
          </>
        )}

        {/* Action result */}
        {msg.actionResult && (
          <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: status === 'done' ? '#22c55e10' : '#ef444410', border: `1px solid ${status === 'done' ? '#22c55e30' : '#ef444430'}`, color: status === 'done' ? '#86efac' : '#fca5a5', marginTop: 8 }}>
            {msg.actionResult}
          </div>
        )}

        {/* Buttons */}
        {(status === 'pending') && !editing && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!isDraft && (
              <button onClick={() => onApprove()} style={{
                flex: 1, padding: '9px', background: `${color}18`, border: `1px solid ${color}40`,
                borderRadius: 8, color, fontSize: 12, cursor: 'pointer', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <CheckCircle size={13} /> Approve & Execute
              </button>
            )}
            <button onClick={() => { setEditing(true); onEdit() }} style={{
              padding: '9px 14px', background: '#1a1a1d', border: '1px solid #2a2a2e',
              borderRadius: 8, color: '#b5b5ba', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Edit3 size={12} /> Edit
            </button>
            <button onClick={onCancel} style={{
              padding: '9px 14px', background: '#1a1a1d', border: '1px solid #2a2a2e',
              borderRadius: 8, color: '#5a5a60', fontSize: 12, cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function StatChip({ icon: Icon, label, value, color, warn }: {
  icon: React.ElementType; label: string; value: string | number; color: string; warn?: boolean
}) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: '#0e0e10', border: `1px solid ${warn ? 'rgba(239,68,68,0.3)' : '#1e1e22'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <Icon size={11} style={{ color }} />
        <span style={{ fontSize: 9, color: '#5a5a60', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: warn ? '#f59e0b' : '#ededef', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}

const QUICK = [
  'Give me a full health report',
  'Any issues to fix right now?',
  'Send me a summary email',
  'How is user growth this week?',
  'Am I near any free tier limits?',
  'Draft an update email for all users',
]

/* ── main page ── */
export default function ARIAPage() {
  const [allData, setAllData]   = useState<AllData>({ infra: null, stats: null, neon: null, fetchedAt: '' })
  const [loading, setLoading]   = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [iRes, sRes, nRes] = await Promise.all([
        adminFetch('/api/admin/infra'),
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/neon-usage'),
      ])
      const [infra, stats, neon] = await Promise.all([
        iRes.ok ? iRes.json() : null,
        sRes.ok ? sRes.json() : null,
        nRes.ok ? nRes.json() : null,
      ])
      setAllData({ infra, stats, neon, fetchedAt: new Date().toLocaleTimeString() })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void fetchAll() }, [fetchAll])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    const c = () => setIsMobile(window.innerWidth < 768)
    c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c)
  }, [])

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || sending) return
    setInput('')
    const userMsg: ChatMessage = { role: 'user', text: msg, ts: Date.now() }
    setMessages(m => [...m, userMsg])
    setSending(true)
    try {
      const ctx = buildContext(allData)
      const history = [...messages, userMsg].slice(-10)
        .map(m => `${m.role === 'user' ? 'User' : 'ARIA'}: ${m.text}`)
        .join('\n\n')
      const prompt = `${ctx}\n\n=== CONVERSATION ===\n${history}\n\nARIA:`

      const res = await adminFetch('/api/admin/aria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode: 'chat' }),
      })
      const d = await res.json()
      const aiMsg: ChatMessage = {
        role: 'ai', text: d.result || d.error || 'No response.', ts: Date.now(),
        action: d.action ?? undefined,
        actionStatus: d.action ? 'pending' : undefined,
      }
      setMessages(m => [...m, aiMsg])
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'Error reaching ARIA.', ts: Date.now() }])
    } finally { setSending(false); inputRef.current?.focus() }
  }

  async function executeAction(msgIndex: number, editedParams?: Record<string, unknown>) {
    setMessages(m => m.map((msg, i) => i === msgIndex
      ? { ...msg, actionStatus: 'executing' as MessageStatus, editedParams }
      : msg))

    const msg = messages[msgIndex]
    const action = { ...msg.action!, params: editedParams ?? msg.action!.params }

    try {
      const res = await adminFetch('/api/admin/aria', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const d = await res.json()
      const ok = res.ok && d.ok !== false
      const resultText = ok
        ? action.tool === 'send_broadcast'
          ? `✓ Sent to ${d.data?.recipients ?? '?'} users (${d.data?.succeeded ?? '?'} succeeded)`
          : '✓ Email sent successfully'
        : `✗ ${d.data?.error || d.error || 'Execution failed'}`

      setMessages(m => m.map((msg, i) => i === msgIndex
        ? { ...msg, actionStatus: ok ? 'done' : 'failed', actionResult: resultText }
        : msg))

      setMessages(m => [...m, {
        role: 'ai', text: ok
          ? `Done ✓ — ${resultText}`
          : `Something went wrong: ${resultText}. Want me to retry or try a different approach?`,
        ts: Date.now(),
      }])
    } catch {
      setMessages(m => m.map((msg, i) => i === msgIndex
        ? { ...msg, actionStatus: 'failed', actionResult: '✗ Network error' }
        : msg))
    }
  }

  function cancelAction(msgIndex: number) {
    setMessages(m => m.map((msg, i) => i === msgIndex
      ? { ...msg, actionStatus: 'cancelled' }
      : msg))
    setMessages(m => [...m, { role: 'ai', text: 'Action cancelled. What would you like to do instead?', ts: Date.now() }])
  }

  const i = allData.infra; const s = allData.stats; const n = allData.neon
  const errRate = i ? parseFloat(i.requests.errRatePct) : 0
  const computeHrs = n?.compute_time_seconds != null ? (n.compute_time_seconds / 3600) : null
  const hasIssues = i && (!i.database.ok || errRate >= 5 || i.requests.err5xx > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 116px)', overflow: 'hidden', color: 'white' }}>

      {/* ── Header ── */}
      <div style={{ padding: isMobile ? '14px 16px 0' : '18px 28px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: 'linear-gradient(135deg,#6366f128,#8b5cf628)', border: '1px solid #6366f138', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>ARIA</h1>
              <p style={{ fontSize: 10, color: '#5a5a60', margin: 0 }}>
                AI operator · full data + action access
                {allData.fetchedAt && ` · ${allData.fetchedAt}`}
              </p>
            </div>
          </div>
          <button onClick={() => void fetchAll()} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#0e0e10', border: '1px solid #1e1e22', borderRadius: 8, color: '#8a8a90', fontSize: 11, cursor: 'pointer' }}>
            <RefreshCw size={11} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* Stat chips */}
        {i && s && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3,1fr)' : 'repeat(6,1fr)', gap: 8, marginBottom: 12 }}>
            <StatChip icon={Activity}   label="Error rate"  value={`${i.requests.errRatePct}%`}   color="#f59e0b"  warn={errRate >= 5} />
            <StatChip icon={Database}   label="DB ping"     value={`${i.database.latencyMs}ms`}    color="#22c55e"  warn={i.database.latencyMs > 100} />
            <StatChip icon={Users}      label="Active 24h"  value={i.userActivity.active24h}        color="#a78bfa" />
            <StatChip icon={TrendingUp} label="New today"   value={s.todaySignups}                  color="#22d3ee" />
            <StatChip icon={Cloud}      label="Compute"     value={computeHrs != null ? `${computeHrs.toFixed(1)}` : '—'} color="#fb923c" warn={computeHrs != null && computeHrs >= 70} />
            <StatChip icon={Zap}        label="WebSockets"  value={i.websockets.activeConns}        color="#6366f1" />
          </div>
        )}

        {hasIssues && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 9, marginBottom: 10, fontSize: 12, color: '#fca5a5' }}>
            <AlertTriangle size={12} color="#ef4444" />
            <span>Issues detected</span>
            <button onClick={() => void sendMessage('There are active issues detected. Tell me exactly what is wrong and what to do right now.')}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#ef444418', border: '1px solid #ef444430', borderRadius: 6, color: '#fca5a5', fontSize: 11, cursor: 'pointer' }}>
              Diagnose <ChevronRight size={10} />
            </button>
          </div>
        )}

        {/* Capability chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Email users', color: '#6366f1', icon: Mail },
            { label: 'Email admins', color: '#f59e0b', icon: Shield },
            { label: 'Analyse metrics', color: '#22c55e', icon: Activity },
            { label: 'Draft content', color: '#22d3ee', icon: Edit3 },
          ].map(c => {
            const CIcon = c.icon
            return (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: `${c.color}10`, border: `1px solid ${c.color}25`, borderRadius: 20, fontSize: 10, color: c.color, fontWeight: 600 }}>
                <CIcon size={10} />{c.label}
              </div>
            )
          })}
        </div>

        <div style={{ borderTop: '1px solid #1a1a1d' }} />
      </div>

      {/* ── Chat ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px 16px' : '18px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 20, paddingTop: 10 }}>
            <div style={{ textAlign: 'center', maxWidth: 400 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px', background: 'linear-gradient(135deg,#6366f120,#8b5cf620)', border: '1px solid #6366f128', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={22} style={{ color: '#818cf8' }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#ededef', margin: '0 0 6px' }}>What can I do for you today?</p>
              <p style={{ fontSize: 12, color: '#5a5a60', margin: 0, lineHeight: 1.6 }}>
                I can analyse metrics, diagnose issues, draft emails, and send them — with your approval before anything goes out.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 7, width: '100%', maxWidth: 520 }}>
              {QUICK.map(p => (
                <button key={p} onClick={() => void sendMessage(p)} style={{ padding: '10px 14px', background: '#0e0e10', border: '1px solid #1e1e22', borderRadius: 10, color: '#b5b5ba', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <div key={idx}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: m.role === 'ai' ? '#6366f118' : '#f5c84218', border: `1px solid ${m.role === 'ai' ? '#6366f128' : '#f5c84228'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {m.role === 'ai' ? <Sparkles size={12} style={{ color: '#818cf8' }} /> : <Users size={12} style={{ color: '#f5c842' }} />}
              </div>
              <div style={{ maxWidth: '82%', padding: '10px 14px', borderRadius: 11, background: m.role === 'ai' ? '#0e0e14' : '#131308', border: `1px solid ${m.role === 'ai' ? '#1e1e2e' : '#28280e'}`, fontSize: 13, lineHeight: 1.65 }}>
                {m.role === 'ai' ? formatText(m.text) : <span style={{ color: '#ededef' }}>{m.text}</span>}
                <div style={{ fontSize: 10, color: '#2a2a30', marginTop: 5 }}>
                  {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Action card attached to AI messages */}
            {m.role === 'ai' && m.action && (
              <div style={{ paddingLeft: 38 }}>
                <ActionCard
                  msg={m}
                  onApprove={(editedParams) => void executeAction(idx, editedParams)}
                  onCancel={() => cancelAction(idx)}
                  onEdit={() => {}}
                />
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#6366f118', border: '1px solid #6366f128', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={12} style={{ color: '#818cf8' }} />
            </div>
            <div style={{ padding: '12px 16px', background: '#0e0e14', border: '1px solid #1e1e2e', borderRadius: 11, display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 1, 2].map(j => <div key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: '#6366f1', animation: `bounce 1.2s ${j * 0.2}s ease-in-out infinite` }} />)}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div style={{ padding: isMobile ? '10px 16px' : '12px 28px', borderTop: '1px solid #1a1a1d', background: '#0a0a0b', flexShrink: 0 }}>
        {messages.length > 0 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8, paddingBottom: 2 }}>
            {QUICK.slice(0, 4).map(p => (
              <button key={p} onClick={() => void sendMessage(p)} style={{ padding: '4px 10px', background: '#0e0e10', border: '1px solid #1e1e22', borderRadius: 20, color: '#8a8a90', fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>{p}</button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#0e0e10', border: '1px solid #1e1e22', borderRadius: 11, padding: '0 12px' }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }}
              placeholder={loading ? 'Loading data…' : 'Ask ARIA or give it a task…'}
              disabled={loading}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#ededef', fontSize: 13, padding: '11px 0' }} />
          </div>
          <button onClick={() => void sendMessage()} disabled={!input.trim() || sending || loading}
            style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: input.trim() && !sending ? '#6366f1' : '#1e1e22', border: 'none', cursor: input.trim() && !sending ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
            <Send size={14} style={{ color: input.trim() && !sending ? 'white' : '#5a5a60' }} />
          </button>
        </div>
        <p style={{ fontSize: 10, color: '#1e1e22', textAlign: 'center', margin: '7px 0 0' }}>
          ARIA · Llama 3.1 via Groq · approval required before any action executes
        </p>
      </div>

      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
      `}</style>
    </div>
  )
}
