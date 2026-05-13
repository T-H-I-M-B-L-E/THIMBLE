"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/useAuth"
import { getPostAuthPath } from "@/lib/platform"
import { Search, ArrowRight } from "lucide-react"
import { useState } from "react"

const ROLES = ["Designer", "Model", "Photographer", "Manufacturer", "Brand"]

const FEATURED = ["Vogue", "Highsnobiety", "SSENSE", "Dover St. Market", "pattern", "LVMH", "maude"]

export default function HomePage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (isLoading || !user) return
    router.push(getPostAuthPath(user))
  }, [user, isLoading, router])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push("/auth/signup")
  }

  // While checking auth for an authenticated user, show nothing (will redirect)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
      </div>
    )
  }

  if (user) return null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(145deg, #080808 0%, #16120a 50%, #0c0c0c 100%)" }}>
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 15% 55%, #C9A84C 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 85% 15%, #ffffff 0%, transparent 60%)",
        }}
      />

      {/* ── Navbar ── */}
      <nav className="relative z-20 flex items-center justify-between px-6 md:px-12 lg:px-16 py-5">
        <span className="text-white font-light tracking-[0.35em] text-lg select-none">THIMBLE</span>

        <div className="hidden md:flex items-center gap-8 text-sm text-neutral-400">
          <button onClick={() => router.push("/auth/signup")} className="hover:text-white transition-colors">
            Gigs
          </button>
          <button onClick={() => router.push("/auth/signup")} className="hover:text-white transition-colors">
            Creatives
          </button>
          <button onClick={() => router.push("/auth/signup")} className="hover:text-white transition-colors">
            Collections
          </button>
          <button onClick={() => router.push("/auth/signup")} className="hover:text-white transition-colors">
            Learn
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/auth")}
            className="text-sm text-neutral-400 hover:text-white transition-colors px-3 py-2 hidden sm:block"
          >
            Sign In
          </button>
          <button
            onClick={() => router.push("/auth/signup")}
            className="text-sm bg-white text-black font-medium px-5 py-2 hover:bg-neutral-100 transition-colors"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-16 pt-6 pb-20 md:pt-10 md:pb-28">
        <div className="max-w-5xl">
          {/* Headline */}
          <h1 className="text-[clamp(2.8rem,8vw,6.5rem)] font-bold text-white leading-[1.03] mb-6 tracking-tight">
            Find your<br />
            fashion{" "}
            <span className="relative inline-block whitespace-nowrap">
              career.
              {/* Gold oval underline — matches Parallel's lime oval treatment */}
              <svg
                aria-hidden="true"
                className="absolute -bottom-3 left-0 w-full"
                viewBox="0 0 260 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <ellipse cx="130" cy="14" rx="127" ry="10" stroke="#C9A84C" strokeWidth="3" fill="none" />
              </svg>
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-neutral-400 leading-relaxed mb-10 max-w-lg">
            Instantly match with designers, models, photographers, and brands to find the work that was made for you.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex items-stretch max-w-2xl mb-8 shadow-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search gigs, creatives, collections..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-14 pl-11 pr-4 bg-white text-neutral-900 placeholder:text-neutral-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
              />
            </div>
            <button
              type="submit"
              className="h-14 px-6 md:px-8 bg-[#C9A84C] text-black font-semibold text-sm flex items-center gap-2 hover:bg-[#b8963e] transition-colors whitespace-nowrap shrink-0"
            >
              Search <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Role filter chips */}
          <div className="flex flex-wrap gap-2">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => router.push("/auth/signup")}
                className="text-xs text-neutral-300 border border-neutral-600 rounded-full px-4 py-1.5 hover:border-neutral-300 hover:bg-white/5 transition-all"
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Brand strip ── */}
      <div className="relative z-10 border-t border-neutral-800/60 px-6 md:px-12 lg:px-16 py-6">
        <div className="flex items-center gap-8 md:gap-14 overflow-x-auto no-scrollbar">
          <span className="text-[10px] uppercase tracking-widest text-neutral-600 shrink-0">Featured on</span>
          {FEATURED.map((name) => (
            <span
              key={name}
              className="text-sm md:text-base font-medium text-neutral-500 whitespace-nowrap shrink-0 hover:text-neutral-300 transition-colors cursor-default"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
