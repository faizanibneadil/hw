import type { ChatTransport, UIMessage } from "ai";

import type { LockedCode } from "@/lib/ai/context";
import { inferenceSettings } from "@/lib/ai/inference-settings";
import { createCloudTransport } from "@/lib/ai/cloud-transport";
import { createLocalTransport } from "@/lib/ai/local-transport";

/** UI message type of the chat (text parts only; no tools). */
export type ChatUIMessage = UIMessage;

/**
 * One transport per chat that picks cloud (Workers AI) or local (Offline mode) per request, so
 * switching modes or models never replaces `useChat`'s chat or loses its messages.
 */
export function createChatTransport(getLockedCode: () => LockedCode): ChatTransport<ChatUIMessage> {
  let cloud: ChatTransport<ChatUIMessage> | null = null;
  let local: ChatTransport<ChatUIMessage> | null = null;
  const current = () =>
    inferenceSettings.getState().mode === "local"
      ? (local ??= createLocalTransport(getLockedCode))
      : (cloud ??= createCloudTransport(getLockedCode));
  return {
    sendMessages: (options) => current().sendMessages(options),
    reconnectToStream: (options) => current().reconnectToStream(options),
  };
}
