'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Bot, Send, RefreshCw, Sparkles, Zap, TrendingUp, Users, Mail, Database, Activity, Cloud, Clock, AlertTriangle } from 'lucide-react'
import { adminFetch } from '@/lib/adminFetch'

/* ── types ── */
interface InfraData {
  backend:       { ok: boolean; uptime: string; uptimeSec: number }
  database:      { ok: boolean; error: string; latencyMs: number; connsOpen: number; connsIdle: number; connsTotal: number }
  runtime:       { goroutines: number; heapAllocMB: string; heapSysMB: string; gcPauseLastMs: string; gcRuns: number }
  requests:      { total: number; ok: number; err4xx: number; err5xx: number; errRatePct: string }
  websockets:    { activeConns: number }
  recentErrors:  { time: string; method: string; path: string; status: number; latencyMs: number }[]
  recentSlows:   { time: string; method: string; path: string; status: number; latencyMs: number }[]
  slowestRoutes: { method: string; path: string; hits: number; avgMs: number; maxMs: number }[] | null
  alerts:        { thresholds: { errRatePct: number; slowMs: number } }
  uptimeRobot:   { monitors: { friendly_name: string; status: number; custom_uptime_ratio: string; average_response_time: string }[] } | null
  emailStats:    { sentToday: number; sentWeek: number; sentTotal: number; lastSentAt: string }
  userActivity:  { active24h: number; active7d: number; newToday: number; newThisWeek: number; total: number; banned: number }
  tableSizes:    { name: string; size: string; rowCount: number }[] | null
}

interface AppStats {
  totalUsers: number; todaySignups: number; weekSignups: number
  pendingVerifications: number; verifiedUsers: number
  totalPosts: number; postsThisWeek: number; totalGigs: number
  totalLogins: number; returnedUsers: number; neverLoggedIn: number
  adminCount: number
  roleBreakdown: { role: string; count: number }[]
  dailySignups: { date: string; count: number }[]
}

interface NeonUsage {
  compute_time_seconds?: number
  data_transfer_bytes?: number
  data_storage_bytes_hour?: number
}

interface AllData {
  infra: InfraData | null
  stats: AppStats | null
  neon: NeonUsage | null
  fetchedAt: string
}

interface ChatMessage {
  role: 'user' | 'ai'
  text: string
  ts: number
}

