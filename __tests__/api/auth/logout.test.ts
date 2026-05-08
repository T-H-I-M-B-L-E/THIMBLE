/**
 * Tests for /app/api/auth/logout/route.ts
 *
 * Logout is intentionally simple — it just clears the cookie.
 * No backend call is needed.
 */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/logout/route'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/logout', { method: 'POST' })
}

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 200 with { success: true }', async () => {
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('clears the auth_token cookie (maxAge=0)', async () => {
    const res = await POST(makeRequest())
    const cookie = res.headers.get('set-cookie') ?? ''

    // Cookie value should be empty string and max-age 0 (delete)
    expect(cookie).toMatch(/auth_token=/)
    expect(cookie).toMatch(/Max-Age=0/)
  })

  it('sets HttpOnly on the cleared cookie', async () => {
    const res = await POST(makeRequest())
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/HttpOnly/i)
  })

  it('does NOT call fetch (no backend roundtrip)', async () => {
    const spy = jest.spyOn(global, 'fetch')
    await POST(makeRequest())
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
