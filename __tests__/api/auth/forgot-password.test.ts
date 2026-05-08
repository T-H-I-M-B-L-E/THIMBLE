/**
 * Tests for /app/api/auth/forgot-password/route.ts
 */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/forgot-password/route'

const mockFetch = jest.fn()
global.fetch = mockFetch

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/forgot-password', {
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

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => mockFetch.mockClear())

  // ── validation ───────────────────────────────────────────────────────────────

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  // ── success path ─────────────────────────────────────────────────────────────

  it('returns 200 with resetEmailSent:true when backend succeeds', async () => {
    mockBackend(200, { resetEmailSent: true })

    const res = await POST(makeRequest({ email: 'alice@b.com' }))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.resetEmailSent).toBe(true)
  })

  it('passes the email to the backend', async () => {
    mockBackend(200, { resetEmailSent: true })

    await POST(makeRequest({ email: 'bob@test.com' }))

    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body.email).toBe('bob@test.com')
  })

  // ── backend errors ───────────────────────────────────────────────────────────

  it('forwards backend error status', async () => {
    mockBackend(500, { error: 'Email service down' })

    const res = await POST(makeRequest({ email: 'a@b.com' }))
    expect(res.status).toBe(500)
  })

  // ── network failure ──────────────────────────────────────────────────────────

  it('returns 500 when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const res = await POST(makeRequest({ email: 'a@b.com' }))
    expect(res.status).toBe(500)
  })
})
