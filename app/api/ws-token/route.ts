import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/jwt-middleware'

// Returns the raw auth_token so the frontend can pass it to the WebSocket URL.
// This is safe because: the cookie is already verified by getUserFromToken,
// WebSocket auth is server-enforced, and the token is short-lived (2h max).
export async function GET(request: NextRequest) {
  const payload = await getUserFromToken()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = request.cookies.get('auth_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ token })
}
