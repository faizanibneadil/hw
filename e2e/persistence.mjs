// Persistence test: seeds IndexedDB, then checks the live sidebar, rename, delete (cascade) and reload.
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const url = process.env.URL ?? "http://localhost:4173/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("console", (m) => ["error", "warning"].includes(m.type()) && errors.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
const fail = (msg) => {
  throw new Error(msg);
};

await page.goto(url, { waitUntil: "networkidle" });
await page.getByText("No chats yet.").waitFor();

// Seed two chats (+ a message and file for chat "a") into the same stores the app uses.
await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open("hw");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = db.transaction(["chats", "messages", "files"], "readwrite");
  const now = Date.now();
  tx.objectStore("chats").put({ id: "a", title: "Older chat", createdAt: now - 1000, updatedAt: now - 1000, modelId: "m" }, "a");
  tx.objectStore("chats").put({ id: "b", title: "Newer chat", createdAt: now, updatedAt: now, modelId: "m" }, "b");
  tx.objectStore("messages").put({ id: "m1", chatId: "a", role: "user", content: "hi", createdAt: now, status: "done" }, "m1");
  tx.objectStore("files").put({ id: "f1", chatId: "a", name: "main.py", language: "python", content: "print(1)", size: 8 }, "f1");
  await new Promise((res) => (tx.oncomplete = res));
  db.close();
});
await page.reload({ waitUntil: "networkidle" });

const titles = async () => page.locator("nav[aria-label=Chats] li button[title]").allInnerTexts();
await page.getByText("Newer chat").waitFor();
const order = await titles();
if (order.join("|") !== "Newer chat|Older chat") fail(`wrong order: ${order}`);

// Open a chat
await page.getByRole("button", { name: "Older chat", exact: true }).click();
await page.getByTestId("chat-area").getByText("Older chat").waitFor();
if (!page.url().endsWith("#a")) fail("active chat not in hash");

// Rename
await page.getByRole("button", { name: "Options for Older chat" }).click();
await page.getByRole("menuitem", { name: "Rename" }).click();
await page.getByLabel("Chat name").fill("Renamed chat");
await page.getByRole("button", { name: "Save" }).click();
await page.getByTestId("chat-area").getByText("Renamed chat").waitFor();

// Delete (with confirmation) the open chat -> cascades
await page.getByRole("button", { name: "Options for Renamed chat" }).click();
await page.getByRole("menuitem", { name: "Delete" }).click();
await page.getByRole("alertdialog").waitFor();
await page.getByRole("button", { name: "Delete" }).click();
await page.getByText("Renamed chat").waitFor({ state: "detached" });
if (page.url().includes("#")) fail("deleted chat still active");

// Rename the remaining chat, reload, check persisted state
await page.getByRole("button", { name: "Options for Newer chat" }).click();
await page.getByRole("menuitem", { name: "Rename" }).click();
await page.getByLabel("Chat name").fill("Kept chat");
await page.getByLabel("Chat name").press("Enter");
await page.waitForTimeout(300);
await page.reload({ waitUntil: "networkidle" });
await page.getByText("Kept chat").waitFor();
const after = await titles();
if (after.join("|") !== "Kept chat") fail(`after reload: ${after}`);

const counts = await page.evaluate(async () => {
  const db = await new Promise((res) => {
    const r = indexedDB.open("hw");
    r.onsuccess = () => res(r.result);
  });
  const count = (s) =>
    new Promise((res) => {
      const r = db.transaction(s).objectStore(s).count();
      r.onsuccess = () => res(r.result);
    });
  const out = { chats: await count("chats"), messages: await count("messages"), files: await count("files") };
  db.close();
  return out;
});
if (counts.chats !== 1 || counts.messages !== 0 || counts.files !== 0) fail(`cascade failed: ${JSON.stringify(counts)}`);

await browser.close();
if (errors.length) fail(errors.join("\n"));
console.log("persistence OK", JSON.stringify(counts));