/* ── helpers ── */
function buildContext(d: AllData): string {
  const i = d.infra
  const s = d.stats
  const n = d.neon
  if (!i || !s) return 'Data not yet loaded.'

  const computeHrs = n?.compute_time_seconds != null ? (n.compute_time_seconds / 3600).toFixed(1) : 'unknown'
  const transferMB = n?.data_transfer_bytes != null ? (n.data_transfer_bytes / 1024 / 1024).toFixed(1) : 'unknown'
  const storageKB  = n?.data_storage_bytes_hour != null ? (n.data_storage_bytes_hour / 1024).toFixed(0) : 'unknown'

  const monitor = i.uptimeRobot?.monitors[0]
  const uptimeRatios = monitor ? (monitor.custom_uptime_ratio || '').split('-') : []
  const uptime24h = uptimeRatios[0] ? parseFloat(uptimeRatios[0]).toFixed(2) + '%' : 'unknown'
  const uptime7d  = uptimeRatios[1] ? parseFloat(uptimeRatios[1]).toFixed(2) + '%' : 'unknown'
  const uptime30d = uptimeRatios[2] ? parseFloat(uptimeRatios[2]).toFixed(2) + '%' : 'unknown'

  return `You are ARIA (Automated THIMBLE Infrastructure Analyst), the AI assistant for THIMBLE — a social platform for creative professionals. You have full real-time access to all application metrics. Be direct, specific, and actionable. Use plain language, no jargon dumps.

=== LIVE SNAPSHOT (fetched ${d.fetchedAt}) ===

INFRASTRUCTURE:
- Backend status: ${i.backend.ok ? 'UP' : 'DOWN'}, uptime: ${i.backend.uptime}
- DB ping: ${i.database.latencyMs}ms | connections: ${i.database.connsOpen} open / ${i.database.connsTotal} total / ${i.database.connsIdle} idle
- DB status: ${i.database.ok ? 'healthy' : 'ERROR: ' + i.database.error}
- Go runtime: ${i.runtime.goroutines} goroutines, heap ${i.runtime.heapAllocMB}MB / ${i.runtime.heapSysMB}MB sys, GC pauses ${i.runtime.gcPauseLastMs}ms
- HTTP: ${i.requests.total} total requests | ${i.requests.ok} ok | ${i.requests.err4xx} 4xx | ${i.requests.err5xx} 5xx | error rate ${i.requests.errRatePct}%
- Active WebSocket connections: ${i.websockets.activeConns}
- Recent 5xx errors: ${i.recentErrors.length}
- Slow requests (>${i.alerts.thresholds.slowMs}ms): ${i.recentSlows.length}
${i.slowestRoutes?.length ? `- Slowest route: ${i.slowestRoutes[0].method} ${i.slowestRoutes[0].path} avg ${i.slowestRoutes[0].avgMs}ms` : ''}

EXTERNAL UPTIME (UptimeRobot):
- 24h: ${uptime24h} | 7d: ${uptime7d} | 30d: ${uptime30d}
- Avg response time: ${monitor ? parseFloat(monitor.average_response_time || '0').toFixed(0) + 'ms' : 'unknown'}
- Current status: ${monitor ? (monitor.status === 2 ? 'UP' : 'DOWN') : 'unknown'}

NEON DATABASE (free tier: 100 CU-hrs/month, 512MB storage, 5GB transfer):
- Compute used this month: ${computeHrs} / 100 CU-hrs
- Data transfer: ${transferMB} MB / 5120 MB
- Storage: ${storageKB} KB-hrs

EMAIL (via Resend):
- Sent today: ${i.emailStats.sentToday}
- Sent this week: ${i.emailStats.sentWeek}
- Total all-time: ${i.emailStats.sentTotal}
- Last sent: ${i.emailStats.lastSentAt || 'never'}

USERS:
- Total registered: ${s.totalUsers}
- Signed up today: ${s.todaySignups} | this week: ${s.weekSignups}
- Active (24h): ${i.userActivity.active24h} | active (7d): ${i.userActivity.active7d}
- Returned users: ${s.returnedUsers} | never logged in: ${s.neverLoggedIn}
- Verified: ${s.verifiedUsers} | pending verification: ${s.pendingVerifications}
- Banned: ${i.userActivity.banned} | admins: ${s.adminCount}
- Total logins ever: ${s.totalLogins}

CONTENT:
- Total posts: ${s.totalPosts} | posts this week: ${s.postsThisWeek}
- Total gigs: ${s.totalGigs}

ROLES: ${s.roleBreakdown.map(r => `${r.role || 'none'}: ${r.count}`).join(', ')}

DAILY SIGNUPS (last 7 days): ${s.dailySignups.slice(-7).map(d => `${d.date.slice(5)}: ${d.count}`).join(', ')}

${i.tableSizes?.length ? `LARGEST DB TABLES: ${i.tableSizes.slice(0, 5).map(t => `${t.name} (${t.size}, ${t.rowCount.toLocaleString()} rows)`).join(', ')}` : ''}

=== END SNAPSHOT ===`
}

function StatChip({ icon: Icon, label, value, color, warn }: {
  icon: React.ElementType; label: string; value: string | number; color: string; warn?: boolean
}) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: '#0e0e10', border: `1px solid ${warn ? 'rgba(239,68,68,0.3)' : '#1e1e22'}`,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={13} style={{ color }} />
        </div>
        <span style={{ fontSize: 10, color: '#5a5a60', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <span style={{ fontSize: 22, fontWeight: 700, color: warn ? '#f59e0b' : '#ededef', letterSpacing: '-0.02em' }}>{value}</span>
    </div>
  )
}

function formatAIText(text: string) {
  return text.split('\n').map((line, i) => {
    if (/^\*\*(.+)\*\*$/.test(line)) return <div key={i} style={{ fontWeight: 700, color: '#ededef', marginTop: i > 0 ? 10 : 0 }}>{line.replace(/\*\*/g, '')}</div>
    if (line.startsWith('**')) {
      const match = line.match(/\*\*(.+?)\*\*(.*)/)
      if (match) return <div key={i} style={{ marginTop: i > 0 ? 6 : 0 }}><strong style={{ color: '#ededef' }}>{match[1]}</strong><span style={{ color: '#b5b5ba' }}>{match[2]}</span></div>
    }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return <div key={i} style={{ paddingLeft: 12, color: '#b5b5ba', display: 'flex', gap: 8, marginTop: 3 }}><span style={{ color: '#5a5a60', flexShrink: 0 }}>·</span><span>{line.slice(2)}</span></div>
    }
    if (line.trim() === '') return <div key={i} style={{ height: 6 }} />
    return <div key={i} style={{ color: '#cfcfd3' }}>{line}</div>
  })
}

