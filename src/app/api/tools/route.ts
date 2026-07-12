import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tools — list the tool catalog (optionally filtered by category/provider)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const provider = searchParams.get('provider')
  const q = searchParams.get('q')?.toLowerCase()

  const where: { category?: string; provider?: string; OR?: unknown[] } = {}
  if (category) where.category = category
  if (provider) where.provider = provider
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { description: { contains: q } },
      { slug: { contains: q } },
    ]
  }

  const tools = await db.tool.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json({
    tools: tools.map((t) => ({
      ...t,
      inputSchema: JSON.parse(t.inputSchema),
      outputSchema: t.outputSchema ? JSON.parse(t.outputSchema) : null,
    })),
    count: tools.length,
  })
}
