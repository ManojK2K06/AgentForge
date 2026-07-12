import { db } from './db'
import { consume } from './rate-limit'
import { audit, clientIp } from './audit'
import { randomToken } from './crypto'

export interface AuthContext {
  apiKeyId: string
  userId: string
  scopes: string[]
  rateLimitPerMin: number
  keyPrefix: string
}

export interface AuthResult {
  ok: boolean
  ctx?: AuthContext
  error?: string
  status?: number
  rateLimitHeaders?: Record<string, string>
}

/**
 * Authenticate an incoming /v1/* request via `Authorization: Bearer af_live_...`.
 * Returns auth context, or an error result suitable for HTTP response.
 */
export async function authenticateApiRequest(req: Request): Promise<AuthResult> {
  const auth = req.headers.get('authorization') ?? ''
  const parts = auth.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return { ok: false, error: 'Missing or malformed Authorization header. Expected: Bearer <api_key>', status: 401 }
  }
  const secret = parts[1]!.trim()
  const { hashApiKey } = await import('./crypto')
  const keyHash = hashApiKey(secret)
  const key = await db.apiKey.findUnique({
    where: { keyHash },
    include: { user: true },
  })
  if (!key || key.revokedAt) {
    return { ok: false, error: 'Invalid or revoked API key', status: 401 }
  }

  // Rate limit check
  const rl = consume(`apikey:${key.id}`, key.rateLimitPerMin)
  const rateLimitHeaders: Record<string, string> = {
    'X-RateLimit-Limit': String(rl.limit),
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(Math.ceil(rl.resetAt / 1000)),
  }
  if (!rl.allowed) {
    return {
      ok: false,
      error: 'Rate limit exceeded. Try again in a few seconds.',
      status: 429,
      rateLimitHeaders,
    }
  }

  // Update lastUsedAt (fire and forget)
  db.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  return {
    ok: true,
    ctx: {
      apiKeyId: key.id,
      userId: key.userId,
      scopes: key.scopes.split(',').map((s) => s.trim()).filter(Boolean),
      rateLimitPerMin: key.rateLimitPerMin,
      keyPrefix: key.keyPrefix,
    },
    rateLimitHeaders,
  }
}

export function hasScope(ctx: AuthContext, scope: string): boolean {
  // scopes are granular e.g. "tools:execute". wildcard "admin" grants all.
  if (ctx.scopes.includes('admin')) return true
  return ctx.scopes.includes(scope)
}

/**
 * Internal-use: generate a CSRF/state token for OAuth flows.
 */
export function issueStateToken(): string {
  return randomToken(16)
}

/**
 * Log an API-key-originated action.
 */
export async function auditApiKey(
  ctx: AuthContext,
  action: string,
  req: Request,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await audit({
    action,
    actorType: 'api_key',
    actorId: ctx.apiKeyId,
    ipAddress: clientIp(req),
    userId: ctx.userId,
    metadata: { ...extra, keyPrefix: ctx.keyPrefix },
  })
}
