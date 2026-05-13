"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/useAuth"
import { getPostAuthPath } from "@/lib/platform"
import { ArrowRight, ChevronDown, UserPlus, BadgeCheck, Handshake, CreditCard, Award, Users2, Globe } from "lucide-react"

const ROLES = [
  "I'm a Designer",
  "I'm a Model",
  "I'm a Manufacturer",
  "I'm a Photographer",
  "I'm a Fashion Brand",
]

const STEPS = [
  {
    icon: UserPlus,
    num: "01",
    title: "Create Your Profile",
    body: "Sign up and choose your role — designer, model, manufacturer, photographer, or brand. Upload your portfolio, experience, and verification documents.",
  },
  {
    icon: BadgeCheck,
    num: "02",
    title: "Get Verified & Build Trust",
    body: "We verify identities and portfolios to protect every user from scams. A verified badge helps you stand out and attract serious collaborations.",
  },
  {
    icon: Handshake,
    num: "03",
    title: "Discover & Collaborate",
    body: "Browse opportunities, find inspiration from other creatives, post jobs, send offers, and chat safely inside the platform.",
  },
  {
    icon: CreditCard,
    num: "04",
    title: "Pay & Get Paid Securely",
    body: "All payments happen inside Thimble using secure escrow. Money is only released when work is delivered and approved.",
  },
]

