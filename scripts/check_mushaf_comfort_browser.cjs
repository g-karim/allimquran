/* Actual reader + IndexedDB + isolated Frappe/MariaDB. Only public Quran data uses fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pw = require(process.env.ALLIM_PLAYWRIGHT || 'playwright');
const engine = process.env.ALLIM_TEST_BROWSER || 'chromium';
const base = process.env.ALLIM_TEST_URL || 'http://127.0.0.1:18543';
const artifacts=process.env.ALLIM_MUSHAF_ARTIFACT_DIR || '/tmp/allim-mushaf-20261017';
fs.mkdirSync(artifacts,{recursive:true,mode:0o700});
assert.ok(['chromium','webkit','firefox'].includes(engine));
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const credentials = JSON.parse(fs.readFileSync(process.env.ALLIM_TEST_CREDENTIALS));
assert.ok(Object.values(credentials).every(row => /^allim-mushaf-[ab]@example\.invalid$/.test(row.user)), 'Dedicated disposable fixtures required');
const options = {headless:true,...(engine === 'chromium' ? {channel:'chrome'} : {}),...(engine === 'firefox' ? {firefoxUserPrefs:{'network.proxy.type':0}} : {})};
const errors = [], posts = [];
const fixture = page => JSON.parse(fs.readFileSync(path.join(__dirname, `../tests/fixtures/mushaf-comfort/page-${page}.json`)));
const read = page => page.evaluate(() => AllimStorage.snapshot());
async function context(browser, width = 390) {
  const ctx = await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await ctx.addInitScript(origin => {
    if (location.origin === origin) localStorage.setItem('allim-system-intro-seen-v1','1');
  }, new URL(base).origin);
  await ctx.route('**/api/mushaf/**', async route => {
    const url = new URL(route.request().url());
    let data;
    if (url.pathname.endsWith('/chapters')) data = {chapters:[]};
    else if (url.pathname.includes('/locate/')) data = {page:url.pathname.includes('/1/1') ? 1 : 2};
    else {
      const page = Number(url.pathname.split('/').at(-1));
      data = [1,2,3,604].includes(page) ? fixture(page) : null;
    }
    await route.fulfill({status:data ? 200 : 503,json:data || {error:'fixture_unavailable'}});
  });
  ctx.on('request', req => { if (req.method() === 'POST' && req.url().includes('account_storage.')) posts.push(req.url()); });
  ctx.on('page', page => page.on('pageerror', e => {
    if (engine === 'webkit' && /^Fetch API cannot load .*account_storage\.(context|scan|pull)\?.* due to access control checks\.$/.test(e.message)) return;
    errors.push(e.message);
  }));
  return ctx;
}
async function login(ctx, who) {
  const response = await ctx.request.post(base + '/api/method/login', {data:{usr:credentials[who].user,pwd:credentials[who].password}});
  assert.equal(response.status(), 200, 'Frappe fixture login');
  // Existing first-session CSRF race has its own regression. Warm the session
  // serially here so this suite can isolate the newly added reader preferences.
  const warm = await ctx.request.get(base + '/api/method/allimquran.account_storage.context');
  assert.equal(warm.status(), 200);
  assert.equal((await warm.json()).message.legacy_owner, credentials[who].user, 'session owner after login');
  ctx.fixtureOwner = who;
}
async function pageFor(ctx) {
  const page = await ctx.newPage();
  await page.exposeFunction('mushafUnhandled', msg => errors.push(msg));
  await page.addInitScript(() => window.addEventListener('unhandledrejection', e => window.mushafUnhandled(String(e.reason))));
  await page.goto(base + '/learn?view=read', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.AllimAccountUI?.initialized === true);
  if (ctx.fixtureOwner) {
    assert.equal(await page.evaluate(() => AllimStorage.auth?.legacy_owner), credentials[ctx.fixtureOwner].user, 'reader session owner');
    assert.ok((await read(page)).scope.startsWith('account:'), 'reader scope after login');
  }
  return page;
}
async function openMushaf(page) {
  await page.locator('[data-reader-mode="mushaf"]').last().click();
  await page.waitForSelector('#mushaf-page .mushaf-glyph');
}
async function saved(page, id, value, canonical = false) {
  // IndexedDB is asynchronous. Poll its resolved result from Node; a Promise
  // passed directly to waitForFunction can be truthy before its value is ready.
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const snapshot = await read(page);
    const rows = canonical ? snapshot.canonical : snapshot.records;
    if ((!canonical || snapshot.scope?.startsWith('account:')) && rows?.some(row => row.kind === 'preference' && row.id === id && !row.deleted && row.value.selected === value)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail(`Preference ${id}=${value} did not reach ${canonical ? 'server-confirmed records' : 'local records'}`);
}
async function reset(page) {
  await page.waitForFunction(() => AllimStorage.state === 'account_ready' && !AllimStorage.running);
  await page.evaluate(async () => {
    const stamp = AllimStorage.stamp();
    const prepared = await AllimStorage.api('prepare_reset', {scope:'all_personal_progress'}, stamp, true);
    await AllimStorage.api('reset', {scope:'all_personal_progress',confirmation:prepared.confirmation,reset_id:crypto.randomUUID()}, stamp, true);
    await AllimStorage.refreshContext(true);
  });
}
(async () => {
  const browser = await pw[engine].launch(options);
  try {
    // Each run owns only these two disposable users; no shared account resets.
    for (const who of ['a','b']) {
      const ctx = await context(browser); await login(ctx, who);
      const page = await ctx.newPage();
      await page.goto(base + '/storage-harness', {waitUntil:'domcontentloaded'});
      await page.evaluate(() => fixtureReady);
      await reset(page); await ctx.close();
    }
    posts.length = 0;
    const first = await context(browser), page = await pageFor(first);
    await openMushaf(page);
    assert.equal(await page.locator('#mushaf-page').getAttribute('data-reading-layout'), 'adaptive');
    assert.equal(await page.locator('#mushaf-size-value').innerText(), '36');
    await page.locator('#mushaf-size-up').click(); await saved(page, 'mushaf_text_size', 38);
    await page.reload({waitUntil:'domcontentloaded'}); await page.waitForFunction(() => AllimAccountUI.initialized); await openMushaf(page);
    assert.equal(await page.locator('#mushaf-size-value').innerText(), '38');
    assert.deepEqual(posts, [], 'guest settings never reach a private write API');
    console.log('PASS guest choice survives reload in IndexedDB, with zero account POSTs');

    // Reusing this device must not silently import the guest size into account A.
    await page.close(); await login(first, 'a');
    const account = await pageFor(first); await openMushaf(account);
    assert.equal(await account.locator('#mushaf-size-value').innerText(), '36');
    await account.locator('#mushaf-size-up').click(); await account.locator('#mushaf-size-up').click();
    await saved(account, 'mushaf_text_size', 40, true);
    await account.locator('[data-mushaf-layout="page"]').click(); await saved(account, 'mushaf_layout', 'page', true);
    assert.equal(await account.locator('#mushaf-page').getAttribute('data-reading-layout'), 'page');
    console.log('PASS account A choices reach the real server; guest choice remains separate');

    const second = await context(browser, 1280); await login(second, 'a');
    const remote = await pageFor(second); await openMushaf(remote);
    assert.equal(await remote.locator('#mushaf-page').getAttribute('data-reading-layout'), 'page');
    await remote.locator('[data-mushaf-layout="adaptive"]').click();
    assert.equal(await remote.locator('#mushaf-size-value').innerText(), '40');
    await saved(remote, 'mushaf_layout', 'adaptive', true);
    await account.evaluate(() => AllimStorage.sync());
    await account.waitForFunction(() => document.querySelector('#mushaf-page').dataset.readingLayout === 'adaptive');
    console.log('PASS a clean browser profile restores server choices; live sync updates the first reader');

    await first.setOffline(true);
    await account.locator('#mushaf-size-up').click(); await saved(account, 'mushaf_text_size', 42);
    await first.setOffline(false); await account.evaluate(() => AllimStorage.sync());
    await saved(account, 'mushaf_text_size', 42, true);
    console.log('PASS offline account change queues locally and reaches the server after reconnect');

    const third = await context(browser); await login(third, 'b');
    const other = await pageFor(third); await openMushaf(other);
    assert.equal(await other.locator('#mushaf-size-value').innerText(), '36');
    await other.locator('#mushaf-size-down').click(); await saved(other, 'mushaf_text_size', 34, true);
    assert.equal((await read(account)).records.find(row => row.id === 'mushaf_text_size').value.selected, 42);
    await other.close(); await third.close();
    // A -> B -> A on the same physical browser profile must restore the right owner.
    await remote.close(); await login(second, 'b');
    const switched = await pageFor(second); await openMushaf(switched);
    assert.equal(await switched.locator('#mushaf-page').getAttribute('data-reading-layout'), 'page', 'B has no explicit layout on this desktop');
    await switched.locator('[data-mushaf-layout="adaptive"]').click();
    assert.equal(await switched.locator('#mushaf-size-value').innerText(), '34');
    await saved(switched, 'mushaf_layout', 'adaptive', true);
    await switched.close(); await login(second, 'a');
    const restored = await pageFor(second); await openMushaf(restored);
    assert.equal(await restored.locator('#mushaf-size-value').innerText(), '42');
    console.log('PASS different accounts and account changes on one device isolate reader preferences');
    await second.close();

    // Dense page, reading anchor, mobile controls, RTL, classic layout and exit.
    await account.locator('#mushaf-page-number').fill('3'); await account.locator('#mushaf-page-number').press('Enter');
    await account.waitForFunction(() => document.querySelectorAll('#mushaf-page .mushaf-glyph').length === 138);
    const anchor = await account.evaluate(() => {
      const scroller = document.querySelector('#ayah-wrap'); scroller.scrollTop = 240;
      const top = scroller.getBoundingClientRect().top;
      const node = [...document.querySelectorAll('#mushaf-page .mushaf-glyph')].find(n => n.getBoundingClientRect().bottom > top + 8);
      node.dataset.testAnchor = 'yes'; return node.getBoundingClientRect().top - top;
    });
    await account.locator('#mushaf-size-up').click(); await saved(account, 'mushaf_text_size', 44, true);
    await account.waitForFunction(offset => Math.abs(document.querySelector('[data-test-anchor]').getBoundingClientRect().top - document.querySelector('#ayah-wrap').getBoundingClientRect().top - offset) <= 2, anchor);
    await account.evaluate(() => { const scroller = document.querySelector('#ayah-wrap'); scroller.scrollTop = scroller.scrollHeight; });
    await account.waitForFunction(() => {
      const words = document.querySelectorAll('#mushaf-page .mushaf-glyph');
      return words[words.length - 1].getBoundingClientRect().bottom < document.querySelector('#allim-storage-panel').getBoundingClientRect().top;
    });
    // The user explicitly leaves earlier guest data separate before continuing.
    const keepSeparate = account.locator('#allim-import-offer button').last();
    if (await keepSeparate.count()) {
      await keepSeparate.click(); await account.waitForSelector('#allim-import-offer', {state:'detached'});
    }
    for (const [language,width] of [['ru',320],['en',390],['ar',430]]) {
      await account.setViewportSize({width,height:844});
      await account.evaluate(language => AllimStorage.mutate({kind:'preference',id:'language',value:{selected:language}}), language);
      await account.reload({waitUntil:'domcontentloaded'}); await account.waitForFunction(() => AllimAccountUI.initialized); await openMushaf(account);
      assert.equal(await account.locator('html').getAttribute('lang'), language);
      assert.ok(await account.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile horizontal overflow');
      const box = await account.locator('#mushaf-size-up').boundingBox(); assert.ok(box.width >= 44 && box.height >= 44);
      await account.screenshot({path:path.join(artifacts,`${engine}-${language}.png`)});
    }
    const selected = await account.locator('#verse-reference').innerText();
    await account.route('**/api/mushaf/page/604?*', async route => {
      await route.fulfill({status:503,json:{error:'temporary_fixture_failure'}});
    }, {times:1});
    await account.locator('#mushaf-page-number').fill('604'); await account.locator('#mushaf-page-number').press('Enter');
    await account.waitForSelector('#mushaf-page .mushaf-page-error button');
    assert.equal(await account.locator('#verse-reference').innerText(), selected, 'failed page load preserves selected verse');
    await account.locator('#mushaf-page .mushaf-page-error button').click();
    await account.waitForFunction(() => document.querySelectorAll('#mushaf-page .mushaf-glyph').length === 73);
    assert.equal(await account.locator('#mushaf-next-page').isDisabled(), true);
    console.log('PASS failed page keeps the selected verse; retry loads page 604 and disables Next');
    await account.locator('#mushaf-exit').click();
    assert.equal(await account.locator('body').evaluate(node => node.classList.contains('mushaf-view')), false);
    await account.waitForFunction(() => document.activeElement.id === 'open-quran-search');
    console.log('PASS reading anchor, Enter navigation, mobile RU/EN/AR, touch targets and exit focus');
    assert.deepEqual(errors, [], 'unhandled browser errors');
    await first.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
