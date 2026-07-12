import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOperatorId } from '@/lib/session'
import { executeTool } from '@/lib/tools/engine'

// POST /api/rerun
// Re-execute a past execution by its ID, using the same tool + input.
// Body: { executionId: string }
export async function POST(req: Request) {
  const operatorId = await getOperatorId()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { executionId } = body as { executionId?: string }
  if (!executionId) return NextResponse.json({ error: 'executionId is required' }, { status: 400 })

  const prev = await db.execution.findUnique({
    where: { id: executionId },
    include: { tool: true },
  })
  if (!prev) return NextResponse.json({ error: 'Execution not found' }, { status: 404 })

  let input: Record<string, unknown> = {}
  try {
    input = JSON.parse(prev.input)
  } catch {}

  const result = await executeTool({
    toolSlug: prev.tool.slug,
    input,
    integrationId: prev.integrationId,
    userId: operatorId,
  })

  return NextResponse.json({
    executionId: result.executionId,
    status: result.status,
    output: result.output,
    error: result.errorMessage,
    durationMs: result.durationMs,
    originalExecutionId: executionId,
  })
}
