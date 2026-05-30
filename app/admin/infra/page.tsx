'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity, Database, Cpu, Zap, Wifi, RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, ExternalLink, Radio, Mail, Users, HardDrive, TrendingUp } from 'lucide-react'
import { adminFetch } from '@/lib/adminFetch'

interface ErrorEntry { time: string; method: string; path: string; status: number; latencyMs: number }
interface SlowEntry  { time: string; method: string; path: string; status: number; latencyMs: number }
interface QueryRow   { query: string; calls: number; meanMs: number; totalMs: number; stddevMs: number }

interface UptimeMonitor {
  id: number
  friendly_name: string
  url: string
  status: number               // 2 = up, 8/9 = down, 0 = paused, 1 = not checked
  custom_uptime_ratio: string  // "100.000-99.987-99.954" (1d-7d-30d)
  average_response_time: string
}

interface RouteRow { method: string; path: string; hits: number; avgMs: number; maxMs: number; totalMs: number }
interface TableSize { name: string; size: string; sizeBytes: number; rowCount: number }

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
  r2:            { bucketName: string; sizeBytes: number; sizePretty: string; objectCount: number; configured: boolean }
}

/* ── tooltip ── */
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span
      style={{ position:'relative', display:'inline-flex', alignItems:'center' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:14, height:14, borderRadius:'50%', border:'1px solid oklch(0.32 0.006 60)', color:'oklch(0.45 0.006 60)', fontSize:9, fontWeight:700, cursor:'help', lineHeight:1, fontFamily:'sans-serif' }}>i</span>
      {show && (
        <span style={{
          position:'absolute', bottom:'calc(100% + 6px)', left:'50%', transform:'translateX(-50%)',
          background:'oklch(0.16 0.005 60)', border:'1px solid oklch(0.24 0.006 60)',
          borderRadius:8, padding:'8px 12px', fontSize:12, lineHeight:1.5,
          color:'oklch(0.78 0.005 60)', whiteSpace:'normal', width:240,
          boxShadow:'0 4px 20px rgba(0,0,0,0.5)', zIndex:50, pointerEvents:'none',
          textAlign:'left', fontWeight:400, letterSpacing:'normal', textTransform:'none',
        }}>
          {text}
        </span>
      )}
    </span>
  )
}

/* ── helpers ── */
function StatusDot({ ok }: { ok: boolean }) {
  return <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background: ok ? '#22c55e' : '#ef4444', boxShadow: ok ? '0 0 6px #22c55e88' : '0 0 6px #ef444488' }} />
}

function Card({ title, icon: Icon, children, status, tooltip }: {
  title: string; icon: React.ElementType; children: React.ReactNode; status?: boolean; tooltip?: string
}) {
  return (
    <div style={{ background:'oklch(0.10 0.003 60)', border:`1px solid ${status===false ? 'rgba(239,68,68,0.4)' : 'oklch(0.18 0.005 60)'}`, borderRadius:12, padding:'20px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
        <Icon size={15} style={{ color:'oklch(0.65 0.010 60)' }} />
        <span style={{ fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'oklch(0.55 0.008 60)' }}>{title}</span>
        {tooltip && <span style={{ marginLeft:2 }}><Tooltip text={tooltip} /></span>}
        {status !== undefined && <span style={{ marginLeft:'auto' }}>{status ? <CheckCircle size={14} color="#22c55e" /> : <XCircle size={14} color="#ef4444" />}</span>}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{children}</div>
    </div>
  )
}

function Row({ label, value, warn, tooltip }: { label: string; value: React.ReactNode; warn?: boolean; tooltip?: string }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <span style={{ fontSize:13, color:'oklch(0.50 0.006 60)', display:'flex', alignItems:'center', gap:4 }}>
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </span>
      <span style={{ fontSize:13, fontWeight:600, color: warn ? '#f59e0b' : 'oklch(0.90 0.004 60)', fontVariantNumeric:'tabular-nums' }}>{value}</span>
    </div>
  )
}

function MiniBar({ value, max, color='#22c55e' }: { value:number; max:number; color?:string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max,1)) * 100))
  return <div style={{ height:4, background:'oklch(0.18 0.005 60)', borderRadius:2, overflow:'hidden' }}><div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:2, transition:'width 0.5s ease' }} /></div>
}

