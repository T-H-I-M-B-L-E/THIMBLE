/**
 * Tests for /app/api/auth/me/route.ts
 */

import { NextRequest } from 'next/server'

const mockGetUserFromToken = jest.fn()

jest.mock('@/lib/jwt-middleware', () => ({
  getUserFromToken: () => mockGetUserFromToken(),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

import { GET } from '@/app/api/auth/me/route'

function makeRequest(token = 'jwt.token.value'): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/me', {
    method: 'GET',
    headers: {
      cookie: `auth_token=${token}`,
    },
  })
}

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    mockGetUserFromToken.mockReset()
    mockFetch.mockReset()
  })

  it('returns 401 and clears the cookie when no valid JWT payload is available', async () => {
    mockGetUserFromToken.mockResolvedValueOnce(null)

    const res = await GET(makeRequest())
    const data = await res.json()
    const cookie = res.headers.get('set-cookie') ?? ''

    expect(res.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
    expect(cookie).toMatch(/auth_token=/)
    expect(cookie).toMatch(/Max-Age=0/)
  })

  it('returns the backend user when the token is valid', async () => {
    mockGetUserFromToken.mockResolvedValueOnce({ userId: 'user-123' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'user-123', email: 'a@b.com' }),
    })

    const res = await GET(makeRequest('real.token'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.id).toBe('user-123')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/users/user-123',
      expect.objectContaining({
        headers: { Authorization: 'Bearer real.token' },
      })
    )
  })

  it('converts backend 404 into 401 and clears the cookie', async () => {
    mockGetUserFromToken.mockResolvedValueOnce({ userId: 'deleted-user' })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'user not found',
    })

    const res = await GET(makeRequest())
    const data = await res.json()
    const cookie = res.headers.get('set-cookie') ?? ''

    expect(res.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
    expect(cookie).toMatch(/Max-Age=0/)
  })

  it('preserves non-auth backend errors', async () => {
    mockGetUserFromToken.mockResolvedValueOnce({ userId: 'user-123' })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'backend exploded',
    })

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('Failed to fetch user')
  })
})
