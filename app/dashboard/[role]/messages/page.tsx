"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Search, Send, ArrowLeft, User, Circle, ImageIcon, Paperclip } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useParams } from "next/navigation"
import { useSocket } from "@/hooks/use-socket"
import { useConversations, useMessages } from "@/hooks/use-conversations"
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

export default function MessagesPage() {
  const params = useParams()
  const role = params.role as string
  const { user } = useStore()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [input, setInput] = useState("")
  const [search, setSearch] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const websocketUrl = getWebSocketUrl() ? `${getWebSocketUrl()}/ws` : null

  const { conversations, isLoading: loadingConvs } = useConversations(user?.id)
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
    if (!input.trim() || !isConnected) return
    sendMessage(input.trim())
    setInput("")
  }

  const other = getOther(selectedConv)
  const isTyping = other && typingUsers.has(other.userId)

  return (
    <DashboardLayout role={role}>
      <div className="t-messages" style={{ background: "var(--t-bg)" }}>

        {/* ── Sidebar ── */}
        <div className={cn(
          "t-msg-list flex flex-col",
          selectedId ? "hidden md:flex" : "flex"
        )} style={{ width: 300, minWidth: 300, background: "var(--t-surface)" }}>

          {/* Header */}
          <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--t-line)" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>Messages</h2>
              <div className="flex items-center gap-1.5">
                <Circle
                  size={7}
                  className={cn("fill-current", isConnected ? "text-emerald-400" : "text-neutral-400")}
                />
                <span style={{ fontSize: 10, color: "var(--t-ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {isConnected ? "live" : "offline"}
                </span>
              </div>
            </div>
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--t-ink-3)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                style={{
                  width: "100%", paddingLeft: 32, paddingRight: 12, height: 34,
                  background: "var(--t-surface-2)", border: "1px solid var(--t-line)",
                  borderRadius: 8, fontSize: 13, color: "var(--t-ink)", outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex flex-col gap-3 p-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3 items-center animate-pulse">
                    <div className="rounded-full shrink-0" style={{ width: 42, height: 42, background: "var(--t-surface-2)" }} />
                    <div className="flex-1 space-y-2">
                      <div style={{ height: 12, width: "60%", borderRadius: 4, background: "var(--t-surface-2)" }} />
                      <div style={{ height: 10, width: "80%", borderRadius: 4, background: "var(--t-surface-2)" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2" style={{ color: "var(--t-ink-3)" }}>
                <User size={24} />
                <p style={{ fontSize: 13 }}>No conversations yet</p>
              </div>
            ) : (
              filtered.map(conv => {
                const o = getOther(conv)
                const isSelected = conv.id === selectedId
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 transition-colors"
                    style={{
                      borderBottom: "1px solid var(--t-line)",
                      background: isSelected ? "var(--t-surface-2)" : "transparent",
                      borderLeft: isSelected ? `3px solid var(--t-gold)` : "3px solid transparent",
                    }}
                  >
                    <Avatar src={o?.userAvatar} name={o?.userName} size={42} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t-ink)" }} className="truncate">
                          {o?.userName || "Unknown"}
                        </p>
                        <span style={{ fontSize: 11, color: "var(--t-ink-3)", flexShrink: 0, marginLeft: 8 }}>
                          {conv.lastMessage ? formatTime(conv.lastMessage.timestamp) : formatTime(conv.updatedAt)}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--t-ink-3)" }} className="truncate">
                        {conv.lastMessage?.content || "Start a conversation"}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Chat pane ── */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          !selectedId ? "hidden md:flex" : "flex"
        )} style={{ background: "var(--t-bg)" }}>

          {selectedConv ? (
            <>
              {/* Chat header */}
              <div
                className="flex items-center gap-3 px-4 shrink-0"
                style={{
                  height: 60, borderBottom: "1px solid var(--t-line)",
                  background: "var(--t-surface)",
                }}
              >
                <button
                  onClick={() => setSelectedId(null)}
                  className="md:hidden"
                  style={{ color: "var(--t-ink-2)", background: "none", border: "none", cursor: "pointer", padding: 4, marginLeft: -4 }}
                >
                  <ArrowLeft size={20} />
                </button>
                <Avatar src={other?.userAvatar} name={other?.userName} size={36} />
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t-ink)" }} className="truncate">
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
                className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-1"
                style={{ background: "var(--t-bg)" }}
              >
                {loadingMsgs ? (
                  <div className="flex items-center justify-center flex-1" style={{ color: "var(--t-ink-3)", fontSize: 13 }}>
                    Loading…
                  </div>
                ) : allMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-2" style={{ color: "var(--t-ink-3)" }}>
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
                        className={cn("flex items-end gap-2", isMe ? "justify-end" : "justify-start")}
                        style={{ marginTop: grouped ? 2 : 10 }}
                      >
                        {/* Other person's avatar */}
                        {!isMe && (
                          <div style={{ width: 28, flexShrink: 0 }}>
                            {showAvatar && <Avatar src={other?.userAvatar} name={other?.userName} size={28} />}
                          </div>
                        )}

                        <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")} style={{ maxWidth: "68%" }}>
                          {showAvatar && !isMe && (
                            <span style={{ fontSize: 11, color: "var(--t-ink-3)", marginBottom: 3, paddingLeft: 2 }}>
                              {msg.name}
                            </span>
                          )}
                          <div
                            style={{
                              padding: "9px 13px",
                              borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                              background: isMe ? "var(--t-ink)" : "var(--t-surface)",
                              color: isMe ? "var(--t-bg)" : "var(--t-ink)",
                              border: isMe ? "none" : "1px solid var(--t-line)",
                              fontSize: 14,
                              lineHeight: 1.45,
                              wordBreak: "break-word",
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
                className="shrink-0 px-4 py-3 flex items-center gap-2"
                style={{ borderTop: "1px solid var(--t-line)", background: "var(--t-surface)" }}
              >
                <button style={{ color: "var(--t-ink-3)", background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
                  <Paperclip size={18} />
                </button>
                <button style={{ color: "var(--t-ink-3)", background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
                  <ImageIcon size={18} />
                </button>
                <form
                  onSubmit={e => { e.preventDefault(); handleSend() }}
                  className="flex-1 flex items-center gap-2"
                >
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
                    onFocus={e => e.target.style.borderColor = "var(--t-gold)"}
                    onBlur={e => e.target.style.borderColor = "var(--t-line)"}
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
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8" style={{ color: "var(--t-ink-3)" }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "var(--t-surface)",
                border: "1px solid var(--t-line)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Send size={28} style={{ color: "var(--t-gold)" }} />
              </div>
              <div className="text-center">
                <p style={{ fontSize: 16, fontWeight: 600, color: "var(--t-ink)", marginBottom: 6 }}>Your messages</p>
                <p style={{ fontSize: 13, maxWidth: 260, lineHeight: 1.5 }}>
                  Select a conversation from the left to start chatting.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
