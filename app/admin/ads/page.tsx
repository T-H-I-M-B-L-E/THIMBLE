'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, ToggleLeft, ToggleRight, Pencil, Trash2 } from 'lucide-react'
import { useNotify } from '@/components/notify-provider'
import { adminFetch } from '@/lib/adminFetch'

interface Ad {
  id: string
  title: string
  sponsorName: string
  placement: string
  isActive: boolean
  startDate: string
  endDate: string
  clickCount: number
  impressionCount: number
  imageUrl: string
}

export default function AdminAdsPage() {
  const router = useRouter()
  const notify = useNotify()
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminFetch('/api/admin/ads')
      if (res.status === 401) { router.push('/admin'); return }
      const data = await res.json()
      setAds(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (id: string) => {
    const res = await adminFetch(`/api/admin/ads/${id}/toggle`, { method: 'PATCH' })
    if (res.ok) {
      const updated = await res.json()
      setAds(prev => prev.map(a => a.id === id ? { ...a, isActive: updated.isActive } : a))
    }
  }

  const handleDelete = async (id: string, title: string) => {
    const ok = await notify.confirm({
      title: `Delete "${title}"?`,
      message: 'This will permanently remove the ad and all its impression data.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    const res = await adminFetch(`/api/admin/ads/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setAds(prev => prev.filter(a => a.id !== id))
    } else {
      notify.error('Failed to delete ad')
    }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' })

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Advertisements</h1>
          <p style={{ fontSize: 13, color: 'var(--t-ink-3)', marginTop: 4 }}>{ads.length} ad{ads.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link
          href="/admin/ads/new"
          className="t-btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <Plus size={15} /> New Ad
        </Link>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
          <div className="animate-spin" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--t-line)', borderTopColor: 'var(--t-gold)' }} />
        </div>
      ) : ads.length === 0 ? (
        <div className="t-empty-state" style={{ paddingTop: 48 }}>
          <p>No ads yet. Create one to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ads.map(ad => (
            <div
              key={ad.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '56px 1fr auto',
                gap: 16,
                alignItems: 'center',
                padding: '12px 16px',
                background: 'var(--t-surface)',
                border: '1px solid var(--t-line)',
                borderRadius: 10,
              }}
            >
              {/* Thumbnail */}
              <img
                src={ad.imageUrl}
                alt={ad.title}
                style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
              />

              {/* Info */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{ad.title}</span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '1px 7px',
                      borderRadius: 4,
                      fontWeight: 500,
                      background: ad.isActive ? 'rgba(34,197,94,.15)' : 'var(--t-surface-2)',
                      color: ad.isActive ? '#16a34a' : 'var(--t-ink-3)',
                    }}
                  >
                    {ad.isActive ? 'Active' : 'Paused'}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '1px 7px',
                      borderRadius: 4,
                      background: 'var(--t-surface-2)',
                      color: 'var(--t-ink-3)',
                      fontWeight: 500,
                    }}
                  >
                    {ad.placement}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--t-ink-3)', margin: '3px 0 0' }}>
                  {ad.sponsorName} · {fmtDate(ad.startDate)} – {fmtDate(ad.endDate)}
                </p>
                <p style={{ fontSize: 12, color: 'var(--t-ink-3)', margin: '2px 0 0' }}>
                  {ad.impressionCount.toLocaleString()} impressions · {ad.clickCount.toLocaleString()} clicks
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => handleToggle(ad.id)}
                  title={ad.isActive ? 'Pause' : 'Activate'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--t-ink-2)' }}
                >
                  {ad.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>
                <Link
                  href={`/admin/ads/${ad.id}`}
                  title="Edit"
                  style={{ display: 'flex', alignItems: 'center', padding: 6, color: 'var(--t-ink-2)' }}
                >
                  <Pencil size={15} />
                </Link>
                <button
                  onClick={() => handleDelete(ad.id, ad.title)}
                  title="Delete"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--t-danger)' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
