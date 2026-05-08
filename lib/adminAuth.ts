import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

function getJWTSecret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'
  )
}

export async function requireAdminToken(
  req: NextRequest
): Promise<{ token: string; error?: never } | { token?: never; error: NextResponse }> {
  const token = req.cookies.get('admin_token')?.value
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  try {
    const { payload } = await jwtVerify(token, getJWTSecret())
    if (!payload.isAdmin) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
  } catch {
    return { error: NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 }) }
  }
  return { token }
}
