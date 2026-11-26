# hw: in-browser AI homework checker

A static web app for teachers to check and mark small student coding assignments. Attach the
student's files (or paste the code into a code block), write what to check, and a small code model
running **entirely in your browser** returns a marked result table. Follow-up messages correct or
refine the result.

No backend, no API routes, no accounts: models run with Transformers.js in a Web Worker and all
chats, messages and files are stored in IndexedDB in your browser.

## Requirements

- Node.js 20+ and pnpm 10 (`corepack enable`)
- A browser with WebGPU for the best speed (Chrome/Edge 113+). Without WebGPU the small model runs
  on WASM/CPU and larger models are disabled.

## Local development

```bash
pnpm install
```

```bash
pnpm dev
```

Open http://localhost:3000. On first load the smallest model (~790 MB) downloads automatically and is
then cached by the browser.

## Checks

```bash
pnpm typecheck
```

```bash
pnpm lint
```

```bash
pnpm build
```

`pnpm build` runs `next build` (static export to `out/`) and then `scripts/postbuild.mjs`, which:

- removes the ONNX Runtime `.wasm` binary the bundler copies into `out/` (~26 MB, over Cloudflare's
  limit). It is never used: Transformers.js loads ONNX Runtime from the jsDelivr CDN at runtime.
- fails the build if any file in `out/` is larger than Cloudflare Pages' 25 MiB per-file limit.

End-to-end tests (Playwright + Chromium) run against the built `out/` folder:

```bash
pnpm serve
```

```bash
pnpm e2e
```

Most e2e tests use a test-only fake model enabled with the `?e2e=mock` URL flag (CI cannot download
real models). `e2e/real-model.mjs` drives the real Transformers.js worker with the Hugging Face Hub
blocked and checks the error and Retry flow. `pnpm screens` writes light/dark, desktop/mobile
screenshots.

## Deploy to Cloudflare Pages

Connect the repository in Cloudflare Pages with these settings:

| Setting | Value |
|---|---|
| Framework preset | None (or Next.js (Static HTML Export)) |
| Build command | `pnpm build` |
| Build output directory | `out` |
| Environment variable | `NODE_VERSION` = `22` |

Or deploy the built folder directly with Wrangler:

```bash
pnpm build
```

```bash
npx wrangler pages deploy out --project-name hw
```

At runtime the browser downloads model files from `huggingface.co` and ONNX Runtime from
`cdn.jsdelivr.net`; nothing else is contacted.

## How it works

| Part | Library |
|---|---|
| UI | Next.js App Router (`output: "export"`), Tailwind CSS, shadcn/ui, react-resizable-panels |
| Chat loop | Vercel AI SDK v6: `useChat` + `DirectChatTransport` with a `ToolLoopAgent` (no HTTP) |
| Models | `@browser-ai/transformers-js` + `@huggingface/transformers` in a Web Worker |
| Storage | TanStack DB IndexedDB collections (`createIndexedDB`, `indexedDBCollectionOptions`) + `useLiveQuery` |
| Prompt editor | Tiptap (StarterKit, CodeBlockLowlight, Markdown) |
| Rendering | `@tanstack/markdown` (+ `@tanstack/highlight`) with the streaming extension |

Each request sends the fixed system prompt, the chat's locked student code (all files from the
first message plus its code blocks, with file names and line numbers), and the conversation
history, trimmed from the oldest messages when the context is full.

### Models

| Model | Size | Notes |
|---|---|---|
| `onnx-community/Qwen2.5-Coder-0.5B-Instruct` (q4) | ~790 MB | default, auto-loaded; WebGPU or WASM |
| `onnx-community/Qwen2.5-Coder-1.5B-Instruct` (q4f16) | ~1.3 GB | WebGPU only; download from the model menu |

### Keyboard

- Enter sends, Shift+Enter adds a new line, Enter inside a code block adds a new line, Tab indents
  inside a code block.
- On touch-only devices (phones) Enter adds a new line and the Send button sends, because on-screen
  keyboards have no Shift+Enter.
- Markdown shortcuts: `# `, `## `, `- `, `1. `, `` `code` ``, ```` ```python ```` + space for a code block.

### Limits

Up to 5 code files per chat, 50 KB each, attached in the first message only. The student's code is
locked for the whole chat.
