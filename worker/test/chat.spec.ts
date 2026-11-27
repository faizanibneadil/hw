import { env } from "cloudflare:workers";
import { APICallError } from "ai";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { describe, expect, it, vi } from "vitest";

import { MAX_CODE_CHARS, MAX_REQUEST_BYTES, VERIFIED_UNTIL_HEADER } from "../../lib/ai/api";
import { DEFAULT_CLOUD_MODEL_ID } from "../../lib/ai/models";
import type { ChatDeps } from "../chat";
import { createWorker } from "../index";

// A correctly typed incoming `Request` for `worker.fetch()` (as in the Workers Vitest docs).
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const URL = "https://hw.example/api/chat";
let ipCounter = 0;
const nextIp = () => `203.0.113.${++ipCounter}`;

function textModel(text = "## Result\n| a | b |") {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: text },
          { type: "text-end", id: "t" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 1, text: 1, reasoning: 0 },
            },
          },
        ],
      }),
    }),
  });
}

function setup(overrides: Partial<ChatDeps> = {}) {
  const model = textModel();
  const verifyTurnstile = vi.fn<ChatDeps["verifyTurnstile"]>(async (token) => ({ success: token === "good-token" }));
  const deps: ChatDeps = { getModel: () => model, verifyTurnstile, now: () => Date.now(), ...overrides };
  return { worker: createWorker(deps), model, verifyTurnstile };
}

function chatBody(extra: Record<string, unknown> = {}) {
  return {
    id: "chat-1",
    trigger: "submit-message",
    messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "Check it (2 marks)" }] }],
    modelId: DEFAULT_CLOUD_MODEL_ID,
    codeMessage: "STUDENT CODE:\n### File: main.py\n1 | print(1)",
    turnstileToken: "good-token",
    ...extra,
  };
}

