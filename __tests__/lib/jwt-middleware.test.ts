/**
 * Tests for /lib/jwt-middleware.ts
 *
 * Covers:
 *  - verifyJWT: valid token, expired token, tampered token, wrong secret
 *  - getTokenFromCookie: present, absent
 *  - getUserFromToken: end-to-end via mocked cookies
 */

import { SignJWT, jwtVerify } from 'jose'

// ── helpers ──────────────────────────────────────────────────────────────────

const SECRET = 'test-secret-32-chars-minimum!!'
const encoder = new TextEncoder()

async function makeToken(
  payload: Record<string, unknown>,
  secret = SECRET,
  expiresIn = '7d'
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encoder.encode(secret))
}

// ── mock next/headers so verifyJWT can be imported outside a request context ─

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

// Set the JWT_SECRET env var before importing the module
beforeAll(() => {
  process.env.JWT_SECRET = SECRET
})

// ── import AFTER env is set and mocks are wired up ───────────────────────────

import { verifyJWT, getTokenFromCookie, getUserFromToken } from '@/lib/jwt-middleware'
import { cookies } from 'next/headers'

const mockCookies = cookies as jest.MockedFunction<typeof cookies>

// ─────────────────────────────────────────────────────────────────────────────
//  verifyJWT
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyJWT', () => {
  it('returns payload for a valid token', async () => {
    const token = await makeToken({ userId: 'usr_1', email: 'a@b.com' })
    const payload = await verifyJWT(token)

    expect(payload).not.toBeNull()
    expect(payload?.userId).toBe('usr_1')
    expect(payload?.email).toBe('a@b.com')
  })

  it('returns null for an expired token', async () => {
    const token = await makeToken({ userId: 'usr_2' }, SECRET, '-1s')
    const payload = await verifyJWT(token)
    expect(payload).toBeNull()
  })

  it('returns null when the token is signed with the wrong secret', async () => {
    const token = await makeToken({ userId: 'usr_3' }, 'completely-different-secret!!')
    const payload = await verifyJWT(token)
    expect(payload).toBeNull()
  })

  it('returns null for a syntactically invalid token', async () => {
    const payload = await verifyJWT('this.is.not.a.jwt')
    expect(payload).toBeNull()
  })

  it('returns null for an empty string', async () => {
    const payload = await verifyJWT('')
    expect(payload).toBeNull()
  })

  it('carries through arbitrary claims unchanged', async () => {
    const token = await makeToken({ userId: 'usr_4', email: 'x@y.com', role: 'designer' })
    const payload = await verifyJWT(token)
    expect(payload?.role).toBe('designer')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  getTokenFromCookie
// ─────────────────────────────────────────────────────────────────────────────

describe('getTokenFromCookie', () => {
  it('returns the token value when the auth_token cookie is present', async () => {
    mockCookies.mockResolvedValue({
      get: (name: string) => (name === 'auth_token' ? { value: 'tok123', name: 'auth_token' } : undefined),
    } as any)

    const result = await getTokenFromCookie()
    expect(result).toBe('tok123')
  })

  it('returns null when auth_token is absent', async () => {
    mockCookies.mockResolvedValue({
      get: () => undefined,
    } as any)

    const result = await getTokenFromCookie()
    expect(result).toBeNull()
  })

  it('returns null when cookies() throws', async () => {
    mockCookies.mockRejectedValue(new Error('Not in request context'))
    const result = await getTokenFromCookie()
    expect(result).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  getUserFromToken (integration of the two helpers above)
// ─────────────────────────────────────────────────────────────────────────────

describe('getUserFromToken', () => {
  it('returns the decoded user when a valid token is in the cookie', async () => {
    const token = await makeToken({ userId: 'usr_5', email: 'z@z.com' })

    mockCookies.mockResolvedValue({
      get: (name: string) => (name === 'auth_token' ? { value: token, name: 'auth_token' } : undefined),
    } as any)

    const user = await getUserFromToken()
    expect(user).not.toBeNull()
    expect(user?.userId).toBe('usr_5')
    expect(user?.email).toBe('z@z.com')
  })

  it('returns null when no cookie is present', async () => {
    mockCookies.mockResolvedValue({ get: () => undefined } as any)
    const user = await getUserFromToken()
    expect(user).toBeNull()
  })

  it('returns null when the cookie contains an expired token', async () => {
    const token = await makeToken({ userId: 'usr_6' }, SECRET, '-1s')

    mockCookies.mockResolvedValue({
      get: (name: string) => (name === 'auth_token' ? { value: token, name: 'auth_token' } : undefined),
    } as any)

    const user = await getUserFromToken()
    expect(user).toBeNull()
  })
})
