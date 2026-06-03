'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { adminFetch } from '@/lib/adminFetch'
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
    void adminFetch(`/api/admin/ads/${id}`)
      .then(r => r.json())
      .then(data => setAd(data))
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (values: AdFormValues) => {
    const res = await adminFetch(`/api/admin/ads/${id}`, {
      method: 'PATCH',
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
        <div className="animate-spin" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #232326', borderTopColor: '#e5b94e' }} />
      </div>
    )
  }

  if (!ad) {
    return (
      <div style={{ padding: '24px 20px', maxWidth: 620, margin: '0 auto', color: '#ededef' }}>
        <p style={{ color: '#f0616d' }}>Ad not found.</p>
        <Link href="/admin/ads" style={{ fontSize: 13, color: '#8a8a90', textDecoration: 'none' }}>← Back to Ads</Link>
      </div>
    )
  }

  const toDateInput = (iso: string) => {
    try { return new Date(iso).toISOString().slice(0, 10) } catch { return '' }
  }

  return (
    <div style={{ padding: '24px 20px 120px', maxWidth: 620, margin: '0 auto', color: '#ededef' }}>
      <Link
        href="/admin/ads"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#8a8a90', marginBottom: 20, textDecoration: 'none' }}
      >
        <ChevronLeft size={14} /> Back to Ads
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24, letterSpacing: '-0.02em' }}>Edit Ad</h1>
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
