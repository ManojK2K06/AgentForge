import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/audit — recent audit log entries
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const action = searchParams.get('action')
  const where: { action?: string } = {}
  if (action) where.action = action
  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json({
    entries: rows.map((r) => ({
      ...r,
      metadata: safeParse(r.metadata),
    })),
  })
}

function safeParse(s: string) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
