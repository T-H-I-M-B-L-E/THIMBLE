import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/jwt-middleware'

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

function getToken(req: NextRequest): string {
  return req.cookies.get('auth_token')?.value ?? ''
}

export async function GET(request: NextRequest) {
  const payload = await getUserFromToken()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId') || String(payload.userId)
  const token = getToken(request)

  const res = await fetch(`${api()}/api/conversations?userId=${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return NextResponse.json(await res.json(), { status: res.status })
}

export async function POST(request: NextRequest) {
  const payload = await getUserFromToken()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const token = getToken(request)

  const res = await fetch(`${api()}/api/conversations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
