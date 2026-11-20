const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.ALLIM_PLAYWRIGHT || 'playwright');

const root = path.resolve(process.env.ALLIM_TEST_CANDIDATE || path.join(__dirname, '..'));
const pageRoot = path.join(root, 'allimquran/website_content/pages/learn');
const publicRoot = path.join(root, 'allimquran/public');
const artifacts = process.env.ALLIM_TEST_ARTIFACTS;
const fixturePages = [1, 2, 3, 604].map(number => {
  const data = JSON.parse(fs.readFileSync(path.join(root, `tests/fixtures/mushaf-comfort/page-${number}.json`)));
  return {...data, page: number};
});
const versePages = new Map(fixturePages.flatMap(page => page.verses.map(verse => [verse.verse_key, page.page])));
const catalogue = JSON.parse(fs.readFileSync(path.join(publicRoot, 'data/account-storage-catalogue.json'))).verses;
const chapterCounts = new Map();
for (const key of Object.keys(catalogue)) {
  const id = Number(key.split(':')[0]);
  chapterCounts.set(id, (chapterCounts.get(id) || 0) + 1);
}
const fixtureNames = {1: ['الفاتحة', 'Al-Fatihah'], 2: ['البقرة', 'Al-Baqarah'], 114: ['الناس', 'An-Nas']};
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join(pageRoot, 'css.css'))}</style></head><body>${fs.readFileSync(path.join(pageRoot, 'main_section_html.html'))}<script>${fs.readFileSync(path.join(pageRoot, 'javascript.js'))}</script></body></html>`;
const contentTypes = {'.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml'};
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/learn') {
    response.setHeader('content-type', 'text/html;charset=utf-8');
    response.end(html);
    return;
  }
  const prefix = '/assets/allimquran/';
  if (url.pathname.startsWith(prefix)) {
    const resource = path.resolve(publicRoot, url.pathname.slice(prefix.length));
    if (resource.startsWith(publicRoot + path.sep) && fs.existsSync(resource) && fs.statSync(resource).isFile()) {
      response.setHeader('content-type', contentTypes[path.extname(resource)] || 'application/octet-stream');
      response.end(fs.readFileSync(resource));
      return;
    }
  }
  response.statusCode = 404;
  response.end();
});

function apiResponse(url) {
  if (url.pathname.endsWith('account_storage.context')) return {message: {mode: 'guest'}};
  if (url.pathname.endsWith('get_logged_user')) return {message: 'Guest'};
  if (url.pathname === '/api/mushaf/chapters') return {chapters: [...chapterCounts].map(([id, verses_count]) => {
    const [name_arabic, name_simple] = fixtureNames[id] || ['', `Surah ${id}`];
    return {id, name_arabic, name_simple, verses_count};
  })};
  const locate = url.pathname.match(/^\/api\/mushaf\/locate\/(\d+)\/(\d+)$/);
  if (locate) {
    const page = versePages.get(`${locate[1]}:${locate[2]}`);
    return page ? {page} : null;
  }
  const mushafPage = url.pathname.match(/^\/api\/mushaf\/page\/(\d+)$/);
  if (mushafPage) return fixturePages.find(page => page.page === Number(mushafPage[1]));
  if (url.pathname.endsWith('/research')) return {enabled: false};
  if (url.pathname.endsWith('/health')) return {ready: false};
  return null;
}

async function openReader(page, origin, lang, view = 'read') {
  await page.goto(`${origin}/learn?view=${view}&intro=0&lang=${lang}`, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.AllimAccountUI?.initialized);
  assert.equal(await page.locator('html').getAttribute('lang'), lang);
}

function controls(page) {
  return Object.fromEntries(['dialog', 'length', 'start', 'reference', 'text', 'hint', 'reveal', 'remembered', 'again', 'skip', 'status', 'summary', 'close'].map(id => [id, page.locator(`#quiet-recall-${id}`)]));
}

function referencePattern(ref) {
  return new RegExp('(?:^|[ :])' + ref.split(':')[1].replace(/\d/g, digit => `[${digit}${'٠١٢٣٤٥٦٧٨٩'[Number(digit)]}${'۰۱۲۳۴۵۶۷۸۹'[Number(digit)]}]`) + '$');
}

async function expectReference(ui, ref) {
  await ui.reference.waitFor({state: 'visible'});
  await ui.reference.page().waitForFunction(pattern => new RegExp(pattern).test(document.getElementById('quiet-recall-reference').textContent.trim()), referencePattern(ref).source, {timeout: 5000});
  const label = (await ui.reference.innerText()).trim();
  assert.match(label, ref.startsWith('1:') ? /fatih|фатих|فاتحة/iu : /baqar|бакар|بقرة/iu);
}

async function expectConcealed(ui) {
  assert.equal((await ui.text.textContent()).trim(), '', 'unrevealed verse is absent from the DOM');
}

