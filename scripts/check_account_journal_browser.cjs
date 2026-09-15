/* Real Chromium + isolated Frappe. Requires Playwright; no mocked storage API. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {randomUUID} = require("node:crypto");
const playwright = require(process.env.ALLIM_PLAYWRIGHT || "playwright");
const engine = process.env.ALLIM_TEST_BROWSER || "chromium";
if (!["chromium", "webkit", "firefox"].includes(engine)) throw Error("Unknown browser");
const launchOptions = {headless: true, ...(engine === "chromium" ? {channel: "chrome"} : {})};
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
async function installReaderFixture(context){
 await context.addInitScript(()=>{
  localStorage.setItem('allim-system-intro-seen-v1','1');
  if(!localStorage.getItem('journal-fixture')){
   localStorage.setItem('journal-fixture','1');localStorage.setItem('quran-companion-prototype-v4',JSON.stringify({language:'ru',selectedSurah:2,selectedAyah:2,recognitionMode:'browser',recognitionModeExplicit:true,recitationFlow:'single',recitationFlowExplicit:true,autoAdvance:false,soundCues:false}));
  }
  class SpeechFixture{
   start(){window.speechFixture=this;queueMicrotask(()=>this.onstart?.());}
   stop(){this.onend?.();}abort(){this.onend?.();}
   emit(transcript,isFinal){const result=[{transcript,confidence:0.99}];result.isFinal=isFinal;this.onresult?.({resultIndex:0,results:[result]});}
  }
  window.SpeechRecognition=SpeechFixture;window.webkitSpeechRecognition=SpeechFixture;
 });
}
async function learn(page){await page.goto(base+'/learn?view=read',{waitUntil:'domcontentloaded'});await page.evaluate(()=>AllimAccountUI.ready);await page.waitForSelector('#allim-journal-summary button');}
async function entries(page){return(await snapshot(page)).records.filter(row=>row.kind==='reading_entry'&&!row.deleted);}
async function reading(page,text,final=true){
 await page.locator('#start-recognition').click();
 await page.waitForFunction(()=>document.querySelector('#recitation-panel').classList.contains('is-listening'));
 await page.evaluate(({text,final})=>window.speechFixture.emit(text,final),{text,final});
 await page.evaluate(()=>AllimStorage.chain);
}
async function addManual(page,from,to){
 await page.locator('#allim-journal-summary button').click();
 await page.locator('#allim-journal-dialog').getByRole('button',{name:'Добавить чтение',exact:true}).click();
 await page.locator('#allim-journal-entry input[name=from]').fill(String(from));
 await page.locator('#allim-journal-entry input[name=to]').fill(String(to));
 await page.locator('#allim-journal-entry button[type=submit]').click();
 await page.locator('#allim-journal-dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
}
(async()=>{
 const browser=await playwright[engine].launch(launchOptions);
 try{
  const context=await browser.newContext({timezoneId:'UTC'});await installReaderFixture(context);const page=await pageFor(context,'/learn?view=read');
  await page.waitForSelector('#allim-journal-summary button');
  await reading(page,'ذلك الكتاب لا ريب فيه هدى للمتقين',false);
  await page.evaluate(()=>speechFixture.onend?.());
  assert.equal((await entries(page)).length,0,'interim whole verse and onend cannot earn journal credit');
  await learn(page);await reading(page,'هذا الكتاب لا ريب فيه هدى للمتقين');
  assert.equal((await entries(page)).length,0,'wrong word cannot earn journal credit');
  await learn(page);await reading(page,'ذلك الكتاب لا ريب فيه هدى للمتقين');
  await page.waitForFunction(()=>AllimStorage.snapshot().then(s=>s.records.some(row=>row.kind==='reading_entry')));
  assert.equal((await entries(page)).length,1);
  await page.evaluate(()=>speechFixture.emit('ذلك الكتاب لا ريب فيه هدى للمتقين',true));
  assert.equal((await entries(page)).length,1,'duplicate final callback');
  await reading(page,'ذلك الكتاب لا ريب فيه هدى للمتقين');
  assert.equal((await entries(page)).length,2,'a real repeat uses a new attempt');
  let data=await page.evaluate(()=>AllimStorage.snapshot().then(s=>AllimJournal.summary(s.records,AllimAccountUI.catalogue,AllimProgress.timing().local_date)));
  assert.equal(data.volume,2*data.current);
  await learn(page);assert.equal((await entries(page)).length,2);
  console.log('PASS actual reader matcher: interim/end and mismatch get no journal entry; accepted final/repeat/reload are correct');

  await addManual(page,1,2);
  data=await page.evaluate(()=>AllimStorage.snapshot().then(s=>AllimJournal.summary(s.records,AllimAccountUI.catalogue,AllimProgress.timing().local_date)));
  assert.equal(data.current,2);assert.ok(data.volume>2);
  await page.locator('#allim-journal-summary button').click();
  const manual=(await entries(page)).find(row=>row.value.evidence==='self_reported');
  await page.locator(`[data-entry-id="${manual.id}"]`).getByRole('button',{name:'Исправить',exact:true}).click();
  await page.locator('#allim-journal-entry select[name=range]').selectOption('pages');
  await page.locator('#allim-journal-entry input[name=from]').fill('1');await page.locator('#allim-journal-entry input[name=to]').fill('1');
  await page.locator('#allim-journal-entry button[type=submit]').click();
  assert.equal((await entries(page)).find(row=>row.id===manual.id).value.parts.length,1);
  const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
  await page.locator('#allim-journal-goal input[name=deadline]').fill(tomorrow);await page.locator('#allim-journal-goal button[type=submit]').click();
  await page.locator('#allim-journal-past input[name=past]').fill('3');await page.locator('#allim-journal-past button[type=submit]').click();
  assert.equal(record(await snapshot(page),'reading_past','baseline').value.completed_cycles,3);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator(`[data-entry-id="${manual.id}"]`).getByRole('button',{name:'Удалить',exact:true}).click();
  assert.equal((await entries(page)).length,2);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#allim-journal-dialog').getByRole('button',{name:'Начать новый хатм',exact:true}).click();
  data=await page.evaluate(()=>AllimStorage.snapshot().then(s=>AllimJournal.summary(s.records,AllimAccountUI.catalogue,AllimProgress.timing().local_date)));
  assert.equal(data.current,0);assert.equal(data.cycles.length,2);assert.equal(data.past,3);assert.equal(data.entries.length,2);
  await page.locator('#allim-journal-dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
  console.log('PASS manual range, correction, deletion, deadline, past cycles and new current cycle preserve history');

  await login(context,'a');await page.goto(base+'/storage-harness');await page.evaluate(()=>fixtureReady);await reset(page);
  await mutate(page,setting('recitation_flow',{mode:'single',explicit:true}));await mutate(page,setting('auto_advance',false));await sync(page);await learn(page);
  let dropped=false;await context.route('**/api/method/allimquran.account_storage.apply',async route=>{
   if(!dropped&&route.request().postDataJSON().operations.some(op=>op.kind==='reading_entry')){dropped=true;const response=await route.fetch();assert.equal(response.status(),200);await route.abort('connectionreset');}else await route.continue();
  });
  await reading(page,'ذلك الكتاب لا ريب فيه هدى للمتقين');await sync(page);await context.unroute('**/api/method/allimquran.account_storage.apply');await sync(page);
  assert.ok(dropped);assert.equal((await entries(page)).length,1);assert.equal((await snapshot(page)).pending.length,0);
  let accepted=(await entries(page))[0];const id=accepted.id;
  const other=await browser.newContext({timezoneId:'UTC'});await installReaderFixture(other);await login(other,'a');const second=await pageFor(other,'/learn?view=read');await sync(second);
  assert.equal((await entries(second))[0].id,id);
  await second.locator('#allim-journal-summary button').click();await second.locator(`[data-entry-id="${id}"]`).getByRole('button',{name:'Исправить',exact:true}).click();
  await page.locator('#allim-journal-summary button').click();await page.locator(`[data-entry-id="${id}"]`).getByRole('button',{name:'Исправить',exact:true}).click();
  await page.locator('#allim-journal-entry select[name=range]').selectOption('pages');await page.locator('#allim-journal-entry input[name=from]').fill('3');await page.locator('#allim-journal-entry input[name=to]').fill('3');await page.locator('#allim-journal-entry button[type=submit]').click();await sync(page);
  await sync(second);await second.locator('#allim-journal-entry select[name=range]').selectOption('pages');await second.locator('#allim-journal-entry input[name=from]').fill('4');await second.locator('#allim-journal-entry input[name=to]').fill('4');await second.locator('#allim-journal-entry button[type=submit]').click();await sync(second);
  let s=await snapshot(second);assert.ok(s.records.some(row=>row.kind==='conflict'&&row.value.status==='open'));
  assert.equal(s.canonical.find(row=>row.kind==='reading_entry').value.parts[0].page,3);
  assert.equal((await second.evaluate(()=>AllimStorage.snapshot().then(s=>AllimProgress.project(s.records)))).sessions,1,'journal edits never rewrite learning/hifz');
  console.log('PASS real server lost response, second browser, concurrent journal edit conflict and independent hifz totals');

  await second.locator('#allim-journal-dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
  await second.setViewportSize({width:390,height:844});await second.evaluate(()=>{document.documentElement.lang='ar';document.documentElement.dir='rtl';});
  await second.locator('#allim-journal-summary button').click();
  assert.equal(await second.locator('#allim-journal-dialog').getAttribute('dir'),'rtl');
  assert.ok(await second.locator('#allim-journal-dialog').evaluate(element=>element.scrollWidth<=element.clientWidth));
  await second.screenshot({path:`/tmp/allim-journal-mobile-ar-${engine}.png`});
  await login(other,'b');
  await Promise.all([
   second.waitForNavigation({waitUntil:'domcontentloaded'}),
   sync(second).catch(error=>{if(!error.message.includes('Execution context was destroyed'))throw error;})
  ]);
  await second.evaluate(()=>AllimAccountUI.ready);
  await second.waitForFunction(()=>!document.querySelector('#allim-journal-dialog'));
  assert.ok(!(await entries(second)).some(row=>row.id===id));
  console.log('PASS Arabic mobile journal fits; account switch closes private form and hides old entries');
  const oldBook={version:1,past:2,cycle:1,deadline:'2026-10-01',entries:[{id:'legacy-reading',date:'2026-09-14',cycle:1,source:'paper',parts:[{page:1,full:true,keys:[],total:29,letters:null}]}]};
  const legacy=await browser.newContext();await installReaderFixture(legacy);await legacy.addInitScript(book=>localStorage.setItem('allim-reading-journal-v1',JSON.stringify(book)),oldBook);
  const old=await pageFor(legacy,'/learn?view=read');await old.waitForSelector('#allim-journal-summary button');
  assert.equal((await entries(old)).length,1);assert.equal(record(await snapshot(old),'reading_past','baseline').value.completed_cycles,2);
  await learn(old);assert.equal((await entries(old)).length,1);
  const guestEntry=(await entries(old))[0];
  await old.locator('#allim-journal-summary button').click();await old.locator(`[data-entry-id="${guestEntry.id}"]`).getByRole('button',{name:'Исправить',exact:true}).click();
  await old.locator('#allim-journal-entry button[type=submit]').click();
  const keys=await old.evaluate(()=>AllimStorage.snapshot().then(s=>s.records.find(row=>row.kind==='reading_entry').source_key));assert.ok(keys);
  await login(legacy,'a');await old.goto(base+'/storage-harness');await old.evaluate(()=>fixtureReady);await reset(old);
  await old.evaluate(async()=>AllimImport.start(AllimStorage,await AllimImport.capture(AllimStorage),['journal']));
  for(let i=0;i<4;i++)await sync(old);
  assert.equal((await entries(old)).length,1);assert.equal(record(await snapshot(old),'reading_past','baseline').value.completed_cycles,2);
  console.log('PASS old guest journal is backed up and normalized once, remains editable, then transfers without duplicate raw entries');
  assert.deepEqual(errors,[],'browser runtime errors');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
