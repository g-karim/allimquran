import { chromium } from "/Users/rafael/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--allow-file-access-from-files", "--hide-scrollbars"]
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.emulateMedia({ reducedMotion: "reduce" });
for (let scene = 1; scene <= 10; scene += 1) {
  const url = `file://${path.join(root, "presentation.html")}?scene=${scene}`;
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, "work", "ru", `scene-${String(scene).padStart(2, "0")}.png`) });
}
await browser.close();
