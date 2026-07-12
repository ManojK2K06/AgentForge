// Tool catalog: registry of pre-built, production-ready tools that AI agents can call.
// Each tool defines: metadata (slug, name, description, category, provider, auth, schemas)
// and an `execute` function that performs the real action against the provider's API.
//
// Executors receive:
//   - input: validated arguments (typed per tool)
//   - credentials: decrypted provider credentials (shape depends on authScheme)
// They return a JSON-serializable result or throw an Error with a useful message.

import { createTransport } from 'nodemailer'
import { Pool } from 'pg'
import ZAI from 'z-ai-web-dev-sdk'

// ---------- Types ----------
export interface ToolSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'integer'
  description?: string
  enum?: string[]
  default?: unknown
  items?: ToolSchemaProperty
  properties?: Record<string, ToolSchemaProperty>
  required?: string[]
}

export interface ToolDefinition {
  slug: string
  name: string
  description: string
  category: 'communication' | 'database' | 'crm' | 'devops' | 'productivity' | 'ai' | 'web'
  provider: 'slack' | 'postgres' | 'salesforce' | 'github' | 'smtp' | 'http' | 'llm' | 'webhook' | 'notion' | 'twilio' | 'linear' | 'openai' | 'anthropic' | 'google' | 'groq' | 'deepseek' | 'mistral' | 'together' | 'fireworks' | 'ollama' | 'openai_compatible'
  authScheme: 'none' | 'api_key' | 'oauth2' | 'bearer' | 'basic' | 'connection_string'
  iconKey: string
  inputSchema: {
    type: 'object'
    properties: Record<string, ToolSchemaProperty>
    required: string[]
  }
  outputSchema?: { type: 'object'; properties: Record<string, ToolSchemaProperty> }
  isBeta?: boolean
  execute: (input: Record<string, unknown>, credentials: Record<string, unknown>) => Promise<unknown>
}

// ---------- Helpers ----------
function httpError(status: number, body: string): Error {
  const e = new Error(`Upstream HTTP ${status}: ${body.slice(0, 500)}`)
  ;(e as any).status = status
  return e
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, init)
  const text = await res.text()
  if (!res.ok) throw httpError(res.status, text)
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

// ---------- Slack ----------
const slackSendMessage: ToolDefinition = {
  slug: 'slack_send_message',
  name: 'Send Slack Message',
  description: 'Post a message to a Slack channel using a bot OAuth token (chat:write scope).',
  category: 'communication',
  provider: 'slack',
  authScheme: 'bearer',
  iconKey: 'slack',
  inputSchema: {
    type: 'object',
    properties: {
      channel: { type: 'string', description: 'Channel ID or name (e.g. #general or C12345)' },
      text: { type: 'string', description: 'Message text. Supports Slack markdown.' },
    },
    required: ['channel', 'text'],
  },
  async execute(input, creds) {
    const token = (creds.botToken ?? creds.token ?? creds.accessToken) as string | undefined
    if (!token) throw new Error('Slack bot token (botToken) is required in integration credentials.')
    const channel = (input.channel as string).replace(/^#/, '')
    const text = input.text as string
    const body = await fetchJson('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ channel, text }),
    })
    const r = body as { ok?: boolean; error?: string; ts?: string; channel?: string }
    if (!r.ok) throw new Error(`Slack API error: ${r.error ?? 'unknown'}`)
    return { ok: true, ts: r.ts, channel: r.channel }
  },
}

const slack_list_channels: ToolDefinition = {
  slug: 'slack_list_channels',
  name: 'List Slack Channels',
  description: 'List public channels in the workspace (channels:read scope).',
  category: 'communication',
  provider: 'slack',
  authScheme: 'bearer',
  iconKey: 'slack',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'integer', description: 'Max channels to return (default 100)', default: 100 },
    },
    required: [],
  },
  async execute(input, creds) {
    const token = (creds.botToken ?? creds.token ?? creds.accessToken) as string | undefined
    if (!token) throw new Error('Slack bot token is required.')
    const limit = Math.min(Number(input.limit ?? 100), 200)
    const body = (await fetchJson(
      `https://slack.com/api/conversations.list?limit=${limit}&types=public_channel`,
      { headers: { Authorization: `Bearer ${token}` } },
    )) as { ok?: boolean; error?: string; channels?: unknown[] }
    if (!body.ok) throw new Error(`Slack API error: ${body.error ?? 'unknown'}`)
    return { channels: body.channels }
  },
}

