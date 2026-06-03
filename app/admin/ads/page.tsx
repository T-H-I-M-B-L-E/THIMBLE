'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, ToggleLeft, ToggleRight, Pencil, Trash2 } from 'lucide-react'
import { useNotify } from '@/components/notify-provider'
import { adminFetch } from '@/lib/adminFetch'
import { Page, Card, Pill, C } from '../_ui'

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

  useEffect(() => { void load() }, [])

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
    <Page
      title="Ads"
      subtitle={`${ads.length} ad${ads.length !== 1 ? 's' : ''}`}
      action={
        <Link href="/admin/ads/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: C.accent, color: '#1a1400', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          <Plus size={15} /> New Ad
        </Link>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
          <div style={{ width: 24, height: 24, border: `2px solid ${C.line}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : ads.length === 0 ? (
        <Card><p style={{ textAlign: 'center', color: C.faint, fontSize: 13, margin: 0 }}>No ads yet. Create one to get started.</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ads.map(ad => (
            <div
              key={ad.id}
              style={{
                display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 14, alignItems: 'center',
                padding: '12px 14px', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12,
              }}
            >
              <img src={ad.imageUrl} alt={ad.title} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} />

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{ad.title}</span>
                  <Pill tone={ad.isActive ? 'good' : 'default'}>{ad.isActive ? 'Active' : 'Paused'}</Pill>
                  <Pill>{ad.placement}</Pill>
                </div>
                <p style={{ fontSize: 12, color: C.faint, margin: '3px 0 0' }}>
                  {ad.sponsorName} · {ad.impressionCount.toLocaleString()} views · {ad.clickCount.toLocaleString()} clicks
                </p>
              </div>

              <div style={{ display: 'flex', gap: 2 }}>
                <button onClick={() => handleToggle(ad.id)} title={ad.isActive ? 'Pause' : 'Activate'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: C.dim }}>
                  {ad.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>
                <Link href={`/admin/ads/${ad.id}`} title="Edit" style={{ display: 'flex', alignItems: 'center', padding: 6, color: C.dim }}>
                  <Pencil size={15} />
                </Link>
                <button onClick={() => handleDelete(ad.id, ad.title)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: C.red }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  )
}
