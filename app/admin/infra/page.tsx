'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Activity, Database, Cpu, Zap, Wifi, RefreshCw, CheckCircle, XCircle,
  AlertTriangle, Clock, ExternalLink, Radio, Mail, Users, TrendingUp,
  Cloud, Sparkles, ChevronDown, ChevronUp, Send, Bot
} from 'lucide-react'
import { adminFetch } from '@/lib/adminFetch'

interface ErrorEntry  { time: string; method: string; path: string; status: number; latencyMs: number }
interface SlowEntry   { time: string; method: string; path: string; status: number; latencyMs: number }
interface QueryRow    { query: string; calls: number; meanMs: number; totalMs: number; stddevMs: number }
interface RouteRow    { method: string; path: string; hits: number; avgMs: number; maxMs: number; totalMs: number }
interface TableSize   { name: string; size: string; sizeBytes: number; rowCount: number }

interface UptimeMonitor {
  id: number; friendly_name: string; url: string; status: number
  custom_uptime_ratio: string; average_response_time: string
}

interface InfraData {
  backend:       { ok: boolean; uptime: string; uptimeSec: number }
  database:      { ok: boolean; error: string; latencyMs: number; connsOpen: number; connsIdle: number; connsTotal: number }
  runtime:       { goroutines: number; heapAllocMB: string; heapSysMB: string; gcPauseLastMs: string; gcRuns: number }
  requests:      { total: number; ok: number; err4xx: number; err5xx: number; errRatePct: string }
  websockets:    { activeConns: number }
  recentErrors:  ErrorEntry[]
  recentSlows:   SlowEntry[]
  slowQueries:   QueryRow[] | null
  slowestRoutes: RouteRow[] | null
  alerts:        { thresholds: { errRatePct: number; slowMs: number } }
  uptimeRobot:   { monitors: UptimeMonitor[] } | null
  emailStats:    { sentToday: number; sentWeek: number; sentTotal: number; lastSentAt: string }
  userActivity:  { active24h: number; active7d: number; newToday: number; newThisWeek: number; total: number; banned: number }
  tableSizes:    TableSize[] | null
}

interface NeonUsage {
  compute_time_seconds?: number
  active_time_seconds?: number
  written_data_bytes?: number
  data_transfer_bytes?: number
  data_storage_bytes_hour?: number
}

/* ── tiny helpers ── */
function StatusDot({ ok, pulse }: { ok: boolean; pulse?: boolean }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 10, height: 10 }}>
      {pulse && ok && (
        <span style={{
          position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
          background: '#22c55e', opacity: 0.4,
          animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
        }} />
      )}
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
        background: ok ? '#22c55e' : '#ef4444',
        boxShadow: ok ? '0 0 6px #22c55e88' : '0 0 6px #ef444488',
        flexShrink: 0,
      }} />
    </span>
  )
}

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 14, height: 14, borderRadius: '50%', border: '1px solid #3a3a40',
        color: '#5a5a60', fontSize: 9, fontWeight: 700, cursor: 'help', lineHeight: 1,
      }}>i</span>
      {show && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1d', border: '1px solid #2a2a2e', borderRadius: 8,
          padding: '8px 12px', fontSize: 12, lineHeight: 1.5, color: '#cfcfd3',
          whiteSpace: 'normal', width: 240, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          zIndex: 50, pointerEvents: 'none', textAlign: 'left',
        }}>{text}</span>
      )}
    </span>
  )
}

function Pill({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 4, background: `${color}22`, color, border: `1px solid ${color}44` }}>{label}</span>
}