const QUICK_PROMPTS = [
  'Give me a full health report',
  'Any issues I should fix today?',
  'How is user growth looking?',
  'Am I close to any free tier limits?',
  'Which API routes are slow and why?',
  'Summarise this week in one paragraph',
]

/* ── main page ── */
export default function AIPage() {
  const [allData, setAllData] = useState<AllData>({ infra: null, stats: null, neon: null, fetchedAt: '' })
  const [loadingData, setLoadingData] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchAllData = useCallback(async () => {
    setLoadingData(true)
    try {
      const [infraRes, statsRes, neonRes] = await Promise.all([
        adminFetch('/api/admin/infra'),
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/neon-usage'),
      ])
      const [infra, stats, neon] = await Promise.all([
        infraRes.ok ? infraRes.json() : null,
        statsRes.ok ? statsRes.json() : null,
        neonRes.ok ? neonRes.json() : null,
      ])
      setAllData({ infra, stats, neon, fetchedAt: new Date().toLocaleTimeString() })
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => { void fetchAllData() }, [fetchAllData])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check)
  }, [])

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || sending) return
    setInput('')
    const userMsg: ChatMessage = { role: 'user', text: msg, ts: Date.now() }
    setMessages(m => [...m, userMsg])
    setSending(true)
    try {
      const context = buildContext(allData)
      const history = [...messages, userMsg].slice(-12).map(m => `${m.role === 'user' ? 'User' : 'ARIA'}: ${m.text}`).join('\n\n')
      const prompt = `${context}\n\n=== CONVERSATION ===\n${history}\n\nARIA:`
      const res = await adminFetch('/api/admin/ai-infra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode: 'chat' }),
      })
      const d = await res.json()
      setMessages(m => [...m, { role: 'ai', text: d.result || d.error || 'No response.', ts: Date.now() }])
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'Error reaching AI — check your GROQ_API_KEY.', ts: Date.now() }])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const i = allData.infra
  const s = allData.stats
  const n = allData.neon
  const errRate = i ? parseFloat(i.requests.errRatePct) : 0
  const computeHrs = n?.compute_time_seconds != null ? (n.compute_time_seconds / 3600) : null
  const hasIssues = i && (!i.database.ok || errRate >= 5 || i.requests.err5xx > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 116px)', overflow: 'hidden', color: 'white' }}>

      {/* ── Header ── */}
      <div style={{ padding: isMobile ? '16px 16px 0' : '20px 28px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f130, #8b5cf630)',
              border: '1px solid #6366f140',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={18} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>ARIA</h1>
              <p style={{ fontSize: 11, color: '#5a5a60', margin: 0 }}>
                Automated THIMBLE Infrastructure Analyst · full data access
                {allData.fetchedAt && <span> · snapshot at {allData.fetchedAt}</span>}
              </p>
            </div>
          </div>
          <button onClick={() => void fetchAllData()} disabled={loadingData} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
            background: '#0e0e10', border: '1px solid #1e1e22', borderRadius: 8,
            color: '#8a8a90', fontSize: 12, cursor: 'pointer',
          }}>
            <RefreshCw size={12} style={{ animation: loadingData ? 'spin 0.8s linear infinite' : 'none' }} />
            {loadingData ? 'Loading…' : 'Refresh data'}
          </button>
        </div>

        {/* ── Live stat chips ── */}
        {i && s && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(6,1fr)', gap: 8, marginBottom: 16 }}>
            <StatChip icon={Activity}    label="Error rate"   value={`${i.requests.errRatePct}%`}  color="#f59e0b" warn={errRate >= 5} />
            <StatChip icon={Database}    label="DB ping"      value={`${i.database.latencyMs}ms`}   color="#22c55e" warn={i.database.latencyMs > 100} />
            <StatChip icon={Users}       label="Active 24h"   value={i.userActivity.active24h}       color="#a78bfa" />
            <StatChip icon={TrendingUp}  label="New today"    value={s.todaySignups}                 color="#22d3ee" />
            <StatChip icon={Cloud}       label="Compute"      value={computeHrs != null ? `${computeHrs.toFixed(1)} CU` : '—'} color="#fb923c" warn={computeHrs != null && computeHrs >= 70} />
            <StatChip icon={Zap}         label="WebSockets"   value={i.websockets.activeConns}       color="#6366f1" />
          </div>
        )}

        {hasIssues && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, marginBottom: 12, fontSize: 12, color: '#fca5a5' }}>
            <AlertTriangle size={13} color="#ef4444" />
            <span>Issues detected — ask ARIA what to do</span>
            <button onClick={() => void sendMessage('There are active issues. Tell me exactly what is wrong and what I should do right now.')}
              style={{ marginLeft: 'auto', padding: '4px 10px', background: '#ef444420', border: '1px solid #ef444440', borderRadius: 6, color: '#fca5a5', fontSize: 11, cursor: 'pointer' }}>
              Diagnose now
            </button>
          </div>
        )}

        {/* divider */}
        <div style={{ borderTop: '1px solid #1a1a1d' }} />
      </div>

      {/* ── Chat area ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Welcome / empty state */}
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 24, paddingTop: 20 }}>
            <div style={{ textAlign: 'center', maxWidth: 420 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
                background: 'linear-gradient(135deg, #6366f125, #8b5cf625)',
                border: '1px solid #6366f130',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={24} style={{ color: '#818cf8' }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#ededef', margin: '0 0 8px' }}>Ask me anything about THIMBLE</p>
              <p style={{ fontSize: 13, color: '#5a5a60', margin: 0, lineHeight: 1.6 }}>
                I have live access to all your infrastructure, user, content, and cost metrics. I can diagnose issues, spot trends, and tell you what to do next.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, width: '100%', maxWidth: 560 }}>
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => void sendMessage(p)} style={{
                  padding: '10px 14px', background: '#0e0e10', border: '1px solid #1e1e22',
                  borderRadius: 10, color: '#b5b5ba', fontSize: 12, cursor: 'pointer', textAlign: 'left',
                  transition: 'border-color 0.15s',
                }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((m, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: m.role === 'ai' ? '#6366f118' : '#f5c84218',
              border: `1px solid ${m.role === 'ai' ? '#6366f130' : '#f5c84230'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {m.role === 'ai'
                ? <Sparkles size={13} style={{ color: '#818cf8' }} />
                : <Users size={13} style={{ color: '#f5c842' }} />}
            </div>
            <div style={{
              maxWidth: '80%', padding: '12px 16px', borderRadius: 12,
              background: m.role === 'ai' ? '#0e0e14' : '#131308',
              border: `1px solid ${m.role === 'ai' ? '#1e1e2e' : '#28280e'}`,
              fontSize: 13, lineHeight: 1.65,
            }}>
              {m.role === 'ai' ? formatAIText(m.text) : <span style={{ color: '#ededef' }}>{m.text}</span>}
              <div style={{ fontSize: 10, color: '#3a3a40', marginTop: 6 }}>
                {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#6366f118', border: '1px solid #6366f130', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={13} style={{ color: '#818cf8' }} />
            </div>
            <div style={{ padding: '14px 18px', background: '#0e0e14', border: '1px solid #1e1e2e', borderRadius: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={{ padding: isMobile ? '12px 16px' : '14px 28px', borderTop: '1px solid #1a1a1d', background: '#0a0a0b', flexShrink: 0 }}>
        {/* Quick prompts row (only when chat has messages) */}
        {messages.length > 0 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10, paddingBottom: 2 }}>
            {QUICK_PROMPTS.slice(0, 4).map(p => (
              <button key={p} onClick={() => void sendMessage(p)} style={{
                padding: '5px 12px', background: '#0e0e10', border: '1px solid #1e1e22',
                borderRadius: 20, color: '#8a8a90', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}>{p}</button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#0e0e10', border: '1px solid #1e1e22', borderRadius: 12, padding: '0 14px' }}>
            <Clock size={13} style={{ color: '#3a3a40', flexShrink: 0, marginRight: 8 }} />
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }}
              placeholder={loadingData ? 'Loading data…' : 'Ask about errors, growth, costs, performance…'}
              disabled={loadingData}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#ededef', fontSize: 13, padding: '12px 0',
              }}
            />
          </div>
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || sending || loadingData}
            style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: input.trim() && !sending ? '#6366f1' : '#1e1e22',
              border: 'none', cursor: input.trim() && !sending ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}
          >
            <Send size={15} style={{ color: input.trim() && !sending ? 'white' : '#5a5a60' }} />
          </button>
        </div>
        <p style={{ fontSize: 10, color: '#2a2a2e', textAlign: 'center', margin: '8px 0 0' }}>
          ARIA · powered by Llama 3.1 via Groq · data refreshed every load
        </p>
      </div>

      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
      `}</style>
    </div>
  )
}
