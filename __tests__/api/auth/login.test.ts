/**
 * Tests for /app/api/auth/login/route.ts
 *
 * Strategy: the route calls the Go backend with fetch().
 * We mock globalThis.fetch so we never make real HTTP requests.
 */

import { NextRequest } from 'next/server'

// ── mock fetch globally ───────────────────────────────────────────────────────

const mockFetch = jest.fn()
global.fetch = mockFetch

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockBackend(status: number, body: Record<string, unknown>) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

// ── import route AFTER mocks are set up ──────────────────────────────────────

import { POST } from '@/app/api/auth/login/route'

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(() => mockFetch.mockClear())

  // ── validation ──────────────────────────────────────────────────────────────

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ password: 'Pass1!' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeTruthy()
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when both fields are missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  // ── backend success ──────────────────────────────────────────────────────────

  it('returns 200 and sets auth_token cookie on successful login', async () => {
    const fakeUser = { id: 'usr_1', email: 'a@b.com', fullName: 'Alice' }
    mockBackend(200, { token: 'jwt.tok.en', user: fakeUser })

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'Password1!' }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.user.email).toBe('a@b.com')

    // Cookie must be set
    const cookieHeader = res.headers.get('set-cookie') ?? ''
    expect(cookieHeader).toMatch(/auth_token=jwt\.tok\.en/)
    expect(cookieHeader).toMatch(/HttpOnly/)
  })

  it('sets cookie with SameSite=Lax', async () => {
    const fakeUser = { id: 'usr_2', email: 'b@c.com', fullName: 'Bob' }
    mockBackend(200, { token: 'another.jwt', user: fakeUser })

    const res = await POST(makeRequest({ email: 'b@c.com', password: 'Password1!' }))
    const cookieHeader = res.headers.get('set-cookie') ?? ''
    expect(cookieHeader).toMatch(/SameSite=Lax/i)
  })

  // ── backend errors ───────────────────────────────────────────────────────────

  it('forwards 401 from backend when credentials are wrong', async () => {
    mockBackend(401, { error: 'Invalid credentials' })

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'WrongPass1!' }))
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toMatch(/invalid credentials/i)
  })

  it('forwards 404 from backend when user does not exist', async () => {
    mockBackend(404, { error: 'User not found' })

    const res = await POST(makeRequest({ email: 'ghost@b.com', password: 'Password1!' }))
    expect(res.status).toBe(404)
  })

  // ── network failure ──────────────────────────────────────────────────────────

  it('returns 500 when fetch throws (backend unreachable)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'Password1!' }))
    expect(res.status).toBe(500)
  })
})
