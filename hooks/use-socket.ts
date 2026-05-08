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

    const connect = async () => {
      try {
        // Fetch WS token via API (httpOnly cookie can't be read by JS)
        const res = await fetch('/api/ws-token', { credentials: 'include' })
        if (!res.ok || cancelled) return
        const { token } = await res.json()
        if (cancelled) return

        const wsUrl = `${url}?conversationId=${conversationId}&token=${encodeURIComponent(token)}`
        socket = new WebSocket(wsUrl)
        socketRef.current = socket

        socket.onopen = () => {
          if (!cancelled) setIsConnected(true)
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

        socket.onclose = () => { if (!cancelled) setIsConnected(false) }
        socket.onerror = () => { if (!cancelled) setIsConnected(false) }
      } catch {
        if (!cancelled) setIsConnected(false)
      }
    }

    connect()

    return () => {
      cancelled = true
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
