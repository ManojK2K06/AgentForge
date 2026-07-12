import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOperatorId } from '@/lib/session'
import { decryptCredentials } from '@/lib/crypto'
import { LLM_PROVIDERS } from '@/lib/llm/client'

// GET /api/llm-providers
// Returns the list of supported LLM providers + the user's configured LLM integrations
export async function GET() {
  const operatorId = await getOperatorId()

  // Get user's configured LLM integrations
  const llmProviderIds = LLM_PROVIDERS.map((p) => p.id)
  const integrations = await db.integration.findMany({
    where: {
      userId: operatorId,
      provider: { in: llmProviderIds },
    },
    orderBy: { createdAt: 'asc' },
  })

  const configured = integrations.map((i) => {
    const creds = decryptCredentials(i.credentials)
    const meta = LLM_PROVIDERS.find((p) => p.id === i.provider)
    return {
      id: i.id,
      name: i.name,
      provider: i.provider,
      providerLabel: meta?.name ?? i.provider,
      baseUrl: (creds.baseUrl as string) ?? '',
      model: (creds.model as string) ?? '',
      hasApiKey: !!(creds.apiKey),
      status: i.status,
      createdAt: i.createdAt,
    }
  })

  return NextResponse.json({
    supported: LLM_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      defaultBaseUrl: p.defaultBaseUrl,
      defaultModel: p.defaultModel,
      models: p.models,
      connectUrl: p.connectUrl,
      connectLabel: p.connectLabel,
    })),
    configured,
  })
}
