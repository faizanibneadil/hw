import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Worker unit tests (workerd runtime via the Cloudflare Vitest plugin).
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      // Tests inject a mock model: never start the remote Workers AI binding (needs a Cloudflare login).
      remoteBindings: false,
      miniflare: {
        bindings: { TURNSTILE_SECRET_KEY: "test-secret" },
      },
    }),
  ],
  test: { include: ["worker/test/**/*.spec.ts"] },
});
