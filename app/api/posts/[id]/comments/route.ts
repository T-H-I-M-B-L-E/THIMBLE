import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/jwt-middleware'

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
const getToken = (req: NextRequest) => req.cookies.get('auth_token')?.value ?? ''

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getUserFromToken()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const token = getToken(request)

  const res = await fetch(`${api()}/api/posts/${id}/comments`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return NextResponse.json(await res.json(), { status: res.status })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getUserFromToken()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const token = getToken(request)

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })
  }

  const res = await fetch(`${api()}/api/posts/${id}/comments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
