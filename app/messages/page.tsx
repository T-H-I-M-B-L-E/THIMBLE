"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { HowTo } from "@/components/how-to"
import { Search, Send, ArrowLeft, User, UserPlus, X, ShieldAlert, Lock, Paperclip, ImageIcon, Trash2, Check, CheckCheck, MoreVertical, UserX, Video, Phone } from "lucide-react"
import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { uploadFile } from "@/lib/upload"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { useNotify } from "@/components/notify-provider"
import { useSocket } from "@/hooks/use-socket"
import { useConversations, useMessages } from "@/hooks/use-conversations"
import { useFollowing } from "@/hooks/use-social"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { CallModal, IncomingCallBanner, type CallSession } from "@/components/call-modal"

function Avatar({ src, name, size = 40 }: { src?: string; name?: string; size?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden shrink-0 flex items-center justify-center"
      style={{
        width: size, height: size,
        background: src ? undefined : "var(--t-gold-soft)",
        color: "var(--t-gold-ink)",
        fontSize: size * 0.38,
        fontWeight: 600,
      }}
    >
      {src
        ? <Image src={src} alt={name || ""} width={size} height={size} className="object-cover w-full h-full" />
        : <span>{name?.[0]?.toUpperCase() ?? <User size={size * 0.45} />}</span>
      }
    </div>
  )
}

function SkeletonRow({ widthPct = 65 }: { widthPct?: number }) {
  return (
    <div className="t-thread-skeleton animate-pulse">
      <div className="t-thread-skeleton-av" />
      <div className="t-thread-skeleton-meta">
        <div className="t-thread-skeleton-line" style={{ width: `${widthPct}%` }} />
        <div className="t-thread-skeleton-line" style={{ width: `${Math.max(40, widthPct + 10)}%`, opacity: 0.7 }} />
      </div>
    </div>
  )
}

