// Accessibility scan (axe-core, WCAG 2.1 A/AA) of the main states in light and dark mode.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium, MOCK_URL, waitForModelReady } from "./helpers.mjs";

const axeSource = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const browser = await chromium.launch();
const problems = [];

async function scan(page, label) {
  await page.waitForTimeout(400); // let open/fade animations finish (contrast is measured on final colours)
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(() =>
    window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }),
  );
  for (const v of result.violations) {
    problems.push(`[${label}] ${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " :: " + (n.failureSummary ?? "").split("\n").slice(1, 2).join("")).join("\n    ")}`);
  }
}

for (const scheme of ["light", "dark"]) {
  for (const width of [1280, 360]) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, colorScheme: scheme, hasTouch: width < 768 });
    const tag = `${scheme}-${width}`;
    await page.goto(MOCK_URL);
    await waitForModelReady(page);
    await scan(page, `${tag} empty`);
    await page.getByTestId("file-input").setInputFiles([{ name: "main.py", mimeType: "text/plain", buffer: Buffer.from("print(1)\n") }]);
    await page.getByTestId("file-input").setInputFiles([{ name: "x.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") }]);
    await page.getByRole("textbox", { name: "Prompt" }).click();
    await page.keyboard.type("Check it");
    await scan(page, `${tag} composing+error`);
    await page.getByRole("button", { name: "Send" }).click();
    await page.locator("[data-role=assistant]").getByText("Improvements").waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "Send" }).waitFor();
    await scan(page, `${tag} answered`);
    await page.getByRole("button", { name: /Change model/ }).click();
    await page.getByRole("list", { name: "Models" }).waitFor();
    await scan(page, `${tag} model popover`);
    await page.keyboard.press("Escape");
    if (width >= 768) {
      await page.getByRole("button", { name: /^Options for / }).first().click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await page.getByRole("alertdialog").waitFor();
      await scan(page, `${tag} delete dialog`);
      await page.keyboard.press("Escape");
    } else {
      await page.getByRole("button", { name: "Open chats" }).click();
      await page.locator("[data-slot=sheet-content]").waitFor();
      await scan(page, `${tag} sheet`);
    }
    await page.close();
  }
}
await browser.close();
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("a11y OK (no axe WCAG 2.1 AA violations)");
