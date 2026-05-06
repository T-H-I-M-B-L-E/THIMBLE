"use client"

import { useEffect, useRef, useState, useCallback } from "react"

export interface ChatMessage {
  userId: string
  name: string
  content: string
  timestamp: number
}

const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_ATTEMPTS = 5

export function useSocket(url: string | null, user: { id: string; fullName: string } | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const attemptsRef = useRef(0)
  const unmountedRef = useRef(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (!url || unmountedRef.current) return

    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.onopen = () => {
      attemptsRef.current = 0
      setIsConnected(true)
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ChatMessage
        setMessages((prev) => [...prev, data])
      } catch {
        // ignore malformed messages
      }
    }

    socket.onclose = () => {
      setIsConnected(false)
      if (unmountedRef.current) return
      if (attemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        attemptsRef.current += 1
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }

    socket.onerror = () => {
      socket.close()
    }
  }, [url])

  useEffect(() => {
    unmountedRef.current = false

    if (!url) {
      setIsConnected(false)
      return
    }

    connect()

    return () => {
      unmountedRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      socketRef.current?.close()
    }
  }, [url, connect])

  const sendMessage = (content: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && user) {
      const message: ChatMessage = {
        userId: user.id,
        name: user.fullName,
        content,
        timestamp: Date.now(),
      }
      socketRef.current.send(JSON.stringify(message))
    }
  }

  return { messages, sendMessage, isConnected }
}
