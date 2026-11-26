// Regression checks for code-review findings: unknown chat ids, leaving/deleting a streaming chat,
// model switching while busy, scroll pinning, no duplicated code in model history.
import { chromium, MOCK_URL as BASE_MOCK_URL, waitForModelReady } from "./helpers.mjs";

const MOCK_URL = `${BASE_MOCK_URL}&wordDelay=70`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 420 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => ["error", "warning"].includes(m.type()) && errors.push(`${m.type()}: ${m.text()}`));
const fail = (msg) => {
  throw new Error(msg);
};
const editor = page.getByRole("textbox", { name: "Prompt" });
const dbDump = () =>
  page.evaluate(async () => {
    const db = await new Promise((res) => {
      const r = indexedDB.open("hw");
      r.onsuccess = () => res(r.result);
    });
    const all = (s) =>
      new Promise((res) => {
        const r = db.transaction(s).objectStore(s).getAll();
        r.onsuccess = () => res(r.result);
      });
    const out = { chats: await all("chats"), messages: await all("messages") };
    db.close();
    return out;
  });
async function firstMessage(text) {
  await editor.click();
  await page.keyboard.type("```js ");
  await page.keyboard.type("let a = 1;");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}

await page.goto(MOCK_URL);
await waitForModelReady(page);

// A: model switching is locked while generating
await firstMessage("Chat A");
await page.getByRole("button", { name: "Stop generating" }).waitFor();
await page.getByRole("button", { name: /Change model/ }).click();
await page.getByText("Stop the current answer to switch models").waitFor();
await page.keyboard.press("Escape");

// B: scrolling up while streaming is respected (small viewport -> content overflows)
const scroller = page.locator("[data-testid=chat-area] > div.overflow-y-auto");
await page.locator("[data-role=assistant] table").waitFor();
await scroller.evaluate(
  (el) =>
    new Promise((resolve) => {
      const check = () => (el.scrollHeight > el.clientHeight + 50 ? resolve() : requestAnimationFrame(check));
      check();
    }),
);
if (!(await page.getByRole("button", { name: "Stop generating" }).isVisible())) fail("stream ended before overflow; scroll test invalid");
const box = await scroller.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + 40);
await page.mouse.wheel(0, -3000);
await page.waitForTimeout(150);
const top = await scroller.evaluate((el) => el.scrollTop);
await page.waitForTimeout(500); // more tokens arrive meanwhile
if (!(await page.getByRole("button", { name: "Stop generating" }).isVisible())) fail("stream ended too early for the scroll test");
const after = await scroller.evaluate((el) => el.scrollTop);
if (after > top + 5) fail(`view was pulled back to the bottom while scrolled up (${top} -> ${after})`);
await page.getByRole("button", { name: "Send" }).waitFor({ timeout: 15000 });
const chatA = page.url().split("#")[1];

// C: leaving a streaming chat stops it (saved as stopped)
await page.getByRole("button", { name: "New chat" }).click();
await firstMessage("Chat B");
await page.locator("[data-role=assistant]").first().waitFor();
await page.getByRole("button", { name: "Chat A", exact: true }).click();
await page.getByRole("button", { name: "Chat B", exact: true }).click();
await page.locator("[data-role=assistant]").getByText("Stopped").waitFor();

// D: deleting a streaming chat leaves no orphan messages
await editor.click();
await page.keyboard.type("again");
await page.keyboard.press("Enter");
await page.getByRole("button", { name: "Stop generating" }).waitFor();
const chatB = page.url().split("#")[1];
await page.getByRole("button", { name: "Options for Chat B" }).click();
await page.getByRole("menuitem", { name: "Delete" }).click();
await page.getByRole("button", { name: "Delete" }).click();
await page.waitForTimeout(2500);
let db = await dbDump();
if (db.messages.some((m) => m.chatId === chatB)) fail("orphan messages for deleted chat");

// E: Back to the deleted chat's URL and send -> a real chat is created (not orphaned)
await page.goto(`${MOCK_URL}#${chatB}`);
await waitForModelReady(page);
await firstMessage("Chat C");
await page.getByRole("button", { name: "Chat C", exact: true }).waitFor();
await page.getByRole("button", { name: "Send" }).waitFor({ timeout: 15000 });
db = await dbDump();
const chatIds = new Set(db.chats.map((c) => c.id));
if (db.messages.some((m) => !chatIds.has(m.chatId))) fail("messages without a chat");
if (!chatIds.has(chatA)) fail("chat A missing");

await browser.close();
if (errors.length) fail(errors.join("\n"));
console.log("regressions OK");
