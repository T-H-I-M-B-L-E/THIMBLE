import { NextRequest, NextResponse } from 'next/server'

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value
  const res = await fetch(`${api()}/api/banner`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: 'no-store',
  })
  const data = await res.json().catch(() => null)
  return NextResponse.json(data, { status: res.status })
}
