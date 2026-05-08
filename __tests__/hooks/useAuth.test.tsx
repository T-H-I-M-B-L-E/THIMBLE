/**
 * Tests for /lib/useAuth.ts
 *
 * The hook calls fetch('/api/auth/me') to get the current user.
 * We mock fetch at the global level so no real request is made.
 */

import { renderHook, waitFor, act } from '@testing-library/react'
import { useAuth } from '@/lib/useAuth'

// ── mock fetch ───────────────────────────────────────────────────────────────

const mockFetch = jest.fn()
global.fetch = mockFetch

function mockMeRoute(status: number, body: Record<string, unknown> | null) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

const ALICE = {
  id: 'usr_1',
  email: 'alice@b.com',
  fullName: 'Alice',
  role: 'designer',
  verificationStatus: 'unverified',
}

// ─────────────────────────────────────────────────────────────────────────────

describe('useAuth hook', () => {
  beforeEach(() => mockFetch.mockClear())

  // ── initial state ────────────────────────────────────────────────────────────

  it('starts with isLoading=true and user=null', () => {
    // Mock a promise that never resolves during this test
    mockFetch.mockReturnValueOnce(new Promise(() => {}))

    const { result } = renderHook(() => useAuth())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  // ── authenticated ────────────────────────────────────────────────────────────

  it('populates user and sets isLoading=false when /me returns 200', async () => {
    mockMeRoute(200, ALICE)

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.user).toEqual(ALICE)
  })

  // ── unauthenticated ──────────────────────────────────────────────────────────

  it('sets user=null and isLoading=false when /me returns 401', async () => {
    mockMeRoute(401, { error: 'Unauthorized' })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.user).toBeNull()
  })

  it('sets user=null when /me returns 500', async () => {
    mockMeRoute(500, { error: 'Internal Server Error' })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.user).toBeNull()
  })

  // ── network failure ──────────────────────────────────────────────────────────

  it('sets user=null when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.user).toBeNull()
  })

  // ── credentials ──────────────────────────────────────────────────────────────

  it('calls /api/auth/me with credentials: include', async () => {
    mockMeRoute(200, ALICE)

    renderHook(() => useAuth())

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/auth/me')
    expect(options?.credentials).toBe('include')
  })

  // ── logout ────────────────────────────────────────────────────────────────────

  it('clears user after logout() is called', async () => {
    // First call: GET /api/auth/me → 200
    mockMeRoute(200, ALICE)
    // Second call: POST /api/auth/logout → 200
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.user).toEqual(ALICE))

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
  })

  it('calls POST /api/auth/logout with credentials: include', async () => {
    mockMeRoute(200, ALICE)
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.user).not.toBeNull())

    await act(async () => { await result.current.logout() })

    const logoutCall = mockFetch.mock.calls[1]
    expect(logoutCall[0]).toBe('/api/auth/logout')
    expect(logoutCall[1]?.method).toBe('POST')
    expect(logoutCall[1]?.credentials).toBe('include')
  })

  it('still clears user even when the logout fetch throws', async () => {
    mockMeRoute(200, ALICE)
    mockFetch.mockRejectedValueOnce(new Error('network gone'))

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.user).toEqual(ALICE))

    await act(async () => { await result.current.logout() })

    // User should still be cleared client-side
    expect(result.current.user).toBeNull()
  })
})
