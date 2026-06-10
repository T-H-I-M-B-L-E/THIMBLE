'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Sparkles, Send, RefreshCw, Users, Activity, Database, Cloud,
  Zap, TrendingUp, AlertTriangle, CheckCircle, XCircle, Edit3,
  Mail, Bot, ChevronRight, Shield, Eye, UserX, UserCheck, Search,
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

type MessageStatus = 'pending' | 'approved' | 'executing' | 'done' | 'failed' | 'cancelled'

interface ChatMessage {
  role: 'user' | 'ai' | 'system'
  text: string
  ts: number
  action?: ActionPayload
  actionStatus?: MessageStatus
  requiresApproval?: boolean
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
  return `=== LIVE THIMBLE PLATFORM DATA (${d.fetchedAt}) ===
INFRA: backend ${i.backend.ok ? 'UP' : 'DOWN'} (${i.backend.uptime}), DB ${i.database.latencyMs}ms (${i.database.ok ? 'healthy' : 'ERROR: ' + i.database.error}), goroutines ${i.runtime.goroutines}, heap ${i.runtime.heapAllocMB}MB
HTTP: ${i.requests.total} total requests, ${i.requests.err5xx} 5xx errors, ${i.requests.errRatePct}% error rate, ${i.websockets.activeConns} active websockets
UPTIME: 24h=${ratios[0] ? parseFloat(ratios[0]).toFixed(2) + '%' : 'unknown'}, 7d=${ratios[1] ? parseFloat(ratios[1]).toFixed(2) + '%' : 'unknown'}, 30d=${ratios[2] ? parseFloat(ratios[2]).toFixed(2) + '%' : 'unknown'}
USERS: ${s.totalUsers} total, ${s.todaySignups} new today, ${s.weekSignups} this week, ${i.userActivity.active24h} active 24h, ${i.userActivity.banned} banned, ${s.pendingVerifications} pending verification, ${s.neverLoggedIn} never logged in
CONTENT: ${s.totalPosts} posts (${s.postsThisWeek} this week), ${s.totalGigs} gigs, ${s.totalLogins} total logins
EMAIL: ${i.emailStats.sentToday} sent today, ${i.emailStats.sentWeek} this week, ${i.emailStats.sentTotal} all-time
NEON DB: ${computeHrs}/100 CU-hrs compute used, ${transferMB}MB data transfer this period
ROLES: ${s.roleBreakdown.map(r => `${r.role || 'none'}=${r.count}`).join(', ')}
${i.tableSizes?.length ? 'DB TABLES: ' + i.tableSizes.map(t => `${t.name}(${t.size},${t.rowCount}rows)`).join(', ') : ''}
${i.recentErrors.length > 0 ? 'RECENT ERRORS: ' + i.recentErrors.slice(0,3).map(e => `${e.method} ${e.path} → ${e.status}`).join('; ') : 'RECENT ERRORS: none'}
=== END DATA ===`
}

/* ── text formatter ── */
function formatText(text: string) {
  return text.split('\n').map((line, i) => {
    const boldHeader = line.match(/^\*\*(.+)\*\*$/)
    if (boldHeader) return <div key={i} style={{ fontWeight: 700, color: '#ededef', marginTop: i > 0 ? 10 : 0, marginBottom: 2 }}>{boldHeader[1]}</div>
    const parts = line.split(/(\*\*[^*]+\*\*)/)
    if (parts.length > 1) {
      return <div key={i} style={{ color: '#cfcfd3', marginTop: 2 }}>{parts.map((p, j) => {
        const m = p.match(/^\*\*(.+)\*\*$/)
        return m ? <strong key={j} style={{ color: '#ededef' }}>{m[1]}</strong> : p
      })}</div>
    }
    if (line.startsWith('- ') || line.startsWith('• ')) return <div key={i} style={{ display: 'flex', gap: 8, color: '#b5b5ba', marginTop: 3 }}><span style={{ color: '#5a5a60', flexShrink: 0 }}>·</span><span>{line.slice(2)}</span></div>
    if (line.trim() === '') return <div key={i} style={{ height: 5 }} />
    return <div key={i} style={{ color: '#cfcfd3' }}>{line}</div>
  })
}

/* ── tool config ── */
const TOOL_META: Record<string, { label: string; color: string; icon: React.ElementType; autoLabel?: string }> = {
  send_broadcast:   { label: 'Send to Users',  color: '#6366f1', icon: Users },
  send_alert_email: { label: 'Email Admins',   color: '#f59e0b', icon: Shield,   autoLabel: 'Auto-send' },
  draft_only:       { label: 'Draft Preview',  color: '#22d3ee', icon: Eye,      autoLabel: 'Preview only' },
  manage_user:      { label: 'User Action',    color: '#e879f9', icon: UserX },
}

