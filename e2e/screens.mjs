// Visual check: a finished chat in light + dark mode on desktop and mobile (writes screenshots).
import { chromium, MOCK_URL, waitForModelReady } from "./helpers.mjs";

const out = process.env.SHOTS ?? "/tmp";
const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  for (const [name, opts] of [
    ["desktop", { viewport: { width: 1280, height: 900 } }],
    ["mobile", { viewport: { width: 360, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ]) {
    const page = await browser.newPage({ ...opts, colorScheme: scheme });
    await page.goto(MOCK_URL);
    await waitForModelReady(page);
    await page.getByTestId("file-input").setInputFiles([
      { name: "main.py", mimeType: "text/plain", buffer: Buffer.from("def add(a, b):\n    return a + b\n") },
    ]);
    const editor = page.getByRole("textbox", { name: "Prompt" });
    await editor.click();
    await page.keyboard.type("Check that **add** works (2 marks) and has tests (2 marks)");
    await page.keyboard.press(name === "mobile" ? "Enter" : "Shift+Enter"); // touch: Enter = new line
    await page.keyboard.type("```python ");
    await page.keyboard.type("assert add(1, 2) == 3");
    await page.keyboard.press("ArrowDown");
    await page.screenshot({ path: `${out}/${scheme}-${name}-editor.png` });
    await page.getByRole("button", { name: "Send" }).click();
    await page.locator("[data-role=assistant]").getByText("Improvements").waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "Send" }).waitFor();
    await page.screenshot({ path: `${out}/${scheme}-${name}.png` });
    await page.close();
  }
}
await browser.close();
console.log("screens written to", out);
