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

  // Reset messages when conversation changes
  useEffect(() => {
    setMessages([])
    setTypingUsers(new Map())
  }, [conversationId])

  useEffect(() => {
    if (!url || !conversationId) {
      setIsConnected(false)
      return
    }

    // Append conversationId to WebSocket URL
    const wsUrl = `${url}?conversationId=${conversationId}`
    const socket = new WebSocket(wsUrl)
    socketRef.current = socket

    socket.onopen = () => {
      console.log("WebSocket connected to conversation", conversationId)
      setIsConnected(true)
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        // Handle typing events
        if (data.type === "typing") {
          const typingEvent = data as TypingEvent
          setTypingUsers((prev) => {
            const newMap = new Map(prev)
            if (typingEvent.isTyping) {
              newMap.set(typingEvent.userId, typingEvent.name)
            } else {
              newMap.delete(typingEvent.userId)
            }
            return newMap
          })
          return
        }

        // Handle regular messages
        const msg = data as ChatMessage
        console.log("Message received:", msg)
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      } catch (e) {
        console.error("Failed to parse message:", e)
      }
    }

    socket.onclose = () => {
      setIsConnected(false)
    }

    socket.onerror = (err) => {
      console.error("WebSocket error:", err)
      setIsConnected(false)
    }

    return () => {
      socket.close()
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
      const typingEvent: TypingEvent = {
        type: "typing",
        conversationId,
        userId: user.id,
        name: user.fullName,
        isTyping
      }
      socketRef.current.send(JSON.stringify(typingEvent))
    }
  }, [user, conversationId])

  const handleTyping = useCallback(() => {
    // Send typing start
    sendTypingIndicator(true)
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    // Set new timeout to stop typing after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(false)
    }, 2000)
  }, [sendTypingIndicator])

  return { 
    messages, 
    sendMessage, 
    isConnected, 
    setMessages,
    typingUsers,
    handleTyping
  }
}
