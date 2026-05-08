/**
 * CJS-compatible mock of the `jose` package for Jest.
 *
 * The real `jose` package is ESM-only which breaks ts-jest in CommonJS mode.
 * This mock wraps `jsonwebtoken` (which IS CJS) to expose the same API
 * surface that our code uses: SignJWT and jwtVerify.
 */

import jwt from 'jsonwebtoken'

// ── SignJWT builder ────────────────────────────────────────────────────────────

export class SignJWT {
  private payload: Record<string, unknown>
  private header: Record<string, string> = {}
  private expiry: string | number | undefined
  private issueAt = true

  constructor(payload: Record<string, unknown>) {
    this.payload = payload
  }

  setProtectedHeader(header: Record<string, string>) {
    this.header = header
    return this
  }

  setIssuedAt() {
    this.issueAt = true
    return this
  }

  setExpirationTime(exp: string | number) {
    this.expiry = exp
    return this
  }

  sign(secret: Uint8Array): Promise<string> {
    const options: jwt.SignOptions = {
      algorithm: (this.header.alg as jwt.Algorithm) || 'HS256',
    }

    if (this.expiry !== undefined) {
      if (typeof this.expiry === 'string') {
        // Convert "7d" → seconds, "-1s" → -1, etc.
        const str = this.expiry
        const match = str.match(/^(-?\d+)(s|m|h|d)$/)
        if (match) {
          const n = parseInt(match[1])
          const unit = match[2]
          const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400
          options.expiresIn = n * multiplier
        }
      } else {
        options.expiresIn = this.expiry as number
      }
    }

    const secretStr = Buffer.from(secret).toString('utf-8')
    return Promise.resolve(jwt.sign(this.payload, secretStr, options))
  }
}

// ── jwtVerify ────────────────────────────────────────────────────────────────

export async function jwtVerify(
  token: string,
  secret: Uint8Array
): Promise<{ payload: Record<string, unknown> }> {
  const secretStr = Buffer.from(secret).toString('utf-8')
  try {
    const decoded = jwt.verify(token, secretStr) as Record<string, unknown>
    return { payload: decoded }
  } catch (err) {
    throw err
  }
}
