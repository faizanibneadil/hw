/**
 * Turnstile Siteverify plus a short-lived signed cookie, so a teacher is verified once and not
 * challenged on every message (Turnstile tokens are single use and valid for 300 s).
 */

export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const VERIFIED_COOKIE = "hw_verified";
/** How long one successful verification is trusted. */
export const VERIFIED_TTL_SECONDS = 30 * 60;

export interface SiteverifyResult {
  success: boolean;
  "error-codes"?: string[];
  hostname?: string;
  action?: string;
}

export type VerifyTurnstile = (token: string, secret: string, remoteip: string | null) => Promise<SiteverifyResult>;

/** Calls Siteverify (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). */
export const siteverify: VerifyTurnstile = async (token, secret, remoteip) => {
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (remoteip) form.append("remoteip", remoteip);
  form.append("idempotency_key", crypto.randomUUID());
  try {
    const response = await fetch(SITEVERIFY_URL, { method: "POST", body: form });
    if (!response.ok) return { success: false, "error-codes": [`http-${response.status}`] };
    return (await response.json()) as SiteverifyResult;
  } catch {
    return { success: false, "error-codes": ["internal-error"] };
  }
};

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  let text = "";
  for (const byte of new Uint8Array(bytes)) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  // The cookie key is derived from the Turnstile secret, so no extra secret has to be managed.
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`hw-verified-cookie-v1:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

/** Epoch ms until which the request's verification cookie is valid, or null. */
export async function verifiedUntil(request: Request, secret: string, now: number): Promise<number | null> {
  const value = readCookie(request, VERIFIED_COOKIE);
  const match = value ? /^v1\.(\d{10,16})\.([A-Za-z0-9_-]+)$/.exec(value) : null;
  if (!match) return null;
  const expires = Number(match[1]);
  if (!(expires > now) || expires > now + VERIFIED_TTL_SECONDS * 1000 + 60_000) return null;
  const expected = await hmac(secret, `v1.${expires}`);
  return timingSafeEqual(expected, match[2]) ? expires : null;
}

/** A `Set-Cookie` value for a fresh verification, and until when it is valid. */
export async function createVerifiedCookie(secret: string, now: number, secure: boolean) {
  const expires = now + VERIFIED_TTL_SECONDS * 1000;
  const value = `v1.${expires}.${await hmac(secret, `v1.${expires}`)}`;
  const attributes = [`Max-Age=${VERIFIED_TTL_SECONDS}`, "Path=/api", "HttpOnly", "SameSite=Strict"];
  if (secure) attributes.push("Secure");
  return { expires, header: `${VERIFIED_COOKIE}=${value}; ${attributes.join("; ")}` };
}
