'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'greeting' | 'login'>('greeting')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }
      router.push('/admin')
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center overflow-hidden">

      {/* Greeting screen */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-in-out ${
          step === 'greeting' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-12 pointer-events-none'
        }`}
      >
        <p className="text-xs uppercase tracking-[0.4em] text-neutral-600 mb-4">THIMBLE ADMIN</p>
        <h1 className="text-5xl font-light text-white tracking-wide mb-2">
          {greeting},
        </h1>
        <h2 className="text-5xl font-light text-neutral-400 tracking-wide mb-16">Sir.</h2>
        <button
          onClick={() => setStep('login')}
          className="text-xs uppercase tracking-[0.3em] text-neutral-500 hover:text-white transition-colors duration-300 border border-neutral-800 hover:border-neutral-600 px-8 py-3 rounded-full"
        >
          Enter
        </button>
      </div>

      {/* Login panel */}
      <div
        className={`w-full max-w-sm transition-all duration-700 ease-in-out ${
          step === 'login' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'
        }`}
      >
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-neutral-600">THIMBLE</p>
          <p className="text-2xl font-light tracking-widest text-white mt-1">Admin Access</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-neutral-500 block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-neutral-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-neutral-500 block mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-neutral-500 transition-colors"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black py-3 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={() => setStep('greeting')}
          className="mt-4 w-full text-xs text-neutral-600 hover:text-neutral-400 transition-colors text-center"
        >
          ← Back
        </button>
      </div>

    </div>
  )
}
