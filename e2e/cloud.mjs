// Cloud mode (default): grading through a mocked `POST /api/chat` (no real Cloudflare calls),
// with zero model downloads; typed API errors; switching to Offline mode and back.
import { chromium, BASE, CLOUD_URL, mockChatApi, mockTurnstile } from "./helpers.mjs";

const browser = await chromium.launch();
const errors = [];
const fail = (msg) => {
  throw new Error(msg);
};
const ANSWER = [
  "## Result",
  "| What was checked | Marks | Why |",
  "|---|---|---|",
  "| add works | 2 / 2 | main.py:2 |",
  "| has tests | 0 / 2 | no tests |",
  "",
  "**Total: 2 / 4**",
  "",
  "### How the marks were given",
  "Cloud answer.",
  "",
  "### Improvements",
  "- Add tests.",
].join("\n");
const MODEL_DOWNLOAD = /huggingface\.co|hf\.co\/|cdn\.jsdelivr\.net|\.onnx(\?|$)|\.wasm(\?|$)|ort\.webgpu|llm\.worker|cache\.worker/;

async function newPage(label, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage();
  const downloads = [];
  page.on("request", (r) => MODEL_DOWNLOAD.test(r.url()) && downloads.push(r.url()));
  page.on("worker", (w) => downloads.push(`worker:${w.url()}`));
  // The transformers.js / @browser-ai code must be lazy-loaded (only in Offline mode).
  page.on("response", async (r) => {
    if (!r.url().endsWith(".js")) return;
    const body = await r.text().catch(() => "");
    if (/TransformersJSLanguageModel|huggingface\.co/.test(body)) downloads.push(`local inference code: ${r.url()}`);
  });
  page.on("pageerror", (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    // Expected: Chromium logs failed (mocked 4xx) responses.
    if (["error", "warning"].includes(m.type()) && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) {
      errors.push(`[${label}] ${m.type()}: ${m.text()}`);
    }
  });
  await mockTurnstile(page);
  return { page, context, downloads };
}

async function sendFirstMessage(page, text = "Check: 1) add works (2 marks) 2) has tests (2 marks)") {
  await page.getByTestId("file-input").setInputFiles([
    { name: "main.py", mimeType: "text/plain", buffer: Buffer.from("def add(a, b):\n    return a + b\n") },
  ]);
  await page.getByRole("textbox", { name: "Prompt" }).click();
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}

async function send(page, text) {
  await page.getByRole("textbox", { name: "Prompt" }).click();
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}

const assistants = (page) => page.locator("[data-role=assistant]");
const alert = (page) => page.getByTestId("chat-area").getByRole("alert");

// 1. Fresh profile, real URL (no test flags): streamed answer, no model download at all
{
  const { page, context, downloads } = await newPage("1");
  const requests = await mockChatApi(page, () => ({ text: ANSWER }));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Model: GLM 4.7 Flash. Change model" }).waitFor();
  if (await page.getByRole("progressbar").count()) fail("cloud mode shows a model download");
  await sendFirstMessage(page);
  await assistants(page).first().getByText("Improvements").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Send" }).waitFor();
  const first = assistants(page).first();
  if ((await first.locator("table tbody tr").count()) !== 2) fail("streamed table not rendered");
  const body = requests[0];
  if (body.modelId !== "@cf/zai-org/glm-4.7-flash") fail(`default model: ${body.modelId}`);
  if (!body.codeMessage.includes("### File: main.py") || !body.codeMessage.includes("2 |     return a + b")) fail("code not sent");
  if (!body.turnstileToken?.startsWith("test-token-")) fail("no Turnstile token on the first request");
  if (body.messages.length !== 1 || body.messages[0].role !== "user") fail("messages not sent");
  if (JSON.stringify(body).includes("You are hw")) fail("system prompt must be added server-side");

  // Follow-up: verified by the cookie -> no new token; history included
  await send(page, "item 2 is done");
  await assistants(page).nth(1).getByText("Improvements").waitFor({ timeout: 15000 });
  if (requests[1].turnstileToken) fail("token sent although the browser is still verified");
  if (requests[1].messages.length !== 3) fail(`follow-up history: ${requests[1].messages.length}`);

  // Model picker: privacy note, pick Gemma, persisted across reloads
  await page.getByRole("button", { name: /Change model/ }).click();
  await page.getByText("Cloud mode sends the student's code to Cloudflare").waitFor();
  await page.getByRole("button", { name: /^Gemma 4 26B/ }).click();
  await page.getByRole("button", { name: "Model: Gemma 4 26B. Change model" }).waitFor();
  await send(page, "again");
  await assistants(page).nth(2).getByText("Improvements").waitFor({ timeout: 15000 });
  if (requests[2].modelId !== "@cf/google/gemma-4-26b-a4b-it") fail(`picked model not sent: ${requests[2].modelId}`);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Model: Gemma 4 26B. Change model" }).waitFor();
  if ((await assistants(page).count()) !== 3) fail("messages not restored from IndexedDB");

  await page.waitForTimeout(300);
  if (downloads.length) fail(`model downloads in cloud mode:\n${downloads.join("\n")}`);
  await context.close();
}

