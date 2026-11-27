import { createRequire } from "node:module";

/** Playwright is preinstalled globally (resolved through NODE_PATH via require). */
export const { chromium, devices } = createRequire(import.meta.url)("playwright");

export const BASE = process.env.URL ?? "http://localhost:4173/";
/** App URL with the test-only mock model in Offline mode (no model download needed). */
export const MOCK_URL = `${BASE}?e2e=mock&delay=1&mode=local`;
/** App URL in cloud mode (default) with test-only flags; `/api/chat` must be mocked with `mockChatApi`. */
export const CLOUD_URL = `${BASE}?e2e=mock&mode=cloud`;

/** Fake Turnstile API (the real script is not reachable in CI): renders nothing and issues a token. */
const FAKE_TURNSTILE = `window.turnstile = (() => {
  let options = null;
  const issue = () => setTimeout(() => options && options.callback("test-token-" + Date.now()), 10);
  return {
    render(el, o) { options = o; issue(); return "w1"; },
    reset() { issue(); },
    remove() { options = null; },
  };
})();`;

export async function mockTurnstile(page) {
  await page.route(/^https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/, (route) =>
    route.fulfill({ contentType: "text/javascript", body: FAKE_TURNSTILE }),
  );
}

/** A UI message stream (SSE) like the Worker's `createUIMessageStreamResponse`. */
export function uiStream(text) {
  const chunks = [
    { type: "start" },
    { type: "start-step" },
    { type: "text-start", id: "t" },
    ...text.split(/(?<=\s)/).map((delta) => ({ type: "text-delta", id: "t", delta })),
    { type: "text-end", id: "t" },
    { type: "finish-step" },
    { type: "finish" },
  ];
  return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
}

/**
 * Mocks `POST /api/chat`. `respond(body, index)` returns `{ status, json }` for an error or
 * `{ text }` for a streamed answer. Returns the list of received request bodies.
 */
export async function mockChatApi(page, respond) {
  const requests = [];
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const result = await respond(body, requests.length - 1);
    if (result.json) {
      return route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result.json) });
    }
    return route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
        "x-hw-verified-until": String(Date.now() + 30 * 60 * 1000),
      },
      body: uiStream(result.text),
    });
  });
  return requests;
}

/** Waits until the active model is ready (no progress / preparing status). */
export async function waitForModelReady(page) {
  await page.getByRole("button", { name: /^Model: .*Change model$/ }).waitFor();
  await page.getByRole("progressbar", { name: "Model progress" }).waitFor({ state: "detached" });
  await page.getByText(/^Preparing /).waitFor({ state: "detached" });
}
