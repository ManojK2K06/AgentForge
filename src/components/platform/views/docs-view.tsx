'use client'

import { useState } from 'react'
import { BookOpen, Terminal, Copy, Check, KeyRound, Zap, ShieldCheck, Code2, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

const CURL_EXAMPLE = `# 1. Create an API key in the dashboard, then:
export AGENTFORGE_API_KEY="af_live_your_key_here"

# 2. Execute a tool
curl -X POST https://api.agentforge.dev/v1/execute \\
  -H "Authorization: Bearer $AGENTFORGE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "slack_send_message",
    "input": {
      "channel": "#general",
      "text": "Hello from AgentForge!"
    },
    "integrationId": null
  }'`

const NODE_EXAMPLE = `// Install: npm install agentforge
import { AgentForge } from 'agentforge'

const af = new AgentForge({ apiKey: process.env.AGENTFORGE_API_KEY })

// Execute a tool
const result = await af.execute({
  tool: 'github_create_issue',
  input: {
    owner: 'myorg',
    repo: 'myrepo',
    title: 'Bug: login fails on Safari',
    body: 'Reported by customer #1234',
    labels: ['bug', 'frontend']
  }
})

console.log(result.output)
// { issue: { number: 42, html_url: 'https://...', title: '...' } }`

const PYTHON_EXAMPLE = `# Install: pip install agentforge
from agentforge import AgentForge

af = AgentForge(api_key="af_live_your_key_here")

# Query Postgres
result = af.execute(
    tool="postgres_query",
    input={
        "query": "SELECT count(*) FROM users WHERE created_at > now() - interval '7 days'",
    }
)

print(result.output)
# { rows: [{ count: 1337 }], rowCount: 1 }`

const OPENAI_EXAMPLE = `// Use AgentForge tools directly with OpenAI function calling
import OpenAI from 'openai'
import { AgentForge } from 'agentforge'

const openai = new OpenAI()
const af = new AgentForge({ apiKey: process.env.AGENTFORGE_API_KEY })

// 1. Fetch available tools
const { tools } = await af.listTools()

// 2. Let the LLM decide which to call
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Send a Slack message to #alerts: build passed' }],
  tools: tools.map(t => ({
    type: 'function',
    function: { name: t.slug, description: t.description, parameters: t.inputSchema }
  }))
})

// 3. Execute the chosen tool via AgentForge
const call = completion.choices[0].message.tool_calls[0]
const result = await af.execute({
  tool: call.function.name,
  input: JSON.parse(call.function.arguments)
})`

export function DocsView() {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">API Documentation</h2>
        <p className="text-sm text-muted-foreground">
          Integrate AgentForge into your AI agent in minutes. Authenticate, discover tools, and execute actions.
        </p>
      </div>

      {/* Quickstart steps */}
      <div className="relative grid gap-4 md:grid-cols-3">
        <QuickstartStep
          number={1}
          tone="emerald"
          icon={KeyRound}
          title="Create an API key"
          description="Generate a key in the API Keys tab. Store the secret securely — it's shown only once."
        />
        <QuickstartStep
          number={2}
          tone="sky"
          icon={Zap}
          title="Connect an app"
          description="Add credentials for Slack, GitHub, Postgres, etc. in the Connected Apps tab. Encrypted at rest."
        />
        <QuickstartStep
          number={3}
          tone="amber"
          icon={Terminal}
          title="Call /v1/execute"
          description="POST the tool slug + input with your API key. We handle auth, rate limits, and errors."
        />
        <div aria-hidden className="pointer-events-none absolute left-1/3 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <ArrowRight className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <div aria-hidden className="pointer-events-none absolute left-2/3 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <ArrowRight className="h-5 w-5 text-muted-foreground/40" />
        </div>
      </div>

      {/* Code examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Code2 className="h-4 w-4" /> Quickstart Examples
          </CardTitle>
          <CardDescription className="text-xs">Copy any snippet to get started immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="curl">
            <TabsList className="grid w-fit grid-cols-4">
              <TabsTrigger value="curl" className="text-xs">cURL</TabsTrigger>
              <TabsTrigger value="node" className="text-xs">Node.js</TabsTrigger>
              <TabsTrigger value="python" className="text-xs">Python</TabsTrigger>
              <TabsTrigger value="openai" className="text-xs">OpenAI</TabsTrigger>
            </TabsList>
            <TabsContent value="curl" className="mt-4">
              <CodeBlock id="curl" code={CURL_EXAMPLE} copied={copied} onCopy={copy} />
            </TabsContent>
            <TabsContent value="node" className="mt-4">
              <CodeBlock id="node" code={NODE_EXAMPLE} copied={copied} onCopy={copy} />
            </TabsContent>
            <TabsContent value="python" className="mt-4">
              <CodeBlock id="python" code={PYTHON_EXAMPLE} copied={copied} onCopy={copy} />
            </TabsContent>
            <TabsContent value="openai" className="mt-4">
              <CodeBlock id="openai" code={OPENAI_EXAMPLE} copied={copied} onCopy={copy} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* API reference */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4" /> POST /v1/execute
            </CardTitle>
            <CardDescription className="text-xs">Execute a tool. Requires <code className="font-mono">tools:execute</code> scope.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">Headers</div>
              <pre className="rounded-lg border bg-muted/30 p-3 text-xs"><code>Authorization: Bearer af_live_...
Content-Type: application/json</code></pre>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">Body</div>
              <pre className="rounded-lg border bg-muted/30 p-3 text-xs"><code>{`{
  "tool": "slack_send_message",
  "input": { "channel": "#general", "text": "Hi" },
  "integrationId": null
}`}</code></pre>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">Response (200)</div>
              <pre className="rounded-lg border bg-muted/30 p-3 text-xs"><code>{`{
  "executionId": "ck...",
  "status": "success",
  "output": { "ok": true, "ts": "..." },
  "durationMs": 412
}`}</code></pre>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="border-[#5C7A52]/30 bg-[#5C7A52]/10 text-[10px] text-[#5C7A52]">200 Success</Badge>
              <Badge variant="outline" className="border-[#8A6D3B]/30 bg-[#8A6D3B]/10 text-[10px] text-[#8A6D3B]">401 Unauthorized</Badge>
              <Badge variant="outline" className="border-[#A0533A]/30 bg-[#A0533A]/10 text-[10px] text-[#A0533A]">403 Missing scope</Badge>
              <Badge variant="outline" className="border-[#8A6D3B]/30 bg-[#8A6D3B]/10 text-[10px] text-[#8A6D3B]">429 Rate limited</Badge>
              <Badge variant="outline" className="border-[#A0533A]/30 bg-[#A0533A]/10 text-[10px] text-[#A0533A]">502 Tool error</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" /> GET /v1/tools
            </CardTitle>
            <CardDescription className="text-xs">List available tools for agent discovery. Requires <code className="font-mono">tools:read</code> scope.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">Headers</div>
              <pre className="rounded-lg border bg-muted/30 p-3 text-xs"><code>Authorization: Bearer af_live_...</code></pre>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">Response (200)</div>
              <pre className="rounded-lg border bg-muted/30 p-3 text-xs"><code>{`{
  "tools": [
    {
      "slug": "slack_send_message",
      "name": "Send Slack Message",
      "description": "...",
      "category": "communication",
      "provider": "slack",
      "authScheme": "bearer",
      "inputSchema": { ... }
    }
  ]
}`}</code></pre>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security */}
      <Card className="border-primary/30 dark:border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> Security & Reliability
          </CardTitle>
          <CardDescription className="text-xs">Production-grade security built in by default.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SecurityFeature
            icon={KeyRound}
            title="Hashed API keys"
            desc="SHA-256 hashed at rest. Secrets shown once on creation."
          />
          <SecurityFeature
            icon={ShieldCheck}
            title="Encrypted credentials"
            desc="AES-256-GCM encryption for all stored integration credentials."
          />
          <SecurityFeature
            icon={Zap}
            title="Rate limiting"
            desc="Sliding-window per-key rate limits. Configurable up to 600/min."
          />
          <SecurityFeature
            icon={BookOpen}
            title="Full audit trail"
            desc="Every key, credential, and execution action logged immutably."
          />
        </CardContent>
      </Card>

      {/* Required APIs & Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-[#8A6D3B]" /> Required APIs &amp; Credentials
          </CardTitle>
          <CardDescription className="text-xs">
            Each provider needs specific credentials. The LLM tool works out-of-the-box — everything else needs credentials from the provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-medium">Provider</th>
                  <th className="py-2 pr-4 font-medium">Credential Needed</th>
                  <th className="py-2 pr-4 font-medium">Where to Get It</th>
                  <th className="py-2 font-medium">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {REQUIRED_CREDENTIALS.map((c) => (
                  <tr key={c.provider} className="hover:bg-muted/30">
                    <td className="py-2.5 pr-4 font-medium">{c.provider}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{c.credential}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{c.where}</td>
                    <td className="py-2.5">
                      {c.link ? (
                        <a href={c.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline dark:text-primary">
                          Open <ArrowRight className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const REQUIRED_CREDENTIALS = [
  { provider: 'LLM (Z.ai)', credential: 'None — built-in', where: 'Works out of the box', link: null as string | null },
  { provider: 'Slack', credential: 'Bot OAuth Token (xoxb-...)', where: 'Create Slack App → install to workspace', link: 'https://api.slack.com/apps?new_app=1' },
  { provider: 'GitHub', credential: 'Personal Access Token (ghp_...)', where: 'GitHub Settings → Developer settings → Tokens', link: 'https://github.com/settings/tokens/new?scopes=repo&description=AgentForge' },
  { provider: 'PostgreSQL', credential: 'Connection String', where: 'Your database admin panel', link: null },
  { provider: 'SMTP (Email)', credential: 'Host, Port, User, Password, From', where: 'Your email provider (Gmail, SES, etc.)', link: null },
  { provider: 'HTTP / REST', credential: 'Bearer Token (optional)', where: 'Your API provider', link: null },
  { provider: 'Webhook', credential: 'Webhook URL + Secret', where: 'n8n, Make, Zapier, or custom endpoint', link: null },
  { provider: 'Salesforce', credential: 'Instance URL + Access Token', where: 'Salesforce Setup → App Manager → Connected App', link: 'https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth.htm' },
  { provider: 'Notion', credential: 'Integration Token (secret_...)', where: 'notion.so/my-integrations', link: 'https://www.notion.so/my-integrations/new' },
  { provider: 'Twilio (SMS)', credential: 'Account SID + Auth Token + Phone Number', where: 'Twilio Console dashboard', link: 'https://console.twilio.com/' },
  { provider: 'Linear', credential: 'Personal API Key (lin_api_...)', where: 'Linear Settings → API', link: 'https://linear.app/settings/api' },
]

function CodeBlock({
  id,
  code,
  copied,
  onCopy,
}: {
  id: string
  code: string
  copied: string | null
  onCopy: (id: string, text: string) => void
}) {
  const lines = code.split('\n')
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onCopy(id, code)}
        className="absolute right-2 top-2 z-10 h-7 gap-1 text-xs text-[#8A7E72] hover:bg-[#3D2B1F] hover:text-[#E5DFD5]"
      >
        {copied === id ? <Check className="h-3 w-3 text-[#5C7A52]" /> : <Copy className="h-3 w-3" />}
        {copied === id ? 'Copied' : 'Copy'}
      </Button>
      <ScrollArea className="max-h-80">
        <pre className="overflow-x-auto rounded-lg border border-[#3D2B1F] bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100">
          <code className="grid grid-cols-[auto_1fr] gap-x-4">
            {lines.map((line, i) => (
              <span key={i} className="contents">
                <span className="select-none text-right text-[#6B5B4E] tabular-nums" aria-hidden>{i + 1}</span>
                <span className="whitespace-pre-wrap break-all">{line || ' '}</span>
              </span>
            ))}
          </code>
        </pre>
      </ScrollArea>
    </div>
  )
}

function QuickstartStep({
  number,
  tone,
  icon: Icon,
  title,
  description,
}: {
  number: number
  tone: 'emerald' | 'sky' | 'amber'
  icon: typeof KeyRound
  title: string
  description: string
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-primary/10 text-primary',
    sky: 'bg-[#6B5B4E]/10 text-[#6B5B4E]',
    amber: 'bg-[#8A6D3B]/10 text-[#8A6D3B]',
  }
  return (
    <Card className="relative transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${tones[tone]}`}>{number}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function SecurityFeature({ icon: Icon, title, desc }: { icon: typeof KeyRound; title: string; desc: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-sm font-medium">{title}</div>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  )
}
