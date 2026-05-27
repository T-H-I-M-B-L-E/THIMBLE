'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

const SECTIONS = [
  {
    title: 'Getting Started',
    faqs: [
      {
        q: 'What is Thimble?',
        a: 'Thimble is a platform built exclusively for the fashion industry. It connects designers, models, manufacturers, photographers, and fashion brands in one trusted place where you can discover collaborators, communicate, and work together — all without leaving the app.',
      },
      {
        q: 'Who can join Thimble?',
        a: 'Anyone working in fashion. If you are a designer, model, manufacturer, photographer, or run a fashion brand, Thimble is built for you. Sign up, choose your role, and complete your profile to get started.',
      },
      {
        q: 'Is Thimble free to use?',
        a: 'Yes. Creating an account and building your profile is completely free. You can browse, discover other creatives, post content, and send messages at no cost.',
      },
      {
        q: 'How do I create an account?',
        a: 'Click "Join Free" on the homepage, enter your email address and choose a password, then verify your email. Once verified, you will complete a short onboarding to set up your profile and role.',
      },
    ],
  },
  {
    title: 'Verification',
    faqs: [
      {
        q: 'What is verification and why does it matter?',
        a: 'Verification is Thimble\'s identity and portfolio review process. When you are verified, a badge appears on your profile confirming that our team has reviewed your identity and confirmed you are who you say you are. It builds trust and helps you attract serious collaborations.',
      },
      {
        q: 'How do I get verified?',
        a: 'Go to your profile settings and submit a verification request. You will need to provide your full name, a valid government-issued ID, and any relevant portfolio or business documentation. Our team reviews submissions and responds within 2–5 business days.',
      },
      {
        q: 'What happens if my verification is rejected?',
        a: 'You will receive a message explaining why your request was not approved and what you can resubmit. Common reasons include unclear ID documents or portfolio that does not match your stated role. You are welcome to reapply after addressing the feedback.',
      },
      {
        q: 'Can I still use Thimble without being verified?',
        a: 'Yes. Verification is optional but strongly recommended. Verified users appear more prominently in searches and receive significantly more collaboration requests.',
      },
    ],
  },
  {
    title: 'Collaboration & Messaging',
    faqs: [
      {
        q: 'How do I find people to collaborate with?',
        a: 'Browse the feed to discover posts from designers, models, photographers, and brands. You can explore profiles, follow people whose work interests you, and reach out directly via the messaging feature.',
      },
      {
        q: 'How does messaging work?',
        a: 'Messaging on Thimble is direct and private. Start a conversation with any user from their profile. All messages stay inside the platform — no need to share personal phone numbers or email addresses.',
      },
      {
        q: 'Can I post jobs or casting calls?',
        a: 'Yes. You can post opportunities to the feed where the relevant creatives on the platform will see them. Tag your post appropriately to reach the right audience.',
      },
      {
        q: 'What is the feed?',
        a: 'The feed is the main content stream on Thimble. Users share their work, post opportunities, and showcase projects. You see posts from people you follow as well as relevant content from across the platform.',
      },
    ],
  },
  {
    title: 'Payments',
    faqs: [
      {
        q: 'How do payments work on Thimble?',
        a: 'Thimble uses a secure escrow system. When you agree to a project, the client deposits payment into escrow. Funds are only released to the creative once the work has been delivered and approved. This protects both parties.',
      },
      {
        q: 'What if there is a dispute?',
        a: 'If you and the other party cannot agree on whether work was delivered to the agreed standard, you can open a dispute. Our team will review the project brief, communications, and deliverables and make a fair determination.',
      },
      {
        q: 'Is my payment information secure?',
        a: 'Yes. Thimble does not store card details on our servers. All payment processing is handled by our payment provider using industry-standard encryption.',
      },
    ],
  },
  {
    title: 'Account & Privacy',
    faqs: [
      {
        q: 'How do I update my profile?',
        a: 'Go to your profile page and tap the edit button. You can update your name, bio, location, website, avatar, and portfolio from there.',
      },
      {
        q: 'How do I change my email or password?',
        a: 'Go to Settings → Account. From there you can update your email address and change your password. You will need to confirm your current password to make changes.',
      },
      {
        q: 'Can I delete my account?',
        a: 'Yes. Go to Settings → Account → Delete Account. This action is permanent and cannot be undone. All your data, posts, and messages will be removed from the platform.',
      },
      {
        q: 'How do I block or report someone?',
        a: 'Go to the user\'s profile, tap the options menu, and select Block or Report. Blocked users cannot see your profile or message you. Reports are reviewed by our moderation team.',
      },
      {
        q: 'Who can see my profile?',
        a: 'Your profile is visible to all registered Thimble users. Your email address is never shown publicly. Only your name, role, bio, location, website, and posted content are visible to others.',
      },
    ],
  },
  {
    title: 'Safety & Trust',
    faqs: [
      {
        q: 'How does Thimble protect me from scams?',
        a: 'Verification, escrow payments, and in-platform messaging work together to protect you. Never agree to work outside of Thimble or pay someone who asks you to skip the escrow process — that is always a red flag.',
      },
      {
        q: 'What should I do if I suspect a scam?',
        a: 'Report the user immediately using the report button on their profile. Do not transfer money or share personal financial details. Our moderation team investigates all reports.',
      },
      {
        q: 'Does Thimble share my data with third parties?',
        a: 'No. Thimble does not sell your data. See our Terms of Service for the full details on how your information is used.',
      },
    ],
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-neutral-800 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-medium text-neutral-100 leading-relaxed">{q}</span>
        {open ? <ChevronUp size={16} className="text-neutral-500 shrink-0 mt-0.5" /> : <ChevronDown size={16} className="text-neutral-500 shrink-0 mt-0.5" />}
      </button>
      {open && (
        <p className="text-sm text-neutral-400 leading-relaxed pb-5 pr-6">{a}</p>
      )}
    </div>
  )
}

export default function HelpPage() {
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
        <p className="text-xs uppercase tracking-[0.3em] text-[#C9A84C] mb-4 font-medium">Help Centre</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">How can we help?</h1>
        <p className="text-neutral-400 text-lg mb-16">Find answers to common questions about Thimble below.</p>

        {/* FAQ Sections */}
        <div className="space-y-12">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <p className="text-xs uppercase tracking-[0.25em] text-[#C9A84C] font-medium mb-4">{section.title}</p>
              <div className="border border-neutral-800 bg-[#0d0d0d] px-6">
                {section.faqs.map(faq => (
                  <FAQItem key={faq.q} q={faq.q} a={faq.a} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="mt-16 border border-neutral-800 bg-[#0d0d0d] p-10 text-center">
          <h2 className="text-xl font-semibold mb-2">Still need help?</h2>
          <p className="text-neutral-400 text-sm mb-6">Our team is here. Reach out and we will get back to you as soon as possible.</p>
          <a
            href="mailto:support@tvimble.tech"
            className="inline-block h-12 px-8 bg-[#C9A84C] text-black font-semibold text-sm hover:bg-[#b8963e] transition-colors leading-[48px]"
          >
            Email Support
          </a>
        </div>

      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 md:px-12 py-8 mt-10">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-white font-light tracking-[0.35em] text-sm select-none">THIMBLE</span>
          <p className="text-xs text-neutral-600">&copy; {new Date().getFullYear()} Thimble. All rights reserved.</p>
          <div className="flex gap-5 text-xs text-neutral-600">
            <button onClick={() => router.push('/about')} className="hover:text-neutral-400 transition-colors">About</button>
            <button onClick={() => router.push('/terms')} className="hover:text-neutral-400 transition-colors">Terms</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
