import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOperatorId } from '@/lib/session'
import { executeTool } from '@/lib/tools/engine'
import ZAI from 'z-ai-web-dev-sdk'
import { audit, clientIp } from '@/lib/audit'
import { getConfiguredLlm, chatCompletion, type LlmConfig } from '@/lib/llm/client'

// POST /api/playground
// Body: { message: string, sessionId?: string, allowedTools?: string[] (slugs) }
// Runs a ReAct-style agent loop: LLM decides which tools to call, we execute
// them with the operator's connected integrations, and feed results back.
export async function POST(req: Request) {
  const operatorId = await getOperatorId()
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { message, sessionId, allowedTools } = body as {
    message?: string
    sessionId?: string
    allowedTools?: string[]
  }
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const toolFilter = allowedTools && allowedTools.length > 0 ? { slug: { in: allowedTools } } : {}
  const tools = await db.tool.findMany({ where: { enabled: true, ...toolFilter } })
  if (tools.length === 0) {
    return NextResponse.json({ error: 'No tools available. Seed the catalog first.' }, { status: 400 })
  }

  const functions = tools.map((t) => {
    const schema = JSON.parse(t.inputSchema)
    return {
      type: 'function' as const,
      function: { name: t.slug, description: t.description, parameters: schema },
    }
  })

  let session = sessionId ? await db.playgroundSession.findUnique({ where: { id: sessionId } }) : null
  if (!session) {
    session = await db.playgroundSession.create({
      data: { title: message.slice(0, 60), userId: operatorId, messages: '[]' },
    })
  }
  let history: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: any[] }> = []
  try {
    history = JSON.parse(session.messages)
  } catch {}

  const systemPrompt = `You are AgentForge, an AI assistant with access to external tools (integrations) that let you take real actions on the user's behalf — such as sending Slack messages, creating GitHub issues, querying Postgres, sending emails, and more.

When the user asks you to do something, choose the most appropriate tool(s) and call them. Only call a tool when clearly needed. After each tool result, summarize what happened in friendly, concise language.

If a tool call fails (auth, network, validation), explain clearly what went wrong and what the user can do to fix it (e.g. connect the integration, check credentials). Never fabricate tool results. Available tools are listed in the function definitions.`

  history.push({ role: 'user', content: message })

  // Check if user has a custom AI provider configured.
  // If yes, use it instead of the default Z.ai LLM.
  const customLlm = await getConfiguredLlm()
  const zai = customLlm ? null : await ZAI.create()
  const llmConfig: LlmConfig | null = customLlm?.config ?? null
  const llmProviderLabel = customLlm ? `${llmConfig!.provider} (${llmConfig!.model})` : 'Z.ai (built-in)'

  const toolCallLog: Array<{
    tool: string
    input: unknown
    output: unknown
    status: string
    error?: string
    durationMs: number
    executionId?: string
  }> = []
  const MAX_ITERATIONS = 6
  let assistantText = ''
  let iterations = 0

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations++
      const messagesForApi: any[] = [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => {
          if (m.role === 'tool') return { role: 'tool', content: m.content, tool_call_id: m.tool_call_id! }
          if (m.role === 'assistant' && m.tool_calls) return { role: 'assistant', content: m.content || null, tool_calls: m.tool_calls }
          return { role: m.role, content: m.content }
        }),
      ]

      // Call the appropriate LLM
      let msg: any
      if (llmConfig) {
        // Custom AI provider (OpenAI, Anthropic, Gemini, Groq, etc.)
        const result = await chatCompletion(llmConfig, messagesForApi, {
          temperature: 0.4,
          tools: functions as any,
        })
        msg = { content: result.content, tool_calls: result.toolCalls }
      } else {
        // Default Z.ai LLM
        const completion = await zai!.chat.completions.create({
          model: 'zai-llm',
          messages: messagesForApi,
          tools: functions,
          temperature: 0.4,
        } as any)
        msg = completion.choices?.[0]?.message
      }

      if (!msg) break

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        history.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls })
        for (const call of msg.tool_calls) {
          const slug = call.function.name
          let parsedInput: Record<string, unknown> = {}
          try {
            parsedInput = JSON.parse(call.function.arguments || '{}')
          } catch {}
          const result = await executeTool({ toolSlug: slug, input: parsedInput, userId: operatorId })
          toolCallLog.push({
            tool: slug,
            input: parsedInput,
            output: result.output,
            status: result.status,
            error: result.errorMessage,
            durationMs: result.durationMs,
            executionId: result.executionId,
          })
          const toolResponse = {
            ok: result.status === 'success',
            status: result.status,
            output: result.output,
            error: result.errorMessage,
          }
          history.push({
            role: 'tool',
            content: JSON.stringify(toolResponse).slice(0, 8000),
            tool_call_id: call.id,
          })
        }
        continue
      }

      assistantText = msg.content ?? ''
      history.push({ role: 'assistant', content: assistantText })
      break
    }
    if (!assistantText && iterations >= MAX_ITERATIONS) {
      assistantText = 'I reached the maximum number of reasoning steps. Here is what I have so far.'
    }
  } catch (e: any) {
    assistantText = `The AI agent encountered an error: ${e?.message ?? String(e)}`
  }

  await db.playgroundSession.update({
    where: { id: session.id },
    data: { messages: JSON.stringify(history.slice(-30)), title: message.slice(0, 60), updatedAt: new Date() },
  })

  await audit({
    action: 'playground.run',
    actorType: 'user',
    userId: operatorId,
    targetType: 'playground_session',
    targetId: session.id,
    metadata: { iterations, toolCalls: toolCallLog.length, message: message.slice(0, 200), llm: llmProviderLabel },
    ipAddress: clientIp(req),
  })

  return NextResponse.json({
    sessionId: session.id,
    reply: assistantText,
    toolCalls: toolCallLog,
    iterations,
    llmProvider: llmProviderLabel,
  })
}
