/* Fresh-session multi-tab regression: real Frappe, cookies, IndexedDB and SQL. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {randomUUID} = require('node:crypto');
const pw = require(process.env.ALLIM_PLAYWRIGHT || 'playwright');
const engine = process.env.ALLIM_TEST_BROWSER || 'chromium';
const base = process.env.ALLIM_TEST_URL || 'http://127.0.0.1:18643';
assert.ok(['chromium', 'webkit', 'firefox'].includes(engine));
assert.equal(new URL(base).protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const credentials = JSON.parse(fs.readFileSync(process.env.ALLIM_TEST_CREDENTIALS));
for (const who of ['a', 'b']) assert.equal(credentials[who].user, `allim-storage-${who}@example.invalid`);
if (process.env.ALLIM_TEST_REPORT) fs.rmSync(process.env.ALLIM_TEST_REPORT, {force:true});
const api = '/api/method/allimquran.account_storage.';
const errors = [], groups = [], responses = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const pass = message => { groups.push(message); console.log('PASS ' + message); };
async function poll(work, predicate, label) {
  const deadline = Date.now() + 30000;
  let last;
  while (Date.now() < deadline) {
    last = await work();
    if (predicate(last)) return last;
    await sleep(100);
  }
  assert.fail(label + (last?.state ? ` (${last.state}, ${last.error || 'no error'})` : ''));
}
async function login(browser, who) {
  const ctx = await browser.newContext({serviceWorkers:'block', viewport:{width:390,height:844}});
  await ctx.addInitScript(origin => {
    if (location.origin === origin) localStorage.setItem('allim-system-intro-seen-v1', '1');
  }, new URL(base).origin);
  ctx.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  ctx.on('response', response => {
    if (response.url().includes(api)) responses.push(response.status());
  });
  const response = await ctx.request.post(base + '/api/method/login', {
    data:{usr:credentials[who].user, pwd:credentials[who].password}
  });
  assert.equal(response.status(), 200, 'native login without a prewarmed context');
  return ctx;
}
async function tabs(ctx, who, route, synchronize = true) {
  // Hold the first context request in each tab until all six have arrived.
  // Only timing is controlled: every request reaches the real Frappe backend.
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = new Set();
  const matcher = '**/api/method/allimquran.account_storage.context?*';
  const intercept = async request => {
    const page = request.request().frame().page();
    if (!first.has(page)) {
      first.add(page);
      if (first.size === 6) release();
      await gate;
    }
    await request.continue();
  };
  if (synchronize) await ctx.route(matcher, intercept);
  const pages = await Promise.all(Array.from({length:6}, () => ctx.newPage()));
  for (const page of pages) {
    await page.exposeFunction('csrfUnhandled', message => errors.push(message));
    await page.addInitScript(() => window.addEventListener('unhandledrejection', event => {
      window.csrfUnhandled(String(event.reason)).catch(() => {});
    }));
  }
  try {
    await Promise.all(pages.map(page => page.goto(base + route, {waitUntil:'domcontentloaded'})));
    if (synchronize) await poll(async () => first.size, count => count === 6, 'six first contexts did not reach barrier');
    await Promise.all(pages.map(page => poll(
      () => page.evaluate(() => ({state:AllimStorage.state, error:AllimStorage.lastError, owner:AllimStorage.auth?.legacy_owner})),
      value => value.state === 'account_ready' && value.owner === credentials[who].user,
      'tab did not reach account_ready for the expected owner'
    )));
  } finally {
    release();
    if (synchronize) await ctx.unrouteAll({behavior:'wait'});
  }
  const auth = await Promise.all(pages.map(page => page.evaluate(() => ({
    token:AllimStorage.auth.csrf_token, binding:AllimStorage.auth.session_binding, scope:AllimStorage.control.scope
  }))));
  assert.equal(new Set(auth.map(row => row.token)).size, 1, 'shared session has exactly one token');
  assert.equal(new Set(auth.map(row => row.binding)).size, 1);
  assert.equal(new Set(auth.map(row => row.scope)).size, 1);
  return {pages, auth:auth[0]};
}
const snapshot = page => page.evaluate(() => AllimStorage.snapshot());
(async () => {
  const browser = await pw[engine].launch({headless:true,
    ...(engine === 'chromium' ? {channel:'chrome'} : {}),
    ...(engine === 'firefox' ? {firefoxUserPrefs:{'network.proxy.type':0}} : {})
  });
  try {
    const first = await login(browser, 'a');
    const cold = await tabs(first, 'a', '/storage-harness');
    pass('six simultaneous fresh-session tabs reach account_ready with one CSRF token');
    const ids = Array.from({length:6}, () => randomUUID());
    await Promise.all(cold.pages.map((page, index) => page.evaluate(id => AllimStorage.mutate({
      kind:'reflection', id, value:{verse_key:'1:1', reflection:'Synthetic concurrent CSRF test', action:'', completed:false}
    }), ids[index])));
    await Promise.all(cold.pages.map(page => poll(async () => {
      await page.evaluate(() => AllimStorage.sync());
      return snapshot(page);
    }, value => !value.pending.length && ids.every(id => value.canonical.some(row => row.id === id && !row.deleted)),
    'all six writes must be confirmed by the server in every tab')));
    pass('six concurrent writes are confirmed once in every tab with an empty outbox');

    // A second session for the same account starts with native Web Pages.
    // Their own boot-time get_csrf_token calls must also share the new token.
    const second = await login(browser, 'a');
    // Native pages start concurrently without delaying their own fetch timeout
    // while slower tabs render. The bare harness above forces the API barrier.
    const native = await tabs(second, 'a', '/learn?view=read', false);
    assert.equal(native.auth.scope, cold.auth.scope, 'same account in a clean browser profile');
    assert.notEqual(native.auth.token, cold.auth.token, 'CSRF tokens remain session-specific');
    assert.notEqual(native.auth.binding, cold.auth.binding);
    const restored = await snapshot(native.pages[0]);
    for (const id of ids) assert.equal(restored.canonical.filter(row => row.id === id && !row.deleted).length, 1);
    pass('six native reader tabs start together in a second profile and restore all server writes');
    for (const token of [null, 'invalid-fixture-token', cold.auth.token]) {
      const response = await second.request.post(base + api + 'open', {
        data:{}, headers:token ? {'X-Frappe-CSRF-Token':token} : {}
      });
      assert.equal(response.status(), 400);
      assert.equal((await response.json()).exc_type, 'CSRFTokenError');
      assert.ok(response.headers()['cache-control'].includes('no-store'));
      assert.ok(!response.headers()['set-cookie']);
    }
    const valid = await second.request.post(base + api + 'open', {
      data:{}, headers:{'X-Frappe-CSRF-Token':native.auth.token}
    });
    assert.equal(valid.status(), 200);
    pass('missing, wrong and other-session CSRF tokens are rejected; the current token works');
    await second.close(); await first.close();

    const other = await login(browser, 'b');
    const b = await tabs(other, 'b', '/storage-harness');
    assert.notEqual(b.auth.scope, cold.auth.scope);
    assert.ok(!(await snapshot(b.pages[0])).records.some(row => ids.includes(row.id)));
    await other.close();
    pass('six tabs for another account start correctly and cannot see the first account data');
    assert.ok(responses.length > 30, 'real account API traffic observed');
    assert.ok(responses.every(status => status === 200), 'no failed storage requests from any tab');
    assert.deepEqual(errors, [], 'no page errors or unhandled rejections');
    if (process.env.ALLIM_TEST_REPORT) fs.writeFileSync(process.env.ALLIM_TEST_REPORT, JSON.stringify({
      engine, browser:browser.version(), groups, tab_groups:3, tabs_per_group:6,
      account_api_responses:responses.length, failed_account_requests:0, page_errors:0
    }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
