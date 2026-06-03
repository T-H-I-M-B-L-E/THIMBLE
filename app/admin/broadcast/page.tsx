'use client'

import { useCallback, useEffect, useState } from 'react'
import { Send, Mail, Megaphone, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { adminFetch } from '@/lib/adminFetch'

type Role = 'designer' | 'model' | 'manufacturer' | 'photographer' | 'brand'
type BannerType = 'info' | 'success' | 'warning' | 'critical'

interface Audience { roles: Role[]; verifiedOnly: boolean }
interface PreviewResp { recipients: number; label: string }
interface BroadcastSummary {
  id: number; sentBy: string; subject: string; audience: string;
  recipients: number; succeeded: number; failed: number; createdAt: string;
}
interface ActiveBanner {
  id: number; message: string; type: BannerType;
  audience: Audience; expiresAt?: string; createdAt: string;
}

const ROLES: { value: Role; label: string }[] = [
  { value: 'designer', label: 'Designers' },
  { value: 'model', label: 'Models' },
  { value: 'manufacturer', label: 'Manufacturers' },
  { value: 'photographer', label: 'Photographers' },
  { value: 'brand', label: 'Brands' },
]

const DURATIONS = [
  { hours: 1, label: '1 hour' },
  { hours: 6, label: '6 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 168, label: '7 days' },
  { hours: 0, label: 'Until taken down' },
]

const BANNER_TYPES: { value: BannerType; label: string; bg: string; fg: string }[] = [
  { value: 'info', label: 'Info', bg: '#1f2937', fg: '#e5e7eb' },
  { value: 'success', label: 'Success', bg: '#064e3b', fg: '#a7f3d0' },
  { value: 'warning', label: 'Warning', bg: '#78350f', fg: '#fde68a' },
  { value: 'critical', label: 'Critical', bg: '#7f1d1d', fg: '#fecaca' },
]

export default function BroadcastPage() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<Audience>({ roles: [], verifiedOnly: false })
  const [sendEmail, setSendEmail] = useState(true)
  const [showBanner, setShowBanner] = useState(false)
  const [bannerMessage, setBannerMessage] = useState('')
  const [bannerType, setBannerType] = useState<BannerType>('info')
  const [bannerHours, setBannerHours] = useState(24)

  const [preview, setPreview] = useState<PreviewResp | null>(null)
  const [history, setHistory] = useState<BroadcastSummary[]>([])
  const [activeBanner, setActiveBanner] = useState<ActiveBanner | null>(null)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')

  const loadPreview = useCallback(async () => {
    const params = new URLSearchParams()
    if (audience.roles.length) params.set('roles', audience.roles.join(','))
    if (audience.verifiedOnly) params.set('verified', 'true')
    try {
      const res = await adminFetch(`/api/admin/broadcast/preview?${params.toString()}`)
      if (res.ok) setPreview(await res.json())
    } catch { /* preview is informational */ }
  }, [audience])

  const loadHistory = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/broadcast/history')
      if (res.ok) setHistory(await res.json() || [])
    } catch {}
  }, [])

  const loadActiveBanner = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/banner/current')
      if (res.ok) setActiveBanner(await res.json())
    } catch {}
  }, [])

  useEffect(() => { void loadPreview() }, [loadPreview])
  useEffect(() => { void loadHistory(); void loadActiveBanner() }, [loadHistory, loadActiveBanner])

  const toggleRole = (r: Role) => {
    setAudience(a => a.roles.includes(r)
      ? { ...a, roles: a.roles.filter(x => x !== r) }
      : { ...a, roles: [...a.roles, r] })
  }

  const send = async () => {
    if (!sendEmail && !showBanner) {
      setFeedback('Pick at least one channel — email, banner, or both.')
      return
    }
    if (!confirm(`Send to ${preview?.recipients ?? '?'} users (${preview?.label ?? ''})?`)) return
    setSending(true)
    setFeedback('')
    try {
      const res = await adminFetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject, body, audience,
          sendEmail, showBanner,
          bannerMessage, bannerType, bannerHours,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback(`✗ ${data.error || 'Failed to send'}`)
      } else {
        const parts: string[] = []
        if (sendEmail) parts.push(`Email sent to ${data.succeeded}/${data.recipients}${data.failed ? ` (${data.failed} failed)` : ''}`)
        if (showBanner) parts.push('Banner is live')
        setFeedback(`✓ ${parts.join(' · ')}`)
        setSubject(''); setBody(''); setBannerMessage('')
        void loadHistory(); void loadActiveBanner()
      }
    } catch (err) {
      setFeedback(`✗ ${err instanceof Error ? err.message : 'Network error'}`)
    } finally {
      setSending(false)
    }
  }

  const takeDownBanner = async () => {
    if (!confirm('Take down the active banner now?')) return
    try {
      const res = await adminFetch('/api/admin/banner/take-down', { method: 'POST' })
      if (res.ok) {
        setActiveBanner(null)
        setFeedback('✓ Banner taken down')
      }
    } catch {}
  }

  const previewBannerStyle = BANNER_TYPES.find(t => t.value === bannerType)!

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960, color: 'white' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Broadcast</h1>
      <p style={{ fontSize: 12, color: '#5a5a60', marginTop: 4, marginBottom: 28 }}>
        Send a one-off email and/or show a site-wide banner. Audiences can be all users, specific roles, or verified-only.
      </p>

      {/* Active banner card */}
      {activeBanner && (
        <div style={{ marginBottom: 24, padding: 16, background: '#141416', border: '1px solid #232326', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Megaphone size={14} style={{ color: '#22c55e' }} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a90' }}>Active Banner</span>
            </div>
            <button onClick={takeDownBanner} style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#fca5a5', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={11} /> Take Down
            </button>
          </div>
          <div style={{ padding: '10px 14px', borderRadius: 8, background: BANNER_TYPES.find(t => t.value === activeBanner.type)?.bg, color: BANNER_TYPES.find(t => t.value === activeBanner.type)?.fg, fontSize: 13 }}>
            {activeBanner.message}
          </div>
          <p style={{ fontSize: 11, color: '#8a8a90', marginTop: 8 }}>
            {activeBanner.expiresAt ? `Expires ${new Date(activeBanner.expiresAt).toLocaleString()}` : 'No expiry — until taken down'}
            {' · '}
            {activeBanner.audience.roles.length ? activeBanner.audience.roles.join(', ') : 'all roles'}
            {activeBanner.audience.verifiedOnly && ' · verified only'}
          </p>
        </div>
      )}

      {/* Compose form */}
      <div style={{ background: '#141416', border: '1px solid #232326', borderRadius: 12, padding: 24, marginBottom: 24 }}>

        {/* Channels */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a90', marginBottom: 10 }}>Channels</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <ToggleChip icon={Mail} label="Send Email" checked={sendEmail} onClick={() => setSendEmail(s => !s)} />
            <ToggleChip icon={Megaphone} label="Show Banner" checked={showBanner} onClick={() => setShowBanner(s => !s)} />
          </div>
        </div>

        {/* Audience */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a90', marginBottom: 10 }}>
            Audience {preview && <span style={{ color: '#5a5a60', fontWeight: 400, marginLeft: 8 }}>· {preview.recipients} recipients · {preview.label}</span>}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {ROLES.map(r => (
              <ToggleChip key={r.value} label={r.label} checked={audience.roles.includes(r.value)} onClick={() => toggleRole(r.value)} />
            ))}
          </div>
          <ToggleChip label="Verified only" checked={audience.verifiedOnly} onClick={() => setAudience(a => ({ ...a, verifiedOnly: !a.verifiedOnly }))} />
          <p style={{ fontSize: 11, color: '#5a5a60', marginTop: 8 }}>
            Leave all roles unchecked to target everyone.
          </p>
        </div>

        {/* Email content */}
        {sendEmail && (
          <div style={{ marginBottom: 24, paddingTop: 20, borderTop: '1px solid #232326' }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a90', marginBottom: 10 }}>Email</p>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject line"
              style={inputStyle}
            />
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Email body. Newlines preserved. Will be wrapped in a THIMBLE-branded HTML shell."
              rows={6}
              style={{ ...inputStyle, marginTop: 10, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
        )}

        {/* Banner content */}
        {showBanner && (
          <div style={{ marginBottom: 24, paddingTop: 20, borderTop: '1px solid #232326' }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a90', marginBottom: 10 }}>Banner</p>
            <input
              value={bannerMessage}
              onChange={e => setBannerMessage(e.target.value)}
              placeholder="Short one-line message (e.g. 'Scheduled maintenance Friday 6pm UTC')"
              maxLength={200}
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <select value={bannerType} onChange={e => setBannerType(e.target.value as BannerType)} style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}>
                {BANNER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select value={bannerHours} onChange={e => setBannerHours(Number(e.target.value))} style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}>
                {DURATIONS.map(d => <option key={d.hours} value={d.hours}>{d.label}</option>)}
              </select>
            </div>
            {bannerMessage && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: previewBannerStyle.bg, color: previewBannerStyle.fg, fontSize: 13, textAlign: 'center' }}>
                Preview: {bannerMessage}
              </div>
            )}
            <p style={{ fontSize: 11, color: '#5a5a60', marginTop: 8 }}>
              Critical banners can't be dismissed by users. Warnings dismiss per-session. Info/success dismiss permanently.
            </p>
          </div>
        )}

        {/* Send */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 20, borderTop: '1px solid #232326' }}>
          <button
            onClick={send}
            disabled={sending}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#22c55e', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: sending ? 0.5 : 1 }}
          >
            <Send size={14} />
            {sending ? 'Sending…' : 'Send Now'}
          </button>
          {feedback && (
            <span style={{ fontSize: 12, color: feedback.startsWith('✓') ? '#22c55e' : '#fca5a5' }}>
              {feedback}
            </span>
          )}
        </div>
      </div>

      {/* History */}
      <div style={{ background: '#141416', border: '1px solid #232326', borderRadius: 12, padding: '20px 24px' }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a90', marginBottom: 14 }}>
          Recent Broadcasts
        </p>
        {history.length === 0 ? (
          <p style={{ fontSize: 13, color: '#5a5a60', margin: 0 }}>No broadcasts sent yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: '#5a5a60', textAlign: 'left' }}>
                  {['Sent', 'Subject', 'Audience', 'Sent by', 'Delivered'].map(h => (
                    <th key={h} style={{ padding: '4px 8px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10, borderBottom: '1px solid #232326' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #232326' }}>
                    <td style={{ padding: '8px', color: '#8a8a90', whiteSpace: 'nowrap' }}>{new Date(b.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '8px', color: '#ededef' }}>{b.subject}</td>
                    <td style={{ padding: '8px', color: '#8a8a90' }}>{b.audience}</td>
                    <td style={{ padding: '8px', color: '#8a8a90' }}>{b.sentBy}</td>
                    <td style={{ padding: '8px', fontVariantNumeric: 'tabular-nums' }}>
                      {b.failed > 0 ? (
                        <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={11} /> {b.succeeded}/{b.recipients}
                        </span>
                      ) : (
                        <span style={{ color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={11} /> {b.succeeded}/{b.recipients}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#0a0a0b',
  border: '1px solid #232326',
  borderRadius: 6,
  color: 'white',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

function ToggleChip({ label, checked, onClick, icon: Icon }: { label: string; checked: boolean; onClick: () => void; icon?: React.ElementType }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: checked ? 'rgba(34,197,94,0.12)' : '#0a0a0b',
        border: `1px solid ${checked ? 'rgba(34,197,94,0.4)' : '#232326'}`,
        borderRadius: 999,
        color: checked ? '#86efac' : '#8a8a90',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      {Icon && <Icon size={12} />}
      {label}
    </button>
  )
}