export default function HomePage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading || !user) return
    router.push(getPostAuthPath(user))
  }, [user, isLoading, router])

  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#131313]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-[#e6c364]" />
      </div>
    )
  }

  if (user) return null

  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1] font-sans selection:bg-[#e6c364] selection:text-black">

      {/* ── Top Nav ── */}
      <nav className="fixed top-0 w-full z-50 bg-[#131313]/80 backdrop-blur-xl border-b border-white/10">
        <div className="flex justify-between items-center w-full px-6 max-w-[1440px] mx-auto h-20">
          {/* Logo */}
          <div className="font-bodoni text-[32px] leading-[40px] text-[#e6c364] tracking-tighter uppercase">
            Thimble
          </div>

          {/* Nav links */}
          <div className="hidden md:flex gap-12">
            {["Designers", "Models", "Manufacturers", "Brands"].map((label) => (
              <button
                key={label}
                onClick={() => router.push("/auth/signup")}
                className="text-[16px] leading-[24px] font-light uppercase tracking-widest text-[#d0c5b2] hover:text-[#e6c364] transition-colors duration-300"
              >
                {label}
              </button>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push("/auth")}
              className="text-[16px] leading-[24px] font-light text-[#e5e2e1] hover:text-[#e6c364] transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => router.push("/auth/signup")}
              className="bg-[#c9a84c] text-[#503d00] px-8 py-2 text-[12px] leading-[16px] tracking-widest uppercase font-medium hover:opacity-90 transition-opacity"
            >
              Join
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════
          HERO
      ══════════════════════════════ */}
      <section className="relative min-h-screen pt-40 pb-20 px-5 md:px-20 overflow-hidden">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          {/* Left — copy */}
          <div className="lg:col-span-8 z-10">
            <p className="text-[12px] leading-[16px] tracking-[0.3em] font-medium uppercase text-[#e6c364] mb-8">
              The Fashion Creative Platform
            </p>

            <h1 className="font-bodoni text-[32px] md:text-[84px] leading-none md:leading-[92px] tracking-[-0.02em] italic text-[#e5e2e1] mb-8">
              Where fashion <br />
              meets its{" "}
              <span className="editorial-underline italic">own world.</span>
            </h1>

            <p className="text-[18px] leading-[28px] tracking-[0.01em] font-light text-[#d0c5b2] max-w-2xl mb-12">
              Designers, Models, Manufacturers, Photographers and Fashion Brands — all in one trusted platform built to make collaboration easy.
            </p>

            <div className="flex flex-col sm:flex-row gap-6">
              <button
                onClick={() => router.push("/auth/signup")}
                className="bg-[#e6c364] text-black text-[12px] leading-[16px] tracking-widest uppercase font-medium px-10 py-5 flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform"
              >
                Join Thimble — It&apos;s Free
                <ArrowRight className="h-[18px] w-[18px]" />
              </button>
              <button
                onClick={scrollToHowItWorks}
                className="border border-white/20 text-[#e5e2e1] text-[12px] leading-[16px] tracking-widest uppercase font-medium px-10 py-5 flex items-center justify-center gap-3 hover:bg-white/5 transition-colors"
              >
                See How It Works
                <ChevronDown className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>

          {/* Right — editorial image */}
          <div className="lg:col-span-4 relative h-[600px] hidden lg:block">
            <div className="absolute inset-0 border border-white/10 -m-8" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA4_CCd5h6sDfwLgqgT1Kmix2jxMYkAvtPO2Umx69aEQv9VAR_AZA-JxbZKKRHijgJixubRXG8RKP_QDo-DIbyqvPKmibFsaDnmZz5jQz9DSVhdLevD1if588cKK2GerWNojJE4-K5OPHycjm9h4tSFeG1z9vC7j2IOTwqL5DWagu3ER4gwJ9PTDeU-rNk_0QCUBlLnuFc8PHmzzmpY8tCqPFHb7NIeZU9Zx31o4wDo4gvxGZwnqVPMSYm2ooQn0yt1EtbV9wnr8lwJ"
              alt="High-fashion editorial portrait"
              className="w-full h-full object-cover grayscale brightness-75"
            />
            {/* Featured creative card */}
            <div className="absolute -bottom-8 -left-8 bg-[#2a2a2a] border border-white/10 p-6 max-w-[240px]">
              <p className="text-[12px] leading-[16px] tracking-[0.15em] font-medium text-[#e6c364] uppercase mb-2">
                Featured Creative
              </p>
              <p className="font-bodoni text-[20px] text-[#e5e2e1] italic">Elena Von Straten</p>
              <p className="text-[14px] font-light text-[#b4b5b5]">Avant-Garde Designer, Milan</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          ROLE SELECTION
      ══════════════════════════════ */}
      <section className="py-32 border-y border-white/5">
        <div className="max-w-[1440px] mx-auto px-5 md:px-20 text-center">
          <h2 className="text-[12px] leading-[16px] tracking-widest uppercase text-[#d0c5b2] mb-12">
            Who are you on Thimble?
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => router.push("/auth/signup")}
                className="px-8 py-3 rounded-full border border-white/10 text-[16px] font-light text-[#d0c5b2] hover:border-[#e6c364] hover:text-[#e6c364] transition-all"
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          HOW IT WORKS — 4 STEPS
      ══════════════════════════════ */}
      <section id="how-it-works" className="py-32 bg-[#0e0e0e]">
        <div className="max-w-[1440px] mx-auto px-5 md:px-20">
          {/* Header */}
          <div className="text-center mb-24">
            <p className="text-[12px] leading-[16px] tracking-widest uppercase font-medium text-[#e6c364] mb-4">
              The Process
            </p>
            <h2 className="font-bodoni text-[48px] leading-[56px] italic text-[#e5e2e1]">
              How Thimble works in 4 steps
            </h2>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 border border-white/5">
            {STEPS.map((step) => {
              const Icon = step.icon
              return (
                <div
                  key={step.num}
                  className="bg-[#131313] hover:bg-[#1c1b1b] p-12 relative group transition-colors duration-500"
                >
                  {/* Background number */}
                  <span className="font-bodoni text-[120px] leading-none opacity-10 group-hover:opacity-20 transition-opacity italic absolute top-4 right-8 select-none text-[#e5e2e1]">
                    {step.num}
                  </span>

                  <div className="relative z-10">
                    {/* Icon */}
                    <div className="w-12 h-12 flex items-center justify-center bg-[#201f1f] mb-8">
                      <Icon className="h-5 w-5 text-[#e6c364]" />
                    </div>

                    <h3 className="font-bodoni text-[24px] leading-[32px] text-[#e5e2e1] mb-4">
                      {step.title}
                    </h3>
                    <p className="text-[16px] leading-[24px] font-light text-[#d0c5b2]">
                      {step.body}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          FINAL CTA
      ══════════════════════════════ */}
      <section className="relative py-48 overflow-hidden">
        {/* Gold background */}
        <div className="absolute inset-0 z-0 bg-[#c9a84c]" />

        {/* Texture image overlay */}
        <div className="absolute inset-0 z-0 opacity-20 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCtiDwfvP3lBOlf7_6-Of69ifJCg8Ld_5n7oOfqkwHWhv6xiR2WxQHdpeeP0mXa59Snw870PA3Vae6uuCeh6E7gCqYn_YSzostfTKbBTV2Q6RZ1vjN4gbk4FppLBnTQZz2mnJJRtc_-UxU630aKNMaGhKQUX4QPD6YuB0YpQ8kvF8Wjvj2cf99iyo9KnBQJg5Taec5ktUBcEI8EyhhNd2HAFTbqiKzuYEuYKzl_8_N89esQ0JkwOcsQiVQ8EOdIVA8QXkz_2LvBPcCL"
            alt="Fashion studio texture"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="relative z-10 max-w-[1440px] mx-auto px-5 md:px-20 text-center">
          <h2 className="font-bodoni text-[48px] leading-[56px] text-black mb-8">
            Create your free account today
          </h2>
          <p className="text-[18px] leading-[28px] font-light text-black/70 mb-12 max-w-xl mx-auto">
            Join thousands of fashion creatives already collaborating on Thimble.
          </p>
          <button
            onClick={() => router.push("/auth/signup")}
            className="bg-black text-[#e6c364] text-[12px] leading-[16px] tracking-[0.2em] uppercase font-medium px-16 py-6 flex items-center justify-center gap-4 mx-auto hover:scale-105 transition-transform"
          >
            Join Thimble — It&apos;s Free
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#0e0e0e] w-full py-16 border-t border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-start px-5 md:px-20 max-w-[1440px] mx-auto gap-12">
          {/* Brand */}
          <div className="flex flex-col gap-6">
            <div className="font-bodoni text-[48px] leading-[56px] text-[#e6c364] uppercase">Thimble</div>
            <p className="text-[16px] leading-[24px] font-light text-[#d0c5b2] max-w-xs">
              Connecting the global fashion industry through a single, trusted creative ecosystem.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-16">
            <div className="flex flex-col gap-4">
              <p className="text-[12px] tracking-[0.15em] font-medium uppercase text-[#e5e2e1] mb-4">Platform</p>
              {["Designers", "Models", "Manufacturers"].map((l) => (
                <a key={l} href="#" className="text-[16px] font-light text-[#d0c5b2] hover:text-[#e5e2e1] transition-colors">
                  {l}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-4">
              <p className="text-[12px] tracking-[0.15em] font-medium uppercase text-[#e5e2e1] mb-4">Company</p>
              {["About Us", "Careers", "Contact"].map((l) => (
                <a key={l} href="#" className="text-[16px] font-light text-[#d0c5b2] hover:text-[#e5e2e1] transition-colors">
                  {l}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-4">
              <p className="text-[12px] tracking-[0.15em] font-medium uppercase text-[#e5e2e1] mb-4">Legal</p>
              {["Privacy", "Terms"].map((l) => (
                <a key={l} href="#" className="text-[16px] font-light text-[#d0c5b2] hover:text-[#e5e2e1] transition-colors">
                  {l}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="max-w-[1440px] mx-auto px-5 md:px-20 mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[16px] font-light text-[#d0c5b2] opacity-60">
            © {new Date().getFullYear()} Thimble. All rights reserved.
          </p>
          <div className="flex gap-8">
            {[Award, Users2, Globe].map((Icon, i) => (
              <Icon
                key={i}
                className="h-5 w-5 text-[#d0c5b2] hover:text-[#e6c364] cursor-pointer transition-colors"
              />
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
