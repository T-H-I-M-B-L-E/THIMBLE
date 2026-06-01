import { NextRequest, NextResponse } from 'next/server'

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
const getToken = (req: NextRequest) => req.cookies.get('auth_token')?.value ?? ''

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = getToken(request)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const res = await fetch(`${api()}/api/gigs/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
