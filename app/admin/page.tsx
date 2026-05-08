'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface RoleCount { role: string; count: number }
interface DailyCount { date: string; count: number }
interface Stats {
  totalUsers: number
  todaySignups: number
  weekSignups: number
  pendingVerifications: number
  verifiedUsers: number
  unverifiedUsers: number
  totalLogins: number
  adminCount: number
  returnedUsers: number
  neverLoggedIn: number
  totalPosts: number
  postsThisWeek: number
  totalGigs: number
  roleBreakdown: RoleCount[]
  dailySignups: DailyCount[]
}
interface AdminUser {
  id: string; fullName: string; email: string
  lastLoginAt: string | null; totalLogins: number; createdAt: string; isAdmin: boolean
}
interface AuditLog {
  id: number; adminName: string; action: string
  targetName: string; details: string; createdAt: string
}

function StatCard({ label, value, color = 'text-white', sub }: {
  label: string; value: number | string; color?: string; sub?: string
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
      <p className="text-xs text-neutral-500 uppercase tracking-widest mb-2 leading-tight">{label}</p>
      <p className={`text-3xl font-light ${color}`}>{value}</p>
      {sub && <p className="text-xs text-neutral-600 mt-1">{sub}</p>}
    </div>
  )
}

function BarChart({ data }: { data: DailyCount[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map(d => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-white/10 rounded-sm transition-all"
            style={{ height: `${Math.max((d.count / max) * 56, 3)}px` }}
            title={`${d.date}: ${d.count}`}
          />
          <span className="text-neutral-700 text-xs truncate w-full text-center" style={{ fontSize: 9 }}>
            {d.date}
          </span>
        </div>
      ))}
    </div>
  )
}

