/**
 * Tests for /middleware.ts (JWT route protection)
 *
 * Strategy: create synthetic NextRequest objects and call the middleware
 * directly.  We sign real JWTs with the test secret so we can test the
 * full token-validation path without importing jose internals from outside.
 */

import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

// The middleware reads JWT_SECRET lazily (per request), and there is no
// fallback secret, so a value must be present in the environment. Set a
// deterministic one before importing the middleware and sign tokens with it.
const SECRET: string = 'test-secret-32-chars-minimum!!'
process.env.JWT_SECRET = SECRET

import { middleware } from '@/middleware'

const encoder = new TextEncoder()

async function makeValidToken(expiresIn = '7d'): Promise<string> {
  return new SignJWT({ userId: 'usr_1', email: 'test@example.com' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encoder.encode(SECRET))
}

function makeRequest(path: string, tokenValue?: string): NextRequest {
  const url = `http://localhost:3000${path}`
  const headers: HeadersInit = {}

  if (tokenValue !== undefined) {
    // Set Cookie header — this is what middleware reads via req.cookies.get()
    headers['Cookie'] = `auth_token=${tokenValue}`
  }

  return new NextRequest(url, { headers })
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public routes (should always pass through)
// ─────────────────────────────────────────────────────────────────────────────

describe('public routes', () => {
  const publicPaths = ['/', '/auth', '/auth/signup', '/auth/forgot-password']

  for (const path of publicPaths) {
    it(`lets unauthenticated requests through for ${path}`, async () => {
      const res = await middleware(makeRequest(path))
      // Should NOT redirect — either null (next()) or a non-redirect Response
      expect(res?.status ?? 200).not.toBe(307)
      expect(res?.status ?? 200).not.toBe(302)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  Protected routes — no token
// ─────────────────────────────────────────────────────────────────────────────

describe('protected routes — no token', () => {
  const protectedPaths = [
    '/onboarding',
    '/upload',
    '/explore',
    '/feed',
    '/profile',
  ]

  for (const path of protectedPaths) {
    it(`redirects to /auth for ${path} with no cookie`, async () => {
      const res = await middleware(makeRequest(path))
      expect(res?.status).toBeGreaterThanOrEqual(300)
      expect(res?.status).toBeLessThan(400)
      expect(res?.headers.get('location')).toContain('/auth')
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  Protected routes — valid token
// ─────────────────────────────────────────────────────────────────────────────

describe('protected routes — valid token', () => {
  it('passes through /dashboard with a valid JWT cookie', async () => {
    const token = await makeValidToken()
    const res = await middleware(makeRequest('/dashboard', token))
    // Middleware should call next() — response is null or non-redirect
    const status = res?.status ?? 200
    expect(status).not.toBe(307)
    expect(status).not.toBe(302)
  })

  it('passes through /explore with a valid JWT cookie', async () => {
    const token = await makeValidToken()
    const res = await middleware(makeRequest('/explore', token))
    const status = res?.status ?? 200
    expect(status).not.toBe(307)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  Protected routes — invalid / expired token
// ─────────────────────────────────────────────────────────────────────────────

describe('protected routes — bad token', () => {
  it('redirects to /auth when the token is an arbitrary string', async () => {
    const res = await middleware(makeRequest('/feed', 'not.a.real.jwt'))
    expect(res?.headers.get('location')).toContain('/auth')
  })

  it('redirects to /auth when the token is expired', async () => {
    const token = await makeValidToken('-1s')
    const res = await middleware(makeRequest('/feed', token))
    expect(res?.headers.get('location')).toContain('/auth')
  })

  it('redirects to /auth when the token uses the wrong secret', async () => {
    // Sign with a different secret — must be a 32-char string the middleware won't accept
    const attackerSecret = SECRET === 'fallback-secret-key-change-in-production'
      ? 'completely-different-secret-aaa!'  // different from fallback
      : 'fallback-secret-key-change-in-production' // different from custom
    const token = await new SignJWT({ userId: 'usr_x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(encoder.encode(attackerSecret))
    const res = await middleware(makeRequest('/feed', token))
    expect(res?.headers.get('location')).toContain('/auth')
  })

  it('redirects to /auth when auth_token is an empty string', async () => {
    const res = await middleware(makeRequest('/feed', ''))
    expect(res?.headers.get('location')).toContain('/auth')
  })
})
