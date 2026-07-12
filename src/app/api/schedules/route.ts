import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOperatorId } from '@/lib/session'
import { audit, clientIp } from '@/lib/audit'
import { getToolBySlug } from '@/lib/tools/catalog'

// GET /api/schedules — list all schedules for the operator
export async function GET() {
  const operatorId = await getOperatorId()
  const schedules = await db.schedule.findMany({
    where: { userId: operatorId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    schedules: schedules.map((s) => ({
      ...s,
      input: JSON.parse(s.input),
    })),
  })
}

// POST /api/schedules — create a new scheduled tool execution
// Body: { name, toolSlug, input: {...}, cronExpr: "every_5m" | "every_1h" | "daily_09:00" }
export async function POST(req: Request) {
  const operatorId = await getOperatorId()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { name, toolSlug, input, cronExpr } = body as {
    name?: string
    toolSlug?: string
    input?: Record<string, unknown>
    cronExpr?: string
  }
  if (!name || !toolSlug || !cronExpr) {
    return NextResponse.json({ error: 'name, toolSlug, and cronExpr are required' }, { status: 400 })
  }
  const tool = getToolBySlug(toolSlug)
  if (!tool) return NextResponse.json({ error: `Unknown tool: ${toolSlug}` }, { status: 400 })

  const nextRunAt = computeNextRun(cronExpr)
  if (!nextRunAt) {
    return NextResponse.json({ error: `Invalid cronExpr: ${cronExpr}. Use 'every_5m', 'every_1h', 'every_12h', or 'daily_HH:MM'.` }, { status: 400 })
  }

  const sched = await db.schedule.create({
    data: {
      name,
      toolSlug,
      input: JSON.stringify(input ?? {}),
      cronExpr,
      nextRunAt,
      userId: operatorId,
    },
  })
  await audit({
    action: 'schedule.create',
    actorType: 'user',
    userId: operatorId,
    targetType: 'schedule',
    targetId: sched.id,
    metadata: { name, toolSlug, cronExpr },
    ipAddress: clientIp(req),
  })
  return NextResponse.json({ ok: true, id: sched.id, nextRunAt })
}

// Parse cron expressions like "every_5m", "every_1h", "every_12h", "daily_09:00"
export function computeNextRun(expr: string): Date | null {
  const now = new Date()
  const everyMatch = expr.match(/^every_(\d+)([mh])$/)
  if (everyMatch) {
    const n = Number(everyMatch[1])
    const unit = everyMatch[2]
    const ms = unit === 'm' ? n * 60_000 : n * 3_600_000
    return new Date(now.getTime() + ms)
  }
  const dailyMatch = expr.match(/^daily_(\d{2}):(\d{2})$/)
  if (dailyMatch) {
    const h = Number(dailyMatch[1])
    const m = Number(dailyMatch[2])
    if (h > 23 || m > 59) return null
    const next = new Date(now)
    next.setHours(h, m, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    return next
  }
  return null
}
