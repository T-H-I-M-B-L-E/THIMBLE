'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false) }, [pathname])

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
        w-56 border-r border-neutral-800 flex flex-col shrink-0
        bg-neutral-950 transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-neutral-800">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">THIMBLE</p>
          <p className="text-lg font-light tracking-widest mt-1">Admin</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
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
        <div className="p-4 border-t border-neutral-800">
          <a href="/" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">← Back to site</a>
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
