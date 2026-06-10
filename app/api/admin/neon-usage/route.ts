import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.NEON_API_KEY
  const projectId = process.env.NEON_PROJECT_ID
  if (!apiKey || !projectId) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const res = await fetch(
    `https://console.neon.tech/api/v2/projects/${projectId}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json({ error: body }, { status: res.status })
  }

  const data = await res.json()
  const p = data.project
  return NextResponse.json({
    compute_time_seconds: p.compute_time_seconds,
    active_time_seconds: p.active_time_seconds,
    written_data_bytes: p.written_data_bytes,
    data_transfer_bytes: p.data_transfer_bytes,
    data_storage_bytes_hour: p.data_storage_bytes_hour,
  })
}
