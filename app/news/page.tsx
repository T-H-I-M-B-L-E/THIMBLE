"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ExternalLink, Loader2, Globe, Newspaper } from "lucide-react"

interface NewsItem {
  headline: string
  summary: string
  url: string
  source: string
  publishedAt: string
  thumbnail?: string
  region: "international" | "nigeria"
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return "just now"
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "nigeria" | "international">("all")

  useEffect(() => {
    fetch("/api/news", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((d: NewsItem[]) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === "all" ? items : items.filter(i => i.region === filter)
  const nigeria = items.filter(i => i.region === "nigeria")
  const intl = items.filter(i => i.region === "international")

  return (
    <DashboardLayout>
      <div className="t-news">
        <div className="t-news-header">
          <div className="t-news-title-row">
            <Newspaper size={20} className="t-news-icon" />
            <h1 className="t-news-title">Fashion News</h1>
          </div>
          <p className="t-news-sub">Today's top stories from the fashion world</p>
        </div>

        {/* Filter tabs */}
        <div className="t-news-tabs">
          {(["all", "nigeria", "international"] as const).map(tab => (
            <button
              key={tab}
              className={`t-news-tab${filter === tab ? " active" : ""}`}
              onClick={() => setFilter(tab)}
            >
              {tab === "nigeria" ? "🇳🇬 Nigeria" : tab === "international" ? "🌍 International" : "All"}
              {tab !== "all" && !loading && (
                <span className="t-news-tab-count">
                  {tab === "nigeria" ? nigeria.length : intl.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="t-news-loading">
            <Loader2 size={22} className="t-news-spinner" />
            <span>Loading latest fashion news…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="t-news-empty">
            <Globe size={36} strokeWidth={1.4} />
            <p>No news available right now.</p>
          </div>
        ) : (
          <div className="t-news-grid">
            {filtered.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="t-news-card"
              >
                {item.thumbnail && (
                  <div className="t-news-card-img">
                    <img src={item.thumbnail} alt="" loading="lazy" />
                  </div>
                )}
                <div className="t-news-card-body">
                  <div className="t-news-card-region">
                    {item.region === "nigeria" ? "🇳🇬 Nigeria" : "🌍 International"}
                  </div>
                  <h2 className="t-news-card-headline">{item.headline}</h2>
                  {item.summary && (
                    <p className="t-news-card-summary">{item.summary}</p>
                  )}
                  <div className="t-news-card-footer">
                    <span className="t-news-card-source">{item.source}</span>
                    <span className="t-news-card-time">{timeAgo(item.publishedAt)}</span>
                    <ExternalLink size={11} className="t-news-card-ext" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
