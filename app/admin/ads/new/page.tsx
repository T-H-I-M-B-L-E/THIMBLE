'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { AdForm } from '@/components/ad-form'
import type { AdFormValues } from '@/components/ad-form'

export default function NewAdPage() {
  const router = useRouter()

  const handleSubmit = async (values: AdFormValues) => {
    const res = await fetch('/api/admin/ads', {
      method: 'POST',
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

  return (
    <div style={{ padding: '24px 32px', maxWidth: 620 }}>
      <Link
        href="/admin/ads"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--t-ink-3)', marginBottom: 20 }}
      >
        <ChevronLeft size={14} /> Back to Ads
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>New Ad</h1>
      <AdForm onSubmit={handleSubmit} submitLabel="Create Ad" />
    </div>
  )
}
