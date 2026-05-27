'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, BadgeCheck, Users, Handshake, ShieldCheck } from 'lucide-react'

const VALUES = [
  {
    icon: Users,
    title: 'Built for the industry',
    body: 'Thimble is designed specifically for fashion — not adapted from a general-purpose platform. Every feature, every role, every workflow was built with the creative process in mind.',
  },
  {
    icon: BadgeCheck,
    title: 'Trust through verification',
    body: 'We verify identities and portfolios so every person you collaborate with on Thimble is who they say they are. No fake profiles, no scam accounts.',
  },
  {
    icon: Handshake,
    title: 'Collaboration without friction',
    body: 'From the first message to the final deliverable, everything happens inside Thimble. No chasing people across apps, no lost threads, no miscommunication.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by design',
    body: 'Payments are held in escrow and only released when work is approved. Your money, your work, and your data are protected at every step.',
  },
]

export default function AboutPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-md px-6 md:px-12 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-sm">
          <ArrowLeft size={15} /> Back
        </button>
        <span className="text-white font-light tracking-[0.35em] text-base select-none">THIMBLE</span>
        <div className="w-16" />
      </nav>

      <div className="max-w-3xl mx-auto px-6 md:px-12 py-20">

        {/* Header */}
        <p className="text-xs uppercase tracking-[0.3em] text-[#C9A84C] mb-4 font-medium">About</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
          The fashion creative<br />platform
        </h1>
        <p className="text-neutral-400 text-lg leading-relaxed mb-16 max-w-2xl">
          Thimble is where the fashion industry works. Designers, models, manufacturers, photographers, and brands come together on one trusted platform built to make collaboration real.
        </p>

        {/* Story */}
        <div className="border-l-2 border-[#C9A84C]/30 pl-8 mb-20 space-y-5">
          <p className="text-neutral-300 leading-relaxed">
            Fashion is one of the most collaborative industries in the world, yet it runs on DMs, WhatsApp chains, and cold emails. Creatives get ghosted. Brands get scammed. Payments go missing. Good work goes unrewarded because there was no structure around it.
          </p>
          <p className="text-neutral-300 leading-relaxed">
            Thimble was built to fix that. We created a single place where every role in the fashion ecosystem — designers, models, manufacturers, photographers, and brands — can find each other, communicate, collaborate, and transact safely.
          </p>
          <p className="text-neutral-300 leading-relaxed">
            Verification means you know who you're working with. Escrow payments mean no one gets burned. Everything in one platform means nothing gets lost.
          </p>
        </div>

        {/* Values */}
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 mb-10 font-medium">What we stand for</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
          {VALUES.map((v) => {
            const Icon = v.icon
            return (
              <div key={v.title} className="border border-neutral-800 bg-[#0d0d0d] p-7 hover:border-neutral-600 transition-colors">
                <div className="mb-4 inline-flex items-center justify-center w-10 h-10 border border-[#C9A84C]/30 bg-[#C9A84C]/8">
                  <Icon size={18} className="text-[#C9A84C]" />
                </div>
                <h3 className="text-base font-semibold mb-2">{v.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{v.body}</p>
              </div>
            )
          })}
        </div>

        {/* Roles */}
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 mb-6 font-medium">Who Thimble is for</p>
        <div className="flex flex-wrap gap-3 mb-20">
          {['Designers', 'Models', 'Manufacturers', 'Photographers', 'Fashion Brands'].map(r => (
            <span key={r} className="text-sm px-5 py-2.5 border border-neutral-700 text-neutral-300 rounded-full">{r}</span>
          ))}
        </div>

        {/* CTA */}
        <div className="border border-[#C9A84C]/20 bg-[#C9A84C]/5 p-10 text-center">
          <h2 className="text-2xl font-bold mb-3">Ready to join?</h2>
          <p className="text-neutral-400 text-sm mb-7">Create a free account and start collaborating with the fashion industry.</p>
          <button
            onClick={() => router.push('/auth/signup')}
            className="h-12 px-8 bg-[#C9A84C] text-black font-semibold text-sm hover:bg-[#b8963e] transition-colors"
          >
            Join Thimble — It&apos;s Free
          </button>
        </div>

      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 md:px-12 py-8 mt-10">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-white font-light tracking-[0.35em] text-sm select-none">THIMBLE</span>
          <p className="text-xs text-neutral-600">&copy; {new Date().getFullYear()} Thimble. All rights reserved.</p>
          <div className="flex gap-5 text-xs text-neutral-600">
            <button onClick={() => router.push('/help')} className="hover:text-neutral-400 transition-colors">Help</button>
            <button onClick={() => router.push('/terms')} className="hover:text-neutral-400 transition-colors">Terms</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
