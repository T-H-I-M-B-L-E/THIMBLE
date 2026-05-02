"use client"

import { Heart, MessageCircle, Search, TrendingUp, Moon, Sun, ArrowRight } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
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
    <aside className="hidden lg:flex flex-col w-72 xl:w-80 border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black p-6 xl:p-8 space-y-10 fixed right-0 top-0 h-screen overflow-y-auto">
      {/* Header with theme toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-luxury text-neutral-400">Curated For You</h2>
        <button
          onClick={toggleTheme}
          className="p-2 text-neutral-500 hover:text-black dark:hover:text-white transition-soft"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Search - Minimalist */}
      <div className="relative border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <input
          type="text"
          placeholder="DISCOVER..."
          className="w-full pl-8 py-2 bg-transparent text-foreground text-xs uppercase tracking-[0.2em] placeholder:text-neutral-500 focus:outline-none"
        />
      </div>

      {/* Trending Section */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="h-4 w-4 text-neutral-400" />
          <h3 className="font-serif text-lg tracking-wide">The Zeitgeist</h3>
        </div>
        <div className="space-y-4">
          {trendingTopics.map((topic) => (
            <Link
              key={topic.tag}
              href="#"
              className="block group"
            >
              <div className="flex items-center justify-between">
                <p className="font-light text-sm group-hover:text-neutral-500 transition-colors">
                  {topic.tag}
                </p>
                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 transition-transform duration-500" />
              </div>
              <p className="text-[10px] font-mono text-neutral-400 mt-1">{topic.posts.toLocaleString()} EDITOR PICKS</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Suggested Accounts */}
      <div>
        <h3 className="font-serif text-lg tracking-wide mb-6">Voices to Follow</h3>
        <div className="space-y-6">
          {suggestedAccounts.map((account) => (
            <div
              key={account.username}
              className="flex items-center justify-between group"
            >
              <Link href="#" className="flex items-center gap-4 flex-1 min-w-0">
                <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-neutral-100 dark:border-neutral-900">
                  <Image
                    src={account.avatar}
                    alt={account.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{account.name}</p>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-widest truncate mt-0.5">{account.username}</p>
                </div>
              </Link>
              <button className="ml-2 text-[10px] uppercase tracking-[0.2em] font-medium border-b border-transparent hover:border-black dark:hover:border-white pb-0.5 transition-colors">
                Follow
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-[10px] text-neutral-400 space-y-4 pt-8 border-t border-neutral-200 dark:border-neutral-800 uppercase tracking-widest mt-auto">
        <p>© 2026 THIMBLE.</p>
        <div className="flex flex-col gap-2">
          <Link href="#" className="hover:text-black dark:hover:text-white transition-colors w-max">
            Manifesto
          </Link>
          <Link href="#" className="hover:text-black dark:hover:text-white transition-colors w-max">
            Privacy Policy
          </Link>
          <Link href="#" className="hover:text-black dark:hover:text-white transition-colors w-max">
            Brand Guidelines
          </Link>
        </div>
      </div>
    </aside>
  )
}
