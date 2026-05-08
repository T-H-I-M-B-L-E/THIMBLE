import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/jwt-middleware'

const apiBase = () => process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

async function getToken(request: NextRequest) {
  return request.cookies.get('auth_token')?.value
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getUserFromToken()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = await getToken(request)
  const res = await fetch(`${apiBase()}/admin/users/${params.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getUserFromToken()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = await getToken(request)
  const body = await request.json()
  const res = await fetch(`${apiBase()}/admin/users/${params.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getUserFromToken()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = await getToken(request)
  const res = await fetch(`${apiBase()}/admin/users/${params.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 204) return new NextResponse(null, { status: 204 })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
