import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/jwt-middleware'

export async function GET(request: NextRequest) {
  const payload = await getUserFromToken()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
  const res = await fetch(`${apiBase}/admin/stats`, {
    headers: { Authorization: `Bearer ${request.cookies.get('auth_token')?.value}` },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
