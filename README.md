# hw: AI homework checker

A web app for teachers to check and mark small student coding assignments. Attach the student's
files (or paste the code into a code block), write what to check, and an AI model returns a marked
result table. Follow-up messages correct or refine the result.

- **Cloud mode (default):** grading runs on **Cloudflare Workers AI** through a small Worker API
  (`POST /api/chat`). Nothing is downloaded; a new teacher gets an answer right away.
- **Offline / Private mode (opt-in):** a small code model (~790 MB, downloaded once) runs **in the
  browser** with Transformers.js, so the student's code never leaves the device.

No accounts and no server-side storage: all chats, messages and files are stored in IndexedDB in the
teacher's browser in both modes.

## Requirements

- Node.js 20+ and pnpm 10 (`corepack enable`)
- A Cloudflare account (Workers Free plan is enough) for cloud mode and deploys
- Offline mode only: a browser with WebGPU for the best speed (Chrome/Edge 113+). Without WebGPU the
  small model runs on WASM/CPU and larger models are disabled.

## Local development

```bash
pnpm install
```

### UI only (Next.js dev server)

```bash
pnpm dev
```

Open http://localhost:3000. `next dev` has no `/api/chat`, so cloud requests fail there: use this for
UI work and Offline mode, or run the Worker as below.

### Full app with the Worker API (wrangler dev)

The Worker serves the static export in `out/` and `POST /api/chat`. Workers AI always runs remotely
(also in `wrangler dev`), so log in first; local requests count against your account's daily free
Neurons.

```bash
npx wrangler login
```

```bash
cp .dev.vars.example .dev.vars
```

```bash
pnpm build
```

```bash
pnpm dev:worker
```

