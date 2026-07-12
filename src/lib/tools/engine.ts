import { db } from '../db'
import { getToolBySlug, TOOL_CATALOG, type ToolDefinition } from './catalog'
import { decryptCredentials } from '../crypto'
import { consume } from '../rate-limit'

export interface ExecuteParams {
  toolSlug: string
  input: Record<string, unknown>
  integrationId?: string | null
  apiKeyId?: string | null
  userId?: string | null
  // Bypass DB integration lookup: pass raw credentials directly (used by playground preview)
  credentialsOverride?: Record<string, unknown>
  // Whether to enforce rate limit per apiKey (default true for /v1, false for internal)
  enforceRateLimit?: boolean
}

export interface ExecuteResult {
  executionId: string
  status: 'success' | 'error' | 'rate_limited' | 'auth_failed' | 'timeout'
  output?: unknown
  errorMessage?: string
  durationMs: number
}

// Validate input against the tool's schema (lightweight — required fields + types).
export function validateInput(tool: ToolDefinition, input: Record<string, unknown>): { ok: boolean; error?: string } {
  for (const field of tool.inputSchema.required) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      return { ok: false, error: `Missing required field: ${field}` }
    }
  }
  // Basic type checks
  for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
    if (input[key] === undefined) continue
    const val = input[key]
    const t = prop.type
    if (t === 'string' && typeof val !== 'string') return { ok: false, error: `Field "${key}" must be a string` }
    if (t === 'integer' && (typeof val !== 'number' || !Number.isInteger(val))) return { ok: false, error: `Field "${key}" must be an integer` }
    if (t === 'number' && typeof val !== 'number') return { ok: false, error: `Field "${key}" must be a number` }
    if (t === 'boolean' && typeof val !== 'boolean') return { ok: false, error: `Field "${key}" must be a boolean` }
    if (t === 'array' && !Array.isArray(val)) return { ok: false, error: `Field "${key}" must be an array` }
    if (t === 'object' && (typeof val !== 'object' || Array.isArray(val))) return { ok: false, error: `Field "${key}" must be an object` }
    if (prop.enum && !prop.enum.includes(String(val))) return { ok: false, error: `Field "${key}" must be one of: ${prop.enum.join(', ')}` }
  }
  return { ok: true }
}

const TIMEOUT_MS = 30_000

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('Tool execution timed out'), { __timeout: true })), TIMEOUT_MS)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

/**
 * Execute a tool end-to-end: validate input, load credentials, run executor,
 * record an Execution row. Never throws — returns an error result.
 */
export async function executeTool(params: ExecuteParams): Promise<ExecuteResult> {
  const startedAt = Date.now()
  const tool = getToolBySlug(params.toolSlug)
  if (!tool) {
    return finish({
      startedAt,
      status: 'error',
      errorMessage: `Unknown tool: ${params.toolSlug}`,
      toolId: '',
      params,
    })
  }

  // Look up the tool row in DB (catalog row)
  const toolRow = await db.tool.findUnique({ where: { slug: tool.slug } }).catch(() => null)
  if (!toolRow) {
    return finish({
      startedAt,
      status: 'error',
      errorMessage: 'Tool not registered in database. Run catalog seed.',
      toolId: '',
      params,
    })
  }

  const v = validateInput(tool, params.input)
  if (!v.ok) {
    return finish({
      startedAt,
      status: 'error',
      errorMessage: v.error,
      toolId: toolRow.id,
      params,
    })
  }

  // Resolve credentials
  let credentials: Record<string, unknown> = {}
  let integrationId: string | null = params.integrationId ?? null
  if (params.credentialsOverride) {
    credentials = params.credentialsOverride
  } else if (integrationId) {
    const integ = await db.integration.findUnique({ where: { id: integrationId } })
    if (!integ || integ.status !== 'active') {
      return finish({
        startedAt,
        status: 'auth_failed',
        errorMessage: 'Integration not found or inactive.',
        toolId: toolRow.id,
        params,
        integrationId,
      })
    }
    if (integ.provider !== tool.provider) {
      return finish({
        startedAt,
        status: 'auth_failed',
        errorMessage: `Integration provider "${integ.provider}" does not match tool provider "${tool.provider}".`,
        toolId: toolRow.id,
        params,
        integrationId,
      })
    }
    credentials = decryptCredentials(integ.credentials)
  } else if (tool.authScheme !== 'none') {
    // Try to auto-pick the first active integration for this provider
    const integ = await db.integration.findFirst({ where: { provider: tool.provider, status: 'active' } })
    if (integ) {
      integrationId = integ.id
      credentials = decryptCredentials(integ.credentials)
    }
  }

  // Execute with timeout
  let output: unknown
  let status: ExecuteResult['status'] = 'success'
  let errorMessage: string | undefined
  try {
    output = await withTimeout(tool.execute(params.input, credentials))
  } catch (e: any) {
    if (e?.__timeout) {
      status = 'timeout'
      errorMessage = 'Tool execution exceeded the 30s timeout.'
    } else if (e?.status === 401 || e?.status === 403) {
      status = 'auth_failed'
      errorMessage = e.message ?? 'Authentication failed'
    } else if (e?.status === 429) {
      status = 'rate_limited'
      errorMessage = e.message ?? 'Upstream rate limited'
    } else {
      status = 'error'
      errorMessage = e?.message ?? String(e)
    }
  }

  return finish({
    startedAt,
    status,
    errorMessage,
    output,
    toolId: toolRow.id,
    params,
    integrationId,
  })
}

