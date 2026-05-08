"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Send, Circle, ArrowLeft, Plus, User } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useParams } from "next/navigation"
import { useSocket } from "@/hooks/use-socket"
import { useConversations, useMessages } from "@/hooks/use-conversations"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { getWebSocketUrl } from "@/lib/platform"
import Image from "next/image"

export default function MessagesPage() {
  const params = useParams()
  const role = params.role as string
  const { user } = useStore()
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null)
  const [messageInput, setMessageInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const websocketUrl = getWebSocketUrl() ? `${getWebSocketUrl()}/ws` : null
  
  // Fetch real conversations
  const { conversations, isLoading: isLoadingConversations, refresh: refreshConversations } = useConversations(user?.id)
  
  // Get selected conversation details
  const selectedConversation = conversations.find((c: { id: number }) => c.id === selectedConversationId)
  
  // Fetch messages for selected conversation
  const { messages: apiMessages, isLoading: isLoadingMessages, setMessages: setApiMessages } = useMessages(selectedConversationId, user?.id)
  
  // WebSocket for real-time messages
  const { messages: wsMessages, sendMessage, isConnected, typingUsers, handleTyping } = useSocket(
    websocketUrl,
    selectedConversationId,
    user
  )

  // Merge API messages with WebSocket messages
  const allMessages = [...apiMessages, ...wsMessages].sort((a, b) => a.timestamp - b.timestamp)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [allMessages])

  const handleSend = () => {
    if (messageInput.trim()) {
      sendMessage(messageInput)
      setMessageInput("")
    }
  }

  // Get other participant's info for display
  const getOtherParticipant = (conversation: typeof selectedConversation) => {
    if (!conversation || !user) return null
    return conversation.participants.find((p: { userId: string }) => p.userId !== user.id)
  }

  const formatTime = (timestamp: string | number) => {
    const date = new Date(typeof timestamp === 'string' ? timestamp : timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <DashboardLayout role={role}>
      <div className="t-messages">
        <div className="flex h-full overflow-hidden">
          {/* Conversations List */}
          <div className={cn(
            "t-msg-list flex flex-col",
            selectedConversationId ? "hidden md:flex" : "flex"
          )}>
            <div style={{ padding: "14px", borderBottom: "1px solid var(--t-line)" }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-medium">Messages</h2>
                <div className="flex items-center gap-2">
                  <Circle className={`h-2 w-2 fill-current ${isConnected ? "text-green-500" : "text-red-500"}`} />
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400">
                    {isConnected ? "Live" : "Offline"}
                  </span>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Search messages..."
                  className="pl-10 rounded-none border-neutral-300"
                />
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1">
              {isLoadingConversations ? (
                <div className="p-4 text-center text-neutral-400 text-sm">Loading...</div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-center text-neutral-400 text-sm">
                  No conversations yet
                </div>
              ) : (
                conversations.map((conv) => {
                  const otherParticipant = getOtherParticipant(conv)
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={`w-full p-4 flex items-start gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 text-left transition-colors ${
                        selectedConversationId === conv.id ? "bg-neutral-50 dark:bg-neutral-900" : ""
                      }`}
                    >
                      <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-neutral-200 dark:bg-neutral-800">
                        {otherParticipant?.userAvatar ? (
                          <Image
                            src={otherParticipant.userAvatar}
                            alt={otherParticipant.userName}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <User className="h-5 w-5 m-auto text-neutral-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-medium text-sm truncate">
                            {otherParticipant?.userName || "Unknown"}
                          </p>
                          <span className="text-[10px] text-neutral-400 uppercase">
                            {conv.lastMessage ? formatTime(conv.lastMessage.timestamp) : formatTime(conv.updatedAt)}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 truncate">
                          {conv.lastMessage?.content || "No messages yet"}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={cn(
            "flex-1 flex flex-col min-w-0",
            !selectedConversationId ? "hidden md:flex" : "flex"
          )}>
            {selectedConversationId && selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setSelectedConversationId(null)}
                    className="md:hidden mr-1"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
                    {(() => {
                      const other = getOtherParticipant(selectedConversation)
                      return other?.userAvatar ? (
                        <Image
                          src={other.userAvatar}
                          alt={other.userName}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 m-auto text-neutral-400" />
                      )
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {getOtherParticipant(selectedConversation)?.userName || "Unknown"}
                    </p>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">
                      {(() => {
                        const other = getOtherParticipant(selectedConversation)
                        if (!other) return isConnected ? "Online" : "Offline"
                        const isTyping = typingUsers.has(other.userId)
                        return isTyping ? "typing..." : (isConnected ? "Online" : "Offline")
                      })()}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto bg-neutral-50/50 dark:bg-neutral-900/20">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full text-neutral-400 text-sm">
                      Loading messages...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {allMessages.length === 0 && (
                        <div className="text-center py-8 text-neutral-400 text-sm">
                          No messages yet. Say hello!
                        </div>
                      )}
                      {allMessages.map((msg) => (
                        <div key={`${msg.id}-${msg.timestamp}`} className={`flex ${msg.userId === user?.id ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[70%] px-4 py-2 ${
                            msg.userId === user?.id 
                              ? "bg-black text-white rounded-l-lg rounded-tr-lg" 
                              : "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-r-lg rounded-tl-lg"
                          }`}>
                            {msg.userId !== user?.id && (
                              <p className="text-[10px] font-medium mb-1 text-neutral-400 uppercase tracking-wider">{msg.name}</p>
                            )}
                            <p className="text-sm">{msg.content}</p>
                            <p className={`text-[9px] mt-1 text-right ${msg.userId === user?.id ? "text-white/50" : "text-neutral-400"}`}>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex gap-2"
                  >
                    <Input
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => {
                        setMessageInput(e.target.value)
                        handleTyping()
                      }}
                      className="rounded-none border-neutral-300 focus:border-black transition-soft"
                      disabled={!isConnected}
                    />
                    <Button 
                      type="submit"
                      disabled={!isConnected || !messageInput.trim()}
                      className="rounded-none bg-black text-white px-4 hover:bg-neutral-800 transition-soft"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 p-8">
                <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
                  <Send className="h-6 w-6" />
                </div>
                <p className="text-lg font-medium mb-2">Your Messages</p>
                <p className="text-sm text-center max-w-xs">
                  Select a conversation to start messaging, or create a new one to connect with others.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
