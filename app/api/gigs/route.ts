import { NextRequest, NextResponse } from 'next/server'

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
const getToken = (req: NextRequest) => req.cookies.get('auth_token')?.value ?? ''

export async function GET(request: NextRequest) {
  const token = getToken(request)
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${api()}/api/gigs`, { headers })
  return NextResponse.json(await res.json().catch(() => []), { status: res.status })
}
