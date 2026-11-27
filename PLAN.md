# hw: implementation plan

## Workers AI migration (cloud by default, Offline mode opt-in)

### Docs read
- Workers AI + AI SDK: `developers.cloudflare.com/workers-ai/configuration/ai-sdk/` and
  `developers.cloudflare.com/agents/models/ai-sdk/` (`createAI`, `CloudflareAIError`, options)
- Workers AI model pages (`glm-4.7-flash`, `gemma-4-26b-a4b-it`, `nemotron-3-120b-a12b`, `qwen3.8-27b`),
  pricing, limits, errors, and the 2026-11-05 "Planned model deprecations" changelog
- AI SDK 6 to 7 migration guide (shipped in `node_modules/ai/docs/08-migration-guides/`; `ai-sdk.dev`
  is not reachable from the build environment)
- Workers static assets: binding (`run_worker_first`, `not_found_handling`), Worker script routing,
  migrate from Pages, billing and limitations; Workers platform limits
- Workers Rate Limiting binding; Turnstile server-side validation and testing keys
- Workers Vitest integration ("Write your first test")

### Findings that differ from the spec
| Spec | Docs / reality | Decision |
|---|---|---|
| Cloud model `@cf/nvidia/nemotron-3-120b-a12b` | Deprecated on **2026-11-20**: requests now fail with HTTP 410 / error 5028. The changelog recommends `@cf/google/gemma-4-26b-a4b-it` or `@cf/qwen/qwen3.8-27b` for "smaller model needs". | Replaced with **`@cf/qwen/qwen3.8-27b`** (262,144-token context, Workers Free plan; Gemma is already in the list). |
| Model ids / context windows | `@cf/zai-org/glm-4.7-flash` 131,072 tokens; `@cf/google/gemma-4-26b-a4b-it` 256,000 tokens; both on the Free plan (not in the paid-only list). | Used as specified. |
| Worker tests with "Vitest Cloudflare Workers pool" | `@cloudflare/vitest-pool-workers` is deprecated and renamed to **`@cloudflare/vitest-plugin`** (`cloudflareTest()` Vite plugin). | `@cloudflare/vitest-plugin@1.10.0` + `vitest@5.1.2`. The AI binding is always remote, so tests set `remoteBindings: false` and inject a mock model (`ai/test` `MockLanguageModelV4`). |
| `streamText({ system: [...] })` | AI SDK 7 renames `system` to **`instructions`** (`system` is a deprecated fallback) and rejects system messages inside `messages` by default. | `instructions: [{ role: "system", content: SYSTEM_PROMPT }, { role: "system", content: codeMessage }]` in the Worker and in the offline agent's `prepareStep`. |
| `result.toUIMessageStreamResponse()` | Deprecated in AI SDK 7 in favor of the stateless helpers. | `toUIMessageStream({ stream: result.stream })` + `createUIMessageStreamResponse()`. |
| Typed error status for quota errors | `streamText` is lazy: a Workers AI failure (e.g. `3036` daily Neurons used up, HTTP 429) only shows up inside the stream, after a 200 response would already be sent. | The Worker waits for the first content chunk; an error before any output becomes a typed JSON error with the right status. A mid-stream error is sent as an error chunk whose text is the same JSON. `maxRetries: 0` so a quota error is not retried. |
| `createAI` "only" calls Workers AI | Requests go through AI Gateway; the gateway id defaults to `default`, which is created on first use. | Kept the default. |
| Other AI SDK 7 renames | `stepCountIs` -> `isStepCount`; `LanguageModelV3` -> `LanguageModelV4` (`@ai-sdk/provider@4`); `fullStream` -> `stream`. | Updated. |
| Static asset limit "per file" | Workers static assets: **25 MiB per file** (Free and Paid) and **20,000 files per version on Workers Free** (100,000 on Paid). | `scripts/postbuild.mjs` checks both. |
| SPA / not-found handling "matching current routing" | Pages served `404.html` for unknown paths because `out/` has a top-level `404.html`; the app routes by URL hash. | `not_found_handling: "404-page"`. |
| Rate limit "20 requests per minute per IP" | The Rate Limiting binding is approximate and counted per Cloudflare location; `period` must be 10 or 60. | `simple: { limit: 20, period: 60 }`, key = `CF-Connecting-IP`. |
| Turnstile token reuse | Tokens are single use (`timeout-or-duplicate` on replay) and valid for 300 s. | After one successful Siteverify the Worker sets a signed `HttpOnly` cookie (30 min, HMAC keyed from `TURNSTILE_SECRET_KEY`) and reports its expiry in `x-hw-verified-until`; while valid, the client sends no token. |
| `wrangler dev` with Workers AI | The AI binding always uses remote resources (needs `wrangler login`) and counts against the daily Neurons. | Documented; binding marked `"remote": true`. |
| Reasoning models | All three cloud models reason by default (Qwen 3.8 defaults to `xhigh`), which spends output tokens before the answer. | `reasoningEffort: "low"` per model; reasoning is not sent to the browser. |
| `zod` | Peer dependency of `ai@7` (was only installed transitively). | Added explicitly. |

