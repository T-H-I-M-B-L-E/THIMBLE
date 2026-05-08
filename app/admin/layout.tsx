import { redirect } from 'next/navigation'
import { getUserFromToken } from '@/lib/jwt-middleware'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-neutral-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-neutral-800">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">THIMBLE</p>
          <p className="text-lg font-light tracking-widest mt-1">Admin</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <a href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors">
            <span>📊</span> Dashboard
          </a>
          <a href="/admin/users" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors">
            <span>👥</span> Users
          </a>
        </nav>
        <div className="p-4 border-t border-neutral-800">
          <a href="/" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">← Back to site</a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
