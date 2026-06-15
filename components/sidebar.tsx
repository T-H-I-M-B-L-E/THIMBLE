"use client"

import { Newspaper, Moon, Sun, ArrowRight, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useTheme } from "@/lib/theme-context"
import { useEffect, useState } from "react"

interface NewsItem {
  headline: string
  url: string
  publishedAt: string
  region: "international" | "nigeria"
}

export function Sidebar() {
  const { theme, toggleTheme } = useTheme()
  const [news, setNews] = useState<NewsItem[]>([])

  useEffect(() => {
    fetch("/api/news", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((d: NewsItem[]) => setNews(Array.isArray(d) ? d.slice(0, 5) : []))
      .catch(() => {})
  }, [])

  return (
    <aside className="hidden lg:flex flex-col w-72 xl:w-80 border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black p-6 xl:p-8 space-y-8 fixed right-0 top-0 h-screen overflow-y-auto">
      {/* Header with theme toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-luxury text-neutral-400">Curated For You</h2>
        <button
          onClick={toggleTheme}
          className="p-2 text-neutral-500 hover:text-black dark:hover:text-white transition-soft"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Fashion News */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-neutral-400" />
            <h3 className="font-serif text-lg tracking-wide">Fashion News</h3>
          </div>
          <Link href="/news" className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-black dark:hover:text-white transition-colors">
            See all
          </Link>
        </div>
        <div className="space-y-4">
          {news.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
            ))
          ) : news.map((item, i) => (
            <a
              key={i}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-light text-sm leading-snug group-hover:text-neutral-500 dark:group-hover:text-neutral-300 transition-colors line-clamp-2">
                  {item.region === "nigeria" ? "🇳🇬 " : "🌍 "}{item.headline}
                </p>
                <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity" />
              </div>
              <p className="text-[10px] font-mono text-neutral-400 mt-1">THE GUARDIAN</p>
            </a>
          ))}
        </div>
        <Link
          href="/news"
          className="mt-4 flex items-center gap-1 text-[11px] text-neutral-400 hover:text-black dark:hover:text-white transition-colors group"
        >
          View all fashion news
          <ArrowRight className="h-3 w-3 -translate-x-1 group-hover:translate-x-0 transition-transform" />
        </Link>
      </div>

      {/* Footer */}
      <div className="text-[10px] text-neutral-400 space-y-4 pt-8 border-t border-neutral-200 dark:border-neutral-800 uppercase tracking-widest mt-auto">
        <p>© 2026 THIMBLE.</p>
        <div className="flex flex-col gap-2">
          <Link href="/about" className="hover:text-black dark:hover:text-white transition-colors w-max">About</Link>
          <Link href="/terms" className="hover:text-black dark:hover:text-white transition-colors w-max">Terms</Link>
          <Link href="/help" className="hover:text-black dark:hover:text-white transition-colors w-max">Help</Link>
        </div>
      </div>
    </aside>
  )
}
