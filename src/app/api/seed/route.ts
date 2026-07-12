import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedToolCatalog } from '@/lib/tools/engine'
import { getOperatorId } from '@/lib/session'
import { audit } from '@/lib/audit'

// POST /api/seed — idempotently seed the tool catalog from the in-code registry.
// Also bootstraps the operator user. Safe to call repeatedly.
export async function POST() {
  const operatorId = await getOperatorId()
  const result = await seedToolCatalog()
  await audit({
    action: 'catalog.seed',
    actorType: 'system',
    userId: operatorId,
    metadata: result,
  })
  const counts = await db.tool.groupBy({ by: ['category'], _count: true })
  return NextResponse.json({
    ok: true,
    seeded: result,
    totalTools: await db.tool.count(),
    byCategory: counts,
  })
}
