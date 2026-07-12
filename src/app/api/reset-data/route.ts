import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOperatorId } from '@/lib/session'
import { audit } from '@/lib/audit'

// POST /api/reset-data
// Clears ALL user-generated data (executions, api keys, integrations, schedules,
// audit logs, playground sessions) while preserving the tool catalog.
// This removes all demo/test data so only real usage is tracked going forward.
export async function POST() {
  const operatorId = await getOperatorId()

  // Delete in dependency order (children first)
  const result = await db.$transaction([
    db.execution.deleteMany({}),
    db.auditLog.deleteMany({}),
    db.playgroundSession.deleteMany({}),
    db.schedule.deleteMany({}),
    db.apiKey.deleteMany({}),
    db.integration.deleteMany({}),
  ])

  // Log the reset action (after clearing, so this is the first new audit entry)
  await audit({
    action: 'data.reset',
    actorType: 'user',
    userId: operatorId,
    metadata: {
      executions: result[0].count,
      auditLogs: result[1].count,
      playgroundSessions: result[2].count,
      schedules: result[3].count,
      apiKeys: result[4].count,
      integrations: result[5].count,
    },
  })

  return NextResponse.json({
    ok: true,
    cleared: {
      executions: result[0].count,
      auditLogs: result[1].count,
      playgroundSessions: result[2].count,
      schedules: result[3].count,
      apiKeys: result[4].count,
      integrations: result[5].count,
    },
    preserved: {
      toolCatalog: 'unchanged (14 tools remain)',
    },
  })
}
