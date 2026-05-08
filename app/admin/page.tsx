'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'

interface Stats {
  totalUsers: number
  todaySignups: number
  weekSignups: number
  pendingVerifications: number
  verifiedUsers: number
}

export default function AdminDashboard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    if (!isLoading && !user) router.push('/auth')
  }, [user, isLoading, router])

  useEffect(() => {
    fetch('/api/admin/stats', { credentials: 'include' })
      .then(r => {
        if (r.status === 403) { router.push('/'); return null }
        return r.json()
      })
      .then(data => { if (data) setStats(data) })
      .finally(() => setLoadingStats(false))
  }, [router])

  if (isLoading || loadingStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, color: 'text-white' },
    { label: 'Signups Today', value: stats?.todaySignups ?? 0, color: 'text-green-400' },
    { label: 'This Week', value: stats?.weekSignups ?? 0, color: 'text-blue-400' },
    { label: 'Pending Verification', value: stats?.pendingVerifications ?? 0, color: 'text-yellow-400' },
    { label: 'Verified Users', value: stats?.verifiedUsers ?? 0, color: 'text-emerald-400' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-light tracking-widest uppercase">Dashboard</h1>
        <p className="text-neutral-500 text-sm mt-1">Platform overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map(card => (
          <div key={card.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-2">{card.label}</p>
            <p className={`text-3xl font-light ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <h2 className="text-sm uppercase tracking-widest text-neutral-500 mb-4">Quick Actions</h2>
        <div className="flex gap-3">
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
    </div>
  )
}
