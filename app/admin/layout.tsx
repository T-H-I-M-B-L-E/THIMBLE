'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { adminFetch } from '@/lib/adminFetch'

interface ChatMsg {
  id: number
  userId: string
  name: string
  content: string
  timestamp: number
}

interface MsgNotif {
  senderFirstName: string
  visible: boolean
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const [adminName, setAdminName] = useState('')
  const [adminId, setAdminId] = useState('')
  const [authChecked, setAuthChecked] = useState(false)
  const pathname = usePathname()

  // Admin chat — background WS for unread tracking + splash notification
  const [unread, setUnread] = useState(0)
  const [pendingVerifications, setPendingVerifications] = useState(0)
  const [notif, setNotif] = useState<MsgNotif>({ senderFirstName: '', visible: false })
  const chatWs = useRef<WebSocket | null>(null)
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSeenId = useRef<number>(0)

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_name') || ''
    const storedId = sessionStorage.getItem('admin_id') || ''
    setAdminName(stored.split(' ')[0])
    setAdminId(storedId)
  }, [])

  // Auth gate
  useEffect(() => {
    adminFetch('/api/admin/stats')
      .then(r => {
        if (r.status === 403) window.location.replace('/admin/login')
        else setAuthChecked(true)
      })
      .catch(() => setAuthChecked(true))
  }, [])

  // Pending verifications count (polls every 60s)
  useEffect(() => {
    if (!authChecked) return
    const load = () =>
      adminFetch('/api/admin/stats')
        .then(r => r.ok ? r.json() : null)
        .then(s => { if (s?.pendingVerifications != null) setPendingVerifications(s.pendingVerifications) })
        .catch(() => {})
    void load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [authChecked])

  // Background WS — only for tracking unread count + splash notification
  const connectAdminChat = useCallback(async () => {
    if (chatWs.current?.readyState === WebSocket.OPEN) return
    try {
      const r = await adminFetch('/api/admin/ws-token')
      if (!r.ok) return
      const { token } = await r.json()
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
      const wsUrl = apiBase.replace(/^http/, 'ws') + `/admin/ws?token=${encodeURIComponent(token)}`
      const sock = new WebSocket(wsUrl)
      chatWs.current = sock

      sock.onclose = () => { chatWs.current = null }
      sock.onerror = () => { chatWs.current = null }
      sock.onmessage = (e) => {
        try {
          const msg: ChatMsg = JSON.parse(e.data)
          if (msg.userId === adminId) return
          if (msg.id <= lastSeenId.current) return
          lastSeenId.current = msg.id
          const onChatPage = window.location.pathname === '/admin/chat'
          if (!onChatPage) {
            setUnread(u => u + 1)
            const firstName = (msg.name || 'Someone').split(' ')[0]
            setNotif({ senderFirstName: firstName, visible: true })
            if (notifTimer.current) clearTimeout(notifTimer.current)
            notifTimer.current = setTimeout(() => setNotif(n => ({ ...n, visible: false })), 4000)
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, [adminId])

  // Connect WS when auth is ready
  useEffect(() => {
    if (!authChecked) return
    void connectAdminChat()
    return () => { chatWs.current?.close(); if (notifTimer.current) clearTimeout(notifTimer.current) }
  }, [authChecked, connectAdminChat])

  // Clear unread when navigating to chat page
  useEffect(() => {
    if (pathname === '/admin/chat') setUnread(0)
  }, [pathname])

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    sessionStorage.removeItem('admin_name')
    sessionStorage.removeItem('admin_id')
    window.location.href = '/admin/login'
  }

  const navLinks: { href: string; label: string; badge?: number }[] = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/ads', label: 'Ads' },
    { href: '/admin/broadcast', label: 'Broadcast' },
    { href: '/admin/infra', label: 'Infra' },
    { href: '/admin/verification', label: 'Verify', badge: pendingVerifications > 0 ? pendingVerifications : undefined },
    { href: '/admin/chat', label: 'Messages', badge: unread > 0 ? unread : undefined },
  ]

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  if (!authChecked) return <div style={{ minHeight: '100vh', background: '#0a0a0b' }} />

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0b', color: '#ededef', display: 'flex', flexDirection: 'column' }}>
      {/* Minimal header */}
      <header style={{ borderBottom: '1px solid #232326', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.18em', color: '#ededef' }}>THIMBLE</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {adminName && <span style={{ fontSize: 12, color: '#8a8a90' }}>{adminName}</span>}
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{ background: 'transparent', border: 'none', color: '#5a5a60', fontSize: 12, cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>

      {/* Bottom nav */}
      <nav style={{ position: 'sticky', bottom: 0, borderTop: '1px solid #232326', background: '#0c0c0d', display: 'flex', justifyContent: 'center', gap: 2, padding: '8px 8px', overflowX: 'auto' }}>
        {navLinks.map(link => {
          const active = isActive(link.href)
          return (
            <a
              key={link.href}
              href={link.href}
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                textDecoration: 'none', whiteSpace: 'nowrap',
                color: active ? '#ededef' : '#7a7a80',
                background: active ? '#1a1a1d' : 'transparent',
              }}
            >
              {link.label}
              {link.badge != null && link.badge > 0 && (
                <span style={{ minWidth: 16, height: 16, padding: '0 4px', background: '#f0616d', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {link.badge > 9 ? '9+' : link.badge}
                </span>
              )}
            </a>
          )
        })}
      </nav>

      {/* ── New message splash notification ── */}
      <div
        onClick={() => { setNotif(n => ({ ...n, visible: false })); window.location.href = '/admin/chat' }}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'oklch(0.04 0.003 60 / 0.88)',
          backdropFilter: 'blur(12px)',
          cursor: 'pointer',
          opacity: notif.visible ? 1 : 0,
          pointerEvents: notif.visible ? 'all' : 'none',
          transition: 'opacity 0.35s ease',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'oklch(0.18 0.010 60)',
            border: '1px solid oklch(0.30 0.010 60)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="oklch(0.85 0.08 60)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <p style={{ fontSize: 11, letterSpacing: '0.35em', color: 'oklch(0.50 0.006 60)', textTransform: 'uppercase', marginBottom: 10 }}>
            New Message
          </p>
          <p style={{ fontSize: 32, fontWeight: 300, color: '#ffffff', letterSpacing: '-0.01em', marginBottom: 6 }}>
            {notif.senderFirstName}
          </p>
          <p style={{ fontSize: 13, color: 'oklch(0.55 0.006 60)' }}>sent you a message</p>
          <p style={{ fontSize: 11, color: 'oklch(0.38 0.006 60)', marginTop: 28, letterSpacing: '0.1em' }}>
            TAP TO VIEW
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutInner>{children}</AdminLayoutInner>
}
