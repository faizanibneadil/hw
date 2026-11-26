// Real model path (Transformers.js in a Web Worker), with the Hugging Face Hub blocked by the test:
// the app must show a clear error with Retry, and Retry must try again.
import { chromium, BASE } from "./helpers.mjs";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  const text = m.text();
  // Expected: the provider's worker logs the failed fetch; Chromium logs a missing GPU adapter.
  if (m.type() === "error" && !/Error in worker load|Failed to load resource/.test(text)) errors.push(`console: ${text}`);
});
const fail = (msg) => {
  throw new Error(msg);
};

let hubRequests = 0;
await page.route(/^https:\/\/(huggingface\.co|cdn\.jsdelivr\.net)\//, (route) => {
  hubRequests++;
  return route.abort("connectionrefused");
});

await page.goto(BASE, { waitUntil: "load" });
await page.getByText(/^Could not load Qwen2\.5 Coder 0\.5B: /).waitFor({ timeout: 60000 });
if (hubRequests === 0) fail("the model worker never tried to download the model");
const before = hubRequests;
await page.getByRole("button", { name: "Retry" }).first().click();
await page.getByText(/^Could not load Qwen2\.5 Coder 0\.5B: /).waitFor({ timeout: 60000 });
if (hubRequests <= before) fail("Retry did not try to download again");

await browser.close();
if (errors.length) fail(errors.join("\n"));
console.log(`real-model OK (hub requests: ${hubRequests})`);