Open http://localhost:8787. `.dev.vars` holds Cloudflare's official Turnstile **test** secret
(`1x0000000000000000000000000000000AA`, always passes), and without `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
the app uses the matching invisible test site key (`1x00000000000000000000BB`). Rebuild (`pnpm build`)
after UI changes; `wrangler dev` reloads Worker changes by itself.

## Turnstile keys and secrets

`POST /api/chat` is protected by [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
and a per-IP rate limit.

| Name | Where | Value |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | build-time env var (public, baked into `out/`) | the widget's site key |
| `TURNSTILE_SECRET_KEY` | Worker secret | the widget's secret key |

1. In the Cloudflare dashboard go to **Turnstile** > **Add widget**. Add your production hostname
   (and `localhost` if you want to test real keys locally). Widget mode: **Invisible** (or Managed;
   the app renders it with `appearance: interaction-only`, so it only appears if Cloudflare needs a
   click).
2. Store the secret on the Worker:

   ```bash
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```

3. Build with the site key, for example in `.env.production.local` (git-ignored):

   ```bash
   echo "NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAA..." > .env.production.local
   ```

   With Workers Builds (Git integration), add it under the Worker's **Settings** > **Build** >
   **Variables and secrets** instead.

How verification works: the browser sends a Turnstile token with its first request. The Worker checks
it with Siteverify (tokens are single use and valid for 300 s), then sets a signed, `HttpOnly` cookie
(`hw_verified`, 30 minutes, HMAC keyed from `TURNSTILE_SECRET_KEY`). While the cookie is valid the
browser sends no token and the teacher is not challenged again.

Test keys for local dev and CI (from the
[Turnstile testing docs](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)):

| Purpose | Site key | Secret key |
|---|---|---|
| Always passes (invisible) | `1x00000000000000000000BB` | `1x0000000000000000000000000000000AA` |
| Always fails | `2x00000000000000000000BB` | `2x0000000000000000000000000000000AA` |

## Deploy (Cloudflare Workers with static assets)

```bash
pnpm deploy
```

This runs `pnpm build` (`next build` static export to `out/` + `scripts/postbuild.mjs`) and
`wrangler deploy`. `wrangler.jsonc` configures:

| Setting | Value |
|---|---|
| `assets.directory` | `./out` |
| `assets.run_worker_first` | `["/api/*"]`: only the API runs the Worker; everything else is served as static assets (free, and does not count as Worker requests) |
| `assets.not_found_handling` | `404-page`: unknown paths return `out/404.html` with status 404, like the previous Pages project |
| `ai` | Workers AI binding `AI` |
| `ratelimits` | `CHAT_RATE_LIMITER`: 20 requests per 60 s per `CF-Connecting-IP` (edit `simple.limit` to change; `period` must be 10 or 60) |

Server-side limits (`lib/ai/api.ts`): 1 MiB request body, 400,000 characters of student code,
200 messages; the history is trimmed to the selected model's context window.

### Move the custom domain from the Pages project to the Worker

1. Deploy the Worker once (`pnpm deploy`) and check it on its `*.workers.dev` URL.
2. Dashboard: **Workers & Pages** > the old **Pages** project > **Custom domains**: remove the domain.
3. **Workers & Pages** > the **hw** Worker > **Settings** > **Domains & Routes** > **Add** > **Custom
   domain**: add the same hostname. Cloudflare creates the DNS record and certificate. (Workers
   custom domains require the zone's nameservers to be on Cloudflare.)
4. Add that hostname to the Turnstile widget's hostnames (step 1 above).
5. When everything works, delete the Pages project. Optional: set `"workers_dev": false` in
   `wrangler.jsonc` to turn off the `workers.dev` URL.

## Free-tier limits

| Limit | Workers Free |
|---|---|
| Workers AI | 10,000 Neurons per day, reset at **00:00 UTC**. When used up, the app explains it, shows the reset time (local and UTC) and offers **Switch to Offline mode** |
| Worker requests | 100,000 per day (only `/api/*` counts; static assets are free) |
| Worker CPU time | 10 ms per request (time waiting for the model does not count) |
| Static assets | 25 MiB per file, 20,000 files per version (checked by `scripts/postbuild.mjs`) |
| Turnstile | free, up to 20 widgets per account |

Rough cost per grading (about 3,000 input and 1,000 output tokens, from the per-model Neuron prices):
GLM 4.7 Flash and Gemma 4 26B about 55 Neurons (about 180 gradings a day), Qwen 3.8 27B about 400
Neurons (about 25 a day). All three models are available on the Workers Free plan.

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

```bash
pnpm test:worker
```

```bash
npx wrangler deploy --dry-run
```

`pnpm typecheck` checks the app and the Worker (`worker/tsconfig.json`). `pnpm test:worker` runs the
Worker unit tests (Vitest with `@cloudflare/vitest-plugin`, in workerd) with a mock model: model
allowlist, body and code size limits, Turnstile, the verification cookie, rate limiting and error
mapping. After changing bindings in `wrangler.jsonc`, regenerate the types:

```bash
pnpm cf-typegen
```

End-to-end tests (Playwright + Chromium) run against the built `out/` folder:

```bash
pnpm serve
```

```bash
pnpm e2e
```

`e2e/cloud.mjs` mocks `/api/chat` and the Turnstile script (no real Cloudflare calls) and checks that
cloud mode never downloads a model or the transformers.js code, the typed errors (quota with reset
time and **Switch to Offline mode**, rate limit, verification) and switching modes without losing
the chat. The other tests run in Offline mode with a test-only fake model (`?e2e=mock&mode=local`);
`e2e/real-model.mjs` drives the real Transformers.js worker with the Hugging Face Hub blocked.
`pnpm screens` writes light/dark, desktop/mobile screenshots.

`next.config.ts` aliases `onnxruntime-web/webgpu` to ONNX Runtime's external-wasm build, because the
default build copies a 25.6 MiB `.wasm` into `out/`, over the 25 MiB per-file limit. Offline mode loads
the wasm from the jsDelivr CDN at runtime anyway.

## How it works

| Part | Library |
|---|---|
| UI | Next.js App Router (`output: "export"`), Tailwind CSS, shadcn/ui, react-resizable-panels |
| Chat loop | Vercel AI SDK v7 `useChat` with one transport that picks cloud or offline per request |
| Cloud | `DefaultChatTransport` to `POST /api/chat`; Worker (`worker/index.ts`): `streamText` with `createAI` from `agents/models/ai-sdk` on the `AI` binding |
| Offline | `DirectChatTransport` + `ToolLoopAgent` on `@browser-ai/transformers-js` + `@huggingface/transformers` in a Web Worker (lazy-loaded) |
| Storage | TanStack DB IndexedDB collections (`createIndexedDB`, `indexedDBCollectionOptions`) + `useLiveQuery` |
| Prompt editor | Tiptap (StarterKit, CodeBlockLowlight, Markdown) |
| Rendering | `@tanstack/markdown` (+ `@tanstack/highlight`) with the streaming extension |

Each request uses the fixed system prompt, the chat's locked student code (all files from the first
message plus its code blocks, with file names and line numbers), and the conversation history,
trimmed from the oldest messages when the context is full. In cloud mode the browser sends the
formatted code and the messages; the Worker adds the system prompt and trims the history. The shared
code (`lib/ai/models.ts`, `api.ts`, `context.ts`, `system-prompt.ts`) has no browser-only
dependencies and is imported by both.

At runtime, cloud mode contacts only the app's own origin and `challenges.cloudflare.com`
(Turnstile). Offline mode downloads model files from `huggingface.co` and ONNX Runtime from
`cdn.jsdelivr.net`.

### Models

The mode and model are remembered per browser (localStorage).

| Model | Mode | Context | Notes |
|---|---|---|---|
| `@cf/zai-org/glm-4.7-flash` | cloud | 131,072 | default |
| `@cf/google/gemma-4-26b-a4b-it` | cloud | 256,000 | |
| `@cf/qwen/qwen3.8-27b` | cloud | 262,144 | replaces the deprecated Nemotron 3 (see PLAN.md) |
| `onnx-community/Qwen2.5-Coder-0.5B-Instruct` (q4) | offline | 16,384 | ~790 MB; loaded when Offline mode is turned on |
| `onnx-community/Qwen2.5-Coder-1.5B-Instruct` (q4f16) | offline | 16,384 | ~1.3 GB, WebGPU only; download from the model menu |

The Worker only accepts the three cloud model ids (allowlist in `lib/ai/models.ts`).

### Keyboard

- Enter sends, Shift+Enter adds a new line, Enter inside a code block adds a new line, Tab indents
  inside a code block.
- On touch-only devices (phones) Enter adds a new line and the Send button sends, because on-screen
  keyboards have no Shift+Enter.
- Markdown shortcuts: `# `, `## `, `- `, `1. `, `` `code` ``, ```` ```python ```` + space for a code block.

### Limits

Up to 5 code files per chat, 50 KB each, attached in the first message only. The student's code is
locked for the whole chat.
