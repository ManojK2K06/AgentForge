import { NextResponse } from 'next/server'
import { authenticateApiRequest, hasScope, auditApiKey } from '@/lib/auth'
import { executeTool } from '@/lib/tools/engine'
import { clientIp } from '@/lib/audit'

// POST /api/v1/execute
// The primary public API endpoint that AI agents call to invoke a tool.
// Headers: Authorization: Bearer af_live_...
// Body: { tool: "<slug>", input: { ...args }, integrationId?: "..." }
//
// Enforces: API key auth, scope check (tools:execute), per-key rate limit,
// input validation, execution timeout, error normalisation, and audit logging.
export async function POST(req: Request) {
  const authResult = await authenticateApiRequest(req)
  if (!authResult.ok || !authResult.ctx) {
    return NextResponse.json(
      { error: authResult.error ?? 'Unauthorized' },
      { status: authResult.status ?? 401, headers: authResult.rateLimitHeaders },
    )
  }
  const ctx = authResult.ctx
  if (!hasScope(ctx, 'tools:execute')) {
    return NextResponse.json(
      { error: 'API key missing required scope: tools:execute' },
      { status: 403, headers: authResult.rateLimitHeaders },
    )
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: authResult.rateLimitHeaders })
  }
  const { tool, input, integrationId } = body as { tool?: string; input?: Record<string, unknown>; integrationId?: string }
  if (!tool || typeof tool !== 'string') {
    return NextResponse.json({ error: 'Field "tool" (slug) is required' }, { status: 400, headers: authResult.rateLimitHeaders })
  }
  if (input !== undefined && (typeof input !== 'object' || Array.isArray(input))) {
    return NextResponse.json({ error: 'Field "input" must be an object' }, { status: 400, headers: authResult.rateLimitHeaders })
  }

  const result = await executeTool({
    toolSlug: tool,
    input: input ?? {},
    integrationId: integrationId ?? null,
    apiKeyId: ctx.apiKeyId,
    userId: ctx.userId,
  })

  await auditApiKey(ctx, 'tool.execute', req, {
    tool,
    status: result.status,
    durationMs: result.durationMs,
    executionId: result.executionId,
  })

  const status = result.status === 'success' ? 200 : result.status === 'rate_limited' ? 429 : result.status === 'auth_failed' ? 401 : result.status === 'timeout' ? 504 : 502
  return NextResponse.json(
    {
      executionId: result.executionId,
      status: result.status,
      output: result.output,
      error: result.errorMessage,
      durationMs: result.durationMs,
    },
    { status, headers: authResult.rateLimitHeaders },
  )
}

// GET /api/v1/execute — not supported; inform caller
export async function GET() {
  return NextResponse.json({ error: 'Use POST with a Bearer API key to execute tools.' }, { status: 405 })
}
