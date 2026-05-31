'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useNotify } from '@/components/notify-provider'
import { adminFetch } from '@/lib/adminFetch'
import { Page, Card, Button, Pill, Table, Tr, Td, C } from '../_ui'

interface AdminUser {
  id: string
  email: string
  fullName: string
  role: string
  isVerified: boolean
  isAdmin: boolean
  isBanned: boolean
  bannedUntil: string | null
  createdAt: string
  lastLoginAt: string | null
  totalLogins: number
}

const ROLES = ['model', 'designer', 'manufacturer', 'photographer', 'brand']

const DURATION_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
  { label: 'Permanent', hours: 0 },
]

interface BanModal { userId: string; userName: string }

function BanModalUI({ modal, onClose, onSave }: {
  modal: BanModal
  onClose: () => void
  onSave: (userId: string, durationHours: number, message: string) => Promise<void>
}) {
  const [durationHours, setDurationHours] = useState(24)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 420, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.red, margin: 0 }}>Ban user</p>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '4px 0 0' }}>{modal.userName}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.faint, marginBottom: 8 }}>Duration</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DURATION_OPTIONS.map(opt => (
                <button
                  key={opt.hours}
                  onClick={() => setDurationHours(opt.hours)}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                    background: durationHours === opt.hours ? 'rgba(240,97,109,0.15)' : C.surfaceHover,
                    border: `1px solid ${durationHours === opt.hours ? 'rgba(240,97,109,0.4)' : C.line}`,
                    color: durationHours === opt.hours ? C.red : C.dim,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.faint, marginBottom: 8 }}>Message to user</p>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Why they've been banned…"
              rows={3}
              style={{ width: '100%', background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: C.text, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
        </div>
        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><Button onClick={onClose}>Cancel</Button></div>
          <Button
            tone="danger"
            disabled={saving}
            onClick={async () => { setSaving(true); await onSave(modal.userId, durationHours, message); setSaving(false); onClose() }}
          >
            {saving ? 'Banning…' : 'Ban user'}
          </Button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8,
  padding: '8px 12px', fontSize: 13, color: C.text, outline: 'none',
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
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (search) qs.set('search', search)
    if (roleFilter) qs.set('role', roleFilter)
    try {
      const r = await adminFetch(`/api/admin/users?${qs}`)
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
      await adminFetch(`/api/admin/users/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      fetchUsers()
    } finally { setActionLoading(null); setOpenMenu(null) }
  }

  const deleteUser = async (id: string, name: string) => {
    setOpenMenu(null)
    const ok = await notify.confirm({ title: `Delete ${name}?`, message: 'This permanently removes the user. This cannot be undone.', confirmLabel: 'Delete', destructive: true })
    if (!ok) return
    setActionLoading(id)
    try {
      await adminFetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      setUsers(u => u.filter(x => x.id !== id))
    } finally { setActionLoading(null) }
  }

  const banUser = async (userId: string, durationHours: number, message: string) => {
    await adminFetch(`/api/admin/users/${userId}/ban`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ durationHours, message }),
    })
    fetchUsers()
  }

  const unbanUser = async (id: string) => {
    setOpenMenu(null); setActionLoading(id)
    try { await adminFetch(`/api/admin/users/${id}/ban`, { method: 'DELETE' }); fetchUsers() }
    finally { setActionLoading(null) }
  }

  const fmtDate = (s: string | null) => s
    ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Never'

  return (
    <Page title="Users" subtitle={`${users.length} total`}>
      {banModal && <BanModalUI modal={banModal} onClose={() => setBanModal(null)} onSave={banUser} />}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          placeholder="Search name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, maxWidth: 320 }}
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
        </select>
      </div>

      <Card pad={false}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 20, height: 20, border: `2px solid ${C.line}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : users.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 48, color: C.faint, fontSize: 13 }}>No users found</p>
        ) : (
          <Table headers={['User', 'Role', 'Last login', '']}>
            {users.map(u => (
              <Tr key={u.id}>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: u.isBanned ? C.red : C.text }}>{u.fullName}</span>
                    {u.isVerified && <Pill tone="warn">verified</Pill>}
                    {u.isAdmin && <Pill>admin</Pill>}
                    {u.isBanned && <Pill tone="bad">banned</Pill>}
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{u.email}</div>
                </Td>
                <Td>
                  <select
                    value={u.role}
                    disabled={actionLoading === u.id}
                    onChange={e => updateUser(u.id, { role: e.target.value })}
                    style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, color: C.dim, cursor: 'pointer' }}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Td>
                <Td color={C.dim} nowrap>{fmtDate(u.lastLoginAt)}</Td>
                <Td align="right">
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                      style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 18, cursor: 'pointer', padding: '0 6px', lineHeight: 1 }}
                    >⋯</button>
                    {openMenu === u.id && (
                      <>
                        <div onClick={() => setOpenMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 20, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: 4, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                          <MenuItem onClick={() => updateUser(u.id, { isVerified: !u.isVerified })}>{u.isVerified ? 'Revoke badge' : 'Grant badge'}</MenuItem>
                          <MenuItem onClick={() => updateUser(u.id, { isAdmin: !u.isAdmin })}>{u.isAdmin ? 'Revoke admin' : 'Make admin'}</MenuItem>
                          {u.isBanned
                            ? <MenuItem onClick={() => unbanUser(u.id)}>Unban</MenuItem>
                            : <MenuItem danger onClick={() => { setOpenMenu(null); setBanModal({ userId: u.id, userName: u.fullName }) }}>Ban</MenuItem>}
                          <MenuItem danger onClick={() => deleteUser(u.id, u.fullName)}>Delete</MenuItem>
                        </div>
                      </>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </Page>
  )
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: 6, fontSize: 13, color: danger ? C.red : C.text, cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHover)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}

export default function AdminUsersPage() {
  return <Suspense><UsersTable /></Suspense>
}