function Pill({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', padding:'2px 7px', borderRadius:4, background:`${color}22`, color, border:`1px solid ${color}44` }}>{label}</span>
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  return `${Math.floor(s/3600)}h ago`
}

function LogTable({ rows, emptyMsg }: { rows: (ErrorEntry|SlowEntry)[]; emptyMsg: string }) {
  if (!rows.length) return <p style={{ fontSize:13, color:'oklch(0.38 0.006 60)', margin:0 }}>{emptyMsg}</p>
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr style={{ color:'oklch(0.45 0.006 60)', textAlign:'left' }}>
            {['Time','Method','Path','Status','Latency'].map(h => (
              <th key={h} style={{ padding:'4px 8px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', fontSize:10, borderBottom:'1px solid oklch(0.18 0.005 60)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom:'1px solid oklch(0.14 0.003 60)' }}>
              <td style={{ padding:'6px 8px', color:'oklch(0.45 0.006 60)', whiteSpace:'nowrap' }}>{timeAgo(r.time)}</td>
              <td style={{ padding:'6px 8px' }}><Pill label={r.method} color={r.method==='GET'?'#6366f1':'#f59e0b'} /></td>
              <td style={{ padding:'6px 8px', color:'oklch(0.75 0.005 60)', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.path}</td>
              <td style={{ padding:'6px 8px' }}><Pill label={String(r.status)} color={r.status>=500?'#ef4444':r.status>=400?'#f59e0b':'#22c55e'} /></td>
              <td style={{ padding:'6px 8px', fontVariantNumeric:'tabular-nums', color: r.latencyMs>500?'#f59e0b':'oklch(0.75 0.005 60)' }}>{r.latencyMs}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── main page ── */
export default function InfraPage() {
  const [data, setData] = useState<InfraData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<'errors'|'slow'>('errors')
  const [testingAlert, setTestingAlert] = useState(false)
  const [testAlertMsg, setTestAlertMsg] = useState('')

  async function fireTestAlert() {
    if (!confirm('Send a test alert email to all admins?')) return
    setTestingAlert(true)
    setTestAlertMsg('')
    try {
      const res = await adminFetch('/api/admin/infra/test-alert', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      setTestAlertMsg(res.ok ? '✓ Test alert email sent — check your inbox' : `✗ ${data.error || 'Failed to send'}`)
    } catch {
      setTestAlertMsg('✗ Network error')
    } finally {
      setTestingAlert(false)
      setTimeout(() => setTestAlertMsg(''), 6000)
    }
  }

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

  useEffect(() => { load(); const id = setInterval(() => load(), 30000); return () => clearInterval(id) }, [load])

  const errRate = data ? parseFloat(data.requests.errRatePct) : 0
  const heapUsed = data ? parseFloat(data.runtime.heapAllocMB) : 0
  const heapTotal = data ? parseFloat(data.runtime.heapSysMB) : 1

  const hasAlert = data && (
    !data.database.ok ||
    errRate >= 10 ||
    data.requests.err5xx > 5
  )

  return (
    <div style={{ padding:'28px 32px', maxWidth:960, color:'white' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, margin:0, letterSpacing:'-0.01em' }}>Infrastructure</h1>
          <p style={{ fontSize:12, color:'oklch(0.40 0.006 60)', marginTop:4, maxWidth:500 }}>
            Live metrics from the Go backend, Postgres, and Vercel. Alerts email all admins when error rate &gt;10%, 5xx &gt;5, or DB goes down. Auto-refreshes every 30s.
          </p>
          {lastRefresh && <p style={{ fontSize:11, color:'oklch(0.35 0.006 60)', marginTop:2 }}>Last updated {lastRefresh.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</p>}
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <button onClick={fireTestAlert} disabled={testingAlert} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:8, color:'#f59e0b', fontSize:13, cursor:'pointer' }}>
            <AlertTriangle size={13} />
            {testingAlert ? 'Sending…' : 'Fire Test Alert'}
          </button>
          <button onClick={() => load(true)} disabled={refreshing} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'oklch(0.15 0.005 60)', border:'1px solid oklch(0.22 0.005 60)', borderRadius:8, color:'oklch(0.75 0.006 60)', fontSize:13, cursor:'pointer' }}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>
      {testAlertMsg && (
        <div style={{ marginBottom:16, padding:'10px 14px', borderRadius:8, background:'oklch(0.12 0.005 60)', border:'1px solid oklch(0.20 0.005 60)', fontSize:13, color: testAlertMsg.startsWith('✓') ? '#22c55e' : '#fca5a5' }}>
          {testAlertMsg}
        </div>
      )}

      {/* Alert banner */}
      {hasAlert && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, marginBottom:20, fontSize:13, color:'#fca5a5' }}>
          <AlertTriangle size={15} color="#ef4444" />
          <span><strong>Action needed</strong> — one or more thresholds are breached. Admins have been emailed.</span>
        </div>
      )}

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', paddingTop:64 }}>
          <div className="animate-spin" style={{ width:32, height:32, borderRadius:'50%', border:'2px solid oklch(0.20 0.005 60)', borderTopColor:'#f5c842' }} />
        </div>
      ) : error ? (
        <div style={{ padding:24, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:12, color:'#fca5a5', fontSize:14 }}>
          Failed to reach backend: {error}
        </div>
      ) : data && (<>

        {/* Top status chips */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'Backend',    ok: data.backend.ok,       detail: data.backend.uptime,                          tooltip:'Go server uptime since last restart' },
            { label:'Database',   ok: data.database.ok,      detail: data.database.ok ? `${data.database.latencyMs}ms ping` : 'DOWN', tooltip:'Postgres ping latency — under 50ms is healthy' },
            { label:'Error Rate', ok: errRate < 10,          detail: `${data.requests.errRatePct}%`,               tooltip:'(4xx+5xx) ÷ total requests. Alert fires above 10%' },
            { label:'WebSockets', ok: true,                  detail: `${data.websockets.activeConns} live`,         tooltip:'Open WebSocket connections right now' },
          ].map(item => (
            <div key={item.label} style={{ padding:'14px 18px', background:'oklch(0.10 0.003 60)', border:`1px solid ${item.ok ? 'oklch(0.18 0.005 60)' : 'rgba(239,68,68,0.35)'}`, borderRadius:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <StatusDot ok={item.ok} />
                <span style={{ fontSize:11, color:'oklch(0.50 0.006 60)', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' }}>{item.label}</span>
                <span style={{ marginLeft:'auto' }}><Tooltip text={item.tooltip} /></span>
              </div>
              <span style={{ fontSize:18, fontWeight:700, color: item.ok ? 'oklch(0.92 0.004 60)' : '#fca5a5' }}>{item.detail}</span>
            </div>
          ))}
        </div>

        {/* Detail cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
          <Card title="Database" icon={Database} status={data.database.ok}
            tooltip="Postgres connection health. Ping latency is measured on every /admin/infra request. Pool shows how many connections the Go backend has open to the DB.">
            <Row label="Ping latency" value={`${data.database.latencyMs} ms`} warn={data.database.latencyMs > 100}
              tooltip="Round-trip time to send a ping to Postgres. Under 20ms is excellent, over 100ms may indicate load." />
            <Row label="Active conns" value={`${data.database.connsOpen} / ${data.database.connsTotal}`}
              tooltip="Open (in-use) connections vs total connections in the pool. Pool exhaustion causes request queuing." />
            <Row label="Idle conns" value={data.database.connsIdle}
              tooltip="Connections held open but not currently executing a query." />
            <MiniBar value={data.database.connsOpen} max={Math.max(data.database.connsTotal,1)} color={data.database.connsOpen / Math.max(data.database.connsTotal,1) > 0.8 ? '#f59e0b' : '#22c55e'} />
            {data.database.error && <p style={{ fontSize:12, color:'#fca5a5', margin:0, wordBreak:'break-all' }}>{data.database.error}</p>}
          </Card>

          <Card title="Go Runtime" icon={Cpu}
            tooltip="In-process Go runtime statistics. Heap is memory used by live objects. Goroutines are lightweight concurrent tasks — a spike here usually means leaked goroutines.">
            <Row label="Goroutines" value={data.runtime.goroutines} warn={data.runtime.goroutines > 500}
              tooltip="Number of live goroutines. Under 200 is normal. A climbing count that never drops indicates a goroutine leak." />
            <Row label="Heap used" value={`${data.runtime.heapAllocMB} MB`}
              tooltip="Memory currently occupied by live Go objects." />
            <Row label="Heap sys" value={`${data.runtime.heapSysMB} MB`}
              tooltip="Total memory reserved from the OS by the Go runtime." />
            <MiniBar value={heapUsed} max={heapTotal} color={heapUsed/heapTotal > 0.85 ? '#ef4444' : '#6366f1'} />
            <Row label="Last GC pause" value={`${data.runtime.gcPauseLastMs} ms`}
              tooltip="Stop-the-world pause duration of the most recent garbage collection. Under 5ms is healthy." />
            <Row label="GC runs" value={data.runtime.gcRuns}
              tooltip="Total garbage collection cycles since process start." />
          </Card>

          <Card title="Request Traffic" icon={Activity}
            tooltip="HTTP response counts since the last backend restart. Counters reset on redeploy. Alert fires if error rate exceeds 10% with more than 50 total requests.">
            <Row label="Total requests" value={data.requests.total.toLocaleString()} />
            <Row label="Successful (2xx)" value={data.requests.ok.toLocaleString()} />
            <Row label="Client errors (4xx)" value={data.requests.err4xx.toLocaleString()} warn={data.requests.err4xx > 100}
              tooltip="Bad requests, auth failures, not-found. High 4xx is normal but a sudden spike may indicate a bug or scraping." />
            <Row label="Server errors (5xx)" value={data.requests.err5xx.toLocaleString()} warn={data.requests.err5xx > 0}
              tooltip="Unhandled errors in Go handlers. Any 5xx is worth investigating. Alert fires above 5." />
            <Row label="Error rate" value={`${data.requests.errRatePct}%`} warn={errRate >= 5}
              tooltip="(4xx + 5xx) ÷ total. Alert threshold is 10%." />
            <MiniBar value={data.requests.err4xx + data.requests.err5xx} max={Math.max(data.requests.total,1)} color={errRate > 5 ? '#ef4444' : '#f59e0b'} />
          </Card>

          <Card title="Connections" icon={Wifi}
            tooltip="Live WebSocket connections from users. Each open chat or admin chat tab holds one connection.">
            <Row label="Active WebSockets" value={data.websockets.activeConns}
              tooltip="Number of open WS connections right now. Drops to 0 during a redeploy." />
            <Row label="Backend uptime" value={data.backend.uptime}
              tooltip="Time since the current Go process started. Resets on every deploy." />
            <MiniBar value={data.websockets.activeConns} max={Math.max(data.websockets.activeConns, 50)} color="#6366f1" />
          </Card>
        </div>

        {/* Second row: Users, Email, R2 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
          <Card title="Users" icon={Users}
            tooltip="Live counts from the users table. Active = users who logged in within the window.">
            <Row label="Active (24h)" value={data.userActivity.active24h}
              tooltip="Users who logged in within the last 24 hours." />
            <Row label="Active (7d)" value={data.userActivity.active7d}
              tooltip="Users who logged in within the last 7 days." />
            <Row label="New today" value={data.userActivity.newToday}
              tooltip="Accounts created in the last 24 hours." />
            <Row label="New this week" value={data.userActivity.newThisWeek}
              tooltip="Accounts created in the last 7 days." />
            <Row label="Total users" value={data.userActivity.total.toLocaleString()}
              tooltip="All registered accounts." />
            <Row label="Banned" value={data.userActivity.banned} warn={data.userActivity.banned > 0}
              tooltip="Users currently banned by admins." />
          </Card>

          <Card title="Email Delivery" icon={Mail}
            tooltip="Email send activity via Resend. Tracks transactional emails (verification, notifications, alerts).">
            <Row label="Sent (24h)" value={data.emailStats.sentToday}
              tooltip="Emails dispatched in the last 24 hours." />
            <Row label="Sent (7d)" value={data.emailStats.sentWeek}
              tooltip="Emails dispatched in the last 7 days." />
            <Row label="Total sent" value={data.emailStats.sentTotal.toLocaleString()}
              tooltip="All emails dispatched since launch." />
            <Row label="Last sent"
              value={data.emailStats.lastSentAt ? new Date(data.emailStats.lastSentAt).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}
              tooltip="Timestamp of the most recent email dispatch." />
          </Card>

          <Card title="R2 Storage" icon={HardDrive}
            tooltip="Cloudflare R2 object storage. Hosts profile photos, post images, and ad creatives.">
            {!data.r2.configured ? (
              <p style={{ fontSize:12, color:'oklch(0.45 0.006 60)', margin:0 }}>
                Cloudflare API token not configured. Add CLOUDFLARE_API_TOKEN secret to enable live R2 stats.
              </p>
            ) : (
              <>
                <Row label="Bucket" value={data.r2.bucketName || '—'}
                  tooltip="Name of the R2 bucket storing uploads." />
                <Row label="Storage used" value={data.r2.sizePretty || '0 B'}
                  tooltip="Total bytes stored. Cloudflare R2 free tier includes 10 GB/month." />
                <Row label="Object count" value={data.r2.objectCount.toLocaleString()}
                  tooltip="Number of stored objects (images, etc.)." />
                <MiniBar value={data.r2.sizeBytes} max={10 * 1024 * 1024 * 1024} color={data.r2.sizeBytes > 8*1024*1024*1024 ? '#ef4444' : '#22c55e'} />
              </>
            )}
          </Card>
        </div>

        {/* Recent errors + slow requests */}
        <div style={{ background:'oklch(0.10 0.003 60)', border:'1px solid oklch(0.18 0.005 60)', borderRadius:12, padding:'20px 24px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
            <div style={{ display:'flex', gap:2 }}>
              {(['errors','slow'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding:'6px 14px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background: tab===t ? 'oklch(0.20 0.005 60)' : 'transparent', color: tab===t ? 'oklch(0.90 0.004 60)' : 'oklch(0.45 0.006 60)' }}>
                  {t === 'errors' ? (
                    <span style={{ display:'flex', alignItems:'center', gap:5 }}><XCircle size={12} color={data.recentErrors.length ? '#ef4444' : 'oklch(0.45 0.006 60)'} /> Server Errors ({data.recentErrors.length})</span>
                  ) : (
                    <span style={{ display:'flex', alignItems:'center', gap:5 }}><Clock size={12} /> Slow Requests ({data.recentSlows.length})</span>
                  )}
                </button>
              ))}
            </div>
            <span style={{ fontSize:11, color:'oklch(0.38 0.006 60)', marginLeft:'auto' }}>
              {tab === 'errors' ? 'Last 50 5xx responses — resets on redeploy' : `Last 50 requests over ${data.alerts.thresholds.slowMs}ms`}
            </span>
          </div>
          <LogTable
            rows={tab === 'errors' ? data.recentErrors : data.recentSlows}
            emptyMsg={tab === 'errors' ? '✓ No server errors recorded since last restart' : '✓ No slow requests recorded since last restart'}
          />
        </div>

        {/* pg_stat_statements */}
        {data.slowQueries && data.slowQueries.length > 0 && (
          <div style={{ background:'oklch(0.10 0.003 60)', border:'1px solid oklch(0.18 0.005 60)', borderRadius:12, padding:'20px 24px', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <Database size={14} style={{ color:'oklch(0.65 0.010 60)' }} />
              <span style={{ fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'oklch(0.55 0.008 60)' }}>Slowest DB Queries</span>
              <Tooltip text="Top 10 slowest queries by average execution time from pg_stat_statements. Requires the extension to be enabled on your Postgres instance." />
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ color:'oklch(0.45 0.006 60)', textAlign:'left' }}>
                    {['Query','Calls','Avg ms','Total ms'].map(h => (
                      <th key={h} style={{ padding:'4px 8px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', fontSize:10, borderBottom:'1px solid oklch(0.18 0.005 60)', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slowQueries.map((q, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid oklch(0.14 0.003 60)' }}>
                      <td style={{ padding:'6px 8px', color:'oklch(0.70 0.005 60)', maxWidth:340, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'monospace' }} title={q.query}>{q.query}</td>
                      <td style={{ padding:'6px 8px', fontVariantNumeric:'tabular-nums' }}>{q.calls.toLocaleString()}</td>
                      <td style={{ padding:'6px 8px', fontVariantNumeric:'tabular-nums', color: q.meanMs > 100 ? '#f59e0b' : 'oklch(0.75 0.005 60)' }}>{q.meanMs.toFixed(1)}</td>
                      <td style={{ padding:'6px 8px', fontVariantNumeric:'tabular-nums' }}>{(q.totalMs/1000).toFixed(1)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Slowest API routes */}
        {data.slowestRoutes && data.slowestRoutes.length > 0 && (
          <div style={{ background:'oklch(0.10 0.003 60)', border:'1px solid oklch(0.18 0.005 60)', borderRadius:12, padding:'20px 24px', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <TrendingUp size={14} style={{ color:'oklch(0.65 0.010 60)' }} />
              <span style={{ fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'oklch(0.55 0.008 60)' }}>Slowest API Routes</span>
              <Tooltip text="Top 10 API endpoints ranked by average response time. Helps find which routes need optimisation. Excludes routes hit fewer than 3 times since restart." />
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ color:'oklch(0.45 0.006 60)', textAlign:'left' }}>
                    {['Method','Route','Hits','Avg ms','Max ms'].map(h => (
                      <th key={h} style={{ padding:'4px 8px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', fontSize:10, borderBottom:'1px solid oklch(0.18 0.005 60)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slowestRoutes.map((r, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid oklch(0.14 0.003 60)' }}>
                      <td style={{ padding:'6px 8px' }}><Pill label={r.method} color={r.method==='GET'?'#6366f1':r.method==='POST'?'#22c55e':'#f59e0b'} /></td>
                      <td style={{ padding:'6px 8px', color:'oklch(0.80 0.005 60)', fontFamily:'monospace' }}>{r.path}</td>
                      <td style={{ padding:'6px 8px', fontVariantNumeric:'tabular-nums', color:'oklch(0.65 0.005 60)' }}>{r.hits.toLocaleString()}</td>
                      <td style={{ padding:'6px 8px', fontVariantNumeric:'tabular-nums', fontWeight:600, color: r.avgMs > 500 ? '#ef4444' : r.avgMs > 200 ? '#f59e0b' : 'oklch(0.80 0.005 60)' }}>{r.avgMs.toFixed(0)}</td>
                      <td style={{ padding:'6px 8px', fontVariantNumeric:'tabular-nums', color:'oklch(0.65 0.005 60)' }}>{r.maxMs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Table sizes */}
        {data.tableSizes && data.tableSizes.length > 0 && (
          <div style={{ background:'oklch(0.10 0.003 60)', border:'1px solid oklch(0.18 0.005 60)', borderRadius:12, padding:'20px 24px', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <Database size={14} style={{ color:'oklch(0.65 0.010 60)' }} />
              <span style={{ fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'oklch(0.55 0.008 60)' }}>Largest Tables</span>
              <Tooltip text="Top 10 tables by total disk usage including indexes. Helps spot growth patterns and identify candidates for archival or partitioning." />
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ color:'oklch(0.45 0.006 60)', textAlign:'left' }}>
                    {['Table','Size','Rows','% of total'].map(h => (
                      <th key={h} style={{ padding:'4px 8px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', fontSize:10, borderBottom:'1px solid oklch(0.18 0.005 60)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totalBytes = data.tableSizes!.reduce((a, t) => a + t.sizeBytes, 0)
                    return data.tableSizes!.map((t, i) => {
                      const pct = totalBytes > 0 ? (t.sizeBytes / totalBytes) * 100 : 0
                      return (
                        <tr key={i} style={{ borderBottom:'1px solid oklch(0.14 0.003 60)' }}>
                          <td style={{ padding:'6px 8px', color:'oklch(0.80 0.005 60)', fontFamily:'monospace' }}>{t.name}</td>
                          <td style={{ padding:'6px 8px', fontVariantNumeric:'tabular-nums', fontWeight:600 }}>{t.size}</td>
                          <td style={{ padding:'6px 8px', fontVariantNumeric:'tabular-nums', color:'oklch(0.65 0.005 60)' }}>{t.rowCount.toLocaleString()}</td>
                          <td style={{ padding:'6px 8px', fontVariantNumeric:'tabular-nums', color:'oklch(0.55 0.005 60)' }}>{pct.toFixed(1)}%</td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vercel status */}
        <VercelStatus />

        {/* UptimeRobot live status */}
        {data.uptimeRobot && data.uptimeRobot.monitors.length > 0 && (
          <div style={{ marginTop:12, background:'oklch(0.10 0.003 60)', border:'1px solid oklch(0.18 0.005 60)', borderRadius:12, padding:'20px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <Radio size={14} style={{ color:'oklch(0.65 0.010 60)' }} />
              <span style={{ fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'oklch(0.55 0.008 60)' }}>UptimeRobot — External Monitor</span>
              <Tooltip text="Independent uptime checks pinging your backend from outside every 5 minutes. Catches outages the internal monitor can't (because it would be down too)." />
              <a href="https://stats.uptimerobot.com/XRXOPqyDWb" target="_blank" rel="noopener noreferrer" style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, fontSize:11, color:'oklch(0.50 0.006 60)', textDecoration:'none' }}>
                Public status page <ExternalLink size={11} />
              </a>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ color:'oklch(0.45 0.006 60)', textAlign:'left' }}>
                    {['Monitor','Status','24h','7d','30d','Avg response'].map(h => (
                      <th key={h} style={{ padding:'4px 8px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', fontSize:10, borderBottom:'1px solid oklch(0.18 0.005 60)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.uptimeRobot.monitors.map(m => {
                    const up = m.status === 2
                    const ratios = (m.custom_uptime_ratio || '').split('-')
                    const r24 = parseFloat(ratios[0] || '0')
                    const r7d = parseFloat(ratios[1] || '0')
                    const r30 = parseFloat(ratios[2] || '0')
                    const fmt = (n:number) => `${n.toFixed(2)}%`
                    const color = (n:number) => n >= 99.9 ? '#22c55e' : n >= 99 ? '#f59e0b' : '#ef4444'
                    return (
                      <tr key={m.id} style={{ borderBottom:'1px solid oklch(0.14 0.003 60)' }}>
                        <td style={{ padding:'8px', color:'oklch(0.85 0.005 60)' }}>{m.friendly_name}</td>
                        <td style={{ padding:'8px' }}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                            <StatusDot ok={up} />
                            <span style={{ fontSize:12, color: up ? '#22c55e' : '#ef4444', fontWeight:600 }}>{up ? 'UP' : m.status === 0 ? 'PAUSED' : 'DOWN'}</span>
                          </span>
                        </td>
                        <td style={{ padding:'8px', fontVariantNumeric:'tabular-nums', color: color(r24), fontWeight:600 }}>{fmt(r24)}</td>
                        <td style={{ padding:'8px', fontVariantNumeric:'tabular-nums', color: color(r7d), fontWeight:600 }}>{fmt(r7d)}</td>
                        <td style={{ padding:'8px', fontVariantNumeric:'tabular-nums', color: color(r30), fontWeight:600 }}>{fmt(r30)}</td>
                        <td style={{ padding:'8px', fontVariantNumeric:'tabular-nums', color:'oklch(0.75 0.005 60)' }}>{parseFloat(m.average_response_time || '0').toFixed(0)} ms</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>)}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function VercelStatus() {
  const [status, setStatus] = useState<{ indicator: string; description: string } | null>(null)
  useEffect(() => {
    fetch('https://www.vercelstatus.com/api/v2/status.json').then(r => r.json()).then(d => setStatus(d.status)).catch(() => {})
  }, [])
  if (!status) return null
  const ok = status.indicator === 'none'
  return (
    <div style={{ padding:'14px 20px', borderRadius:10, background:'oklch(0.10 0.003 60)', border:`1px solid ${ok ? 'oklch(0.18 0.005 60)' : 'rgba(239,68,68,0.35)'}`, display:'flex', alignItems:'center', gap:10 }}>
      <Zap size={14} style={{ color: ok ? '#22c55e' : '#f59e0b' }} />
      <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'oklch(0.50 0.006 60)' }}>Vercel</span>
      <StatusDot ok={ok} />
      <span style={{ fontSize:13, color: ok ? 'oklch(0.80 0.004 60)' : '#fca5a5' }}>{status.description}</span>
      <span style={{ marginLeft:'auto' }}><Tooltip text="Pulled from Vercel's public status API — reflects global Vercel platform health, not just your deployment." /></span>
    </div>
  )
}
