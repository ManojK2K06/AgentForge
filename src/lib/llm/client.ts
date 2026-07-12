// Unified LLM client — calls any OpenAI-compatible or Anthropic API.
//
// Most AI providers now support the OpenAI Chat Completions format:
//   POST {baseUrl}/chat/completions
//   Headers: Authorization: Bearer {apiKey}
//   Body: { model, messages, temperature, tools?, ... }
//
// This covers: OpenAI, Groq, Together, Mistral, DeepSeek, Fireworks,
// Anyscale, Ollama, vLLM, LM Studio, Google Gemini (OpenAI-compat endpoint),
// and any custom OpenAI-compatible server.
//
// Anthropic uses a different native API (Messages API), so we detect it
// and call the Anthropic endpoint directly.

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
}

export interface LlmToolDef {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export interface LlmCompletionResult {
  content: string
  toolCalls?: LlmMessage['tool_calls']
  model: string
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  raw: unknown
}

export interface LlmConfig {
  provider: string        // 'openai' | 'anthropic' | 'groq' | 'deepseek' | etc.
  baseUrl: string         // e.g. 'https://api.openai.com/v1'
  apiKey: string
  model: string           // e.g. 'gpt-4o', 'claude-3-5-sonnet-20241022'
}

// Anthropic providers use a different API shape
const ANTHROID_PROVIDERS = ['anthropic']

function isAnthropic(provider: string): boolean {
  return ANTHROID_PROVIDERS.includes(provider)
}

/**
 * Call any LLM provider with a chat completion request.
 * Supports function calling (tools) for agentic use cases.
 */
export async function chatCompletion(
  config: LlmConfig,
  messages: LlmMessage[],
  options?: {
    temperature?: number
    maxTokens?: number
    tools?: LlmToolDef[]
    signal?: AbortSignal
  },
): Promise<LlmCompletionResult> {
  if (isAnthropic(config.provider)) {
    return callAnthropic(config, messages, options)
  }
  return callOpenAICompatible(config, messages, options)
}

/**
 * OpenAI-compatible chat completion (works for 90% of providers).
 */
async function callOpenAICompatible(
  config: LlmConfig,
  messages: LlmMessage[],
  options?: {
    temperature?: number
    maxTokens?: number
    tools?: LlmToolDef[]
    signal?: AbortSignal
  },
): Promise<LlmCompletionResult> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
  const body: Record<string, unknown> = {
    model: config.model,
    messages: messages.map((m) => {
      // OpenAI format: assistant messages with tool_calls need content: null
      if (m.role === 'assistant' && m.tool_calls) {
        return { role: m.role, content: m.content ?? null, tool_calls: m.tool_calls }
      }
      if (m.role === 'tool') {
        return { role: m.role, content: m.content, tool_call_id: m.tool_call_id }
      }
      return { role: m.role, content: m.content }
    }),
    temperature: options?.temperature ?? 0.7,
  }
  if (options?.maxTokens) body.max_tokens = options.maxTokens
  if (options?.tools && options.tools.length > 0) {
    body.tools = options.tools
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`LLM API error ${res.status}: ${text.slice(0, 500)}`)
  }

  const data = JSON.parse(text)
  const choice = data.choices?.[0]
  return {
    content: choice?.message?.content ?? '',
    toolCalls: choice?.message?.tool_calls,
    model: data.model ?? config.model,
    usage: data.usage,
    raw: data,
  }
}

/**
 * Anthropic native Messages API.
 * POST https://api.anthropic.com/v1/messages
 * Headers: x-api-key, anthropic-version
 */
async function callAnthropic(
  config: LlmConfig,
  messages: LlmMessage[],
  options?: {
    temperature?: number
    maxTokens?: number
    tools?: LlmToolDef[]
    signal?: AbortSignal
  },
): Promise<LlmCompletionResult> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/messages`

  // Anthropic separates system message from the conversation
  const systemMsg = messages.find((m) => m.role === 'system')?.content ?? ''
  const convMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m.role === 'assistant' && m.tool_calls) {
        return {
          role: 'assistant',
          content: [
            ...(m.content ? [{ type: 'text', text: m.content }] : []),
            ...m.tool_calls.map((tc) => ({
              type: 'tool_use',
              id: tc.id,
              name: tc.function.name,
              input: JSON.parse(tc.function.arguments || '{}'),
            })),
          ],
        }
      }
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }],
        }
      }
      return { role: m.role, content: m.content }
    })

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: options?.maxTokens ?? 4096,
    messages: convMessages,
    temperature: options?.temperature ?? 0.7,
  }
  if (systemMsg) body.system = systemMsg

  // Anthropic tool format
  if (options?.tools && options.tools.length > 0) {
    body.tools = options.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }))
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 500)}`)
  }

  const data = JSON.parse(text)

  // Convert Anthropic response to OpenAI-like format
  let content = ''
  let toolCalls: LlmMessage['tool_calls'] | undefined
  for (const block of data.content ?? []) {
    if (block.type === 'text') content += block.text
    if (block.type === 'tool_use') {
      toolCalls = toolCalls ?? []
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: { name: block.name, arguments: JSON.stringify(block.input) },
      })
    }
  }

  return {
    content,
    toolCalls,
    model: data.model ?? config.model,
    usage: {
      prompt_tokens: data.usage?.input_tokens,
      completion_tokens: data.usage?.output_tokens,
      total_tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
    },
    raw: data,
  }
}

