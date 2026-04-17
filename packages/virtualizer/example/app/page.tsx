'use client'

import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import {
  useVirtualizer,
  VirtualizedList,
} from '@zenbu/virtualizer'
import type {
  LazyDataSource,
  Materializer,
  MaterializedItem,
  ViewportSnapshot,
  MeasuredSize,
} from '@zenbu/virtualizer'
// ─── Types ───────────────────────────────────────────────────

interface ChatEventPayload {
  messageId: string
  role?: 'user' | 'assistant' | 'system'
  content?: string
  variant?: string
  toolName?: string
  toolInput?: string
  toolOutput?: string
}

interface ChatEvent {
  id: string
  seq: number
  timestamp: number
  type: string
  payload: ChatEventPayload
}

type ChatRole = 'user' | 'assistant' | 'system'
type ChatVariant = 'text' | 'code' | 'error' | 'diff' | 'table' | 'list'

interface ChatToolCall {
  name: string
  input: string
  output: string
}

interface ChatTableData {
  headers: string[]
  rows: string[][]
}

interface ChatMessageState {
  id: string
  role: ChatRole
  content: string
  isStreaming: boolean
  variant: ChatVariant
  toolCalls: ChatToolCall[]
}

type ChatRenderBlock =
  | {
      id: string
      messageId: string
      role: ChatRole
      kind: 'text' | 'code' | 'error' | 'diff' | 'list'
      content: string
      showStreamingCursor: boolean
    }
  | {
      id: string
      messageId: string
      role: ChatRole
      kind: 'table'
      table: ChatTableData
    }
  | {
      id: string
      messageId: string
      role: ChatRole
      kind: 'tool'
      toolIndex: number
      toolCall: ChatToolCall
    }

interface ChatBlockRenderContext {
  isFirstInMessage: boolean
  isLastInMessage: boolean
}

// ─── Seeded RNG ──────────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

// ─── Content pools ───────────────────────────────────────────

const CODE_BLOCKS = [
  `function fibonacci(n: number): number {\n  if (n <= 1) return n\n  return fibonacci(n - 1) + fibonacci(n - 2)\n}`,
  `export class EventEmitter<T> {\n  private listeners = new Map<string, Set<(data: T) => void>>()\n\n  on(event: string, fn: (data: T) => void) {\n    if (!this.listeners.has(event)) {\n      this.listeners.set(event, new Set())\n    }\n    this.listeners.get(event)!.add(fn)\n  }\n\n  emit(event: string, data: T) {\n    this.listeners.get(event)?.forEach(fn => fn(data))\n  }\n\n  off(event: string, fn: (data: T) => void) {\n    this.listeners.get(event)?.delete(fn)\n  }\n\n  once(event: string, fn: (data: T) => void) {\n    const wrapper = (data: T) => {\n      fn(data)\n      this.off(event, wrapper)\n    }\n    this.on(event, wrapper)\n  }\n}`,
  `async function processQueue<T>(\n  items: T[],\n  concurrency: number,\n  fn: (item: T) => Promise<void>\n) {\n  const queue = [...items]\n  const workers = Array.from(\n    { length: concurrency },\n    async () => {\n      while (queue.length > 0) {\n        const item = queue.shift()!\n        await fn(item)\n      }\n    }\n  )\n  await Promise.all(workers)\n}`,
  `interface Config {\n  host: string\n  port: number\n  debug: boolean\n}`,
  `const result = await fetch("/api/data")\nconst json = await result.json()`,
  `import { createServer } from 'http'\nimport { parse } from 'url'\nimport next from 'next'\n\nconst dev = process.env.NODE_ENV !== 'production'\nconst hostname = 'localhost'\nconst port = 3000\nconst app = next({ dev, hostname, port })\nconst handle = app.getRequestHandler()\n\napp.prepare().then(() => {\n  createServer(async (req, res) => {\n    try {\n      const parsedUrl = parse(req.url!, true)\n      await handle(req, res, parsedUrl)\n    } catch (err) {\n      console.error('Error occurred handling', req.url, err)\n      res.statusCode = 500\n      res.end('internal server error')\n    }\n  })\n    .once('error', (err) => {\n      console.error(err)\n      process.exit(1)\n    })\n    .listen(port, () => {\n      console.log('> Ready on http://' + hostname + ':' + port)\n    })\n})`,
]

const ERROR_MESSAGES = [
  `TypeError: Cannot read properties of undefined (reading 'map')\n    at UserList (src/components/UserList.tsx:42:18)\n    at renderWithHooks (react-dom.development.js:14985:18)\n    at mountIndeterminateComponent (react-dom.development.js:17811:13)\n    at beginWork (react-dom.development.js:19049:16)`,
  `error TS2322: Type 'string' is not assignable to type 'number'.\n\n  src/utils/parse.ts:15:5\n    15     const count: number = getValue()\n                   ~~~~~\n\n  The expected type comes from property 'count'\n  which is declared on type 'Config'`,
  `FATAL ERROR: Reached heap limit Allocation failed\n  JavaScript heap out of memory\n 1: 0xb090e0 node::Abort()\n 2: 0xa1b2c3 v8::Utils::ReportOOMFailure()\n 3: 0xa1b123 v8::internal::V8::FatalProcessOutOfMemory()\n\nAbort trap: 6`,
]

const DIFF_BLOCKS = [
  `--- a/src/config.ts\n+++ b/src/config.ts\n@@ -12,7 +12,9 @@\n export const config = {\n   apiUrl: process.env.API_URL,\n-  timeout: 5000,\n+  timeout: 30000,\n+  retries: 3,\n+  backoff: 'exponential',\n   debug: false,\n }`,
  `--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ -1,15 +1,22 @@\n-import { verify } from 'jsonwebtoken'\n+import { verify, sign } from 'jsonwebtoken'\n+import { hash, compare } from 'bcrypt'\n \n-export function authenticate(token: string) {\n-  return verify(token, SECRET)\n+export async function authenticate(token: string) {\n+  try {\n+    const payload = verify(token, SECRET)\n+    const user = await db.users.findById(payload.sub)\n+    if (!user) throw new AuthError('User not found')\n+    return user\n+  } catch (err) {\n+    throw new AuthError('Invalid token')\n+  }\n }`,
]

