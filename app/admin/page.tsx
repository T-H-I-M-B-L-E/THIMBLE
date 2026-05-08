'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Stats {
  totalUsers: number
  todaySignups: number
  weekSignups: number
  pendingVerifications: number
  verifiedUsers: number
  totalLogins: number
  adminCount: number
}

interface RecentAdmin {
  id: string
  fullName: string
  email: string
  lastLoginAt: string | null
  totalLogins: number
  createdAt: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentAdmins, setRecentAdmins] = useState<RecentAdmin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/stats', { credentials: 'include' }),
      fetch('/api/admin/users?admin=true', { credentials: 'include' }),
    ]).then(async ([statsRes, adminsRes]) => {
      if (statsRes.status === 403) { router.push('/admin/login'); return }
      const statsData = await statsRes.json()
      setStats(statsData)
      if (adminsRes.ok) {
        const adminsData = await adminsRes.json()
        setRecentAdmins(Array.isArray(adminsData) ? adminsData.filter((u: RecentAdmin & { isAdmin: boolean }) => u.isAdmin) : [])
      }
    }).finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, color: 'text-white' },
    { label: 'Signups Today', value: stats?.todaySignups ?? 0, color: 'text-green-400' },
    { label: 'This Week', value: stats?.weekSignups ?? 0, color: 'text-blue-400' },
    { label: 'Pending Verification', value: stats?.pendingVerifications ?? 0, color: 'text-yellow-400' },
    { label: 'Verified Users', value: stats?.verifiedUsers ?? 0, color: 'text-emerald-400' },
    { label: 'Total Logins', value: stats?.totalLogins ?? 0, color: 'text-purple-400' },
  ]

  function formatDate(iso: string | null) {
    if (!iso) return 'Never'
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-light tracking-widest uppercase">Dashboard</h1>
        <p className="text-neutral-500 text-sm mt-1">Platform overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {statCards.map(card => (
          <div key={card.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 sm:p-5">
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-2 leading-tight">{card.label}</p>
            <p className={`text-3xl font-light ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-6 bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/admin/users" className="px-4 py-2 bg-white text-black text-sm rounded-lg hover:bg-neutral-200 transition-colors">
            View All Users
          </a>
          <a href="/admin/users?role=model" className="px-4 py-2 bg-neutral-800 text-white text-sm rounded-lg hover:bg-neutral-700 transition-colors">
            Models
          </a>
          <a href="/admin/users?role=designer" className="px-4 py-2 bg-neutral-800 text-white text-sm rounded-lg hover:bg-neutral-700 transition-colors">
            Designers
          </a>
        </div>
      </div>

      {/* Admin accounts */}
      {recentAdmins.length > 0 && (
        <div className="mt-6 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-800">
            <h2 className="text-xs uppercase tracking-widest text-neutral-500">Admin Accounts</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left">
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-normal">Admin</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-normal whitespace-nowrap">Last Login</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-normal whitespace-nowrap">Total Logins</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-normal whitespace-nowrap">Member Since</th>
                </tr>
              </thead>
              <tbody>
                {recentAdmins.map(admin => (
                  <tr key={admin.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{admin.fullName}</p>
                      <p className="text-neutral-500 text-xs mt-0.5">{admin.email}</p>
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-xs whitespace-nowrap">
                      {formatDate(admin.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3 text-purple-400 font-medium">
                      {admin.totalLogins}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs whitespace-nowrap">
                      {new Date(admin.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
