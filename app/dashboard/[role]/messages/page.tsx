"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Search, Send, ArrowLeft, User, Circle, ImageIcon, Paperclip, UserPlus, X, ShieldAlert, Lock } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useParams } from "next/navigation"
import { useSocket } from "@/hooks/use-socket"
import { useConversations, useMessages } from "@/hooks/use-conversations"
import { useFollowing } from "@/hooks/use-social"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { getWebSocketUrl } from "@/lib/platform"
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
      {src ? (
        <Image src={src} alt={name || ""} width={size} height={size} className="object-cover w-full h-full" />
      ) : (
        <span>{name?.[0]?.toUpperCase() ?? <User size={size * 0.45} />}</span>
      )}
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

// ── New Message Modal ────────────────────────────────────────────────────────

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

  const handleSelect = async (followedUser: typeof following[0]) => {
    if (!isVerified || creating) return
    setCreating(followedUser.userId)
    try {
      const conv = await createConversation([{
        userId: followedUser.userId,
        userName: followedUser.userName,
        userAvatar: followedUser.userAvatar || "",
      }])
      onCreate(conv)
      onClose()
    } catch {
      // conversation may already exist — still close modal
      onClose()
    } finally {
      setCreating(null)
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,.4)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--t-surface)", border: "1px solid var(--t-line)",
          borderRadius: 16, width: "100%", maxWidth: 400, maxHeight: "80vh",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--t-line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--t-ink)" }}>New message</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t-ink-3)", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {!isVerified ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--t-ink-3)" }}>
            <ShieldAlert size={32} style={{ margin: "0 auto 12px", color: "var(--t-gold)" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t-ink)", marginBottom: 6 }}>Verification required</p>
            <p style={{ fontSize: 13, lineHeight: 1.5 }}>You need to be verified to send messages.</p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--t-line)" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--t-ink-3)" }} />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search people you follow…"
                  style={{
                    width: "100%", paddingLeft: 32, paddingRight: 12, height: 36,
                    background: "var(--t-surface-2)", border: "1px solid var(--t-line)",
                    borderRadius: 8, fontSize: 13, color: "var(--t-ink)", outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {isLoading ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--t-ink-3)", fontSize: 13 }}>Loading…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--t-ink-3)" }}>
                  <UserPlus size={28} style={{ margin: "0 auto 10px" }} />
                  <p style={{ fontSize: 13, lineHeight: 1.5 }}>
                    {following.length === 0
                      ? "Follow people to message them."
                      : "No one matches your search."}
                  </p>
                </div>
              ) : (
                filtered.map(u => (
                  <button
                    key={u.userId}
                    onClick={() => handleSelect(u)}
                    disabled={creating === u.userId}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 16px", background: "none", border: "none",
                      borderBottom: "1px solid var(--t-line)", cursor: "pointer",
                      textAlign: "left", transition: "background .12s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--t-surface-2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <Avatar src={u.userAvatar} name={u.userName} size={38} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t-ink)" }}>{u.userName}</p>
                      {u.role && <p style={{ fontSize: 12, color: "var(--t-ink-3)", textTransform: "capitalize" }}>{u.role}</p>}
                    </div>
                    {creating === u.userId && (
                      <div style={{ marginLeft: "auto", width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--t-line)", borderTopColor: "var(--t-gold)" }} className="animate-spin" />
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

// ── Main page ────────────────────────────────────────────────────────────────

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
  const websocketUrl = getWebSocketUrl() ? `${getWebSocketUrl()}/ws` : null

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
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
      {/* Verification gate banner */}
      {!isVerified && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            background: "color-mix(in oklab, var(--t-gold) 12%, var(--t-surface))",
            border: "1px solid color-mix(in oklab, var(--t-gold) 25%, var(--t-line))",
            borderRadius: 10, marginBottom: 12, fontSize: 13, color: "var(--t-ink-2)",
          }}
        >
          <Lock size={14} style={{ color: "var(--t-gold)", flexShrink: 0 }} />
          <span>
            <strong style={{ color: "var(--t-ink)" }}>Verification required</strong> — get verified to send and receive messages.
          </span>
        </div>
      )}

      <div className="t-messages" style={{ background: "var(--t-bg)" }}>

        {/* ── Conversation list ────────────────────────────────────────── */}
        <div className={cn("t-msg-list flex flex-col", selectedId ? "hidden md:flex" : "flex")} style={{ background: "var(--t-surface)" }}>

          {/* Header */}
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--t-line)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>Messages</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Circle size={7} className={cn("fill-current", isConnected ? "text-emerald-400" : "text-neutral-400")} />
                  <span style={{ fontSize: 10, color: "var(--t-ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {isConnected ? "live" : "offline"}
                  </span>
                </div>
                <button
                  onClick={() => setShowNewMsg(true)}
                  title={isVerified ? "New message" : "Verification required to message"}
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: "1px solid var(--t-line)",
                    background: "var(--t-surface-2)", cursor: "pointer", color: "var(--t-ink-2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: isVerified ? 1 : 0.5,
                  }}
                >
                  <UserPlus size={14} />
                </button>
              </div>
            </div>

            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--t-ink-3)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                style={{
                  width: "100%", paddingLeft: 30, paddingRight: 12, height: 34,
                  background: "var(--t-surface-2)", border: "1px solid var(--t-line)",
                  borderRadius: 8, fontSize: 13, color: "var(--t-ink)", outline: "none", fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingConvs ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }} className="animate-pulse">
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--t-surface-2)", flexShrink: 0 }} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ height: 12, width: "60%", borderRadius: 4, background: "var(--t-surface-2)" }} />
                      <div style={{ height: 10, width: "80%", borderRadius: 4, background: "var(--t-surface-2)" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 160, gap: 8, color: "var(--t-ink-3)" }}>
                <User size={24} />
                <p style={{ fontSize: 13 }}>No conversations yet</p>
                {isVerified && (
                  <button
                    onClick={() => setShowNewMsg(true)}
                    style={{ fontSize: 12, color: "var(--t-gold-ink)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}
                  >
                    Start one
                  </button>
                )}
              </div>
            ) : (
              filtered.map(conv => {
                const o = getOther(conv)
                const isSelected = conv.id === selectedId
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    style={{
                      width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 16px", borderBottom: "1px solid var(--t-line)", background: "none", border: "none",
                      borderLeft: isSelected ? `3px solid var(--t-gold)` : "3px solid transparent",
                      backgroundColor: isSelected ? "var(--t-surface-2)" : "transparent",
                      cursor: "pointer", transition: "background .12s",
                    }}
                  >
                    <Avatar src={o?.userAvatar} name={o?.userName} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {o?.userName || "Unknown"}
                        </p>
                        <span style={{ fontSize: 11, color: "var(--t-ink-3)", flexShrink: 0, marginLeft: 8 }}>
                          {conv.lastMessage ? formatTime(conv.lastMessage.timestamp) : formatTime(conv.updatedAt)}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--t-ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {conv.lastMessage?.content || "Start a conversation"}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Chat pane ────────────────────────────────────────────────── */}
        <div
          className={cn("flex-1 flex flex-col min-w-0", !selectedId ? "hidden md:flex" : "flex")}
          style={{ background: "var(--t-bg)" }}
        >
          {selectedConv ? (
            <>
              {/* Chat header */}
              <div
                style={{
                  height: 60, display: "flex", alignItems: "center", gap: 12, padding: "0 16px",
                  borderBottom: "1px solid var(--t-line)", background: "var(--t-surface)", flexShrink: 0,
                }}
              >
                <button
                  onClick={() => setSelectedId(null)}
                  className="md:hidden"
                  style={{ color: "var(--t-ink-2)", background: "none", border: "none", cursor: "pointer", padding: 4, marginLeft: -4, display: "flex" }}
                >
                  <ArrowLeft size={20} />
                </button>
                <Avatar src={other?.userAvatar} name={other?.userName} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {other?.userName || "Unknown"}
                  </p>
                  <p style={{ fontSize: 11, color: isTyping ? "var(--t-gold-ink)" : "var(--t-ink-3)" }}>
                    {isTyping ? "typing…" : isConnected ? "online" : "offline"}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                style={{ flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 4, background: "var(--t-bg)" }}
              >
                {loadingMsgs ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--t-ink-3)", fontSize: 13 }}>
                    Loading…
                  </div>
                ) : allMessages.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 8, color: "var(--t-ink-3)" }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--t-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Send size={18} style={{ color: "var(--t-ink-3)" }} />
                    </div>
                    <p style={{ fontSize: 13 }}>No messages yet — say hello!</p>
                  </div>
                ) : (
                  allMessages.map((msg, i) => {
                    const isMe = msg.userId === user?.id
                    const prevMsg = allMessages[i - 1]
                    const showAvatar = !isMe && msg.userId !== prevMsg?.userId
                    const grouped = prevMsg && prevMsg.userId === msg.userId && msg.timestamp - prevMsg.timestamp < 60000

                    return (
                      <div
                        key={`${msg.id}-${msg.timestamp}`}
                        style={{ display: "flex", alignItems: "flex-end", gap: 8, justifyContent: isMe ? "flex-end" : "flex-start", marginTop: grouped ? 2 : 10 }}
                      >
                        {!isMe && (
                          <div style={{ width: 28, flexShrink: 0 }}>
                            {showAvatar && <Avatar src={other?.userAvatar} name={other?.userName} size={28} />}
                          </div>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", maxWidth: "68%" }}>
                          {showAvatar && !isMe && (
                            <span style={{ fontSize: 11, color: "var(--t-ink-3)", marginBottom: 3, paddingLeft: 2 }}>{msg.name}</span>
                          )}
                          <div
                            style={{
                              padding: "9px 13px",
                              borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                              background: isMe ? "var(--t-ink)" : "var(--t-surface)",
                              color: isMe ? "var(--t-bg)" : "var(--t-ink)",
                              border: isMe ? "none" : "1px solid var(--t-line)",
                              fontSize: 14, lineHeight: 1.45, wordBreak: "break-word",
                            }}
                          >
                            {msg.content}
                          </div>
                          {(!grouped || i === allMessages.length - 1) && (
                            <span style={{ fontSize: 10, color: "var(--t-ink-3)", marginTop: 3, paddingLeft: 2, paddingRight: 2 }}>
                              {formatFullTime(msg.timestamp)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Input bar */}
              <div
                style={{ flexShrink: 0, padding: "11px 16px", display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--t-line)", background: "var(--t-surface)" }}
              >
                {!isVerified ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, color: "var(--t-ink-3)", fontSize: 13 }}>
                    <Lock size={14} style={{ flexShrink: 0 }} />
                    Verify your account to send messages
                  </div>
                ) : (
                  <>
                    <button style={{ color: "var(--t-ink-3)", background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
                      <Paperclip size={18} />
                    </button>
                    <button style={{ color: "var(--t-ink-3)", background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
                      <ImageIcon size={18} />
                    </button>
                    <form onSubmit={e => { e.preventDefault(); handleSend() }} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        ref={inputRef}
                        value={input}
                        onChange={e => { setInput(e.target.value); handleTyping() }}
                        placeholder={isConnected ? "Type a message…" : "Connecting…"}
                        disabled={!isConnected}
                        style={{
                          flex: 1, height: 40, padding: "0 14px",
                          background: "var(--t-surface-2)", border: "1px solid var(--t-line)",
                          borderRadius: 999, fontSize: 14, color: "var(--t-ink)",
                          outline: "none", fontFamily: "inherit", transition: "border-color .15s",
                        }}
                        onFocus={e => (e.target.style.borderColor = "var(--t-gold)")}
                        onBlur={e => (e.target.style.borderColor = "var(--t-line)")}
                      />
                      <button
                        type="submit"
                        disabled={!isConnected || !input.trim()}
                        style={{
                          width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                          background: input.trim() && isConnected ? "var(--t-ink)" : "var(--t-surface-2)",
                          color: input.trim() && isConnected ? "var(--t-bg)" : "var(--t-ink-3)",
                          border: "none", cursor: input.trim() && isConnected ? "pointer" : "default",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "background .15s, color .15s",
                        }}
                      >
                        <Send size={16} />
                      </button>
                    </form>
                  </>
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32, color: "var(--t-ink-3)" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--t-surface)", border: "1px solid var(--t-line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Send size={28} style={{ color: "var(--t-gold)" }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: "var(--t-ink)", marginBottom: 6 }}>Your messages</p>
                <p style={{ fontSize: 13, maxWidth: 260, lineHeight: 1.5 }}>
                  {isVerified
                    ? "Select a conversation or start a new one."
                    : "Verify your account to access messaging."}
                </p>
              </div>
              {isVerified && (
                <button
                  onClick={() => setShowNewMsg(true)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    height: 36, padding: "0 14px", borderRadius: 9,
                    background: "var(--t-ink)", color: "var(--t-bg)",
                    border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500,
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

      {/* New message modal */}
      {showNewMsg && (
        <NewMessageModal
          currentUser={user ? { id: user.id, fullName: user.fullName, avatar: user.avatar } : null}
          isVerified={isVerified}
          onClose={() => setShowNewMsg(false)}
          onCreate={conv => { setSelectedId(conv.id); refresh(); }}
          createConversation={createConversation}
        />
      )}
    </DashboardLayout>
  )
}
