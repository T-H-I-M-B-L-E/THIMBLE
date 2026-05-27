'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity, Database, Cpu, Zap, Wifi, RefreshCw, CheckCircle, XCircle } from 'lucide-react'

interface InfraData {
  backend: { ok: boolean; uptime: string; uptimeSec: number }
  database: { ok: boolean; error: string; latencyMs: number; connsOpen: number; connsIdle: number; connsTotal: number }
  runtime: { goroutines: number; heapAllocMB: string; heapSysMB: string; gcPauseLastMs: string; gcRuns: number }
  requests: { total: number; ok: number; err4xx: number; err5xx: number; errRatePct: string }
  websockets: { activeConns: number }
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: ok ? '#22c55e' : '#ef4444',
      boxShadow: ok ? '0 0 6px #22c55e88' : '0 0 6px #ef444488',
    }} />
  )
}

function Card({ title, icon: Icon, children, status }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  status?: boolean
}) {
  return (
    <div style={{
      background: 'oklch(0.10 0.003 60)',
      border: `1px solid ${status === false ? 'rgba(239,68,68,0.4)' : 'oklch(0.18 0.005 60)'}`,
      borderRadius: 12,
      padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon size={15} style={{ color: 'oklch(0.65 0.010 60)' }} />
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'oklch(0.55 0.008 60)' }}>
          {title}
        </span>
        {status !== undefined && (
          <span style={{ marginLeft: 'auto' }}>
            {status ? <CheckCircle size={14} color="#22c55e" /> : <XCircle size={14} color="#ef4444" />}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'oklch(0.50 0.006 60)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: warn ? '#f59e0b' : 'oklch(0.90 0.004 60)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  )
}

function MiniBar({ value, max, color = '#22c55e' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div style={{ height: 4, background: 'oklch(0.18 0.005 60)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
    </div>
  )
}

export default function InfraPage() {
  const [data, setData] = useState<InfraData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res = await fetch('/api/admin/infra', { credentials: 'include' })
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
    load()
    const id = setInterval(() => load(), 30000)
    return () => clearInterval(id)
  }, [load])

  const errRate = data ? parseFloat(data.requests.errRatePct) : 0
  const heapUsed = data ? parseFloat(data.runtime.heapAllocMB) : 0
  const heapTotal = data ? parseFloat(data.runtime.heapSysMB) : 1

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, color: 'white' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Infrastructure</h1>
          {lastRefresh && (
            <p style={{ fontSize: 12, color: 'oklch(0.45 0.006 60)', marginTop: 4 }}>
              Last updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · auto-refreshes every 30s
            </p>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'oklch(0.15 0.005 60)', border: '1px solid oklch(0.22 0.005 60)',
            borderRadius: 8, color: 'oklch(0.75 0.006 60)', fontSize: 13, cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 64 }}>
          <div className="animate-spin" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid oklch(0.20 0.005 60)', borderTopColor: '#f5c842' }} />
        </div>
      ) : error ? (
        <div style={{ padding: 24, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#fca5a5', fontSize: 14 }}>
          Failed to reach backend: {error}
        </div>
      ) : data && (
        <>
          {/* Top status bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Backend', ok: data.backend.ok, detail: data.backend.uptime },
              { label: 'Database', ok: data.database.ok, detail: data.database.ok ? `${data.database.latencyMs}ms` : 'down' },
              { label: 'Error Rate', ok: errRate < 5, detail: `${data.requests.errRatePct}%` },
              { label: 'WebSockets', ok: true, detail: `${data.websockets.activeConns} live` },
            ].map(item => (
              <div key={item.label} style={{
                padding: '14px 18px', background: 'oklch(0.10 0.003 60)',
                border: `1px solid ${item.ok ? 'oklch(0.18 0.005 60)' : 'rgba(239,68,68,0.35)'}`,
                borderRadius: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <StatusDot ok={item.ok} />
                  <span style={{ fontSize: 11, color: 'oklch(0.50 0.006 60)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, color: item.ok ? 'oklch(0.92 0.004 60)' : '#fca5a5' }}>{item.detail}</span>
              </div>
            ))}
          </div>

          {/* Detail cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card title="Database" icon={Database} status={data.database.ok}>
              <Row label="Ping latency" value={`${data.database.latencyMs} ms`} warn={data.database.latencyMs > 100} />
              <Row label="Active conns" value={`${data.database.connsOpen} / ${data.database.connsTotal}`} />
              <Row label="Idle conns" value={data.database.connsIdle} />
              <MiniBar value={data.database.connsOpen} max={Math.max(data.database.connsTotal, 1)} color={data.database.connsOpen / Math.max(data.database.connsTotal, 1) > 0.8 ? '#f59e0b' : '#22c55e'} />
              {data.database.error && (
                <p style={{ fontSize: 12, color: '#fca5a5', margin: 0, wordBreak: 'break-all' }}>{data.database.error}</p>
              )}
            </Card>

            <Card title="Go Runtime" icon={Cpu}>
              <Row label="Goroutines" value={data.runtime.goroutines} warn={data.runtime.goroutines > 500} />
              <Row label="Heap used" value={`${data.runtime.heapAllocMB} MB`} />
              <Row label="Heap sys" value={`${data.runtime.heapSysMB} MB`} />
              <MiniBar value={heapUsed} max={heapTotal} color={heapUsed / heapTotal > 0.85 ? '#ef4444' : '#6366f1'} />
              <Row label="GC pause (last)" value={`${data.runtime.gcPauseLastMs} ms`} />
              <Row label="GC runs" value={data.runtime.gcRuns} />
            </Card>

            <Card title="Request Traffic" icon={Activity}>
              <Row label="Total requests" value={data.requests.total.toLocaleString()} />
              <Row label="Successful (2xx)" value={data.requests.ok.toLocaleString()} />
              <Row label="Client errors (4xx)" value={data.requests.err4xx.toLocaleString()} warn={data.requests.err4xx > 100} />
              <Row label="Server errors (5xx)" value={data.requests.err5xx.toLocaleString()} warn={data.requests.err5xx > 0} />
              <Row label="Error rate" value={`${data.requests.errRatePct}%`} warn={errRate >= 1} />
              <MiniBar value={data.requests.err4xx + data.requests.err5xx} max={Math.max(data.requests.total, 1)} color={errRate > 5 ? '#ef4444' : '#f59e0b'} />
            </Card>

            <Card title="Connections" icon={Wifi}>
              <Row label="Active WebSockets" value={data.websockets.activeConns} />
              <Row label="Backend uptime" value={data.backend.uptime} />
              <MiniBar value={data.websockets.activeConns} max={Math.max(data.websockets.activeConns, 50)} color='#6366f1' />
            </Card>
          </div>

          {/* Extra: Vercel status from their public API */}
          <VercelStatus />
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function VercelStatus() {
  const [status, setStatus] = useState<{ indicator: string; description: string } | null>(null)

  useEffect(() => {
    fetch('https://www.vercelstatus.com/api/v2/status.json')
      .then(r => r.json())
      .then(d => setStatus(d.status))
      .catch(() => {})
  }, [])

  if (!status) return null

  const ok = status.indicator === 'none'
  return (
    <div style={{
      marginTop: 16, padding: '14px 20px', borderRadius: 10,
      background: 'oklch(0.10 0.003 60)',
      border: `1px solid ${ok ? 'oklch(0.18 0.005 60)' : 'rgba(239,68,68,0.35)'}`,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Zap size={14} style={{ color: ok ? '#22c55e' : '#f59e0b' }} />
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'oklch(0.50 0.006 60)' }}>Vercel</span>
      <StatusDot ok={ok} />
      <span style={{ fontSize: 13, color: ok ? 'oklch(0.80 0.004 60)' : '#fca5a5' }}>{status.description}</span>
    </div>
  )
}
