import { NextResponse } from "next/server"
import { getUserFromToken } from "@/lib/jwt-middleware"

const GUARDIAN_KEY = process.env.NEWS_API_KEY || "test"
const CACHE_TTL = 60 * 60 * 1000 // 1 hour in ms

interface GuardianArticle {
  webTitle: string
  webUrl: string
  webPublicationDate: string
  fields?: { headline?: string; trailText?: string; thumbnail?: string }
}

interface NewsItem {
  headline: string
  summary: string
  url: string
  source: string
  publishedAt: string
  thumbnail?: string
  region: "international" | "nigeria"
}

// Simple in-process cache — avoids hammering Guardian on every page load
let cache: { data: NewsItem[]; at: number } | null = null

async function fetchSection(query: string, region: "international" | "nigeria", pageSize: number): Promise<NewsItem[]> {
  const url = query.startsWith("section=")
    ? `https://content.guardianapis.com/search?${query}&show-fields=headline,trailText,thumbnail&order-by=newest&page-size=${pageSize}&api-key=${GUARDIAN_KEY}`
    : `https://content.guardianapis.com/search?q=${encodeURIComponent(query)}&section=fashion&show-fields=headline,trailText,thumbnail&order-by=newest&page-size=${pageSize}&api-key=${GUARDIAN_KEY}`

  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) return []

  const json = await res.json() as { response: { results: GuardianArticle[] } }
  return (json.response?.results ?? []).map((a) => ({
    headline: a.fields?.headline || a.webTitle,
    summary: a.fields?.trailText || "",
    url: a.webUrl,
    source: "The Guardian",
    publishedAt: a.webPublicationDate,
    thumbnail: a.fields?.thumbnail,
    region,
  }))
}

export async function GET() {
  const user = await getUserFromToken()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Serve from cache if fresh
  if (cache && Date.now() - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  try {
    const [international, nigeria] = await Promise.all([
      fetchSection("section=fashion", "international", 10),
      fetchSection("Africa fashion style", "nigeria", 5),
    ])

    const data = [...nigeria, ...international]
    cache = { data, at: Date.now() }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(cache?.data ?? [], { status: cache ? 200 : 500 })
  }
}
