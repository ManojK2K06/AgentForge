import crypto from 'crypto'

// Encryption key for credentials at rest.
// In production, set CRED_ENC_KEY (32-byte hex). Fallback to a dev key (NOT for prod use).
const DEV_KEY = '0'.repeat(64) // 32 bytes hex - dev only fallback
const ENC_KEY = process.env.CRED_ENC_KEY || DEV_KEY
const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const k = ENC_KEY.length === 64 ? ENC_KEY : crypto.createHash('sha256').update(ENC_KEY).digest('hex')
  return Buffer.from(k, 'hex')
}

/**
 * Encrypt a plaintext JSON string. Returns base64(iv|tag|ciphertext).
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

/**
 * Decrypt a base64(iv|tag|ciphertext) string back to plaintext.
 */
export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()])
  return dec.toString('utf8')
}

/**
 * Encrypt a JSON-serializable credentials object.
 */
export function encryptCredentials(creds: Record<string, unknown>): string {
  return encrypt(JSON.stringify(creds))
}

/**
 * Decrypt credentials back to an object. Returns {} on failure.
 */
export function decryptCredentials(payload: string): Record<string, unknown> {
  try {
    return JSON.parse(decrypt(payload)) as Record<string, unknown>
  } catch {
    return {}
  }
}

/**
 * Hash an API key secret with SHA-256. Returns hex digest.
 */
export function hashApiKey(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex')
}

/**
 * Generate a new API key secret with a recognisable prefix.
 * Format: af_live_<32 random url-safe chars>
 */
export function generateApiKeySecret(): { secret: string; prefix: string } {
  const rand = crypto.randomBytes(24).toString('base64url')
  const secret = `af_live_${rand}`
  // prefix for display: last 4 chars
  const prefix = secret.slice(-4)
  return { secret, prefix }
}

/**
 * Constant-time string compare to mitigate timing attacks on key lookup
 * (not strictly needed since we hash-lookup, but used for direct compares).
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

/**
 * Generate a random opaque token (e.g. for OAuth state).
 */
export function randomToken(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('hex')
}
