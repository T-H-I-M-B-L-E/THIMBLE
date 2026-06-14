import { NextRequest, NextResponse } from "next/server"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { requireAdminToken } from "@/lib/adminAuth"
import { r2, getR2BucketName } from "@/lib/r2"

const TTL_SECONDS = 900 // 15 minutes

function keyFromUrl(rawUrl: string): string | null {
  const publicBase = process.env.R2_PUBLIC_URL
  if (!publicBase || !rawUrl) return null
  const base = publicBase.replace(/\/+$/, "")
  if (rawUrl.startsWith(base + "/")) return rawUrl.slice(base.length + 1)
  // Also handle direct R2 endpoint URLs (fallback)
  try {
    const u = new URL(rawUrl)
    // strip leading slash
    return u.pathname.replace(/^\//, "") || null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminToken(request)
  if (auth.error) return auth.error

  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { url } = body
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 })
  }

  const key = keyFromUrl(url)
  if (!key || !key.startsWith("verification/")) {
    // Only sign verification documents — nothing else
    return NextResponse.json({ error: "Not a verification document" }, { status: 403 })
  }

  let bucket: string
  try {
    bucket = getR2BucketName()
  } catch {
    return NextResponse.json({ error: "R2 not configured" }, { status: 500 })
  }

  try {
    const signedUrl = await getSignedUrl(
      r2,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: "inline",
      }),
      { expiresIn: TTL_SECONDS }
    )
    return NextResponse.json({ signedUrl, expiresIn: TTL_SECONDS })
  } catch (err) {
    console.error("Failed to sign verification doc URL:", err)
    return NextResponse.json({ error: "Failed to generate signed URL" }, { status: 500 })
  }
}
