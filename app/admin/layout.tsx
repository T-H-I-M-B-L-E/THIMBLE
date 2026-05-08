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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <polyline points="2 4 6 8 10 4" />
    </svg>
  )
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [commits, setCommits] = useState<Commit[]>([])
  const [commitsOpen, setCommitsOpen] = useState(false) // collapsed by default
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

  useEffect(() => { setSidebarOpen(false) }, [pathname])

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
          // Only count/notify if this is from someone else and we're not on the chat page
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

  const navLinks: { href: string; label: string; icon: string; badge?: number }[] = [
    { href: '/admin', label: 'Dashboard', icon: '▣' },
    { href: '/admin/users', label: 'Users', icon: '⊞' },
    { href: '/admin/chat', label: 'Messages', icon: '◈', badge: unread > 0 ? unread : undefined },
  ]

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  if (!authChecked) return <div className="min-h-screen bg-neutral-950" />

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 border-r border-neutral-800 flex flex-col shrink-0
        bg-neutral-950 transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header */}
        <div className="p-6 border-b border-neutral-800">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">THIMBLE</p>
          <p className="text-lg font-light tracking-widest mt-1">Admin</p>
          {adminName && <p className="text-xs text-neutral-600 mt-1">Welcome back, {adminName}</p>}
        </div>

        {/* Nav */}
        <nav className="p-4 space-y-1 shrink-0">
          {navLinks.map(link => (
            <a key={link.href} href={link.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive(link.href) ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <span className="text-xs">{link.icon}</span>
              <span className="flex-1">{link.label}</span>
              {link.badge != null && link.badge > 0 && (
                <span className="min-w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-1">
                  {link.badge > 9 ? '9+' : link.badge}
                </span>
              )}
            </a>
          ))}
        </nav>

        {/* Collapsible commit feed */}
        <div className="border-t border-neutral-800 shrink-0">
          <button
            onClick={() => setCommitsOpen(o => !o)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-900 transition-colors"
          >
            <p className="text-xs uppercase tracking-widest text-neutral-500">Commits</p>
            <div className="flex items-center gap-2 text-neutral-600">
              <span className="text-xs">{commitsOpen ? '' : `${commits.length}`}</span>
              <ChevronIcon open={commitsOpen} />
            </div>
          </button>
          {commitsOpen && (
            <div className="max-h-48 overflow-y-auto px-4 pb-3 space-y-3">
              {commits.length === 0 ? (
                <p className="text-xs text-neutral-700">Loading...</p>
              ) : commits.map(c => (
                <a key={c.sha} href={c.url} target="_blank" rel="noopener noreferrer" className="block group">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs text-neutral-600 mt-0.5 shrink-0">{c.sha}</span>
                    <div className="min-w-0">
                      <p className="text-xs text-neutral-300 group-hover:text-white transition-colors leading-snug truncate">{c.message}</p>
                      <p className="text-xs text-neutral-600 mt-0.5">{c.author} · {timeAgo(c.date)}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Email settings */}
        <div className="border-t border-neutral-800 p-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400">Commit emails</p>
              <p className="text-xs text-neutral-600">{commitEmailsEnabled ? 'Sending' : 'Paused'}</p>
            </div>
            <button
              onClick={toggleCommitEmails} disabled={togglingEmail}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${commitEmailsEnabled ? 'bg-white' : 'bg-neutral-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-black rounded-full shadow transition-transform duration-200 ${commitEmailsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
          {emailStats && (
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-neutral-600">Emails this month</span>
                <span className="text-xs text-neutral-500">{emailStats.thisMonth} / {emailStats.monthlyLimit}</span>
              </div>
              <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    emailStats.thisMonth / emailStats.monthlyLimit > 0.8 ? 'bg-red-500' :
                    emailStats.thisMonth / emailStats.monthlyLimit > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((emailStats.thisMonth / emailStats.monthlyLimit) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-neutral-700 mt-1">{emailStats.remaining} remaining</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 shrink-0 space-y-2 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-xs text-red-500/70 hover:text-red-400 transition-colors py-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
          <a href="/" className="text-xs text-neutral-700 hover:text-neutral-500 transition-colors block">← Back to site</a>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-neutral-800 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-neutral-400 hover:text-white transition-colors p-1" aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect y="3" width="20" height="2" rx="1"/>
              <rect y="9" width="20" height="2" rx="1"/>
              <rect y="15" width="20" height="2" rx="1"/>
            </svg>
          </button>
          <p className="text-sm tracking-widest text-neutral-400">THIMBLE Admin</p>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

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
