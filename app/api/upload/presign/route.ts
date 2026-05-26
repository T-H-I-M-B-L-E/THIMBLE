import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { getUserFromToken } from "@/lib/jwt-middleware"
import { r2, getR2BucketName, getPublicAssetUrl } from "@/lib/r2"
import { randomUUID } from "crypto"

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
])
const ALLOWED_FOLDERS = new Set(["avatars", "posts", "verification"])
const SIGNED_URL_TTL_SECONDS = 300

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg": return "jpg"
    case "image/png": return "png"
    case "image/webp": return "webp"
    case "image/gif": return "gif"
    case "image/heic": return "heic"
    case "image/heif": return "heif"
    default: return "bin"
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserFromToken()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { contentType?: string; size?: number; folder?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const contentType = (body.contentType || "").toLowerCase()
  const size = Number(body.size)
  const folder = ALLOWED_FOLDERS.has(body.folder || "") ? body.folder! : "posts"

  if (!ALLOWED_MIME.has(contentType)) {
    return NextResponse.json({ error: `Unsupported file type: ${contentType}` }, { status: 415 })
  }
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "Invalid file size" }, { status: 400 })
  }
  if (size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 413 })
  }

  let bucket: string
  try {
    bucket = getR2BucketName()
  } catch {
    return NextResponse.json({ error: "R2 storage is not configured" }, { status: 500 })
  }

  const key = `${folder}/${user.userId}/${Date.now()}-${randomUUID()}.${extFromMime(contentType)}`

  try {
    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
        CacheControl: "public, max-age=31536000, immutable",
      }),
      { expiresIn: SIGNED_URL_TTL_SECONDS }
    )

    return NextResponse.json({
      uploadUrl,
      publicUrl: getPublicAssetUrl(key),
      key,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      expiresIn: SIGNED_URL_TTL_SECONDS,
    })
  } catch (err) {
    console.error("Failed to sign upload URL:", err)
    return NextResponse.json({ error: "Failed to prepare upload" }, { status: 500 })
  }
}
