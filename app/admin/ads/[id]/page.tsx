'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { AdForm } from '@/components/ad-form'
import type { AdFormValues } from '@/components/ad-form'

interface Ad {
  id: string
  title: string
  sponsorName: string
  description: string
  imageUrl: string
  videoUrl: string
  redirectUrl: string
  placement: string
  isActive: boolean
  startDate: string
  endDate: string
}

export default function EditAdPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [ad, setAd] = useState<Ad | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/ads/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setAd(data))
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (values: AdFormValues) => {
    const res = await fetch(`/api/admin/ads/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: values.title,
        sponsorName: values.sponsorName,
        description: values.description || undefined,
        imageUrl: values.imageUrl,
        videoUrl: values.videoUrl || undefined,
        redirectUrl: values.redirectUrl,
        placement: values.placement,
        isActive: values.isActive,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || err.message || `Server error ${res.status}`)
    }
    router.push('/admin/ads')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 64 }}>
        <div className="animate-spin" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--t-line)', borderTopColor: 'var(--t-gold)' }} />
      </div>
    )
  }

  if (!ad) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <p style={{ color: 'var(--t-danger)' }}>Ad not found.</p>
        <Link href="/admin/ads" style={{ fontSize: 13, color: 'var(--t-ink-3)' }}>← Back to Ads</Link>
      </div>
    )
  }

  const toDateInput = (iso: string) => {
    try { return new Date(iso).toISOString().slice(0, 10) } catch { return '' }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 620 }}>
      <Link
        href="/admin/ads"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--t-ink-3)', marginBottom: 20 }}
      >
        <ChevronLeft size={14} /> Back to Ads
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Edit Ad</h1>
      <AdForm
        initial={{
          title: ad.title,
          sponsorName: ad.sponsorName,
          description: ad.description,
          imageUrl: ad.imageUrl,
          videoUrl: ad.videoUrl,
          redirectUrl: ad.redirectUrl,
          placement: ad.placement,
          isActive: ad.isActive,
          startDate: toDateInput(ad.startDate),
          endDate: toDateInput(ad.endDate),
        }}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
    </div>
  )
}
