import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getUserFromToken } from "@/lib/jwt-middleware"
import { randomUUID } from "crypto"

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
])

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

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
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const bucket = process.env.R2_BUCKET_NAME
  const publicUrl = process.env.R2_PUBLIC_URL
  const client = getR2Client()

  if (!client || !bucket || !publicUrl) {
    return NextResponse.json(
      { error: "R2 storage is not configured on the server" },
      { status: 500 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 413 })
  }

  const contentType = file.type || "application/octet-stream"
  if (!ALLOWED_MIME.has(contentType)) {
    return NextResponse.json({ error: `Unsupported file type: ${contentType}` }, { status: 415 })
  }

  const ext = extFromMime(contentType)
  const key = `uploads/${user.userId}/${Date.now()}-${randomUUID()}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ContentLength: buffer.length,
        CacheControl: "public, max-age=31536000, immutable",
      })
    )
  } catch (err) {
    console.error("R2 upload failed:", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 502 })
  }

  const url = `${publicUrl.replace(/\/$/, "")}/${key}`
  return NextResponse.json({ url, key })
}
