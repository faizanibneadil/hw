import type { LanguageModelV3 } from "@ai-sdk/provider";
import { DirectChatTransport, ToolLoopAgent, stepCountIs, type InferAgentUIMessage } from "ai";

import { MAX_OUTPUT_TOKENS, getModelConfig } from "@/lib/ai/models";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { estimateTokens, formatLockedCode, trimHistory, type LockedCode } from "@/lib/ai/context";
import { modelManager } from "@/lib/ai/model-manager";

/**
 * Stable model handle for the agent that forwards to whichever model is active in the
 * model manager, so switching models does not require a new transport.
 */
const activeModel: LanguageModelV3 = {
  specificationVersion: "v3",
  provider: "hw",
  modelId: "active",
  supportedUrls: {},
  doGenerate: (options) => requireActiveModel().doGenerate(options),
  doStream: (options) => requireActiveModel().doStream(options),
};

function requireActiveModel(): LanguageModelV3 {
  const model = modelManager.getActiveModel();
  if (!model) throw new Error("The model is not ready yet. Wait until it has finished loading and try again.");
  return model;
}

/**
 * In-browser chat transport: `DirectChatTransport` runs the agent in-process (no HTTP).
 * Every request gets: the fixed system prompt, the chat's locked student code, and the
 * (trimmed) conversation history.
 */
export function createChatTransport(getLockedCode: () => LockedCode) {
  const agent = new ToolLoopAgent({
    model: activeModel,
    instructions: SYSTEM_PROMPT,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
    stopWhen: stepCountIs(1),
    prepareStep: ({ messages }) => {
      const codeMessage = formatLockedCode(getLockedCode());
      const contextTokens = getModelConfig(modelManager.getState().activeId)?.contextTokens ?? 8192;
      const budget = contextTokens - MAX_OUTPUT_TOKENS - estimateTokens(SYSTEM_PROMPT) - estimateTokens(codeMessage);
      return {
        system: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: codeMessage },
        ],
        messages: trimHistory(messages, Math.max(budget, 0)),
      };
    },
  });
  return new DirectChatTransport({ agent });
}

/** UI message type produced by the chat agent (text parts only; no tools). */
export type ChatUIMessage = InferAgentUIMessage<ToolLoopAgent<never, Record<string, never>, never>>;
