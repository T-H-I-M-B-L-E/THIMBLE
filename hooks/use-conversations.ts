"use client"

import { useEffect, useState } from "react"
import { getApiUrl } from "@/lib/platform"

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
    if (!userId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const apiUrl = getApiUrl(`/api/conversations?userId=${userId}`)
      if (!apiUrl) {
        setConversations([])
        return
      }
      
      const res = await fetch(apiUrl)
      if (!res.ok) throw new Error("Failed to fetch conversations")
      
      const data = await res.json()
      setConversations(data)
    } catch (err) {
      console.error("Failed to fetch conversations:", err)
      setError("Failed to load conversations")
      setConversations([])
    } finally {
      setIsLoading(false)
    }
  }

  const createConversation = async (participants: { userId: string; userName: string; userAvatar: string }[]) => {
    try {
      const apiUrl = getApiUrl("/api/conversations")
      if (!apiUrl) throw new Error("API not configured")
      
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants })
      })
      
      if (!res.ok) throw new Error("Failed to create conversation")
      
      const newConv = await res.json()
      await fetchConversations()
      return newConv
    } catch (err) {
      console.error("Failed to create conversation:", err)
      throw err
    }
  }

  useEffect(() => {
    fetchConversations()
  }, [userId])

  return {
    conversations,
    isLoading,
    error,
    refresh: fetchConversations,
    createConversation
  }
}

export function useMessages(conversationId: number | null, userId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchMessages = async () => {
    if (!conversationId || !userId) {
      setMessages([])
      return
    }
    
    setIsLoading(true)
    
    try {
      const apiUrl = getApiUrl(`/api/conversations/${conversationId}/messages?userId=${userId}`)
      if (!apiUrl) {
        setMessages([])
        return
      }
      
      const res = await fetch(apiUrl)
      if (!res.ok) throw new Error("Failed to fetch messages")
      
      const data = await res.json()
      setMessages(data)
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

  return {
    messages,
    isLoading,
    refresh: fetchMessages,
    setMessages
  }
}
