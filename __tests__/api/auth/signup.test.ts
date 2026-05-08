/**
 * Tests for /app/api/auth/signup/route.ts
 */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/signup/route'

const mockFetch = jest.fn()
global.fetch = mockFetch

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/signup', {
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

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  beforeEach(() => mockFetch.mockClear())

  // ── field validation ─────────────────────────────────────────────────────────

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ password: 'Pass1!', fullName: 'Alice' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com', fullName: 'Alice' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when fullName is missing', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com', password: 'Pass1!' }))
    expect(res.status).toBe(400)
  })

  // ── success path ─────────────────────────────────────────────────────────────

  it('returns 200 with verificationRequired when backend signals so', async () => {
    mockBackend(200, { verificationRequired: true })

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'Pass1!', fullName: 'Alice' }))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.verificationRequired).toBe(true)
    expect(data.email).toBe('a@b.com')
  })

  it('passes email, password, and fullName to the backend', async () => {
    mockBackend(200, { verificationRequired: true })

    await POST(makeRequest({ email: 'b@c.com', password: 'S3cur3!', fullName: 'Bob' }))

    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body.email).toBe('b@c.com')
    expect(body.password).toBe('S3cur3!')
    expect(body.fullName).toBe('Bob')
  })

  // ── backend errors ───────────────────────────────────────────────────────────

  it('returns 409 when email is already registered', async () => {
    mockBackend(409, { error: 'Email already exists' })

    const res = await POST(makeRequest({ email: 'dup@b.com', password: 'Pass1!', fullName: 'Alice' }))
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toBeTruthy()
  })

  it('returns 400 when backend rejects the request', async () => {
    mockBackend(400, { error: 'Invalid email format' })

    const res = await POST(makeRequest({ email: 'bad', password: 'Pass1!', fullName: 'Alice' }))
    expect(res.status).toBe(400)
  })

  // ── network failure ──────────────────────────────────────────────────────────

  it('returns 500 when backend is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'Pass1!', fullName: 'Alice' }))
    expect(res.status).toBe(500)
  })
})