function actionLabel(action: string) {
  return action.replace(/_/g, ' ')
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [adminName, setAdminName] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_name') || ''
    setAdminName(stored.split(' ')[0])
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/stats', { credentials: 'include' }),
      fetch('/api/admin/users?admin=true', { credentials: 'include' }),
      fetch('/api/admin/audit-log', { credentials: 'include' }),
    ]).then(async ([sRes, aRes, lRes]) => {
      if (sRes.status === 403) { router.push('/admin/login'); return }
      setStats(await sRes.json())
      if (aRes.ok) {
        const d = await aRes.json()
        setAdmins(Array.isArray(d) ? d.filter((u: AdminUser & { isAdmin: boolean }) => u.isAdmin) : [])
      }
      if (lRes.ok) setAuditLogs(await lRes.json())
    }).finally(() => setLoading(false))
  }, [router])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const verifiedPct = stats && stats.totalUsers > 0
    ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100) : 0

  const retentionPct = stats && stats.totalUsers > 0
    ? Math.round((stats.returnedUsers / stats.totalUsers) * 100) : 0

  return (
    <div className="p-4 sm:p-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-light tracking-widest uppercase">
          {adminName ? `Hey, ${adminName}.` : 'Dashboard'}
        </h1>
        <p className="text-neutral-500 text-sm mt-1">Platform overview · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Total Users" value={stats?.totalUsers ?? 0} />
        <StatCard label="Signups Today" value={stats?.todaySignups ?? 0} color="text-green-400" />
        <StatCard label="This Week" value={stats?.weekSignups ?? 0} color="text-blue-400" />
        <StatCard label="Total Logins" value={stats?.totalLogins ?? 0} color="text-purple-400" />
        <StatCard label="Total Posts" value={stats?.totalPosts ?? 0} color="text-orange-400" sub={`${stats?.postsThisWeek ?? 0} this week`} />
        <StatCard label="Gigs Posted" value={stats?.totalGigs ?? 0} color="text-pink-400" />
      </div>

      {/* Verification funnel + Retention */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-4">Verification Funnel</p>
          <div className="space-y-2">
            {[
              { label: 'Signed Up', value: stats?.totalUsers ?? 0, color: 'bg-white/10' },
              { label: 'Verified', value: stats?.verifiedUsers ?? 0, color: 'bg-emerald-500/30' },
              { label: 'Pending', value: stats?.pendingVerifications ?? 0, color: 'bg-yellow-500/30' },
              { label: 'Unverified', value: stats?.unverifiedUsers ?? 0, color: 'bg-red-500/20' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3">
                <div className={`h-2 rounded-full ${row.color}`}
                  style={{ width: `${stats?.totalUsers ? Math.max((row.value / stats.totalUsers) * 100, 4) : 4}%`, minWidth: 8 }} />
                <span className="text-xs text-neutral-400 whitespace-nowrap">{row.label}</span>
                <span className="text-xs text-neutral-500 ml-auto">{row.value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-neutral-600 mt-3">{verifiedPct}% verification rate</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-4">Retention</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-neutral-400">Returned users</span>
                <span className="text-xs text-neutral-400">{stats?.returnedUsers ?? 0}</span>
              </div>
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${retentionPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-neutral-400">Never logged in</span>
                <span className="text-xs text-neutral-400">{stats?.neverLoggedIn ?? 0}</span>
              </div>
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500/60 rounded-full"
                  style={{ width: `${stats?.totalUsers ? Math.round(((stats?.neverLoggedIn ?? 0) / stats.totalUsers) * 100) : 0}%` }} />
              </div>
            </div>
          </div>
          <p className="text-xs text-neutral-600 mt-3">{retentionPct}% return rate</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-4">Role Breakdown</p>
          <div className="space-y-2">
            {(stats?.roleBreakdown ?? []).slice(0, 6).map(r => (
              <div key={r.role} className="flex items-center justify-between">
                <span className="text-xs text-neutral-300 capitalize">{r.role}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1 bg-white/10 rounded-full w-16 overflow-hidden">
                    <div className="h-full bg-white/30 rounded-full"
                      style={{ width: `${stats?.totalUsers ? (r.count / stats.totalUsers) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs text-neutral-500 w-6 text-right">{r.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-4">Signups — 7 Days</p>
          {stats?.dailySignups && stats.dailySignups.length > 0
            ? <BarChart data={stats.dailySignups} />
            : <p className="text-xs text-neutral-700">No data yet</p>}
        </div>
      </div>

      {/* Admin accounts + Audit log */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Admin accounts */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-800">
            <p className="text-xs uppercase tracking-widest text-neutral-500">Admin Accounts</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-normal text-left">Admin</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-normal text-left whitespace-nowrap">Last Login</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-normal text-left">Logins</th>
                </tr>
              </thead>
              <tbody>
                {admins.map(a => (
                  <tr key={a.id} className="border-b border-neutral-800/50">
                    <td className="px-4 py-3">
                      <p className="text-white text-sm">{a.fullName}</p>
                      <p className="text-neutral-500 text-xs">{a.email}</p>
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-xs whitespace-nowrap">
                      {a.lastLoginAt ? timeAgo(a.lastLoginAt) : <span className="text-neutral-700">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-purple-400 font-medium">{a.totalLogins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit log */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-800">
            <p className="text-xs uppercase tracking-widest text-neutral-500">Audit Log</p>
          </div>
          <div className="divide-y divide-neutral-800/50 max-h-64 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="px-5 py-8 text-xs text-neutral-700 text-center">No actions yet</p>
            ) : auditLogs.map(log => (
              <div key={log.id} className="px-5 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs text-neutral-300">
                    <span className="text-white">{log.adminName}</span>
                    {' '}<span className="text-neutral-500">{actionLabel(log.action)}</span>
                    {log.targetName && <>{' '}<span className="text-neutral-300">{log.targetName}</span></>}
                  </p>
                  {log.details && log.details !== 'user deleted' && (
                    <p className="text-xs text-neutral-600 mt-0.5 truncate max-w-xs">{log.details}</p>
                  )}
                </div>
                <span className="text-xs text-neutral-700 shrink-0">{timeAgo(log.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <p className="text-xs uppercase tracking-widest text-neutral-500 mb-4">Quick Actions</p>
        <div className="flex flex-wrap gap-3">
          <a href="/admin/users" className="px-4 py-2 bg-white text-black text-sm rounded-lg hover:bg-neutral-200 transition-colors">All Users</a>
          <a href="/admin/users?role=model" className="px-4 py-2 bg-neutral-800 text-white text-sm rounded-lg hover:bg-neutral-700 transition-colors">Models</a>
          <a href="/admin/users?role=designer" className="px-4 py-2 bg-neutral-800 text-white text-sm rounded-lg hover:bg-neutral-700 transition-colors">Designers</a>
          <a href="/admin/users?verification=unverified" className="px-4 py-2 bg-neutral-800 text-yellow-400 text-sm rounded-lg hover:bg-neutral-700 transition-colors">Unverified</a>
        </div>
      </div>

    </div>
  )
}
