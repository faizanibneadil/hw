/**
 * Cloudflare Turnstile for `POST /api/chat`.
 *
 * Tokens are single use and valid for 300 s, so the Worker verifies a token once and then sets a
 * short-lived signed cookie. While that cookie is valid (the Worker reports until when in the
 * `x-hw-verified-until` header) requests carry no token and the teacher is not challenged again.
 */

/** Cloudflare's official "always passes, invisible" test site key (used when none is configured). */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000BB";
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || TURNSTILE_TEST_SITE_KEY;
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** Ask for a fresh token this long before the verification cookie expires. */
const EXPIRY_MARGIN_MS = 15_000;
/** How long a request waits for a token (covers an interactive challenge). */
const TOKEN_TIMEOUT_MS = 60_000;

interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  appearance?: "always" | "execute" | "interaction-only";
  "refresh-expired"?: "auto" | "manual" | "never";
  callback?: (token: string) => void;
  "error-callback"?: (code: string) => boolean | void;
  "expired-callback"?: () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load")));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile could not be loaded"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

class TurnstileManager {
  private widgetId: string | null = null;
  private api: TurnstileApi | null = null;
  private token: string | null = null;
  private waiters: ((token: string | undefined) => void)[] = [];
  private verifiedUntil = 0;
  private mountId = 0;
  /** The widget's last token was used; it needs a reset to produce another one. */
  private needsReset = false;

  /** Renders the (normally invisible) widget into `container`. Returns an unmount function. */
  mount(container: HTMLElement): () => void {
    const id = ++this.mountId;
    void loadScript()
      .then((api) => {
        if (id !== this.mountId) return;
        this.api = api;
        this.widgetId =
          api.render(container, {
            sitekey: TURNSTILE_SITE_KEY,
            action: "chat",
            appearance: "interaction-only",
            "refresh-expired": "auto",
            callback: (token) => this.receive(token),
            "expired-callback": () => {
              this.token = null;
            },
            "error-callback": () => {
              this.token = null;
              this.flush(undefined);
              return true;
            },
          }) ?? null;
      })
      .catch(() => this.flush(undefined));
    return () => {
      if (id !== this.mountId) return;
      this.mountId++;
      if (this.widgetId && this.api) this.api.remove(this.widgetId);
      this.widgetId = null;
      this.token = null;
      this.needsReset = false;
    };
  }

  private receive(token: string) {
    if (this.waiters.length) {
      this.needsReset = true;
      this.flush(token);
    } else this.token = token;
  }

  private flush(token: string | undefined) {
    const waiters = this.waiters;
    this.waiters = [];
    waiters.forEach((resolve) => resolve(token));
  }

  isVerified(now = Date.now()) {
    return now < this.verifiedUntil - EXPIRY_MARGIN_MS;
  }

  /** Called with the Worker's `x-hw-verified-until` header. */
  setVerifiedUntil(until: number) {
    if (Number.isFinite(until)) this.verifiedUntil = until;
  }

  /** The server rejected verification: forget the cookie state and get a new token next time. */
  invalidate() {
    this.verifiedUntil = 0;
    this.token = null;
    this.needsReset = false;
    if (this.widgetId && this.api) this.api.reset(this.widgetId);
  }

  /**
   * A token for the next request, or undefined when the browser is still verified (or no token
   * could be obtained; the Worker then answers VERIFICATION_FAILED and the chat shows Retry).
   */
  async getToken(): Promise<string | undefined> {
    if (this.isVerified()) return undefined;
    if (this.token) {
      const token = this.token;
      this.token = null; // single use
      this.needsReset = true;
      return token;
    }
    // The last token was used: ask the widget for a new one (otherwise it is still running).
    if (this.needsReset && this.widgetId && this.api) {
      this.needsReset = false;
      this.api.reset(this.widgetId);
    }
    return new Promise<string | undefined>((resolve) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== done);
        resolve(undefined);
      }, TOKEN_TIMEOUT_MS);
      const done = (token: string | undefined) => {
        clearTimeout(timer);
        resolve(token);
      };
      this.waiters.push(done);
    });
  }
}

export const turnstile = new TurnstileManager();
