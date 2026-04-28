"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Send } from "lucide-react"
import { useState, use } from "react"

const mockConversations = [
  {
    id: "1",
    name: "Luxe Brand Co",
    role: "Brand",
    lastMessage: "We love your portfolio! Are you available next week?",
    time: "2h ago",
    unread: true,
  },
  {
    id: "2",
    name: "Elena Designs",
    role: "Designer",
    lastMessage: "Can you send over the final shots from our last shoot?",
    time: "5h ago",
    unread: false,
  },
  {
    id: "3",
    name: "Premium Textiles",
    role: "Manufacturer",
    lastMessage: "Your order is ready for shipment.",
    time: "1d ago",
    unread: false,
  },
]

export default function MessagesPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = use(params)
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState("")

  return (
    <DashboardLayout role={role}>
      <div className="h-[calc(100vh-8rem)] border border-neutral-200 dark:border-neutral-800">
        <div className="grid md:grid-cols-3 h-full">
          {/* Conversations List */}
          <div className="border-r border-neutral-200 dark:border-neutral-800">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
              <h2 className="font-medium mb-3">Messages</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Search messages..."
                  className="pl-10 rounded-none border-neutral-300"
                />
              </div>
            </div>
            <div className="overflow-y-auto">
              {mockConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedChat(conv.id)}
                  className={`w-full p-4 flex items-start gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 text-left ${
                    selectedChat === conv.id ? "bg-neutral-50 dark:bg-neutral-900" : ""
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-medium text-sm truncate">{conv.name}</p>
                      <span className="text-xs text-neutral-400">{conv.time}</span>
                    </div>
                    <p className="text-xs text-neutral-500 truncate">{conv.lastMessage}</p>
                  </div>
                  {conv.unread && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="md:col-span-2 flex flex-col">
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                  <div>
                    <p className="font-medium">
                      {mockConversations.find((c) => c.id === selectedChat)?.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {mockConversations.find((c) => c.id === selectedChat)?.role}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 p-4 overflow-y-auto">
                  <div className="space-y-4">
                    <div className="flex justify-start">
                      <div className="bg-neutral-100 dark:bg-neutral-900 px-4 py-2 max-w-[70%]">
                        <p className="text-sm">Hi! We came across your profile and love your work.</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-black text-white px-4 py-2 max-w-[70%]">
                        <p className="text-sm">Thank you! I&apos;d love to hear more about the opportunity.</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-neutral-100 dark:bg-neutral-900 px-4 py-2 max-w-[70%]">
                        <p className="text-sm">We have a campaign coming up next week. Are you available?</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Input */}
                <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      className="rounded-none border-neutral-300"
                    />
                    <Button className="rounded-none bg-black text-white px-4">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
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
