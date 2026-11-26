import { createRequire } from "node:module";

/** Playwright is preinstalled globally (resolved through NODE_PATH via require). */
export const { chromium, devices } = createRequire(import.meta.url)("playwright");

export const BASE = process.env.URL ?? "http://localhost:4173/";
/** App URL with the test-only mock model (no model download needed). */
export const MOCK_URL = `${BASE}?e2e=mock&delay=1`;

/** Waits until the active model is ready (no progress / preparing status). */
export async function waitForModelReady(page) {
  await page.getByRole("button", { name: /^Model: .*Change model$/ }).waitFor();
  await page.getByRole("progressbar", { name: "Model progress" }).waitFor({ state: "detached" });
  await page.getByText(/^Preparing /).waitFor({ state: "detached" });
}
