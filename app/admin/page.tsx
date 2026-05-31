'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/adminFetch'
import { Page, Stat, StatGrid, Card, Details, Table, Tr, Td, C } from './_ui'

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
  lastLoginAt: string | null; totalLogins: number; isAdmin: boolean
}
interface AuditLog {
  id: number; adminName: string; action: string
  targetName: string; details: string; createdAt: string
}

function actionLabel(action: string) { return action.replace(/_/g, ' ') }

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
    setAdminName((sessionStorage.getItem('admin_name') || '').split(' ')[0])
  }, [])

  useEffect(() => {
    Promise.all([
      adminFetch('/api/admin/stats'),
      adminFetch('/api/admin/users?admin=true'),
      adminFetch('/api/admin/audit-log'),
    ]).then(async ([sRes, aRes, lRes]) => {
      if (sRes.status === 403) { router.push('/admin/login'); return }
      setStats(await sRes.json())
      if (aRes.ok) {
        const d = await aRes.json()
        setAdmins(Array.isArray(d) ? d.filter((u: AdminUser) => u.isAdmin) : [])
      }
      if (lRes.ok) setAuditLogs(await lRes.json())
    }).finally(() => setLoading(false))
  }, [router])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div style={{ width: 24, height: 24, border: `2px solid ${C.line}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const pending = stats?.pendingVerifications ?? 0

  return (
    <Page title={adminName ? `Hey, ${adminName}` : 'Dashboard'} subtitle="Platform at a glance">

      {/* Essentials only */}
      <StatGrid>
        <Stat label="Users" value={stats?.totalUsers ?? 0} />
        <Stat label="Today" value={stats?.todaySignups ?? 0} tone="good" />
        <Stat label="This week" value={stats?.weekSignups ?? 0} />
        <Stat label="Posts" value={stats?.totalPosts ?? 0} />
        <Stat label="Gigs" value={stats?.totalGigs ?? 0} />
        <Stat label="Pending verify" value={pending} tone={pending > 0 ? 'warn' : 'default'} />
      </StatGrid>

      {/* Actionable: pending verifications */}
      {pending > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 14 }}>
              <strong style={{ color: C.amber }}>{pending}</strong> verification {pending === 1 ? 'request' : 'requests'} waiting for review
            </span>
            <a href="/admin/verification" style={{ fontSize: 13, fontWeight: 600, color: C.accent, textDecoration: 'none', whiteSpace: 'nowrap' }}>Review →</a>
          </div>
        </Card>
      )}

      {/* Recent activity — the one thing you check daily */}
      <Card title="Recent Activity">
        {auditLogs.length === 0 ? (
          <p style={{ fontSize: 13, color: C.faint, margin: 0 }}>No actions yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {auditLogs.slice(0, 8).map(log => (
              <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                <span style={{ color: C.dim, minWidth: 0 }}>
                  <span style={{ color: C.text }}>{log.adminName}</span>{' '}
                  {actionLabel(log.action)}
                  {log.targetName && <span style={{ color: C.text }}> {log.targetName}</span>}
                </span>
                <span style={{ color: C.faint, whiteSpace: 'nowrap' }}>{timeAgo(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Everything secondary lives behind a toggle */}
      <Details label="More stats & breakdowns">
        <StatGrid>
          <Stat label="Total logins" value={stats?.totalLogins ?? 0} />
          <Stat label="Returned" value={stats?.returnedUsers ?? 0} />
          <Stat label="Never logged in" value={stats?.neverLoggedIn ?? 0} tone={stats?.neverLoggedIn ? 'warn' : 'default'} />
          <Stat label="Verified" value={stats?.verifiedUsers ?? 0} />
          <Stat label="Posts this week" value={stats?.postsThisWeek ?? 0} />
        </StatGrid>

        {(stats?.roleBreakdown?.length ?? 0) > 0 && (
          <Card title="Role Breakdown">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats!.roleBreakdown.map(r => {
                const pct = stats!.totalUsers ? (r.count / stats!.totalUsers) * 100 : 0
                return (
                  <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, textTransform: 'capitalize', width: 100, color: C.dim }}>{r.role}</span>
                    <div style={{ flex: 1, height: 6, background: C.line, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: C.accent, opacity: 0.6 }} />
                    </div>
                    <span style={{ fontSize: 13, color: C.dim, width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.count}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {admins.length > 0 && (
          <Card title="Admin Accounts" pad={false}>
            <Table headers={['Admin', 'Last login', 'Logins']}>
              {admins.map(a => (
                <Tr key={a.id}>
                  <Td>
                    <div>{a.fullName}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{a.email}</div>
                  </Td>
                  <Td color={C.dim} nowrap>{a.lastLoginAt ? timeAgo(a.lastLoginAt) : 'Never'}</Td>
                  <Td color={C.dim}>{a.totalLogins}</Td>
                </Tr>
              ))}
            </Table>
          </Card>
        )}
      </Details>

    </Page>
  )
}
