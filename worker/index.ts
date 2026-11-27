// Cloudflare Worker for hw: serves the static Next.js export (`out/`) and `POST /api/chat`.
// Only `/api/*` runs this code first (`assets.run_worker_first` in wrangler.jsonc).
import { createAI } from "agents/models/ai-sdk";

import { CHAT_API_PATH } from "../lib/ai/api";
import { handleChat, type ChatDeps } from "./chat";
import { errorResponse } from "./errors";
import { siteverify } from "./turnstile";

export const defaultDeps: ChatDeps = {
  getModel: (env, model) => createAI({ binding: env.AI })(model.id as never, { reasoningEffort: model.reasoningEffort }),
  verifyTurnstile: siteverify,
  now: () => Date.now(),
};

export function createWorker(deps: ChatDeps = defaultDeps) {
  return {
    async fetch(request, env) {
      const { pathname } = new URL(request.url);
      if (pathname === CHAT_API_PATH) return handleChat(request, env, deps);
      if (pathname.startsWith("/api/")) return errorResponse("BAD_REQUEST", "Not found.", { status: 404 });
      return env.ASSETS.fetch(request);
    },
  } satisfies ExportedHandler<Env>;
}

export default createWorker();
