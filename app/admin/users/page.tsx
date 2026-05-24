'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useNotify } from '@/components/notify-provider'

interface AdminUser {
  id: string
  email: string
  fullName: string
  role: string
  verificationStatus: string
  isVerified: boolean
  isAdmin: boolean
  isBanned: boolean
  bannedUntil: string | null
  banMessage: string
  createdAt: string
  lastLoginAt: string | null
  totalLogins: number
  followers: number
  following: number
  posts: number
}

const ROLES = ['model', 'designer', 'manufacturer', 'photographer', 'brand']

const DURATION_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '6 hours', hours: 6 },
  { label: '12 hours', hours: 12 },
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
  { label: 'Permanent', hours: 0 },
]

interface BanModal {
  userId: string
  userName: string
  currentlyBanned: boolean
  bannedUntil: string | null
}

function BanModalUI({ modal, onClose, onSave }: {
  modal: BanModal
  onClose: () => void
  onSave: (userId: string, durationHours: number, message: string) => Promise<void>
}) {
  const [durationHours, setDurationHours] = useState(24)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(modal.userId, durationHours, message)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-red-400 mb-1">Ban User</p>
              <p className="text-white font-medium">{modal.userName}</p>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors text-xl leading-none">×</button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Duration */}
          <div>
            <label className="text-xs uppercase tracking-widest text-neutral-300 block mb-3 font-medium">Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_OPTIONS.map(opt => (
                <button
                  key={opt.hours}
                  onClick={() => setDurationHours(opt.hours)}
                  className={`py-2 px-1 rounded-lg text-xs transition-colors text-center ${
                    durationHours === opt.hours
                      ? 'bg-red-500/30 border border-red-400/50 text-red-200'
                      : 'bg-white/10 border border-white/20 text-neutral-300 hover:bg-white/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom message */}
          <div>
            <label className="text-xs uppercase tracking-widest text-neutral-300 block mb-2 font-medium">
              Message to user
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Tell them why they've been banned…"
              rows={4}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/40 transition-colors resize-none"
            />
            <p className="text-xs text-neutral-400 mt-1">This message will be shown on the ban screen.</p>
          </div>

          {durationHours === 0 && (
            <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-3">
              <span className="text-red-300 text-xs">⚠</span>
              <p className="text-xs text-red-300">Permanent ban — account will be locked indefinitely.</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm text-neutral-300 border border-white/20 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Banning…' : 'Ban User'}
          </button>
        </div>
      </div>
    </div>
  )
}

function UsersTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const notify = useNotify()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [banModal, setBanModal] = useState<BanModal | null>(null)

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
    const ok = await notify.confirm({
      title: `Delete ${name}?`,
      message: "This permanently removes the user. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    })
    if (!ok) return
    setActionLoading(id)
    try {
      await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' })
      setUsers(u => u.filter(x => x.id !== id))
    } finally {
      setActionLoading(null)
    }
  }

  const banUser = async (userId: string, durationHours: number, message: string) => {
    await fetch(`/api/admin/users/${userId}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ durationHours, message }),
    })
    fetchUsers()
  }

  const unbanUser = async (id: string) => {
    setActionLoading(id)
    try {
      await fetch(`/api/admin/users/${id}/ban`, { method: 'DELETE', credentials: 'include' })
      fetchUsers()
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-6 sm:p-8 pb-32">
      {banModal && (
        <BanModalUI
          modal={banModal}
          onClose={() => setBanModal(null)}
          onSave={banUser}
        />
      )}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Users</h1>
          <p className="text-neutral-400 text-sm mt-2">{users.length} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 max-w-sm bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/40 transition-colors backdrop-blur-xl"
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-white/40 transition-colors backdrop-blur-xl"
        >
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white/8 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
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
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-400 font-normal">User</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-400 font-normal">Role</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-400 font-normal">Badge</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-400 font-normal whitespace-nowrap">Last Login</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-400 font-normal whitespace-nowrap">Logins</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-400 font-normal whitespace-nowrap">Joined</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-widest text-neutral-400 font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={`border-b border-white/5 transition-colors ${u.isBanned ? 'bg-red-500/10 hover:bg-red-500/20' : 'hover:bg-white/5'}`}>
                    <td className="px-4 py-3 min-w-40">
                      <p className="font-medium text-white">{u.fullName}</p>
                      <p className="text-neutral-400 text-xs mt-0.5">{u.email}</p>
                      <div className="flex gap-1.5 mt-0.5 flex-wrap">
                        {u.isAdmin && <span className="text-xs text-purple-300">admin</span>}
                        {u.isBanned && (
                          <span className="text-xs text-red-300 font-medium">
                            banned{u.bannedUntil ? ` · until ${new Date(u.bannedUntil).toLocaleDateString()}` : ' · permanent'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={actionLoading === u.id}
                        onChange={e => updateUser(u.id, { role: e.target.value })}
                        className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {u.isVerified ? (
                        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full text-yellow-300 bg-yellow-500/10 border border-yellow-500/20">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 1.2l2.35 2.05 3.05-.55 1.05 2.95 2.85 1.4-.55 3.05L23 12l-2.25 1.9.55 3.05-2.85 1.4-1.05 2.95-3.05-.55L12 22.8l-2.35-2.05-3.05.55-1.05-2.95-2.85-1.4.55-3.05L1 12l2.25-1.9-.55-3.05 2.85-1.4 1.05-2.95 3.05.55L12 1.2z" />
                          </svg>
                          verified
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-xs whitespace-nowrap">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : <span className="text-neutral-500">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-purple-300 text-sm font-medium">
                      {u.totalLogins}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-xs whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={async () => {
                            if (u.isVerified) {
                              const ok = await notify.confirm({
                                title: `Revoke ${u.fullName}'s verification badge?`,
                                confirmLabel: "Revoke",
                                destructive: true,
                              })
                              if (!ok) return
                            }
                            updateUser(u.id, { isVerified: !u.isVerified })
                          }}
                          disabled={actionLoading === u.id}
                          className={`text-xs px-2 py-1 rounded bg-white/10 transition-colors whitespace-nowrap ${
                            u.isVerified
                              ? 'hover:bg-red-500/30 text-neutral-300 hover:text-red-200'
                              : 'hover:bg-yellow-500/30 text-neutral-300 hover:text-yellow-200'
                          }`}
                        >
                          {u.isVerified ? 'Revoke Badge' : 'Grant Badge'}
                        </button>
                        <button
                          onClick={() => updateUser(u.id, { isAdmin: !u.isAdmin })}
                          disabled={actionLoading === u.id}
                          className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-purple-500/30 text-neutral-300 hover:text-purple-200 transition-colors whitespace-nowrap"
                        >
                          {u.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                        </button>
                        {u.isBanned ? (
                          <button
                            onClick={() => unbanUser(u.id)}
                            disabled={actionLoading === u.id}
                            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-emerald-500/30 text-neutral-300 hover:text-emerald-300 transition-colors whitespace-nowrap"
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => setBanModal({ userId: u.id, userName: u.fullName, currentlyBanned: false, bannedUntil: null })}
                            disabled={actionLoading === u.id}
                            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-red-500/30 text-neutral-300 hover:text-red-300 transition-colors"
                          >
                            Ban
                          </button>
                        )}
                        <button
                          onClick={() => deleteUser(u.id, u.fullName)}
                          disabled={actionLoading === u.id}
                          className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-red-500/30 text-neutral-300 hover:text-red-300 transition-colors"
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
