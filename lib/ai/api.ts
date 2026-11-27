// Contract of `POST /api/chat`, shared by the Next.js app and the Worker.
// Keep this file dependency-free and use relative imports only.

export const CHAT_API_PATH = "/api/chat";

/** Max request body (JSON) the Worker accepts. */
export const MAX_REQUEST_BYTES = 1024 * 1024;
/**
 * Max length of the formatted student code (`codeMessage`). 5 files x 50 KB plus code blocks from
 * the first message, with line numbers added, fits well below this.
 */
export const MAX_CODE_CHARS = 400_000;
/** Max number of UI messages in one request (the history is trimmed server-side anyway). */
export const MAX_MESSAGES = 200;
/** Turnstile tokens are at most 2048 characters. */
export const MAX_TURNSTILE_TOKEN_CHARS = 2048;

/** Response header with the epoch ms until which this browser does not need a new Turnstile token. */
export const VERIFIED_UNTIL_HEADER = "x-hw-verified-until";

/** Extra fields the client sends next to the AI SDK's `{ id, messages, trigger, messageId }`. */
export interface ChatRequestExtras {
  modelId: string;
  /** The chat's locked student code, formatted with `formatLockedCode`. */
  codeMessage: string;
  /** Omitted when the browser already holds a valid verification cookie. */
  turnstileToken?: string;
}

export const CHAT_ERROR_CODES = [
  "QUOTA_EXCEEDED",
  "RATE_LIMITED",
  "VERIFICATION_FAILED",
  "BAD_REQUEST",
  "UPSTREAM_ERROR",
] as const;

export type ChatErrorCode = (typeof CHAT_ERROR_CODES)[number];

/** JSON body of every error response from the Worker (and of mid-stream error chunks). */
export interface ChatErrorBody {
  code: ChatErrorCode;
  message: string;
}

export function isChatErrorBody(value: unknown): value is ChatErrorBody {
  if (!value || typeof value !== "object") return false;
  const { code, message } = value as Record<string, unknown>;
  return typeof message === "string" && CHAT_ERROR_CODES.includes(code as ChatErrorCode);
}

/** Workers AI free limits reset daily at 00:00 UTC: the next reset after `now`. */
export function nextQuotaReset(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}
