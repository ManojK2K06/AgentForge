import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOperatorId } from '@/lib/session'
import { executeTool } from '@/lib/tools/engine'
import { audit, clientIp } from '@/lib/audit'

// POST /api/execute-internal
// Dashboard-internal tool execution that uses the operator's connected
// integrations directly (no API key required). Used by the Catalog "Try it"
// tab and the "Re-run" button in execution logs.
//
// Body: { tool: string, input: object, integrationId?: string }
export async function POST(req: Request) {
  const operatorId = await getOperatorId()
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { tool, input, integrationId } = body as {
    tool?: string
    input?: Record<string, unknown>
    integrationId?: string
  }
  if (!tool || typeof tool !== 'string') {
    return NextResponse.json({ error: 'Field "tool" (slug) is required' }, { status: 400 })
  }

  const result = await executeTool({
    toolSlug: tool,
    input: input ?? {},
    integrationId: integrationId ?? null,
    userId: operatorId,
  })

  await audit({
    action: 'tool.execute',
    actorType: 'user',
    userId: operatorId,
    targetType: 'tool',
    targetId: tool,
    metadata: { tool, status: result.status, durationMs: result.durationMs, via: 'dashboard' },
    ipAddress: clientIp(req),
  })

  const status = result.status === 'success' ? 200 : result.status === 'auth_failed' ? 401 : 502
  return NextResponse.json(
    {
      executionId: result.executionId,
      status: result.status,
      output: result.output,
      error: result.errorMessage,
      durationMs: result.durationMs,
    },
    { status },
  )
}
