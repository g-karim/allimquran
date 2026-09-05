// Read-only browser checks: no form submissions, microphone access or logged-in profile.
import { chromium } from "playwright";
import fs from "node:fs/promises";

const output = process.argv[2] || ".migration/browser";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    for (const route of ["/", "/learn", "/academy", "/ru/blog", "/academy-trial"]) {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const response = await page.goto(`https://allimquran.com${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(5000);
      const info = await page.evaluate(() => ({
        title: document.title,
        bodyLength: document.body.innerText.length,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
        brokenImages: [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => image.src),
      }));
      const name = `${viewport.width}-${route.replaceAll("/", "_") || "home"}`;
      await page.screenshot({ path: `${output}/${name}.png`, fullPage: false });
      results.push({ route, viewport: viewport.width, status: response.status(), errors, ...info });
      console.log(JSON.stringify(results.at(-1)));
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
}
