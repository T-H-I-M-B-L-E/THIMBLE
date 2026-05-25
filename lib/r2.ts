import { S3Client } from '@aws-sdk/client-s3'

// Cloudflare R2 client. R2 is S3-API compatible, which is why we use
// the AWS SDK — the only difference is the endpoint and the fact that
// you don't pay for egress.

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

/** S3-compatible client pointed at the R2 endpoint. */
export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${getRequiredEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: getRequiredEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: getRequiredEnv('R2_SECRET_ACCESS_KEY'),
  },
})

export function getR2BucketName() {
  return getRequiredEnv('R2_BUCKET_NAME')
}

/** Build a public URL for an object stored under `key`. Requires
 *  R2_PUBLIC_URL (or NEXT_PUBLIC_R2_PUBLIC_URL for client-side reads). */
export function getPublicAssetUrl(key: string) {
  const publicBaseUrl =
    process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL

  if (!publicBaseUrl) {
    throw new Error('R2_PUBLIC_URL is not configured')
  }

  return `${publicBaseUrl.replace(/\/+$/, '')}/${key}`
}
