/**
 * Tests for /app/api/auth/verify-email/route.ts
 *
 * Happy path: code matches → JWT returned → httpOnly cookie set
 * Sad paths:  missing fields, expired code, wrong code, backend down
 */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/verify-email/route'

const mockFetch = jest.fn()
global.fetch = mockFetch

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/verify-email', {
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

const VALID_USER = { id: 'usr_10', email: 'alice@b.com', fullName: 'Alice', role: 'model' }

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/verify-email', () => {
  beforeEach(() => mockFetch.mockClear())

  // ── validation ───────────────────────────────────────────────────────────────

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ code: '123456' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when code is missing', async () => {
    const res = await POST(makeRequest({ email: 'alice@b.com' }))
    expect(res.status).toBe(400)
  })

  // ── success path ─────────────────────────────────────────────────────────────

  it('returns 200, user data, and sets auth_token cookie on success', async () => {
    mockBackend(200, { token: 'ver.ified.jwt', user: VALID_USER })

    const res = await POST(makeRequest({ email: 'alice@b.com', code: '654321' }))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.user.email).toBe('alice@b.com')

    const cookieHeader = res.headers.get('set-cookie') ?? ''
    expect(cookieHeader).toMatch(/auth_token=ver\.ified\.jwt/)
    expect(cookieHeader).toMatch(/HttpOnly/)
  })

  it('forwards email and code to the backend', async () => {
    mockBackend(200, { token: 'tok', user: VALID_USER })

    await POST(makeRequest({ email: 'x@y.com', code: '000000' }))

    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body.email).toBe('x@y.com')
    expect(body.code).toBe('000000')
  })

  // ── backend errors ───────────────────────────────────────────────────────────

  it('returns 400 when the code is wrong or expired', async () => {
    mockBackend(400, { error: 'Invalid or expired code' })

    const res = await POST(makeRequest({ email: 'alice@b.com', code: '000000' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/invalid|expired/i)
  })

  it('returns 404 when no pending verification exists for the email', async () => {
    mockBackend(404, { error: 'No pending verification' })

    const res = await POST(makeRequest({ email: 'nobody@b.com', code: '123456' }))
    expect(res.status).toBe(404)
  })

  // ── network failure ──────────────────────────────────────────────────────────

  it('returns 500 when backend is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))

    const res = await POST(makeRequest({ email: 'alice@b.com', code: '123456' }))
    expect(res.status).toBe(500)
  })
})
