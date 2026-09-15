/* Real Chromium + isolated Frappe. Requires Playwright; no mocked storage API. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {randomUUID} = require("node:crypto");
const playwright = require(process.env.ALLIM_PLAYWRIGHT || "playwright");
const base = process.env.ALLIM_TEST_URL || "http://127.0.0.1:18133";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw Error("Local fixture URL required");
const credentials = JSON.parse(fs.readFileSync(process.env.ALLIM_TEST_CREDENTIALS));
const API = "**/api/method/allimquran.account_storage.*";
const errors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function pageFor(context, path = "/storage-harness") {
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + path, {waitUntil: "domcontentloaded"});
  await page.evaluate(() => window.fixtureReady || AllimAccountUI.ready);
  return page;
}
async function login(context, who) {
  const response = await context.request.post(base + "/api/method/login", {data: {usr: credentials[who].user, pwd: credentials[who].password}});
  assert.equal(response.status(), 200, "fixture login");
}
async function snapshot(page) { return page.evaluate(() => AllimStorage.snapshot()); }
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
async function finishImport(page) {
  for (let i=0;i<8;i++) {
    await sync(page);
    const reports=await page.evaluate(()=>AllimImport.report(AllimStorage));
    if (reports.length && reports.every(report=>report.done)) return reports;
  }
  throw Error('Import did not finish');
}
(async () => {
 const browser=await playwright.chromium.launch({channel:'chrome',headless:true});
 try {
  const context=await browser.newContext({timezoneId:'UTC'});
  const legacy={language:'ru',sessions:7,wordsReviewed:28,hints:2,savedVerses:['1:1','1:2'],reviewQueue:['1:3'],activity:{'2026-09-14':7},dailyGoal:3,selectedSurah:1,selectedAyah:2,heartMushaf:{units:{'1:1':{accepted:150,daily:{'2026-09-14':2}}},pages:{'1':{connectedAttempts:3}}},lifePractice:{entries:[{id:'life-old',verseKey:'1:1',reflection:'Прежнее размышление',action:'Сохранить',completed:true}]},futureMethod:{counter:42}};
  await context.addInitScript(legacy=>{
    localStorage.setItem('allim-system-intro-seen-v1','1');
    if(localStorage.getItem('import-fixture'))return;
    localStorage.setItem('import-fixture','1');
    localStorage.setItem('quran-companion-prototype-v4',JSON.stringify(legacy));
    localStorage.setItem('allim-language-preference-v1','en');
    localStorage.setItem('allim-academy-plan-v1',JSON.stringify({minutes:25,focus:'memorization',target:'Цель'}));
    localStorage.setItem('allim-academy-diagnostic-v1',JSON.stringify({minutes:15,level:'assisted',goal:'hifz',route:'hifz',createdAt:'2026-09-14T08:00:00.000Z'}));
  },legacy);
  let page=await pageFor(context);
  await mutate(page,{kind:'bookmark',id:'1:2',action:'delete'});
  const guestEvent=event(); await mutate(page,guestEvent);
  await login(context,'a'); await sync(page); await reset(page);
  assert.equal((await snapshot(page)).records.length,0,'old guest data requires explicit decision');
  await page.goto(base+'/home',{waitUntil:'domcontentloaded'}); await page.evaluate(()=>AllimAccountUI.ready);
  await page.locator('#allim-import-offer button').first().click();
  await page.locator('#allim-import-dialog select[name=language]').selectOption('en');
  assert.equal(await page.locator('#allim-import-dialog input[name=category]').count(),4);
  await page.locator('#allim-import-dialog button[type=submit]').click();
  let reports=await finishImport(page);
  assert.equal(reports[0].skipped,0);
  let state=await snapshot(page);
  assert.equal(record(state,'preference','language').value.selected,'en');
  assert.equal(record(state,'academy_plan','current').value.target,'Цель');
  assert.equal(record(state,'academy_diagnostic','current').value.level,'assisted');
  assert.ok(!record(state,'bookmark','1:2'));
  assert.equal(state.records.filter(r=>r.kind==='reflection').length,1);
  assert.equal(state.records.filter(r=>r.kind==='learning_event').length,1);
  let projected=await page.evaluate(()=>AllimStorage.snapshot().then(s=>AllimProgress.project(s.records,AllimAccountUI.catalogue)));
  assert.equal(projected.sessions,8);assert.equal(projected.wordsReviewed,32);
  assert.deepEqual(projected.heartMushaf.units['1:1'].weekCounts,[100,51,0]);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('quran-companion-prototype-v4')).futureMethod.counter),42);
  console.log('PASS real selection UI, language choice, full legacy progress plus newer guest event, source intact');

  const tab=await pageFor(context);
  const begin=async page=>page.evaluate(async()=>{const captured=await AllimImport.capture(AllimStorage);await AllimImport.start(AllimStorage,captured,['settings','bookmarks','notes','history'],'en');});
  let dropped=false;
  await context.route('**/api/method/allimquran.account_storage.apply',async route=>{
    if(!dropped && route.request().postDataJSON().operations.some(op=>op.action==='import_item')){dropped=true;const response=await route.fetch();assert.equal(response.status(),200);await route.abort('connectionreset');}else await route.continue();
  });
  await Promise.all([begin(page),begin(tab)]);
  await sync(tab); await context.unroute('**/api/method/allimquran.account_storage.apply');
  await page.reload();await page.evaluate(()=>AllimAccountUI.ready);
  await finishImport(page); await sync(tab);
  state=await snapshot(tab);
  assert.equal(state.records.filter(r=>r.kind==='reflection').length,1);
  assert.equal(state.records.filter(r=>r.kind==='learning_event').length,1);
  projected=await tab.evaluate(()=>AllimStorage.snapshot().then(s=>AllimProgress.project(s.records)));
  assert.equal(projected.sessions,8);
  assert.ok(dropped);
  console.log('PASS two tabs, lost real committed response, reload and repeat do not duplicate history');

  await tab.evaluate(()=>AllimStorage.logout());
  await mutate(tab,{kind:'reflection',id:'life-old',value:{verse_key:'1:1',reflection:'Later guest edit',action:'',completed:false}});
  await login(context,'a'); await sync(tab); await begin(tab); await finishImport(tab);
  const changed=await tab.evaluate(async()=>Object.values((await AllimImport.meta(AllimStorage,AllimStorage.stamp())).import_jobs).flatMap(job=>job.results).some(result=>result.verification==='skipped_changed_source'));
  assert.ok(changed,'receipt for old source text is not confirmation of its newer local edit');
  assert.equal((await snapshot(tab)).records.find(row=>row.kind==='reflection').value.reflection,'Прежнее размышление');
  console.log('PASS a later edit of an already imported source is reported, with its original backup retained');

  await reset(tab);
  await mutate(tab,event());await mutate(tab,setting('language','ar'));await sync(tab);
  await begin(tab); reports=await finishImport(tab);state=await snapshot(tab);
  assert.ok(reports[0].skipped>=2);
  assert.equal(record(state,'preference','language').value.selected,'ar');
  assert.ok(!record(state,'activity_baseline','totals'));
  assert.equal(state.records.filter(r=>r.kind==='reflection').length,1);
  console.log('PASS existing account settings and ambiguous totals remain; independent notes transfer with report');

  const bound=await browser.newContext();
  await bound.addInitScript(user=>{
    localStorage.setItem('allim-system-intro-seen-v1','1');
    localStorage.setItem('allim-reading-journal-v1',JSON.stringify({version:1,past:2,cycle:1,deadline:'',entries:[{id:'private-a',date:'2026-09-14',cycle:1,source:'paper',parts:[{page:1,full:true,keys:[],total:29,letters:null}]}]}));
    localStorage.setItem('allim-reading-sync-v1',JSON.stringify({user,revision:4,base:{},pending:null}));
  },credentials.a.user);
  await login(bound,'b'); const b=await pageFor(bound); await reset(b);
  let rejected=await b.evaluate(async()=>{try{await AllimImport.start(AllimStorage,await AllimImport.capture(AllimStorage),['journal']);return false;}catch(error){return error.code;}});
  assert.equal(rejected,'legacy_owner_mismatch');assert.equal((await snapshot(b)).records.length,0);
  await login(bound,'a');await sync(b);await reset(b);
  await b.evaluate(async()=>AllimImport.start(AllimStorage,await AllimImport.capture(AllimStorage),['journal']));
  await finishImport(b);state=await snapshot(b);
  assert.equal(state.records.filter(r=>r.kind==='reading_entry').length,1);
  assert.equal(record(state,'reading_past','baseline').value.completed_cycles,2);
  console.log('PASS old account-bound journal is refused for B and imported only for verified A');

  const quota=await browser.newContext(); const q=await pageFor(quota);await mutate(q,{kind:'bookmark',id:'1:7',value:{position:0}});
  await login(quota,'b');await sync(q);await reset(q);
  rejected=await q.evaluate(async()=>{navigator.storage.estimate=async()=>({quota:100,usage:99});try{await AllimImport.capture(AllimStorage);return false;}catch(error){return error.code;}});
  assert.equal(rejected,'quota_insufficient');assert.equal((await snapshot(q)).records.length,0);
  assert.equal((await q.evaluate(()=>AllimImport.report(AllimStorage))).length,0);
  console.log('PASS insufficient backup space stops transfer before server writes');
  await q.reload();await q.evaluate(()=>fixtureReady);
  await login(quota,'a');await sync(q);
  await quota.route(API,route=>route.abort('internetdisconnected'));
  await q.evaluate(async()=>AllimImport.start(AllimStorage,await AllimImport.capture(AllimStorage),['bookmarks']));
  await sync(q);await quota.unroute(API);
  await login(quota,'b');await sync(q);
  assert.ok(!record(await snapshot(q),'bookmark','1:7'));
  assert.equal((await q.evaluate(()=>AllimImport.report(AllimStorage))).length,0);
  await login(quota,'a');await sync(q);await finishImport(q);
  assert.ok(record(await snapshot(q),'bookmark','1:7'));
  console.log('PASS approved offline import stays with A through B login and resumes for A');
  assert.deepEqual(errors,[],'browser runtime errors');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
