"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Search, Send, ArrowLeft, User, UserPlus, X, ShieldAlert, Lock, Paperclip, ImageIcon } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useParams } from "next/navigation"
import { useSocket } from "@/hooks/use-socket"
import { useConversations, useMessages } from "@/hooks/use-conversations"
import { useFollowing } from "@/hooks/use-social"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import Image from "next/image"

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

function SkeletonRow() {
  return (
    <div className="animate-pulse" style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", borderBottom: "1px solid var(--t-line)" }}>
      <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--t-surface-2)", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ height: 11, width: "55%", borderRadius: 4, background: "var(--t-surface-2)" }} />
        <div style={{ height: 10, width: "75%", borderRadius: 4, background: "var(--t-surface-2)" }} />
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

function NewMessageModal({
  currentUser,
  isVerified,
  onClose,
  onCreate,
  createConversation,
}: {
  currentUser: { id: string; fullName: string; avatar?: string } | null
  isVerified: boolean
  onClose: () => void
  onCreate: (conv: { id: number }) => void
  createConversation: (participants: { userId: string; userName: string; userAvatar: string }[]) => Promise<{ id: number }>
}) {
  const { following, isLoading } = useFollowing(currentUser?.id)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState<string | null>(null)

  const filtered = following.filter(u =>
    u.userName?.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = async (u: typeof following[0]) => {
    if (!isVerified || creating) return
    setCreating(u.userId)
    try {
      const conv = await createConversation([{ userId: u.userId, userName: u.userName, userAvatar: u.userAvatar || "" }])
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
                  placeholder="Search people you follow…"
                />
              </div>
            </div>

            <div className="t-new-msg-modal-list">
              {isLoading ? (
                [1, 2, 3].map(i => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <div className="t-msg-empty">
                  <div className="t-msg-empty-icon">
                    <UserPlus size={22} />
                  </div>
                  <p>
                    {following.length === 0
                      ? "Follow people to message them."
                      : "No one matches your search."}
                  </p>
                </div>
              ) : (
                filtered.map(u => (
                  <button
                    key={u.userId}
                    className="t-new-msg-user"
                    onClick={() => handleSelect(u)}
                    disabled={creating === u.userId}
                  >
                    <Avatar src={u.userAvatar} name={u.userName} size={38} />
                    <div>
                      <p className="t-new-msg-user-name">{u.userName}</p>
                      {u.role && <p className="t-new-msg-user-role">{u.role}</p>}
                    </div>
                    {creating === u.userId && (
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
  const params = useParams()
  const role = params.role as string
  const { user } = useStore()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [input, setInput] = useState("")
  const [search, setSearch] = useState("")
  const [showNewMsg, setShowNewMsg] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "https://thimble-production.up.railway.app"
  const websocketUrl = apiBase.replace(/^http/, "ws") + "/ws"
  const isVerified = user?.verificationStatus === "verified"

  const { conversations, isLoading: loadingConvs, createConversation, refresh } = useConversations(user?.id)
  const selectedConv = conversations.find(c => c.id === selectedId)
  const { messages: apiMessages, isLoading: loadingMsgs } = useMessages(selectedId, user?.id)
  const { messages: wsMessages, sendMessage, isConnected, typingUsers, handleTyping } = useSocket(
    websocketUrl, selectedId, user
  )

  const allMessages = [...apiMessages, ...wsMessages].sort((a, b) => a.timestamp - b.timestamp)

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

  const getOther = (conv: typeof selectedConv) =>
    conv?.participants.find(p => p.userId !== user?.id)

  const handleSend = () => {
    if (!input.trim() || !isConnected || !isVerified) return
    sendMessage(input.trim())
    setInput("")
  }

  const other = getOther(selectedConv)
  const isTyping = other && typingUsers.has(other.userId)

  return (
    <DashboardLayout role={role}>
      {!isVerified && (
        <div className="t-verify-banner">
          <Lock size={14} style={{ color: "var(--t-gold)", flexShrink: 0 }} />
          <span>
            <strong style={{ color: "var(--t-ink)" }}>Verification required</strong> — get verified to send and receive messages.
          </span>
        </div>
      )}

      <div className="t-messages">

        {/* ── Sidebar ── */}
        <div className={cn("t-msg-list", selectedId ? "hidden md:flex" : "flex")}>
          <div className="t-msg-list-head">
            <div className="t-msg-list-title-row">
              <span className="t-msg-list-title">Messages</span>
              <div className="t-msg-list-actions">
                <div className="t-conn-pill">
                  <span className={cn("t-conn-dot", isConnected && "live")} />
                  {isConnected ? "live" : "offline"}
                </div>
                <button
                  className="t-icon-btn-sm"
                  onClick={() => setShowNewMsg(true)}
                  title={isVerified ? "New message" : "Verification required"}
                  disabled={!isVerified}
                >
                  <UserPlus size={14} />
                </button>
              </div>
            </div>

            <div className="t-msg-search">
              <Search size={14} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
              />
            </div>
          </div>

          <div className="t-msg-list-scroll">
            {loadingConvs ? (
              [1, 2, 3].map(i => <SkeletonRow key={i} />)
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
                    className={cn("t-thread", conv.id === selectedId && "active")}
                    onClick={() => setSelectedId(conv.id)}
                  >
                    <Avatar src={o?.userAvatar} name={o?.userName} size={42} />
                    <div className="t-thread-meta">
                      <div className="t-thread-top">
                        <span className="t-thread-name">{o?.userName || "Unknown"}</span>
                        <span className="t-thread-time">
                          {conv.lastMessage ? formatTime(conv.lastMessage.timestamp) : formatTime(conv.updatedAt)}
                        </span>
                      </div>
                      <p className="t-thread-preview">
                        {conv.lastMessage?.content || "Start a conversation"}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Pane ── */}
        <div className={cn("t-msg-pane", !selectedId ? "hidden md:flex" : "flex")}>
          {selectedConv ? (
            <>
              {/* Header */}
              <div className="t-msg-pane-head">
                <button
                  className={cn("t-icon-btn-sm md:hidden")}
                  onClick={() => setSelectedId(null)}
                  style={{ border: "none", background: "none", marginLeft: -4 }}
                >
                  <ArrowLeft size={20} />
                </button>
                <Avatar src={other?.userAvatar} name={other?.userName} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="t-msg-pane-name">{other?.userName || "Unknown"}</p>
                  <p className={cn("t-msg-pane-sub", isTyping && "typing")}>
                    {isTyping ? "typing…" : isConnected ? "online" : "offline"}
                  </p>
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
                          <div className={cn("t-bubble", isMe ? "me" : "them")}>
                            {msg.content}
                          </div>
                          {showTime && (
                            <span className="t-bubble-time">{formatFullTime(msg.timestamp)}</span>
                          )}
                        </div>
                      </div>
                    )
                  })
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
                    <button className="t-icon-btn-sm" style={{ border: "none", background: "none", color: "var(--t-ink-3)" }} title="Attach file">
                      <Paperclip size={18} />
                    </button>
                    <button className="t-icon-btn-sm" style={{ border: "none", background: "none", color: "var(--t-ink-3)" }} title="Send image">
                      <ImageIcon size={18} />
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
          onClose={() => setShowNewMsg(false)}
          onCreate={conv => { setSelectedId(conv.id); refresh() }}
          createConversation={createConversation}
        />
      )}
    </DashboardLayout>
  )
}
