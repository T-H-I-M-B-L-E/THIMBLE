"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/useAuth"
import { useNotify } from "@/components/notify-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EditProfileModal } from "@/components/edit-profile-modal"
import { User, Lock, Bell, Shield, AlertTriangle } from "lucide-react"

type Section = "profile" | "account" | "notifications" | "privacy" | "danger"

const SECTIONS: { id: Section; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "account", label: "Account", icon: Lock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "danger", label: "Danger zone", icon: AlertTriangle },
]

export default function SettingsPage() {
  const router = useRouter()
  const { user, isLoading, logout, refresh } = useAuth()
  const notify = useNotify()

  const [active, setActive] = useState<Section>("profile")
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth")
  }, [user, isLoading, router])

  if (isLoading || !user) return null

  return (
    <DashboardLayout showRail={false}>
      <div className="t-settings-wrap">
        <h1 className="t-settings-title">Settings</h1>

        <div className="t-settings-row">
          {/* Section nav */}
          <nav className="t-settings-nav">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={active === id ? "t-settings-link on" : "t-settings-link"}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>

          {/* Active section content */}
          <div className="t-settings-content">
            {active === "profile" && (
              <ProfileSection user={user} onOpenEdit={() => setEditOpen(true)} />
            )}
            {active === "account" && <AccountSection user={user} />}
            {active === "notifications" && <NotificationsSection />}
            {active === "privacy" && <PrivacySection />}
            {active === "danger" && <DangerSection onLoggedOut={() => { logout(); router.push("/auth") }} />}
          </div>
        </div>
      </div>

      <EditProfileModal isOpen={editOpen} onClose={() => setEditOpen(false)} onSave={refresh} user={user} />
    </DashboardLayout>
  )
}

// ── Sections ───────────────────────────────────────────────────────────────

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="t-settings-card">
      <h2 className="t-settings-card-title">{title}</h2>
      {description && <p className="t-settings-card-desc">{description}</p>}
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t-ink-2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>
        {label}
      </div>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--t-surface-2)",
  border: "1px solid var(--t-line)",
  borderRadius: 9,
  fontSize: 14,
  color: "var(--t-ink)",
  fontFamily: "inherit",
  outline: "none",
}

const buttonPrimary: React.CSSProperties = {
  padding: "10px 18px",
  background: "var(--t-ink)",
  color: "#fff",
  border: "none",
  borderRadius: 9,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
}

const buttonDanger: React.CSSProperties = {
  padding: "10px 18px",
  background: "#d33",
  color: "#fff",
  border: "none",
  borderRadius: 9,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
}