async function finish(args: {
  startedAt: number
  status: ExecuteResult['status']
  errorMessage?: string
  output?: unknown
  toolId: string
  params: ExecuteParams
  integrationId?: string | null
}): Promise<ExecuteResult> {
  const durationMs = Date.now() - args.startedAt
  // Persist the execution record
  let executionId = 'pending'
  try {
    const row = await db.execution.create({
      data: {
        toolId: args.toolId,
        integrationId: args.integrationId ?? args.params.integrationId ?? null,
        apiKeyId: args.params.apiKeyId ?? null,
        userId: args.params.userId ?? null,
        status: args.status,
        input: JSON.stringify(args.params.input ?? {}),
        output: args.output !== undefined ? JSON.stringify(args.output) : null,
        errorMessage: args.errorMessage ?? null,
        durationMs,
      },
    })
    executionId = row.id
  } catch (e) {
    console.error('[executeTool] failed to persist execution:', e)
  }

  // Emit real-time event via WebSocket mini-service (fire and forget)
  emitExecutionEvent(executionId, args).catch(() => {})

  return {
    executionId,
    status: args.status,
    output: args.output,
    errorMessage: args.errorMessage,
    durationMs,
  }
}

// Fire an event to the local websocket mini-service so connected dashboards
// receive the execution in real time. Connects as a Socket.IO client and
// emits a "broadcast" event, which the mini-service re-broadcasts to all
// dashboard clients as "event".
import { io as ioClient, type Socket } from 'socket.io-client'

let broadcasterSocket: Socket | null = null
function getBroadcaster(): Socket | null {
  if (broadcasterSocket) return broadcasterSocket
  try {
    broadcasterSocket = ioClient('http://localhost:3004', {
      path: '/',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 3000,
    })
    broadcasterSocket.on('connect_error', () => {
      // Mini-service may be temporarily down; keep trying.
    })
  } catch {
    return null
  }
  return broadcasterSocket
}

async function emitExecutionEvent(
  executionId: string,
  args: {
    status: ExecuteResult['status']
    durationMs: number
    errorMessage?: string
    toolId: string
    params: ExecuteParams
  },
) {
  const tool = getToolBySlug(args.params.toolSlug)
  const payload = {
    type: 'execution',
    data: {
      id: executionId,
      toolSlug: args.params.toolSlug,
      toolName: tool?.name ?? args.params.toolSlug,
      category: tool?.category ?? 'unknown',
      provider: tool?.provider ?? 'unknown',
      status: args.status,
      durationMs: args.durationMs,
      errorMessage: args.errorMessage,
      input: args.params.input,
      ts: Date.now(),
    },
  }
  const sock = getBroadcaster()
  if (sock && sock.connected) {
    sock.emit('broadcast', payload)
  } else if (sock) {
    // Not yet connected; try to connect then emit
    sock.connect()
    sock.emit('broadcast', payload)
  }
}

/**
 * Seed the tool catalog into the database from the in-code registry.
 * Idempotent — upserts by slug.
 */
export async function seedToolCatalog(): Promise<{ created: number; updated: number }> {
  let created = 0
  let updated = 0
  for (const t of TOOL_CATALOG) {
    const existing = await db.tool.findUnique({ where: { slug: t.slug } })
    const data = {
      name: t.name,
      description: t.description,
      category: t.category,
      provider: t.provider,
      authScheme: t.authScheme,
      iconKey: t.iconKey,
      inputSchema: JSON.stringify(t.inputSchema),
      outputSchema: t.outputSchema ? JSON.stringify(t.outputSchema) : null,
      isBeta: t.isBeta ?? false,
      enabled: true,
    }
    if (existing) {
      await db.tool.update({ where: { slug: t.slug }, data })
      updated++
    } else {
      await db.tool.create({ data: { slug: t.slug, ...data } })
      created++
    }
  }
  return { created, updated }
}
