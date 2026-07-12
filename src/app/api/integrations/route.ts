import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOperatorId } from '@/lib/session'
import { audit, clientIp } from '@/lib/audit'
import { encryptCredentials } from '@/lib/crypto'
import { PROVIDER_META } from '@/lib/tools/catalog'

// GET /api/integrations — list connected apps
export async function GET() {
  const operatorId = await getOperatorId()
  const integrations = await db.integration.findMany({
    where: { userId: operatorId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    integrations: integrations.map((i) => {
      const meta = PROVIDER_META[i.provider]
      let metaObj: Record<string, unknown> = {}
      try {
        metaObj = JSON.parse(i.meta)
      } catch {}
      return {
        id: i.id,
        name: i.name,
        provider: i.provider,
        providerLabel: meta?.name ?? i.provider,
        authScheme: i.authScheme,
        status: i.status,
        lastValidatedAt: i.lastValidatedAt,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
        meta: metaObj,
        credentialKeys: meta?.credentialFields.map((f) => ({ key: f.key, label: f.label, required: f.required })) ?? [],
      }
    }),
  })
}

// POST /api/integrations — create a new connected app
export async function POST(req: Request) {
  const operatorId = await getOperatorId()
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { name, provider, credentials } = body as {
    name?: string
    provider?: string
    credentials?: Record<string, unknown>
  }
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!provider || !PROVIDER_META[provider]) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
  }
  const meta = PROVIDER_META[provider]!
  for (const f of meta.credentialFields) {
    if (f.required && (credentials?.[f.key] === undefined || credentials?.[f.key] === '')) {
      return NextResponse.json({ error: `Missing required credential field: ${f.key}` }, { status: 400 })
    }
  }

  const enc = encryptCredentials(credentials ?? {})
  const integ = await db.integration.create({
    data: {
      name,
      provider,
      authScheme: meta.authSchemes[0] ?? 'none',
      credentials: enc,
      status: 'active',
      meta: JSON.stringify({ createdVia: 'manual' }),
      userId: operatorId,
    },
  })
  await audit({
    action: 'integration.create',
    actorType: 'user',
    userId: operatorId,
    targetType: 'integration',
    targetId: integ.id,
    metadata: { name, provider },
    ipAddress: clientIp(req),
  })
  return NextResponse.json({ ok: true, id: integ.id, name: integ.name, provider: integ.provider })
}
