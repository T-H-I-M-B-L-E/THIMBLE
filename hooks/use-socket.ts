"use client"

import { useEffect, useRef, useState, useCallback } from "react"

export interface ChatMessage {
  id?: number
  conversationId: number
  userId: string
  name: string
  content: string
  imageUrl?: string
  timestamp: number
  /** ms-epoch — recipient's socket received the message. */
  deliveredAt?: number | null
  /** ms-epoch — recipient opened the conversation. */
  readAt?: number | null
}

export interface TypingEvent {
  type: "typing"
  conversationId: number
  userId: string
  name: string
  isTyping: boolean
}

export interface ReceiptEvent {
  type: "delivered" | "read"
  conversationId: number
  messageIds: number[]
  timestamp: number
}

export interface CallInviteEvent {
  type: "call-invite"
  callerID: string
  callerName: string
  room: string
  kind: "video" | "audio"
  convID?: number
}

export interface CallEndEvent {
  type: "call-end"
  senderID: string
  room: string
}

export function useSocket(
  url: string | null,
  conversationId: number | null,
  user: { id: string; fullName: string } | null,
  onReceipt?: (ev: ReceiptEvent) => void,
  onCallInvite?: (ev: CallInviteEvent) => void,
  onCallEnd?: (ev: CallEndEvent) => void,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map())
  const socketRef = useRef<WebSocket | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const onReceiptRef = useRef(onReceipt)
  useEffect(() => { onReceiptRef.current = onReceipt }, [onReceipt])
  const onCallInviteRef = useRef(onCallInvite)
  useEffect(() => { onCallInviteRef.current = onCallInvite }, [onCallInvite])
  const onCallEndRef = useRef(onCallEnd)
  useEffect(() => { onCallEndRef.current = onCallEnd }, [onCallEnd])

  useEffect(() => {
    setMessages([])
    setTypingUsers(new Map())
    
    // Cleanup typing indicator when changing conversations
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
    }
  }, [conversationId])

  useEffect(() => {
    if (!url || conversationId === null) {
      setIsConnected(false)
      return
    }

    let cancelled = false
    let socket: WebSocket | null = null
    let retryTimeout: ReturnType<typeof setTimeout> | null = null
    let attempt = 0

    const connect = async () => {
      if (cancelled) return
      try {
        // Issue a short-lived one-time ticket — avoids exposing JWT in URL logs
        const res = await fetch('/api/ws-ticket', { method: 'POST', credentials: 'include' })
        if (!res.ok || cancelled) return
        const { ticket } = await res.json()
        if (cancelled) return

        const wsUrl = `${url}?conversationId=${conversationId}&ticket=${encodeURIComponent(ticket)}`
        socket = new WebSocket(wsUrl)
        socketRef.current = socket

        socket.onopen = () => {
          if (!cancelled) {
            setIsConnected(true)
            attempt = 0 // reset backoff on successful connection
          }
        }

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === "typing") {
              const e = data as TypingEvent
              setTypingUsers(prev => {
                const m = new Map(prev)
                if (e.isTyping) m.set(e.userId, e.name)
                else m.delete(e.userId)
                return m
              })
              return
            }
            if (data.type === "delivered" || data.type === "read") {
              const e = data as ReceiptEvent
              const ids = new Set(e.messageIds)
              setMessages(prev => prev.map(m => {
                if (m.id == null || !ids.has(m.id)) return m
                if (e.type === "delivered") {
                  return { ...m, deliveredAt: m.deliveredAt ?? e.timestamp }
                }
                return {
                  ...m,
                  readAt: m.readAt ?? e.timestamp,
                  deliveredAt: m.deliveredAt ?? e.timestamp,
                }
              }))
              onReceiptRef.current?.(e)
              return
            }
            if (data.type === "call-invite") {
              onCallInviteRef.current?.(data as CallInviteEvent)
              return
            }
            if (data.type === "call-end") {
              onCallEndRef.current?.(data as CallEndEvent)
              return
            }
            const msg = data as ChatMessage
            setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
          } catch { /* ignore parse errors */ }
        }

        socket.onclose = () => {
          if (!cancelled) {
            setIsConnected(false)
            scheduleReconnect()
          }
        }
        socket.onerror = () => {
          if (!cancelled) setIsConnected(false)
          // onclose fires after onerror, so reconnect is handled there
        }
      } catch {
        if (!cancelled) {
          setIsConnected(false)
          scheduleReconnect()
        }
      }
    }

    const scheduleReconnect = () => {
      if (cancelled) return
      // Exponential backoff: 1s, 2s, 4s, 8s, capped at 30s
      const delay = Math.min(1000 * Math.pow(2, attempt), 30_000)
      attempt++
      retryTimeout = setTimeout(connect, delay)
    }

    void connect()

    return () => {
      cancelled = true
      if (retryTimeout) clearTimeout(retryTimeout)
      socket?.close()
      socketRef.current = null
    }
  }, [url, conversationId])

  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && user && conversationId) {
      const event: TypingEvent = {
        type: "typing",
        conversationId,
        userId: user.id,
        name: user.fullName,
        isTyping,
      }
      socketRef.current.send(JSON.stringify(event))
    }
  }, [user, conversationId])

  const sendMessage = useCallback((content: string, imageUrl?: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && user && conversationId) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
        sendTypingIndicator(false)
      }
      const message: ChatMessage = {
        conversationId,
        userId: user.id,
        name: user.fullName,
        content,
        imageUrl: imageUrl || undefined,
        timestamp: Date.now(),
      }
      socketRef.current.send(JSON.stringify(message))
    }
  }, [user, conversationId, sendTypingIndicator])

  // Fire a "read" receipt over the socket so the sender's UI flips
   // to read instantly. Safe to call frequently; the server filters
   // already-read messages.
  const sendReadReceipt = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN && conversationId) {
      socketRef.current.send(JSON.stringify({
        type: "read",
        conversationId,
      }))
    }
  }, [conversationId])

  const handleTyping = useCallback(() => {
    // Only send if we're not already typing (to avoid spam)
    const isCurrentlyTyping = typingTimeoutRef.current !== null
    
    if (!isCurrentlyTyping) {
      sendTypingIndicator(true)
    }
    
    // Clear existing timeout and set new one
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    // Set timeout to stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(false)
      typingTimeoutRef.current = null
    }, 3000)
  }, [sendTypingIndicator])

  return { messages, sendMessage, isConnected, setMessages, typingUsers, handleTyping, sendReadReceipt }
}
