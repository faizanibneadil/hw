import { DefaultChatTransport, type ChatTransport, type UIMessage } from "ai";

import { CHAT_API_PATH, VERIFIED_UNTIL_HEADER, isChatErrorBody, type ChatRequestExtras } from "@/lib/ai/api";
import { formatLockedCode, type LockedCode } from "@/lib/ai/context";
import { inferenceSettings } from "@/lib/ai/inference-settings";
import { turnstile } from "@/lib/ai/turnstile";

/** Reads the verification state from the Worker's responses (and resets it when rejected). */
const trackingFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const until = Number(response.headers.get(VERIFIED_UNTIL_HEADER));
  if (until) turnstile.setVerifiedUntil(until);
  if (response.status === 403) {
    const body = await response
      .clone()
      .json()
      .catch(() => null);
    if (isChatErrorBody(body) && body.code === "VERIFICATION_FAILED") turnstile.invalidate();
  }
  return response;
};

/**
 * Cloud transport: `POST /api/chat` on the Worker, which runs the selected Workers AI model and
 * streams a UI message stream back. The system prompt is added server-side.
 */
export function createCloudTransport(getLockedCode: () => LockedCode): ChatTransport<UIMessage> {
  return new DefaultChatTransport<UIMessage>({
    api: CHAT_API_PATH,
    credentials: "same-origin",
    fetch: trackingFetch,
    body: async (): Promise<ChatRequestExtras> => ({
      modelId: inferenceSettings.getState().cloudModelId,
      codeMessage: formatLockedCode(getLockedCode()),
      turnstileToken: await turnstile.getToken(),
    }),
  });
}