function MiniBar({ value, max, color = '#22c55e', height = 4 }: { value: number; max: number; color?: string; height?: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100))
  return (
    <div style={{ height, background: '#232326', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function Row({ label, value, warn, tooltip, big }: { label: string; value: React.ReactNode; warn?: boolean; tooltip?: string; big?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: big ? 14 : 13, color: '#8a8a90', display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}{tooltip && <Tooltip text={tooltip} />}
      </span>
      <span style={{ fontSize: big ? 14 : 13, fontWeight: 600, color: warn ? '#f59e0b' : '#ededef', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5a5a60', marginBottom: 10 }}>{children}</div>
}

function Card({ title, icon: Icon, children, status, tooltip, accent }: {
  title: string; icon: React.ElementType; children: React.ReactNode; status?: boolean; tooltip?: string; accent?: string
}) {
  return (
    <div style={{
      background: '#0e0e10',
      border: `1px solid ${status === false ? 'rgba(239,68,68,0.4)' : accent ? `${accent}33` : '#1e1e22'}`,
      borderRadius: 14, padding: '18px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: accent ? `${accent}18` : '#1a1a1d',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={14} style={{ color: accent || '#8a8a90' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9a9aa0' }}>{title}</span>
        {tooltip && <Tooltip text={tooltip} />}
        {status !== undefined && <span style={{ marginLeft: 'auto' }}>{status ? <CheckCircle size={14} color="#22c55e" /> : <XCircle size={14} color="#ef4444" />}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function LogTable({ rows, emptyMsg }: { rows: (ErrorEntry | SlowEntry)[]; emptyMsg: string }) {
  if (!rows.length) return <p style={{ fontSize: 13, color: '#5a5a60', margin: 0 }}>{emptyMsg}</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['Time', 'Method', 'Path', 'Status', 'Latency'].map(h => (
              <th key={h} style={{ padding: '4px 8px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10, borderBottom: '1px solid #1e1e22', color: '#5a5a60', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #1a1a1d' }}>
              <td style={{ padding: '6px 8px', color: '#5a5a60', whiteSpace: 'nowrap' }}>{timeAgo(r.time)}</td>
              <td style={{ padding: '6px 8px' }}><Pill label={r.method} color={r.method === 'GET' ? '#6366f1' : '#f59e0b'} /></td>
              <td style={{ padding: '6px 8px', color: '#b5b5ba', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.path}</td>
              <td style={{ padding: '6px 8px' }}><Pill label={String(r.status)} color={r.status >= 500 ? '#ef4444' : r.status >= 400 ? '#f59e0b' : '#22c55e'} /></td>
              <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums', color: r.latencyMs > 500 ? '#f59e0b' : '#8a8a90' }}>{r.latencyMs}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── AI Analysis Panel ── */
function buildSystemPrompt(data: InfraData, neon: NeonUsage | null): string {
  const errRate = parseFloat(data.requests.errRatePct)
  const computeHrs = neon?.compute_time_seconds != null ? (neon.compute_time_seconds / 3600).toFixed(1) : 'unknown'
  const transferMB = neon?.data_transfer_bytes != null ? (neon.data_transfer_bytes / 1024 / 1024).toFixed(1) : 'unknown'

  return `You are an infrastructure analyst for THIMBLE, a social app. Analyse these live metrics and give a concise health report.

CURRENT METRICS:
- Backend uptime: ${data.backend.uptime}
- DB ping: ${data.database.latencyMs}ms, connections: ${data.database.connsOpen}/${data.database.connsTotal} open
- Goroutines: ${data.runtime.goroutines}, Heap: ${data.runtime.heapAllocMB}MB / ${data.runtime.heapSysMB}MB
- Requests: ${data.requests.total} total, ${data.requests.ok} ok, ${data.requests.err4xx} 4xx, ${data.requests.err5xx} 5xx, error rate: ${errRate}%
- Active WebSockets: ${data.websockets.activeConns}
- Users: ${data.userActivity.total} total, ${data.userActivity.active24h} active 24h, ${data.userActivity.newToday} new today
- Emails sent today: ${data.emailStats.sentToday}
- Neon compute this month: ${computeHrs} / 100 CU-hrs
- Neon data transfer: ${transferMB} MB
- Recent 5xx errors: ${data.recentErrors.length}
- Slow requests: ${data.recentSlows.length}
${data.slowestRoutes?.length ? `- Slowest route: ${data.slowestRoutes[0].path} avg ${data.slowestRoutes[0].avgMs}ms` : ''}

Respond in this format:
**Overall Health:** [GOOD / WATCH / CRITICAL] — one sentence summary.

**What's working well:** bullet points (max 3)

**Issues to watch:** bullet points (max 3, or "None" if all clear)

**Recommended action:** one specific thing to do today, or "Nothing urgent"

Be direct, technical, and brief. No fluff.`
}

function AIPanel({ data, neon }: { data: InfraData; neon: NeonUsage | null }) {
  const [open, setOpen] = useState(false)
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [question, setQuestion] = useState('')
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    setAnalysis('')
    try {
      const res = await fetch('/api/admin/ai-infra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: buildSystemPrompt(data, neon), mode: 'analyse' }),
      })
      const d = await res.json()
      setAnalysis(d.result || d.error || 'No response')
    } catch {
      setAnalysis('Failed to reach AI endpoint.')
    } finally {
      setLoading(false)
    }
  }, [data, neon])

  useEffect(() => {
    if (open && !analysis && !loading) void runAnalysis()
  }, [open, analysis, loading, runAnalysis])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  async function sendQuestion() {
    const q = question.trim()
    if (!q || chatLoading) return
    setQuestion('')
    setChatHistory(h => [...h, { role: 'user', text: q }])
    setChatLoading(true)
    try {
      const context = buildSystemPrompt(data, neon)
      const res = await fetch('/api/admin/ai-infra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: context + '\n\nUser question: ' + q, mode: 'chat' }),
      })
      const d = await res.json()
      setChatHistory(h => [...h, { role: 'ai', text: d.result || d.error || 'No response' }])
    } catch {
      setChatHistory(h => [...h, { role: 'ai', text: 'Error reaching AI.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const healthColor = analysis.includes('CRITICAL') ? '#ef4444' : analysis.includes('WATCH') ? '#f59e0b' : '#22c55e'

  return (
    <div style={{
      marginBottom: 16, borderRadius: 14, overflow: 'hidden',
      border: '1px solid #6366f133', background: 'linear-gradient(135deg, #0e0e14 0%, #0e0e10 100%)',
    }}>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #6366f133, #8b5cf633)',
          border: '1px solid #6366f144',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={15} style={{ color: '#818cf8' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#ededef' }}>AI Infrastructure Analysis</div>
          <div style={{ fontSize: 11, color: '#5a5a60', marginTop: 1 }}>
            {analysis
              ? <span style={{ color: healthColor, fontWeight: 600 }}>{analysis.includes('CRITICAL') ? 'Critical issues detected' : analysis.includes('WATCH') ? 'Minor issues to watch' : 'All systems healthy'}</span>
              : 'Click to analyse your current metrics'}
          </div>
        </div>
        <div style={{ color: '#5a5a60' }}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
      </button>

      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ borderTop: '1px solid #1e1e22', paddingTop: 16 }}>
            {/* Analysis output */}
            <div style={{
              background: '#080810', borderRadius: 10, padding: 16,
              border: '1px solid #1e1e28', marginBottom: 14, minHeight: 80,
            }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5a5a60', fontSize: 13 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #232326', borderTopColor: '#6366f1', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  Analysing metrics…
                </div>
              ) : analysis ? (
                <pre style={{ fontSize: 13, color: '#cfcfd3', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                  {analysis.split('\n').map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**')) return <strong key={i} style={{ color: '#ededef' }}>{line.replace(/\*\*/g, '')}</strong>
                    if (line.startsWith('**')) {
                      const parts = line.split('**')
                      return <span key={i}><strong style={{ color: '#ededef' }}>{parts[1]}</strong>{parts[2]}{'\n'}</span>
                    }
                    return <span key={i}>{line}{'\n'}</span>
                  })}
                </pre>
              ) : null}
            </div>

            <button onClick={() => void runAnalysis()} disabled={loading} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              background: '#6366f118', border: '1px solid #6366f133', borderRadius: 8,
              color: '#818cf8', fontSize: 12, cursor: 'pointer', marginBottom: 16,
            }}>
              <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
              Re-analyse
            </button>

            {/* Chat */}
            <SectionLabel>Ask a question about your infra</SectionLabel>
            {chatHistory.length > 0 && (
              <div style={{ marginBottom: 10, maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {chatHistory.map((m, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      background: m.role === 'ai' ? '#6366f122' : '#f5c84222',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {m.role === 'ai' ? <Bot size={12} style={{ color: '#818cf8' }} /> : <Users size={12} style={{ color: '#f5c842' }} />}
                    </div>
                    <div style={{
                      fontSize: 13, lineHeight: 1.6, color: '#cfcfd3',
                      background: m.role === 'ai' ? '#0a0a12' : '#12120a',
                      border: `1px solid ${m.role === 'ai' ? '#1e1e28' : '#28281e'}`,
                      borderRadius: 8, padding: '8px 12px', maxWidth: '85%',
                      whiteSpace: 'pre-wrap',
                    }}>{m.text}</div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: '#6366f122', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Bot size={12} style={{ color: '#818cf8' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '8px 12px', background: '#0a0a12', border: '1px solid #1e1e28', borderRadius: 8 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#6366f1', animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void sendQuestion() }}
                placeholder="e.g. Is my DB connection pool healthy? Why is error rate high?"
                style={{
                  flex: 1, background: '#080810', border: '1px solid #1e1e28', borderRadius: 8,
                  padding: '9px 12px', fontSize: 13, color: '#ededef', outline: 'none',
                }}
              />
              <button onClick={() => void sendQuestion()} disabled={!question.trim() || chatLoading} style={{
                padding: '9px 14px', background: '#6366f1', border: 'none', borderRadius: 8,
                color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, opacity: !question.trim() || chatLoading ? 0.5 : 1,
              }}>
                <Send size={13} /> Ask
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Neon card ── */
function NeonCard({ neon, unconfigured }: { neon: NeonUsage | null; unconfigured: boolean }) {
  const CU_LIMIT = 100
  const ALERT = 70

  if (unconfigured) {
    return (
      <div style={{ marginBottom: 16, padding: '14px 20px', borderRadius: 10, background: '#0e0e10', border: '1px solid #1e1e22', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Cloud size={14} style={{ color: '#8a8a90' }} />
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a90' }}>Neon DB Usage</span>
        <span style={{ fontSize: 12, color: '#5a5a60', marginLeft: 8 }}>
          Add <code style={{ fontSize: 11, background: '#1a1a1d', padding: '1px 5px', borderRadius: 3 }}>NEON_API_KEY</code> + <code style={{ fontSize: 11, background: '#1a1a1d', padding: '1px 5px', borderRadius: 3 }}>NEON_PROJECT_ID</code> to Vercel env vars.
        </span>
      </div>
    )
  }
  if (!neon) return null

  const computeHrs = neon.compute_time_seconds != null ? neon.compute_time_seconds / 3600 : null
  const storageGB  = neon.data_storage_bytes_hour != null ? neon.data_storage_bytes_hour / 1024 / 1024 / 1024 : null
  const transferGB = neon.data_transfer_bytes != null ? neon.data_transfer_bytes / 1024 / 1024 / 1024 : null
  const over = computeHrs != null && computeHrs >= ALERT

  return (
    <Card title="Neon DB — This Month" icon={Cloud} accent="#22d3ee"
      tooltip="Monthly usage from the Neon API. Free tier: 100 CU-hrs compute, 512 MB storage, 5 GB transfer. Alert fires at 6:40am when compute crosses 70 CU-hrs.">
      {computeHrs != null && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#8a8a90' }}>Compute time</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: over ? '#f59e0b' : '#ededef' }}>
            {computeHrs.toFixed(1)} <span style={{ color: '#5a5a60', fontWeight: 400 }}>/ {CU_LIMIT} CU-hrs</span>
          </span>
        </div>
        <MiniBar value={computeHrs} max={CU_LIMIT} height={6}
          color={computeHrs >= ALERT ? '#ef4444' : computeHrs >= 50 ? '#f59e0b' : '#22d3ee'} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5a5a60' }}>
          <span>0</span><span style={{ color: '#f59e0b' }}>alert at 70</span><span>100 CU-hrs limit</span>
        </div>
      </>)}
      {storageGB != null && (
        <Row label="Storage" tooltip="Free tier: 512 MB"
          value={storageGB < 1 ? `${(storageGB * 1024).toFixed(0)} MB` : `${storageGB.toFixed(2)} GB`}
          warn={storageGB > 0.45} />
      )}
      {transferGB != null && (
        <Row label="Data transfer" tooltip="Free tier: 5 GB"
          value={transferGB < 1 ? `${(transferGB * 1024).toFixed(0)} MB` : `${transferGB.toFixed(2)} GB`}
          warn={transferGB > 4} />
      )}
    </Card>
  )
}

/* ── Vercel status ── */
function VercelStatus() {
  const [status, setStatus] = useState<{ indicator: string; description: string } | null>(null)
  useEffect(() => {
    fetch('https://www.vercelstatus.com/api/v2/status.json').then(r => r.json()).then(d => setStatus(d.status)).catch(() => {})
  }, [])
  if (!status) return null
  const ok = status.indicator === 'none'
  return (
    <div style={{ padding: '14px 18px', borderRadius: 12, background: '#0e0e10', border: `1px solid ${ok ? '#1e1e22' : 'rgba(239,68,68,0.35)'}`, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: ok ? '#22c55e18' : '#ef444418', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Zap size={14} style={{ color: ok ? '#22c55e' : '#f59e0b' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8a90' }}>Vercel</span>
      <StatusDot ok={ok} />
      <span style={{ fontSize: 13, color: ok ? '#cfcfd3' : '#fca5a5' }}>{status.description}</span>
      <Tooltip text="Pulled from Vercel's public status API — reflects global platform health." />
    </div>
  )
}

/* ── main page ── */
export default function InfraPage() {
  const [data, setData]           = useState<InfraData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [refreshing, setRefreshing]   = useState(false)
  const [tab, setTab]             = useState<'errors' | 'slow'>('errors')
  const [testingAlert, setTestingAlert] = useState(false)
  const [testAlertMsg, setTestAlertMsg] = useState('')
  const [neon, setNeon]           = useState<NeonUsage | null>(null)
  const [neonUnconfigured, setNeonUnconfigured] = useState(false)
  const [isMobile, setIsMobile]   = useState(false)

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res = await adminFetch('/api/admin/infra')
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
      setLastRefresh(new Date())
      setError('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => { void load() }, 30000)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    adminFetch('/api/admin/neon-usage').then(async r => {
      if (r.status === 503) { setNeonUnconfigured(true); return }
      if (r.ok) setNeon(await r.json())
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  async function fireTestAlert() {
    if (!confirm('Send a test alert email to all admins?')) return
    setTestingAlert(true); setTestAlertMsg('')
    try {
      const res = await adminFetch('/api/admin/infra/test-alert', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      setTestAlertMsg(res.ok ? '✓ Test alert email sent' : `✗ ${d.error || 'Failed'}`)
    } catch { setTestAlertMsg('✗ Network error') }
    finally {
      setTestingAlert(false)
      setTimeout(() => setTestAlertMsg(''), 6000)
    }
  }

  const errRate   = data ? parseFloat(data.requests.errRatePct) : 0
  const heapUsed  = data ? parseFloat(data.runtime.heapAllocMB) : 0
  const heapTotal = data ? parseFloat(data.runtime.heapSysMB) : 1
  const hasAlert  = data && (!data.database.ok || errRate >= 10 || data.requests.err5xx > 5)

  const col2 = isMobile ? '1fr' : '1fr 1fr'

  return (
    <div style={{ padding: isMobile ? '16px' : '28px 32px', maxWidth: 980, color: 'white' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Infrastructure</h1>
          <p style={{ fontSize: 12, color: '#5a5a60', marginTop: 4, marginBottom: 0 }}>
            Live metrics · auto-refreshes every 30s
            {lastRefresh && <span> · updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={fireTestAlert} disabled={testingAlert} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, color: '#f59e0b', fontSize: 12, cursor: 'pointer' }}>
            <AlertTriangle size={13} />{testingAlert ? 'Sending…' : 'Test Alert'}
          </button>
          <button onClick={() => void load(true)} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#0e0e10', border: '1px solid #1e1e22', borderRadius: 8, color: '#b5b5ba', fontSize: 12, cursor: 'pointer' }}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {testAlertMsg && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: '#0e0e10', border: '1px solid #1e1e22', fontSize: 13, color: testAlertMsg.startsWith('✓') ? '#22c55e' : '#fca5a5' }}>
          {testAlertMsg}
        </div>
      )}

      {hasAlert && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, marginBottom: 18, fontSize: 13, color: '#fca5a5' }}>
          <AlertTriangle size={15} color="#ef4444" />
          <strong>Action needed</strong> — thresholds breached. Admins have been emailed.
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 64 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #1e1e22', borderTopColor: '#f5c842', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : error ? (
        <div style={{ padding: 24, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, color: '#fca5a5', fontSize: 14 }}>
          Failed to reach backend: {error}
        </div>
      ) : data && (<>

        {/* ── Status bar ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Backend',    ok: data.backend.ok,   detail: data.backend.uptime,                                    tip: 'Go server uptime since last restart' },
            { label: 'Database',   ok: data.database.ok,  detail: data.database.ok ? `${data.database.latencyMs}ms` : 'DOWN', tip: 'Postgres ping latency' },
            { label: 'Error Rate', ok: errRate < 10,       detail: `${data.requests.errRatePct}%`,                         tip: '(4xx+5xx) ÷ total. Alert above 10%' },
            { label: 'WebSockets', ok: true,               detail: `${data.websockets.activeConns} live`,                  tip: 'Open WebSocket connections right now' },
          ].map(item => (
            <div key={item.label} style={{
              padding: '14px 16px', background: '#0e0e10',
              border: `1px solid ${item.ok ? '#1e1e22' : 'rgba(239,68,68,0.3)'}`, borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <StatusDot ok={item.ok} pulse />
                <span style={{ fontSize: 10, color: '#5a5a60', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{item.label}</span>
                <span style={{ marginLeft: 'auto' }}><Tooltip text={item.tip} /></span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: item.ok ? '#ededef' : '#fca5a5', letterSpacing: '-0.02em' }}>{item.detail}</div>
            </div>
          ))}
        </div>

        {/* ── AI panel ── */}
        <AIPanel data={data} neon={neon} />

        {/* ── Detail cards row 1 ── */}
        <SectionLabel>System</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: col2, gap: 12, marginBottom: 20 }}>
          <Card title="Database" icon={Database} status={data.database.ok} accent="#22c55e"
            tooltip="Postgres health. Ping measured on every /admin/infra request.">
            <Row label="Ping" value={`${data.database.latencyMs} ms`} warn={data.database.latencyMs > 100} tooltip="Under 20ms is excellent." />
            <Row label="Connections" value={`${data.database.connsOpen} / ${data.database.connsTotal}`} tooltip="Open vs total pool connections." />
            <Row label="Idle" value={data.database.connsIdle} />
            <MiniBar value={data.database.connsOpen} max={Math.max(data.database.connsTotal, 1)}
              color={data.database.connsOpen / Math.max(data.database.connsTotal, 1) > 0.8 ? '#f59e0b' : '#22c55e'} />
            {data.database.error && <p style={{ fontSize: 12, color: '#fca5a5', margin: 0, wordBreak: 'break-all' }}>{data.database.error}</p>}
          </Card>

          <Card title="Go Runtime" icon={Cpu} accent="#6366f1" tooltip="In-process memory and goroutine stats.">
            <Row label="Goroutines" value={data.runtime.goroutines} warn={data.runtime.goroutines > 500} tooltip="Under 200 is normal." />
            <Row label="Heap used" value={`${data.runtime.heapAllocMB} MB`} />
            <Row label="Heap sys" value={`${data.runtime.heapSysMB} MB`} />
            <MiniBar value={heapUsed} max={heapTotal} color={heapUsed / heapTotal > 0.85 ? '#ef4444' : '#6366f1'} />
            <Row label="Last GC pause" value={`${data.runtime.gcPauseLastMs} ms`} tooltip="Under 5ms is healthy." />
            <Row label="GC runs" value={data.runtime.gcRuns} />
          </Card>

          <Card title="Request Traffic" icon={Activity} accent="#f59e0b" tooltip="HTTP counters since last restart.">
            <Row label="Total" value={data.requests.total.toLocaleString()} />
            <Row label="2xx" value={data.requests.ok.toLocaleString()} />
            <Row label="4xx" value={data.requests.err4xx.toLocaleString()} warn={data.requests.err4xx > 100} />
            <Row label="5xx" value={data.requests.err5xx.toLocaleString()} warn={data.requests.err5xx > 0} />
            <Row label="Error rate" value={`${data.requests.errRatePct}%`} warn={errRate >= 5} />
            <MiniBar value={data.requests.err4xx + data.requests.err5xx} max={Math.max(data.requests.total, 1)}
              color={errRate > 5 ? '#ef4444' : '#f59e0b'} />
          </Card>

          <Card title="Connections" icon={Wifi} accent="#22d3ee" tooltip="Live WebSocket connections.">
            <Row label="WebSockets" value={data.websockets.activeConns} />
            <Row label="Uptime" value={data.backend.uptime} />
            <MiniBar value={data.websockets.activeConns} max={Math.max(data.websockets.activeConns, 50)} color="#22d3ee" />
          </Card>
        </div>

        {/* ── Detail cards row 2 ── */}
        <SectionLabel>Product</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: col2, gap: 12, marginBottom: 20 }}>
          <Card title="Users" icon={Users} accent="#a78bfa" tooltip="Live counts from the users table.">
            <Row label="Active (24h)" value={data.userActivity.active24h} />
            <Row label="Active (7d)"  value={data.userActivity.active7d} />
            <Row label="New today"    value={data.userActivity.newToday} />
            <Row label="New this week" value={data.userActivity.newThisWeek} />
            <Row label="Total"        value={data.userActivity.total.toLocaleString()} />
            <Row label="Banned"       value={data.userActivity.banned} warn={data.userActivity.banned > 0} />
          </Card>

          <Card title="Email Delivery" icon={Mail} accent="#fb923c" tooltip="Resend transactional emails.">
            <Row label="Sent (24h)" value={data.emailStats.sentToday} />
            <Row label="Sent (7d)"  value={data.emailStats.sentWeek} />
            <Row label="Total"      value={data.emailStats.sentTotal.toLocaleString()} />
            <Row label="Last sent"
              value={data.emailStats.lastSentAt ? new Date(data.emailStats.lastSentAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'} />
          </Card>
        </div>

        {/* ── Neon ── */}
        <SectionLabel>Cloud resources</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: col2, gap: 12, marginBottom: 20 }}>
          <NeonCard neon={neon} unconfigured={neonUnconfigured} />
          <VercelStatus />
        </div>

        {/* ── Logs ── */}
        <SectionLabel>Logs</SectionLabel>
        <div style={{ background: '#0e0e10', border: '1px solid #1e1e22', borderRadius: 14, padding: '18px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {(['errors', 'slow'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: tab === t ? '#1e1e22' : 'transparent', color: tab === t ? '#ededef' : '#5a5a60',
                }}>
                  {t === 'errors'
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><XCircle size={12} color={data.recentErrors.length ? '#ef4444' : '#5a5a60'} /> Errors ({data.recentErrors.length})</span>
                    : <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={12} /> Slow ({data.recentSlows.length})</span>}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 11, color: '#5a5a60', marginLeft: 'auto' }}>
              {tab === 'errors' ? 'Last 50 5xx · resets on redeploy' : `Last 50 over ${data.alerts.thresholds.slowMs}ms`}
            </span>
          </div>
          <LogTable rows={tab === 'errors' ? data.recentErrors : data.recentSlows}
            emptyMsg={tab === 'errors' ? '✓ No server errors since last restart' : '✓ No slow requests since last restart'} />
        </div>

        {/* ── Slow queries ── */}
        {data.slowQueries && data.slowQueries.length > 0 && (
          <div style={{ background: '#0e0e10', border: '1px solid #1e1e22', borderRadius: 14, padding: '18px 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Database size={14} style={{ color: '#8a8a90' }} />
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8a90' }}>Slowest DB Queries</span>
              <Tooltip text="Top 10 from pg_stat_statements." />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>{['Query', 'Calls', 'Avg ms', 'Total ms'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10, borderBottom: '1px solid #1e1e22', color: '#5a5a60', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}</tr></thead>
                <tbody>{data.slowQueries.map((q, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1a1a1d' }}>
                    <td style={{ padding: '6px 8px', color: '#b5b5ba', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }} title={q.query}>{q.query}</td>
                    <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>{q.calls.toLocaleString()}</td>
                    <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums', color: q.meanMs > 100 ? '#f59e0b' : '#8a8a90' }}>{q.meanMs.toFixed(1)}</td>
                    <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums', color: '#8a8a90' }}>{(q.totalMs / 1000).toFixed(1)}s</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Slowest routes ── */}
        {data.slowestRoutes && data.slowestRoutes.length > 0 && (
          <div style={{ background: '#0e0e10', border: '1px solid #1e1e22', borderRadius: 14, padding: '18px 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <TrendingUp size={14} style={{ color: '#8a8a90' }} />
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8a90' }}>Slowest API Routes</span>
              <Tooltip text="Top 10 by avg response time. Excludes routes hit fewer than 3 times." />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>{['Method', 'Route', 'Hits', 'Avg ms', 'Max ms'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10, borderBottom: '1px solid #1e1e22', color: '#5a5a60', textAlign: 'left' }}>{h}</th>
                ))}</tr></thead>
                <tbody>{data.slowestRoutes.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1a1a1d' }}>
                    <td style={{ padding: '6px 8px' }}><Pill label={r.method} color={r.method === 'GET' ? '#6366f1' : r.method === 'POST' ? '#22c55e' : '#f59e0b'} /></td>
                    <td style={{ padding: '6px 8px', color: '#cfcfd3', fontFamily: 'monospace' }}>{r.path}</td>
                    <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums', color: '#8a8a90' }}>{r.hits.toLocaleString()}</td>
                    <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: r.avgMs > 500 ? '#ef4444' : r.avgMs > 200 ? '#f59e0b' : '#cfcfd3' }}>{r.avgMs.toFixed(0)}</td>
                    <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums', color: '#8a8a90' }}>{r.maxMs}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Table sizes ── */}
        {data.tableSizes && data.tableSizes.length > 0 && (
          <div style={{ background: '#0e0e10', border: '1px solid #1e1e22', borderRadius: 14, padding: '18px 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Database size={14} style={{ color: '#8a8a90' }} />
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8a90' }}>Largest Tables</span>
              <Tooltip text="Top 10 tables by total disk usage including indexes." />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>{['Table', 'Size', 'Rows', '% of total'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10, borderBottom: '1px solid #1e1e22', color: '#5a5a60', textAlign: 'left' }}>{h}</th>
                ))}</tr></thead>
                <tbody>{(() => {
                  const total = data.tableSizes!.reduce((a, t) => a + t.sizeBytes, 0)
                  return data.tableSizes!.map((t, i) => {
                    const pct = total > 0 ? (t.sizeBytes / total) * 100 : 0
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #1a1a1d' }}>
                        <td style={{ padding: '6px 8px', color: '#cfcfd3', fontFamily: 'monospace' }}>{t.name}</td>
                        <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{t.size}</td>
                        <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums', color: '#8a8a90' }}>{t.rowCount.toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums', color: '#8a8a90' }}>{pct.toFixed(1)}%</td>
                      </tr>
                    )
                  })
                })()}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── UptimeRobot ── */}
        {data.uptimeRobot && data.uptimeRobot.monitors.length > 0 && (
          <div style={{ background: '#0e0e10', border: '1px solid #1e1e22', borderRadius: 14, padding: '18px 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Radio size={14} style={{ color: '#8a8a90' }} />
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8a90' }}>UptimeRobot — External Monitor</span>
              <Tooltip text="Independent pings from outside every 5 minutes." />
              <a href="https://stats.uptimerobot.com/XRXOPqyDWb" target="_blank" rel="noopener noreferrer"
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5a5a60', textDecoration: 'none' }}>
                Status page <ExternalLink size={11} />
              </a>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>{['Monitor', 'Status', '24h', '7d', '30d', 'Avg ms'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10, borderBottom: '1px solid #1e1e22', color: '#5a5a60', textAlign: 'left' }}>{h}</th>
                ))}</tr></thead>
                <tbody>{data.uptimeRobot.monitors.map(m => {
                  const up = m.status === 2
                  const [r24, r7d, r30] = (m.custom_uptime_ratio || '').split('-').map(x => parseFloat(x || '0'))
                  const uc = (n: number) => n >= 99.9 ? '#22c55e' : n >= 99 ? '#f59e0b' : '#ef4444'
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #1a1a1d' }}>
                      <td style={{ padding: '8px', color: '#ededef' }}>{m.friendly_name}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <StatusDot ok={up} pulse={up} />
                          <span style={{ fontSize: 12, color: up ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{up ? 'UP' : m.status === 0 ? 'PAUSED' : 'DOWN'}</span>
                        </span>
                      </td>
                      <td style={{ padding: '8px', fontVariantNumeric: 'tabular-nums', color: uc(r24), fontWeight: 600 }}>{r24.toFixed(2)}%</td>
                      <td style={{ padding: '8px', fontVariantNumeric: 'tabular-nums', color: uc(r7d), fontWeight: 600 }}>{r7d.toFixed(2)}%</td>
                      <td style={{ padding: '8px', fontVariantNumeric: 'tabular-nums', color: uc(r30), fontWeight: 600 }}>{r30.toFixed(2)}%</td>
                      <td style={{ padding: '8px', fontVariantNumeric: 'tabular-nums', color: '#8a8a90' }}>{parseFloat(m.average_response_time || '0').toFixed(0)}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          </div>
        )}

      </>)}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes ping  { 75%,100% { transform: scale(2); opacity: 0; } }
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      `}</style>
    </div>
  )
}
