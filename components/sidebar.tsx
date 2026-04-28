"use client"

import { Heart, MessageCircle, Search, TrendingUp, Moon, Sun } from "lucide-react"
import Link from "next/link"
import { useTheme } from "@/lib/theme-context"

const trendingTopics = [
  { tag: "#MinimalDesign", posts: 12847 },
  { tag: "#SustainableFashion", posts: 8934 },
  { tag: "#ArtisanCraft", posts: 6721 },
  { tag: "#AvantGarde", posts: 5428 },
]

const suggestedAccounts = [
  {
    name: "Harper & Stone Studio",
    username: "@harperandstone",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=48&h=48&fit=crop",
  },
  {
    name: "Luna Designs Co",
    username: "@lunadesigns",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=48&h=48&fit=crop",
  },
  {
    name: "Vibe Collective",
    username: "@vibecollective",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=48&h=48&fit=crop",
  },
]

export function Sidebar() {
  const { theme, toggleTheme } = useTheme()

  return (
    <aside className="hidden lg:flex flex-col w-72 xl:w-80 border-l border-border bg-background/50 p-4 xl:p-6 space-y-6 xl:space-y-8 fixed right-0 top-0 h-screen overflow-y-auto">
      {/* Header with theme toggle */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-xs xl:text-sm font-semibold text-muted-foreground uppercase tracking-wider">Explore</h2>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-secondary transition-colors text-foreground"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search creatives, tags..."
          className="w-full pl-10 pr-4 py-2 rounded-full bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Trending Section */}
      <div>
        <div className="flex items-center gap-2 mb-3 xl:mb-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">What's trending</h3>
        </div>
        <div className="space-y-2 xl:space-y-3">
          {trendingTopics.map((topic) => (
            <Link
              key={topic.tag}
              href="#"
              className="block p-2 xl:p-3 rounded-lg hover:bg-secondary transition-colors group"
            >
              <p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                {topic.tag}
              </p>
              <p className="text-xs text-muted-foreground">{topic.posts.toLocaleString()} posts</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Suggested Accounts */}
      <div>
        <h3 className="font-semibold text-foreground text-sm mb-3 xl:mb-4">Suggested for you</h3>
        <div className="space-y-2 xl:space-y-3">
          {suggestedAccounts.map((account) => (
            <div
              key={account.username}
              className="flex items-center justify-between p-2 xl:p-3 rounded-lg hover:bg-secondary transition-colors"
            >
              <Link href="#" className="flex items-center gap-2 xl:gap-3 flex-1 min-w-0">
                <img
                  src={account.avatar}
                  alt={account.name}
                  className="w-9 h-9 xl:w-10 xl:h-10 rounded-full object-cover flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{account.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{account.username}</p>
                </div>
              </Link>
              <button className="ml-2 px-2.5 xl:px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex-shrink-0">
                Follow
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t border-border">
        <p>© 2026 THIMBLE. All rights reserved.</p>
        <div className="flex gap-3 xl:gap-4 flex-wrap">
          <Link href="#" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="#" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="#" className="hover:text-foreground transition-colors">
            Cookies
          </Link>
        </div>
      </div>
    </aside>
  )
}