/* ── ActionCard ── */
function ActionCard({ msg, onApprove, onCancel }: {
  msg: ChatMessage
  onApprove: (editedParams?: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const action = msg.action!
  const status = msg.actionStatus ?? 'pending'
  const meta = TOOL_META[action.tool] ?? { label: action.tool, color: '#6366f1', icon: Bot }
  const { color, icon: Icon, label } = meta
  const isDraft = action.tool === 'draft_only'
  const needsApproval = msg.requiresApproval !== false

  const params = (msg.editedParams ?? action.params) as {
    subject?: string; body?: string; roles?: string[]
    verified_only?: boolean; show_banner?: boolean
    audience_description?: string
    // manage_user fields
    action?: string; user_id?: string; duration_hours?: number
  }

  const [editing, setEditing]       = useState(false)
  const [editSubject, setEditSubject] = useState(params.subject ?? '')
  const [editBody, setEditBody]       = useState(params.body ?? '')

  const statusConfig: Record<MessageStatus, { label: string; color: string; icon: React.ElementType }> = {
    pending:   { label: needsApproval ? 'Awaiting approval' : 'Ready', color: needsApproval ? '#f59e0b' : '#22d3ee', icon: AlertTriangle },
    approved:  { label: 'Approved',    color: '#22c55e', icon: CheckCircle },
    executing: { label: 'Executing…',  color: '#6366f1', icon: RefreshCw },
    done:      { label: 'Done',        color: '#22c55e', icon: CheckCircle },
    failed:    { label: 'Failed',      color: '#ef4444', icon: XCircle },
    cancelled: { label: 'Cancelled',   color: '#5a5a60', icon: XCircle },
  }
  const sc = statusConfig[status]
  const StatusIcon = sc.icon

  return (
    <div style={{ border: `1px solid ${color}33`, borderRadius: 12, overflow: 'hidden', background: '#090910', marginTop: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: `${color}0c`, borderBottom: `1px solid ${color}20` }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={12} style={{ color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ededef' }}>{label}</div>
          <div style={{ fontSize: 11, color: '#5a5a60', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{action.reason}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <StatusIcon size={11} style={{ color: sc.color, animation: status === 'executing' ? 'spin 0.8s linear infinite' : 'none' }} />
          <span style={{ fontSize: 11, color: sc.color, fontWeight: 600 }}>{sc.label}</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '13px 16px' }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={editSubject} onChange={e => setEditSubject(e.target.value)} placeholder="Subject"
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
            {/* Email preview */}
            {params.subject && <>
              <div style={{ fontSize: 11, color: '#5a5a60', marginBottom: 3 }}>Subject</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#ededef', marginBottom: 10 }}>{params.subject}</div>
            </>}
            {params.body && <>
              <div style={{ fontSize: 11, color: '#5a5a60', marginBottom: 3 }}>Body</div>
              <div style={{ fontSize: 13, color: '#b5b5ba', lineHeight: 1.65, whiteSpace: 'pre-wrap', background: '#0e0e18', border: '1px solid #1e1e2e', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>{params.body}</div>
            </>}
            {params.audience_description && <div style={{ fontSize: 12, color: '#5a5a60', marginBottom: 8 }}>Audience: {params.audience_description}</div>}
            {params.roles !== undefined && (
              <div style={{ fontSize: 12, color: '#5a5a60', marginBottom: 6 }}>
                To: {(params.roles as string[]).length === 0 ? 'All users' : (params.roles as string[]).join(', ')}
                {params.verified_only ? ' · Verified only' : ''}
                {params.show_banner ? ' · + In-app banner' : ''}
              </div>
            )}
            {/* User action preview */}
            {action.tool === 'manage_user' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ padding: '3px 9px', borderRadius: 6, background: `${color}20`, border: `1px solid ${color}30`, fontSize: 12, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{params.action}</span>
                <span style={{ fontSize: 12, color: '#5a5a60', fontFamily: 'monospace' }}>{params.user_id}</span>
                {params.duration_hours ? <span style={{ fontSize: 12, color: '#f59e0b' }}>{params.duration_hours}h</span> : null}
              </div>
            )}
          </>
        )}

        {msg.actionResult && (
          <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: status === 'done' ? '#22c55e10' : '#ef444410', border: `1px solid ${status === 'done' ? '#22c55e30' : '#ef444430'}`, color: status === 'done' ? '#86efac' : '#fca5a5', marginTop: 8 }}>
            {msg.actionResult}
          </div>
        )}

        {status === 'pending' && !editing && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!isDraft && (
              <button onClick={() => onApprove()} style={{ flex: 1, padding: '9px', background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 8, color, fontSize: 12, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <CheckCircle size={12} /> {needsApproval ? 'Approve & Execute' : 'Execute'}
              </button>
            )}
            {(action.tool === 'send_broadcast' || action.tool === 'send_alert_email') && (
              <button onClick={() => setEditing(true)} style={{ padding: '9px 14px', background: '#1a1a1d', border: '1px solid #2a2a2e', borderRadius: 8, color: '#b5b5ba', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Edit3 size={11} /> Edit
              </button>
            )}
            {!isDraft && (
              <button onClick={onCancel} style={{ padding: '9px 14px', background: '#1a1a1d', border: '1px solid #2a2a2e', borderRadius: 8, color: '#5a5a60', fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── StatChip ── */
function StatChip({ icon: Icon, label, value, color, warn }: {
  icon: React.ElementType; label: string; value: string | number; color: string; warn?: boolean
}) {
  return (
    <div style={{ padding: '11px 13px', borderRadius: 10, background: '#0e0e10', border: `1px solid ${warn ? 'rgba(239,68,68,0.3)' : '#1e1e22'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
        <Icon size={10} style={{ color }} />
        <span style={{ fontSize: 9, color: '#5a5a60', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: warn ? '#f59e0b' : '#ededef', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}

const QUICK = [
  'Give me a full health report',
  'Any issues to fix right now?',
  'Am I near any free tier limits?',
  'How is user growth this week?',
  'Draft a welcome email for new users',
  'Send me an admin summary email',
]

const CAPABILITY_CHIPS = [
  { label: 'Email users',    color: '#6366f1', icon: Mail },
  { label: 'Email admins',   color: '#f59e0b', icon: Shield },
  { label: 'Analyse metrics',color: '#22c55e', icon: Activity },
  { label: 'Manage users',   color: '#e879f9', icon: UserCheck },
  { label: 'Draft content',  color: '#22d3ee', icon: Edit3 },
  { label: 'Look up users',  color: '#a78bfa', icon: Search },
]

/* ── main page ── */
export default function ARIAPage() {
  const [allData, setAllData]   = useState<AllData>({ infra: null, stats: null, neon: null, fetchedAt: '' })
  const [loading, setLoading]   = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [iRes, sRes, nRes] = await Promise.all([
        adminFetch('/api/admin/infra'),
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/neon-usage'),
      ])
      const [infra, stats, neon] = await Promise.all([
        iRes.ok ? iRes.json() as Promise<InfraData> : null,
        sRes.ok ? sRes.json() as Promise<AppStats>  : null,
        nRes.ok ? nRes.json() as Promise<NeonUsage> : null,
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
      // Build conversation history for multi-turn context
      const history = [...messages, userMsg].slice(-12).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }))

      const res = await adminFetch('/api/admin/aria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `${ctx}\n\n${msg}`, history }),
      })
      const d = await res.json() as { result: string; action: ActionPayload | null; requiresApproval: boolean | null; error?: string }

      if (!res.ok) {
        setMessages(m => [...m, { role: 'ai', text: `Error: ${d.error ?? 'ARIA is unavailable.'}`, ts: Date.now() }])
        return
      }

      const aiMsg: ChatMessage = {
        role: 'ai',
        text: d.result || (d.action ? `Executing ${d.action.tool}…` : 'No response.'),
        ts: Date.now(),
        action: d.action ?? undefined,
        actionStatus: d.action ? 'pending' : undefined,
        requiresApproval: d.requiresApproval ?? undefined,
      }
      setMessages(m => [...m, aiMsg])

      // Auto-execute low-risk tools that don't need approval
      if (d.action && d.requiresApproval === false && d.action.tool !== 'draft_only') {
        const idx = messages.length + 1 // the aiMsg index
        setTimeout(() => void executeAction(idx, undefined, d.action!), 300)
      }
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'Error reaching ARIA. Is your connection OK?', ts: Date.now() }])
    } finally { setSending(false); inputRef.current?.focus() }
  }

  async function executeAction(msgIndex: number, editedParams?: Record<string, unknown>, actionOverride?: ActionPayload) {
    setMessages(m => m.map((msg, i) => i === msgIndex
      ? { ...msg, actionStatus: 'executing' as MessageStatus, ...(editedParams ? { editedParams } : {}) }
      : msg))

    const msg = messages[msgIndex]
    const action = actionOverride ?? { ...(msg?.action ?? { tool: '', params: {}, reason: '' }), params: editedParams ?? msg?.action?.params ?? {} }

    try {
      const res = await adminFetch('/api/admin/aria', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const d = await res.json() as { ok: boolean; data?: Record<string, unknown>; error?: string }
      const ok = res.ok && d.ok !== false

      let resultText = ''
      if (ok) {
        if (action.tool === 'send_broadcast') resultText = `✓ Sent to ${d.data?.recipients ?? '?'} users (${d.data?.succeeded ?? '?'} succeeded)`
        else if (action.tool === 'manage_user') resultText = `✓ ${(d.data?.message as string) ?? 'Done'}`
        else resultText = '✓ Executed successfully'
      } else {
        resultText = `✗ ${d.error ?? (d.data?.error as string) ?? 'Execution failed'}`
      }

      setMessages(m => m.map((msg, i) => i === msgIndex
        ? { ...msg, actionStatus: ok ? 'done' : 'failed', actionResult: resultText }
        : msg))
      setMessages(m => [...m, {
        role: 'ai',
        text: ok ? `Done ✓ — ${resultText}` : `Something went wrong: ${resultText}\n\nWant me to retry or try a different approach?`,
        ts: Date.now(),
      }])
    } catch {
      setMessages(m => m.map((msg, i) => i === msgIndex
        ? { ...msg, actionStatus: 'failed', actionResult: '✗ Network error' }
        : msg))
    }
  }

  function cancelAction(msgIndex: number) {
    setMessages(m => m.map((msg, i) => i === msgIndex ? { ...msg, actionStatus: 'cancelled' } : msg))
    setMessages(m => [...m, { role: 'ai', text: 'Cancelled. What would you like to do instead?', ts: Date.now() }])
  }

  const i = allData.infra; const s = allData.stats; const n = allData.neon
  const errRate    = i ? parseFloat(i.requests.errRatePct) : 0
  const computeHrs = n?.compute_time_seconds != null ? (n.compute_time_seconds / 3600) : null
  const hasIssues  = i && (!i.database.ok || errRate >= 5 || i.requests.err5xx > 10)

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
              <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>ARIA</h1>
              <p style={{ fontSize: 10, color: '#5a5a60', margin: 0 }}>
                Autonomous operator · 4 tools · multi-turn context
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
            <StatChip icon={Cloud}      label="Compute"     value={computeHrs != null ? `${computeHrs.toFixed(1)}h` : '—'} color="#fb923c" warn={computeHrs != null && computeHrs >= 70} />
            <StatChip icon={Zap}        label="WS conns"    value={i.websockets.activeConns}        color="#6366f1" />
          </div>
        )}

        {hasIssues && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 9, marginBottom: 10, fontSize: 12, color: '#fca5a5' }}>
            <AlertTriangle size={12} color="#ef4444" />
            <span>Issues detected</span>
            <button onClick={() => void sendMessage('Active issues detected. Tell me exactly what is wrong and what to do right now.')}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#ef444418', border: '1px solid #ef444430', borderRadius: 6, color: '#fca5a5', fontSize: 11, cursor: 'pointer' }}>
              Diagnose <ChevronRight size={10} />
            </button>
          </div>
        )}

        {/* Capability chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {CAPABILITY_CHIPS.map(c => {
            const CIcon = c.icon
            return (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: `${c.color}10`, border: `1px solid ${c.color}22`, borderRadius: 20, fontSize: 10, color: c.color, fontWeight: 600 }}>
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
            <div style={{ textAlign: 'center', maxWidth: 420 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px', background: 'linear-gradient(135deg,#6366f120,#8b5cf620)', border: '1px solid #6366f128', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={22} style={{ color: '#818cf8' }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#ededef', margin: '0 0 6px' }}>What can I do for you today?</p>
              <p style={{ fontSize: 12, color: '#5a5a60', margin: '0 0 16px', lineHeight: 1.6 }}>
                I analyse metrics, answer questions, manage users, and send emails — with your approval before anything impactful goes out.
              </p>
              {/* Tool registry display */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxWidth: 360, margin: '0 auto' }}>
                {Object.entries(TOOL_META).map(([name, meta]) => {
                  const TIcon = meta.icon
                  return (
                    <div key={name} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '9px 12px', background: '#0e0e10', border: `1px solid ${meta.color}20`, borderRadius: 9 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: `${meta.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <TIcon size={11} style={{ color: meta.color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#ededef' }}>{meta.label}</div>
                        <div style={{ fontSize: 10, color: meta.autoLabel ? '#22d3ee' : '#f59e0b' }}>
                          {meta.autoLabel ?? 'Needs approval'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
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
                <div style={{ fontSize: 10, color: '#2a2a30', marginTop: 4 }}>
                  {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {m.role === 'ai' && m.action && (
              <div style={{ paddingLeft: 38 }}>
                <ActionCard
                  msg={m}
                  onApprove={(editedParams) => void executeAction(idx, editedParams)}
                  onCancel={() => cancelAction(idx)}
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
        <p style={{ fontSize: 10, color: '#222228', textAlign: 'center', margin: '7px 0 0' }}>
          ARIA · Llama 3.1 · Groq · native tool-calling · approval required for high-impact actions
        </p>
      </div>

      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
      `}</style>
    </div>
  )
}
