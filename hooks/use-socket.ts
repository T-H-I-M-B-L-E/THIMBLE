"use client"

import { useEffect, useRef, useState } from "react"

export interface ChatMessage {
  userId: string
  name: string
  content: string
  timestamp: number
}

export function useSocket(url: string | null, user: { id: string; fullName: string } | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!url) {
      setIsConnected(false)
      return
    }

    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.onopen = () => {
      console.log("WebSocket connected")
      setIsConnected(true)
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log("Message received:", data)
        setMessages((prev) => [...prev, data])
      } catch (e) {
        console.error("Failed to parse message:", e)
      }
    }

    socket.onclose = () => {
      console.log("WebSocket disconnected")
      setIsConnected(false)
    }

    return () => {
      socket.close()
    }
  }, [url])

  const sendMessage = (content: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && user) {
      const message: ChatMessage = {
        userId: user.id,
        name: user.fullName,
        content,
        timestamp: Date.now()
      }
      socketRef.current.send(JSON.stringify(message))
    }
  }

  return { messages, sendMessage, isConnected }
}
