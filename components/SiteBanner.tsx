'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface Banner {
  id: number
  message: string
  type: 'info' | 'success' | 'warning' | 'critical'
  expiresAt?: string
  createdAt: string
}

const STYLES: Record<Banner['type'], { bg: string; text: string; border: string }> = {
  info:     { bg: '#1f2937', text: '#e5e7eb', border: '#374151' },
  success:  { bg: '#064e3b', text: '#a7f3d0', border: '#047857' },
  warning:  { bg: '#78350f', text: '#fde68a', border: '#b45309' },
  critical: { bg: '#7f1d1d', text: '#fecaca', border: '#b91c1c' },
}

function dismissKey(b: Banner) {
  return `thimble_banner_dismissed_${b.id}`
}

// Critical banners can't be dismissed. Warnings are per-session.
// Info / success persist dismissals forever.
function storageFor(b: Banner): Storage | null {
  if (typeof window === 'undefined') return null
  if (b.type === 'critical') return null
  if (b.type === 'warning') return sessionStorage
  return localStorage
}

export function SiteBanner() {
  const [banner, setBanner] = useState<Banner | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/banner', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (!data) { setBanner(null); return }
        // Check dismissal state
        const storage = storageFor(data)
        if (storage && storage.getItem(dismissKey(data))) {
          setBanner(null)
          return
        }
        setBanner(data)
        setDismissed(false)
      } catch {
        // banner is optional, fail silent
      }
    }
    load()
    // Refresh every 5 min so admin updates surface without a hard refresh
    const id = setInterval(load, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  if (!banner || dismissed) return null
  const style = STYLES[banner.type] || STYLES.info
  const canDismiss = banner.type !== 'critical'

  const dismiss = () => {
    const storage = storageFor(banner)
    if (storage) storage.setItem(dismissKey(banner), '1')
    setDismissed(true)
  }

  return (
    <div
      role="status"
      style={{
        background: style.bg,
        color: style.text,
        borderBottom: `1px solid ${style.border}`,
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 60,
      }}
    >
      <span style={{ textAlign: 'center', flex: '0 1 auto' }}>{banner.message}</span>
      {canDismiss && (
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: style.text,
            cursor: 'pointer',
            padding: 4,
            opacity: 0.7,
            display: 'flex',
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
