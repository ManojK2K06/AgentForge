# AgentForge

> A unified, AI-native API layer that gives AI agents secure, pre-built tools to take real actions — send Slack messages, query Postgres, create GitHub issues, send emails, and more. We handle authentication, rate limiting, and error handling so you don't have to rebuild integrations for every agent.

[![Production Ready](https://img.shields.io/badge/status-production--ready-success)]()
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## Table of Contents

- [What is AgentForge?](#what-is-agentforge)
- [How It Works](#how-it-works)
- [Features](#features)
- [Tool Catalog](#tool-catalog)
- [AI Playground & Custom AI Providers](#ai-playground--custom-ai-providers)
- [Security](#security)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Dashboard Guide](#dashboard-guide)
- [Connecting Providers](#connecting-providers)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)

---

## What is AgentForge?

Every AI service company is now building "Agents" — AI that takes action rather than just chatting. To do this, the AI needs to connect to CRMs, databases, and email. Building secure, reliable API integrations for AI agents is incredibly difficult and time-consuming.

**AgentForge solves this.** We provide pre-built, secure "tools" (e.g., "Create Salesforce Contact," "Send Slack Message," "Query Postgres") that AI agents can call. Your platform handles the authentication, rate limiting, and error handling.

### Why it's needed

Every AI service company is currently rebuilding the same integrations over and over. A plug-and-play toolkit for AI actions saves thousands of engineering hours.

### Who it's for

- **AI agent builders** who need their agents to take real-world actions
- **SaaS companies** adding AI features that need to connect to external services
- **Developers** who want to avoid building and maintaining dozens of API integrations

---

## How It Works

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Your AI    │     │  AgentForge     │     │  External        │
│  Agent      │────▶│  API Layer      │────▶│  Services        │
│             │     │                 │     │                  │
│  (any LLM)  │◀────│  • Auth         │◀────│  Slack, GitHub,  │
│             │     │  • Rate limit   │     │  Postgres, SMTP, │
└─────────────┘     │  • Validate     │     │  Salesforce...   │
                    │  • Execute      │     └──────────────────┘
                    │  • Log          │
                    │  • Stream live  │
                    └─────────────────┘
```

1. **You create an API key** in the AgentForge dashboard
2. **You connect providers** (Slack, GitHub, etc.) by entering credentials — encrypted at rest
3. **Your AI agent calls** `POST /v1/execute` with the tool slug + input
4. **AgentForge handles** authentication, validation, rate limiting, execution, and logging
5. **The tool executes** against the real provider API and returns the result

### Example: Sending a Slack message

```bash
curl -X POST https://api.agentforge.dev/v1/execute \
  -H "Authorization: Bearer af_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "slack_send_message",
    "input": {
      "channel": "#general",
      "text": "Deployment complete!"
    }
  }'
```

Response:
```json
{
  "executionId": "ck...",
  "status": "success",
  "output": { "ok": true, "ts": "1700000000.000000", "channel": "C12345" },
  "durationMs": 412
}
```

---

## Features

### Core Platform
- **15 pre-built tools** across 7 categories (communication, database, CRM, DevOps, productivity, AI, web)
- **11 providers** supported (Slack, GitHub, Postgres, SMTP, HTTP, Webhook, LLM, Salesforce, Notion, Twilio, Linear)
- **Secure credential storage** — AES-256-GCM encryption at rest
- **API key management** — SHA-256 hashed, scoped, rate-limited
- **Execution engine** — validates input, executes with 30s timeout, logs everything
- **Live execution streaming** — real-time WebSocket updates
- **Audit trail** — every action logged immutably
- **Usage analytics** — 30-day trends, latency percentiles, provider breakdowns
- **Scheduled executions** — run tools on a recurring schedule

### AI Playground
- **Autonomous agent** — chat with an AI that decides which tools to call
- **Function calling** — the LLM uses OpenAI-style tool definitions
- **ReAct loop** — up to 6 iterations of think → call tool → react
- **Any AI provider** — connect OpenAI, Anthropic, Gemini, Groq, DeepSeek, Ollama, or any OpenAI-compatible API
- **Markdown rendering** — bold, italic, code blocks, lists, links in responses
- **Auto-growing chat** — the conversation expands naturally as you chat

### Security
- **Bearer token auth** on all `/v1/*` endpoints
- **Scope-based access control** (`tools:execute`, `tools:read`, `admin`, etc.)
- **Sliding-window rate limiting** per API key (1-600 req/min)
- **Input validation** per tool schema
- **SQL injection guard** — Postgres tool rejects non-SELECT queries
- **Webhook signing** — HMAC-SHA256 signatures for outgoing webhooks
- **Credential encryption** — never returned in plaintext after save

---

## Tool Catalog

### Communication (4 tools)
| Tool | Description | Provider | Auth |
|------|-------------|----------|------|
| `slack_send_message` | Post a message to a Slack channel | Slack | Bearer token |
| `slack_list_channels` | List public channels in workspace | Slack | Bearer token |
| `smtp_send_email` | Send transactional email via SMTP | SMTP | Basic auth |
| `twilio_send_sms` | Send SMS via Twilio | Twilio | Basic auth |

### Database (1 tool)
| Tool | Description | Provider | Auth |
|------|-------------|----------|------|
| `postgres_query` | Run read-only SQL queries | PostgreSQL | Connection string |

### CRM (1 tool)
| Tool | Description | Provider | Auth |
|------|-------------|----------|------|
| `salesforce_create_contact` | Create a Contact record | Salesforce | Bearer token |

### DevOps (3 tools)
| Tool | Description | Provider | Auth |
|------|-------------|----------|------|
| `github_create_issue` | Open a GitHub issue | GitHub | Bearer token |
| `github_list_repos` | List user's repositories | GitHub | Bearer token |
| `linear_create_issue` | Create a Linear issue | Linear | API key |

### Productivity (2 tools)
| Tool | Description | Provider | Auth |
|------|-------------|----------|------|
| `notion_create_page` | Create a Notion page | Notion | Bearer token |
| `notion_search` | Search Notion pages | Notion | Bearer token |

### AI (2 tools)
| Tool | Description | Provider | Auth |
|------|-------------|----------|------|
| `llm_generate_text` | Generate text (built-in Z.ai) | Z.ai | None |
| `llm_chat` | Chat with your configured AI | Any (OpenAI, Anthropic, etc.) | API key |

### Web (2 tools)
| Tool | Description | Provider | Auth |
|------|-------------|----------|------|
| `http_request` | Generic authenticated HTTP client | Any | Per-request |
| `webhook_trigger` | Trigger outgoing webhooks | Any | URL + secret |

---

## AI Playground & Custom AI Providers

### Built-in AI (default)
The Playground uses **Z.ai's GLM-4** model by default via the `z-ai-web-dev-sdk`. This works out of the box with no configuration.

### Connect Any AI Provider
Go to **AI Models** in the dashboard to connect any of these providers:

| Provider | Models | Get API Key |
|----------|--------|-------------|
| **OpenAI** | GPT-4o, GPT-4o-mini, o1, o3-mini | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Anthropic** | Claude 3.5 Sonnet, Haiku, Opus | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| **Google Gemini** | Gemini 2.0 Flash, 1.5 Pro/Flash | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Groq** | Llama 3.3 70B, Mixtral (ultra-fast) | [console.groq.com/keys](https://console.groq.com/keys) |
| **DeepSeek** | DeepSeek Chat, Reasoner | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) |
| **Mistral** | Mistral Large, Small, Mixtral | [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys) |
| **Together AI** | 200+ open-source models | [api.together.xyz/settings/api-keys](https://api.together.xyz/settings/api-keys) |
| **Fireworks AI** | Llama, Qwen (fast inference) | [fireworks.ai/api-keys](https://fireworks.ai/api-keys) |
| **Ollama (Local)** | Llama, Qwen, Mistral (free, offline) | [ollama.com/download](https://ollama.com/download) |
| **Custom** | Any OpenAI-compatible API | — |

Once configured, the Playground and the `llm_chat` tool automatically use your AI instead of the default.

### How the agent loop works

1. User sends a message
2. The LLM receives the message + available tools (as function definitions)
3. The LLM decides which tool(s) to call (or responds directly)
4. If tools are called, AgentForge executes them with your stored credentials
5. Results are fed back to the LLM
6. The LLM summarizes what happened
7. Steps 2-6 repeat up to 6 times max

---

## Security

### Credential Storage
- All provider credentials (API keys, tokens, passwords) are encrypted with **AES-256-GCM** before being stored in the database
- Credentials are **never returned in plaintext** after saving — only displayed once if applicable
- Encryption key is configured via the `CRED_ENC_KEY` environment variable

### API Key Security
- API keys are **SHA-256 hashed** at rest (only the hash is stored)
- The full secret is shown **only once** on creation — store it securely
- Keys are **revocable** and **scope-limited**:
  - `tools:execute` — call `/v1/execute`
  - `tools:read` — list tools via `/v1/tools`
  - `integrations:read` — list connected apps
  - `executions:read` — view execution history
  - `playground:use` — run the AI agent
  - `admin` — full access (all scopes)

### Rate Limiting
- **Sliding-window** per-key rate limiting (1-600 requests/min)
- Returns `429 Too Many Requests` with `X-RateLimit-*` headers when exceeded
- Configurable per API key

### Input Validation
- Every tool has a JSON schema defining required fields and types
- Input is validated before execution
- The Postgres tool **rejects non-SELECT queries** (INSERT, UPDATE, DELETE, DROP, etc.)

### Audit Trail
Every security-relevant action is logged immutably:
- API key creation, revocation, deletion
- Integration creation, update, deletion
- Tool executions (with status, duration, input/output)
- Playground runs
- Catalog seeds

---

## Architecture

```
agentforge/
├── src/
│   ├── app/                          # Next.js 16 App Router
│   │   ├── page.tsx                  # Main dashboard (single-page, client-side routing)
│   │   ├── layout.tsx                # Root layout with theme provider
│   │   ├── globals.css               # Off-white + dark brown theme
│   │   └── api/                      # API routes
│   │       ├── v1/                   # Public agent API (requires API key)
│   │       │   ├── execute/          # POST /v1/execute — run a tool
│   │       │   └── tools/            # GET /v1/tools — list tools
│   │       ├── tools/                # GET /api/tools — catalog (dashboard)
│   │       ├── integrations/         # CRUD for connected apps
│   │       ├── keys/                 # CRUD for API keys
│   │       ├── executions/           # List + detail execution history
│   │       ├── metrics/              # Dashboard KPIs
│   │       ├── usage/                # 30-day analytics
│   │       ├── audit/                # Audit trail
│   │       ├── playground/           # AI agent endpoint
│   │       ├── schedules/            # Scheduled executions + tick runner
│   │       ├── llm-providers/        # List AI providers
│   │       ├── llm-test/             # Test AI connection
│   │       ├── execute-internal/     # Dashboard tool execution (no API key)
│   │       ├── rerun/                # Re-execute past execution
│   │       ├── reset-data/           # Clear all user data
│   │       └── seed/                 # Seed tool catalog
│   ├── components/
│   │   ├── platform/
│   │   │   ├── views/                # 10 dashboard views
│   │   │   ├── provider-icon.tsx     # Provider icons
│   │   │   └── schedule-ticker.tsx   # Background schedule runner
│   │   └── ui/                       # shadcn/ui components
│   └── lib/
│       ├── db.ts                     # Prisma client
│       ├── crypto.ts                 # AES-256-GCM + SHA-256
│       ├── rate-limit.ts             # Sliding-window limiter
│       ├── audit.ts                  # Audit logger
│       ├── auth.ts                   # Bearer token auth + scopes
│       ├── session.ts                # Operator session
│       ├── live-socket.ts            # WebSocket client
│       ├── api-client.ts             # Fetcher + helpers
│       ├── llm/
│       │   └── client.ts             # Unified LLM client (any provider)
│       └── tools/
│           ├── catalog.ts            # 15 tool definitions + provider meta
│           └── engine.ts             # Execution engine
├── prisma/
│   └── schema.prisma                 # 8 models (User, Tool, Integration, ApiKey, Execution, AuditLog, PlaygroundSession, Schedule)
├── mini-services/
│   ├── logs-service/                 # Socket.IO server (port 3004) for live streaming
│   └── schedule-runner/              # Background schedule worker (optional)
└── package.json
```

### Data Flow

```
User → Dashboard (React) → /api/* routes → Prisma → SQLite
                          ↓
Agent → /v1/execute → Auth → Rate Limit → Validate → Execute Tool → Log → WebSocket → Dashboard
```

---

## Getting Started

### Prerequisites
- Node.js 18+ or Bun
- An API key for at least one AI provider (optional — Z.ai works by default)

### Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd agentforge

# Install dependencies
bun install

# Set up the database
bun run db:push

# Start the dev server
bun run dev
```

The app runs on `http://localhost:3000`.

### Start the Live Logs Service (optional, for real-time execution streaming)

```bash
cd mini-services/logs-service
bun install
bun run dev
```

Runs on port 3004.

### Seed the Tool Catalog

The catalog auto-seeds on first dashboard load, or manually:

```bash
curl -X POST http://localhost:3000/api/seed
```

### Create Your First API Key

1. Open the dashboard
2. Go to **API Keys** → **Create Key**
3. Name it, select scopes, set rate limit
4. **Copy the secret immediately** (shown only once)

### Connect a Provider

1. Go to **Connected Apps** → **New Connection**
2. Select a provider (Slack, GitHub, etc.)
3. Click the **"Get Credentials"** link to open the provider's API key page
4. Enter your credentials → **Encrypt & Save**

### Execute a Tool

```bash
export AGENTFORGE_API_KEY="af_live_..."

curl -X POST http://localhost:3000/api/v1/execute \
  -H "Authorization: Bearer $AGENTFORGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "llm_generate_text",
    "input": { "prompt": "Say hello" }
  }'
```

---

## API Reference

### Public API (requires API key)

#### `POST /v1/execute`
Execute a tool. Requires `tools:execute` scope.

```http
Authorization: Bearer af_live_...
Content-Type: application/json

{
  "tool": "slack_send_message",
  "input": { "channel": "#general", "text": "Hello!" },
  "integrationId": null
}
```

**Response (200):**
```json
{
  "executionId": "ck...",
  "status": "success",
  "output": { "ok": true, "ts": "..." },
  "durationMs": 412
}
```

**Error responses:**
- `401` — Invalid or missing API key
- `403` — Missing required scope
- `429` — Rate limit exceeded
- `502` — Tool execution failed

#### `GET /v1/tools`
List available tools. Requires `tools:read` scope.

### Dashboard API (no API key required, internal)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tools` | GET | List tool catalog |
| `/api/integrations` | GET, POST | List/create connected apps |
| `/api/integrations/[id]` | GET, PATCH, DELETE | Manage a connection |
| `/api/keys` | GET, POST | List/create API keys |
| `/api/keys/[id]` | PATCH, DELETE | Revoke/delete a key |
| `/api/executions` | GET | List execution history |
| `/api/executions/[id]` | GET | Execution detail |
| `/api/metrics` | GET | Dashboard KPIs |
| `/api/usage` | GET | 30-day analytics |
| `/api/audit` | GET | Audit trail |
| `/api/playground` | POST | Run the AI agent |
| `/api/schedules` | GET, POST | List/create schedules |
| `/api/schedules/[id]` | PATCH, DELETE | Manage a schedule |
| `/api/schedules/tick` | POST | Process due schedules |
| `/api/llm-providers` | GET | List AI providers |
| `/api/llm-test` | POST | Test AI connection |
| `/api/execute-internal` | POST | Execute tool (dashboard) |
| `/api/rerun` | POST | Re-execute past execution |
| `/api/reset-data` | POST | Clear all user data |
| `/api/seed` | POST | Seed tool catalog |

---

## Dashboard Guide

### Dashboard
Overview with KPI cards (executions, tools, connections, API keys), 24-hour execution chart, status breakdown, top tools, and recent executions.

### Tool Catalog
Browse all 15 tools. Search and filter by category. Click any tool to see its schema, try it with sample input, or copy the cURL command.

### Connected Apps
Manage provider credentials. Each provider has a **direct link** to its API key setup page. Credentials are encrypted with AES-256-GCM.

### API Keys
Create, revoke, and delete API keys. Each key has scopes and a rate limit. The secret is shown only once on creation.

### Execution Logs
Real-time stream of every tool call with status, duration, input, and output. Filter by status, search, export to JSON. Click any execution to see details or re-run it.

### AI Playground
Chat with an autonomous AI agent. The agent decides which tools to call, executes them, and reports back. Supports **markdown** (bold, italic, code, lists). The chat **grows naturally** as you converse. Shows which AI provider is active.

### AI Models
Connect any AI provider (OpenAI, Anthropic, Gemini, Groq, DeepSeek, Mistral, Together, Fireworks, Ollama, or custom). Test the connection before saving. The Playground uses your configured AI instead of the default Z.ai.

### Schedules
Create recurring tool executions. The dashboard automatically processes due schedules every 60 seconds. Pause, resume, or delete schedules.

### Usage Analytics
30-day deep dive: daily execution trends, activity by hour, executions by provider (pie chart), latency percentiles (P50/P90/P99), and top tools ranking.

### Audit Trail
Immutable log of every security-relevant action: key creation/revocation, credential changes, tool executions, playground runs. Searchable and filterable.

### API Docs
Quickstart guides (cURL, Node.js, Python, OpenAI integration), API reference, security overview, and a complete table of required credentials per provider.

---

## Connecting Providers

Each provider needs specific credentials. Here's what you need:

| Provider | Credential | Where to Get It |
|----------|-----------|-----------------|
| **Slack** | Bot OAuth Token (`xoxb-...`) | [api.slack.com/apps](https://api.slack.com/apps?new_app=1) — create app, add `chat:write` + `channels:read` scopes |
| **GitHub** | Personal Access Token (`ghp_...`) | [github.com/settings/tokens](https://github.com/settings/tokens/new?scopes=repo&description=AgentForge) — needs `repo` scope |
| **PostgreSQL** | Connection String | Your database admin — format: `postgresql://user:pass@host:5432/db` |
| **SMTP** | Host, Port, User, Password, From | Your email provider — Gmail uses App Passwords, not regular passwords |
| **Salesforce** | Instance URL + Access Token | [Salesforce Connected App](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth.htm) — OAuth flow |
| **Notion** | Integration Token (`secret_...`) | [notion.so/my-integrations](https://www.notion.so/my-integrations/new) — share database with integration |
| **Twilio** | Account SID + Auth Token + Phone Number | [console.twilio.com](https://console.twilio.com/) — trial accounts get 1 free number |
| **Linear** | Personal API Key (`lin_api_...`) | [linear.app/settings/api](https://linear.app/settings/api) |
| **LLM (Z.ai)** | None | Works out of the box |
| **OpenAI** | API Key + Base URL + Model | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Anthropic** | API Key + Base URL + Model | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| **Ollama** | None (local) | [ollama.com/download](https://ollama.com/download) — run `ollama pull llama3.2` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 + shadcn/ui (New York) |
| **Database** | Prisma ORM + SQLite |
| **Real-time** | Socket.IO (mini-service on port 3004) |
| **AI** | z-ai-web-dev-sdk (default) + any OpenAI-compatible API |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Markdown** | react-markdown |
| **Animations** | Framer Motion + tw-animate-css |
| **Toasts** | Sonner |
| **Theme** | Custom off-white + dark brown, next-themes for dark mode |

---

## Project Structure

```
agentforge/
├── src/
│   ├── app/                  # Next.js routes + API
│   ├── components/           # React components
│   │   ├── platform/         # App-specific components
│   │   └── ui/               # shadcn/ui primitives
│   └── lib/                  # Business logic
│       ├── llm/              # Unified LLM client
│       ├── tools/            # Tool catalog + engine
│       └── *.ts              # Shared utilities
├── prisma/                   # Database schema
├── mini-services/            # Background services
│   ├── logs-service/         # WebSocket live streaming
│   └── schedule-runner/      # Scheduled execution worker
├── public/                   # Static assets
└── package.json
```

---

## Roadmap

### Done
- [x] 15 pre-built tools across 7 categories
- [x] AES-256-GCM credential encryption
- [x] SHA-256 hashed API keys with scopes
- [x] Sliding-window rate limiting
- [x] Live execution streaming (WebSocket)
- [x] AI Playground with function calling
- [x] Any AI provider support (OpenAI, Anthropic, Gemini, Groq, etc.)
- [x] Scheduled executions
- [x] Usage analytics
- [x] Audit trail
- [x] Re-run executions
- [x] Provider connection links
- [x] Minimalist off-white + dark brown theme
- [x] Markdown rendering in playground

### Planned
- [ ] OAuth2 callback flow (automatic credential exchange for Slack, GitHub, Salesforce)
- [ ] Incoming webhooks (receive events from external services)
- [ ] Tool chains / workflows (multi-step agent sequences)
- [ ] Team / multi-tenant support with NextAuth
- [ ] Billing & usage limits per API key
- [ ] More tools: Jira, Discord, Telegram, Stripe, Shopify
- [ ] SDK packages (Node.js, Python, Go)
- [ ] SOC 2 / ISO 27001 compliance

---

## License

MIT

---

*Built with Next.js 16, TypeScript, Tailwind CSS, Prisma, and Socket.IO.*
