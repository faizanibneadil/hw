// AI chat flow with the test-only mock model (`?e2e=mock`): model download/selector, streaming,
// stop, follow-ups with locked code, persistence, cache detection, WebGPU fallback, errors.
import { chromium, BASE } from "./helpers.mjs";

const base = BASE;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
const errors = [];
let step = "load";
page.on("console", (m) => ["error", "warning"].includes(m.type()) && errors.push(`[${step}] ${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`[${step}] pageerror: ${e.message}`));
const fail = (msg) => {
  throw new Error(msg);
};
const SMALL = "Qwen2.5 Coder 0.5B";
const LARGE = "Qwen2.5 Coder 1.5B";
const editor = page.getByRole("textbox", { name: "Prompt" });
const assistants = page.locator("[data-role=assistant]");

// 1. Auto-download of the smallest model with visible progress
step = "1";
await page.goto(`${base}?e2e=mock&mode=local&delay=120`);
await page.getByText(`Downloading ${SMALL}`).waitFor();
await page.getByRole("progressbar", { name: "Model progress" }).waitFor();
// sending is blocked while loading
await editor.click();
await page.keyboard.type("```py ");
await page.keyboard.type("print(1)");
await page.getByRole("button", { name: "Send" }).click();
await page.getByText("The offline model is still loading").waitFor();
await page.getByText(`Downloading ${SMALL}`).waitFor({ state: "detached", timeout: 10000 });

// 2. Selector: large model disabled until downloaded, download shows progress, then selectable
step = "2";
await page.getByRole("button", { name: /Change model/ }).click();
const largeOption = page.getByRole("button", { name: new RegExp(`^${LARGE}`) });
if (!(await largeOption.isDisabled())) fail("not-downloaded model should be disabled");
await largeOption.getByText("Not downloaded").waitFor();
await page.getByRole("button", { name: `Download ${LARGE}` }).click();
await page.getByRole("progressbar", { name: `${LARGE} progress` }).waitFor();
if (!(await largeOption.isDisabled())) fail("downloading model should be disabled");
await largeOption.getByText("Downloaded").waitFor({ timeout: 10000 });
await largeOption.click();
await page.getByRole("button", { name: `Model: ${LARGE}. Change model` }).waitFor();
await page.getByText(`Loading ${LARGE}`).waitFor({ state: "detached", timeout: 10000 });
// back to the small model
await page.getByRole("button", { name: /Change model/ }).click();
await page.getByRole("button", { name: new RegExp(`^${SMALL}`) }).click();
await page.getByRole("button", { name: `Model: ${SMALL}. Change model` }).waitFor();
await page.getByText(`Loading ${SMALL}`).waitFor({ state: "detached", timeout: 10000 });

// 3. First message: file + code block + instructions -> streamed result with locked code
step = "3";
await page.getByTestId("file-input").setInputFiles([
  { name: "main.py", mimeType: "text/plain", buffer: Buffer.from("def add(a, b):\n    return a + b\n") },
]);
await editor.click();
await page.keyboard.press("End");
await page.keyboard.press("ArrowDown");
await page.keyboard.type("Check: 1) add works (2 marks) 2) has tests (2 marks)");
await page.keyboard.press("Enter");
await page.getByRole("button", { name: "Stop generating" }).waitFor();
// streams live: the table is rendered while the answer is still being generated
await assistants.first().locator("table tbody tr").first().waitFor();
if (!(await page.getByRole("button", { name: "Stop generating" }).isVisible())) fail("table only appeared after streaming");
await assistants.first().getByText("Improvements").waitFor({ timeout: 15000 });
await page.getByRole("button", { name: "Send" }).waitFor();
const first = assistants.first();
if ((await first.locator("h2").innerText()) !== "Result") fail("no Result heading");
if ((await first.locator("table thead th").allInnerTexts()).join("|") !== "What was checked|Marks|Why") fail("table header wrong");
if ((await first.locator("table tbody tr").count()) !== 2) fail("table rows wrong");
if ((await first.locator("strong").first().innerText()) !== "Total: X / 4") fail("total not bold");
if ((await first.locator("ul li").count()) !== 2) fail("improvements list wrong");
let text = await first.innerText();
if (!text.includes("mock systems=2 files=main.py,snippet-1 turns=1 history=1 fencesInHistory=false")) fail(`first answer context wrong:\n${text}`);
// copy puts the raw Markdown on the clipboard
await page.getByRole("button", { name: "Copy result" }).first().click();
await page.getByRole("button", { name: "Copied" }).waitFor();
const clip = await page.evaluate(() => navigator.clipboard.readText());
if (!clip.startsWith("## Result\n| What was checked | Marks | Why |")) fail(`clipboard: ${clip.slice(0, 80)}`);

// 4. Follow-up correction uses the same locked code and the history
step = "4";
await editor.click();
await page.keyboard.type("item 2 is actually done in main.py line 12");
await page.keyboard.press("Enter");
await assistants.nth(1).getByText("Improvements").waitFor({ timeout: 15000 });
text = await assistants.nth(1).innerText();
const row2 = await assistants.nth(1).locator("table tbody tr").nth(1).locator("td").allInnerTexts();
if (row2.join("|") !== "Item 2|2 / 2|follow-up aware") fail(`follow-up correction ignored: ${row2}`);
if (!text.includes("files=main.py,snippet-1 turns=2 history=3 fencesInHistory=false")) fail(`follow-up context wrong:\n${text}`);

// 5. Stop while streaming
step = "5";
await editor.click();
await page.keyboard.type("Again please");
await page.keyboard.press("Enter");
await assistants.nth(2).getByText("Result").waitFor();
await page.getByRole("button", { name: "Stop generating" }).click();
await assistants.nth(2).getByText("Stopped").waitFor();
const stoppedLen = (await assistants.nth(2).innerText()).length;
await page.waitForTimeout(400);
if ((await assistants.nth(2).innerText()).length !== stoppedLen) fail("still streaming after stop");

// 6. Reload: models detected as downloaded (no download), messages restored with statuses
step = "6";
const chatUrl = page.url();
await page.goto(chatUrl);
await assistants.nth(2).getByText("Stopped").waitFor();
if ((await assistants.count()) !== 3) fail(`expected 3 assistant messages, got ${await assistants.count()}`);
if (await page.getByText(`Downloading ${SMALL}`).count()) fail("cached model downloaded again");
await page.getByText(`Loading ${SMALL}`).waitFor({ state: "detached", timeout: 10000 });
await page.getByRole("button", { name: /Change model/ }).click();
if (await page.getByRole("button", { name: new RegExp(`^${LARGE}`) }).isDisabled()) fail("downloaded model not detected after reload");
await page.keyboard.press("Escape");
if (!(await page.getByRole("button", { name: "Attach code files" }).isDisabled())) fail("attach enabled in existing chat");
const stored = await page.evaluate(async () => {
  const db = await new Promise((res) => {
    const r = indexedDB.open("hw");
    r.onsuccess = () => res(r.result);
  });
  const all = (s) =>
    new Promise((res) => {
      const r = db.transaction(s).objectStore(s).getAll();
      r.onsuccess = () => res(r.result);
    });
  const messages = (await all("messages")).sort((a, b) => a.createdAt - b.createdAt).map((m) => `${m.role}:${m.status}`);
  const chats = (await all("chats")).map((c) => c.modelId);
  db.close();
  return { messages, chats };
});
if (stored.messages.join(",") !== "user:done,assistant:done,user:done,assistant:done,user:done,assistant:stopped")
  fail(`stored messages: ${stored.messages}`);
if (!stored.chats[0]?.includes("0.5B")) fail(`chat modelId: ${stored.chats}`);

// 7. No WebGPU: notice + large model disabled
step = "7";
const p2 = await context.newPage();
p2.on("pageerror", (e) => errors.push(`[7] pageerror: ${e.message}`));
await p2.goto(`${base}?e2e=mock&mode=local&webgpu=0&delay=10`);
await p2.getByText("WebGPU is not available in this browser").waitFor();
await p2.getByRole("button", { name: /Change model/ }).click();
await p2.getByRole("button", { name: new RegExp(`^${LARGE}`) }).getByText("Needs WebGPU").waitFor();
if (await p2.getByRole("button", { name: `Download ${LARGE}` }).count()) fail("download offered without WebGPU");
await p2.close();

// 8. Download failure -> clear error + retry
step = "8";
const p3 = await browser.newPage();
p3.on("pageerror", (e) => errors.push(`[8] pageerror: ${e.message}`));
await p3.goto(`${base}?e2e=mock&mode=local&fail=onnx-community/Qwen2.5-Coder-0.5B-Instruct`);
await p3.getByText(`Could not load ${SMALL}: Mock download failed`).waitFor();
await p3.getByRole("button", { name: "Retry" }).first().waitFor();
await p3.close();

await page.screenshot({ path: `${process.env.SHOTS ?? "/tmp"}/chat.png` });
await browser.close();
if (errors.length) fail(errors.join("\n"));
console.log("chat OK");
