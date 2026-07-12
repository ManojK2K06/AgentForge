import { NextResponse } from 'next/server'
import { authenticateApiRequest, hasScope } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/v1/tools — list enabled tools (machine-readable, for AI agent discovery)
// Requires scope: tools:read
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req)
  if (!auth.ok || !auth.ctx) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 })
  }
  if (!hasScope(auth.ctx, 'tools:read')) {
    return NextResponse.json({ error: 'Missing scope: tools:read' }, { status: 403 })
  }
  const tools = await db.tool.findMany({ where: { enabled: true }, orderBy: { slug: 'asc' } })
  return NextResponse.json({
    tools: tools.map((t) => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      category: t.category,
      provider: t.provider,
      authScheme: t.authScheme,
      inputSchema: JSON.parse(t.inputSchema),
    })),
  })
}
