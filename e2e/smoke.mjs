// Smoke test: loads the static build on desktop + mobile and fails on console errors.
import { createRequire } from "node:module";

// Playwright is preinstalled globally (resolved through NODE_PATH via require).
const { chromium, devices } = createRequire(import.meta.url)("playwright");

const url = process.env.URL ?? "http://localhost:4173/";
const shots = process.env.SHOTS ?? "/tmp";
const browser = await chromium.launch();
const errors = [];

async function check(name, contextOptions, fn) {
  const ctx = await browser.newContext(contextOptions);
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`[${name}] ${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await fn(page);
  await page.screenshot({ path: `${shots}/${name}.png` });
  await ctx.close();
}

await check("desktop", { viewport: { width: 1280, height: 800 } }, async (page) => {
  await page.waitForSelector("[data-slot=resizable-handle]");
  const sidebar = await page.locator("#sidebar").boundingBox();
  if (!sidebar || sidebar.width < 150) throw new Error("sidebar not open on desktop");
});

await check("mobile", { ...devices["Pixel 7"], viewport: { width: 360, height: 740 } }, async (page) => {
  await page.getByRole("button", { name: "Open chats" }).waitFor();
  if (await page.locator("[data-slot=sheet-content]").count()) throw new Error("sheet open by default on mobile");
  await page.getByRole("button", { name: "Open chats" }).click();
  await page.locator("[data-slot=sheet-content]").waitFor();
  await page.keyboard.press("Escape");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) throw new Error("horizontal overflow at 360px");
});

await check("dark", { viewport: { width: 1280, height: 800 }, colorScheme: "dark" }, async (page) => {
  const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  if (!dark) throw new Error("system dark preference not applied");
});

await browser.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("smoke OK");