// ---------- GitHub ----------
const github_create_issue: ToolDefinition = {
  slug: 'github_create_issue',
  name: 'Create GitHub Issue',
  description: 'Open a new issue on a GitHub repository using a personal access token (repo scope).',
  category: 'devops',
  provider: 'github',
  authScheme: 'bearer',
  iconKey: 'github',
  inputSchema: {
    type: 'object',
    properties: {
      owner: { type: 'string', description: 'Repository owner (user or org)' },
      repo: { type: 'string', description: 'Repository name' },
      title: { type: 'string', description: 'Issue title' },
      body: { type: 'string', description: 'Issue body (markdown)' },
      labels: { type: 'array', items: { type: 'string' }, description: 'Labels to apply' },
    },
    required: ['owner', 'repo', 'title'],
  },
  async execute(input, creds) {
    const token = (creds.token ?? creds.accessToken) as string | undefined
    if (!token) throw new Error('GitHub token is required.')
    const url = `https://api.github.com/repos/${input.owner}/${input.repo}/issues`
    const body = await fetchJson(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: input.title,
        body: input.body ?? '',
        labels: input.labels ?? [],
      }),
    })
    return { issue: (body as { number: number; html_url: string; title: string }) }
  },
}

const github_list_repos: ToolDefinition = {
  slug: 'github_list_repos',
  name: 'List GitHub Repositories',
  description: 'List repositories for the authenticated user (repo or public_repo scope).',
  category: 'devops',
  provider: 'github',
  authScheme: 'bearer',
  iconKey: 'github',
  inputSchema: {
    type: 'object',
    properties: {
      per_page: { type: 'integer', description: 'Results per page (max 100)', default: 30 },
      sort: { type: 'string', enum: ['created', 'updated', 'pushed', 'full_name'], default: 'updated' },
    },
    required: [],
  },
  async execute(input, creds) {
    const token = (creds.token ?? creds.accessToken) as string | undefined
    if (!token) throw new Error('GitHub token is required.')
    const perPage = Math.min(Number(input.per_page ?? 30), 100)
    const sort = (input.sort as string) ?? 'updated'
    const body = (await fetchJson(
      `https://api.github.com/user/repos?per_page=${perPage}&sort=${sort}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
    )) as Array<{ id: number; name: string; full_name: string; html_url: string; private: boolean }>
    return {
      repositories: body.map((r) => ({
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        html_url: r.html_url,
        private: r.private,
      })),
    }
  },
}

// ---------- Postgres ----------
const pg_cache = new Map<string, Pool>()
function getPgPool(connStr: string): Pool {
  let pool = pg_cache.get(connStr)
  if (!pool) {
    pool = new Pool({ connectionString: connStr, max: 3, idleTimeoutMillis: 30_000 })
    pg_cache.set(connStr, pool)
  }
  return pool
}

const postgres_query: ToolDefinition = {
  slug: 'postgres_query',
  name: 'Query Postgres Database',
  description: 'Run a read-only SQL query against a Postgres database using a connection string.',
  category: 'database',
  provider: 'postgres',
  authScheme: 'connection_string',
  iconKey: 'database',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'SQL query. SELECT only — mutating statements are rejected.' },
      params: { type: 'array', items: { type: 'string' }, description: 'Parameterized query values' },
      limit: { type: 'integer', description: 'Max rows to return (default 100, hard cap 1000)', default: 100 },
    },
    required: ['query'],
  },
  async execute(input, creds) {
    const connStr = (creds.connectionString ?? creds.databaseUrl) as string | undefined
    if (!connStr) throw new Error('Postgres connection string is required in credentials.')
    const query = (input.query as string).trim()
    // Guard against mutating queries for safety
    if (/^\s*(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b/i.test(query)) {
      throw new Error('Only SELECT queries are permitted by this tool.')
    }
    const limit = Math.min(Number(input.limit ?? 100), 1000)
    const pool = getPgPool(connStr)
    const client = await pool.connect()
    try {
      const params = (input.params as unknown[]) ?? []
      const limited = /\blimit\b/i.test(query) ? query : `${query} LIMIT ${limit}`
      const result = await client.query(limited, params)
      return { rows: result.rows, rowCount: result.rowCount ?? 0 }
    } finally {
      client.release()
    }
  },
}

// ---------- SMTP Email ----------
const smtp_send_email: ToolDefinition = {
  slug: 'smtp_send_email',
  name: 'Send Email (SMTP)',
  description: 'Send a transactional email via any SMTP server (Gmail, SES, Mailgun, etc.).',
  category: 'communication',
  provider: 'smtp',
  authScheme: 'basic',
  iconKey: 'mail',
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email address(es), comma-separated' },
      subject: { type: 'string', description: 'Email subject' },
      text: { type: 'string', description: 'Plain text body' },
      html: { type: 'string', description: 'Optional HTML body' },
      cc: { type: 'string', description: 'Optional CC' },
      bcc: { type: 'string', description: 'Optional BCC' },
    },
    required: ['to', 'subject', 'text'],
  },
  async execute(input, creds) {
    const host = creds.host as string | undefined
    const port = Number(creds.port ?? 587)
    const user = creds.user ?? creds.username
    const pass = creds.password ?? creds.pass
    const from = creds.from ?? user
    if (!host || !user || !pass) {
      throw new Error('SMTP credentials require host, user (username), and password.')
    }
    const transport = createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: user as string, pass: pass as string },
    })
    const info = await transport.sendMail({
      from: from as string,
      to: input.to as string,
      subject: input.subject as string,
      text: input.text as string,
      html: (input.html as string) ?? undefined,
      cc: (input.cc as string) ?? undefined,
      bcc: (input.bcc as string) ?? undefined,
    })
    await transport.close()
    return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected }
  },
}

// ---------- Generic HTTP ----------
const http_request: ToolDefinition = {
  slug: 'http_request',
  name: 'HTTP Request',
  description: 'Send an authenticated HTTP request to any REST API. Supports bearer/api-key auth injection.',
  category: 'web',
  provider: 'http',
  authScheme: 'none',
  iconKey: 'globe',
  inputSchema: {
    type: 'object',
    properties: {
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
      url: { type: 'string', description: 'Absolute URL to call' },
      headers: { type: 'object', properties: {}, description: 'Custom headers (JSON object)' },
      body: { type: 'object', properties: {}, description: 'JSON body to send' },
      authHeaderName: { type: 'string', description: 'Header name to inject the credential into (default Authorization)' },
      authHeaderValue: { type: 'string', description: 'Override value; if omitted, uses "Bearer <token>" from credentials' },
    },
    required: ['method', 'url'],
  },
  async execute(input, creds) {
    const method = (input.method as string) ?? 'GET'
    const url = input.url as string
    const headers: Record<string, string> = {
      ...(input.headers as Record<string, string> | undefined),
    }
    const authHeaderName = (input.authHeaderName as string) ?? 'Authorization'
    if (input.authHeaderValue) {
      headers[authHeaderName] = input.authHeaderValue as string
    } else if (creds.token || creds.bearer || creds.accessToken) {
      const t = (creds.token ?? creds.bearer ?? creds.accessToken) as string
      headers[authHeaderName] = t.startsWith('Bearer ') ? t : `Bearer ${t}`
    } else if (creds.apiKey) {
      headers[authHeaderName] = creds.apiKey as string
    }
    const init: RequestInit = { method, headers }
    if (method !== 'GET' && method !== 'HEAD' && input.body) {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(input.body)
    }
    const res = await fetch(url, init)
    const text = await res.text()
    let json: unknown = null
    try {
      json = JSON.parse(text)
    } catch {
      json = text
    }
    return { status: res.status, ok: res.ok, headers: Object.fromEntries(res.headers.entries()), body: json }
  },
}

// ---------- Webhook ----------
const webhook_trigger: ToolDefinition = {
  slug: 'webhook_trigger',
  name: 'Trigger Outgoing Webhook',
  description: 'POST a JSON payload to a configured webhook URL. Useful for connecting to Make, n8n, Zapier, etc.',
  category: 'web',
  provider: 'webhook',
  authScheme: 'none',
  iconKey: 'webhook',
  inputSchema: {
    type: 'object',
    properties: {
      payload: { type: 'object', properties: {}, description: 'JSON payload to send' },
      event: { type: 'string', description: 'Event name (sent as X-Webhook-Event header)' },
    },
    required: ['payload'],
  },
  async execute(input, creds) {
    const url = (creds.url ?? creds.webhookUrl) as string | undefined
    if (!url) throw new Error('Webhook URL is required in integration credentials.')
    const secret = (creds.secret ?? creds.signingSecret) as string | undefined
    const payload = JSON.stringify(input.payload ?? {})
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': (input.event as string) ?? 'generic',
    }
    if (secret) {
      const { createHmac } = await import('crypto')
      const sig = createHmac('sha256', secret).update(payload).digest('hex')
      headers['X-Webhook-Signature'] = `sha256=${sig}`
    }
    const res = await fetch(url, { method: 'POST', headers, body: payload })
    const text = await res.text()
    return { status: res.status, ok: res.ok, response: text.slice(0, 2000) }
  },
}

// ---------- LLM (z-ai-web-dev-sdk) ----------
const llm_generate: ToolDefinition = {
  slug: 'llm_generate_text',
  name: 'Generate Text (LLM)',
  description: 'Generate text with a large language model. Use this tool when an agent needs reasoning, summarization, or content generation.',
  category: 'ai',
  provider: 'llm',
  authScheme: 'none',
  iconKey: 'sparkles',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'The prompt to send to the model' },
      system: { type: 'string', description: 'Optional system prompt' },
      temperature: { type: 'number', description: '0-1, default 0.7', default: 0.7 },
    },
    required: ['prompt'],
  },
  async execute(input) {
    const zai = await ZAI.create()
    const messages = []
    if (input.system) messages.push({ role: 'system', content: input.system as string })
    messages.push({ role: 'user', content: input.prompt as string })
    const completion = await zai.chat.completions.create({
      messages: messages as any,
      temperature: Number(input.temperature ?? 0.7),
    })
    const content = completion.choices?.[0]?.message?.content ?? ''
    return { text: content, model: completion.model ?? 'zai-llm', usage: completion.usage }
  },
}

// ---------- Salesforce (REST, bearer session token) ----------
const salesforce_create_contact: ToolDefinition = {
  slug: 'salesforce_create_contact',
  name: 'Create Salesforce Contact',
  description: 'Create a Contact record in Salesforce via the REST API using a session token + instance URL.',
  category: 'crm',
  provider: 'salesforce',
  authScheme: 'bearer',
  iconKey: 'cloud',
  inputSchema: {
    type: 'object',
    properties: {
      FirstName: { type: 'string' },
      LastName: { type: 'string', description: 'Required by Salesforce' },
      Email: { type: 'string' },
      Phone: { type: 'string' },
      Title: { type: 'string' },
      Company: { type: 'string', description: 'If provided, used to create an Account first' },
    },
    required: ['LastName'],
  },
  async execute(input, creds) {
    const token = (creds.accessToken ?? creds.sessionId) as string | undefined
    const instanceUrl = creds.instanceUrl as string | undefined
    if (!token || !instanceUrl) {
      throw new Error('Salesforce credentials require accessToken (sessionId) and instanceUrl.')
    }
    const url = `${instanceUrl}/services/data/v59.0/sobjects/Contact`
    const body = await fetchJson(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        FirstName: input.FirstName,
        LastName: input.LastName,
        Email: input.Email,
        Phone: input.Phone,
        Title: input.Title,
      }),
    })
    return { contact: body as { id: string; success: boolean; errors: unknown[] } }
  },
}

// ---------- Notion ----------
const notion_create_page: ToolDefinition = {
  slug: 'notion_create_page',
  name: 'Create Notion Page',
  description: 'Create a new page in a Notion database using an integration token. Requires the database ID and page properties.',
  category: 'productivity',
  provider: 'notion',
  authScheme: 'bearer',
  iconKey: 'file-text',
  inputSchema: {
    type: 'object',
    properties: {
      databaseId: { type: 'string', description: 'The Notion database ID (32-char hex, with or without dashes)' },
      title: { type: 'string', description: 'The page title' },
      content: { type: 'string', description: 'Optional markdown-like text content for the page body' },
    },
    required: ['databaseId', 'title'],
  },
  async execute(input, creds) {
    const token = (creds.token ?? creds.integrationToken) as string | undefined
    if (!token) throw new Error('Notion integration token is required.')
    const databaseId = (input.databaseId as string).replace(/-/g, '')
    const body = await fetchJson('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          Name: { title: [{ text: { content: input.title as string } }] },
        },
        children: input.content
          ? [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [{ type: 'text', text: { content: (input.content as string).slice(0, 2000) } }],
                },
              },
            ]
          : [],
      }),
    })
    return { page: (body as { id: string; url?: string }) }
  },
}

const notion_search: ToolDefinition = {
  slug: 'notion_search',
  name: 'Search Notion Pages',
  description: 'Search across all accessible Notion pages and databases by title.',
  category: 'productivity',
  provider: 'notion',
  authScheme: 'bearer',
  iconKey: 'file-text',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (title text)' },
      limit: { type: 'integer', description: 'Max results (default 10, max 100)', default: 10 },
    },
    required: ['query'],
  },
  async execute(input, creds) {
    const token = (creds.token ?? creds.integrationToken) as string | undefined
    if (!token) throw new Error('Notion integration token is required.')
    const body = await fetchJson('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: input.query,
        page_size: Math.min(Number(input.limit ?? 10), 100),
      }),
    })
    const r = body as { results?: Array<{ id: string; url?: string; object: string; properties?: any }> }
    return {
      results: (r.results ?? []).map((p) => ({
        id: p.id,
        url: p.url,
        type: p.object,
        title: p.properties?.Name?.title?.[0]?.text?.content ?? p.properties?.title?.title?.[0]?.text?.content ?? '(untitled)',
      })),
    }
  },
}

// ---------- Twilio (SMS) ----------
const twilio_send_sms: ToolDefinition = {
  slug: 'twilio_send_sms',
  name: 'Send SMS (Twilio)',
  description: 'Send an SMS message via Twilio. Requires Account SID, Auth Token, and a Twilio phone number.',
  category: 'communication',
  provider: 'twilio',
  authScheme: 'basic',
  iconKey: 'message-circle',
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient phone number in E.164 format (e.g. +15551234567)' },
      body: { type: 'string', description: 'Message body (max 1600 chars)' },
    },
    required: ['to', 'body'],
  },
  async execute(input, creds) {
    const accountSid = (creds.accountSid ?? creds.sid) as string | undefined
    const authToken = (creds.authToken ?? creds.token) as string | undefined
    const from = (creds.fromNumber ?? creds.from) as string | undefined
    if (!accountSid || !authToken || !from) {
      throw new Error('Twilio credentials require accountSid, authToken, and fromNumber.')
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const form = new URLSearchParams()
    form.set('To', input.to as string)
    form.set('From', from)
    form.set('Body', (input.body as string).slice(0, 1600))
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })
    const text = await res.text()
    if (!res.ok) throw httpError(res.status, text)
    const r = JSON.parse(text)
    return { sid: r.sid, status: r.status, errorCode: r.error_code, errorMessage: r.error_message }
  },
}

// ---------- Linear ----------
const linear_create_issue: ToolDefinition = {
  slug: 'linear_create_issue',
  name: 'Create Linear Issue',
  description: 'Create a new issue in Linear via the GraphQL API using a personal API key.',
  category: 'devops',
  provider: 'linear',
  authScheme: 'api_key',
  iconKey: 'git-branch',
  inputSchema: {
    type: 'object',
    properties: {
      teamId: { type: 'string', description: 'Linear team UUID' },
      title: { type: 'string', description: 'Issue title' },
      description: { type: 'string', description: 'Issue description (markdown)' },
      priority: { type: 'integer', description: '0 (no priority) to 4 (urgent). Default 2.', default: 2 },
    },
    required: ['teamId', 'title'],
  },
  async execute(input, creds) {
    const apiKey = (creds.apiKey ?? creds.token) as string | undefined
    if (!apiKey) throw new Error('Linear API key is required.')
    const mutation = `mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id url identifier title }
      }
    }`
    const variables = {
      input: {
        teamId: input.teamId,
        title: input.title,
        description: (input.description as string) ?? '',
        priority: Number(input.priority ?? 2),
      },
    }
    const body = await fetchJson('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: mutation, variables }),
    })
    const r = body as { data?: { issueCreate?: { success: boolean; issue?: { id: string; url: string; identifier: string; title: string } } }; errors?: unknown[] }
    if (r.errors && r.errors.length > 0) throw new Error(`Linear GraphQL error: ${JSON.stringify(r.errors)}`)
    return { issue: r.data?.issueCreate?.issue }
  },
}

// ---------- Custom LLM Chat (uses user's configured AI provider) ----------
const llm_chat: ToolDefinition = {
  slug: 'llm_chat',
  name: 'Chat with Custom AI',
  description: 'Generate text using your connected AI provider (OpenAI, Anthropic, Gemini, Groq, DeepSeek, Ollama, etc.). Falls back to built-in Z.ai if no custom provider is configured.',
  category: 'ai',
  provider: 'openai_compatible',
  authScheme: 'api_key',
  iconKey: 'sparkles',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'The prompt/message to send to the AI' },
      system: { type: 'string', description: 'Optional system prompt to set AI behavior' },
      temperature: { type: 'number', description: '0-1, default 0.7', default: 0.7 },
    },
    required: ['prompt'],
  },
  async execute(input, creds) {
    // If credentials include baseUrl + apiKey + model, use the custom provider
    if (creds.baseUrl && creds.apiKey && creds.model) {
      const { chatCompletion } = await import('../llm/client')
      const messages = []
      if (input.system) messages.push({ role: 'system' as const, content: input.system as string })
      messages.push({ role: 'user' as const, content: input.prompt as string })
      const result = await chatCompletion(
        {
          provider: (creds.provider as string) ?? 'openai_compatible',
          baseUrl: creds.baseUrl as string,
          apiKey: creds.apiKey as string,
          model: creds.model as string,
        },
        messages as any,
        { temperature: Number(input.temperature ?? 0.7) },
      )
      return { text: result.content, model: result.model, provider: creds.provider, usage: result.usage }
    }
    // Fallback to built-in Z.ai LLM
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const messages = []
    if (input.system) messages.push({ role: 'system', content: input.system as string })
    messages.push({ role: 'user', content: input.prompt as string })
    const completion = await zai.chat.completions.create({
      messages: messages as any,
      temperature: Number(input.temperature ?? 0.7),
    })
    const content = completion.choices?.[0]?.message?.content ?? ''
    return { text: content, model: completion.model ?? 'zai-llm (fallback)', provider: 'zai', usage: completion.usage }
  },
}

// ---------- Catalog ----------
export const TOOL_CATALOG: ToolDefinition[] = [
  slackSendMessage,
  slack_list_channels,
  github_create_issue,
  github_list_repos,
  postgres_query,
  smtp_send_email,
  http_request,
  webhook_trigger,
  llm_generate,
  salesforce_create_contact,
  notion_create_page,
  notion_search,
  twilio_send_sms,
  linear_create_issue,
  llm_chat,
]

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return TOOL_CATALOG.find((t) => t.slug === slug)
}

export interface ProviderMeta {
  name: string
  description: string
  authSchemes: string[]
  credentialFields: { key: string; label: string; type: string; required: boolean; placeholder?: string; help?: string }[]
  // Direct link to the provider's credential setup page
  connectUrl?: string
  connectLabel?: string
  // What you need to get the credential
  setupGuide?: string
  // Icon/color for display
  docsUrl?: string
}

export const PROVIDER_META: Record<string, ProviderMeta> = {
  slack: {
    name: 'Slack',
    description: 'Send messages and list channels in your Slack workspace.',
    authSchemes: ['bearer'],
    credentialFields: [
      { key: 'botToken', label: 'Bot OAuth Token', type: 'password', required: true, placeholder: 'xoxb-...', help: 'Requires chat:write and channels:read scopes' },
    ],
    connectUrl: 'https://api.slack.com/apps?new_app=1',
    connectLabel: 'Create Slack App',
    setupGuide: 'Create a Slack app, add bot token scopes (chat:write, channels:read), install to workspace, copy the Bot User OAuth Token.',
    docsUrl: 'https://api.slack.com/docs',
  },
  github: {
    name: 'GitHub',
    description: 'Manage issues and repositories via the GitHub REST API.',
    authSchemes: ['bearer'],
    credentialFields: [
      { key: 'token', label: 'Personal Access Token', type: 'password', required: true, placeholder: 'ghp_...', help: 'Requires repo scope' },
    ],
    connectUrl: 'https://github.com/settings/tokens/new?scopes=repo&description=AgentForge',
    connectLabel: 'Create GitHub Token',
    setupGuide: 'Generate a personal access token with "repo" scope. Copy it immediately — GitHub won\'t show it again.',
    docsUrl: 'https://docs.github.com/rest',
  },
  postgres: {
    name: 'PostgreSQL',
    description: 'Run read-only SQL queries against a Postgres database.',
    authSchemes: ['connection_string'],
    credentialFields: [
      { key: 'connectionString', label: 'Connection String', type: 'password', required: true, placeholder: 'postgresql://user:pass@host:5432/db', help: 'Standard libpq connection URI' },
    ],
    setupGuide: 'Use your database connection string in the format postgresql://user:password@host:port/database. For production, create a read-only user.',
    docsUrl: 'https://www.postgresql.org/docs/current/libpq-connect.html',
  },
  smtp: {
    name: 'SMTP (Email)',
    description: 'Send transactional email through any SMTP server.',
    authSchemes: ['basic'],
    credentialFields: [
      { key: 'host', label: 'SMTP Host', type: 'text', required: true, placeholder: 'smtp.gmail.com' },
      { key: 'port', label: 'Port', type: 'number', required: true, placeholder: '587' },
      { key: 'user', label: 'Username', type: 'text', required: true, placeholder: 'you@example.com' },
      { key: 'password', label: 'Password / App Password', type: 'password', required: true },
      { key: 'from', label: 'From Address', type: 'text', required: true, placeholder: 'You <you@example.com>' },
    ],
    setupGuide: 'For Gmail, use an App Password (not your regular password). For other providers, use your SMTP credentials. Port 587 for TLS, 465 for SSL.',
    docsUrl: 'https://nodemailer.com/smtp/',
  },
  http: {
    name: 'HTTP / REST',
    description: 'Generic HTTP client for any REST API. Pass auth per-request.',
    authSchemes: ['none'],
    credentialFields: [
      { key: 'token', label: 'Default Bearer Token (optional)', type: 'password', required: false, placeholder: 'Injected as Authorization: Bearer <token>' },
    ],
    setupGuide: 'No setup required. Pass authentication per-request via the authHeaderValue field, or set a default bearer token here.',
  },
  webhook: {
    name: 'Webhook',
    description: 'Trigger outgoing webhooks to external automation platforms.',
    authSchemes: ['none'],
    credentialFields: [
      { key: 'url', label: 'Webhook URL', type: 'text', required: true, placeholder: 'https://hooks.example.com/...' },
      { key: 'secret', label: 'Signing Secret (optional)', type: 'password', required: false, help: 'Sent as HMAC-SHA256 in X-Webhook-Signature' },
    ],
    setupGuide: 'Create a webhook endpoint in your automation platform (n8n, Make, Zapier, IFTTT). Paste the URL here. Optionally add a signing secret for verification.',
  },
  llm: {
    name: 'LLM (Z.ai)',
    description: 'Built-in large language model for reasoning and generation.',
    authSchemes: ['none'],
    credentialFields: [],
    setupGuide: 'No setup required. The LLM tool uses the built-in Z.ai model and works out of the box.',
  },
  salesforce: {
    name: 'Salesforce',
    description: 'Create and update CRM records via the Salesforce REST API.',
    authSchemes: ['bearer'],
    credentialFields: [
      { key: 'instanceUrl', label: 'Instance URL', type: 'text', required: true, placeholder: 'https://myorg.my.salesforce.com' },
      { key: 'accessToken', label: 'Session / Access Token', type: 'password', required: true, help: 'Obtain via OAuth or username/password flow' },
    ],
    connectUrl: 'https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth.htm',
    connectLabel: 'Salesforce OAuth Setup',
    setupGuide: 'Create a Connected App in Salesforce Setup → App Manager. Enable OAuth, add API scopes. Obtain the instance URL and access token via the OAuth flow.',
    docsUrl: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_rest.htm',
  },
  notion: {
    name: 'Notion',
    description: 'Create pages and search across your Notion workspace.',
    authSchemes: ['bearer'],
    credentialFields: [
      { key: 'token', label: 'Integration Token', type: 'password', required: true, placeholder: 'secret_...', help: 'Create an integration at notion.so/my-integrations' },
    ],
    connectUrl: 'https://www.notion.so/my-integrations/new',
    connectLabel: 'Create Notion Integration',
    setupGuide: 'Create an integration at notion.so/my-integrations. Copy the Internal Integration Secret. Then share the target database with the integration.',
    docsUrl: 'https://developers.notion.com/docs',
  },
  twilio: {
    name: 'Twilio (SMS)',
    description: 'Send SMS messages via the Twilio REST API.',
    authSchemes: ['basic'],
    credentialFields: [
      { key: 'accountSid', label: 'Account SID', type: 'text', required: true, placeholder: 'AC...', help: 'Found in Twilio console' },
      { key: 'authToken', label: 'Auth Token', type: 'password', required: true },
      { key: 'fromNumber', label: 'From Number (E.164)', type: 'text', required: true, placeholder: '+15551234567' },
    ],
    connectUrl: 'https://console.twilio.com/',
    connectLabel: 'Twilio Console',
    setupGuide: 'Sign up at twilio.com. Find your Account SID and Auth Token in the console dashboard. Get a phone number (trial accounts get one free).',
    docsUrl: 'https://www.twilio.com/docs/sms',
  },
  linear: {
    name: 'Linear',
    description: 'Create issues in Linear via the GraphQL API.',
    authSchemes: ['api_key'],
    credentialFields: [
      { key: 'apiKey', label: 'Personal API Key', type: 'password', required: true, placeholder: 'lin_api_...', help: 'Settings → API → Personal API keys' },
    ],
    connectUrl: 'https://linear.app/settings/api',
    connectLabel: 'Linear API Keys',
    setupGuide: 'Go to Linear Settings → API → Personal API keys. Create a new key. Note your team ID from the Linear workspace settings.',
    docsUrl: 'https://developers.linear.app/docs/',
  },
  // ---- Custom LLM Providers (any AI) ----
  openai: {
    name: 'OpenAI',
    description: 'GPT-4o, o1, o3-mini reasoning models via OpenAI API.',
    authSchemes: ['api_key'],
    credentialFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-...' },
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'https://api.openai.com/v1' },
      { key: 'model', label: 'Model', type: 'text', required: true, placeholder: 'gpt-4o', help: 'gpt-4o, gpt-4o-mini, o1, o3-mini' },
    ],
    connectUrl: 'https://platform.openai.com/api-keys',
    connectLabel: 'Get OpenAI API Key',
    setupGuide: 'Create an API key at platform.openai.com. Default model: gpt-4o. Use gpt-4o-mini for cheaper/faster calls.',
    docsUrl: 'https://platform.openai.com/docs',
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    description: 'Claude 3.5 Sonnet, Haiku, Opus via native Anthropic API.',
    authSchemes: ['api_key'],
    credentialFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-ant-...' },
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'https://api.anthropic.com/v1' },
      { key: 'model', label: 'Model', type: 'text', required: true, placeholder: 'claude-3-5-sonnet-20241022', help: 'claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus' },
    ],
    connectUrl: 'https://console.anthropic.com/settings/keys',
    connectLabel: 'Get Anthropic API Key',
    setupGuide: 'Create an API key at console.anthropic.com. Claude 3.5 Sonnet is the recommended default.',
    docsUrl: 'https://docs.anthropic.com',
  },
  google: {
    name: 'Google Gemini',
    description: 'Gemini 2.0 Flash, 1.5 Pro/Flash via OpenAI-compatible endpoint.',
    authSchemes: ['api_key'],
    credentialFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'AIza...' },
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'https://generativelanguage.googleapis.com/v1beta/openai' },
      { key: 'model', label: 'Model', type: 'text', required: true, placeholder: 'gemini-2.0-flash', help: 'gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash' },
    ],
    connectUrl: 'https://aistudio.google.com/apikey',
    connectLabel: 'Get Gemini API Key',
    setupGuide: 'Get a free API key at aistudio.google.com. Gemini 2.0 Flash is fast and has a generous free tier.',
    docsUrl: 'https://ai.google.dev/docs',
  },
  groq: {
    name: 'Groq (Ultra-Fast)',
    description: 'Fastest LLM inference — Llama 3.3 70B, Mixtral at 500+ tokens/sec.',
    authSchemes: ['api_key'],
    credentialFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'gsk_...' },
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'https://api.groq.com/openai/v1' },
      { key: 'model', label: 'Model', type: 'text', required: true, placeholder: 'llama-3.3-70b-versatile', help: 'llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768' },
    ],
    connectUrl: 'https://console.groq.com/keys',
    connectLabel: 'Get Groq API Key',
    setupGuide: 'Get a free API key at console.groq.com. Groq is the fastest LLM inference provider. Great free tier.',
    docsUrl: 'https://console.groq.com/docs',
  },
  deepseek: {
    name: 'DeepSeek',
    description: 'DeepSeek Chat & Reasoner — cheap, strong reasoning models.',
    authSchemes: ['api_key'],
    credentialFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-...' },
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'https://api.deepseek.com/v1' },
      { key: 'model', label: 'Model', type: 'text', required: true, placeholder: 'deepseek-chat', help: 'deepseek-chat, deepseek-reasoner' },
    ],
    connectUrl: 'https://platform.deepseek.com/api_keys',
    connectLabel: 'Get DeepSeek API Key',
    setupGuide: 'Get an API key at platform.deepseek.com. DeepSeek is one of the cheapest strong LLMs available.',
    docsUrl: 'https://api-docs.deepseek.com',
  },
  mistral: {
    name: 'Mistral AI',
    description: 'Mistral Large, Small, Mixtral open-weight models.',
    authSchemes: ['api_key'],
    credentialFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: '...' },
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'https://api.mistral.ai/v1' },
      { key: 'model', label: 'Model', type: 'text', required: true, placeholder: 'mistral-large-latest', help: 'mistral-large-latest, mistral-small-latest, open-mixtral-8x22b' },
    ],
    connectUrl: 'https://console.mistral.ai/api-keys',
    connectLabel: 'Get Mistral API Key',
    setupGuide: 'Get an API key at console.mistral.ai. Mistral Large is their flagship model.',
    docsUrl: 'https://docs.mistral.ai',
  },
  together: {
    name: 'Together AI',
    description: '200+ open-source models (Llama, Qwen, DeepSeek, etc.) on fast GPUs.',
    authSchemes: ['api_key'],
    credentialFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: '...' },
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'https://api.together.xyz/v1' },
      { key: 'model', label: 'Model', type: 'text', required: true, placeholder: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
    ],
    connectUrl: 'https://api.together.xyz/settings/api-keys',
    connectLabel: 'Get Together API Key',
    setupGuide: 'Get an API key at api.together.xyz. Together hosts 200+ open-source models.',
    docsUrl: 'https://docs.together.ai',
  },
  fireworks: {
    name: 'Fireworks AI',
    description: 'Fast open-model inference (Llama, Qwen, etc.).',
    authSchemes: ['api_key'],
    credentialFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: '...' },
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'https://api.fireworks.ai/inference/v1' },
      { key: 'model', label: 'Model', type: 'text', required: true, placeholder: 'accounts/fireworks/models/llama-v3p3-70b-instruct' },
    ],
    connectUrl: 'https://fireworks.ai/api-keys',
    connectLabel: 'Get Fireworks API Key',
    setupGuide: 'Get an API key at fireworks.ai. Fireworks offers fast inference for open models.',
    docsUrl: 'https://docs.fireworks.ai',
  },
  ollama: {
    name: 'Ollama (Local)',
    description: 'Run AI models locally — free, private, offline. No API key needed.',
    authSchemes: ['api_key'],
    credentialFields: [
      { key: 'apiKey', label: 'API Key (use "ollama")', type: 'text', required: true, placeholder: 'ollama', help: 'Ollama does not require a real key — enter "ollama"' },
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'http://localhost:11434/v1', help: 'Default: http://localhost:11434/v1' },
      { key: 'model', label: 'Model', type: 'text', required: true, placeholder: 'llama3.2', help: 'Run "ollama pull llama3.2" first' },
    ],
    connectUrl: 'https://ollama.com/download',
    connectLabel: 'Install Ollama',
    setupGuide: 'Install Ollama from ollama.com. Run "ollama pull llama3.2" to download a model. Then connect with baseUrl http://localhost:11434/v1.',
    docsUrl: 'https://ollama.com/library',
  },
  openai_compatible: {
    name: 'Custom (OpenAI-compatible)',
    description: 'Any OpenAI-compatible API: vLLM, LM Studio, LiteLLM, etc.',
    authSchemes: ['api_key'],
    credentialFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: false, placeholder: 'Your API key (or "none")' },
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'http://localhost:1234/v1' },
      { key: 'model', label: 'Model', type: 'text', required: true, placeholder: 'model-name' },
    ],
    setupGuide: 'Enter the base URL of any OpenAI-compatible API server (vLLM, LM Studio, LiteLLM proxy, etc.). The API must support /chat/completions.',
  },
}
