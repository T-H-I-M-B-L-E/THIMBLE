'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface AdminUser {
  id: string
  email: string
  fullName: string
  role: string
  verificationStatus: string
  isAdmin: boolean
  createdAt: string
  followers: number
  following: number
  posts: number
}

const ROLES = ['model', 'designer', 'manufacturer', 'photographer', 'brand']
const VERIFICATION = ['unverified', 'pending', 'verified']

const statusColor: Record<string, string> = {
  verified: 'text-emerald-400 bg-emerald-400/10',
  pending: 'text-yellow-400 bg-yellow-400/10',
  unverified: 'text-neutral-400 bg-neutral-800',
}

function UsersTable() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (search) qs.set('search', search)
    if (roleFilter) qs.set('role', roleFilter)
    try {
      const r = await fetch(`/api/admin/users?${qs}`, { credentials: 'include' })
      if (r.status === 403) { router.push('/admin/login'); return }
      const data = await r.json()
      setUsers(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, router])

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300)
    return () => clearTimeout(t)
  }, [fetchUsers])

  const updateUser = async (id: string, body: object) => {
    setActionLoading(id)
    try {
      await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      fetchUsers()
    } finally {
      setActionLoading(null)
    }
  }

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return
    setActionLoading(id)
    try {
      await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' })
      setUsers(u => u.filter(x => x.id !== id))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-widest uppercase">Users</h1>
          <p className="text-neutral-500 text-sm mt-1">{users.length} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 max-w-sm bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white transition-colors"
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors"
        >
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-neutral-500">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left">
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-normal">User</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-normal">Role</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-normal">Status</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-normal">Joined</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{u.fullName}</p>
                      <p className="text-neutral-500 text-xs mt-0.5">{u.email}</p>
                      {u.isAdmin && <span className="text-xs text-purple-400">admin</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={actionLoading === u.id}
                        onChange={e => updateUser(u.id, { role: e.target.value })}
                        className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.verificationStatus}
                        disabled={actionLoading === u.id}
                        onChange={e => updateUser(u.id, { verificationStatus: e.target.value })}
                        className={`rounded px-2 py-1 text-xs border-0 focus:outline-none cursor-pointer ${statusColor[u.verificationStatus] || 'text-neutral-400 bg-neutral-800'}`}
                      >
                        {VERIFICATION.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">
                      {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateUser(u.id, { isAdmin: !u.isAdmin })}
                          disabled={actionLoading === u.id}
                          className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-purple-900 text-neutral-300 hover:text-purple-300 transition-colors"
                        >
                          {u.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                        </button>
                        <button
                          onClick={() => deleteUser(u.id, u.fullName)}
                          disabled={actionLoading === u.id}
                          className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-red-900 text-neutral-300 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <Suspense>
      <UsersTable />
    </Suspense>
  )
}
