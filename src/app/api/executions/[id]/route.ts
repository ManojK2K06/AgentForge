import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/executions/[id]
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const e = await db.execution.findUnique({
    where: { id },
    include: { tool: { select: { slug: true, name: true, provider: true, category: true, iconKey: true } } },
  })
  if (!e) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    execution: {
      id: e.id,
      status: e.status,
      tool: e.tool,
      durationMs: e.durationMs,
      errorMessage: e.errorMessage,
      input: e.input ? safeParse(e.input) : null,
      output: e.output ? safeParse(e.output) : null,
      createdAt: e.createdAt,
      integrationId: e.integrationId,
      apiKeyId: e.apiKeyId,
    },
  })
}

function safeParse(s: string) {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}