const TABLE_DATA = [
  { headers: ['Endpoint', 'Method', 'Latency', 'Status'], rows: [
    ['/api/users', 'GET', '45ms', '200'], ['/api/users/:id', 'GET', '23ms', '200'],
    ['/api/posts', 'GET', '120ms', '200'], ['/api/posts', 'POST', '89ms', '201'],
    ['/api/auth/login', 'POST', '234ms', '200'], ['/api/auth/refresh', 'POST', '56ms', '200'],
    ['/api/search', 'GET', '890ms', '200'], ['/api/uploads', 'POST', '1.2s', '201'],
  ]},
  { headers: ['Package', 'Current', 'Latest', 'Breaking'], rows: [
    ['react', '18.2.0', '19.1.0', 'Yes'], ['next', '14.1.0', '16.1.1', 'Yes'],
    ['typescript', '5.3.3', '5.7.2', 'No'], ['tailwindcss', '3.4.1', '4.1.0', 'Yes'],
    ['eslint', '8.56.0', '9.20.0', 'Yes'],
  ]},
]

const LIST_CONTENT = [
  '1. Set up the database schema\n   - Users table with UUID primary key\n   - Posts table with foreign key to users\n   - Comments with nested threading support\n2. Create the API routes\n   - REST endpoints for CRUD operations\n   - WebSocket endpoint for real-time updates\n   - Rate limiting middleware\n3. Implement authentication\n   - JWT-based session management\n   - OAuth providers (Google, GitHub)\n   - Role-based access control\n4. Add caching layer\n   - Redis for session storage\n   - CDN for static assets\n   - In-memory cache for hot data',
  '- Check if the environment variable is set\n- Validate the input schema\n- Sanitize user input (prevent XSS)\n- Log the request with correlation ID\n- Apply rate limiting\n- Authenticate the request\n- Authorize based on user role\n- Execute the business logic\n- Format the response\n- Set appropriate cache headers\n- Log the response time',
]

const SHORT_MESSAGES = [
  'Got it.', 'Sure, let me check.', 'Done.', 'Yes.', 'No, that won\'t work.',
  'Can you elaborate?', 'Makes sense.', 'Let me think about that.',
  'Approved.', 'Looks good to me.', 'LGTM', 'Try again?',
]

const LONG_PROSE = [
  'The issue is more nuanced than it first appears. When the component unmounts, the cleanup function in the useEffect isn\'t properly cancelling the pending async operations. This creates a race condition where the state update fires after the component is already unmounted, which React warns about. The root cause is that the AbortController signal isn\'t being passed to the inner fetch call, only the outer one.\n\nTo fix this properly, you need to create the AbortController at the top of the effect, pass its signal to every async operation inside, and call abort() in the cleanup function. This ensures all pending operations are cancelled when the component unmounts, regardless of which stage they\'re in.\n\nAdditionally, consider whether you actually need this data-fetching pattern at all. If the data is only used by this one component, a React Query or SWR wrapper would handle all of this complexity for you.',
  'Let me walk through the database migration strategy step by step. The key constraint is that we need zero-downtime deployment, which means we can\'t simply alter the table in place.\n\nPhase 1 (Expand): Add the new column alongside the old one. Deploy code that writes to both columns but reads from the old one. This is backwards-compatible.\n\nPhase 2 (Migrate): Run a background job that copies data from the old column to the new one. This can take hours for large tables without affecting production traffic.\n\nPhase 3 (Contract): Deploy code that reads from the new column. Remove the old column in a subsequent migration once you\'re confident everything works.',
]

const TOOL_OUTPUTS = [
  'import React from "react"\nimport { render, screen } from "@testing-library/react"\nimport { UserProfile } from "./UserProfile"\n\ndescribe("UserProfile", () => {\n  it("renders user name", () => {\n    render(<UserProfile user={{ name: "Alice" }} />)\n    expect(screen.getByText("Alice")).toBeInTheDocument()\n  })\n\n  it("shows loading state", () => {\n    render(<UserProfile user={null} loading />)\n    expect(screen.getByTestId("skeleton")).toBeInTheDocument()\n  })\n})',
  'Running 47 tests...\n\n  PASS  src/utils/parse.test.ts (12 tests)\n  PASS  src/hooks/useAuth.test.ts (8 tests)\n  FAIL  src/components/Dashboard.test.tsx\n    x renders chart data (45ms)\n    x handles empty dataset (12ms)\n    + shows loading spinner (8ms)\n  PASS  src/api/routes.test.ts (24 tests)\n\nTests: 2 failed, 45 passed, 47 total\nTime: 4.521s',
  'total 48K\ndrwxr-xr-x  12 user staff  384 Mar 20 14:23 .\n-rw-r--r--   1 user staff  1.2K Mar 20 14:23 index.ts\n-rw-r--r--   1 user staff  3.4K Mar 20 14:20 auth.ts\n-rw-r--r--   1 user staff  2.1K Mar 19 16:45 config.ts\n-rw-r--r--   1 user staff  890  Mar 18 11:30 types.ts\ndrwxr-xr-x   4 user staff  128  Mar 20 14:23 routes\ndrwxr-xr-x   6 user staff  192  Mar 20 12:00 middleware',
]

const STREAMING_WORDS = 'The key insight here is that we need to restructure the data pipeline to handle backpressure correctly. When the producer generates events faster than the consumer can process them, we need a buffering strategy that does not consume unbounded memory. The standard approach is to use a bounded queue with a configurable high-water mark. When the queue reaches capacity, the producer is signaled to pause via a mechanism like a Promise that resolves when the consumer drains below the low-water mark. This is essentially how Node.js streams work under the hood, and it is a well-proven pattern for handling asymmetric throughput between pipeline stages. Let me show you an implementation that handles this correctly, including error propagation and graceful shutdown.'.split(' ')

const USER_QUESTIONS = [
  'Can you help me fix this bug? The function returns undefined when the input is an empty array.',
  'How do I implement a binary search tree in TypeScript?',
  'The tests are failing on CI but passing locally. Any ideas?',
  'Can you refactor this component to use hooks?',
  'I need to add pagination to this API endpoint.',
  'Why is this useEffect running on every render?',
  'How should I structure the database schema for multi-tenancy?',
  'I need real-time notifications. WebSockets or SSE?',
  'Can you review this migration script?',
  'How do I handle file uploads with progress tracking?',
]

// ─── Generate events ─────────────────────────────────────────

