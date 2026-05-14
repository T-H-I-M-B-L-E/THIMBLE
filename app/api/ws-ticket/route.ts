import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/jwt-middleware'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

export async function POST(request: NextRequest) {
  const payload = await getUserFromToken()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = request.cookies.get('auth_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = await fetch(`${BACKEND_URL}/api/ws-ticket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) return NextResponse.json({ error: 'Failed to issue ticket' }, { status: 502 })

  const data = await res.json()
  return NextResponse.json(data)
}
