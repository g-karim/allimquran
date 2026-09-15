/* Real Chromium + isolated Frappe. Requires Playwright; no mocked storage API. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {randomUUID} = require("node:crypto");
const playwright = require(process.env.ALLIM_PLAYWRIGHT || "playwright");
const engine = process.env.ALLIM_TEST_BROWSER || "chromium";
if (!["chromium", "webkit", "firefox"].includes(engine)) throw Error("Unknown browser");
const launchOptions = {headless: true, ...(engine === "chromium" ? {channel: "chrome"} : {}), ...(engine === "firefox" ? {firefoxUserPrefs: {"network.proxy.type": 0}} : {})};
const base = process.env.ALLIM_TEST_URL || "http://127.0.0.1:18133";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw Error("Local fixture URL required");
const credentials = JSON.parse(fs.readFileSync(process.env.ALLIM_TEST_CREDENTIALS));
const API = "**/api/method/allimquran.account_storage.*";
const errors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function pageFor(context, path = "/storage-harness") {
  const page = await context.newPage();
  // WebKit reports a caught fetch cancellation as a native page error during
  // owner-change navigation. Still assert JS errors and unhandled rejections.
  page.on("pageerror", error => {
    if (engine === "webkit" && /^Fetch API cannot load .*account_storage\.(context|scan|pull)\?.* due to access control checks\.$/.test((error.stack || error.message).split("\n")[0])) {
      console.log("DIAGNOSTIC WebKit canceled an in-flight storage read during navigation");
    } else errors.push(error.stack || error.message);
  });
  await page.exposeFunction("fixtureUnhandled", message => errors.push(message));
  await page.addInitScript(() => window.addEventListener("unhandledrejection", event => {
    window.fixtureUnhandled(String(event.reason)).catch(() => {});
  }));
  await page.goto(base + path, {waitUntil: "domcontentloaded"});
  await page.evaluate(() => window.fixtureReady || AllimAccountUI.ready);
  return page;
}
async function login(context, who) {
  const response = await context.request.post(base + "/api/method/login", {data: {usr: credentials[who].user, pwd: credentials[who].password}});
  assert.equal(response.status(), 200, "fixture login");
}
async function snapshot(page) { return page.evaluate(() => AllimStorage.snapshot()); }
async function signedIn(page, who) {
  // A background sender in another tab can make one sync() skip the Web Lock.
  // Wait for the requested owner before using destructive fixture reset.
  await page.waitForFunction(async user => {
    await AllimStorage.sync();
    return AllimStorage.state === "account_ready" && AllimStorage.auth?.legacy_owner === user;
  }, credentials[who].user);
}
async function sync(page) {
  await page.evaluate(async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await AllimStorage.sync();
      const snapshot = await AllimStorage.snapshot();
      if (AllimStorage.state !== "account_ready" || !snapshot.pending.some(row => row.status === "queued" && !row.depends_on)) break;
    }
  });
}
async function reset(page) {
  await page.waitForFunction(() => !AllimStorage.running);
  await page.evaluate(async () => {
    const stamp = AllimStorage.stamp();
    const prepared = await AllimStorage.api("prepare_reset", {scope: "all_personal_progress"}, stamp, true);
    await AllimStorage.api("reset", {scope: "all_personal_progress", confirmation: prepared.confirmation, reset_id: crypto.randomUUID()}, stamp, true);
    await AllimStorage.refreshContext(true);
  });
}
async function mutate(page, intent) { return page.evaluate(value => AllimStorage.mutate(value), intent); }
function record(snapshot, kind, id) { return snapshot.records.find(row => row.kind === kind && row.id === id && !row.deleted); }
const setting = (id, selected) => ({kind: "preference", id, value: {selected}});
function event() {
  const now = new Date();
  return {kind: "learning_event", id: randomUUID(), value: {event_type: "verse_completed", attempt_id: randomUUID(), occurred_at: now.toISOString(), local_date: now.toISOString().slice(0, 10), utc_offset_minutes: 0, time_zone: "UTC", verse_key: "1:1", mode: "read", matched_words: 4, hints_used: 0, full_verse: true, alignment_complete: true, evidence: "client_alignment", ruleset: "current-300-v1"}};
}
(async () => {
  const browser = await playwright[engine].launch(launchOptions);
  try {
    const first = await browser.newContext({timezoneId: "UTC"});
    await first.addInitScript(() => {
      localStorage.setItem("allim-system-intro-seen-v1", "1");
      if (!localStorage.getItem("fixture-seeded")) {
        localStorage.setItem("quran-companion-prototype-v4", JSON.stringify({sessions: 7, wordsReviewed: 28, savedVerses: ["1:2"], language: "ru", lifePractice: {entries: []}}));
        localStorage.setItem("fixture-seeded", "1");
      }
    });
    const a = await pageFor(first);
    await mutate(a, setting("language", "ar"));
    await a.reload(); await a.evaluate(() => fixtureReady);
    assert.equal(record(await snapshot(a), "preference", "language").value.selected, "ar");
    assert.equal((await snapshot(a)).legacy.learn.sessions, 7);
    console.log("PASS guest IndexedDB survives reload; legacy source stays local");
    await login(first, "a"); await signedIn(a, "a"); await reset(a);
    assert.equal((await snapshot(a)).records.length, 0);
    assert.deepEqual((await snapshot(a)).legacy, {});
    const scopeA = (await snapshot(a)).scope;
    const a2 = await pageFor(first);
    await Promise.all([mutate(a, setting("language", "en")), mutate(a2, setting("show_meaning", false))]);
    await sync(a); await sync(a2);
    assert.equal((await snapshot(a)).pending.length, 0);
    assert.equal(record(await snapshot(a2), "preference", "language").value.selected, "en");
    assert.equal(record(await snapshot(a), "preference", "show_meaning").value.selected, false);
    console.log("PASS two tabs save independent changes to one account");

    await first.route(API, route => route.abort("internetdisconnected"));
    const fact = event();
    await mutate(a, fact); await sync(a);
    assert.equal((await snapshot(a)).pending.length, 1);
    await a.reload(); await a.evaluate(() => fixtureReady);
    assert.equal(await a.evaluate(() => AllimStorage.state), "account_offline");
    assert.equal((await snapshot(a)).pending[0].intent.id, fact.id);
    await first.unroute(API); await sync(a); await sync(a2);
    assert.equal((await snapshot(a)).pending.length, 0);
    assert.equal((await snapshot(a2)).records.filter(row => row.kind === "learning_event").length, 1);
    console.log("PASS offline queue survives reload and automatically reaches the server");

    let dropped = false;
    await a.route("**/api/method/allimquran.account_storage.apply", async route => {
      if (!dropped) { dropped = true; const response = await route.fetch(); assert.equal(response.status(), 200); assert.ok(!response.headers()["set-cookie"], "storage responses never replace login cookies"); await route.abort("connectionreset"); }
      else await route.continue();
    });
    const lost = event(); await mutate(a, lost); await sync(a);
    const pending = (await snapshot(a)).pending.find(row => row.id === lost.id);
    assert.ok(pending?.wire, "unchanged wire operation retained after lost response");
    await a.reload({waitUntil: "domcontentloaded"}); await a.evaluate(() => fixtureReady);
    await a.unroute("**/api/method/allimquran.account_storage.apply"); await sync(a);
    assert.equal((await snapshot(a)).pending.length, 0);
    assert.equal((await snapshot(a)).records.filter(row => row.kind === "learning_event").length, 2);
    console.log("PASS lost response after real SQL commit replays once");

    // Server expiry/cleanup is covered by check_account_storage_paging.py.
    // Inject that response once here to exercise the browser's recovery branch.
    await first.route(API, route => route.abort("internetdisconnected"));
    await mutate(a, {kind:"bookmark",id:"1:7",value:{position:7}});
    const queuedId = (await snapshot(a)).pending.find(row=>row.id==="1:7").op_id;
    let expired = false;
    await first.route("**/api/method/allimquran.account_storage.pull?*", async route => {
      if (!expired) { expired=true; await route.fulfill({status:409,contentType:"application/json",body:JSON.stringify({message:{error:{code:"cursor_expired"}}})}); }
      else await route.continue();
    });
    await first.unroute(API);
    for (let attempt=0; attempt<50 && !expired; attempt++) { await sync(a); if(!expired)await sleep(100); }
    assert.ok(expired);
    const recovering = await snapshot(a);
    assert.ok(recovering.pending.some(row=>row.op_id===queuedId) || record(recovering,"bookmark","1:7"));
    await first.unroute("**/api/method/allimquran.account_storage.pull?*"); await sync(a);
    assert.ok(record(await snapshot(a),"bookmark","1:7"));
    assert.equal((await snapshot(a)).pending.length,0);
    console.log("PASS expired cursor rebuild keeps and delivers the existing offline operation");

    // Dependent changes retain the predecessor's receipt version after a second edit.
    await first.route(API, route => route.abort("internetdisconnected"));
    await mutate(a, setting("arabic_size", 40));
    await mutate(a, setting("arabic_size", 52));
    assert.equal((await snapshot(a)).pending.filter(row => row.id === "arabic_size").length, 2);
    await first.unroute(API); await sync(a);
    assert.equal(record(await snapshot(a), "preference", "arabic_size").value.selected, 52);
    assert.equal((await snapshot(a)).pending.length, 0);
    console.log("PASS dependent local edits advance using receipt versions");

    const other = await browser.newContext({timezoneId: "UTC"});
    await login(other, "a"); const remote = await pageFor(other);
    const noteId = randomUUID();
    const note = reflection => ({kind: "reflection", id: noteId, value: {verse_key: "1:1", reflection, action: "", completed: false}});
    await mutate(a, note("first")); await sync(a); await sync(remote);
    await a.route(API, route => route.abort("internetdisconnected"));
    await mutate(a, note("local offline draft")); await sync(a);
    await mutate(remote, note("other browser version")); await sync(remote);
    await a.unroute(API); await sync(a);
    let conflict = (await snapshot(a)).canonical.find(row => row.kind === "conflict" && row.value.status === "open");
    assert.equal(conflict.value.proposed_value.reflection, "local offline draft");
    assert.equal((await snapshot(a)).pending[0].status, "needs_choice");
    await a.evaluate(({noteId}) => AllimStorage.resolve("reflection", noteId, {verse_key: "1:1", reflection: "chosen version", action: "", completed: false}), {noteId});
    await sync(a); await sync(remote);
    assert.equal(record(await snapshot(remote), "reflection", noteId).value.reflection, "chosen version");
    assert.equal((await snapshot(a)).pending.length, 0);
    console.log("PASS two browsers preserve both note versions and apply an explicit choice");

    // A clear in another tab invalidates this tab before any new write can occur.
    const beforeClear = (await snapshot(remote)).records.filter(row => !row.deleted).length;
    await a2.evaluate(() => AllimStorage.clearLocal());
    await sleep(500); await sync(a);
    assert.ok((await snapshot(a)).scope.startsWith("guest:"));
    await sync(remote);
    assert.equal((await snapshot(remote)).records.filter(row => !row.deleted).length, beforeClear);
    await a.evaluate(() => AllimStorage.resumeAccount()); await sync(a);
    assert.equal((await snapshot(a)).scope, scopeA);
    console.log("PASS clearing another tab affects local data only, preserving cloud records");

    // Queue survives logout for its owner; B sees neither A's notes nor A's outbox.
    await first.route(API, route => route.abort("internetdisconnected"));
    const recovery = event(); await mutate(a, recovery); await sync(a);
    await a.evaluate(() => AllimStorage.logout());
    await a.reload(); await a.evaluate(() => fixtureReady);
    assert.ok((await snapshot(a)).scope.startsWith("guest:"));
    assert.equal((await snapshot(a)).legacy.learn.sessions, 7);
    await first.unroute(API);
    await login(first, "b"); await signedIn(a, "b"); await reset(a);
    assert.notEqual((await snapshot(a)).scope, scopeA);
    assert.equal((await snapshot(a)).pending.length, 0);
    assert.equal((await snapshot(a)).records.length, 0);
    await login(first, "a"); await signedIn(a, "a"); await sync(a);
    assert.equal((await snapshot(a)).scope, scopeA);
    assert.equal(record(await snapshot(a), "learning_event", recovery.id).id, recovery.id);
    assert.equal((await snapshot(a)).pending.length, 0);
    console.log("PASS offline logout, B isolation and recovery only after A signs in again");

    // Real response is held while ownership changes; releasing it cannot update B.
    let release, reached;
    const held = new Promise(resolve => { reached = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    await a.route("**/api/method/allimquran.account_storage.apply", async route => {
      const response = await route.fetch(); assert.ok(!response.headers()["set-cookie"]); reached(); await gate; await route.fulfill({response});
    });
    const late = event(); await mutate(a, late);
    const run = a.evaluate(() => AllimStorage.sync());
    await held;
    await a.evaluate(() => AllimStorage.logout());
    await login(first, "b");
    await a.evaluate(() => AllimStorage.resumeAccount());
    release(); await run;
    await a.unroute("**/api/method/allimquran.account_storage.apply");
    await signedIn(a, "b"); await sync(a);
    assert.ok((await snapshot(a)).scope.startsWith("account:"));
    assert.notEqual((await snapshot(a)).scope, scopeA);
    assert.equal((await snapshot(a)).records.filter(row => row.kind === "learning_event").length, 0);
    console.log("PASS delayed committed response cannot populate another account");

    // Finish the owner-switch scenario before injecting an unrelated quota fault.
    // A late sibling-tab notification can otherwise change readiness mid-probe.
    await a2.close(); await remote.close(); await other.close();
    await a.reload(); await a.evaluate(() => fixtureReady);
    await signedIn(a, "b");
    await a.waitForFunction(() => AllimStorage.state === "account_ready" && !AllimStorage.paused).catch(async error => {
      console.log("Readiness diagnostic",await a.evaluate(()=>({state:AllimStorage.state,paused:AllimStorage.paused,running:AllimStorage.running,error:AllimStorage.lastError,locked:AllimStorage.control.locked,scope:AllimStorage.control.scope})));
      throw error;
    });
    // A browser storage failure is never reported as a durable save.
    await a.evaluate(() => {
      window.realTransaction = AllimStorage.transaction.bind(AllimStorage);
      AllimStorage.transaction = async (names, mode, work) => {
        if (mode === "readwrite" && names.includes("outbox")) throw new DOMException("Fixture quota", "QuotaExceededError");
        return window.realTransaction(names, mode, work);
      };
    });
    // Inspect the native exception before Playwright serializes it; Firefox's
    // transport does not include DOMException.name in the error message.
    const quotaError = await a.evaluate(async intent => {
      try { await AllimStorage.mutate(intent); return null; }
      catch (error) { return {name: error.name, message: error.message}; }
    }, setting("mushaf_ink", "sepia"));
    assert.equal(quotaError?.name, "QuotaExceededError");
    const backup = await a.evaluate(() => AllimStorage.exportLocal());
    assert.equal(backup.not_durably_saved.length, 1);
    assert.equal((await snapshot(a)).pending.length, 0);
    assert.ok(!JSON.stringify(backup).includes("session_binding"));
    assert.ok(!JSON.stringify(backup).includes("csrf_token"));
    await a.evaluate(() => { AllimStorage.transaction = window.realTransaction; });
    console.log("PASS IndexedDB failure leaves an exportable draft without claiming a durable save");

    // Verify actual UI wiring, including guest/user separation and Academy fields.
    await login(first, "a"); await signedIn(a, "a"); await sync(a);
    await a.goto(base + "/learn", {waitUntil: "domcontentloaded"});
    await a.waitForFunction(() => AllimAccountUI.initialized === true);
    await a.waitForFunction(() => !document.querySelector(".allim-web-root").inert);
    await a.evaluate(() => document.getElementById("daily-goal").value = "3");
    await a.locator("#daily-goal").dispatchEvent("change");
    await sync(a);
    assert.equal(record(await snapshot(a), "daily_goal", "current").value.sessions, 3);
    await a.locator("#open-life-practice-today").evaluate(button => button.click());
    await a.locator("#life-reflection").fill("A browser note saved from Learn");
    await a.locator("#life-action").fill("Return to this verse tomorrow");
    assert.equal(await a.locator("#life-reflection").inputValue(), "A browser note saved from Learn");
    await a.locator('#life-practice-form button[type="submit"]').click();
    await sync(a);
    const notes = await snapshot(a);
    if (!notes.canonical.some(row => row.kind === "reflection" && row.value?.reflection === "A browser note saved from Learn")) console.log("Note diagnostic",{state:await a.evaluate(()=>AllimStorage.getStatus()),pending:notes.pending.map(row=>({kind:row.kind,result:row.result,intent:row.intent}))});
    assert.ok(notes.canonical.some(row => row.kind === "reflection" && row.value?.reflection === "A browser note saved from Learn"));
    await a.goto(base + "/learn?view=memorize", {waitUntil: "domcontentloaded"});
    await a.waitForFunction(() => AllimAccountUI.initialized === true && !document.querySelector(".allim-web-root").inert);
    // Existing hint buttons complete an assisted exercise without fabricating alignment evidence.
    await a.locator("#reveal-word").waitFor({state: "visible"});
    for (let i = 0; i < 30 && await a.locator("#reveal-word").isEnabled(); i++) await a.locator("#reveal-word").click();
    await sync(a);
    const assisted = (await snapshot(a)).canonical.filter(row => row.kind === "learning_event" && row.value?.evidence === "assisted_completion");
    assert.equal(assisted.length, 1);
    assert.equal(assisted[0].value.full_verse, false);
    assert.equal(assisted[0].value.alignment_complete, false);
    assert.equal((await snapshot(a)).pending.length, 0);
    console.log("PASS Learn note form and real hint buttons save typed, honestly labelled events");
    await a.goto(base + "/academy", {waitUntil: "domcontentloaded"});
    await a.evaluate(() => AllimAccountUI.ready);
    await a.locator("#edit-plan").click();
    await a.locator("#plan-target-input").fill("Browser-tested learning plan");
    await a.locator("#save-plan").click();
    await sync(a);
    assert.equal(record(await snapshot(a), "academy_plan", "current").value.target, "Browser-tested learning plan");
    await a.locator("#start-diagnostic").click();
    await a.locator('label').filter({has: a.locator('[name="level"][value="independent"]')}).click();
    await a.locator('label').filter({has: a.locator('[name="goal"][value="hifz"]')}).click();
    await a.locator('#diagnostic-form button[type="submit"]').click();
    await sync(a);
    assert.equal(record(await snapshot(a), "academy_diagnostic", "current").value.route, "hifz");
    // The plan dialog keeps the version it displayed while another browser edits it.
    await a.locator("#edit-plan").click();
    await a.locator("#plan-target-input").fill("My open-form draft");
    const separate = await browser.newContext();
    await login(separate, "a"); const writer = await pageFor(separate);
    await mutate(writer, {kind:"academy_plan",id:"current",value:{minutes:20,focus:"memorization",target:"Newer remote plan"}});
    await sync(writer); await sync(a);
    await a.locator("#save-plan").click(); await sync(a);
    const planConflict = (await snapshot(a)).canonical.find(row => row.kind === "conflict" && row.value.status === "open" && row.value.target_kind === "academy_plan");
    assert.equal(planConflict.value.proposed_value.target, "My open-form draft");
    await a.evaluate(() => AllimStorage.resolve("academy_plan","current",{minutes:15,focus:"recitation",target:"My chosen plan"}));
    await sync(a); await writer.close(); await separate.close();
    console.log("PASS an open Academy form conflicts with a newer remote edit instead of overwriting it");
    await a.setViewportSize({width: 390, height: 844});
    await a.evaluate(() => { document.documentElement.lang = "ar"; document.documentElement.dir = "rtl"; });
    await a.locator("#allim-storage-panel summary").click();
    await a.screenshot({path: "/tmp/allim-stage4-mobile-rtl.png"});
    assert.equal(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "mobile has no horizontal overflow");
    console.log("PASS Learn goal, Academy plan/diagnostic, Arabic mobile storage controls");
    await a.goto(base + "/home?lang=en", {waitUntil: "domcontentloaded"});
    await a.evaluate(() => AllimAccountUI.ready);
    await a.locator("#language-switch").waitFor();
    await a.waitForFunction(() => !document.getElementById("language-switch").disabled);
    assert.equal(await a.getAttribute("html", "lang"), "en");
    await a.locator("#language-switch").selectOption("tr"); await sync(a);
    assert.equal(record(await snapshot(a), "preference", "language").value.selected, "tr");
    assert.equal(await a.getAttribute("html", "lang"), "tr");
    await a.goto(base + "/learn", {waitUntil: "domcontentloaded"});
    await a.waitForFunction(() => AllimAccountUI.initialized === true);
    await a.locator("#daily-goal").evaluate(input => {input.value="2";input.dispatchEvent(new Event("change",{bubbles:true}));});
    await sync(a);
    assert.equal(record(await snapshot(a), "preference", "language").value.selected, "tr");
    console.log("PASS Home locale sync; Learn fallback preserves a locale it cannot display");
    // Two first opens share IDB control; neither tab remains stranded on an old generation.
    const simultaneous = await browser.newContext(); await login(simultaneous,"a");
    const initialTabs = await Promise.all([pageFor(simultaneous),pageFor(simultaneous)]);
    for (const tab of initialTabs) { await sync(tab); assert.equal(await tab.evaluate(()=>AllimStorage.state),"account_ready"); }
    assert.equal((await snapshot(initialTabs[0])).scope,(await snapshot(initialTabs[1])).scope);
    await simultaneous.close();
    console.log("PASS simultaneous first opens converge on one owner and usable cache");

    // An epoch reset quarantines old offline work instead of resurrecting progress.
    await a.goto(base + "/storage-harness", {waitUntil:"domcontentloaded"}); await a.evaluate(()=>fixtureReady);
    await a.route(API,route=>route.abort("internetdisconnected"));
    const obsolete = event(); await mutate(a,obsolete); await sync(a);
    const resetting = await browser.newContext(); await login(resetting,"a"); const resetter=await pageFor(resetting); await reset(resetter);
    await a.unroute(API); await sync(a);
    assert.equal((await snapshot(a)).records.filter(row=>row.kind==="learning_event").length,0);
    assert.equal((await snapshot(a)).pending.length,0);
    assert.ok((await a.evaluate(()=>AllimStorage.exportLocal())).previous_epochs.some(row=>row.id===obsolete.id));
    await resetting.close();
    console.log("PASS an account reset isolates old offline work and keeps a recoverable copy");
    await a.evaluate(()=>AllimStorage.discardPreviousEpochs());
    assert.equal((await a.evaluate(()=>AllimStorage.exportLocal())).previous_epochs.length,0);
    await a.route(API,route=>route.abort("internetdisconnected"));
    await mutate(a,event()); await sync(a);
    await a.evaluate(()=>AllimStorage.clearLocal({discardPending:true}));
    await a.unroute(API); await a.evaluate(()=>AllimStorage.resumeAccount()); await sync(a);
    assert.equal((await snapshot(a)).pending.length,0);
    assert.equal((await snapshot(a)).records.filter(row=>row.kind==="learning_event").length,0);
    console.log("PASS explicit local draft removal cannot recreate or delete cloud progress");

    // A known expired session must not become offline account access after a later network error.
    await a.evaluate(()=>AllimStorage.api("end_session",{},AllimStorage.stamp(),true));
    await sync(a);
    assert.equal(await a.evaluate(()=>AllimStorage.state),"account_locked");
    assert.equal((await snapshot(a)).scope,null);
    await a.route(API,route=>route.abort("internetdisconnected")); await sync(a);
    assert.equal(await a.evaluate(()=>AllimStorage.state),"account_locked");
    await a.unroute(API);
    console.log("PASS session expiry hides private state and stays locked through offline errors");
    const noStorage = await browser.newContext();
    await noStorage.addInitScript(() => Object.defineProperty(window,"indexedDB",{value:undefined}));
    const blocked = await noStorage.newPage();
    await blocked.goto(base + "/learn", {waitUntil:"domcontentloaded"});
    await blocked.waitForFunction(() => AllimStorage.state === "storage_error");
    assert.equal(await blocked.locator(".allim-web-root").evaluate(node=>node.inert),true);
    await blocked.waitForFunction(() => /Не удалось сохранить|Could not save|تعذّر الحفظ/.test(document.querySelector("#allim-storage-panel")?.textContent || ""));
    await noStorage.close();
    console.log("PASS unavailable IndexedDB keeps the saving error and recovery controls visible");
    assert.deepEqual(errors, [], "no uncaught browser exceptions");
    console.log("ALL BROWSER CHECKS PASSED");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
