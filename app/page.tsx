"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/useAuth"
import { getPostAuthPath } from "@/lib/platform"
import { ArrowRight, BadgeCheck, Users, Handshake, ShieldCheck, ChevronDown } from "lucide-react"

const ROLES = [
  { label: "I'm a Designer", value: "designer" },
  { label: "I'm a Model", value: "model" },
  { label: "I'm a Manufacturer", value: "manufacturer" },
  { label: "I'm a Photographer", value: "photographer" },
  { label: "I'm a Fashion Brand", value: "brand" },
]

const STEPS = [
  {
    number: "01",
    icon: Users,
    title: "Create Your Profile",
    body: "Sign up and choose your role — designer, model, manufacturer, photographer, or brand. Upload your portfolio, experience, and verification documents.",
  },
  {
    number: "02",
    icon: BadgeCheck,
    title: "Get Verified & Build Trust",
    body: "We verify identities and portfolios to protect every user from scams. A verified badge helps you stand out and attract serious collaborations.",
  },
  {
    number: "03",
    icon: Handshake,
    title: "Discover & Collaborate",
    body: "Browse opportunities, find inspiration from other creatives, post jobs, send offers, and chat safely inside the platform.",
    examples: [
      "Designers & brands find manufacturers",
      "Brands book models and photographers",
      "Creatives join real fashion projects",
    ],
  },
  {
    number: "04",
    icon: ShieldCheck,
    title: "Pay & Get Paid Securely",
    body: "All payments happen inside Thimble using secure escrow. Money is only released when work is delivered and approved.",
    footnote: "No scams. No ghosting. No stress.",
  },
]

export default function HomePage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [activeRole, setActiveRole] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading || !user) return
    router.push(getPostAuthPath(user))
  }, [user, isLoading, router])

  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
      </div>
    )
  }

  if (user) return null

  return (
    <div className="min-h-screen flex flex-col bg-[#080808] text-white">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-30 flex items-center justify-between px-6 md:px-12 lg:px-16 py-4 bg-[#080808]/90 backdrop-blur-md border-b border-white/5">
        <span className="text-white font-light tracking-[0.35em] text-lg select-none">THIMBLE</span>
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
            Join Free
          </button>
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section className="relative flex flex-col justify-center min-h-[90vh] px-6 md:px-12 lg:px-16 pt-12 pb-20 overflow-hidden">

        {/* Ambient background glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 70% 55% at 10% 60%, rgba(201,168,76,0.12) 0%, transparent 65%), radial-gradient(ellipse 50% 60% at 90% 15%, rgba(255,255,255,0.04) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 max-w-4xl">
          {/* Eyebrow */}
          <p className="text-xs uppercase tracking-[0.3em] text-[#C9A84C] mb-6 font-medium">
            The Fashion Creative Platform
          </p>

          {/* Headline */}
          <h1 className="text-[clamp(2.6rem,7.5vw,6rem)] font-bold leading-[1.04] tracking-tight mb-6">
            Where fashion<br />
            meets its own{" "}
            <span className="relative inline-block whitespace-nowrap">
              world.
              <svg
                aria-hidden="true"
                className="absolute -bottom-3 left-0 w-full"
                viewBox="0 0 200 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <ellipse cx="100" cy="12" rx="97" ry="9" stroke="#C9A84C" strokeWidth="2.5" fill="none" />
              </svg>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base md:text-lg text-neutral-400 leading-relaxed mb-10 max-w-xl">
            Designers, Models, Manufacturers, Photographers and Fashion Brands — all in one trusted platform built to make collaboration easy.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 items-center">
            <button
              onClick={() => router.push("/auth/signup")}
              className="flex items-center gap-2 h-14 px-8 bg-[#C9A84C] text-black font-semibold text-sm hover:bg-[#b8963e] transition-colors"
            >
              Join Thimble — It&apos;s Free <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={scrollToHowItWorks}
              className="flex items-center gap-2 h-14 px-8 border border-neutral-600 text-white text-sm font-medium hover:border-neutral-400 hover:bg-white/5 transition-all"
            >
              See How It Works <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-30">
          <div className="w-px h-10 bg-white animate-pulse" />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          MINI ROLE SELECTOR
      ══════════════════════════════════════════ */}
      <section className="border-y border-white/8 bg-[#0d0d0d] px-6 md:px-12 lg:px-16 py-14">
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500 mb-6 text-center">Who are you on Thimble?</p>
        <div className="flex flex-wrap justify-center gap-3">
          {ROLES.map((role) => (
            <button
              key={role.value}
              onClick={() => {
                setActiveRole(role.value)
                router.push("/auth/signup")
              }}
              className={`text-sm px-6 py-3 rounded-full border transition-all duration-200 ${
                activeRole === role.value
                  ? "border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]"
                  : "border-neutral-700 text-neutral-300 hover:border-neutral-400 hover:bg-white/5"
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS — 4 STEPS
      ══════════════════════════════════════════ */}
      <section id="how-it-works" className="px-6 md:px-12 lg:px-16 py-20 md:py-28">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.3em] text-[#C9A84C] mb-3 font-medium">The Process</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
            How Thimble works<br className="hidden md:block" /> in 4 steps
          </h2>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <div
                key={i}
                className="group relative border border-neutral-800 bg-[#0d0d0d] p-8 hover:border-neutral-600 transition-all duration-300"
              >
                {/* Step number */}
                <span className="text-[4rem] font-bold text-white/5 leading-none select-none absolute top-6 right-8 group-hover:text-white/8 transition-colors">
                  {step.number}
                </span>

                {/* Icon */}
                <div className="mb-5 inline-flex items-center justify-center w-11 h-11 border border-[#C9A84C]/30 bg-[#C9A84C]/8">
                  <Icon className="h-5 w-5 text-[#C9A84C]" />
                </div>

                <h3 className="text-lg font-semibold mb-3 tracking-tight">{step.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed mb-4">{step.body}</p>

                {/* Examples (step 3) */}
                {step.examples && (
                  <ul className="space-y-1.5 mb-2">
                    {step.examples.map((ex) => (
                      <li key={ex} className="flex items-start gap-2 text-xs text-neutral-500">
                        <span className="text-[#C9A84C] mt-0.5 shrink-0">›</span>
                        {ex}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Footnote (step 4) */}
                {step.footnote && (
                  <p className="text-xs text-[#C9A84C] font-medium mt-3">{step.footnote}</p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════ */}
      <section className="bg-[#C9A84C] px-6 md:px-12 lg:px-16 py-20 md:py-24 text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black tracking-tight mb-4 max-w-2xl mx-auto leading-tight">
          Create your free account today
        </h2>
        <p className="text-black/60 text-base mb-10 max-w-md mx-auto">
          Join thousands of fashion creatives already collaborating on Thimble.
        </p>
        <button
          onClick={() => router.push("/auth/signup")}
          className="inline-flex items-center gap-2 h-14 px-10 bg-black text-white font-semibold text-sm hover:bg-neutral-900 transition-colors"
        >
          Join Thimble — It&apos;s Free <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6 md:px-12 lg:px-16 py-8 bg-[#080808]">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-white font-light tracking-[0.35em] text-sm select-none">THIMBLE</span>
          <p className="text-xs text-neutral-600 text-center">
            &copy; {new Date().getFullYear()} Thimble. The fashion creative platform.
          </p>
          <div className="flex gap-5 text-xs text-neutral-600">
            <button onClick={() => router.push("/auth")} className="hover:text-neutral-400 transition-colors">Sign In</button>
            <button onClick={() => router.push("/auth/signup")} className="hover:text-neutral-400 transition-colors">Sign Up</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
