import type { LanguageModelV3, LanguageModelV3CallOptions, LanguageModelV3StreamPart } from "@ai-sdk/provider";

/**
 * TEST ONLY (enabled with `?e2e=mock`): a fake streaming model so the full chat flow can be
 * verified in CI without downloading a real model. It reports what context it received.
 */
export function createMockModel(modelId: string): LanguageModelV3 {
  return {
    specificationVersion: "v3",
    provider: "mock",
    modelId,
    supportedUrls: {},
    doGenerate: async () => {
      throw new Error("not supported");
    },
    doStream: async (options: LanguageModelV3CallOptions) => {
      const prompt = options.prompt;
      const systems = prompt.filter((m) => m.role === "system").map((m) => m.content);
      const users = prompt.filter((m) => m.role === "user");
      const lastUser = users.at(-1);
      const lastText =
        lastUser && lastUser.role === "user"
          ? lastUser.content.map((p) => (p.type === "text" ? p.text : "")).join(" ")
          : "";
      const historyHasFence = prompt.some(
        (m) => m.role === "user" && m.content.some((p) => p.type === "text" && p.text.includes("```")),
      );
      const files = [...(systems[1] ?? "").matchAll(/### File: (\S+)/g)].map((m) => m[1]);
      const text = [
        "## Result",
        "| What was checked | Marks | Why |",
        "|---|---|---|",
        `| Item 1 | 2 / 2 | correct in ${files[0] ?? "code"}:1 |`,
        `| Item 2 | ${/item 2 is actually done/i.test(lastText) ? "2" : "0"} / 2 | follow-up aware |`,
        "",
        "**Total: X / 4**",
        "",
        "### How the marks were given",
        `mock systems=${systems.length} files=${files.join(",")} turns=${users.length} history=${prompt.length - systems.length} fencesInHistory=${historyHasFence}`,
        "",
        "### Improvements",
        "- Add comments.",
        "- Use clearer names.",
      ].join("\n");
      const words = text.split(/(?<=\s)/);
      const wordDelay = Number(new URLSearchParams(window.location.search).get("wordDelay") ?? 25);
      const signal = options.abortSignal;
      const stream = new ReadableStream<LanguageModelV3StreamPart>({
        async start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({ type: "text-start", id: "t" });
          for (const word of words) {
            if (signal?.aborted) break;
            controller.enqueue({ type: "text-delta", id: "t", delta: word });
            await new Promise((r) => setTimeout(r, wordDelay));
          }
          controller.enqueue({ type: "text-end", id: "t" });
          controller.enqueue({
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: words.length, text: words.length, reasoning: 0 },
            },
          });
          controller.close();
        },
      });
      return { stream };
    },
  };
}

export function isMockMode(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("e2e") === "mock";
}