function generateEvents(count: number, seed: number): ChatEvent[] {
  const rng = seededRandom(seed)
  const events: ChatEvent[] = []
  let seq = 0
  let messageIndex = 0
  const baseTime = Date.now() - count * 2000
  const toolNames = ['read_file', 'write_file', 'run_command', 'search_code', 'list_directory', 'run_tests']

  while (messageIndex < count) {
    const msgId = `msg-${seed}-${messageIndex}`
    const isUser = rng() < 0.3
    const role = isUser ? 'user' : 'assistant'

    let variant: ChatVariant = 'text'
    if (!isUser) {
      const r = rng()
      if (r < 0.2) variant = 'code'
      else if (r < 0.3) variant = 'error'
      else if (r < 0.38) variant = 'diff'
      else if (r < 0.45) variant = 'table'
      else if (r < 0.52) variant = 'list'
    }

    events.push({
      id: `evt-${seed}-${seq}`, seq: seq++, timestamp: baseTime + messageIndex * 2000,
      type: 'message_start', payload: { messageId: msgId, role, variant },
    })

    let content: string
    if (isUser) {
      content = rng() < 0.4
        ? SHORT_MESSAGES[Math.floor(rng() * SHORT_MESSAGES.length)]
        : USER_QUESTIONS[Math.floor(rng() * USER_QUESTIONS.length)]
    } else {
      switch (variant) {
        case 'code': content = CODE_BLOCKS[Math.floor(rng() * CODE_BLOCKS.length)]; break
        case 'error': content = ERROR_MESSAGES[Math.floor(rng() * ERROR_MESSAGES.length)]; break
        case 'diff': content = DIFF_BLOCKS[Math.floor(rng() * DIFF_BLOCKS.length)]; break
        case 'table': content = JSON.stringify(TABLE_DATA[Math.floor(rng() * TABLE_DATA.length)]); break
        case 'list': content = LIST_CONTENT[Math.floor(rng() * LIST_CONTENT.length)]; break
        default:
          content = rng() < 0.3
            ? LONG_PROSE[Math.floor(rng() * LONG_PROSE.length)]
            : `Here's what I found: ${SHORT_MESSAGES[Math.floor(rng() * SHORT_MESSAGES.length)]} The approach handles the edge cases properly.`
      }
    }

    events.push({
      id: `evt-${seed}-${seq}`, seq: seq++, timestamp: baseTime + messageIndex * 2000 + 100,
      type: 'message_delta', payload: { messageId: msgId, content },
    })

    if (!isUser) {
      const toolCount = rng() < 0.3 ? Math.floor(rng() * 3) + 1 : rng() < 0.5 ? 1 : 0
      for (let t = 0; t < toolCount; t++) {
        const toolName = toolNames[Math.floor(rng() * toolNames.length)]
        const toolOutput = TOOL_OUTPUTS[Math.floor(rng() * TOOL_OUTPUTS.length)]
        events.push(
          { id: `evt-${seed}-${seq}`, seq: seq++, timestamp: baseTime + messageIndex * 2000 + 200 + t * 100, type: 'tool_use', payload: { messageId: msgId, toolName, toolInput: `{"path": "src/index.ts"}` } },
          { id: `evt-${seed}-${seq}`, seq: seq++, timestamp: baseTime + messageIndex * 2000 + 300 + t * 100, type: 'tool_result', payload: { messageId: msgId, toolName, toolOutput } },
        )
      }
    }

    events.push({
      id: `evt-${seed}-${seq}`, seq: seq++, timestamp: baseTime + messageIndex * 2000 + 800,
      type: 'message_end', payload: { messageId: msgId },
    })
    messageIndex++
  }
  return events
}

// ─── Data sources ────────────────────────────────────────────

function createStaticDataSource(events: ChatEvent[]): LazyDataSource<ChatEvent> {
  const listeners = new Set<(count: number) => void>()
  return {
    async *getRange(start: number, end: number) {
      for (let i = start; i < Math.min(end, events.length); i++) yield events[i]
    },
    getRangeSync(start: number, end: number) {
      return events.slice(start, Math.min(end, events.length))
    },
    getCount() { return events.length },
    onAppend(cb: (n: number) => void) { listeners.add(cb); return () => listeners.delete(cb) },
  }
}

class MutableChatDataSource implements LazyDataSource<ChatEvent> {
  events: ChatEvent[] = []
  private listeners = new Set<(count: number) => void>()

  push(...newEvents: ChatEvent[]) {
    this.events.push(...newEvents)
    for (const l of this.listeners) l(this.events.length)
  }

  async *getRange(start: number, end: number) {
    for (let i = start; i < Math.min(end, this.events.length); i++) yield this.events[i]
  }
  getRangeSync(start: number, end: number) {
    return this.events.slice(start, Math.min(end, this.events.length))
  }
  getCount() { return this.events.length }
  onAppend(cb: (n: number) => void) { this.listeners.add(cb); return () => this.listeners.delete(cb) }
}

const CODE_CHUNK_LINES = 16
const DIFF_CHUNK_LINES = 18
const ERROR_CHUNK_LINES = 10
const LIST_CHUNK_LINES = 9
const TABLE_CHUNK_ROWS = 5

function createEmptyMessageState(
  messageId: string,
  role: ChatRole,
  variant: ChatVariant,
): ChatMessageState {
  return {
    id: messageId,
    role,
    content: '',
    isStreaming: true,
    variant,
    toolCalls: [],
  }
}

function sampleTextSignature(text: string): string {
  if (text.length === 0) return '0'

  let hash = 2166136261
  const step = Math.max(1, Math.floor(text.length / 48))
  for (let index = 0; index < text.length; index += step) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  hash ^= text.charCodeAt(text.length - 1)
  hash = Math.imul(hash, 16777619)

  return `${text.length}:${(hash >>> 0).toString(36)}`
}

function splitParagraphText(content: string): string[] {
  if (content.length === 0) return ['']

  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)

  return paragraphs.length > 0 ? paragraphs : ['']
}

function splitByLineGroups(content: string, linesPerGroup: number): string[] {
  const lines = content.split('\n')
  const groups: string[] = []

  for (let index = 0; index < lines.length; index += linesPerGroup) {
    groups.push(lines.slice(index, index + linesPerGroup).join('\n'))
  }

  return groups.length > 0 ? groups : ['']
}

