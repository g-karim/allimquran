// Isolated local Companion with a fake microphone/recognizer. Never posts to production.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageRoot = path.join(root, 'allimquran/website_content/pages/learn');
const [markup, css, javascript, core] = await Promise.all([
  fs.readFile(path.join(pageRoot, 'main_section_html.html'), 'utf8'),
  fs.readFile(path.join(pageRoot, 'css.css'), 'utf8'),
  fs.readFile(path.join(pageRoot, 'javascript.js'), 'utf8'),
  fs.readFile(path.join(root, 'allimquran/public/js/recitation-core.js'), 'utf8'),
]);
const document = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>${markup}<script>${javascript.replaceAll('</script', '<\\/script')}</script></body></html>`;
const server = http.createServer((request, response) => {
  if (request.url.startsWith('/assets/allimquran/js/recitation-consent.js')) {
    fs.readFile(path.join(root, 'allimquran/public/js/recitation-consent.js')).then(data => {
      response.writeHead(200, { 'Content-Type': 'text/javascript' }); response.end(data);
    });
  } else if (request.url.startsWith('/assets/allimquran/css/recitation-consent.css')) {
    fs.readFile(path.join(root, 'allimquran/public/css/recitation-consent.css')).then(data => {
      response.writeHead(200, { 'Content-Type': 'text/css' }); response.end(data);
    });
  } else if (request.url.startsWith('/assets/allimquran/js/recitation-core.js')) {
    response.writeHead(200, { 'Content-Type': 'text/javascript' }); response.end(core);
  } else if (request.url.startsWith('/learn')) {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(document);
  } else { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
let checks = 0;
try {
  for (const [name, language, width] of [
    ['interim', 'ru', 1440], ['correct', 'ru', 1440], ['late-final', 'ru', 1440], ['extra', 'ru', 390],
    ['uncertain', 'en', 1440], ['correction', 'ar', 390], ['fallback', 'ru', 1440],
    ['server-uncertain', 'ru', 390], ['server-error', 'en', 1440],
    ['server-contribution-accept', 'ru', 390], ['server-contribution-decline', 'en', 1440],
    ['server-cancel', 'ru', 390], ['browser-cancel', 'ar', 390],
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, permissions: ['microphone'] });
    const page = await context.newPage();
    const errors = [], posts = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ language, name }) => {
      localStorage.setItem('quran-companion-prototype-v4', JSON.stringify({
        language, selectedSurah: 1, selectedAyah: 1, view: 'read',
        recognitionMode: name.startsWith('server-') ? 'quran' : 'auto', recognitionModeExplicit: true,
        recitationFlow: 'single', recitationFlowExplicit: true, autoAdvance: false, soundCues: false,
      }));
      window.__recognizers = [];
      window.__recorders = [];
      const NativeMediaRecorder = window.MediaRecorder;
      window.MediaRecorder = class extends NativeMediaRecorder {
        constructor(...args) { super(...args); window.__recorders.push(this); }
      };
      window.SpeechRecognition = class {
        constructor() { window.__recognizers.push(this); }
        start() { setTimeout(() => this.onstart?.(), 0); }
        stop() { setTimeout(() => this.onend?.(), 0); }
        abort() { this.stop(); }
      };
    }, { language, name });
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const json = value => route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) });
      if (url.pathname === '/api/quran-asr/health') return json({ ready: true });
      if (url.pathname === '/api/quran-asr/research') return json(route.request().method() === 'POST'
        ? { granted: true, version: '2026-09-07-v1', expires: Date.now() / 1000 + 86400 }
        : { enabled: name.includes('contribution'), version: '2026-09-07-v1' });
      if (route.request().method() === 'POST') {
        assert.equal(url.pathname, '/api/quran-asr');
        assert.equal(Boolean(route.request().headers()['x-allim-contribution']), name === 'server-contribution-accept');
        posts.push(url.pathname);
        if (name === 'server-error') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: { code: 'asr_failed' } }) });
        return json({ transcript: name === 'server-uncertain' ? '' : 'بسم الله الرحمن الرحيم',
          preview_transcript: name === 'server-uncertain' ? 'بسم الله الرحمن الرحيم' : '', verse_key: '1:1',
          status: name === 'server-uncertain' ? 'uncertain' : 'transcribed' });
      }
      if (url.pathname.endsWith('get_logged_user')) return json({ message: 'Guest' });
      if (url.pathname.startsWith('/api/resource/')) return json({ data: [] });
      // GET-only source lookups may use the existing public Quran-content proxy.
      const response = await route.fetch({ url: 'https://allimquran.com' + url.pathname + url.search });
      return route.fulfill({ response });
    });
    await page.route('**/assets/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/assets/allimquran/js/') || url.pathname.startsWith('/assets/allimquran/css/')) return route.continue();
      const response = await route.fetch({ url: 'https://allimquran.com' + url.pathname + url.search });
      return route.fulfill({ response });
    });
    await page.goto(origin + '/learn?view=read&intro=0', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.getElementById('allim-system-intro'));
    await page.waitForFunction(() => document.querySelectorAll('.quran-word').length === 4);
    await page.waitForFunction(() => !document.querySelector('[data-recognition-choice="quran"]').disabled);
    const start = () => page.locator(width <= 760 ? '#mobile-recognition-toggle' : '#start-recognition').click();
    const result = (text, final = true) => page.evaluate(({ text, final }) => {
      const recognizer = window.__recognizers.at(-1);
      recognizer.onresult({ results: [Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal: final })] });
    }, { text, final });
    const sessions = () => page.evaluate(() => JSON.parse(localStorage.getItem('quran-companion-prototype-v4')).sessions || 0);
    await start();
    if (name.includes('contribution')) {
      await page.waitForSelector('#allim-contribution-dialog[open]');
      assert.equal(await page.evaluate(() => window.__recorders.length), 0);
      if (process.env.RECOGNITION_SCREENSHOTS) {
        await fs.mkdir(process.env.RECOGNITION_SCREENSHOTS, { recursive: true });
        await page.screenshot({ path: path.join(process.env.RECOGNITION_SCREENSHOTS, name + '-dialog.png') });
      }
      if (name.endsWith('accept')) {
        await page.check('#contribution-adult');
        await page.click('#contribution-agree');
      } else await page.click('#contribution-decline');
    }
    if (!name.startsWith('server-')) await page.waitForFunction(() => document.getElementById('start-recognition').getAttribute('aria-pressed') === 'true');
    if (name === 'browser-cancel') {
      await result('بسم الله الرحمن الرحيم', false);
      await start();
      await result('بسم الله الرحمن الرحيم');
      assert.equal(await sessions(), 0);
      assert.equal(await page.locator('#mobile-recognition-toggle').getAttribute('aria-pressed'), 'false');
    } else if (name === 'interim') {
      await result('بسم الله الرحمن الرحيم', false);
      await page.evaluate(() => window.__recognizers.at(-1).onend());
      assert.equal(await sessions(), 0);
      assert.equal(await page.locator('.quran-word.is-recognized').count(), 0);
    } else if (name === 'correct' || name === 'late-final') {
      await result('بسم الله الرحمن الرحيم');
      if (name === 'late-final') {
        await result('بسم الله الرحمن الرحيم زيادة');
        assert.equal(await page.locator('#summary-extra').textContent(), '0');
      }
      assert.equal(await sessions(), 1);
    } else if (name === 'extra') {
      await result('بسم الله الرحمن الرحيم زيادة');
      assert.equal(await sessions(), 0);
      assert.equal(await page.locator('#summary-extra').textContent(), '1');
      assert.equal(await page.locator('#correction-gate').isVisible(), true);
    } else if (name === 'uncertain' || name === 'correction') {
      await result('بسم الله الرحمن الرحين');
      assert.equal(await sessions(), 0);
      assert.equal(await page.locator('.quran-word.is-warning').count(), 1);
      assert.equal(await page.locator('.quran-word.is-error').count(), 0);
      await page.evaluate(() => window.__recognizers.at(-1).onend());
      assert.equal(await page.locator('#recitation-panel.has-error').count(), 0);
      if (name === 'correction') {
        await start();
        await page.waitForFunction(() => document.getElementById('start-recognition').getAttribute('aria-pressed') === 'true');
        await result('الرحيم');
        assert.equal(await sessions(), 1);
      }
    } else {
      if (name === 'fallback') await page.evaluate(() => window.__recognizers.at(-1).onerror({ error: 'network' }));
      await page.waitForFunction(() => document.getElementById('recognition-engine').textContent.includes('Quran AI'));
      await page.waitForFunction(() => document.getElementById('start-recognition').getAttribute('aria-pressed') === 'true');
      await page.waitForTimeout(650); // allow MediaRecorder to emit actual fake-device audio
      if (name === 'server-cancel') await start();
      else {
        // End a captured utterance, like the VAD. The user Stop button cancels it.
        await page.evaluate(() => window.__recorders.at(-1).stop());
      }
      await page.waitForFunction(() => document.getElementById('start-recognition').getAttribute('aria-pressed') === 'false');
      await page.waitForTimeout(150);
      assert.equal(posts.length, name === 'server-cancel' ? 0 : 1);
      assert.equal(await sessions(), name === 'fallback' || name.includes('contribution') ? 1 : 0);
    }
    assert.deepEqual(errors, [], name);
    checks += 1;
    console.log(JSON.stringify({ name, language, width, sessions: await sessions(), posts: posts.length, errors }));
    if (process.env.RECOGNITION_SCREENSHOTS) {
      await fs.mkdir(process.env.RECOGNITION_SCREENSHOTS, { recursive: true });
      await page.locator('#recitation-panel').scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(process.env.RECOGNITION_SCREENSHOTS, name + '.png') });
    }
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(`Recognition browser smoke: ${checks} scenarios passed`);
