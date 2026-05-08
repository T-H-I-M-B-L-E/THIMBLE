'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Leadership is not about being in charge. It is about taking care of those in your charge.", author: "Simon Sinek" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "A leader is one who knows the way, goes the way, and shows the way.", author: "John C. Maxwell" },
  { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "Do not wait for leaders; do it alone, person to person.", author: "Mother Teresa" },
  { text: "Quality means doing it right when no one is looking.", author: "Henry Ford" },
  { text: "The function of leadership is to produce more leaders, not more followers.", author: "Ralph Nader" },
  { text: "Excellence is not a destination but a continuous journey that never ends.", author: "Brian Tracy" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
]

export default function SplashPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [visible, setVisible] = useState(false)
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_name') || ''
    const firstName = stored.split(' ')[0]
    setName(firstName)

    // Fade in
    const t1 = setTimeout(() => setVisible(true), 50)
    // Fade out and navigate after 3.2s
    const t2 = setTimeout(() => setVisible(false), 3200)
    const t3 = setTimeout(() => router.push('/admin'), 3900)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [router])

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center overflow-hidden">
      <div className={`flex flex-col items-center text-center transition-all duration-700 ease-in-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}>
        <p className="text-xs uppercase tracking-[0.4em] text-neutral-600 mb-6">THIMBLE ADMIN</p>
        <h1 className="text-5xl sm:text-6xl font-light text-white tracking-wide mb-2">
          {greeting}{name ? ',' : '.'}
        </h1>
        {name && (
          <h2 className="text-5xl sm:text-6xl font-light text-neutral-300 tracking-wide mb-12">
            {name}.
          </h2>
        )}
        {!name && <div className="mb-12" />}

        <div className="max-w-sm px-6">
          <p className="text-sm font-light text-neutral-400 leading-relaxed italic">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-xs text-neutral-600 mt-3 tracking-widest uppercase">— {quote.author}</p>
        </div>

        {/* Subtle loading indicator */}
        <div className="mt-16 flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1 h-1 rounded-full bg-neutral-700 animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