async function snapshot(page) {
  return page.evaluate(async () => {
    await AllimStorage.chain;
    return (await AllimStorage.snapshot()).records.filter(row => !row.deleted);
  });
}

function reviewItems(rows) {
  return rows.filter(row => row.kind === 'review_item').map(row => row.id).sort();
}

function credits(rows) {
  return rows.filter(row => ['learning_event', 'reading_attempt'].includes(row.kind)).map(row => `${row.kind}/${row.id}`).sort();
}

async function assertLayout(page, ui, lang, width, height) {
  await page.setViewportSize({width, height});
  await page.evaluate(() => document.fonts.ready);
  const geometry = await ui.dialog.evaluate(dialog => {
    const bounds = dialog.getBoundingClientRect();
    return {left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
      content: dialog.scrollWidth - dialog.clientWidth, width: innerWidth, height: innerHeight,
      direction: getComputedStyle(dialog).direction};
  });
  assert.ok(geometry.left >= -1 && geometry.right <= geometry.width + 1, `${lang}/${width}: dialog fits horizontally`);
  assert.ok(geometry.top >= -1 && geometry.bottom <= geometry.height + 1, `${lang}/${width}: dialog fits vertically`);
  assert.ok(geometry.content <= 1, `${lang}/${width}: no horizontal scrolling within dialog`);
  assert.equal(geometry.direction, lang === 'ar' ? 'rtl' : 'ltr');
  if (artifacts && [390, 1440].includes(width)) {
    fs.mkdirSync(artifacts, {recursive: true});
    await page.screenshot({path: path.join(artifacts, `recall-${lang}-${width}.png`)});
  }
}

