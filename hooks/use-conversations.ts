"use client"

import { useEffect, useState } from "react"

export interface ConversationParticipant {
  id: number
  conversationId: number
  userId: string
  userName: string
  userAvatar: string
  joinedAt: string
}

export interface Message {
  id: number
  conversationId: number
  userId: string
  name: string
  content: string
  timestamp: number
}

export interface Conversation {
  id: number
  participants: ConversationParticipant[]
  lastMessage?: Message
  updatedAt: string
}

export function useConversations(userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConversations = async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/conversations?userId=${userId}`, { credentials: 'include' })
      if (!res.ok) throw new Error("Failed to fetch conversations")
      const data = await res.json()
      setConversations(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Failed to fetch conversations:", err)
      setError("Failed to load conversations")
      setConversations([])
    } finally {
      setIsLoading(false)
    }
  }

  const createConversation = async (participants: { userId: string; userName: string; userAvatar: string }[]) => {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ participants }),
    })
    if (!res.ok) throw new Error("Failed to create conversation")
    const newConv = await res.json()
    await fetchConversations()
    return newConv
  }

  useEffect(() => {
    fetchConversations()
  }, [userId])

  return { conversations, isLoading, error, refresh: fetchConversations, createConversation }
}

export function useMessages(conversationId: number | null, userId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchMessages = async () => {
    if (!conversationId || !userId) { setMessages([]); return }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, { credentials: 'include' })
      if (!res.ok) throw new Error("Failed to fetch messages")
      const data = await res.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Failed to fetch messages:", err)
      setMessages([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [conversationId, userId])

  return { messages, isLoading, refresh: fetchMessages, setMessages }
}
