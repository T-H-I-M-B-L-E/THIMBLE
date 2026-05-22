'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

interface Commit {
  sha: string
  message: string
  author: string
  date: string
  url: string
}

interface EmailStats {
  thisMonth: number
  lastMonth: number
  monthlyLimit: number
  remaining: number
  breakdown: Record<string, number>
}

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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [commitEmailsEnabled, setCommitEmailsEnabled] = useState(true)
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null)
  const [togglingEmail, setTogglingEmail] = useState(false)
  const [adminName, setAdminName] = useState('')
  const [adminId, setAdminId] = useState('')
  const [authChecked, setAuthChecked] = useState(false)
  const pathname = usePathname()

  // Admin chat — background WS for unread tracking + splash notification
  const [unread, setUnread] = useState(0)
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
    fetch('/api/admin/stats', { credentials: 'include' })
      .then(r => {
        if (r.status === 401 || r.status === 403) window.location.replace('/admin/login')
        else setAuthChecked(true)
      })
      .catch(() => setAuthChecked(true))
  }, [])

  // Commits
  useEffect(() => {
    const load = () =>
      fetch('/api/admin/commits', { credentials: 'include' })
        .then(r => r.ok ? r.json() : []).then(setCommits).catch(() => {})
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  // Settings + email stats
  useEffect(() => {
    fetch('/api/admin/settings', { credentials: 'include' })
      .then(r => r.ok ? r.json() : {} as Record<string, string>)
      .then((s: Record<string, string>) => {
        if (s.commit_emails_enabled !== undefined)
          setCommitEmailsEnabled(s.commit_emails_enabled === 'true')
      }).catch(() => {})
    fetch('/api/admin/email-stats', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(s => { if (s) setEmailStats(s) }).catch(() => {})
  }, [])

  // Background WS — only for tracking unread count + splash notification
  const connectAdminChat = useCallback(async () => {
    if (chatWs.current?.readyState === WebSocket.OPEN) return
    try {
      const r = await fetch('/api/admin/ws-token', { credentials: 'include' })
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
    connectAdminChat()
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

  async function toggleCommitEmails() {
    setTogglingEmail(true)
    const next = !commitEmailsEnabled
    setCommitEmailsEnabled(next)
    await fetch('/api/admin/settings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commit_emails_enabled: next ? 'true' : 'false' }),
    }).catch(() => setCommitEmailsEnabled(!next))
    setTogglingEmail(false)
  }

  const navLinks: { href: string; label: string; badge?: number }[] = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/chat', label: 'Messages', badge: unread > 0 ? unread : undefined },
  ]

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  if (!authChecked) return <div className="min-h-screen bg-neutral-950" />

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 backdrop-blur-xl bg-black/20">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-medium">THIMBLE</p>
            <p className="text-sm font-light text-white mt-0.5">Admin</p>
          </div>
          <div className="flex items-center gap-4">
            {adminName && <p className="text-xs text-neutral-400">{adminName}</p>}
            <button
              onClick={handleLogout}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              title="Sign out"
            >
              ⎙
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Bottom Navigation Pills */}
      <div className="border-t border-white/5 backdrop-blur-xl bg-black/20 sticky bottom-0">
        <div className="px-6 py-4 flex items-center justify-center gap-3">
          {navLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              className={`relative px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                isActive(link.href)
                  ? 'bg-white/15 backdrop-blur-sm text-white shadow-lg'
                  : 'text-neutral-400 hover:text-white hover:bg-white/8'
              }`}
            >
              <span className="flex items-center gap-2">
                {link.label}
                {link.badge != null && link.badge > 0 && (
                  <span className="ml-1 min-w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-1">
                    {link.badge > 9 ? '9+' : link.badge}
                  </span>
                )}
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* Quick Settings Panel */}
      {emailStats && (
        <div className="px-6 pb-4 text-xs text-neutral-500 space-y-2">
          <div className="flex items-center justify-between">
            <span>Commit emails: {commitEmailsEnabled ? 'Sending' : 'Paused'}</span>
            <button
              onClick={toggleCommitEmails}
              disabled={togglingEmail}
              className={`relative w-8 h-4 rounded-full transition-colors ${commitEmailsEnabled ? 'bg-white/30' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${commitEmailsEnabled ? 'translate-x-3.5' : ''}`} />
            </button>
          </div>
          <div className="flex justify-between text-xs">
            <span>Emails: {emailStats.thisMonth} / {emailStats.monthlyLimit}</span>
            <span>{emailStats.remaining} remaining</span>
          </div>
        </div>
      )}

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
