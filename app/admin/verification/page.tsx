'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, ExternalLink, Loader2 } from 'lucide-react'
import { useNotify } from '@/components/notify-provider'
import { adminFetch } from '@/lib/adminFetch'
import { Page, Card, Pill, Button, C } from '../_ui'

interface VerificationRequest {
  id: number
  userId: string
  status: 'pending' | 'approved' | 'rejected'
  fullName: string
  email: string
  idDocumentUrl: string
  reason: string
  adminNote?: string
  createdAt: string
  userFullName?: string
  userEmail?: string
  userAvatar?: string
  userRole?: string
}

const STATUS_TABS: Array<'pending' | 'approved' | 'rejected' | 'all'> = ['pending', 'approved', 'rejected', 'all']

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AdminVerificationPage() {
  const router = useRouter()
  const notify = useNotify()
  const [requests, setRequests] = useState<VerificationRequest[]>([])
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState<{ id: number; action: 'approve' | 'reject' } | null>(null)
  const [rejectModal, setRejectModal] = useState<VerificationRequest | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const q = filter === 'all' ? '' : `?status=${filter}`
    adminFetch(`/api/admin/verification-requests${q}`)
      .then(r => { if (r.status === 403) { router.push('/admin/login'); return [] } return r.json() })
      .then(d => setRequests(Array.isArray(d) ? d : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false))
  }, [filter, router])

  useEffect(() => { load() }, [load])

  const review = async (id: number, action: 'approve' | 'reject', adminNote = '') => {
    setReviewing({ id, action })
    try {
      const res = await adminFetch(`/api/admin/verification-requests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, adminNote }),
      })
      if (!res.ok) throw new Error('Failed')
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: action === 'approve' ? 'approved' : 'rejected', adminNote: adminNote || r.adminNote } : r))
      if (filter !== 'all') load()
    } catch {
      notify.error('Failed to update request')
    } finally {
      setReviewing(null)
    }
  }

  return (
    <Page title="Verification" subtitle="Review user verification applications">
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '6px 14px', borderRadius: 999, fontSize: 13, textTransform: 'capitalize', cursor: 'pointer',
              background: filter === tab ? C.surfaceHover : 'transparent',
              border: `1px solid ${filter === tab ? C.line : 'transparent'}`,
              color: filter === tab ? C.text : C.faint,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Loader2 size={20} style={{ color: C.faint, animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : requests.length === 0 ? (
        <Card><p style={{ textAlign: 'center', color: C.faint, fontSize: 13, margin: 0 }}>No {filter === 'all' ? '' : filter} requests</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requests.map(r => (
            <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: C.surfaceHover, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>
                  {r.userAvatar ? <img src={r.userAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (r.userFullName || r.fullName)?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{r.userFullName || r.fullName}</span>
                        <Pill tone={r.status === 'approved' ? 'good' : r.status === 'rejected' ? 'bad' : 'warn'}>{r.status}</Pill>
                      </div>
                      <p style={{ fontSize: 12, color: C.faint, margin: '2px 0 0' }}>
                        {r.userEmail || r.email}{r.userRole && <span style={{ textTransform: 'capitalize' }}> · {r.userRole}</span>}
                      </p>
                    </div>
                    <span style={{ fontSize: 12, color: C.faint, whiteSpace: 'nowrap' }}>{timeAgo(r.createdAt)}</span>
                  </div>

                  <p style={{ fontSize: 13, color: C.dim, margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>{r.reason}</p>
                  {r.adminNote && <p style={{ fontSize: 12, color: C.faint, margin: '6px 0 0', fontStyle: 'italic' }}>Note: {r.adminNote}</p>}

                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    <a href={r.idDocumentUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.dim, padding: '6px 12px', background: C.surfaceHover, borderRadius: 8, textDecoration: 'none' }}>
                      <ExternalLink size={12} /> View ID
                    </a>
                    {r.status === 'pending' && (
                      <>
                        <button onClick={() => review(r.id, 'approve')} disabled={reviewing?.id === r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.green, padding: '6px 12px', background: 'rgba(63,207,142,0.1)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                          {reviewing?.id === r.id && reviewing.action === 'approve' ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <CheckCircle2 size={12} />} Approve
                        </button>
                        <button onClick={() => { setRejectModal(r); setRejectNote('') }} disabled={reviewing?.id === r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.red, padding: '6px 12px', background: 'rgba(240,97,109,0.1)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                          <XCircle size={12} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)' }} onClick={() => !reviewing && setRejectModal(null)}>
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Reject verification</p>
            <p style={{ fontSize: 12, color: C.faint, margin: '4px 0 14px' }}>Optional note explaining why.</p>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="e.g. ID photo was unclear — please re-submit"
              rows={3}
              maxLength={500}
              style={{ width: '100%', background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: C.text, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <Button onClick={() => setRejectModal(null)} disabled={!!reviewing}>Cancel</Button>
              <Button tone="danger" disabled={!!reviewing} onClick={async () => { if (!rejectModal) return; await review(rejectModal.id, 'reject', rejectNote.trim()); setRejectModal(null) }}>
                {reviewing?.action === 'reject' ? 'Rejecting…' : 'Reject request'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}
