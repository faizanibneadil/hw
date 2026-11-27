import type { LanguageModelV4 } from "@ai-sdk/provider";
import { DirectChatTransport, ToolLoopAgent, isStepCount, type ChatTransport, type UIMessage } from "ai";

import { MAX_OUTPUT_TOKENS, getLocalModel } from "@/lib/ai/models";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { formatLockedCode, prepareHistory, type LockedCode } from "@/lib/ai/context";
import { modelManager } from "@/lib/ai/model-manager";

/**
 * Stable model handle for the agent that forwards to whichever model is active in the
 * model manager, so switching models does not require a new transport.
 */
const activeModel: LanguageModelV4 = {
  specificationVersion: "v4",
  provider: "hw",
  modelId: "active",
  supportedUrls: {},
  doGenerate: (options) => requireActiveModel().doGenerate(options),
  doStream: (options) => requireActiveModel().doStream(options),
};

function requireActiveModel(): LanguageModelV4 {
  const model = modelManager.getActiveModel();
  if (!model) throw new Error("The offline model is not ready yet. Wait until it has finished loading and try again.");
  return model;
}

/**
 * Offline / Private mode transport: `DirectChatTransport` runs the agent in-process (no HTTP)
 * on the in-browser model. Every request gets: the fixed system prompt, the chat's locked
 * student code, and the (trimmed) conversation history.
 */
export function createLocalTransport(getLockedCode: () => LockedCode): ChatTransport<UIMessage> {
  const agent = new ToolLoopAgent({
    model: activeModel,
    instructions: SYSTEM_PROMPT,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
    stopWhen: isStepCount(1),
    prepareStep: ({ messages }) => {
      const codeMessage = formatLockedCode(getLockedCode());
      const contextTokens = getLocalModel(modelManager.getState().activeId)?.contextTokens ?? 8192;
      return {
        instructions: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: codeMessage },
        ],
        messages: prepareHistory(messages, codeMessage, contextTokens),
      };
    },
  });
  // The agent has no tools or data parts, so its messages are plain text UI messages.
  return new DirectChatTransport({ agent }) as unknown as ChatTransport<UIMessage>;
}
