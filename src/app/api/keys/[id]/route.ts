import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOperatorId } from '@/lib/session'
import { audit, clientIp } from '@/lib/audit'
import { reset } from '@/lib/rate-limit'

interface Params {
  params: Promise<{ id: string }>
}

// PATCH /api/keys/[id] — revoke or update name/scopes/rate-limit
// Body: { action: 'revoke' | 'update', name?, scopes?, rateLimitPerMin? }
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const operatorId = await getOperatorId()
  const key = await db.apiKey.findUnique({ where: { id } })
  if (!key || key.userId !== operatorId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const body = await req.json().catch(() => ({}))
  const { action, name, scopes, rateLimitPerMin } = body as {
    action?: string
    name?: string
    scopes?: string[]
    rateLimitPerMin?: number
  }
  if (action === 'revoke') {
    if (key.revokedAt) return NextResponse.json({ ok: true, alreadyRevoked: true })
    const updated = await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } })
    reset(`apikey:${id}`)
    await audit({
      action: 'api_key.revoke',
      actorType: 'user',
      userId: operatorId,
      targetType: 'api_key',
      targetId: id,
      metadata: { name: updated.name },
      ipAddress: clientIp(req),
    })
    return NextResponse.json({ ok: true, revokedAt: updated.revokedAt })
  }
  const data: { name?: string; scopes?: string; rateLimitPerMin?: number } = {}
  if (name) data.name = name
  if (scopes && Array.isArray(scopes)) data.scopes = scopes.join(',')
  if (rateLimitPerMin) data.rateLimitPerMin = Math.min(Math.max(Number(rateLimitPerMin), 1), 600)
  const updated = await db.apiKey.update({ where: { id }, data })
  await audit({
    action: 'api_key.update',
    actorType: 'user',
    userId: operatorId,
    targetType: 'api_key',
    targetId: id,
    metadata: { name: updated.name, scopes: updated.scopes, rateLimitPerMin: updated.rateLimitPerMin },
    ipAddress: clientIp(req),
  })
  return NextResponse.json({ ok: true, id: updated.id, name: updated.name })
}

// DELETE /api/keys/[id] — hard delete (also revokes)
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params
  const operatorId = await getOperatorId()
  const key = await db.apiKey.findUnique({ where: { id } })
  if (!key || key.userId !== operatorId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await db.apiKey.delete({ where: { id } })
  reset(`apikey:${id}`)
  await audit({
    action: 'api_key.delete',
    actorType: 'user',
    userId: operatorId,
    targetType: 'api_key',
    targetId: id,
    metadata: { name: key.name },
    ipAddress: clientIp(req),
  })
  return NextResponse.json({ ok: true })
}
