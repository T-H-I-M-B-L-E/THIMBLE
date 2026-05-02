"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Send, Circle, ArrowLeft } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useParams } from "next/navigation"
import { useSocket } from "@/hooks/use-socket"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { getWebSocketUrl } from "@/lib/platform"

const mockConversations = [
  {
    id: "1",
    name: "Luxe Brand Co",
    role: "Brand",
    lastMessage: "We love your portfolio! Are you available next week?",
    time: "2h ago",
    unread: true,
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop"
  },
  {
    id: "2",
    name: "Elena Designs",
    role: "Designer",
    lastMessage: "Can you send over the final shots from our last shoot?",
    time: "5h ago",
    unread: false,
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop"
  },
  {
    id: "3",
    name: "Premium Textiles",
    role: "Manufacturer",
    lastMessage: "Your order is ready for shipment.",
    time: "1d ago",
    unread: false,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop"
  },
]

export default function MessagesPage() {
  const params = useParams()
  const role = params.role as string
  const { user } = useStore()
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const websocketUrl = getWebSocketUrl() ? `${getWebSocketUrl()}/ws` : null
  
  const { messages, sendMessage, isConnected } = useSocket(websocketUrl, user)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (messageInput.trim()) {
      sendMessage(messageInput)
      setMessageInput("")
    }
  }

  return (
    <DashboardLayout role={role}>
      <div className="h-[calc(100vh-8rem)] border border-neutral-200 dark:border-neutral-800">
        <div className="flex h-full overflow-hidden">
          {/* Conversations List */}
          <div className={cn(
            "w-full md:w-1/3 border-r border-neutral-200 dark:border-neutral-800 flex flex-col",
            selectedChat ? "hidden md:flex" : "flex"
          )}>
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-medium">Messages</h2>
                <div className="flex items-center gap-1">
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
              {mockConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedChat(conv.id)}
                  className={`w-full p-4 flex items-start gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 text-left transition-colors ${
                    selectedChat === conv.id ? "bg-neutral-50 dark:bg-neutral-900" : ""
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-900 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-medium text-sm truncate">{conv.name}</p>
                      <span className="text-[10px] text-neutral-400 uppercase">{conv.time}</span>
                    </div>
                    <p className="text-xs text-neutral-500 truncate">{conv.lastMessage}</p>
                  </div>
                  {conv.unread && (
                    <div className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white flex-shrink-0 mt-2" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className={cn(
            "flex-1 flex flex-col min-w-0",
            !selectedChat ? "hidden md:flex" : "flex"
          )}>
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setSelectedChat(null)}
                    className="md:hidden mr-1"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-900" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {mockConversations.find((c) => c.id === selectedChat)?.name}
                    </p>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">
                      {mockConversations.find((c) => c.id === selectedChat)?.role}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto bg-neutral-50/50 dark:bg-neutral-900/20">
                  <div className="space-y-4">
                    {messages.length === 0 && (
                      <div className="text-center py-8 text-neutral-400 text-sm">
                        No messages yet. Say hello!
                      </div>
                    )}
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.userId === user?.id ? "justify-end" : "justify-start"}`}>
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
                      onChange={(e) => setMessageInput(e.target.value)}
                      className="rounded-none border-neutral-300 focus:border-black transition-soft"
                    />
                    <Button 
                      type="submit"
                      disabled={!isConnected}
                      className="rounded-none bg-black text-white px-4 hover:bg-neutral-800 transition-soft"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-neutral-400">
                <p>Select a conversation to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
