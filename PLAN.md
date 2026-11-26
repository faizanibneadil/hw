# hw: implementation plan

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
| AI SDK v6 | `ai` latest is v7; `@browser-ai/transformers-js@3` needs v7. | Keep v6 as specified: `ai@6.0.338`, `@ai-sdk/react@3.0.341`, `@browser-ai/transformers-js@2.2.4` (v2 = AI SDK v6 line). |
| Tutorial uses a custom `ChatTransport` | Spec asks for `DirectChatTransport` | Use `DirectChatTransport({ agent: ToolLoopAgent })`; the agent's `instructions` carry system prompt + locked code, `prepareStep` trims history. |
| Provider `availability()` | With a worker it only reports `available` after loading in this session. | Detect cache with Transformers.js `ModelRegistry.is_cached()` (documented v4 API) in a small worker. |
| `@tanstack/markdown` highlighting | Needs a sync highlighter callback; `@tanstack/highlight` adapter is documented. | Use `@tanstack/highlight` + `createTanStackMarkdownHighlighter`. |

## Packages (pinned)
next 16.4.6, react 19.3, tailwindcss 4.3.3, shadcn (CLI 4.x, components copied in),
next-themes 0.4.6, react-resizable-panels 4.24.3, ai 6.0.338, @ai-sdk/react 3.0.341,
@browser-ai/transformers-js 2.2.4, @huggingface/transformers 4.3.2,
@tanstack/db + @tanstack/react-db 1.0.0-rc.1.5, @tanstack/markdown 1.2.1,
@tanstack/highlight 1.2.12, @tiptap/* 3.35.0 (react, pm, starter-kit,
extension-code-block-lowlight, markdown), lowlight 3.3.0.

## Models
| id | dtype | device | size | notes |
|---|---|---|---|---|
| `onnx-community/Qwen2.5-Coder-0.5B-Instruct` | q4 | webgpu, else wasm | ~0.8 GB | auto-loaded default |
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
- ONNX Runtime `.wasm` (~26 MB) exceeds Cloudflare's 25 MiB file limit; Transformers.js already
  loads it from jsDelivr, so `scripts/postbuild.mjs` removes the unused bundled copy and checks sizes.
- Touch-only devices: Enter inserts a new line (no Shift+Enter on virtual keyboards); Send button sends.
- First-message code blocks are sent once (in the locked-code system message) and referenced as
  `snippet-N` in the history.
- A test-only mock model (`?e2e=mock`) makes the chat flow testable without downloading models.
