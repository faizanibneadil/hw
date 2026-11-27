import { APICallError, RetryError } from "ai";

import type { ChatErrorBody, ChatErrorCode } from "../lib/ai/api";

const STATUS: Record<ChatErrorCode, number> = {
  BAD_REQUEST: 400,
  VERIFICATION_FAILED: 403,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 429,
  UPSTREAM_ERROR: 502,
};

export function errorResponse(code: ChatErrorCode, message: string, init: { status?: number; headers?: HeadersInit } = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify({ code, message } satisfies ChatErrorBody), {
    status: init.status ?? STATUS[code],
    headers,
  });
}

/** Seconds until the Workers AI daily free allocation resets (00:00 UTC). */
export function secondsUntilUtcMidnight(now: number): number {
  const date = new Date(now);
  const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now) / 1000));
}

function unwrap(error: unknown): unknown {
  if (RetryError.isInstance(error)) return error.lastError;
  return error;
}

/**
 * Maps a model call failure to a typed error. Workers AI reports internal codes such as
 * `3036` (daily free Neurons used up) in the error data or message text.
 * https://developers.cloudflare.com/workers-ai/platform/errors/
 */
export function classifyUpstreamError(raw: unknown): ChatErrorBody & { status: number } {
  const error = unwrap(raw);
  const text = error instanceof Error ? error.message : String(error);
  const data = APICallError.isInstance(error) ? (error.data as { code?: unknown } | undefined) : undefined;
  const internalCode = typeof data?.code === "number" ? data.code : Number(/\b(3\d{3}|5\d{3})\s*:/.exec(text)?.[1]);
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;

  if (internalCode === 3036 || /daily free allocation|neurons/i.test(text)) {
    return {
      code: "QUOTA_EXCEEDED",
      message: "The daily free Workers AI allocation is used up. It resets at 00:00 UTC.",
      status: 429,
    };
  }
  if (internalCode === 3040 || status === 429) {
    return { code: "UPSTREAM_ERROR", message: "The model is busy right now. Try again in a moment.", status: 503 };
  }
  if (internalCode === 3006 || status === 413) {
    return { code: "BAD_REQUEST", message: "The code and chat are too large for this model.", status: 413 };
  }
  return { code: "UPSTREAM_ERROR", message: "The model failed to answer.", status: 502 };
}
