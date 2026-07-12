import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOperatorId } from '@/lib/session'
import { audit, clientIp } from '@/lib/audit'
import { generateApiKeySecret, hashApiKey } from '@/lib/crypto'

// GET /api/keys — list API keys (without secrets, which are hashed & not recoverable)
export async function GET() {
  const operatorId = await getOperatorId()
  const keys = await db.apiKey.findMany({
    where: { userId: operatorId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes.split(','),
      rateLimitPerMin: k.rateLimitPerMin,
      lastUsedAt: k.lastUsedAt,
      revokedAt: k.revokedAt,
      createdAt: k.createdAt,
      // mask: show ...<last4>
      masked: `af_live_••••••••••••••••${k.keyPrefix}`,
    })),
  })
}

// POST /api/keys — create a new API key. Returns the plaintext secret ONCE.
// Body: { name: string, scopes?: string[], rateLimitPerMin?: number }
export async function POST(req: Request) {
  const operatorId = await getOperatorId()
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { name, scopes, rateLimitPerMin } = body as {
    name?: string
    scopes?: string[]
    rateLimitPerMin?: number
  }
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  const allowedScopes = [
    'tools:execute',
    'tools:read',
    'integrations:read',
    'executions:read',
    'playground:use',
    'admin',
  ]
  const finalScopes = scopes && Array.isArray(scopes) ? scopes.filter((s) => allowedScopes.includes(s)) : ['tools:execute', 'tools:read', 'integrations:read']
  if (finalScopes.length === 0) finalScopes.push('tools:execute')

  const limit = Math.min(Math.max(Number(rateLimitPerMin ?? 120), 1), 600)

  const { secret, prefix } = generateApiKeySecret()
  const keyHash = hashApiKey(secret)
  const key = await db.apiKey.create({
    data: {
      name,
      keyHash,
      keyPrefix: prefix,
      scopes: finalScopes.join(','),
      rateLimitPerMin: limit,
      userId: operatorId,
    },
  })
  await audit({
    action: 'api_key.create',
    actorType: 'user',
    userId: operatorId,
    targetType: 'api_key',
    targetId: key.id,
    metadata: { name, scopes: finalScopes, rateLimitPerMin: limit },
    ipAddress: clientIp(req),
  })
  // Plaintext secret shown exactly once
  return NextResponse.json({
    ok: true,
    id: key.id,
    name: key.name,
    secret, // af_live_...
    keyPrefix: prefix,
    scopes: finalScopes,
    rateLimitPerMin: limit,
    createdAt: key.createdAt,
    warning: 'Store this secret securely. It will not be shown again.',
  })
}