function parseTableContent(content: string): ChatTableData | null {
  try {
    const parsed = JSON.parse(content) as ChatTableData
    if (!Array.isArray(parsed.headers) || !Array.isArray(parsed.rows)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function createBlockCacheKey(block: ChatRenderBlock): string {
  if ('showStreamingCursor' in block && block.showStreamingCursor) {
    return `${block.id}:streaming`
  }

  switch (block.kind) {
    case 'table':
      return `${block.id}:${sampleTextSignature(JSON.stringify(block.table))}`
    case 'tool':
      return `${block.id}:${sampleTextSignature(`${block.toolCall.name}:${block.toolCall.input}:${block.toolCall.output}`)}`
    default:
      return `${block.id}:${sampleTextSignature(block.content)}:${block.showStreamingCursor ? 1 : 0}`
  }
}

function estimateChatBlockHeight(
  item: MaterializedItem<ChatRenderBlock>,
): number {
  const block = item.view

  switch (block.kind) {
    case 'code':
      return Math.max(148, Math.min(420, 48 + block.content.split('\n').length * 22))
    case 'diff':
      return Math.max(148, Math.min(420, 44 + block.content.split('\n').length * 20))
    case 'error':
      return Math.max(112, Math.min(260, 40 + block.content.split('\n').length * 18))
    case 'list':
      return Math.max(92, Math.min(240, 36 + block.content.split('\n').length * 18))
    case 'table':
      return 68 + block.table.rows.length * 32
    case 'tool':
      return 44
    default:
      return Math.max(72, Math.min(220, 38 + block.content.length * 0.18))
  }
}

function buildRenderBlocks(message: ChatMessageState): ChatRenderBlock[] {
  const blocks: ChatRenderBlock[] = []

  const addTextLikeBlocks = (
    kind: Extract<ChatRenderBlock['kind'], 'text' | 'code' | 'error' | 'diff' | 'list'>,
    chunks: string[],
  ) => {
    chunks.forEach((content, index) => {
      blocks.push({
        id: `${message.id}:${kind}:${index}`,
        messageId: message.id,
        role: message.role,
        kind,
        content,
        showStreamingCursor: message.isStreaming && index === chunks.length - 1,
      })
    })
  }

  switch (message.variant) {
    case 'code':
      addTextLikeBlocks('code', splitByLineGroups(message.content, CODE_CHUNK_LINES))
      break
    case 'error':
      addTextLikeBlocks('error', splitByLineGroups(message.content, ERROR_CHUNK_LINES))
      break
    case 'diff':
      addTextLikeBlocks('diff', splitByLineGroups(message.content, DIFF_CHUNK_LINES))
      break
    case 'list':
      addTextLikeBlocks('list', splitByLineGroups(message.content, LIST_CHUNK_LINES))
      break
    case 'table': {
      const table = parseTableContent(message.content)
      if (!table) {
        addTextLikeBlocks('text', splitParagraphText(message.content))
        break
      }

      for (let index = 0; index < table.rows.length; index += TABLE_CHUNK_ROWS) {
        blocks.push({
          id: `${message.id}:table:${Math.floor(index / TABLE_CHUNK_ROWS)}`,
          messageId: message.id,
          role: message.role,
          kind: 'table',
          table: {
            headers: [...table.headers],
            rows: table.rows.slice(index, index + TABLE_CHUNK_ROWS).map((row) => [...row]),
          },
        })
      }
      break
    }
    default:
      addTextLikeBlocks('text', splitParagraphText(message.content))
      break
  }

  message.toolCalls.forEach((toolCall, toolIndex) => {
    blocks.push({
      id: `${message.id}:tool:${toolIndex}`,
      messageId: message.id,
      role: message.role,
      kind: 'tool',
      toolIndex,
      toolCall: { ...toolCall },
    })
  })

  if (blocks.length === 0) {
    blocks.push({
      id: `${message.id}:text:0`,
      messageId: message.id,
      role: message.role,
      kind: 'text',
      content: '',
      showStreamingCursor: message.isStreaming,
    })
  }

  return blocks
}

function materializeMessagesToBlocks(
  messages: Array<{ view: ChatMessageState; sourceEventIds: string[]; firstSeq: number; lastSeq: number }>,
): MaterializedItem<ChatRenderBlock>[] {
  return messages.flatMap(({ view, sourceEventIds, firstSeq, lastSeq }) => (
    buildRenderBlocks(view).map((block) => ({
      key: block.id,
      cacheKey: createBlockCacheKey(block),
      view: block,
      sourceEventIds: [...sourceEventIds],
      seqRange: [firstSeq, lastSeq] as [number, number],
    }))
  ))
}

// ─── Materializer ────────────────────────────────────────────

const chatMaterializer: Materializer<ChatEvent, ChatRenderBlock> = {
  materialize(events: ChatEvent[]): MaterializedItem<ChatRenderBlock>[] {
    const messages = new Map<string, { view: ChatMessageState; sourceEventIds: string[]; firstSeq: number; lastSeq: number }>()
    for (const event of events) {
      const msgId = event.payload.messageId
      if (event.type === 'message_start') {
        messages.set(msgId, {
          view: createEmptyMessageState(
            msgId,
            (event.payload.role as ChatRole) ?? 'assistant',
            (event.payload.variant as ChatVariant) ?? 'text',
          ),
          sourceEventIds: [event.id], firstSeq: event.seq, lastSeq: event.seq,
        })
      } else if (event.type === 'message_delta') {
        const msg = messages.get(msgId)
        if (msg) { msg.view.content += event.payload.content ?? ''; msg.sourceEventIds.push(event.id); msg.lastSeq = event.seq }
      } else if (event.type === 'tool_use') {
        const msg = messages.get(msgId)
        if (msg) { msg.view.toolCalls.push({ name: event.payload.toolName ?? '', input: event.payload.toolInput ?? '', output: '' }); msg.sourceEventIds.push(event.id); msg.lastSeq = event.seq }
      } else if (event.type === 'tool_result') {
        const msg = messages.get(msgId)
        if (msg) { const lt = msg.view.toolCalls[msg.view.toolCalls.length - 1]; if (lt) lt.output = event.payload.toolOutput ?? ''; msg.sourceEventIds.push(event.id); msg.lastSeq = event.seq }
      } else if (event.type === 'message_end') {
        const msg = messages.get(msgId)
        if (msg) { msg.view.isStreaming = false; msg.sourceEventIds.push(event.id); msg.lastSeq = event.seq }
      }
    }
    return materializeMessagesToBlocks(Array.from(messages.values()))
  },

  appendEvents(existing: MaterializedItem<ChatRenderBlock>[], newEvents: ChatEvent[]): MaterializedItem<ChatRenderBlock>[] {
    const messages = new Map<string, {
      view: ChatMessageState
      sourceEventIds: string[]
      firstSeq: number
      lastSeq: number
    }>()

    for (const item of existing) {
      if (messages.has(item.view.messageId)) continue

      const matchingItems = existing.filter((candidate) => candidate.view.messageId === item.view.messageId)
      const firstItem = matchingItems[0]
      const lastItem = matchingItems[matchingItems.length - 1]
      const toolCalls: ChatToolCall[] = []

      for (const candidate of matchingItems) {
        if (candidate.view.kind === 'tool') {
          toolCalls[candidate.view.toolIndex] = { ...candidate.view.toolCall }
        }
      }

      let content = ''
      let variant: ChatVariant = 'text'
      let isStreaming = false

      for (const candidate of matchingItems) {
        const block = candidate.view
        if (block.kind === 'tool') continue

        if (block.kind === 'table') {
          const headers = JSON.stringify(block.table.headers)
          const rows = JSON.stringify(matchingItems
            .filter((entry) => entry.view.kind === 'table')
            .flatMap((entry) => entry.view.kind === 'table' ? entry.view.table.rows : []))
          content = `{"headers":${headers},"rows":${rows}}`
          variant = 'table'
          continue
        }

        if (block.kind === 'code' || block.kind === 'error' || block.kind === 'diff' || block.kind === 'list') {
          variant = block.kind
        }

        if (content.length > 0 && block.content.length > 0) {
          content += block.kind === 'text' ? '\n\n' : '\n'
        }
        content += block.content
        isStreaming = isStreaming || block.showStreamingCursor
      }

      messages.set(item.view.messageId, {
        view: {
          id: item.view.messageId,
          role: item.view.role,
          content,
          isStreaming,
          variant,
          toolCalls: toolCalls.filter(Boolean),
        },
        sourceEventIds: [...firstItem.sourceEventIds],
        firstSeq: firstItem.seqRange[0],
        lastSeq: lastItem.seqRange[1],
      })
    }

    for (const event of newEvents) {
      const msgId = event.payload.messageId
      if (event.type === 'message_start') {
        messages.set(msgId, {
          view: createEmptyMessageState(
            msgId,
            (event.payload.role as ChatRole) ?? 'assistant',
            (event.payload.variant as ChatVariant) ?? 'text',
          ),
          sourceEventIds: [event.id],
          firstSeq: event.seq,
          lastSeq: event.seq,
        })
        continue
      }

      const message = messages.get(msgId)
      if (!message) continue

      message.sourceEventIds.push(event.id)
      message.lastSeq = event.seq

      if (event.type === 'message_delta') {
        message.view.content += event.payload.content ?? ''
      } else if (event.type === 'tool_use') {
        message.view.toolCalls.push({
          name: event.payload.toolName ?? '',
          input: event.payload.toolInput ?? '',
          output: '',
        })
      } else if (event.type === 'tool_result') {
        const lastToolCall = message.view.toolCalls[message.view.toolCalls.length - 1]
        if (lastToolCall) {
          lastToolCall.output = event.payload.toolOutput ?? ''
        }
      } else if (event.type === 'message_end') {
        message.view.isStreaming = false
      }
    }

    return materializeMessagesToBlocks(Array.from(messages.values()))
  },
}

// ─── Accordion ───────────────────────────────────────────────

function ToolCallAccordion({
  tool,
  open,
  onToggle,
}: {
  tool: ChatToolCall
  open: boolean
  onToggle: () => void
}) {
  return (
    <div style={{ marginTop: 4, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 10px',
          background: 'rgba(255,255,255,0.03)', border: 'none', color: '#8b8b8b', fontSize: 12, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease-out', fontSize: 10 }}>&#9654;</span>
        <span>{tool.name}</span>
      </button>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.2s ease-out' }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', fontSize: 12 }}>
            {tool.input && <pre style={{ margin: 0, color: '#6b7280', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 11, lineHeight: 1.4 }}>{tool.input}</pre>}
            {tool.output && (
              <pre style={{ margin: '6px 0 0', padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 3, color: '#9ca3af', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 11, lineHeight: 1.4, maxHeight: 300, overflow: 'auto' }}>
                {tool.output}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Message rendering ───────────────────────────────────────

function buildChatBlockRenderContext(
  block: ChatRenderBlock,
  index: number,
  materializedItems: MaterializedItem<ChatRenderBlock>[],
): ChatBlockRenderContext {
  const previousBlock = materializedItems[index - 1]?.view
  const nextBlock = materializedItems[index + 1]?.view

  return {
    isFirstInMessage: !previousBlock || previousBlock.messageId !== block.messageId,
    isLastInMessage: !nextBlock || nextBlock.messageId !== block.messageId,
  }
}

function ChatBlock({
  block,
  context,
  accordionState,
  onToggleAccordion,
}: {
  block: ChatRenderBlock
  context: ChatBlockRenderContext
  accordionState: AccordionState
  onToggleAccordion: (accordionKey: string) => void
}) {
  const isUser = block.role === 'user'
  const verticalPadding = context.isFirstInMessage
    ? { paddingTop: 12, paddingBottom: context.isLastInMessage ? 12 : 4 }
    : { paddingTop: 4, paddingBottom: context.isLastInMessage ? 12 : 4 }

  return (
    <div
      style={{
        paddingLeft: 20,
        paddingRight: 20,
        borderBottom: context.isLastInMessage ? '1px solid rgba(255,255,255,0.04)' : 'none',
        ...verticalPadding,
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {context.isFirstInMessage && (
          <div style={{ fontSize: 11, color: isUser ? '#8b8b8b' : '#6b7280', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
            {block.role}
            {'showStreamingCursor' in block && block.showStreamingCursor && (
              <span style={{ color: '#facc15', marginLeft: 8, fontSize: 10 }}>streaming</span>
            )}
          </div>
        )}
        <MessageContent
          block={block}
          accordionState={accordionState}
          onToggleAccordion={onToggleAccordion}
        />
      </div>
    </div>
  )
}

function MessageContent({
  block,
  accordionState,
  onToggleAccordion,
}: {
  block: ChatRenderBlock
  accordionState: AccordionState
  onToggleAccordion: (accordionKey: string) => void
}) {
  const base = { fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const }

  switch (block.kind) {
    case 'code':
      return <pre style={{ ...base, margin: 0, padding: '12px 16px', background: 'rgba(0,0,0,0.4)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', color: '#d4d4d8', fontSize: 13, lineHeight: 1.5, overflow: 'auto' }}>{block.content}</pre>
    case 'error':
      return <div style={{ ...base, padding: '12px 16px', background: 'rgba(239,68,68,0.06)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.15)', color: '#fca5a5', fontSize: 13, lineHeight: 1.5 }}>{block.content}</div>
    case 'diff':
      return (
        <pre style={{ ...base, margin: 0, padding: '12px 16px', background: 'rgba(0,0,0,0.4)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', fontSize: 13, lineHeight: 1.5 }}>
          {block.content.split('\n').map((line, i) => (
            <span key={i} style={{ color: line.startsWith('+') ? '#4ade80' : line.startsWith('-') ? '#f87171' : line.startsWith('@@') ? '#60a5fa' : '#9ca3af', display: 'block' }}>{line}</span>
          ))}
        </pre>
      )
    case 'table':
      return (
        <div style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'rgba(255,255,255,0.04)' }}>{block.table.headers.map((h, i) => <th key={i} style={{ padding: '8px 12px', textAlign: 'left', color: '#9ca3af', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>)}</tr></thead>
            <tbody>{block.table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} style={{ padding: '6px 12px', color: '#d4d4d8', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )
    case 'list':
      return <div style={{ ...base, color: '#d4d4d8', paddingLeft: 4 }}>{block.content}</div>
    case 'tool': {
      const accordionKey = getAccordionKey(block.messageId, block.toolIndex)
      return (
        <ToolCallAccordion
          tool={block.toolCall}
          open={accordionState[accordionKey] ?? false}
          onToggle={() => onToggleAccordion(accordionKey)}
        />
      )
    }
    default:
      return (
        <div style={{ ...base, color: block.role === 'user' ? '#d4d4d4' : '#e5e5e5' }}>
          {block.content}
          {block.showStreamingCursor && <span style={{ display: 'inline-block', width: 2, height: 16, background: '#e5e5e5', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite' }} />}
        </div>
      )
  }
}

// ─── Tab types ────────────────────────────────────────────────

interface TabData {
  id: string; name: string; messageCount: number; events: ChatEvent[]
  dataSource: LazyDataSource<ChatEvent>; interactive?: boolean; mutableSource?: MutableChatDataSource
}
type AccordionState = Record<string, boolean>

interface TabPersistedState {
  snapshot: ViewportSnapshot | null
  measurementCache: Record<string, MeasuredSize> | null
  materializedItems: MaterializedItem<ChatRenderBlock>[] | null
  accordionState: AccordionState
}

function getAccordionKey(messageId: string, toolIndex: number): string {
  return `${messageId}:${toolIndex}`
}

function cloneMaterializedItems(
  items: MaterializedItem<ChatRenderBlock>[],
): MaterializedItem<ChatRenderBlock>[] {
  return items.slice()
}

function makeAccordionAwareTransform(accordionState: AccordionState) {
  return (item: MaterializedItem<ChatRenderBlock>): MaterializedItem<ChatRenderBlock> => {
    if (item.view.kind !== 'tool') return item
    const key = getAccordionKey(item.view.messageId, item.view.toolIndex)
    const isOpen = accordionState[key] ?? false
    // Strip any previously-appended accordion suffix to stay idempotent.
    // Saved/restored items may already carry `:c`/`:o` from a prior session.
    const baseCacheKey = item.cacheKey.replace(/(?::[oc])+$/, '')
    return { ...item, cacheKey: `${baseCacheKey}:${isOpen ? 'o' : 'c'}` }
  }
}

function makeAccordionAwareEstimate(accordionState: AccordionState) {
  return (item: MaterializedItem<ChatRenderBlock>): number => {
    const block = item.view
    if (block.kind !== 'tool') return estimateChatBlockHeight(item)
    const key = `${block.messageId}:${block.toolIndex}`
    const isOpen = accordionState[key] ?? false
    if (!isOpen) return 44
    const inputLines = block.toolCall.input.length > 0 ? block.toolCall.input.split('\n').length : 0
    const outputLines = block.toolCall.output.length > 0 ? block.toolCall.output.split('\n').length : 0
    return 52 + (inputLines > 0 ? 24 + inputLines * 16 : 0) + (outputLines > 0 ? 30 + Math.min(300, outputLines * 16) : 0)
  }
}

// ─── Interactive chat tab ────────────────────────────────────

function InteractiveChatTab({ tab, persisted, useMeasurementCacheRestore, onCapture }: {
  tab: TabData; persisted: TabPersistedState; useMeasurementCacheRestore: boolean
  onCapture: (
    snapshot: ViewportSnapshot,
    cache: Record<string, MeasuredSize>,
    materializedItems: MaterializedItem<ChatRenderBlock>[],
    accordionState: AccordionState,
  ) => void
}) {
  const captureRef = useRef(onCapture); captureRef.current = onCapture
  const source = tab.mutableSource!
  const [input, setInput] = useState('')
  const [isResponding, setIsResponding] = useState(false)
  const [autoStream, setAutoStream] = useState(false)
  const [accordionState, setAccordionState] = useState<AccordionState>(persisted.accordionState)
  const seqRef = useRef(source.events.length)
  // Derive initial msgCount from existing events to avoid creating
  // duplicate message IDs after tab-switch remount. Without this,
  // msgCount resets to 0 and produces duplicate keys like "int-u-0"
  // that overwrite the original messages in the materializer.
  const [initMsgCount] = useState(() => {
    let max = -1
    for (const event of source.events) {
      const match = event.payload.messageId.match(/^int-[ua]-(\d+)/)
      if (match) max = Math.max(max, parseInt(match[1], 10))
    }
    return max + 1
  })
  const msgCountRef = useRef(initMsgCount)

  const transformItem = useCallback(makeAccordionAwareTransform(accordionState), [accordionState])
  const estimateHeight = useCallback(makeAccordionAwareEstimate(accordionState), [accordionState])

  const virtualizer = useVirtualizer<ChatEvent, ChatRenderBlock>({
    dataSource: source, materializer: chatMaterializer,
    estimateItemHeight: estimateHeight,
    transformMaterializedItem: transformItem,
    overscan: 8, overscanPx: 1600, retainOverscanPx: 2400,
    bottomThreshold: 20, debug: true, materializationWindow: 500,
    initialSnapshot: persisted.snapshot ?? undefined,
    initialMaterializedItems: persisted.materializedItems ?? undefined,
    initialMeasurementCache: useMeasurementCacheRestore && persisted.measurementCache ? persisted.measurementCache : undefined,
  })
  const virtualizerRef = useRef(virtualizer); virtualizerRef.current = virtualizer

  const handleToggleAccordion = useCallback((accordionKey: string) => {
    setAccordionState((current) => ({
      ...current,
      [accordionKey]: !current[accordionKey],
    }))
  }, [])

  const sendMessage = useCallback((text: string) => {
    if (isResponding) return
    const userMsgId = `int-u-${msgCountRef.current++}`
    const s = seqRef.current; const now = Date.now()
    source.push(
      { id: `e-${s}`, seq: s, timestamp: now, type: 'message_start', payload: { messageId: userMsgId, role: 'user', variant: 'text' } },
      { id: `e-${s+1}`, seq: s+1, timestamp: now+10, type: 'message_delta', payload: { messageId: userMsgId, content: text } },
      { id: `e-${s+2}`, seq: s+2, timestamp: now+20, type: 'message_end', payload: { messageId: userMsgId } },
    )
    seqRef.current = s + 3; setIsResponding(true)

    const aMsgId = `int-a-${msgCountRef.current++}`
    const aSeq = seqRef.current
    setTimeout(() => {
      source.push({ id: `e-${aSeq}`, seq: aSeq, timestamp: Date.now(), type: 'message_start', payload: { messageId: aMsgId, role: 'assistant', variant: 'text' } })
      seqRef.current = aSeq + 1
      let wordIdx = 0
      const si = setInterval(() => {
        const chunk = 2 + Math.floor(Math.random() * 3)
        const words = STREAMING_WORDS.slice(wordIdx, wordIdx + chunk)
        if (words.length === 0 || wordIdx >= STREAMING_WORDS.length) {
          clearInterval(si)
          const es = seqRef.current
          if (Math.random() < 0.4) {
            source.push(
              { id: `e-${es}`, seq: es, timestamp: Date.now(), type: 'tool_use', payload: { messageId: aMsgId, toolName: 'run_command', toolInput: '{"cmd": "npm test"}' } },
              { id: `e-${es+1}`, seq: es+1, timestamp: Date.now()+50, type: 'tool_result', payload: { messageId: aMsgId, toolName: 'run_command', toolOutput: TOOL_OUTPUTS[Math.floor(Math.random() * TOOL_OUTPUTS.length)] } },
            )
            seqRef.current = es + 2
          }
          const fs = seqRef.current
          source.push({ id: `e-${fs}`, seq: fs, timestamp: Date.now(), type: 'message_end', payload: { messageId: aMsgId } })
          seqRef.current = fs + 1; setIsResponding(false)
          return
        }
        const cs = seqRef.current
        source.push({ id: `e-${cs}`, seq: cs, timestamp: Date.now(), type: 'message_delta', payload: { messageId: aMsgId, content: words.join(' ') + ' ' } })
        seqRef.current = cs + 1; wordIdx += chunk
      }, 40 + Math.random() * 30)
    }, 400)
  }, [isResponding, source])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault(); if (!input.trim()) return; sendMessage(input.trim()); setInput('')
  }, [input, sendMessage])

  useEffect(() => {
    if (!autoStream) return
    const iv = setInterval(() => {
      if (!isResponding) {
        sendMessage(['Tell me more.', 'Can you show an example?', 'What are the trade-offs?', 'How does this handle errors?', 'Is there a simpler way?'][Math.floor(Math.random() * 5)])
      }
    }, 5000)
    return () => clearInterval(iv)
  }, [autoStream, isResponding, sendMessage])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'hidden' }} ref={(el) => {
        if (!el) {
          const v = virtualizerRef.current
          if (v.virtualItems.length > 0) {
            captureRef.current(
              v.captureSnapshot(),
              v.exportMeasurementCache(),
              cloneMaterializedItems(v.rawMaterializedItems),
              accordionState,
            )
          }
        }
      }}>
        <VirtualizedList
          virtualizer={virtualizer}
          renderItem={(item: MaterializedItem<ChatRenderBlock>, position) => (
            <ChatBlock
              block={item.view}
              context={buildChatBlockRenderContext(
                item.view,
                position.index,
                virtualizer.materializedItems,
              )}
              accordionState={accordionState}
              onToggleAccordion={handleToggleAccordion}
            />
          )}
        />
      </div>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: '#18181b',
          flexShrink: 0,
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <input value={input} onChange={e => setInput(e.target.value)} placeholder={isResponding ? 'Waiting for response...' : 'Type a message...'}
          disabled={isResponding} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '8px 12px', color: '#e5e5e5', fontSize: 14, outline: 'none' }} />
        <button type="submit" disabled={isResponding || !input.trim()} style={{ padding: '8px 16px', background: isResponding ? '#3f3f46' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, color: isResponding ? '#6b7280' : '#e5e5e5', fontSize: 13, cursor: isResponding ? 'default' : 'pointer' }}>Send</button>
        <button type="button" onClick={() => setAutoStream(v => !v)}
          style={{ padding: '8px 12px', background: autoStream ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.04)', border: autoStream ? '1px solid rgba(250,204,21,0.3)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: autoStream ? '#facc15' : '#6b7280', fontSize: 11, cursor: 'pointer' }}>
          {autoStream ? 'Auto ON' : 'Auto'}
        </button>
      </form>
    </div>
  )
}

// ─── Static chat tab ─────────────────────────────────────────

function StaticChatTab({ tab, persisted, useMeasurementCacheRestore, onCapture }: {
  tab: TabData; persisted: TabPersistedState; useMeasurementCacheRestore: boolean
  onCapture: (
    snapshot: ViewportSnapshot,
    cache: Record<string, MeasuredSize>,
    materializedItems: MaterializedItem<ChatRenderBlock>[],
    accordionState: AccordionState,
  ) => void
}) {
  const captureRef = useRef(onCapture); captureRef.current = onCapture
  const [accordionState, setAccordionState] = useState<AccordionState>(persisted.accordionState)

  const transformItem = useCallback(makeAccordionAwareTransform(accordionState), [accordionState])
  const estimateHeight = useCallback(makeAccordionAwareEstimate(accordionState), [accordionState])

  const virtualizer = useVirtualizer<ChatEvent, ChatRenderBlock>({
    dataSource: tab.dataSource, materializer: chatMaterializer,
    estimateItemHeight: estimateHeight,
    transformMaterializedItem: transformItem,
    overscan: 8, overscanPx: 1600, retainOverscanPx: 2400,
    bottomThreshold: 20, debug: true, materializationWindow: 500,
    initialSnapshot: persisted.snapshot ?? undefined,
    initialMaterializedItems: persisted.materializedItems ?? undefined,
    initialMeasurementCache: useMeasurementCacheRestore && persisted.measurementCache ? persisted.measurementCache : undefined,
  })
  const virtualizerRef = useRef(virtualizer); virtualizerRef.current = virtualizer

  const handleToggleAccordion = useCallback((accordionKey: string) => {
    setAccordionState((current) => ({
      ...current,
      [accordionKey]: !current[accordionKey],
    }))
  }, [])

  return (
    <div style={{ height: '100%' }} ref={(el) => {
      if (!el) {
        const v = virtualizerRef.current
        if (v.virtualItems.length > 0) {
          captureRef.current(
            v.captureSnapshot(),
            v.exportMeasurementCache(),
            cloneMaterializedItems(v.rawMaterializedItems),
            accordionState,
          )
        }
      }
    }}>
      <VirtualizedList
        virtualizer={virtualizer}
        renderItem={(item: MaterializedItem<ChatRenderBlock>, position) => (
          <ChatBlock
            block={item.view}
            context={buildChatBlockRenderContext(
              item.view,
              position.index,
              virtualizer.materializedItems,
            )}
            accordionState={accordionState}
            onToggleAccordion={handleToggleAccordion}
          />
        )}
      />
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────

const TAB_CONFIGS = [
  { id: 'tab-1', name: 'Session A', messageCount: 10000, seed: 42 },
  { id: 'tab-2', name: 'Session B', messageCount: 5000, seed: 137 },
  { id: 'tab-3', name: 'Session C', messageCount: 2000, seed: 999 },
  { id: 'tab-interactive', name: 'Interactive', messageCount: 50, seed: 777, interactive: true },
]

export default function Home() {
  const tabs = useMemo(() => TAB_CONFIGS.map(cfg => {
    if (cfg.interactive) {
      const source = new MutableChatDataSource()
      source.events.push(...generateEvents(cfg.messageCount, cfg.seed))
      return { id: cfg.id, name: cfg.name, messageCount: cfg.messageCount, events: source.events, dataSource: source as LazyDataSource<ChatEvent>, interactive: true, mutableSource: source }
    }
    const events = generateEvents(cfg.messageCount, cfg.seed)
    return { id: cfg.id, name: cfg.name, messageCount: cfg.messageCount, events, dataSource: createStaticDataSource(events) }
  }), [])

  const [activeTabId, setActiveTabId] = useState(tabs[0].id)
  const [useCacheRestore, setUseCacheRestore] = useState(true)
  const persistedRef = useRef<Record<string, TabPersistedState>>({})
  for (const tab of tabs) {
    if (!persistedRef.current[tab.id]) {
      persistedRef.current[tab.id] = {
        snapshot: null,
        measurementCache: null,
        materializedItems: null,
        accordionState: {},
      }
    }
  }

  const handleCapture = useCallback((tabId: string) => (
    snapshot: ViewportSnapshot,
    cache: Record<string, MeasuredSize>,
    materializedItems: MaterializedItem<ChatRenderBlock>[],
    accordionState: AccordionState,
  ) => {
    persistedRef.current[tabId] = {
      snapshot,
      measurementCache: cache,
      materializedItems,
      accordionState,
    }
  }, [])

  const activeTab = tabs.find(t => t.id === activeTabId)!

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#18181b', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`@keyframes blink { 50% { opacity: 0 } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, padding: '0 12px', height: 40 }}>
        <div style={{ display: 'flex', flex: 1 }}>
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId
            const hasSnap = !!persistedRef.current[tab.id]?.snapshot
            return (
              <button key={tab.id} onClick={() => setActiveTabId(tab.id)}
                style={{ background: 'none', border: 'none', borderBottom: isActive ? '2px solid #e5e5e5' : '2px solid transparent', color: isActive ? '#e5e5e5' : '#6b7280', fontSize: 13, padding: '8px 16px', cursor: 'pointer', transition: 'color 0.1s' }}>
                {tab.name}
                {!tab.interactive && <span style={{ fontSize: 11, color: '#4b5563', marginLeft: 6 }}>{(tab.messageCount / 1000).toFixed(0)}k</span>}
                {hasSnap && !isActive && <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: 2, background: '#4ade80', marginLeft: 6, verticalAlign: 'middle' }} />}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#6b7280' }}>
          <span>cache</span>
          <button onClick={() => setUseCacheRestore(v => !v)}
            style={{ width: 32, height: 18, borderRadius: 9, border: 'none', background: useCacheRestore ? '#4ade80' : '#3f3f46', cursor: 'pointer', position: 'relative', transition: 'background 0.15s', padding: 0 }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: '#fff', position: 'absolute', top: 2, left: useCacheRestore ? 16 : 2, transition: 'left 0.15s' }} />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab.interactive
          ? <InteractiveChatTab key={activeTabId} tab={activeTab} persisted={persistedRef.current[activeTab.id]} useMeasurementCacheRestore={useCacheRestore} onCapture={handleCapture(activeTabId)} />
          : <StaticChatTab key={activeTabId} tab={activeTab} persisted={persistedRef.current[activeTab.id]} useMeasurementCacheRestore={useCacheRestore} onCapture={handleCapture(activeTabId)} />}
      </div>
    </div>
  )
}