function ProfileSection({ user, onOpenEdit }: { user: any; onOpenEdit: () => void }) {
  return (
    <Card title="Profile" description="How others see you on THIMBLE.">
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <img
          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || "User")}&background=0D8ABC&color=fff&size=120`}
          alt=""
          style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }}
        />
        <div>
          <p style={{ fontWeight: 600, color: "var(--t-ink)", margin: 0 }}>{user.fullName}</p>
          <p style={{ fontSize: 13, color: "var(--t-ink-3)", margin: "2px 0 0" }}>@{user.username || user.email?.split("@")[0]}</p>
        </div>
      </div>
      <button onClick={onOpenEdit} style={buttonPrimary}>Edit profile</button>
    </Card>
  )
}

function AccountSection({ user }: { user: any }) {
  const notify = useNotify()

  // Logout-all
  const [logoutAllBusy, setLogoutAllBusy] = useState(false)

  const logoutEverywhere = async () => {
    const ok = await notify.confirm({
      title: "Log out everywhere else?",
      message: "All your other devices will be signed out on their next action. You'll stay signed in here.",
      confirmLabel: "Log out other devices",
    })
    if (!ok) return
    setLogoutAllBusy(true)
    try {
      const res = await fetch("/api/auth/logout-all", { method: "POST", credentials: "include" })
      if (!res.ok) { notify.error("Could not sign out other devices."); return }
      notify.success("Other devices signed out.")
    } finally {
      setLogoutAllBusy(false)
    }
  }

  // Password form
  const [currentPw, setCurrentPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [pwSaving, setPwSaving] = useState(false)

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw.length < 8) { notify.error("New password must be at least 8 characters."); return }
    if (newPw !== confirmPw) { notify.error("Passwords don't match."); return }
    setPwSaving(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { notify.error(data.message || "Could not change password."); return }
      notify.success("Password updated.")
      setCurrentPw(""); setNewPw(""); setConfirmPw("")
    } finally {
      setPwSaving(false)
    }
  }

  // Email form
  const [emailPw, setEmailPw] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [emailSaving, setEmailSaving] = useState(false)

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.includes("@")) { notify.error("Enter a valid email."); return }
    setEmailSaving(true)
    try {
      const res = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: emailPw, newEmail }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { notify.error(data.message || "Could not change email."); return }
      notify.success("Email updated. Refresh to see changes.")
      setEmailPw(""); setNewEmail("")
    } finally {
      setEmailSaving(false)
    }
  }

  return (
    <>
      <Card title="Email" description={`Current address: ${user.email}`}>
        <form onSubmit={submitEmail}>
          <Field label="New email">
            <input type="email" style={inputStyle} value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
          </Field>
          <Field label="Current password">
            <input type="password" style={inputStyle} value={emailPw} onChange={e => setEmailPw(e.target.value)} required />
          </Field>
          <button type="submit" style={buttonPrimary} disabled={emailSaving}>
            {emailSaving ? "Saving…" : "Change email"}
          </button>
        </form>
      </Card>

      <Card title="Password" description="Use 8+ characters. Avoid passwords reused on other sites.">
        <form onSubmit={submitPassword}>
          <Field label="Current password">
            <input type="password" style={inputStyle} value={currentPw} onChange={e => setCurrentPw(e.target.value)} required />
          </Field>
          <Field label="New password">
            <input type="password" style={inputStyle} value={newPw} onChange={e => setNewPw(e.target.value)} required />
          </Field>
          <Field label="Confirm new password">
            <input type="password" style={inputStyle} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
          </Field>
          <button type="submit" style={buttonPrimary} disabled={pwSaving}>
            {pwSaving ? "Saving…" : "Change password"}
          </button>
        </form>
      </Card>

      <Card title="Sessions" description="If you've signed in on a device you no longer use, sign it out from here.">
        <button type="button" onClick={logoutEverywhere} style={buttonPrimary} disabled={logoutAllBusy}>
          {logoutAllBusy ? "Signing out…" : "Log out of all other devices"}
        </button>
      </Card>
    </>
  )
}

type EmailPrefs = {
  likes: boolean
  comments: boolean
  follows: boolean
  product_updates: boolean
}

const DEFAULT_PREFS: EmailPrefs = { likes: true, comments: true, follows: true, product_updates: true }

function NotificationsSection() {
  const notify = useNotify()
  const [prefs, setPrefs] = useState<EmailPrefs>(DEFAULT_PREFS)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/settings/email-prefs", { credentials: "include" })
      .then(r => r.ok ? r.json() : DEFAULT_PREFS)
      .then(data => setPrefs({ ...DEFAULT_PREFS, ...data }))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const toggle = async (key: keyof EmailPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSaving(true)
    try {
      const res = await fetch("/api/settings/email-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(next),
      })
      if (!res.ok) {
        setPrefs(prefs)
        notify.error("Could not save preference.")
      }
    } finally {
      setSaving(false)
    }
  }

  const ROWS: { key: keyof EmailPrefs; label: string; desc: string }[] = [
    { key: "likes", label: "Likes", desc: "When someone likes your post" },
    { key: "comments", label: "Replies", desc: "When someone replies to your post" },
    { key: "follows", label: "New followers", desc: "When someone follows you" },
    { key: "product_updates", label: "Product updates", desc: "Occasional emails about new features" },
  ]

  return (
    <Card title="Email notifications" description="Choose which emails you want to receive.">
      {!loaded ? (
        <p style={{ fontSize: 13, color: "var(--t-ink-3)" }}>Loading…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {ROWS.map(row => (
            <label key={row.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--t-ink)" }}>{row.label}</div>
                <div style={{ fontSize: 12, color: "var(--t-ink-3)", marginTop: 2 }}>{row.desc}</div>
              </div>
              <input
                type="checkbox"
                checked={prefs[row.key]}
                onChange={() => toggle(row.key)}
                disabled={saving}
                style={{ width: 18, height: 18, accentColor: "var(--t-gold-ink)" }}
              />
            </label>
          ))}
        </div>
      )}
    </Card>
  )
}

type BlockedUser = { id: string; fullName: string; username: string; avatarUrl: string }

function PrivacySection() {
  const notify = useNotify()
  const [blocked, setBlocked] = useState<BlockedUser[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/blocks", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: BlockedUser[]) => setBlocked(Array.isArray(data) ? data : []))
      .catch(() => setBlocked([]))
  }, [])

  const unblock = async (u: BlockedUser) => {
    const ok = await notify.confirm({
      title: `Unblock ${u.fullName || u.username}?`,
      message: "They'll be able to see your profile and posts again.",
      confirmLabel: "Unblock",
    })
    if (!ok) return
    setBusyId(u.id)
    try {
      const res = await fetch(`/api/blocks/${u.id}`, { method: "DELETE", credentials: "include" })
      if (!res.ok && res.status !== 204) {
        notify.error("Could not unblock. Try again.")
        return
      }
      setBlocked(prev => (prev ?? []).filter(b => b.id !== u.id))
      notify.success("Unblocked.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card title="Blocked accounts" description="People you've blocked can't see your profile or posts, and you won't see theirs.">
      {blocked === null ? (
        <p style={{ fontSize: 13, color: "var(--t-ink-3)" }}>Loading…</p>
      ) : blocked.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--t-ink-3)" }}>You haven't blocked anyone.</p>
      ) : (
        <ul className="t-blocked-list">
          {blocked.map(u => (
            <li key={u.id} className="t-blocked-row">
              <img
                src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullName || u.username || "User")}&background=0D8ABC&color=fff&size=80`}
                alt=""
                className="t-blocked-avatar"
              />
              <div className="t-blocked-meta">
                <div className="t-blocked-name">{u.fullName || u.username}</div>
                {u.username && <div className="t-blocked-handle">@{u.username}</div>}
              </div>
              <button
                type="button"
                onClick={() => unblock(u)}
                disabled={busyId === u.id}
                className="t-blocked-unblock"
              >
                {busyId === u.id ? "…" : "Unblock"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function DangerSection({ onLoggedOut }: { onLoggedOut: () => void }) {
  const notify = useNotify()
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const deleteAccount = async () => {
    if (!password) { notify.error("Enter your password to confirm."); return }
    const ok = await notify.confirm({
      title: "Delete your account?",
      message: "All your posts, replies, follows, and messages will be permanently removed. This cannot be undone.",
      confirmLabel: "Delete forever",
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { notify.error(data.message || "Could not delete account."); return }
      notify.success("Account deleted.")
      onLoggedOut()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Delete account" description="Permanently delete your account and everything in it. This cannot be undone.">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Confirm with your password">
          <input type="password" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} />
        </Field>
        <button type="button" onClick={deleteAccount} style={buttonDanger} disabled={busy}>
          {busy ? "Deleting…" : "Delete account"}
        </button>
      </div>
    </Card>
  )
}
