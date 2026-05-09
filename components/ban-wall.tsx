'use client'

import { useEffect, useState } from 'react'

interface Props {
  bannedUntil: string | null | undefined
  banMessage: string | undefined
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function useCountdown(until: string | null | undefined) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!until) { setRemaining(null); return }
    const target = new Date(until).getTime()
    const tick = () => {
      const diff = target - Date.now()
      setRemaining(diff > 0 ? diff : 0)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [until])

  return remaining
}

function Countdown({ ms }: { ms: number }) {
  const totalSecs = Math.floor(ms / 1000)
  const days = Math.floor(totalSecs / 86400)
  const hours = Math.floor((totalSecs % 86400) / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  const secs = totalSecs % 60

  return (
    <div className="flex items-center justify-center gap-3">
      {days > 0 && (
        <>
          <div className="text-center">
            <p className="text-5xl font-bold text-white tabular-nums">{pad(days)}</p>
            <p className="text-xs uppercase tracking-widest text-neutral-500 mt-1">days</p>
          </div>
          <p className="text-3xl font-bold text-neutral-600 mb-4">:</p>
        </>
      )}
      <div className="text-center">
        <p className="text-5xl font-bold text-white tabular-nums">{pad(hours)}</p>
        <p className="text-xs uppercase tracking-widest text-neutral-500 mt-1">hrs</p>
      </div>
      <p className="text-3xl font-bold text-neutral-600 mb-4">:</p>
      <div className="text-center">
        <p className="text-5xl font-bold text-white tabular-nums">{pad(mins)}</p>
        <p className="text-xs uppercase tracking-widest text-neutral-500 mt-1">min</p>
      </div>
      <p className="text-3xl font-bold text-neutral-600 mb-4">:</p>
      <div className="text-center">
        <p className="text-5xl font-bold text-white tabular-nums">{pad(secs)}</p>
        <p className="text-xs uppercase tracking-widest text-neutral-500 mt-1">sec</p>
      </div>
    </div>
  )
}

export function BanWall({ bannedUntil, banMessage }: Props) {
  const remaining = useCountdown(bannedUntil)
  const isPermanent = !bannedUntil
  const expired = remaining !== null && remaining === 0

  if (expired) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6"
      style={{ background: '#050505' }}
    >
      {/* Top label */}
      <p className="text-xs uppercase tracking-[0.4em] text-neutral-600 mb-10">THIMBLE</p>

      {/* Icon */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        border: '1px solid oklch(0.28 0.05 10)',
        background: 'oklch(0.10 0.02 10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 32,
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="oklch(0.55 0.12 15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>

      {/* Headline */}
      <h1 style={{ fontSize: 28, fontWeight: 300, color: '#ffffff', letterSpacing: '-0.01em', marginBottom: 8, textAlign: 'center' }}>
        You&apos;ve been banned
      </h1>

      {isPermanent ? (
        <p style={{ fontSize: 13, color: 'oklch(0.45 0.006 0)', marginBottom: 40, textAlign: 'center' }}>
          Your account has been permanently suspended.
        </p>
      ) : (
        <p style={{ fontSize: 13, color: 'oklch(0.45 0.006 0)', marginBottom: 40, textAlign: 'center' }}>
          Access will be restored when the timer reaches zero.
        </p>
      )}

      {/* Countdown */}
      {!isPermanent && remaining !== null && (
        <div style={{ marginBottom: 48 }}>
          <Countdown ms={remaining} />
        </div>
      )}

      {/* Message from the team */}
      {banMessage && (
        <div style={{
          maxWidth: 460,
          background: 'oklch(0.10 0.006 0)',
          border: '1px solid oklch(0.20 0.006 0)',
          borderRadius: 16,
          padding: '20px 24px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 10, letterSpacing: '0.3em', color: 'oklch(0.38 0.006 0)', textTransform: 'uppercase', marginBottom: 10 }}>
            Message from the team
          </p>
          <p style={{ fontSize: 14, color: 'oklch(0.70 0.006 0)', lineHeight: 1.65 }}>
            {banMessage}
          </p>
        </div>
      )}

      {/* Footer */}
      <p style={{ fontSize: 11, color: 'oklch(0.28 0.006 0)', marginTop: 48 }}>
        If you believe this is a mistake, contact support.
      </p>
    </div>
  )
}