### Packages (pinned)
ai 7.0.183, @ai-sdk/react 4.0.188, @ai-sdk/provider 4.0.39, @browser-ai/transformers-js 3.0.5
(AI SDK v7 line), agents 0.34.1 (`agents/models/ai-sdk`), zod 4.6.7, wrangler 4.169.0,
@cloudflare/vitest-plugin 1.10.0, vitest 5.1.2.

### Architecture
- `lib/ai/models.ts`: one list with `kind: "cloud" | "local"`; the Worker allowlists the cloud ids.
- `lib/ai/api.ts`: request/response contract, size limits, error codes (shared).
- `lib/ai/context.ts`, `system-prompt.ts`: formatting, trimming (`prepareHistory`), shared, relative imports only.
- `lib/ai/chat-transport.ts`: one transport per chat that delegates per request to
  `cloud-transport.ts` (`DefaultChatTransport` -> `/api/chat`) or `local-transport.ts`
  (`DirectChatTransport` + `ToolLoopAgent`), so switching modes/models keeps the `useChat` chat.
- `lib/ai/model-manager.ts`: unchanged flow, but only started when Offline mode is on; imports
  `@browser-ai/transformers-js` dynamically.
- `lib/ai/inference-settings.ts`: mode + cloud model in localStorage (try/catch).
- `lib/ai/turnstile.ts`: explicit-render widget (`interaction-only`), single-use tokens.
- `worker/`: `index.ts` (routing), `chat.ts` (validate -> rate limit -> Turnstile -> `streamText`),
  `turnstile.ts` (Siteverify + cookie), `errors.ts` (typed errors), `test/` (Vitest).

## Original plan (in-browser only)

## Docs read (and where)
`huggingface.co` and `tanstack.com` are blocked from the build environment, so the
same docs were read from their sources:
- Transformers.js + AI SDK guide and Next.js tutorial: `huggingface/transformers.js`
  repo, `packages/transformers/docs/source/{integrations/vercel-ai-sdk,tutorials/next-ai-sdk}.md`
- TanStack DB IndexedDB collection: `@tanstack/db` type definitions + bundled skills
  (`skills/db-core/*`, `skills/meta-framework`)
- TanStack Markdown: `tanstack/markdown` docs (quick-start, react, ai-streaming,
  syntax-highlighting, syntax-profile)
- Next.js 16: `node_modules/next/dist/docs` (static exports, turbopack config)

## Findings that differ from the spec
| Spec | Reality | Decision |
|---|---|---|
| `@tanstack/indexeddb-db-collection` | Not on npm. The official IndexedDB collection was moved into core `@tanstack/db` (`createIndexedDB` + `indexedDBCollectionOptions`). | Use the core API (same official TanStack collection). |
| AI SDK v6 | `ai` latest is v7; `@browser-ai/transformers-js@3` needs v7. | Kept v6 at first; upgraded to v7 in the Workers AI migration (above). |
| Tutorial uses a custom `ChatTransport` | Spec asks for `DirectChatTransport` | Use `DirectChatTransport({ agent: ToolLoopAgent })`; the agent's `instructions` carry system prompt + locked code, `prepareStep` trims history. |
| Provider `availability()` | With a worker it only reports `available` after loading in this session. | Detect cache with Transformers.js `ModelRegistry.is_cached()` (documented v4 API) in a small worker. |
| `@tanstack/markdown` highlighting | Needs a sync highlighter callback; `@tanstack/highlight` adapter is documented. | Use `@tanstack/highlight` + `createTanStackMarkdownHighlighter`. |

