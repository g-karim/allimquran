// Local consent UI with mocked HTTP. Never accesses a real microphone or production.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { chromium } from 'playwright';

const js = await fs.readFile(new URL('../allimquran/public/js/recitation-consent.js', import.meta.url), 'utf8');
const css = await fs.readFile(new URL('../allimquran/public/css/recitation-consent.css', import.meta.url), 'utf8');
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>
  <section id="view-settings"><div class="settings-list"></div></section><button id="start">Start</button>
  <script>${js}</script><script>
  window.starts=0; window.stops=0;
  window.contribution=AllimContribution({language:()=>new URLSearchParams(location.search).get('lang')||'ru',stop:()=>window.stops++});
  contribution.mount(); document.getElementById('start').onclick=()=>contribution.beforeStart(()=>window.starts++);
  </script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const key = 'allim-recitation-contribution-v1';
let checks = 0;
try {
  for (const scenario of ['decline', 'grant-delete', 'race', 'delete-failure', 'escape', 'off', 'ar', 'en', 'cross-tab']) {
    const context = await browser.newContext({ viewport: { width: scenario === 'en' ? 1440 : 390, height: 844 } });
    const page = await context.newPage();
    const errors = [], calls = [];
    page.on('pageerror', error => errors.push(error.message));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await context.route('**/api/quran-asr/research', async route => {
      const method = route.request().method(); calls.push(method);
      if (method === 'POST') {
        assert.equal(route.request().postDataJSON().adult, true);
        assert.match(route.request().headers()['x-allim-contribution'], /^[a-f0-9]{64}$/);
        if (scenario === 'race') await gate;
      }
      if (method === 'DELETE' && scenario === 'delete-failure') return route.abort();
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(method === 'GET'
        ? { enabled: scenario !== 'off', version: '2026-09-07-v1', retention_days: 90 }
        : method === 'POST' ? { granted: true, expires: Date.now() / 1000 + 86400, version: '2026-09-07-v1' }
        : { withdrawn: true, deleted_clips: 1 }) });
    });
    await page.goto(base + '/?lang=' + (['ar', 'en'].includes(scenario) ? scenario : 'ru'));
    await page.click('#start');
    if (scenario === 'off') {
      await page.waitForFunction(() => window.starts === 1);
      assert.equal(await page.locator('dialog[open]').count(), 0);
    } else {
      await page.waitForSelector('dialog[open]');
      assert.equal(await page.evaluate(() => window.starts), 0);
      assert.equal(await page.locator('#contribution-adult').isChecked(), false);
      assert.equal(await page.locator('#contribution-agree').isDisabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (scenario === 'escape') {
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => window.starts), 0);
        assert.deepEqual(calls, ['GET']);
      } else if (['decline', 'ar', 'en'].includes(scenario)) {
        await page.click('#contribution-decline');
        await page.click('#start');
        assert.equal(await page.evaluate(() => window.starts), 2);
        assert.equal(await page.evaluate(() => contribution.context()), null);
        assert.deepEqual(calls, ['GET']);
      } else {
        await page.check('#contribution-adult');
        await page.click('#contribution-agree');
        if (scenario === 'race') {
          await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).status === 'grant_pending', key);
          await page.click('#contribution-decline');
          release();
          await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).status === 'declined', key);
          assert.equal(await page.evaluate(() => contribution.context()), null);
          assert.equal(await page.evaluate(() => window.starts), 1);
        } else {
          await page.waitForFunction(() => window.starts === 1);
          const capture = await page.evaluate(() => {
            window.captured = contribution.context();
            const form = new FormData(); const headers = contribution.append(form, captured, 'read');
            return { headers, fields: Object.fromEntries(form) };
          });
          assert.match(capture.headers['X-Allim-Contribution'], /^[a-f0-9]{64}$/);
          assert.equal(capture.fields.research_mode, 'read');
          const control = scenario === 'cross-tab' ? await context.newPage() : page;
          if (control !== page) await control.goto(base);
          await control.click('#contribution-settings button');
          await control.click('#contribution-delete');
          await control.waitForFunction(key => JSON.parse(localStorage.getItem(key)).status !== 'granted', key);
          if (scenario !== 'delete-failure') await control.waitForFunction(key => JSON.parse(localStorage.getItem(key)).status === 'declined', key);
          const after = await page.evaluate(() => contribution.append(new FormData(), captured, 'read'));
          assert.equal(after['X-Allim-Contribution'], undefined);
          if (scenario === 'delete-failure') {
            const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
            assert.equal(saved.status, 'withdraw_pending'); assert.ok(saved.token);
          }
        }
      }
    }
    assert.deepEqual(errors, [], scenario);
    checks++;
    await context.close();
  }
  console.log(`Passed ${checks} consent browser scenarios (RU/EN/AR, mobile, no real microphone).`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
