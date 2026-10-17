/* Reviewed CMS presentation on a full isolated Frappe site and real storage API. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pw = require(process.env.ALLIM_PLAYWRIGHT || 'playwright');
const engine = process.env.ALLIM_TEST_BROWSER || 'chromium';
const base = process.env.ALLIM_TEST_URL || 'http://127.0.0.1:18643';
assert.ok(['chromium', 'webkit', 'firefox'].includes(engine));
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const credentials = JSON.parse(fs.readFileSync(process.env.ALLIM_TEST_CREDENTIALS));
for (const who of ['a', 'b']) assert.equal(credentials[who].user, `allim-storage-${who}@example.invalid`);
const errors = [], passed = [], writes = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function pass(message) { passed.push(message); console.log('PASS ' + message); }
async function context(browser) {
  const ctx = await browser.newContext({viewport:{width:390, height:844}, reducedMotion:'reduce', serviceWorkers:'block'});
  await ctx.addInitScript(origin => {
    if (location.origin !== origin) return;
    localStorage.setItem('allim-system-intro-seen-v1', '1');
    navigator.share = async value => { window.fixtureShare = value; };
  }, new URL(base).origin);
  ctx.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  ctx.on('request', request => { if (request.method() === 'POST' && request.url().includes('account_storage.')) writes.push(request.url()); });
  return ctx;
}
async function login(ctx, who) {
  const response = await ctx.request.post(base + '/api/method/login', {data:{usr:credentials[who].user, pwd:credentials[who].password}});
  assert.equal(response.status(), 200);
}
async function open(ctx, route = '/') {
  const page = await ctx.newPage();
  await page.goto(base + route, {waitUntil:'domcontentloaded'});
  await page.evaluate(() => AllimAccountUI.ready);
  await page.waitForFunction(() => AllimAccountUI.initialized);
  return page;
}
async function saved(page, language, canonical) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    await page.evaluate(() => AllimStorage.sync());
    const snapshot = await page.evaluate(() => AllimStorage.snapshot());
    const rows = canonical ? snapshot.canonical : snapshot.records;
    if (rows.some(row => row.kind === 'preference' && row.id === 'language' && !row.deleted && row.value.selected === language)) return;
    await pause(100);
  }
  assert.fail('language did not reach its expected storage');
}
async function homeLanguage(page, language, canonical = false) {
  await page.locator('#language-switch').selectOption(language);
  await saved(page, language, canonical);
  await page.waitForFunction(code => document.documentElement.lang === code, language);
  assert.equal(await page.locator('#language-current-code').innerText(), language.toUpperCase());
}
(async () => {
  const browser = await pw[engine].launch({headless:true,
    ...(engine === 'chromium' ? {channel:'chrome'} : {}),
    ...(engine === 'firefox' ? {firefoxUserPrefs:{'network.proxy.type':0}} : {})
  });
  try {
    const device = await context(browser); let page = await open(device);
    assert.equal(await page.locator('.allim-web-root').count(), 1);
    await homeLanguage(page, 'tg');
    await page.reload({waitUntil:'domcontentloaded'}); await page.evaluate(() => AllimAccountUI.ready);
    await page.waitForFunction(() => document.documentElement.lang === 'tg');
    assert.deepEqual(writes, [], 'guest language never reaches the account API');
    for (const suffix of ['cyrillic-ext', 'cyrillic', 'latin-ext', 'latin']) {
      const response = await device.request.get(base + `/assets/allimquran/media/allim-onest-${suffix}.woff2`);
      assert.equal(response.status(), 200); assert.equal((await response.body()).subarray(0,4).toString(), 'wOF2');
    }
    pass('Tajik guest language survives reload locally; all four self-hosted Onest fonts load');
    const card = page.locator('[data-journey-step="understand"]'); await card.click();
    assert.equal(await page.locator('#journey-visual').getAttribute('data-active-step'), 'understand');
    await page.locator('[data-share-context="allim"]').first().click();
    assert.equal((await page.evaluate(() => fixtureShare)).url, 'https://allimquran.com/');
    assert.equal(await page.locator('[data-app-link]').first().getAttribute('href'), '/learn');
    pass('journey interaction and share payload work; navigation uses canonical application routes');
    await page.close(); await login(device, 'a'); page = await open(device);
    assert.equal(await page.evaluate(() => AllimStorage.auth.legacy_owner), credentials.a.user);
    for (const language of ['uz', 'tt']) await homeLanguage(page, language, true);
    await page.close(); page = await open(device, '/learn?view=read');
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru', 'reader uses its supported language fallback');
    let snapshot = await page.evaluate(() => AllimStorage.snapshot());
    assert.equal(snapshot.records.find(row => row.kind === 'preference' && row.id === 'language').value.selected, 'tt');
    await page.locator('#language-switch').selectOption('ar'); await saved(page, 'ar', true);
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.equal(await page.locator('#language-current-code').innerText(), 'AR');
    await page.close(); page = await open(device);
    await page.waitForFunction(() => document.documentElement.lang === 'ar');
    await homeLanguage(page, 'uz', true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile homepage overflow');
    await page.screenshot({path:`/tmp/allim-cms-20261017/${engine}-home-mobile.png`});
    pass('Uzbek and Tatar save in account A; reader fallback preserves preference; explicit Arabic choice syncs');
    const remote = await context(browser); await login(remote, 'a'); const restored = await open(remote);
    await restored.waitForFunction(() => document.documentElement.lang === 'uz');
    await remote.close();
    const other = await context(browser); await login(other, 'b'); const b = await open(other);
    await homeLanguage(b, 'ru', true); await b.close(); await other.close();
    snapshot = await page.evaluate(() => AllimStorage.snapshot());
    assert.equal(snapshot.records.find(row => row.kind === 'preference' && row.id === 'language').value.selected, 'uz');
    pass('a clean browser restores account A language; account B stays isolated');
    const article = await device.newPage(); const response = await article.goto(base + '/ru/blog/sistema-povtoreniya-korana');
    assert.equal(response.status(), 200);
    assert.match(await article.locator('h1').innerText(), /15 минут/);
    assert.ok(await article.locator('#review-9').count());
    assert.match(await article.title(), /15 минут/);
    await article.screenshot({path:`/tmp/allim-cms-20261017/${engine}-article-mobile.png`});
    await article.close();
    pass('updated Russian guide renders with its new title, metadata and article anchors');
    await page.setViewportSize({width:1440,height:1000});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'desktop homepage overflow');
    await page.screenshot({path:`/tmp/allim-cms-20261017/${engine}-home-desktop.png`});
    assert.deepEqual(errors, [], 'no uncaught page errors');
    await device.close();
    if (process.env.ALLIM_TEST_REPORT) fs.writeFileSync(process.env.ALLIM_TEST_REPORT, JSON.stringify({engine, browser:browser.version(), passed, page_errors:errors.length}, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
