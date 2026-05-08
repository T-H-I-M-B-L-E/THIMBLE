import { NextRequest, NextResponse } from 'next/server'

// We don't verify the JWT locally — the Go backend is the single source of truth.
// We only check the cookie exists here; the backend rejects invalid/expired tokens.
export function requireAdminToken(
  req: NextRequest
): { token: string; error?: never } | { token?: never; error: NextResponse } {
  const token = req.cookies.get('admin_token')?.value
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { token }
}