// 2. QUOTA_EXCEEDED: reset time (local + UTC), "Switch to Offline mode" (confirmed, never automatic) + resend
{
  const { page, context, downloads } = await newPage("2", { timezoneId: "Europe/Berlin", locale: "en-US" });
  const requests = await mockChatApi(page, () => ({
    status: 429,
    json: { code: "QUOTA_EXCEEDED", message: "The daily free Workers AI allocation is used up." },
  }));
  await page.goto(`${CLOUD_URL}&delay=20`);
  await sendFirstMessage(page);
  await alert(page).getByText("Today's free cloud grading is used up").waitFor();
  const text = await alert(page).innerText();
  // Berlin is UTC+1 in winter: the reset is shown in local time and in UTC.
  if (!/resets at \w{3}, 1:00\sAM GMT\+1 \(00:00 UTC\)/.test(text)) fail(`no reset time: ${text}`);
  const code = await page.evaluate(() => document.querySelector("[data-error-code]")?.getAttribute("data-error-code"));
  if (code !== "QUOTA_EXCEEDED") fail(`error code: ${code}`);
  // Cancel: nothing changes, nothing downloads
  await alert(page).getByRole("button", { name: "Switch to Offline mode" }).click();
  await page.getByRole("alertdialog").getByText("Turn on Offline mode?").waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(300);
  if (await page.getByText(/Downloading Qwen/).count()) fail("downloaded without confirmation");
  if (downloads.length) fail("model requested before confirmation");
  // Confirm: Offline mode downloads the (mock) model and resends the same message
  await alert(page).getByRole("button", { name: "Switch to Offline mode" }).click();
  await page.getByRole("button", { name: "Download and turn on" }).click();
  await page.getByRole("button", { name: "Model: Qwen2.5 Coder 0.5B. Change model" }).waitFor();
  await assistants(page).first().getByText("Improvements").waitFor({ timeout: 15000 });
  const answer = await assistants(page).first().innerText();
  if (!answer.includes("mock systems=2 files=main.py turns=1")) fail(`offline resend wrong: ${answer}`);
  if (requests.length !== 1) fail("the resend went to the cloud again");
  if ((await page.getByTestId("chat-area").locator("[data-role=user]").count()) !== 1) fail("message duplicated");
  await context.close();
}

// 3. RATE_LIMITED and VERIFICATION_FAILED messages; Retry sends the same message again
{
  const { page, context } = await newPage("3");
  const responses = [
    { status: 429, json: { code: "RATE_LIMITED", message: "Too many requests." } },
    { status: 403, json: { code: "VERIFICATION_FAILED", message: "Verification failed." } },
    { text: ANSWER },
  ];
  const requests = await mockChatApi(page, (_, i) => responses[i]);
  await page.goto(CLOUD_URL);
  await sendFirstMessage(page);
  await alert(page).getByText("Too many requests in a short time").waitFor();
  if (await alert(page).getByRole("button", { name: "Switch to Offline mode" }).count()) fail("offline offered for rate limit");
  await alert(page).getByRole("button", { name: "Retry" }).click();
  await alert(page).getByText("We could not confirm this browser is not a bot").waitFor();
  await alert(page).getByRole("button", { name: "Retry" }).click();
  await assistants(page).first().getByText("Improvements").waitFor({ timeout: 15000 });
  if (requests.length !== 3) fail(`requests: ${requests.length}`);
  if (requests[2].messages.length !== 1) fail("retry did not resend the same message");
  if (!requests[2].turnstileToken) fail("no fresh token after a failed verification");
  await context.close();
}

// 4. Offline mode toggle: off by default, confirm, existing local flow; switching back keeps the chat
{
  const { page, context, downloads } = await newPage("4");
  const requests = await mockChatApi(page, () => ({ text: ANSWER }));
  await page.goto(`${CLOUD_URL}&delay=60`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Change model/ }).click();
  const toggle = page.getByRole("switch", { name: "Offline / Private mode" });
  if ((await toggle.getAttribute("aria-checked")) !== "false") fail("offline mode on by default");
  await toggle.click();
  await page.getByRole("button", { name: "Download and turn on" }).click();
  await page.getByText("Downloading Qwen2.5 Coder 0.5B").waitFor();
  await page.getByRole("progressbar", { name: "Model progress" }).waitFor();
  await page.getByText("Downloading Qwen2.5 Coder 0.5B").waitFor({ state: "detached", timeout: 10000 });
  await sendFirstMessage(page);
  await assistants(page).first().getByText("mock systems=2").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Send" }).waitFor();
  if (requests.length) fail("offline mode called the cloud API");
  // privacy note in offline mode, then back to cloud
  await page.getByRole("button", { name: /Change model/ }).click();
  await page.getByText("The student's code stays in this browser").waitFor();
  await page.getByRole("switch", { name: "Offline / Private mode" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Model: GLM 4.7 Flash. Change model" }).waitFor();
  await send(page, "follow-up in the cloud");
  await assistants(page).nth(1).getByText("Cloud answer.").waitFor({ timeout: 15000 });
  if (requests.length !== 1 || requests[0].messages.length !== 3) fail("chat lost when switching modes");
  // the setting persists per browser
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Model: GLM 4.7 Flash. Change model" }).waitFor();
  if ((await assistants(page).count()) !== 2) fail("messages lost after reload");
  if (downloads.length) fail(`unexpected downloads with the mock model: ${downloads}`);
  await context.close();
}

await browser.close();
if (errors.length) fail(errors.join("\n"));
console.log("cloud OK");
