import { S3Client } from '@aws-sdk/client-s3'

function getRequiredEnv(primary: string, fallback?: string) {
  const value = process.env[primary] || (fallback ? process.env[fallback] : undefined)

  if (!value) {
    throw new Error(`${primary} is not configured`)
  }

  return value
}

export const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${getRequiredEnv('R2_ACCOUNT_ID', 'ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: getRequiredEnv('R2_ACCESS_KEY_ID', 'ACCESS_KEY_ID'),
    secretAccessKey: getRequiredEnv('R2_SECRET_ACCESS_KEY', 'SECRET_ACCESS_KEY'),
  },
})

export function getR2BucketName() {
  const bucket = process.env.R2_BUCKET_NAME

  if (!bucket) {
    throw new Error('R2_BUCKET_NAME is not configured')
  }

  return bucket
}

export function getPublicAssetUrl(key: string) {
  const publicBaseUrl =
    process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL

  if (!publicBaseUrl) {
    throw new Error('R2_PUBLIC_URL is not configured')
  }

  return `${publicBaseUrl.replace(/\/+$/, '')}/${key}`
}
