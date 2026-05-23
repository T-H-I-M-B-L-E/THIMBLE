import { NextRequest, NextResponse } from 'next/server'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { requireAdminToken } from '@/lib/adminAuth'

const apiBase = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) return null
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

function keyFromPublicUrl(url: string): string | null {
  const publicUrl = process.env.R2_PUBLIC_URL
  if (!url || !publicUrl) return null
  const base = publicUrl.replace(/\/+$/, '')
  if (!url.startsWith(base + '/')) return null
  return url.slice(base.length + 1)
}

async function deleteR2Object(url: string) {
  const client = getR2Client()
  const bucket = process.env.R2_BUCKET_NAME
  const key = keyFromPublicUrl(url)
  if (!client || !bucket || !key) return
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  } catch (err) {
    // Non-fatal — the DB row is already cleared; storage may be orphaned.
    console.error('Failed to delete verification document from R2:', err)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminToken(request)
  if (auth.error) return auth.error

  const { id } = await params
  const body = await request.text()

  const res = await fetch(`${apiBase()}/admin/verification-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body,
  })
  const data = await res.json().catch(() => ({} as Record<string, unknown>))

  // Backend returns deletedDocument with the URL it just cleared from the DB.
  // Best-effort R2 cleanup — don't block the response on it.
  if (res.ok && typeof data?.deletedDocument === 'string' && data.deletedDocument) {
    deleteR2Object(data.deletedDocument).catch(() => {})
  }

  return NextResponse.json(data, { status: res.status })
}
