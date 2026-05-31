import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

export async function GET(req: NextRequest) {
  const t = (await cookies()).get('admin_token')?.value
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const qs = req.nextUrl.search
  const res = await fetch(`${api()}/admin/broadcast/preview${qs}`, {
    headers: { Authorization: `Bearer ${t}` },
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
