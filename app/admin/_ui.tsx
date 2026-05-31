'use client'

/**
 * Shared admin UI primitives. One flat dark style, no glass-morphism,
 * no per-page inline oklch soup. Every admin page composes these.
 *
 * Palette (CSS values, kept here so it's the single source of truth):
 *   bg      #0a0a0b   page background
 *   surface #141416   cards
 *   line    #232326   borders
 *   text    #ededef   primary text
 *   dim     #8a8a90   secondary text
 *   faint   #5a5a60   tertiary text
 *   accent  #e5b94e   thimble gold (sparingly)
 */

import React, { useState } from 'react'

export const C = {
  bg: '#0a0a0b',
  surface: '#141416',
  surfaceHover: '#1a1a1d',
  line: '#232326',
  text: '#ededef',
  dim: '#8a8a90',
  faint: '#5a5a60',
  accent: '#e5b94e',
  green: '#3fcf8e',
  red: '#f0616d',
  amber: '#e5b94e',
} as const

/** Page wrapper — consistent padding + max width + bottom space for nav. */
export function Page({ title, subtitle, action, children }: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={{ padding: '24px 20px 120px', maxWidth: 880, margin: '0 auto', color: C.text }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 13, color: C.faint, marginTop: 4 }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

/** A single headline number. Used in the top row of every page. */
export function Stat({ label, value, tone }: {
  label: string
  value: React.ReactNode
  tone?: 'default' | 'good' | 'warn' | 'bad'
}) {
  const color = tone === 'good' ? C.green : tone === 'warn' ? C.amber : tone === 'bad' ? C.red : C.text
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: '16px 18px' }}>
      <p style={{ fontSize: 11, color: C.faint, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 600, color, margin: '6px 0 0', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
    </div>
  )
}

/** Responsive grid of stats. */
export function StatGrid({ children, min = 150 }: { children: React.ReactNode; min?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 12, marginBottom: 20 }}>
      {children}
    </div>
  )
}

/** A bordered surface card with optional title. */
export function Card({ title, action, children, pad = true }: {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  pad?: boolean
}) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.line}` }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.dim }}>{title}</span>
          {action}
        </div>
      )}
      <div style={{ padding: pad ? '16px 18px' : 0 }}>{children}</div>
    </div>
  )
}

/** Collapsible section for secondary detail — keeps pages essentials-first. */
export function Details({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: C.dim, fontSize: 13, cursor: 'pointer', padding: '6px 0' }}
      >
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', fontSize: 11 }}>▶</span>
        {label}
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  )
}

/** Primary button. */
export function Button({ children, onClick, tone = 'default', disabled, size = 'md' }: {
  children: React.ReactNode
  onClick?: () => void
  tone?: 'default' | 'primary' | 'danger'
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const bg = tone === 'primary' ? C.accent : tone === 'danger' ? 'rgba(240,97,109,0.12)' : C.surfaceHover
  const fg = tone === 'primary' ? '#1a1400' : tone === 'danger' ? C.red : C.text
  const border = tone === 'danger' ? 'rgba(240,97,109,0.3)' : C.line
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: size === 'sm' ? '6px 12px' : '8px 16px',
        background: bg, color: fg, border: `1px solid ${border}`,
        borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

/** Minimal table. rows is an array of cell arrays; headers optional. */
export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.faint, borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Tr({ children }: { children: React.ReactNode }) {
  return <tr style={{ borderBottom: `1px solid ${C.line}` }}>{children}</tr>
}

export function Td({ children, color, nowrap, align }: { children: React.ReactNode; color?: string; nowrap?: boolean; align?: 'left' | 'right' }) {
  return <td style={{ padding: '10px 14px', color: color || C.text, whiteSpace: nowrap ? 'nowrap' : undefined, textAlign: align, fontVariantNumeric: 'tabular-nums' }}>{children}</td>
}

/** Status dot. */
export function Dot({ ok }: { ok: boolean }) {
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: ok ? C.green : C.red }} />
}

/** Small colored pill/badge. */
export function Pill({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const map = {
    default: { bg: 'rgba(138,138,144,0.12)', fg: C.dim },
    good: { bg: 'rgba(63,207,142,0.12)', fg: C.green },
    warn: { bg: 'rgba(229,185,78,0.12)', fg: C.amber },
    bad: { bg: 'rgba(240,97,109,0.12)', fg: C.red },
  }[tone]
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: map.bg, color: map.fg }}>{children}</span>
}
