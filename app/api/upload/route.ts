import { PutObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { getPublicAssetUrl, getR2BucketName, s3 } from '@/lib/s3'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])
const ALLOWED_FOLDERS = new Set(['avatars', 'posts', 'verification'])

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function getFileExtension(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName) return fromName

  const fromType = file.type.split('/').pop()?.toLowerCase()
  return fromType || 'bin'
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const rawFolder = formData.get('folder')
    const folder = typeof rawFolder === 'string' ? rawFolder : 'posts'

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ error: 'Invalid upload folder' }, { status: 400 })
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const extension = getFileExtension(file)
    const key = `${folder}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(
      file.name.replace(/\.[^.]+$/, '')
    )}.${extension}`

    await s3.send(
      new PutObjectCommand({
        Bucket: getR2BucketName(),
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    )

    return NextResponse.json({
      url: getPublicAssetUrl(key),
      key,
    })
  } catch (error) {
    console.error('Error in POST /api/upload:', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
