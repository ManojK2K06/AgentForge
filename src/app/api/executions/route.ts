import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/executions — list recent executions
// Query: ?limit=50&status=success&toolId=...&cursor=<createdAt iso>
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const status = searchParams.get('status')
  const toolId = searchParams.get('toolId')
  const cursor = searchParams.get('cursor')

  const where: { status?: string; toolId?: string; createdAt?: { lt: Date } } = {}
  if (status) where.status = status
  if (toolId) where.toolId = toolId
  if (cursor) where.createdAt = { lt: new Date(cursor) }

  const rows = await db.execution.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { tool: { select: { slug: true, name: true, provider: true, category: true, iconKey: true } } },
  })

  return NextResponse.json({
    executions: rows.map((e) => ({
      id: e.id,
      status: e.status,
      tool: e.tool,
      durationMs: e.durationMs,
      errorMessage: e.errorMessage,
      input: e.input ? JSON.parse(e.input) : null,
      output: e.output ? safeParse(e.output) : null,
      createdAt: e.createdAt,
    })),
    nextCursor: rows.length === limit ? rows[rows.length - 1]!.createdAt.toISOString() : null,
  })
}

function safeParse(s: string) {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}
