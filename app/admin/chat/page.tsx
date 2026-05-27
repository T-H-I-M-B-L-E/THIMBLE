'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { adminFetch } from '@/lib/adminFetch'

interface ChatMsg {
  id: number
  userId: string
  name: string
  content: string
  timestamp: number
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const diff = Date.now() - d.getTime()
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-semibold"
      style={{
        width: size, height: size,
        background: 'oklch(0.26 0.010 60)',
        color: 'oklch(0.85 0.06 60)',
        fontSize: size * 0.38,
      }}
    >
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

export default function AdminChatPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [adminId, setAdminId] = useState('')
  const [adminName, setAdminName] = useState('')
  const ws = useRef<WebSocket | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setAdminId(sessionStorage.getItem('admin_id') || '')
    setAdminName(sessionStorage.getItem('admin_name') || '')
  }, [])

  const connect = useCallback(async () => {
    if (ws.current?.readyState === WebSocket.OPEN) return
    try {
      const r = await adminFetch('/api/admin/ws-token')
      if (!r.ok) return
      const { token } = await r.json()
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
      const wsUrl = apiBase.replace(/^http/, 'ws') + `/admin/ws?token=${encodeURIComponent(token)}`
      const sock = new WebSocket(wsUrl)
      ws.current = sock

      sock.onopen = () => { setConnected(true); inputRef.current?.focus() }
      sock.onclose = () => { setConnected(false); ws.current = null }
      sock.onerror = () => { setConnected(false); ws.current = null }
      sock.onmessage = (e) => {
        try {
          const msg: ChatMsg = JSON.parse(e.data)
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    // Load history
    adminFetch('/api/admin/chat')
      .then(r => r.ok ? r.json() : [])
      .then((msgs: ChatMsg[]) => setMessages(Array.isArray(msgs) ? msgs : []))
      .catch(() => {})
    connect()
    return () => { ws.current?.close() }
  }, [connect])

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const send = () => {
    if (!input.trim() || ws.current?.readyState !== WebSocket.OPEN) return
    ws.current.send(JSON.stringify({ content: input.trim() }))
    setInput('')
  }

  return (
    <div className="flex flex-col h-full bg-neutral-950 pb-32">

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-0.5 font-medium">Admin</p>
          <h1 className="text-lg font-light tracking-wide text-white">Team Chat</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
          <span className="text-xs text-neutral-400">{connected ? 'Live' : 'Connecting…'}</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-1">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-20">
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-neutral-500 text-sm">No messages yet — say something.</p>
          </div>
        ) : messages.map((msg, i) => {
          const isMe = msg.userId === adminId
          const prev = messages[i - 1]
          const grouped = prev && prev.userId === msg.userId && msg.timestamp - prev.timestamp < 60000
          const showHeader = !grouped

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}
              style={{ marginTop: grouped ? 2 : 16 }}
            >
              {/* Other's avatar */}
              {!isMe && (
                <div style={{ width: 36, flexShrink: 0 }}>
                  {showHeader && <Avatar name={msg.name} size={36} />}
                </div>
              )}

              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`} style={{ maxWidth: '64%' }}>
                {showHeader && !isMe && (
                  <p className="text-xs text-neutral-400 mb-1.5 px-1">{msg.name}</p>
                )}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isMe ? '#ffffff' : 'rgba(255, 255, 255, 0.12)',
                  color: isMe ? '#0a0a0a' : '#e5e5e5',
                  fontSize: 14,
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  border: isMe ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                  {msg.content}
                </div>
                {(!grouped || i === messages.length - 1) && (
                  <p className="text-xs text-neutral-500 mt-1.5 px-1" style={{ textAlign: isMe ? 'right' : 'left' }}>
                    {formatTime(msg.timestamp)}
                  </p>
                )}
              </div>

              {/* My avatar */}
              {isMe && (
                <div style={{ width: 36, flexShrink: 0 }}>
                  {showHeader && <Avatar name={adminName} size={36} />}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Input bar */}
      <form
        onSubmit={e => { e.preventDefault(); send() }}
        className="shrink-0 flex items-center gap-3 px-4 py-3 border-t border-white/10 bg-white/5 backdrop-blur-xl fixed bottom-20 left-0 right-0"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={connected ? 'Message the team…' : 'Connecting…'}
          disabled={!connected}
          className="flex-1 bg-white/10 outline-none text-sm text-white placeholder-neutral-500 rounded-full px-4 py-3 border border-white/20 focus:border-white/40 transition-colors"
          style={{ fontFamily: 'inherit' }}
        />
        <button
          type="submit"
          disabled={!connected || !input.trim()}
          style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: input.trim() && connected ? '#ffffff' : 'rgba(255, 255, 255, 0.1)',
            color: input.trim() && connected ? '#0a0a0a' : 'rgba(255, 255, 255, 0.4)',
            border: 'none',
            cursor: input.trim() && connected ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  )
}
