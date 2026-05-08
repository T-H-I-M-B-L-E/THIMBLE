/**
 * Tests for /middleware.ts (JWT route protection)
 *
 * Strategy: create synthetic NextRequest objects and call the middleware
 * directly.  We sign real JWTs with the test secret so we can test the
 * full token-validation path without importing jose internals from outside.
 */

import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

// The middleware captures JWT_SECRET at module-load time, so we must use the
// same value it computed (the fallback, since env may not be set at import).
// We read it after importing the middleware so both agree on the secret.
import { middleware } from '@/middleware'

// Use the same default the middleware fell back to
const SECRET = process.env.JWT_SECRET ?? 'fallback-secret-key-change-in-production'
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
    '/dashboard',
    '/dashboard/model/feed',
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
    const res = await middleware(makeRequest('/dashboard', 'not.a.real.jwt'))
    expect(res?.headers.get('location')).toContain('/auth')
  })

  it('redirects to /auth when the token is expired', async () => {
    const token = await makeValidToken('-1s')
    const res = await middleware(makeRequest('/dashboard', token))
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
    const res = await middleware(makeRequest('/dashboard', token))
    expect(res?.headers.get('location')).toContain('/auth')
  })

  it('redirects to /auth when auth_token is an empty string', async () => {
    const res = await middleware(makeRequest('/dashboard', ''))
    expect(res?.headers.get('location')).toContain('/auth')
  })
})
