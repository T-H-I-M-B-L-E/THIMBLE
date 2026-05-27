import { NextRequest, NextResponse } from 'next/server'

const apiBase = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const res = await fetch(`${apiBase()}/admin/infra`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
