import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/jwt-middleware'

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
const getToken = (req: NextRequest) => req.cookies.get('auth_token')?.value ?? ''

export async function POST(request: NextRequest) {
  const payload = await getUserFromToken()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = getToken(request)
  const upstream = await fetch(`${api()}/auth/logout-all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await upstream.json().catch(() => ({}))
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status })
  }

  const res = NextResponse.json({ success: true }, { status: 200 })
  if (data?.token) {
    res.cookies.set('auth_token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.tvimble.tech' : undefined,
    })
  }
  return res
}
