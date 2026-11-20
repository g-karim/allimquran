const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.ALLIM_PLAYWRIGHT || "playwright");

const root = path.resolve(__dirname, "..");
const learn = path.join(root, "allimquran/website_content/pages/learn");
const assets = path.join(root, "allimquran/public");
const read = (file) => fs.readFileSync(path.join(learn, file), "utf8");
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
  read("css.css") + "</style></head><body>" + read("main_section_html.html") + "<script>" +
  read("javascript.js") + "</script></body></html>";

// A short silent WAV drives Chromium's real play, pause, end and error events.
const sampleCount = 24000;
const sample = Buffer.alloc(44 + sampleCount * 2);
sample.write("RIFF");
sample.writeUInt32LE(sample.length - 8, 4);
sample.write("WAVEfmt ", 8);
sample.writeUInt32LE(16, 16);
sample.writeUInt16LE(1, 20);
sample.writeUInt16LE(1, 22);
sample.writeUInt32LE(8000, 24);
sample.writeUInt32LE(16000, 28);
sample.writeUInt16LE(2, 32);
sample.writeUInt16LE(16, 34);
sample.write("data", 36);
sample.writeUInt32LE(sampleCount * 2, 40);

async function run(browser, base, lang, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.addInitScript(({ bytes }) => {
      localStorage.setItem("allim-system-intro-seen-v1", "1");
      window.audioFixtures = { unavailable: false, requests: [] };
      const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
      Object.defineProperty(HTMLMediaElement.prototype, "src", {
        ...src,
        set(value) {
          if (/^https:/.test(value)) {
            window.audioFixtures.requests.push(value);
            const fixture = window.audioFixtures.unavailable ? "invalid audio" : new Uint8Array(bytes);
            value = URL.createObjectURL(new Blob([fixture], { type: "audio/wav" }));
          }
          src.set.call(this, value);
        }
      });
    }, { bytes: Array.from(sample) });
    await context.route(base + "/learn?**", (route) => route.fulfill({ body: html, contentType: "text/html;charset=utf-8" }));
    await context.route(base + "/assets/allimquran/**", (route) => {
      const url = new URL(route.request().url());
      const relative = url.pathname.slice("/assets/allimquran/".length);
      const file = path.resolve(assets, relative);
      if (!file.startsWith(assets + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404 });
      const contentType = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "application/octet-stream";
      return route.fulfill({ path: file, contentType });
    });
    await context.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.includes("account_storage.context")) return route.fulfill({ json: { message: { mode: "guest" } } });
      if (url.pathname.endsWith("/chapters")) return route.fulfill({ json: { chapters: [
        { id: 1, name_arabic: "الفاتحة", name_simple: "Al-Fatihah", verses_count: 7 },
        { id: 2, name_arabic: "البقرة", name_simple: "Al-Baqarah", verses_count: 286 }
      ] } });
      if (url.pathname.endsWith("/health")) return route.fulfill({ json: { ready: false } });
      if (url.pathname.endsWith("get_logged_user")) return route.fulfill({ json: { message: "Guest" } });
      return route.fulfill({ json: {} });
    });
    await context.route("https://**", (route) => route.abort());

    await page.goto(base + "/learn?view=read&intro=0&lang=" + lang, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.AllimAccountUI?.initialized && document.documentElement.lang !== "");
    await page.locator("#surah-select").selectOption("1");
    await page.locator("#ayah-select").selectOption("1");
    const countEvents = () => page.evaluate(async () => (await AllimStorage.snapshot()).records.filter((record) => record.kind === "learning_event").length);
    const eventsBefore = await countEvents();
    const audio = page.locator("#verse-audio");
    await page.locator('[data-reader-mode="listen"]:visible').first().click();
    await page.waitForFunction(() => !document.getElementById("verse-audio").paused);
    await page.locator("#audio-stop").click();
    await page.locator("#audio-practice summary").click();
    const from = page.locator("#audio-practice-from");
    const to = page.locator("#audio-practice-to");
    const plays = page.locator("#audio-practice-repeats");
    const speed = page.locator("#audio-practice-speed");
    const start = page.locator("#audio-practice-start");
    const stop = page.locator("#audio-practice-stop");
    const status = page.locator("#audio-practice-status");

    await page.waitForFunction(() => document.querySelectorAll("#audio-practice-to option").length === 7);
    assert.equal(await from.inputValue(), "1");
    assert.equal(await to.inputValue(), "3");
    assert.equal(await page.evaluate(() => document.documentElement.dir), lang === "ar" ? "rtl" : "ltr");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    if (lang === "ar") assert.match(await from.locator("option").first().textContent(), /١/);
    if (lang === "ru") assert.match(await speed.locator('option[value="0.75"]').textContent(), /0,75/);

    await from.selectOption("4");
    await to.selectOption("3");
    await start.click();
    assert.equal(await audio.getAttribute("src"), null);
    assert.ok(await status.isVisible());
    await from.selectOption("2");
    await to.selectOption("3");
    await plays.selectOption("2");
    await speed.selectOption("0.75");

    const cachePath = "https://everyayah.com/data/Husary_128kbps/001003.mp3";
    await page.evaluate(async ({ cachePath, bytes }) => {
      const cache = await caches.open("allim-quran-audio-v1");
      await cache.put(cachePath, new Response(new Uint8Array(bytes), { headers: { "Content-Type": "audio/wav" } }));
      window.audioPracticePlayed = [];
      const element = document.getElementById("verse-audio");
      element.addEventListener("play", () => window.audioPracticePlayed.push({ key: element.dataset.verseKey, rate: element.playbackRate }));
    }, { cachePath, bytes: Array.from(sample) });

    await start.click();
    await page.waitForFunction(() => window.audioPracticePlayed.length === 1);
    assert.ok(await page.locator("#audio-repeat").isDisabled());
    assert.equal(await audio.getAttribute("data-verse-key"), "husary:1:2");
    await start.click();
    assert.equal(await audio.evaluate((element) => element.paused), true);
    await start.click();
    await page.waitForFunction(() => window.audioPracticePlayed.length >= 2);
    if (width < 500) {
      await stop.click();
      assert.equal(await audio.getAttribute("src"), null);
      assert.equal(await status.isVisible(), true);
      assert.equal(await start.evaluate((element) => document.activeElement === element), true);
    } else {
      await page.waitForFunction(() => window.audioPracticePlayed.length === 5);
      assert.deepEqual(await page.evaluate(() => window.audioPracticePlayed), [
        { key: "husary:1:2", rate: 0.75 }, { key: "husary:1:2", rate: 0.75 }, { key: "husary:1:2", rate: 0.75 },
        { key: "husary:1:3", rate: 0.75 }, { key: "husary:1:3", rate: 0.75 }
      ]);
      const requests = await page.evaluate(() => window.audioFixtures.requests);
      assert.ok(requests.some((url) => url.endsWith("001002.mp3")));
      assert.equal(requests.some((url) => url.endsWith("001003.mp3")), false);
      await page.waitForFunction(() => !document.getElementById("verse-audio").hasAttribute("src"));
      assert.equal(await status.textContent(), "Passage complete.");
      assert.equal(await page.locator("#ayah-select").inputValue(), "1");
      assert.equal(await audio.evaluate((element) => element.playbackRate), 1);
      assert.equal(await page.locator("#audio-repeat").isDisabled(), false);
    }

    await page.locator("#reciter-select").selectOption("luhaidan");
    assert.equal(await start.isDisabled(), true);
    assert.equal(await page.locator("#audio-practice-help").isVisible(), true);
    assert.equal(await page.locator("#audio-play-toggle").isEnabled(), true);
    await page.locator("#reciter-select").selectOption("husary");
    await page.evaluate(() => { window.audioFixtures.unavailable = true; });
    await from.selectOption("4");
    await to.selectOption("5");
    await start.click();
    await page.waitForFunction(() => document.getElementById("audio-practice-stop").hidden);
    assert.match(await status.textContent(), /[4٤]/);
    assert.equal(await start.isEnabled(), true);
    await page.evaluate(() => { window.audioFixtures.unavailable = false; });
    await start.click();
    await page.waitForFunction(() => !document.getElementById("verse-audio").paused);
    await page.locator('[data-view="today"]:visible').first().click();
    assert.equal(await audio.getAttribute("src"), null);
    assert.equal(await countEvents(), eventsBefore);
    assert.deepEqual(errors, []);

    console.log("PASS", lang, width, "range validation, pause/resume, stop, chapter-only fallback, retry, no learning credit");
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const base = "http://allimquran.localhost";
    for (const [lang, width] of [["en", 1440], ["ar", 390], ["ru", 320]]) await run(browser, base, lang, width);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