/**
 * Test an LLM connection by sending a simple "Hello" prompt.
 * Returns { ok, model, response, latencyMs } or throws.
 */
export async function testLlmConnection(config: LlmConfig): Promise<{
  ok: boolean
  model: string
  response: string
  latencyMs: number
}> {
  const start = Date.now()
  const result = await chatCompletion(config, [
    { role: 'user', content: 'Say "Connection successful" in exactly 2 words.' },
  ], { temperature: 0, maxTokens: 20 })
  return {
    ok: true,
    model: result.model,
    response: result.content.slice(0, 100),
    latencyMs: Date.now() - start,
  }
}

/**
 * Get the user's configured LLM from their integrations.
 * Returns the first active LLM integration, or null if none configured.
 */
export async function getConfiguredLlm(): Promise<{ config: LlmConfig; integrationId: string } | null> {
  const { db } = await import('../db')
  const { getOperatorId } = await import('../session')
  const { decryptCredentials } = await import('../crypto')

  const operatorId = await getOperatorId()
  const integ = await db.integration.findFirst({
    where: {
      userId: operatorId,
      status: 'active',
      provider: { in: LLM_PROVIDERS.map((p) => p.id) },
    },
    orderBy: { createdAt: 'asc' },
  })
  if (!integ) return null

  const creds = decryptCredentials(integ.credentials)
  return {
    config: {
      provider: integ.provider,
      baseUrl: (creds.baseUrl as string) ?? '',
      apiKey: (creds.apiKey as string) ?? '',
      model: (creds.model as string) ?? '',
    },
    integrationId: integ.id,
  }
}

// Registry of supported LLM providers with preset base URLs and popular models
export const LLM_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: 'sparkles',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini', 'o3-mini'],
    connectUrl: 'https://platform.openai.com/api-keys',
    connectLabel: 'Get OpenAI API Key',
    description: 'GPT-4o, o1, o3-mini reasoning models',
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    icon: 'sparkles',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    connectUrl: 'https://console.anthropic.com/settings/keys',
    connectLabel: 'Get Anthropic API Key',
    description: 'Claude 3.5 Sonnet, Haiku, Opus',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    icon: 'sparkles',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    connectUrl: 'https://aistudio.google.com/apikey',
    connectLabel: 'Get Gemini API Key',
    description: 'Gemini 2.0 Flash, 1.5 Pro/Flash',
  },
  {
    id: 'groq',
    name: 'Groq (Ultra-Fast)',
    icon: 'sparkles',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    connectUrl: 'https://console.groq.com/keys',
    connectLabel: 'Get Groq API Key',
    description: 'Fastest inference — Llama 3.3 70B, Mixtral',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: 'sparkles',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    connectUrl: 'https://platform.deepseek.com/api_keys',
    connectLabel: 'Get DeepSeek API Key',
    description: 'DeepSeek Chat & Reasoner (cheap, strong)',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    icon: 'sparkles',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'mistral-small-latest', 'open-mixtral-8x22b', 'open-mistral-7b'],
    connectUrl: 'https://console.mistral.ai/api-keys',
    connectLabel: 'Get Mistral API Key',
    description: 'Mistral Large, Small, Mixtral',
  },
  {
    id: 'together',
    name: 'Together AI',
    icon: 'sparkles',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
    connectUrl: 'https://api.together.xyz/settings/api-keys',
    connectLabel: 'Get Together API Key',
    description: '200+ open-source models',
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    icon: 'sparkles',
    defaultBaseUrl: 'https://api.fireworks.ai/inference/v1',
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    models: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/qwen2p5-72b-instruct'],
    connectUrl: 'https://fireworks.ai/api-keys',
    connectLabel: 'Get Fireworks API Key',
    description: 'Fast open-model inference',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    icon: 'sparkles',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'llama3.1', 'qwen2.5', 'mistral', 'phi3', 'gemma2'],
    connectUrl: 'https://ollama.com/download',
    connectLabel: 'Install Ollama',
    description: 'Run models locally — free, private, offline',
  },
  {
    id: 'openai_compatible',
    name: 'Custom (OpenAI-compatible)',
    icon: 'sparkles',
    defaultBaseUrl: '',
    defaultModel: '',
    models: [],
    connectUrl: null,
    connectLabel: null,
    description: 'Any OpenAI-compatible API (vLLM, LM Studio, LiteLLM, etc.)',
  },
] as const