function formatTime(ts: string | number) {
  const date = new Date(typeof ts === "string" ? ts : ts)
  const diff = Date.now() - date.getTime()
  if (diff < 60000) return "now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

function formatFullTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

interface DirectoryUser {
  id: string
  fullName: string
  username?: string
  avatarUrl: string
  role?: string
}

function NewMessageModal({
  currentUser,
  isVerified,
  existingConversations,
  onClose,
  onCreate,
  createConversation,
}: {
  currentUser: { id: string; fullName: string; avatar?: string } | null
  isVerified: boolean
  /** Caller's existing conversations, used to skip duplicate creation and
      route the user straight back to a chat they already had open. */
  existingConversations: { id: number; participants: { userId: string }[] }[]
  onClose: () => void
  onCreate: (conv: { id: number }) => void
  createConversation: (participants: { userId: string; userName: string; userAvatar: string }[]) => Promise<{ id: number }>
}) {
  const { following } = useFollowing(currentUser?.id)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState<string | null>(null)
  const [directory, setDirectory] = useState<DirectoryUser[]>([])
  const [loadingDir, setLoadingDir] = useState(true)

  // Pull the full user directory so search isn't limited to people you
  // already follow. Cheap — backend caps at 200.
  useEffect(() => {
    let cancelled = false
    fetch("/api/users", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled && Array.isArray(data)) setDirectory(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingDir(false) })
    return () => { cancelled = true }
  }, [])

  const followingIds = useMemo(() => new Set(following.map(f => f.userId)), [following])

  // Set of userIds we already have a 1:1 chat with. Used to surface a
  // "Chat exists" hint in the row so the user knows clicking will route
  // back to that conversation rather than start a fresh thread.
  const existingChatPartnerIds = useMemo(() => {
    if (!currentUser?.id) return new Set<string>()
    const ids = new Set<string>()
    for (const conv of existingConversations) {
      for (const p of conv.participants) {
        if (p.userId !== currentUser.id) ids.add(p.userId)
      }
    }
    return ids
  }, [existingConversations, currentUser?.id])

  // Surface results from the full directory. With a search query → show
  // everyone matching. Empty query → just show the people you follow as
  // a quick-pick list.
  const results = useMemo(() => {
    const q = search.trim().toLowerCase()
    const all = directory.filter(u => u.id !== currentUser?.id)
    if (!q) {
      // Empty state: prioritise people you already follow.
      return all
        .filter(u => followingIds.has(u.id))
        .slice(0, 20)
    }
    return all
      .filter(u =>
        u.fullName?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q),
      )
      .slice(0, 25)
  }, [search, directory, followingIds, currentUser?.id])

  const handleSelect = async (u: DirectoryUser) => {
    if (!isVerified || creating) return
    // If a 1:1 conversation with this user already exists, just open it
    // — never create a duplicate row.
    const existing = existingConversations.find(c =>
      c.participants.some(p => p.userId === u.id) &&
      c.participants.some(p => p.userId === currentUser?.id),
    )
    if (existing) {
      onCreate({ id: existing.id })
      onClose()
      return
    }
    setCreating(u.id)
    try {
      const conv = await createConversation([{ userId: u.id, userName: u.fullName, userAvatar: u.avatarUrl || "" }])
      onCreate(conv)
      onClose()
    } catch {
      onClose()
    } finally {
      setCreating(null)
    }
  }

  return (
    <div className="t-new-msg-modal-backdrop" onClick={onClose}>
      <div className="t-new-msg-modal" onClick={e => e.stopPropagation()}>
        <div className="t-new-msg-modal-head">
          <span className="t-new-msg-modal-title">New message</span>
          <button className="t-icon-btn-sm" onClick={onClose} style={{ border: "none", background: "none" }}>
            <X size={16} />
          </button>
        </div>

        {!isVerified ? (
          <div className="t-msg-empty" style={{ padding: "32px 24px" }}>
            <div className="t-msg-empty-icon">
              <ShieldAlert size={24} style={{ color: "var(--t-gold)" }} />
            </div>
            <strong>Verification required</strong>
            <p>You need to be verified to send messages.</p>
          </div>
        ) : (
          <>
            <div className="t-new-msg-modal-search">
              <div className="t-msg-search">
                <Search size={14} />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search anyone on Tvimble…"
                />
              </div>
              <p className="t-new-msg-hint">
                {search.trim() ? "Showing all matching users" : "Suggested · people you follow"}
              </p>
            </div>

            <div className="t-new-msg-modal-list">
              {loadingDir ? (
                [1, 2, 3].map(i => <SkeletonRow key={i} />)
              ) : results.length === 0 ? (
                <div className="t-msg-empty">
                  <div className="t-msg-empty-icon">
                    <UserPlus size={22} />
                  </div>
                  <p>
                    {search.trim()
                      ? "No one matches your search."
                      : "Search by name, @username, or role to find anyone."}
                  </p>
                </div>
              ) : (
                results.map(u => (
                  <button
                    key={u.id}
                    className="t-new-msg-user"
                    onClick={() => handleSelect(u)}
                    disabled={creating === u.id}
                  >
                    <Avatar src={u.avatarUrl} name={u.fullName} size={38} />
                    <div style={{ minWidth: 0 }}>
                      <p className="t-new-msg-user-name">{u.fullName}</p>
                      <p className="t-new-msg-user-role">
                        {u.username ? `@${u.username}` : null}
                        {u.username && u.role ? " · " : ""}
                        {u.role}
                      </p>
                    </div>
                    {existingChatPartnerIds.has(u.id) ? (
                      <span className="t-new-msg-tag t-new-msg-tag--existing" title="You already have a chat with this person">
                        Chat exists
                      </span>
                    ) : !followingIds.has(u.id) ? (
                      <span className="t-new-msg-tag" title="You don't follow this person">
                        Not following
                      </span>
                    ) : null}
                    {creating === u.id && (
                      <div className="animate-spin" style={{ marginLeft: "auto", width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--t-line)", borderTopColor: "var(--t-gold)" }} />
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function MessagesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const notify = useNotify()
  const { user } = useStore()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [input, setInput] = useState("")
  const [search, setSearch] = useState("")
  const [showNewMsg, setShowNewMsg] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null)

  // ── Calling state ─────────────────────────────────────────────────────────
  const [activeCall, setActiveCall] = useState<CallSession | null>(null)
  const [incomingCall, setIncomingCall] = useState<{
    callerID: string; callerName: string; room: string; kind: "video" | "audio"
  } | null>(null)

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "https://thimble-production.up.railway.app"
  const websocketUrl = apiBase.replace(/^http/, "ws") + "/ws"
  const isVerified = !!user // any logged-in user can message

  const { conversations, setConversations, isLoading: loadingConvs, createConversation, refresh } = useConversations(user?.id)
  const selectedConv = conversations.find(c => c.id === selectedId)
  const { messages: apiMessages, isLoading: loadingMsgs, setMessages: setApiMessages } = useMessages(selectedId, user?.id)

  // Auto-open a conversation when ?conv=<id> is in the URL (e.g. from profile Message button or gig applicant redirect)
  useEffect(() => {
    if (loadingConvs) return
    const convParam = searchParams.get("conv")
    if (!convParam) return
    const id = parseInt(convParam, 10)
    if (!isNaN(id)) setSelectedId(id)
    // Remove the param from the URL without a full navigation so the back button works cleanly
    const url = new URL(window.location.href)
    url.searchParams.delete("conv")
    window.history.replaceState(null, "", url.toString())
  }, [loadingConvs, searchParams])

  // Apply receipt updates to historical (REST-loaded) messages too, not
  // just to the live wsMessages buffer.
  const handleReceipt = (ev: { type: "delivered" | "read"; messageIds: number[]; timestamp: number }) => {
    const ids = new Set(ev.messageIds)
    setApiMessages(prev => prev.map(m => {
      if (!ids.has(m.id)) return m
      if (ev.type === "delivered") return { ...m, deliveredAt: m.deliveredAt ?? ev.timestamp }
      return {
        ...m,
        readAt: m.readAt ?? ev.timestamp,
        deliveredAt: m.deliveredAt ?? ev.timestamp,
      }
    }))
  }

  const handleCallInvite = useCallback((ev: { callerID: string; callerName: string; room: string; kind: "video" | "audio" }) => {
    if (!activeCall) setIncomingCall(ev)
  }, [activeCall])

  const handleCallEnd = useCallback(() => {
    setActiveCall(null)
    setIncomingCall(null)
  }, [])

  const startCall = useCallback(async (kind: "video" | "audio") => {
    if (!selectedId) return
    try {
      const res = await fetch(`/api/conversations/${selectedId}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      })
      if (!res.ok) { notify.error("Calling not available right now"); return }
      const session = await res.json() as { room: string; token: string; lkUrl: string; kind: "video" | "audio" }
      const otherParticipant = selectedConv?.participants.find(p => p.userId !== user?.id)
      setActiveCall({ ...session, otherName: otherParticipant?.userName, otherAvatar: otherParticipant?.userAvatar })
    } catch {
      notify.error("Failed to start call")
    }
  }, [selectedId, apiBase, notify])

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !selectedId) return
    try {
      const res = await fetch(`/api/conversations/${selectedId}/call/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: incomingCall.room }),
      })
      if (!res.ok) { notify.error("Could not join call"); return }
      const { token, lkUrl } = await res.json() as { token: string; lkUrl: string }
      setActiveCall({ room: incomingCall.room, token, lkUrl, kind: incomingCall.kind, otherName: incomingCall.callerName })
      setIncomingCall(null)
    } catch {
      notify.error("Failed to join call")
    }
  }, [incomingCall, selectedId, apiBase, notify])

  const endCall = useCallback(async () => {
    if (!activeCall || !selectedId) return
    setActiveCall(null)
    await fetch(`/api/conversations/${selectedId}/call`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: activeCall.room }),
    }).catch(() => null)
  }, [activeCall, selectedId, apiBase])

  const { messages: wsMessages, sendMessage, isConnected, typingUsers, handleTyping, sendReadReceipt } = useSocket(
    websocketUrl, selectedId, user, handleReceipt, handleCallInvite, handleCallEnd,
  )

  // Locally hidden messages — delete-for-me has fired but the backend
  // round-trip / undo window are still in play. Kept as state so the UI
  // updates instantly; persisted server-side via DELETE in the background.
  const [hiddenMsgIds, setHiddenMsgIds] = useState<Set<number | string>>(new Set())

  // Pending delete that's still within the 3.5s undo window. Cleared
  // when the user undoes or when the toast times out.
  const [pendingDelete, setPendingDelete] = useState<{
    msgId: number | string
    timeoutId: ReturnType<typeof setTimeout>
  } | null>(null)

  const allMessages = [...apiMessages, ...wsMessages]
    .filter(m => m.id == null || !hiddenMsgIds.has(m.id))
    .sort((a, b) => a.timestamp - b.timestamp)

  // Reset undo state when switching conversations so a stale toast
  // doesn't leak into the next thread.
  useEffect(() => {
    if (pendingDelete) clearTimeout(pendingDelete.timeoutId)
    setPendingDelete(null)
    setHiddenMsgIds(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const handleDeleteMessage = (msgId: number | string) => {
    if (!selectedId) return
    // Optimistic hide immediately.
    setHiddenMsgIds(prev => new Set(prev).add(msgId))
    // Cancel any previous pending undo.
    if (pendingDelete) clearTimeout(pendingDelete.timeoutId)

    // Fire the delete in the background.
    fetch(`/api/conversations/${selectedId}/messages/${msgId}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {})

    // Start a 3.5s window for undo.
    const timeoutId = setTimeout(() => {
      setPendingDelete(current => current?.msgId === msgId ? null : current)
    }, 3500)
    setPendingDelete({ msgId, timeoutId })
  }

  const handleUndoDelete = async () => {
    if (!pendingDelete || !selectedId) return
    const { msgId, timeoutId } = pendingDelete
    clearTimeout(timeoutId)
    setPendingDelete(null)
    // Restore visually first.
    setHiddenMsgIds(prev => {
      const next = new Set(prev)
      next.delete(msgId)
      return next
    })
    // Tell the server.
    try {
      await fetch(`/api/conversations/${selectedId}/messages/${msgId}/restore`, {
        method: "POST",
        credentials: "include",
      })
    } catch {
      // If restore failed for some reason, re-hide so UI stays honest.
      setHiddenMsgIds(prev => new Set(prev).add(msgId))
    }
  }

  const filtered = conversations.filter(c => {
    const other = c.participants.find(p => p.userId !== user?.id)
    return !search || other?.userName?.toLowerCase().includes(search.toLowerCase())
  })

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [allMessages])

  useEffect(() => {
    if (selectedId) inputRef.current?.focus()
  }, [selectedId])

  // When the conversation is open, mark incoming messages as read.
  // The REST call catches the initial-load case (messages already in DB).
  // The WS read receipt makes it instant for messages that arrive while
  // the user is viewing. Fires on every change so new arrivals get
  // stamped right away.
  useEffect(() => {
    if (!selectedId) return
    fetch(`/api/conversations/${selectedId}/read`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {})
    if (isConnected) sendReadReceipt()
  }, [selectedId, isConnected, apiMessages.length, wsMessages.length, sendReadReceipt])

  const getOther = (conv: typeof selectedConv) =>
    conv?.participants.find(p => p.userId !== user?.id)

  // Close the 3-dot menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false) }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  const handleViewProfile = () => {
    setMenuOpen(false)
    if (!other?.userId) return
    router.push(`/profile/${other.userId}`)
  }

  const handleBlockUser = async () => {
    setMenuOpen(false)
    if (!other?.userId || !selectedId) return
    const blockedUserId = other.userId
    const blockedName = other.userName
    const convIdToRemove = selectedId
    const ok = await notify.confirm({
      title: `Block ${blockedName}?`,
      message: "They won't be able to message you, follow you, or see your profile and posts. The conversation will disappear from your inbox.",
      confirmLabel: "Block",
      destructive: true,
    })
    if (!ok) return
    // Optimistic: drop the row from the list + clear selection right away.
    const prevConversations = conversations
    setConversations(prev => prev.filter(c => c.id !== convIdToRemove))
    setSelectedId(null)
    try {
      const res = await fetch(`/api/blocks/${blockedUserId}`, { method: "POST", credentials: "include" })
      if (!res.ok && res.status !== 204) throw new Error("Failed")
      notify.success(`${blockedName} has been blocked.`)
      // Refetch in the background to catch any other conversations also
      // affected by the block (group chats, etc.) and to sync state.
      void refresh()
    } catch {
      setConversations(prevConversations)
      notify.error("Could not block. Try again.")
    }
  }

  const handleDeleteChat = async () => {
    setMenuOpen(false)
    if (!selectedId) return
    const convIdToRemove = selectedId
    const ok = await notify.confirm({
      title: "Delete chat?",
      message: "This conversation will disappear from your inbox. The other person will still see your messages on their side.",
      confirmLabel: "Delete",
      destructive: true,
    })
    if (!ok) return
    // Optimistic removal — the row vanishes instantly.
    const prevConversations = conversations
    setConversations(prev => prev.filter(c => c.id !== convIdToRemove))
    setSelectedId(null)
    try {
      const res = await fetch(`/api/conversations/${convIdToRemove}`, { method: "DELETE", credentials: "include" })
      if (!res.ok && res.status !== 204) throw new Error("Failed")
      notify.success("Chat deleted.")
    } catch {
      setConversations(prevConversations)
      notify.error("Could not delete. Try again.")
    }
  }

  const handleSend = () => {
    if (!input.trim() || !isConnected || !isVerified) return
    sendMessage(input.trim())
    setInput("")
  }

  const handleImageUpload = useCallback(async (file: File) => {
    if (!isConnected || !isVerified) return
    setUploadingImage(true)
    try {
      const url = await uploadFile(file, undefined, "posts")
      sendMessage("", url)
    } catch {
      notify.error("Image upload failed")
    } finally {
      setUploadingImage(false)
      if (imageInputRef.current) imageInputRef.current.value = ""
    }
  }, [isConnected, isVerified, sendMessage, notify])

  const other = getOther(selectedConv)
  const isTyping = other && typingUsers.has(other.userId)

  // Detect whether the other person follows the current user. This is a
  // one-way check (other → me), so we know when to surface the subtle
  // "they don't follow you" hint in the conversation header.
  const [otherFollowsMe, setOtherFollowsMe] = useState<boolean | null>(null)
  useEffect(() => {
    setOtherFollowsMe(null)
    if (!other?.userId || !user?.id || other.userId === user.id) return
    let cancelled = false
    fetch(`/api/follows?followerId=${other.userId}&followingId=${user.id}`, {
      credentials: "include",
    })
      .then(r => r.ok ? r.json() : { isFollowing: false })
      .then(data => { if (!cancelled) setOtherFollowsMe(!!data?.isFollowing) })
      .catch(() => { if (!cancelled) setOtherFollowsMe(false) })
    return () => { cancelled = true }
  }, [other?.userId, user?.id])

  return (
    <>
    <HowTo
      id="messages"
      steps={[
        { icon: "💬", title: "Start a conversation", body: "Click the compose icon to message anyone on TVIMBLE — search by name, username, or role." },
        { icon: "🖼️", title: "Send images & files", body: "Tap the image icon in the chat bar to share a photo or file — up to 10 MB per upload." },
        { icon: "📞", title: "Voice & video calls", body: "Open a conversation and tap the phone or camera icon to start a live call — no app needed." },
      ]}
    />
    <DashboardLayout fullBleed>
      <div className={cn("t-messages", sidebarCollapsed && "t-messages--collapsed", selectedId && "t-messages--chat-open")}>

        {/* ── Sidebar ── */}
        <div className={cn("t-msg-list", selectedId ? "t-msg-list--hidden-mobile" : "")}>
          <div className="t-msg-list-head">
            <div className="t-msg-list-title-row">
              {!sidebarCollapsed && <span className="t-msg-list-title">Messages</span>}
              <div className="t-conn-pill">
                <span className={cn("t-conn-dot", isConnected && "live")} />
                {!sidebarCollapsed && (isConnected ? "live" : "offline")}
              </div>
              {/* Collapse toggle — desktop only */}
              <button
                type="button"
                className="t-sidebar-toggle"
                onClick={() => setSidebarCollapsed(v => !v)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={sidebarCollapsed ? "Expand" : "Collapse"}
              >
                {sidebarCollapsed ? <ArrowLeft size={15} style={{ transform: "rotate(180deg)" }} /> : <ArrowLeft size={15} />}
              </button>
            </div>

            {!sidebarCollapsed && (
              <>
                <div className="t-msg-search">
                  <Search size={14} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search chats…"
                  />
                </div>
                <button
                  type="button"
                  className="t-msg-new-btn"
                  onClick={() => setShowNewMsg(true)}
                  disabled={!isVerified}
                  title={isVerified ? "Start a new message" : "Verification required"}
                >
                  <UserPlus size={15} />
                  <span>New message</span>
                </button>
              </>
            )}
            {sidebarCollapsed && (
              <button
                type="button"
                className="t-icon-btn-sm"
                onClick={() => setShowNewMsg(true)}
                disabled={!isVerified}
                title="New message"
                style={{ margin: "4px auto 0" }}
              >
                <UserPlus size={15} />
              </button>
            )}
          </div>

          <div className="t-msg-list-scroll">
            {loadingConvs ? (
              [70, 55, 75, 50, 65].map((w, i) => <SkeletonRow key={i} widthPct={w} />)
            ) : filtered.length === 0 ? (
              <div className="t-msg-empty">
                <div className="t-msg-empty-icon">
                  <User size={22} />
                </div>
                <strong>No conversations yet</strong>
                {isVerified && (
                  <button
                    onClick={() => setShowNewMsg(true)}
                    style={{ fontSize: 13, color: "var(--t-gold-ink)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}
                  >
                    Start one →
                  </button>
                )}
              </div>
            ) : (
              filtered.map(conv => {
                const o = getOther(conv)
                return (
                  <button
                    key={conv.id}
                    className={cn("t-thread", conv.id === selectedId && "active", sidebarCollapsed && "t-thread--collapsed")}
                    onClick={() => setSelectedId(conv.id)}
                    title={sidebarCollapsed ? (o?.userName || "Unknown") : undefined}
                  >
                    <Avatar src={o?.userAvatar} name={o?.userName} size={sidebarCollapsed ? 36 : 42} />
                    {!sidebarCollapsed && <div className="t-thread-meta">
                      <div className="t-thread-top">
                        <span className="t-thread-name">{o?.userName || "Unknown"}</span>
                        <span className="t-thread-time">
                          {conv.lastMessage ? formatTime(conv.lastMessage.timestamp) : formatTime(conv.updatedAt)}
                        </span>
                      </div>
                      <p className="t-thread-preview">
                        {conv.lastMessage?.content || (
                          <span className="t-thread-preview-empty">No messages yet</span>
                        )}
                      </p>
                    </div>}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Pane ── */}
        <div className={cn("t-msg-pane", !selectedId ? "t-msg-pane--hidden-mobile" : "")}>
          {selectedConv ? (
            <>
              {/* Header */}
              <div className="t-msg-pane-head">
                <button
                  className="t-icon-btn-sm t-msg-back-btn"
                  onClick={() => setSelectedId(null)}
                  style={{ marginLeft: -4 }}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={20} />
                </button>
                <Avatar src={other?.userAvatar} name={other?.userName} size={36} />
                <div className="t-msg-pane-identity">
                  <p className="t-msg-pane-name">
                    {other?.userName || "Unknown"}
                    {otherFollowsMe === false && (
                      <span
                        className="t-not-following-chip"
                        title={`${other?.userName ?? "This person"} doesn't follow you`}
                      >
                        Not following you
                      </span>
                    )}
                  </p>
                  <p className={cn("t-msg-pane-sub", isTyping && "typing")}>
                    {isTyping ? "typing…" : isConnected ? "online" : "offline"}
                  </p>
                </div>

                {/* Call buttons */}
                {isVerified && (
                  <div className="t-msg-call-btns">
                    <button
                      type="button"
                      className="t-icon-btn-sm"
                      onClick={() => void startCall("audio")}
                      aria-label="Audio call"
                      title="Audio call"
                    >
                      <Phone size={16} />
                    </button>
                    <button
                      type="button"
                      className="t-icon-btn-sm"
                      onClick={() => void startCall("video")}
                      aria-label="Video call"
                      title="Video call"
                    >
                      <Video size={16} />
                    </button>
                  </div>
                )}

                {/* 3-dot menu: view profile / block / delete chat */}
                <div className="t-msg-menu">
                  <button
                    ref={menuBtnRef}
                    type="button"
                    className="t-icon-btn-sm"
                    onClick={() => {
                      if (menuOpen) { setMenuOpen(false); return }
                      const rect = menuBtnRef.current?.getBoundingClientRect()
                      if (rect) {
                        setMenuAnchor({
                          top: rect.bottom + 6,
                          right: window.innerWidth - rect.right,
                        })
                      }
                      setMenuOpen(true)
                    }}
                    aria-label="Conversation menu"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    style={{ border: "none", background: "none" }}
                  >
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>

              {/* Stream */}
              <div ref={scrollRef} className="t-msg-stream">
                {loadingMsgs ? (
                  <div className="t-msg-empty" style={{ flex: 1 }}>
                    <div className="animate-pulse" style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
                      {[70, 50, 80, 60].map((w, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: i % 2 === 0 ? "flex-start" : "flex-end" }}>
                          <div style={{ width: `${w}%`, height: 38, borderRadius: 14, background: "var(--t-surface-2)" }} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : allMessages.length === 0 ? (
                  <div className="t-msg-empty" style={{ flex: 1 }}>
                    <div className="t-msg-empty-icon">
                      <Send size={20} style={{ color: "var(--t-gold)" }} />
                    </div>
                    <strong>Say hello!</strong>
                    <p>This is the start of your conversation with {other?.userName}.</p>
                  </div>
                ) : (
                  allMessages.map((msg, i) => {
                    const isMe = msg.userId === user?.id
                    const prev = allMessages[i - 1]
                    const showAvatar = !isMe && msg.userId !== prev?.userId
                    const grouped = prev && prev.userId === msg.userId && msg.timestamp - prev.timestamp < 60000
                    const showTime = !grouped || i === allMessages.length - 1

                    return (
                      <div
                        key={`${msg.id}-${msg.timestamp}`}
                        className={cn("t-msg-row", isMe ? "me" : "them", !grouped && "gap")}
                      >
                        {!isMe && (
                          <div className="t-msg-avatar-slot">
                            {showAvatar && <Avatar src={other?.userAvatar} name={other?.userName} size={28} />}
                          </div>
                        )}
                        <div className="t-msg-body">
                          {showAvatar && !isMe && (
                            <span className="t-msg-sender">{msg.name}</span>
                          )}
                          <div className="t-bubble-wrap">
                            <div className={cn("t-bubble", isMe ? "me" : "them", msg.imageUrl ? "image" : "")}>
                              {msg.imageUrl && (
                                <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={msg.imageUrl} alt="image" className="t-bubble-img" />
                                </a>
                              )}
                              {msg.content && <span>{msg.content}</span>}
                            </div>
                            {isMe && msg.id != null && (
                              <button
                                type="button"
                                className="t-bubble-delete"
                                onClick={() => handleDeleteMessage(msg.id!)}
                                aria-label="Delete message"
                                title="Delete message"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          {showTime && (
                            <span className="t-bubble-time">
                              {formatFullTime(msg.timestamp)}
                              {isMe && msg.id != null && (
                                msg.readAt ? (
                                  <CheckCheck
                                    size={13}
                                    className="t-bubble-status read"
                                    aria-label="Read"
                                  />
                                ) : msg.deliveredAt ? (
                                  <CheckCheck
                                    size={13}
                                    className="t-bubble-status"
                                    aria-label="Delivered"
                                  />
                                ) : (
                                  <Check
                                    size={12}
                                    className="t-bubble-status"
                                    aria-label="Sent"
                                  />
                                )
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}

                {/* Undo toast — appears for 3.5s after a delete. */}
                {pendingDelete && (
                  <div
                    className="t-msg-undo-toast"
                    role="status"
                    aria-live="polite"
                  >
                    <span>Message deleted</span>
                    <button
                      type="button"
                      onClick={handleUndoDelete}
                      className="t-msg-undo-btn"
                    >
                      Undo
                    </button>
                  </div>
                )}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="t-msg-row them gap">
                    <div className="t-msg-avatar-slot">
                      <Avatar src={other?.userAvatar} name={other?.userName} size={28} />
                    </div>
                    <div className="t-typing-bubble">
                      <span className="t-typing-dot" />
                      <span className="t-typing-dot" />
                      <span className="t-typing-dot" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="t-msg-input">
                {!isVerified ? (
                  <div className="t-msg-locked">
                    <Lock size={14} style={{ flexShrink: 0 }} />
                    Verify your account to send messages
                  </div>
                ) : (
                  <>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                      style={{ display: "none" }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) void handleImageUpload(file)
                      }}
                    />
                    <button
                      type="button"
                      className="t-icon-btn-sm"
                      style={{ border: "none", background: "none", color: uploadingImage ? "var(--t-gold)" : "var(--t-ink-3)" }}
                      title="Send image"
                      disabled={uploadingImage}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      {uploadingImage ? <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid var(--t-gold)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} /> : <ImageIcon size={18} />}
                    </button>
                    <button
                      type="button"
                      className="t-icon-btn-sm"
                      style={{ border: "none", background: "none", color: "var(--t-ink-3)" }}
                      title="Attach file"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <Paperclip size={18} />
                    </button>
                    <form onSubmit={e => { e.preventDefault(); handleSend() }} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <input
                        ref={inputRef}
                        className="t-msg-input-field"
                        value={input}
                        onChange={e => { setInput(e.target.value); handleTyping() }}
                        placeholder={isConnected ? "Type a message…" : "Connecting…"}
                        disabled={!isConnected}
                      />
                      <button
                        type="submit"
                        className={cn("t-msg-send", input.trim() && isConnected && "ready")}
                        disabled={!isConnected || !input.trim()}
                      >
                        <Send size={16} />
                      </button>
                    </form>
                  </>
                )}
              </div>
            </>
          ) : (
            /* No conversation selected */
            <div className="t-msg-empty" style={{ flex: 1 }}>
              <div className="t-msg-empty-icon" style={{ width: 72, height: 72 }}>
                <Send size={28} style={{ color: "var(--t-gold)" }} />
              </div>
              <strong style={{ fontSize: 16 }}>Your messages</strong>
              <p>
                {isVerified
                  ? "Select a conversation or start a new one."
                  : "Verify your account to access messaging."}
              </p>
              {isVerified && (
                <button
                  onClick={() => setShowNewMsg(true)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    height: 36, padding: "0 16px", borderRadius: 9,
                    background: "var(--t-ink)", color: "#fff",
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 13, fontWeight: 500, marginTop: 4,
                  }}
                >
                  <UserPlus size={15} />
                  New message
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showNewMsg && (
        <NewMessageModal
          currentUser={user ? { id: user.id, fullName: user.fullName, avatar: user.avatar } : null}
          isVerified={isVerified}
          existingConversations={conversations}
          onClose={() => setShowNewMsg(false)}
          onCreate={conv => { setSelectedId(conv.id); void refresh() }}
          createConversation={createConversation}
        />
      )}

      {/* Conversation menu dropdown — portalled so it escapes the
          .t-messages overflow: hidden clip. Anchored to the button via
          measured viewport coords. */}
      {menuOpen && menuAnchor && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="t-msg-menu-dropdown"
          style={{ top: menuAnchor.top, right: menuAnchor.right }}
        >
          <button role="menuitem" className="t-msg-menu-item" onClick={handleViewProfile}>
            <User size={14} />
            View profile
          </button>
          <button role="menuitem" className="t-msg-menu-item t-msg-menu-item--danger" onClick={handleBlockUser}>
            <UserX size={14} />
            Block {other?.userName?.split(" ")[0] || "user"}
          </button>
          <div className="t-msg-menu-divider" />
          <button role="menuitem" className="t-msg-menu-item t-msg-menu-item--danger" onClick={handleDeleteChat}>
            <Trash2 size={14} />
            Delete chat
          </button>
        </div>,
        document.body
      )}
    </DashboardLayout>

    {/* Active call modal */}
    {activeCall && (
      <CallModal session={activeCall} onEnd={() => void endCall()} />
    )}

    {/* Incoming call banner */}
    {incomingCall && !activeCall && (
      <div className="t-call-incoming-wrap">
        <IncomingCallBanner
          callerName={incomingCall.callerName}
          kind={incomingCall.kind}
          onAccept={() => void acceptCall()}
          onDecline={() => setIncomingCall(null)}
        />
      </div>
    )}
    </>
  )
}
