import { NextRequest, NextResponse } from 'next/server'

// Returns the admin_token so the admin WebSocket can authenticate.
// Only works if admin_token cookie is present (already auth-gated by middleware).
export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ token })
}
