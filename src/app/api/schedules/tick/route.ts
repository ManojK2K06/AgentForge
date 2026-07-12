import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOperatorId } from '@/lib/session'
import { executeTool } from '@/lib/tools/engine'
import { computeNextRun } from '../route'

// POST /api/schedules/tick
// Processes all due schedules. Called by the client-side interval (every 60s)
// AND by the external schedule-runner mini-service if running.
// This endpoint is idempotent — safe to call multiple times.
export async function POST() {
  const operatorId = await getOperatorId()
  const now = new Date()

  const due = await db.schedule.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
  })

  const results: { id: string; toolSlug: string; status: string; error?: string }[] = []

  for (const sched of due) {
    if (sched.userId !== operatorId) continue
    try {
      let input: Record<string, unknown> = {}
      try {
        input = JSON.parse(sched.input)
      } catch {}

      const result = await executeTool({
        toolSlug: sched.toolSlug,
        input,
        userId: sched.userId,
      })

      const next = computeNextRun(sched.cronExpr)
      await db.schedule.update({
        where: { id: sched.id },
        data: {
          lastRunAt: new Date(),
          nextRunAt: next,
          runCount: { increment: 1 },
          lastStatus: result.status,
        },
      })

      results.push({
        id: sched.id,
        toolSlug: sched.toolSlug,
        status: result.status,
        error: result.errorMessage,
      })
    } catch (e) {
      // Mark as error but continue processing other schedules
      const next = computeNextRun(sched.cronExpr)
      await db.schedule.update({
        where: { id: sched.id },
        data: {
          lastRunAt: new Date(),
          nextRunAt: next,
          runCount: { increment: 1 },
          lastStatus: 'error',
        },
      })
      results.push({
        id: sched.id,
        toolSlug: sched.toolSlug,
        status: 'error',
        error: (e as Error).message,
      })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
