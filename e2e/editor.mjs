// Editor + attachments test: validation errors, code blocks, Enter/Shift+Enter, Markdown output, locking.
import { chromium, MOCK_URL, waitForModelReady } from "./helpers.mjs";
const url = MOCK_URL;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
let step = "load";
page.on("console", (m) => ["error", "warning"].includes(m.type()) && errors.push(`[${step}] ${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
const fail = (msg) => {
  throw new Error(msg);
};
const file = (name, content) => ({ name, mimeType: "text/plain", buffer: Buffer.from(content) });
const expectAlert = (fragment) =>
  page.getByTestId("chat-area").getByRole("alert").getByText(fragment).first().waitFor({ timeout: 5000 });

await page.goto(url, { waitUntil: "networkidle" });
const editor = page.getByRole("textbox", { name: "Prompt" });
await editor.waitFor();
await waitForModelReady(page);

// 1. First message without code -> inline error
step = "1";
await editor.click();
await page.keyboard.type("Check the loop");
await page.keyboard.press("Enter");
await expectAlert("Add the student's code first");

// 2. File validation errors
step = "2";
const input = page.getByTestId("file-input");
await input.setInputFiles([
  file("main.py", "print('hi')\n"),
  file("report.pdf", "%PDF"),
  file("big.js", "x".repeat(60 * 1024)),
]);
await expectAlert('"report.pdf" is not a code file');
await expectAlert('"big.js" is 60 KB. Each file must be 50 KB or smaller.');
await input.setInputFiles([file("main.py", "print(2)\n")]);
await expectAlert('A file named "main.py" is already attached');
await input.setInputFiles(["a.js", "b.css", "c.html", "d.ts", "e.java"].map((n) => file(n, "// code\n")));
await expectAlert('at most 5 files per chat. "e.java" was not added');
const chips = page.getByLabel("Attached files").locator("span.inline-flex");
if ((await chips.count()) !== 5) fail(`expected 5 chips, got ${await chips.count()}`);
await page.getByRole("button", { name: "Remove d.ts" }).click();
if ((await chips.count()) !== 4) fail("remove chip failed");
await page.getByRole("button", { name: "Dismiss errors" }).click();

// 3. Code block via markdown shortcut, Tab indentation, Enter = newline inside block
step = "3";
await editor.click();
step = "3-select-all";
await page.keyboard.press("Control+a");
await page.keyboard.press("Backspace");
await page.keyboard.type("Check item 1");
await page.keyboard.press("Shift+Enter");
await page.keyboard.type("```python ");
await page.keyboard.type("def f():");
await page.keyboard.press("Enter");
step = "3-tab";
await page.keyboard.press("Tab");
await page.keyboard.type("return 1");
if (!(await page.locator(".tiptap-editor pre .hljs-keyword").count())) fail("no syntax highlighting");
const lang = await page.getByLabel("Code language").inputValue();
if (lang !== "python") fail(`language select is ${lang}`);
// leave the code block (arrow down at end creates a paragraph) and send
step = "3-arrowdown";
await page.keyboard.press("ArrowDown");
await page.keyboard.type("Thanks");
await page.keyboard.press("Enter");

// 4. Sent: message stored with fenced code, chat title from prompt, attach disabled
step = "4";
const userMsg = page.locator("[data-role=user]").first();
await userMsg.waitFor();
// rendered Markdown: paragraph + highlighted python code block with preserved indentation
await userMsg.locator("p", { hasText: "Check item 1" }).waitFor();
const code = await userMsg.locator("pre.tm-code code").innerText();
if (code !== "def f():\n  return 1") fail(`code block mismatch: ${JSON.stringify(code)}`);
if (!(await userMsg.locator("pre.tm-code .th-keyword").count())) fail("user code block not highlighted");
const storedMarkdown = await page.evaluate(async () => {
  const db = await new Promise((res) => {
    const r = indexedDB.open("hw");
    r.onsuccess = () => res(r.result);
  });
  const all = await new Promise((res) => {
    const r = db.transaction("messages").objectStore("messages").getAll();
    r.onsuccess = () => res(r.result);
  });
  db.close();
  return all.find((m) => m.role === "user")?.content;
});
const expected = "Check item 1\n\n```python\ndef f():\n  return 1\n```\n\nThanks";
if (storedMarkdown !== expected) fail(`markdown mismatch:\n${JSON.stringify(storedMarkdown)}\nexpected\n${JSON.stringify(expected)}`);
if ((await userMsg.getByLabel("Attached files").locator("span").filter({ hasText: /\.(py|js|css|html|java)$/ }).count()) < 1)
  fail("file chips not shown on message");
await page.getByRole("button", { name: "Check item 1", exact: true }).waitFor();
if (!(await page.getByRole("button", { name: "Attach code files" }).isDisabled())) fail("attach not disabled after first message");
await page.getByRole("button", { name: "Attach code files" }).locator("..").hover();
await page.getByRole("tooltip").getByText("Files can only be added at the start of a chat.").waitFor();

// 5. Follow-up message is allowed without code (after the answer finished streaming)
step = "5";
await page.getByRole("button", { name: "Send" }).waitFor({ timeout: 15000 });
await editor.click();
await page.keyboard.type("Item 2 is done in main.py line 1");
await page.keyboard.press("Enter");
await page.locator("[data-role=user]").nth(1).waitFor();
if (!page.url().includes("#")) fail("chat id not in url");

// 6. Reload: messages and files persisted
step = "6";
// IndexedDB writes are asynchronous (a few ms): wait until both user messages are stored.
await page.waitForFunction(async () => {
  const db = await new Promise((res) => {
    const r = indexedDB.open("hw");
    r.onsuccess = () => res(r.result);
  });
  const all = await new Promise((res) => {
    const r = db.transaction("messages").objectStore("messages").getAll();
    r.onsuccess = () => res(r.result);
  });
  db.close();
  return all.filter((m) => m.role === "user").length === 2;
});
await page.reload({ waitUntil: "networkidle" });
await page.locator("[data-role=user]").nth(1).waitFor();
await waitForModelReady(page);
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
  const out = { files: (await all("files")).map((f) => f.name).sort() };
  db.close();
  return out;
});
if (stored.files.join(",") !== "a.js,b.css,c.html,main.py") fail(`stored files ${stored.files}`);

await page.screenshot({ path: `${process.env.SHOTS ?? "/tmp"}/editor.png` });
await browser.close();
if (errors.length) fail(errors.join("\n"));
console.log("editor OK");
