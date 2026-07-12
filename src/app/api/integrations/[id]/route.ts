import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOperatorId } from '@/lib/session'
import { audit, clientIp } from '@/lib/audit'
import { encryptCredentials } from '@/lib/crypto'
import { PROVIDER_META } from '@/lib/tools/catalog'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/integrations/[id]
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const operatorId = await getOperatorId()
  const integ = await db.integration.findUnique({ where: { id } })
  if (!integ || integ.userId !== operatorId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const meta = PROVIDER_META[integ.provider]
  let metaObj: Record<string, unknown> = {}
  try {
    metaObj = JSON.parse(integ.meta)
  } catch {}
  return NextResponse.json({
    integration: {
      id: integ.id,
      name: integ.name,
      provider: integ.provider,
      providerLabel: meta?.name ?? integ.provider,
      authScheme: integ.authScheme,
      status: integ.status,
      lastValidatedAt: integ.lastValidatedAt,
      createdAt: integ.createdAt,
      updatedAt: integ.updatedAt,
      meta: metaObj,
      credentialFields: meta?.credentialFields ?? [],
      // Never return credential values; only which keys are configured
      hasCredentials: (meta?.credentialFields ?? []).map((f) => ({ key: f.key, label: f.label })),
    },
  })
}

// PATCH /api/integrations/[id] — update name or rotate credentials
// Body: { name?: string, credentials?: { ... } }  (credentials fully replaces)
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const operatorId = await getOperatorId()
  const integ = await db.integration.findUnique({ where: { id } })
  if (!integ || integ.userId !== operatorId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const body = await req.json().catch(() => ({}))
  const { name, credentials } = body as { name?: string; credentials?: Record<string, unknown> }
  const data: { name?: string; credentials?: string } = {}
  if (name) data.name = name
  if (credentials) {
    const meta = PROVIDER_META[integ.provider]
    if (meta) {
      for (const f of meta.credentialFields) {
        if (f.required && (credentials[f.key] === undefined || credentials[f.key] === '')) {
          return NextResponse.json({ error: `Missing required credential field: ${f.key}` }, { status: 400 })
        }
      }
    }
    data.credentials = encryptCredentials(credentials)
  }
  const updated = await db.integration.update({ where: { id }, data })
  await audit({
    action: 'integration.update',
    actorType: 'user',
    userId: operatorId,
    targetType: 'integration',
    targetId: id,
    metadata: { name: updated.name, rotatedCredentials: !!credentials },
    ipAddress: clientIp(req),
  })
  return NextResponse.json({ ok: true, id: updated.id, name: updated.name })
}

// DELETE /api/integrations/[id] — revoke and delete
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params
  const operatorId = await getOperatorId()
  const integ = await db.integration.findUnique({ where: { id } })
  if (!integ || integ.userId !== operatorId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await db.integration.delete({ where: { id } })
  await audit({
    action: 'integration.delete',
    actorType: 'user',
    userId: operatorId,
    targetType: 'integration',
    targetId: id,
    metadata: { name: integ.name, provider: integ.provider },
    ipAddress: clientIp(req),
  })
  return NextResponse.json({ ok: true })
}
