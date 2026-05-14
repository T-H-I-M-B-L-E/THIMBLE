"use client"

import { useEffect, useRef, useState, useCallback } from "react"

export interface ChatMessage {
  id?: number
  conversationId: number
  userId: string
  name: string
  content: string
  timestamp: number
}

export interface TypingEvent {
  type: "typing"
  conversationId: number
  userId: string
  name: string
  isTyping: boolean
}

export function useSocket(
  url: string | null,
  conversationId: number | null,
  user: { id: string; fullName: string } | null
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map())
  const socketRef = useRef<WebSocket | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setMessages([])
    setTypingUsers(new Map())
  }, [conversationId])

  useEffect(() => {
    if (!url || !conversationId) {
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

    connect()

    return () => {
      cancelled = true
      if (retryTimeout) clearTimeout(retryTimeout)
      socket?.close()
      socketRef.current = null
    }
  }, [url, conversationId])

  const sendMessage = useCallback((content: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && user && conversationId) {
      const message: ChatMessage = {
        conversationId,
        userId: user.id,
        name: user.fullName,
        content,
        timestamp: Date.now(),
      }
      socketRef.current.send(JSON.stringify(message))
    }
  }, [user, conversationId])

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

  const handleTyping = useCallback(() => {
    sendTypingIndicator(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => sendTypingIndicator(false), 2000)
  }, [sendTypingIndicator])

  return { messages, sendMessage, isConnected, setMessages, typingUsers, handleTyping }
}
