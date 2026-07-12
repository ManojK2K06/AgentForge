import { NextResponse } from 'next/server'
import { testLlmConnection, type LlmConfig } from '@/lib/llm/client'

// POST /api/llm-test
// Tests an LLM provider connection by sending a simple prompt.
// Body: { provider, baseUrl, apiKey, model }
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { provider, baseUrl, apiKey, model } = body as {
    provider?: string
    baseUrl?: string
    apiKey?: string
    model?: string
  }

  if (!baseUrl || !model) {
    return NextResponse.json({ error: 'baseUrl and model are required' }, { status: 400 })
  }

  const config: LlmConfig = {
    provider: provider ?? 'openai_compatible',
    baseUrl,
    apiKey: apiKey || 'none',
    model,
  }

  try {
    const result = await testLlmConnection(config)
    return NextResponse.json({
      ok: true,
      model: result.model,
      response: result.response,
      latencyMs: result.latencyMs,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 502 },
    )
  }
}
