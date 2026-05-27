'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, ExternalLink, Loader2 } from 'lucide-react'
import { useNotify } from '@/components/notify-provider'
import { adminFetch } from '@/lib/adminFetch'

interface VerificationRequest {
  id: number
  userId: string
  status: 'pending' | 'approved' | 'rejected'
  fullName: string
  email: string
  idDocumentUrl: string
  reason: string
  adminNote?: string
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
  userFullName?: string
  userEmail?: string
  userAvatar?: string
  userRole?: string
}

const STATUS_TABS: Array<'pending' | 'approved' | 'rejected' | 'all'> = ['pending', 'approved', 'rejected', 'all']

const statusColor: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  approved: 'text-emerald-400 bg-emerald-400/10',
  rejected: 'text-red-400 bg-red-400/10',
}

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
      .then(r => {
        if (r.status === 403) { router.push('/admin/login'); return [] }
        return r.json()
      })
      .then(d => setRequests(Array.isArray(d) ? d : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false))
  }, [filter, router])

  useEffect(() => { load() }, [load])

  const review = async (id: number, action: 'approve' | 'reject', adminNote = '') => {
    setReviewing({ id, action })
    try {
      const res = await adminFetch(`/api/admin/verification-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminNote }),
      })
      if (!res.ok) throw new Error('Failed')
      // Optimistically remove from pending list / reload
      setRequests(prev => prev.map(r => r.id === id
        ? { ...r, status: action === 'approve' ? 'approved' : 'rejected', adminNote: adminNote || r.adminNote }
        : r
      ))
      // Re-sort if on a filtered view
      if (filter !== 'all') load()
    } catch {
      notify.error('Failed to update request')
    } finally {
      setReviewing(null)
    }
  }

  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }

  return (
    <div className="p-6 sm:p-8 space-y-6 pb-32">
      <div>
        <h1 className="text-3xl font-light tracking-tight">Verification Requests</h1>
        <p className="text-neutral-500 text-sm mt-2">Review and approve user verification applications</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-full text-sm capitalize transition-colors ${
              filter === tab
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-neutral-400 hover:bg-white/10'
            }`}
          >
            {tab}
            {tab !== 'all' && counts[tab as 'pending' | 'approved' | 'rejected'] > 0 && (
              <span className="ml-2 text-xs text-neutral-500">{counts[tab as 'pending' | 'approved' | 'rejected']}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-neutral-500" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-neutral-500">No {filter === 'all' ? '' : filter} requests</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {requests.map(r => (
            <div key={r.id} className="bg-white/8 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                  {r.userAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.userAvatar} alt={r.userFullName || r.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{(r.userFullName || r.fullName)?.[0]?.toUpperCase()}</span>
                  )}
                </div>

                {/* Main */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div>
                      <p className="text-white font-medium">{r.userFullName || r.fullName}</p>
                      <p className="text-xs text-neutral-400">
                        {r.userEmail || r.email}
                        {r.userRole && <span className="capitalize"> · {r.userRole}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${statusColor[r.status]}`}>
                        {r.status}
                      </span>
                      <span className="text-xs text-neutral-500">{timeAgo(r.createdAt)}</span>
                    </div>
                  </div>

                  {/* Submitted details */}
                  <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-neutral-500 uppercase tracking-widest mb-1">Submitted name</p>
                      <p className="text-neutral-200">{r.fullName}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500 uppercase tracking-widest mb-1">Submitted email</p>
                      <p className="text-neutral-200 break-all">{r.email}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-neutral-500 uppercase tracking-widest mb-1">Reason</p>
                      <p className="text-neutral-200 whitespace-pre-wrap">{r.reason}</p>
                    </div>
                    {r.adminNote && (
                      <div className="sm:col-span-2">
                        <p className="text-neutral-500 uppercase tracking-widest mb-1">Admin note</p>
                        <p className="text-neutral-300 italic">{r.adminNote}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <a
                      href={r.idDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-neutral-300 hover:text-white px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <ExternalLink size={12} /> View ID
                    </a>

                    {r.status === 'pending' && (
                      <>
                        <button
                          onClick={() => review(r.id, 'approve')}
                          disabled={reviewing?.id === r.id}
                          className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-full transition-colors disabled:opacity-50"
                        >
                          {reviewing?.id === r.id && reviewing.action === 'approve'
                            ? <Loader2 size={12} className="animate-spin" />
                            : <CheckCircle2 size={12} />}
                          Approve
                        </button>
                        <button
                          onClick={() => { setRejectModal(r); setRejectNote('') }}
                          disabled={reviewing?.id === r.id}
                          className="inline-flex items-center gap-1 text-xs text-red-300 hover:text-red-200 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-full transition-colors disabled:opacity-50"
                        >
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => !reviewing && setRejectModal(null)}
        >
          <div
            className="bg-neutral-900 border border-white/10 rounded-2xl p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-lg font-medium text-white mb-1">Reject verification</p>
            <p className="text-xs text-neutral-400 mb-4">
              Optional note for the user explaining why their request was rejected.
            </p>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="e.g. ID photo was unclear — please re-submit"
              rows={4}
              maxLength={500}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-neutral-600 resize-none focus:outline-none focus:border-white/30"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setRejectModal(null)}
                disabled={!!reviewing}
                className="px-4 py-2 text-sm text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!rejectModal) return
                  await review(rejectModal.id, 'reject', rejectNote.trim())
                  setRejectModal(null)
                }}
                disabled={!!reviewing}
                className="px-4 py-2 text-sm bg-red-500/20 text-red-200 hover:bg-red-500/30 rounded-full disabled:opacity-50"
              >
                {reviewing?.action === 'reject' ? <Loader2 size={12} className="animate-spin inline" /> : 'Reject request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
