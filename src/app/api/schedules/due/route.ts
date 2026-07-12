import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOperatorId } from '@/lib/session'

// GET /api/schedules/due — returns enabled schedules whose nextRunAt <= now
// Used by the schedule-runner mini-service.
export async function GET() {
  const operatorId = await getOperatorId()
  const now = new Date()
  const due = await db.schedule.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
  })
  return NextResponse.json({
    schedules: due
      .filter((s) => s.userId === operatorId)
      .map((s) => ({
        id: s.id,
        toolSlug: s.toolSlug,
        input: JSON.parse(s.input),
        cronExpr: s.cronExpr,
      })),
  })
}
