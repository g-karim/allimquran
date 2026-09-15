/* Read the 10,002-row fixture through the real API and measure UI work. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const pw=require(process.env.ALLIM_PLAYWRIGHT||'playwright');
const engine=process.env.ALLIM_TEST_BROWSER||'chromium';
const base=process.env.ALLIM_TEST_URL||'http://127.0.0.1:18143';
assert.equal(base,'http://127.0.0.1:18143');
assert.ok(['chromium','webkit','firefox'].includes(engine));
const credentials=JSON.parse(fs.readFileSync(process.env.ALLIM_TEST_CREDENTIALS));
(async()=>{
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'UTC'});
  await context.addInitScript(origin=>{if(location.origin===origin)localStorage.setItem('allim-system-intro-seen-v1','1');},new URL(base).origin);
  const login=await context.request.post(base+'/api/method/login',{data:{usr:credentials.a.user,pwd:credentials.a.password}});assert.equal(login.status(),200);
  const page=await context.newPage();page.setDefaultTimeout(120000);
  const errors=[],scans=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('account_storage.scan?'))scans.push(r.status());});
  const started=Date.now();
  await page.goto(base+'/learn?view=read',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>AllimAccountUI.ready);
  await page.waitForSelector('#allim-journal-summary button');
  const bootstrapMs=Date.now()-started;
  const result=await page.evaluate(async()=>{
   const start=performance.now(),s=await AllimStorage.snapshot(),snapshotMs=performance.now()-start;
   const a=performance.now(),progress=AllimProgress.project(s.records,AllimAccountUI.catalogue),projectionMs=performance.now()-a;
   const b=performance.now(),journal=AllimJournal.summary(s.records,AllimAccountUI.catalogue,'2026-09-01'),journalMs=performance.now()-b;
   return {records:s.canonical.length,sessions:progress.sessions,entries:journal.entries.length,volume:journal.volume,current:journal.current,pending:s.pending.length,snapshotMs,projectionMs,journalMs};
  });
  assert.equal(result.records,10002);assert.equal(result.sessions,5000);assert.equal(result.entries,5000);assert.equal(result.volume,5000);assert.equal(result.current,1);assert.equal(result.pending,0);
  assert.equal(scans.length,51);assert.ok(scans.every(code=>code===200));
  const opened=Date.now();await page.locator('#allim-journal-summary button').click();await page.waitForSelector('[data-entry-id]');
  const dialogMs=Date.now()-opened,rendered=await page.locator('[data-entry-id]').count();assert.equal(rendered,30);
  const saved=Date.now();
  await page.evaluate(async()=>{const s=await AllimStorage.snapshot();const plan=s.records.find(r=>r.kind==='reading_plan'&&r.id==='current');await AllimStorage.mutate({kind:'reading_plan',id:'current',value:{...plan.value,deadline:plan.value.deadline==='2030-01-01'?'2030-01-02':'2030-01-01'}});for(let i=0;i<5;i++){await AllimStorage.sync();if(!(await AllimStorage.snapshot()).pending.length)break;}});
  await page.waitForFunction(()=>AllimStorage.snapshot().then(s=>s.pending.length===0));
  const saveMs=Date.now()-saved;
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({engine,bootstrapMs,scanPages:scans.length,...result,dialogMs,rendered,saveMs}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
