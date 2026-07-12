import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOperatorId } from '@/lib/session'
import { audit, clientIp } from '@/lib/audit'
import { computeNextRun } from '../route'

interface Params {
  params: Promise<{ id: string }>
}

// PATCH /api/schedules/[id] — toggle enable/disable or update
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const operatorId = await getOperatorId()
  const sched = await db.schedule.findUnique({ where: { id } })
  if (!sched || sched.userId !== operatorId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const body = await req.json().catch(() => ({}))
  const { action, enabled, name, cronExpr, input } = body as {
    action?: string
    enabled?: boolean
    name?: string
    cronExpr?: string
    input?: Record<string, unknown>
  }
  if (action === 'toggle') {
    const updated = await db.schedule.update({ where: { id }, data: { enabled: !sched.enabled, nextRunAt: !sched.enabled ? computeNextRun(sched.cronExpr) : null } })
    await audit({ action: 'schedule.toggle', actorType: 'user', userId: operatorId, targetType: 'schedule', targetId: id, metadata: { enabled: updated.enabled }, ipAddress: clientIp(req) })
    return NextResponse.json({ ok: true, enabled: updated.enabled })
  }
  if (action === 'mark_run') {
    const next = computeNextRun(sched.cronExpr)
    const updated = await db.schedule.update({
      where: { id },
      data: {
        lastRunAt: new Date(),
        nextRunAt: next,
        runCount: { increment: 1 },
        lastStatus: (body as { status?: string }).status ?? 'error',
      },
    })
    return NextResponse.json({ ok: true, id: updated.id, nextRunAt: next })
  }
  const data: { name?: string; cronExpr?: string; input?: string; nextRunAt?: Date } = {}
  if (name) data.name = name
  if (cronExpr) {
    const next = computeNextRun(cronExpr)
    if (!next) return NextResponse.json({ error: 'Invalid cronExpr' }, { status: 400 })
    data.cronExpr = cronExpr
    data.nextRunAt = next
  }
  if (input) data.input = JSON.stringify(input)
  const updated = await db.schedule.update({ where: { id }, data })
  return NextResponse.json({ ok: true, id: updated.id })
}

// DELETE /api/schedules/[id]
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params
  const operatorId = await getOperatorId()
  const sched = await db.schedule.findUnique({ where: { id } })
  if (!sched || sched.userId !== operatorId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await db.schedule.delete({ where: { id } })
  await audit({ action: 'schedule.delete', actorType: 'user', userId: operatorId, targetType: 'schedule', targetId: id, metadata: { name: sched.name }, ipAddress: clientIp(req) })
  return NextResponse.json({ ok: true })
}
