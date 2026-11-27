import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type LanguageModel,
  type UIMessage,
  type UIMessageChunk,
} from "ai";

import {
  MAX_CODE_CHARS,
  MAX_MESSAGES,
  MAX_REQUEST_BYTES,
  MAX_TURNSTILE_TOKEN_CHARS,
  VERIFIED_UNTIL_HEADER,
  type ChatRequestExtras,
} from "../lib/ai/api";
import { prepareHistory } from "../lib/ai/context";
import { MAX_OUTPUT_TOKENS, getCloudModel, type CloudModelConfig } from "../lib/ai/models";
import { SYSTEM_PROMPT } from "../lib/ai/system-prompt";
import { classifyUpstreamError, errorResponse } from "./errors";
import { createVerifiedCookie, verifiedUntil, type VerifyTurnstile } from "./turnstile";

export interface ChatEnv {
  AI: Ai;
  CHAT_RATE_LIMITER: RateLimit;
  TURNSTILE_SECRET_KEY?: string;
}

export interface ChatDeps {
  /** Builds the AI SDK model for an allowlisted Workers AI model. */
  getModel: (env: ChatEnv, model: CloudModelConfig) => LanguageModel;
  verifyTurnstile: VerifyTurnstile;
  now: () => number;
}

interface ChatBody extends Partial<ChatRequestExtras> {
  messages?: unknown;
}

/** The token Turnstile's test site keys produce (a real secret always rejects it). */
const TEST_SITE_KEY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

class BodyTooLargeError extends Error {}

/** Reads at most `limit` bytes of the body (Content-Length can be missing or wrong). */
async function readBody(request: Request, limit: number): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > limit) throw new BodyTooLargeError();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Waits for the first content of the stream, so an error before any output (quota, capacity,
 * unknown model) is returned as a typed JSON error with the right status instead of a 200 stream.
 */
async function firstContentOrError(stream: ReadableStream<UIMessageChunk>, failed: () => unknown) {
  const reader = stream.getReader();
  const buffered: UIMessageChunk[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value.type === "error") {
      await reader.cancel();
      return { error: failed() ?? new Error(value.errorText) };
    }
    buffered.push(value);
    if (value.type === "text-delta" || value.type === "reasoning-delta" || value.type === "finish") break;
  }
  const replay = new ReadableStream<UIMessageChunk>({
    start(controller) {
      buffered.forEach((chunk) => controller.enqueue(chunk));
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return { stream: replay };
}

/** `POST /api/chat`: validate -> rate limit -> Turnstile -> Workers AI -> UI message stream. */
export async function handleChat(request: Request, env: ChatEnv, deps: ChatDeps): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse("BAD_REQUEST", "Use POST.", { status: 405, headers: { allow: "POST" } });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return errorResponse("BAD_REQUEST", "Send JSON.", { status: 415 });
  }

  // 1. Validate: size, shape, model allowlist, code size.
  let body: ChatBody;
  try {
    body = JSON.parse(await readBody(request, MAX_REQUEST_BYTES)) as ChatBody;
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return errorResponse("BAD_REQUEST", "The request is too large.", { status: 413 });
    }
    return errorResponse("BAD_REQUEST", "The request is not valid JSON.");
  }
  if (!body || typeof body !== "object") return errorResponse("BAD_REQUEST", "The request is not valid.");

  const model = typeof body.modelId === "string" ? getCloudModel(body.modelId) : undefined;
  if (!model) return errorResponse("BAD_REQUEST", "This model is not available.");
  if (typeof body.codeMessage !== "string") return errorResponse("BAD_REQUEST", "The student code is missing.");
  if (body.codeMessage.length > MAX_CODE_CHARS) {
    return errorResponse("BAD_REQUEST", "The student code is too large.", { status: 413 });
  }
  if (body.turnstileToken !== undefined && (typeof body.turnstileToken !== "string" || body.turnstileToken.length > MAX_TURNSTILE_TOKEN_CHARS)) {
    return errorResponse("BAD_REQUEST", "The verification token is not valid.");
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES) {
    return errorResponse("BAD_REQUEST", "The chat history is not valid.");
  }
  const validated = await safeValidateUIMessages<UIMessage>({ messages: body.messages });
  if (!validated.success) return errorResponse("BAD_REQUEST", "The chat history is not valid.");
  const messages = validated.data.filter((message) => message.role === "user" || message.role === "assistant");
  if (messages.at(-1)?.role !== "user") return errorResponse("BAD_REQUEST", "The last message must be from the teacher.");

  // 2. Rate limit per client IP.
  const ip = request.headers.get("cf-connecting-ip");
  const { success: allowed } = await env.CHAT_RATE_LIMITER.limit({ key: ip ?? "unknown" });
  if (!allowed) {
    return errorResponse("RATE_LIMITED", "Too many requests. Wait a minute and try again.", {
      headers: { "retry-after": "60" },
    });
  }

  // 3. Turnstile: a valid signed cookie, or a token that passes Siteverify.
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("Turnstile: the TURNSTILE_SECRET_KEY secret is not set on this Worker");
    return errorResponse("VERIFICATION_FAILED", "The server has no TURNSTILE_SECRET_KEY secret. Set it with `wrangler secret put TURNSTILE_SECRET_KEY`.");
  }
  const now = deps.now();
  const headers = new Headers();
  let until = await verifiedUntil(request, secret, now);
  if (until === null) {
    if (!body.turnstileToken) {
      return errorResponse("VERIFICATION_FAILED", "The browser sent no Turnstile token (the widget did not load or did not finish).");
    }
    if (body.turnstileToken === TEST_SITE_KEY_TOKEN && !secret.startsWith("1x0000")) {
      console.error("Turnstile: the site was built with the test site key; set NEXT_PUBLIC_TURNSTILE_SITE_KEY at build time");
      return errorResponse(
        "VERIFICATION_FAILED",
        "This build uses Turnstile's test site key. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY as a build variable and deploy again.",
      );
    }
    const result = await deps.verifyTurnstile(body.turnstileToken, secret, ip);
    if (!result.success) {
      const codes = result["error-codes"]?.join(", ") || "unknown";
      console.error("Turnstile: Siteverify rejected the token", { codes, hostname: result.hostname });
      return errorResponse("VERIFICATION_FAILED", `Turnstile rejected the token (${codes}).`);
    }
    const cookie = await createVerifiedCookie(secret, now, new URL(request.url).protocol === "https:");
    headers.append("set-cookie", cookie.header);
    until = cookie.expires;
  }
  headers.set(VERIFIED_UNTIL_HEADER, String(until));

  // 4. Workers AI: same system prompt, locked code and trimmed history as Offline mode.
  let upstreamError: unknown;
  const result = streamText({
    model: deps.getModel(env, model),
    instructions: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: body.codeMessage },
    ],
    messages: prepareHistory(await convertToModelMessages(messages), body.codeMessage, model.contextTokens),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
    maxRetries: 0,
    abortSignal: request.signal,
    onError: ({ error }) => {
      upstreamError = error;
    },
  });
  const uiStream = toUIMessageStream({
    stream: result.stream,
    sendReasoning: false,
    onError: (error) => {
      upstreamError ??= error;
      const { code, message } = classifyUpstreamError(error);
      return JSON.stringify({ code, message });
    },
  });

  const first = await firstContentOrError(uiStream, () => upstreamError);
  if ("error" in first) {
    const { code, message, status } = classifyUpstreamError(first.error);
    console.error("Workers AI error", model.id, first.error);
    return errorResponse(code, message, { status, headers });
  }
  return createUIMessageStreamResponse({ stream: first.stream, headers });
}