## Packages (pinned, before the migration)
next 16.4.6, react 19.3, tailwindcss 4.3.3, shadcn (CLI 4.x, components copied in),
next-themes 0.4.6, react-resizable-panels 4.24.3, ai 6.0.338, @ai-sdk/react 3.0.341,
@browser-ai/transformers-js 2.2.4, @huggingface/transformers 4.3.2,
@tanstack/db + @tanstack/react-db 1.0.0-rc.1.5, @tanstack/markdown 1.2.1,
@tanstack/highlight 1.2.12, @tiptap/* 3.35.0 (react, pm, starter-kit,
extension-code-block-lowlight, markdown), lowlight 3.3.0.

## Models
| id | dtype | device | size | notes |
|---|---|---|---|---|
| `onnx-community/Qwen2.5-Coder-0.5B-Instruct` | q4 | webgpu, else wasm | ~0.8 GB | loaded when Offline mode is turned on |
| `onnx-community/Qwen2.5-Coder-1.5B-Instruct` | q4f16 | webgpu only | ~1.3 GB | disabled without WebGPU |

## Folder structure
```
app/            layout.tsx, page.tsx (client shell), globals.css
components/ui/  shadcn primitives (button, dropdown, dialog, sheet, tooltip, resizable, ...)
components/     app-shell, sidebar/*, chat/*, prompt/*, model/*, markdown/*, theme-*
lib/db/         database.ts (createIndexedDB), collections.ts, types.ts, actions.ts
lib/ai/         models.ts, model-manager.ts, system-prompt.ts, build-context.ts, agent.ts
lib/files/      validate.ts (types/limits), languages.ts
lib/editor/     markdown extraction (code blocks from first message)
workers/        llm.worker.ts (TransformersJSWorkerHandler), cache.worker.ts (is_cached)
```

## Data flow
1. `DbProvider` awaits `createIndexedDB({ name: "hw", stores: [chats, messages, files] })`,
   creates the three collections, exposes them via context. UI reads via `useLiveQuery`.
2. `ModelManager` (singleton, main thread) owns one `transformersJS(id, { worker })` per
   active model, tracks status (`checking | not-downloaded | downloading(p) | ready | error`)
   and exposes it with `useSyncExternalStore`. On load it checks the cache and starts
   loading the smallest model.
3. `ChatView` for a chat id: loads messages from TanStack DB, passes them as initial
   `messages` to `useChat({ id, transport })`. The transport is
   `new DirectChatTransport({ agent })` where `agent = new ToolLoopAgent({ model,
   instructions: SYSTEM_PROMPT + locked student code (numbered lines), prepareStep: trim })`.
4. Send: user message inserted into `messages` collection immediately; first message
   also inserts files and stores locked code. `useChat.onFinish` writes the assistant
   message with status `done | stopped | error`.
5. Assistant text renders with `@tanstack/markdown` + streaming extension.

## Decisions made during the build
- `cacheComponents` / `partialPrefetching` removed from `next.config.ts`: Next.js refuses PPR with
  `output: "export"` (static export is required).
- shadcn/ui components were added by hand (same source as the registry): `ui.shadcn.com` is
  unreachable from the build environment.
- ONNX Runtime `.wasm` (~26 MB) exceeds Cloudflare's 25 MiB file limit (Pages, and Workers static assets); Transformers.js already
  loads it from jsDelivr, so `scripts/postbuild.mjs` removes the unused bundled copy and checks sizes.
- Touch-only devices: Enter inserts a new line (no Shift+Enter on virtual keyboards); Send button sends.
- First-message code blocks are sent once (in the locked-code system message) and referenced as
  `snippet-N` in the history.
- A test-only mock model (`?e2e=mock`) makes the chat flow testable without downloading models.
