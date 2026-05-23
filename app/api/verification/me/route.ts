import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/jwt-middleware'

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

export async function GET(request: NextRequest) {
  const payload = await getUserFromToken()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = request.cookies.get('auth_token')?.value ?? ''
  const res = await fetch(`${api()}/api/verification/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