function post(body: unknown, { ip = nextIp(), cookie }: { ip?: string; cookie?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", "cf-connecting-ip": ip };
  if (cookie) headers.cookie = cookie;
  return new IncomingRequest(URL, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
}

async function errorCode(response: Response) {
  return ((await response.json()) as { code: string }).code;
}

describe("POST /api/chat", () => {
  it("streams the model's answer with the system prompt and locked code", async () => {
    const { worker, model } = setup();
    const response = await worker.fetch(post(chatBody()), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toContain("## Result");
    const prompt = model.doStreamCalls[0].prompt;
    expect(prompt.filter((m) => m.role === "system")).toHaveLength(2);
    expect(prompt[1]).toMatchObject({ role: "system", content: expect.stringContaining("STUDENT CODE") });
    expect(model.doStreamCalls[0].maxOutputTokens).toBe(1536);
  });

  it("rejects model ids that are not allowlisted", async () => {
    const { worker, model } = setup();
    for (const modelId of ["@cf/meta/llama-3.1-8b-instruct", "anthropic/claude-opus-5.5", "", 42]) {
      const response = await worker.fetch(post(chatBody({ modelId })), env);
      expect(response.status).toBe(400);
      expect(await errorCode(response)).toBe("BAD_REQUEST");
    }
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it("rejects oversized bodies and oversized code", async () => {
    const { worker } = setup();
    const huge = await worker.fetch(post(chatBody({ codeMessage: "x".repeat(MAX_REQUEST_BYTES) })), env);
    expect(huge.status).toBe(413);
    expect(await errorCode(huge)).toBe("BAD_REQUEST");

    const bigCode = await worker.fetch(post(chatBody({ codeMessage: "x".repeat(MAX_CODE_CHARS + 1) })), env);
    expect(bigCode.status).toBe(413);
    expect(await errorCode(bigCode)).toBe("BAD_REQUEST");
  });

  it("rejects malformed requests", async () => {
    const { worker } = setup();
    expect((await worker.fetch(post("{not json"), env)).status).toBe(400);
    expect((await worker.fetch(post(chatBody({ messages: [] })), env)).status).toBe(400);
    expect((await worker.fetch(post(chatBody({ messages: [{ role: "user" }] })), env)).status).toBe(400);
    expect((await worker.fetch(new IncomingRequest(URL), env)).status).toBe(405);
  });

  it("requires a valid Turnstile token", async () => {
    const { worker, model, verifyTurnstile } = setup();
    const missing = await worker.fetch(post(chatBody({ turnstileToken: undefined })), env);
    expect(missing.status).toBe(403);
    expect(await errorCode(missing)).toBe("VERIFICATION_FAILED");

    const invalid = await worker.fetch(post(chatBody({ turnstileToken: "bad-token" })), env);
    expect(invalid.status).toBe(403);
    expect(await errorCode(invalid)).toBe("VERIFICATION_FAILED");
    expect(verifyTurnstile).toHaveBeenCalledWith("bad-token", "test-secret", expect.any(String));
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it("reuses a successful verification through a signed cookie", async () => {
    const { worker, verifyTurnstile } = setup();
    const ip = nextIp();
    const first = await worker.fetch(post(chatBody(), { ip }), env);
    expect(first.status).toBe(200);
    const setCookie = first.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^hw_verified=v1\.\d+\.[\w-]+; Max-Age=1800; Path=\/api; HttpOnly; SameSite=Strict; Secure$/);
    expect(Number(first.headers.get(VERIFIED_UNTIL_HEADER))).toBeGreaterThan(Date.now());
    await first.text();

    const cookie = setCookie.split(";")[0];
    const second = await worker.fetch(post(chatBody({ turnstileToken: undefined }), { ip, cookie }), env);
    expect(second.status).toBe(200);
    await second.text();
    expect(verifyTurnstile).toHaveBeenCalledTimes(1);

    const forged = await worker.fetch(post(chatBody({ turnstileToken: undefined }), { ip, cookie: `${cookie.slice(0, -2)}xx` }), env);
    expect(forged.status).toBe(403);
  });

  it("returns 429 RATE_LIMITED past the per-IP limit", async () => {
    const { worker } = setup();
    const ip = nextIp();
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) {
      const response = await worker.fetch(post(chatBody(), { ip }), env);
      statuses.push(response.status);
      if (response.status === 429) {
        expect(await errorCode(response)).toBe("RATE_LIMITED");
        expect(response.headers.get("retry-after")).toBe("60");
        break;
      }
      await response.text();
    }
    expect(statuses.at(-1)).toBe(429);
    expect(statuses.filter((s) => s === 200).length).toBe(20);
  });

  it("maps the Workers AI daily limit to QUOTA_EXCEEDED", async () => {
    const quota = new MockLanguageModelV4({
      doStream: async () => {
        throw new APICallError({
          message: "3036: You have used up your daily free allocation of 10,000 neurons.",
          url: "https://workers-binding.ai",
          requestBodyValues: {},
          statusCode: 429,
          data: { code: 3036 },
        });
      },
    });
    const { worker } = setup({ getModel: () => quota });
    const response = await worker.fetch(post(chatBody()), env);
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "QUOTA_EXCEEDED" });
  });

  it("maps other model failures to UPSTREAM_ERROR", async () => {
    const broken = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error("boom");
      },
    });
    const { worker } = setup({ getModel: () => broken });
    const response = await worker.fetch(post(chatBody()), env);
    expect(response.status).toBe(502);
    expect(await errorCode(response)).toBe("UPSTREAM_ERROR");
  });

  it("trims long histories to the model's context window", async () => {
    const { worker, model } = setup();
    const long = "word ".repeat(40_000);
    const messages = Array.from({ length: 21 }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 ? "assistant" : "user",
      parts: [{ type: "text", text: long }],
    }));
    const response = await worker.fetch(post(chatBody({ messages: messages.slice(0, 5) })), env);
    expect(response.status).toBe(200);
    await response.text();
    const sent = model.doStreamCalls[0].prompt.filter((m) => m.role !== "system");
    expect(sent.length).toBeLessThan(5);
    expect(sent[0].role).toBe("user");
  });
});

describe("other routes", () => {
  it("returns JSON 404 for unknown API paths", async () => {
    const { worker } = setup();
    const response = await worker.fetch(new IncomingRequest("https://hw.example/api/nope"), env);
    expect(response.status).toBe(404);
  });
});
