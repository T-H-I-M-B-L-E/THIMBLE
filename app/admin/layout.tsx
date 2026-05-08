'use client'

import { useState, useEffect } from 'react'
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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [commits, setCommits] = useState<Commit[]>([])
  const [commitEmailsEnabled, setCommitEmailsEnabled] = useState(true)
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null)
  const [togglingEmail, setTogglingEmail] = useState(false)
  const [adminName, setAdminName] = useState('')
  const pathname = usePathname()

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_name') || ''
    setAdminName(stored.split(' ')[0])
  }, [])

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  useEffect(() => {
    const load = () =>
      fetch('/api/admin/commits', { credentials: 'include' })
        .then(r => r.ok ? r.json() : [])
        .then(setCommits)
        .catch(() => {})
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    fetch('/api/admin/settings', { credentials: 'include' })
      .then(r => r.ok ? r.json() : {} as Record<string, string>)
      .then((s: Record<string, string>) => { if (s.commit_emails_enabled !== undefined) setCommitEmailsEnabled(s.commit_emails_enabled === 'true') })
      .catch(() => {})
    fetch('/api/admin/email-stats', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(s => { if (s) setEmailStats(s) })
      .catch(() => {})
  }, [])

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    sessionStorage.removeItem('admin_name')
    window.location.href = '/admin/login'
  }

  async function toggleCommitEmails() {
    setTogglingEmail(true)
    const next = !commitEmailsEnabled
    setCommitEmailsEnabled(next)
    await fetch('/api/admin/settings', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commit_emails_enabled: next ? 'true' : 'false' }),
    }).catch(() => setCommitEmailsEnabled(!next))
    setTogglingEmail(false)
  }

  const navLinks = [
    { href: '/admin', label: 'Dashboard', icon: '▣' },
    { href: '/admin/users', label: 'Users', icon: '⊞' },
  ]

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 border-r border-neutral-800 flex flex-col shrink-0
        bg-neutral-950 transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-neutral-800">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">THIMBLE</p>
          <p className="text-lg font-light tracking-widest mt-1">Admin</p>
          {adminName && (
            <p className="text-xs text-neutral-600 mt-1">Welcome back, {adminName}</p>
          )}
        </div>
        <nav className="p-4 space-y-1">
          {navLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive(link.href)
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <span className="text-xs">{link.icon}</span>
              {link.label}
            </a>
          ))}
        </nav>

        {/* Commit feed */}
        <div className="flex-1 overflow-hidden flex flex-col border-t border-neutral-800 min-h-0">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-neutral-500">Commits</p>
            <span className="text-xs text-neutral-600">auto-refresh</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
            {commits.length === 0 ? (
              <p className="text-xs text-neutral-700">Loading...</p>
            ) : commits.map(c => (
              <a
                key={c.sha}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="flex items-start gap-2">
                  <span className="font-mono text-xs text-neutral-600 mt-0.5 shrink-0">{c.sha}</span>
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-300 group-hover:text-white transition-colors leading-snug truncate">
                      {c.message}
                    </p>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      {c.author} · {timeAgo(c.date)}
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Email settings */}
        <div className="border-t border-neutral-800 p-4 space-y-3 shrink-0">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400">Commit emails</p>
              <p className="text-xs text-neutral-600">{commitEmailsEnabled ? 'Sending' : 'Paused'}</p>
            </div>
            <button
              onClick={toggleCommitEmails}
              disabled={togglingEmail}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
                commitEmailsEnabled ? 'bg-white' : 'bg-neutral-700'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-black rounded-full shadow transition-transform duration-200 ${
                commitEmailsEnabled ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Email quota */}
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

        <div className="p-4 border-t border-neutral-800 shrink-0 space-y-2">
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
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-neutral-400 hover:text-white transition-colors p-1"
            aria-label="Open menu"
          >
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
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side auth check happens in middleware + individual page fetches
  // This wrapper just handles the UI shell
  return <AdminLayoutInner>{children}</AdminLayoutInner>
}
