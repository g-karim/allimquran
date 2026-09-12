"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("/Users/rafael/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const baseUrl = process.env.ALLIM_TEST_URL || "http://127.0.0.1:4174/?v=86";
const photoPath = "/Users/rafael/Documents/ChatGPT/Арабский/video/combined-en-2026/work/02-ui-today.jpg";
const lowResolutionPhotoPath = "/Users/rafael/Documents/ChatGPT/Арабский/allim-brand-icon.png";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator('[data-view="memorize"]').first().click();
  await page.locator('[data-hifz-method="mauritanianLawh"]').click();
  await assert.doesNotReject(() => page.locator("#lawh-workspace").waitFor({ state: "visible" }));

  await page.locator("#lawh-photo-input").setInputFiles(lowResolutionPhotoPath);
  await page.waitForFunction(() => /512/.test(document.querySelector("#lawh-photo-detail")?.textContent || ""));
  assert.equal(await page.locator("#lawh-save-local").isDisabled(), true);
  assert.equal(await page.locator("#lawh-verification").isHidden(), true);

  await page.locator("#lawh-photo-input").setInputFiles(photoPath);
  await assert.doesNotReject(() => page.locator("#lawh-verification").waitFor({ state: "visible" }));
  assert.equal(await page.locator("#lawh-verify-page").isDisabled(), true);
  assert.equal(await page.locator("#lawh-save-local").isEnabled(), true);
  await page.locator("#lawh-save-local").click();
  await page.waitForFunction(() => document.querySelectorAll(".lawh-library-card").length === 1);

  for (const checkbox of await page.locator("[data-lawh-check]").all()) await checkbox.check();
  assert.equal(await page.locator("#lawh-verify-page").isEnabled(), true);
  await page.locator("#lawh-verify-page").click();
  await assert.doesNotReject(() => page.locator("#lawh-practice").waitFor({ state: "visible" }));

  await page.locator("#lawh-mark-read").click();
  await page.locator("#lawh-mark-recall").click();
  assert.equal(await page.locator("#lawh-read-count").textContent(), "1");
  assert.equal(await page.locator("#lawh-recall-count").textContent(), "1");
  await page.waitForFunction(() => /1/.test(document.querySelector(".lawh-library-card p")?.textContent || ""));

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-view="memorize"]').first().click();
  await assert.doesNotReject(() => page.locator("#lawh-preview").waitFor({ state: "visible" }));
  await assert.doesNotReject(() => page.locator("#lawh-practice").waitFor({ state: "visible" }));
  assert.equal(await page.locator("#lawh-read-count").textContent(), "1");
  assert.equal(await page.locator("#lawh-recall-count").textContent(), "1");
  assert.equal(await page.locator(".lawh-library-card").count(), 1);
  await page.locator("#lawh-workspace").screenshot({ path: "/tmp/allim-v86-lawh-desktop.png" });

  await page.locator("#language-switch").selectOption("ar");
  assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
  assert.match(await page.locator(".lawh-manual-note").textContent(), /تقرير ذاتي/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(2200);
  await page.locator("#lawh-workspace").screenshot({ path: "/tmp/allim-v86-lawh-mobile-rtl.png" });
  assert.deepEqual(pageErrors, []);

  page.once("dialog", dialog => dialog.accept());
  await page.locator(".lawh-delete").click();
  await page.waitForFunction(() => document.querySelectorAll(".lawh-library-card").length === 0);
  assert.equal(await page.locator("#lawh-preview").isHidden(), true);

  await browser.close();
  console.log("lawh workflow ok: local persistence, restore, delete, counters and Arabic RTL");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
