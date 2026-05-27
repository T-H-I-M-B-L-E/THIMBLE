import { NextRequest, NextResponse } from 'next/server'

const apiBase = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = request.cookies.get('auth_token')?.value
  const res = await fetch(`${apiBase()}/api/ads/${id}/click`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