async function runLocale(browser, origin, lang) {
  const context = await browser.newContext({viewport: {width: 1440, height: 960}, serviceWorkers: 'block'});
  await context.addInitScript(() => {
    localStorage.setItem('allim-system-intro-seen-v1', '1');
    window.__quietRecallMicrophoneRequests = 0;
    navigator.mediaDevices.getUserMedia = () => {
      window.__quietRecallMicrophoneRequests += 1;
      return Promise.reject(new Error('Quiet recall must not start a microphone'));
    };
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const data = apiResponse(url);
    return route.fulfill(data ? {json: data} : {status: 404, json: {error: 'fixture unavailable'}});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  const transcriptions = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/\/(?:recognize|transcribe)(?:$|[/?])/.test(request.url())) transcriptions.push(request.url());
  });
  const ui = controls(page);
  try {
    await openReader(page, origin, lang);
    await page.locator('#surah-select').selectOption('1');
    await page.locator('#ayah-select').selectOption('1');
    const opener = page.locator('#view-read [data-quiet-recall-open="current"]');
    await opener.focus();
    await page.keyboard.press('Enter');
    await ui.dialog.waitFor({state: 'visible'});
    assert.ok(await ui.dialog.evaluate(dialog => dialog.contains(document.activeElement)), 'keyboard focus entered the dialog');
    await ui.length.selectOption('3');
    await ui.start.click();
    await expectReference(ui, '1:1');
    await expectConcealed(ui);
    for (const [width, height] of [[1440, 960], [768, 960], [390, 844], [320, 568], [844, 390]]) {
      await assertLayout(page, ui, lang, width, height);
    }
    await page.setViewportSize({width: 390, height: 844});
    await page.keyboard.press('Escape');
    await ui.dialog.waitFor({state: 'hidden'});
    assert.equal(await opener.evaluate(button => button === document.activeElement), true, 'Escape restores opener focus');
    assert.deepEqual(reviewItems(await snapshot(page)), [], 'cancel does not write a review item');

    await opener.click();
    await ui.length.selectOption('3');
    await ui.start.click();
    await expectReference(ui, '1:1');
    await expectConcealed(ui);
    const before = credits(await snapshot(page));
    await ui.hint.click();
    const hint = (await ui.text.innerText()).trim();
    assert.equal(hint.split(/\s+/u).length, 1, 'only the first word is shown as a hint');
    assert.match(hint, /ب/u);
    await ui.reveal.click();
    assert.ok((await ui.text.innerText()).trim().startsWith(hint));
    assert.ok((await ui.text.innerText()).trim().split(/\s+/u).length > 1, 'full verse is shown on explicit reveal');
    await ui.again.click();
    await expectReference(ui, '1:2');
    assert.deepEqual(reviewItems(await snapshot(page)), ['1:1'], 'Again queues the verse');
    await expectConcealed(ui);
    await ui.reveal.click();
    await ui.remembered.click();
    await expectReference(ui, '1:3');
    await expectConcealed(ui);
    await ui.skip.click();
    await ui.summary.waitFor({state: 'visible'});
    assert.deepEqual(await ui.summary.locator('dd').allTextContents(), lang === 'ar' ? ['١', '٠', '١', '١'] : ['1', '0', '1', '1'], 'one recalled, one queued, one skipped');
    assert.deepEqual(reviewItems(await snapshot(page)), ['1:1'], 'Remembered/Skip never add to the queue');
    assert.deepEqual(credits(await snapshot(page)), before, 'quiet self-assessment does not grant verified credit');
    await ui.close.click();
    await ui.dialog.waitFor({state: 'hidden'});

    await openReader(page, origin, lang, 'memorize');
    assert.deepEqual(reviewItems(await snapshot(page)), ['1:1'], 'the queue persists after navigation/reload');
    const queue = page.locator('[data-quiet-recall-open="queue"]');
    await queue.click();
    if (await ui.start.isVisible()) await ui.start.click();
    await expectReference(ui, '1:1');
    await expectConcealed(ui);
    await ui.hint.click();
    await ui.reveal.click();
    await ui.remembered.click();
    await ui.summary.waitFor({state: 'visible'});
    assert.deepEqual(reviewItems(await snapshot(page)), ['1:1'], 'with a hint, the verse stays queued');
    await ui.close.click();
    await queue.click();
    await ui.start.click();
    await expectReference(ui, '1:1');
    await ui.reveal.click();
    const removeLabel = `${await ui.remembered.innerText()} ${await ui.remembered.getAttribute('aria-label') || ''}`;
    assert.match(removeLabel, {en: /remove/i, ru: /убрать|удалить/i, ar: /إزالة|أزل|احذف|حذف/u}[lang], 'queue action explains removal');
    await ui.remembered.click();
    await ui.summary.waitFor({state: 'visible'});
    assert.deepEqual(reviewItems(await snapshot(page)), [], 'Remembered removes the reviewed verse');
    assert.deepEqual(credits(await snapshot(page)), before);
    await ui.close.click();

    if (lang === 'en') {
      await openReader(page, origin, lang);
      await page.locator('#open-quran-search').click();
      await page.locator('#quran-search-input').fill('2:6');
      await page.locator('.quran-search-result.is-direct').click();
      await page.waitForFunction(() => document.getElementById('verse-reference').textContent === '2:6');
      await opener.click();
      await ui.length.selectOption('3');
      await ui.start.click();
      await expectReference(ui, '2:6');
      await expectConcealed(ui);
      await ui.reveal.click();
      const verifiedWords = fixturePages.find(page => page.page === 3).verses.find(verse => verse.verse_key === '2:6').words.filter(word => word.char_type_name === 'word');
      assert.equal((await ui.text.innerText()).trim().split(/\s+/u).length, verifiedWords.length);
      await ui.again.click();
      await expectReference(ui, '2:7');
      await ui.close.click();
      assert.deepEqual(reviewItems(await snapshot(page)), ['2:6'], 'remote-only verses are usable in quiet recall');
      await page.locator('#surah-select').selectOption('1');
      await page.evaluate(async () => {
        await AllimStorage.mutateMany([1, 2, 3, 4, 5, 6].map((ayah, index) => ({
          kind: 'review_item', id: '1:' + ayah, action: 'set', value: {position: index + 1}
        })));
      });
      await openReader(page, origin, lang, 'memorize');
      assert.equal(reviewItems(await snapshot(page)).length, 7);
      await page.route('**/api/mushaf/page/3?*', route => route.fulfill({status: 503, json: {error: 'temporary fixture failure'}}), {times: 1});
      await queue.click();
      await ui.start.click();
      await expectReference(ui, '2:6');
      await page.locator('#quiet-recall-retry').waitFor({state: 'visible'});
      assert.equal(await ui.reveal.isDisabled(), true);
      assert.match(await ui.status.innerText(), /could not be loaded/i);
      await page.locator('#quiet-recall-retry').click();
      await ui.reveal.click();
      assert.ok((await ui.text.innerText()).trim(), 'retry displays the remote ayah after recovery');
      assert.equal(await page.locator('#quiet-recall-progress').getAttribute('max'), '5');
      await ui.skip.click();
      for (const ayah of [1, 2, 3, 4]) {
        await expectReference(ui, '1:' + ayah);
        await ui.skip.click();
      }
      assert.deepEqual(await ui.summary.locator('dd').allTextContents(), ['0', '0', '0', '5'], 'review queue is capped at five ayahs');
      assert.equal(reviewItems(await snapshot(page)).length, 7, 'retry and skip leave all queued references untouched');
      await ui.close.click();
    }
    assert.equal(await page.evaluate(() => window.__quietRecallMicrophoneRequests), 0);
    assert.deepEqual(transcriptions, []);
    assert.deepEqual(errors, [], lang);
    console.log(`PASS ${lang}: keyboard and focus, five viewport sizes, concealed text, manual results without verified credit, persistent queue${lang === 'en' ? ', remote verse, temporary failure/retry and queue cap' : ''}`);
  } finally {
    await context.close();
  }
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({channel: 'chrome', headless: true});
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const lang of ['en', 'ar', 'ru']) await runLocale(browser, origin, lang);
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
