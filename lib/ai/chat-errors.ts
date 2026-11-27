import { APICallError } from "ai";

import { isChatErrorBody, nextQuotaReset, type ChatErrorCode } from "@/lib/ai/api";

export interface ChatErrorInfo {
  code: ChatErrorCode | "LOCAL_ERROR";
  /** Plain-English text for the teacher. */
  message: string;
}

function parseJson(text: string | undefined): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function formatTime(date: Date, timeZone?: string) {
  return date.toLocaleString(undefined, {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** "Fri 1:00 AM GMT+1 (00:00 UTC)": when the Workers AI daily free allocation resets. */
export function quotaResetText(now = new Date()): string {
  const reset = nextQuotaReset(now);
  return `${formatTime(reset)} (00:00 UTC)`;
}

const FRIENDLY: Record<ChatErrorCode, (serverMessage: string) => string> = {
  QUOTA_EXCEEDED: () =>
    `Today's free cloud grading is used up. It resets at ${quotaResetText()}. You can switch to Offline mode to keep grading now.`,
  RATE_LIMITED: () => "Too many requests in a short time. Wait a minute, then press Retry.",
  VERIFICATION_FAILED: () =>
    "We could not confirm this browser is not a bot. Press Retry; if it keeps failing, reload the page.",
  BAD_REQUEST: (message) => `The request was not accepted: ${message}`,
  UPSTREAM_ERROR: () => "The cloud model did not answer. Press Retry, or pick another model.",
};

/** Turns an error from `useChat` into a typed, readable message. */
export function describeChatError(error: Error): ChatErrorInfo {
  const body = APICallError.isInstance(error) ? parseJson(error.responseBody) : null;
  const typed = isChatErrorBody(body) ? body : parseJson(error.message);
  if (isChatErrorBody(typed)) return { code: typed.code, message: FRIENDLY[typed.code](typed.message) };
  if (APICallError.isInstance(error) && error.statusCode) {
    return { code: "UPSTREAM_ERROR", message: FRIENDLY.UPSTREAM_ERROR("") };
  }
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return { code: "UPSTREAM_ERROR", message: "Could not reach the grading service. Check your connection and press Retry." };
  }
  return { code: "LOCAL_ERROR", message: error.message || "Something went wrong." };
}
