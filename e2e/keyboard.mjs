// Keyboard-only usage: send, model selector, rename/delete, resize handle, visible focus.
import { chromium, MOCK_URL, waitForModelReady } from "./helpers.mjs";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const fail = (msg) => {
  throw new Error(msg);
};
const focused = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    return { label: el?.getAttribute("aria-label") ?? el?.textContent?.trim().slice(0, 40), tag: el?.tagName };
  });
async function tabTo(predicate, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const f = await focused();
    if (predicate(f)) return f;
  }
  fail("could not reach element with Tab");
}
async function assertVisibleFocus() {
  const ring = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return cs.boxShadow !== "none" || (cs.outlineStyle !== "none" && cs.outlineWidth !== "0px");
  });
  if (!ring) fail(`no visible focus indicator on ${JSON.stringify(await focused())}`);
}

await page.goto(MOCK_URL);
await waitForModelReady(page);

// Tab into the editor, write the first message with a code block, send with Enter
await page.locator("body").press("Tab");
await assertVisibleFocus(); // first stop: New chat
await tabTo((f) => f.label === "Prompt");
await page.keyboard.type("Check it");
await page.keyboard.press("Shift+Enter");
await page.keyboard.type("```js ");
await page.keyboard.type("let a = 1;");
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Enter");
await page.locator("[data-role=assistant]").getByText("Improvements").waitFor({ timeout: 15000 });
await page.getByRole("button", { name: "Send" }).waitFor();

// Model selector: open with Enter, reach Download with Tab, Escape closes and restores focus
await page.getByRole("textbox", { name: "Prompt" }).focus();
await tabTo((f) => /Change model/.test(f.label ?? ""));
await assertVisibleFocus();
await page.keyboard.press("Enter");
await page.getByRole("list", { name: "Models" }).waitFor();
await tabTo((f) => /^Download /.test(f.label ?? ""), 6);
await assertVisibleFocus();
await page.keyboard.press("Escape");
await page.getByRole("list", { name: "Models" }).waitFor({ state: "detached" });
if (!/Change model/.test((await focused()).label ?? "")) fail("focus not restored to model button");

// Sidebar: options menu -> Rename via keyboard
await page.getByRole("button", { name: "New chat" }).focus();
await tabTo((f) => /^Options for /.test(f.label ?? ""));
await assertVisibleFocus();
await page.keyboard.press("Enter");
await page.getByRole("menuitem", { name: "Rename" }).waitFor();
await page.keyboard.press("Enter");
await page.getByLabel("Chat name").waitFor();
await page.keyboard.press("Control+a");
await page.keyboard.type("Keyboard chat");
await page.keyboard.press("Enter");
await page.getByRole("button", { name: "Keyboard chat", exact: true }).waitFor();

// Delete via keyboard: menu -> Delete -> confirm dialog (focus trapped), Escape cancels
await page.getByRole("button", { name: "Options for Keyboard chat" }).focus();
await page.keyboard.press("Enter");
await page.getByRole("menuitem", { name: "Delete" }).waitFor();
// Radix focuses the menu a frame after opening; wait for that before navigating.
await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menuitem" || document.activeElement?.getAttribute("role") === "menu");
for (let i = 0; i < 4 && (await focused()).label !== "Delete"; i++) {
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(50);
}
if ((await focused()).label !== "Delete") fail(`expected Delete focused, got ${JSON.stringify(await focused())}`);
await page.keyboard.press("Enter");
await page.getByRole("alertdialog").waitFor();
const inDialog = await page.evaluate(() => !!document.activeElement?.closest("[role=alertdialog]"));
if (!inDialog) fail("focus not moved into delete dialog");
await page.keyboard.press("Escape");
await page.getByRole("alertdialog").waitFor({ state: "detached" });
await page.getByRole("button", { name: "Keyboard chat", exact: true }).waitFor();

// Resize handle is focusable and resizes with arrow keys
const handle = page.locator("[data-slot=resizable-handle]");
const before = (await page.locator("#sidebar").boundingBox()).width;
await handle.focus();
for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
const after = (await page.locator("#sidebar").boundingBox()).width;
if (!(after > before)) fail(`resize with keyboard failed ${before} -> ${after}`);

await browser.close();
if (errors.length) fail(errors.join("\n"));
console.log("keyboard OK");
