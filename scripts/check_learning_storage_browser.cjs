/* Actual Learn UI + IndexedDB + Frappe/MariaDB. Only microphone and public Quran text are fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pw = require(process.env.ALLIM_PLAYWRIGHT || 'playwright');
const engine = process.env.ALLIM_TEST_BROWSER || 'chromium';
const base = process.env.ALLIM_TEST_URL || 'http://127.0.0.1:18643';
const artifacts=process.env.ALLIM_LEARNING_ARTIFACT_DIR || '/tmp/allim-learning-20261017';
fs.mkdirSync(artifacts,{recursive:true,mode:0o700});
assert.ok(['chromium','webkit','firefox'].includes(engine));
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const credentials = JSON.parse(fs.readFileSync(process.env.ALLIM_TEST_CREDENTIALS));
for (const who of ['a','b']) assert.equal(credentials[who].user, `allim-storage-${who}@example.invalid`);
const fixture = n => ({page:n,...JSON.parse(fs.readFileSync(path.join(__dirname,`../tests/fixtures/mushaf-comfort/page-${n}.json`)))});
const errors=[],passed=[],posts=[],profiles=[];
let transportCancellations=0;
const hostPattern=new URL(base).host.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const canceledRead=new RegExp('^(?:Fetch API cannot load https?:/)?/'+hostPattern+'/api/method/allimquran\\.account_storage\\.(context|scan|pull|image_parts)\\?.* due to access control checks\\.$');
const wait = ms => new Promise(r=>setTimeout(r,ms));
const rows = (s,kind) => s.records.filter(r=>r.kind===kind&&!r.deleted);
const snap = page => page.evaluate(()=>AllimStorage.snapshot());
function pass(text){passed.push(text);console.log('PASS '+text);}
async function context(browser){
 const options={viewport:{width:390,height:844},timezoneId:'UTC',reducedMotion:'reduce',serviceWorkers:'block'};
 let ctx;
 // WebKit ephemeral contexts cannot create legacy IndexedDB Blob files.
 if(engine==='webkit'){const profile=fs.mkdtempSync(path.join(artifacts,'webkit-profile-'));profiles.push(profile);ctx=await pw.webkit.launchPersistentContext(profile,{...options,headless:true});}
 else ctx=await browser.newContext(options);
 await ctx.exposeFunction('learningUnhandled',message=>errors.push('Unhandled rejection: '+message));
 await ctx.addInitScript(origin=>{
  if(location.origin!==origin)return;
  localStorage.setItem('allim-system-intro-seen-v1','1');
  class SpeechFixture{start(){window.speechFixture=this;queueMicrotask(()=>this.onstart?.());}stop(){this.onend?.();}abort(){this.onend?.();}emit(transcript,isFinal=true){const result=[{transcript,confidence:0.99}];result.isFinal=isFinal;this.onresult?.({resultIndex:0,results:[result]});}}
  window.SpeechRecognition=SpeechFixture;window.webkitSpeechRecognition=SpeechFixture;
  window.addEventListener('unhandledrejection',event=>window.learningUnhandled(String(event.reason)).catch(()=>{}));
 },new URL(base).origin);
 await ctx.route('**/api/mushaf/**',async route=>{
  const url=new URL(route.request().url());let data;
  if(url.pathname.endsWith('/chapters'))data={chapters:[]};
  else if(url.pathname.includes('/locate/'))data={page:url.pathname.includes('/1/')?1:2};
  else{const n=Number(url.pathname.split('/').at(-1));data=[1,2,3,604].includes(n)?fixture(n):null;}
  await route.fulfill({status:data?200:503,json:data||{error:'fixture_unavailable'}});
 });
 ctx.on('page',page=>page.on('pageerror',e=>{
  // WebKit can omit the native Fetch API prefix when serializing this handled
  // navigation/offline cancellation. JS promise failures are asserted separately.
  if(engine==='webkit'&&canceledRead.test(e.message)){transportCancellations++;return;}
  errors.push(e.message);
 }));
 ctx.on('request',r=>{if(r.method()==='POST'&&r.url().includes('account_storage.'))posts.push(r.url());});
 return ctx;
}
async function offline(ctx,value){
 // Playwright WebKit's global offline switch also blocks native Blob/FileReader I/O.
 // Isolate personal HTTP instead, while keeping local file reads available.
 if(engine==='webkit'){
  const pattern='**/api/method/allimquran.account_storage.*';
  if(value)await ctx.route(pattern,route=>route.abort('internetdisconnected'));
  else await ctx.unroute(pattern);
 }else await ctx.setOffline(value);
}
async function login(ctx,who){const r=await ctx.request.post(base+'/api/method/login',{data:{usr:credentials[who].user,pwd:credentials[who].password}});assert.equal(r.status(),200);}
async function open(ctx,route='/learn?view=memorize'){
 const p=await ctx.newPage();await p.goto(base+route,{waitUntil:'domcontentloaded'});await p.evaluate(()=>AllimAccountUI.ready);await p.waitForSelector('[data-mj-form=plan]',{state:'attached'});return p;
}
async function reload(p){await p.reload({waitUntil:'domcontentloaded'});await p.evaluate(()=>AllimAccountUI.ready);await p.waitForSelector('[data-mj-form=plan]',{state:'attached'});}
async function sync(p){
 for(let n=0;n<35;n++){
  await p.evaluate(()=>AllimStorage.sync());const s=await snap(p);
  const rejected=s.pending.filter(r=>r.status==='needs_choice');assert.deepEqual(rejected.map(r=>[r.kind,r.error]),[],'unexpected rejected learning draft');
  if(!s.pending.length&&!Object.values(s.imports).some(j=>!j.done))return s;
  await wait(150);
 }
 assert.fail('Sync did not settle');
}
async function reset(p){await p.evaluate(async()=>{await AllimStorage.sync();const stamp=AllimStorage.stamp();const confirmation=await AllimStorage.api('prepare_reset',{scope:'all_personal_progress'},stamp,true);await AllimStorage.api('reset',{scope:'all_personal_progress',confirmation:confirmation.confirmation,reset_id:crypto.randomUUID()},stamp,true);await AllimStorage.refreshContext(true);});}
async function quiet(p){await p.evaluate(async()=>{await AllimStorage.mutateMany([{kind:'preference',id:'sound_cues',value:{selected:false}},{kind:'preference',id:'auto_advance',value:{selected:false}},{kind:'preference',id:'recitation_flow',value:{selected:{mode:'single',explicit:true}}}]);await AllimStorage.setDevice({recognition:{mode:'browser',explicit:true}});});await reload(p);}
async function project(p){return p.evaluate(async()=>{const s=await AllimStorage.snapshot();return AllimLearning.project(s.records,AllimAccountUI.catalogue);});}
async function makeImage(p,label="ALLIM synthetic handwritten page"){return p.evaluate(async label=>{
 const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1200;const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,1600,1200);c.fillStyle='#333';c.font='48px serif';c.fillText(label,100,150);
 const noise=c.createImageData(384,384);let seed=1751;for(let i=0;i<noise.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;noise.data[i]=seed&255;noise.data[i+1]=(seed>>>8)&255;noise.data[i+2]=(seed>>>16)&255;noise.data[i+3]=255;}c.putImageData(noise,100,300);
 return canvas.toDataURL('image/png').split(',')[1];
 },label);}
async function plan(p){
 const count=rows(await snap(p),'memory_plan').length;const form=p.locator('[data-mj-form=plan]');await form.locator('..').locator('summary').click();await form.locator('select[name=surah]').selectOption('1');await form.locator('input[name=from]').fill('1');await form.locator('input[name=to]').fill('3');await form.locator('input[name=portion]').fill('2');await form.locator('button[type=submit]').click();await p.waitForFunction(async count=>(await AllimStorage.snapshot()).records.filter(r=>r.kind==='memory_plan'&&!r.deleted).length===count+1,count);
}
async function emitMemory(p,text){await p.waitForFunction(()=>document.querySelector('#memory-session-bar').dataset.phase==='listening');await p.waitForFunction(()=>!!window.speechFixture);await p.evaluate(text=>speechFixture.emit(text,true),text);await p.evaluate(()=>AllimStorage.chain);}
(async()=>{
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{}),...(engine==='firefox'?{firefoxUserPrefs:{'network.proxy.type':0}}:{})});
 const contexts=[];
 try{
  for(const who of ['a','b']){const c=await context(browser);await login(c,who);const p=await c.newPage();await p.goto(base+'/storage-harness');await p.evaluate(()=>fixtureReady);await reset(p);await c.close();}
  const c=await context(browser);contexts.push(c);const p=await open(c);const beforeGuestPosts=posts.length;
  const image=await makeImage(p);
  await p.evaluate(async image=>{
   localStorage.setItem('quran-companion-prototype-v4',JSON.stringify({language:'ru',selectedSurah:1,selectedAyah:1,recognitionMode:'browser',recognitionModeExplicit:true,soundCues:false,autoAdvance:false,recitationFlow:'single',recitationFlowExplicit:true,memorizationMethod:'linked33',hifzCoach:{selectionMode:'adaptive',signals:[]},heartMushaf:{linked33Pages:{1:{verseCounts:{'1:1':32},segmentCounts:{},daily:{}}},lawhPages:{'1:1':{verifiedAt:'2026-10-16T12:00:00.000Z',readCount:3,recallCount:1}}}}));
   localStorage.setItem('allim-memory-journey-v1',JSON.stringify({version:1,plans:[{id:'old-plan',action:'memorize',keys:['1:1','1:2'],portion:1,created:'2026-10-16',deadline:''}],sessions:[{id:'old-attempt',key:'1:1',mode:'test',date:'2026-10-16',complete:true,total:4,hints:0,flags:[1],dismissed:[],seconds:9}]}));
   const binary=atob(image);const blob=new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))],{type:'image/png'});
   const db=await new Promise((r,j)=>{const q=indexedDB.open('allim-lawh-library-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('pages',{keyPath:'id'});q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});
   await new Promise((r,j)=>{const tx=db.transaction('pages','readwrite');tx.objectStore('pages').put({id:'1:1',surahId:1,ayahNumber:1,blob,width:1600,height:1200,fileName:'legacy.png',fileType:'image/png',readCount:5,recallCount:2,verifiedAt:'2026-10-16T12:00:00.000Z',updatedAt:'2026-10-16T12:00:00.000Z'});tx.oncomplete=r;tx.onabort=()=>j(tx.error);});db.close();
   // A pre-existing personal DB must discover these newly supported legacy categories once.
   await AllimStorage.guarded(AllimStorage.stamp(),['scopes'],'readwrite',async stores=>{const q=stores.scopes.get(AllimStorage.control.guest_scope);await new Promise(r=>q.onsuccess=r);const meta=q.result;meta.legacy.learn=JSON.parse(localStorage.getItem('quran-companion-prototype-v4'));delete meta.learning_migrated;stores.scopes.put(meta);});
  },image);
  await reload(p);await p.waitForFunction(()=>document.querySelector('[data-hifz-method=linked33]').getAttribute('aria-pressed')==='true');
  let s=await snap(p);assert.equal(rows(s,'memory_plan').length,1);assert.equal(rows(s,'recall_attempt').length,1);assert.equal(rows(s,'lawh_photo').length,1);assert.equal((await project(p)).heartMushaf.linked33Pages[1].verseCounts['1:1'],32);
  assert.equal((await project(p)).heartMushaf.lawhPages['1:1'].readCount,5);assert.equal((await project(p)).heartMushaf.lawhPages['1:1'].recallCount,2);assert.equal(posts.length,beforeGuestPosts);pass('Legacy methods, recall plan and multipart photo restored locally; no private guest POST');

  await plan(p);assert.equal(rows(await snap(p),'memory_plan').length,2);await reload(p);assert.equal(rows(await snap(p),'memory_plan').length,2);pass('Guest plan created through the form and survives reload');
  await p.locator('#heart-start-practice').click();await emitMemory(p,'بسم الله الرحمن الرحيم');
  await p.waitForFunction(async()=>{const s=await AllimStorage.snapshot();return AllimLearning.project(s.records,AllimAccountUI.catalogue).heartMushaf.linked33Pages[1].verseCounts['1:1']===33;});
  assert.equal(rows(await snap(p),'hifz_credit').length,1);assert.equal(await p.evaluate(async()=>AllimProgress.project((await AllimStorage.snapshot()).records).heartMushaf.units['1:1']?.weekCounts?.[0]||0),0);
  await p.locator('[data-hifz-method=turkishWall33]').click();await p.locator('#heart-start-practice').click();
  const last=fixture(1).verses.at(-1);const text=last.words.filter(w=>w.char_type_name!=='end').map(w=>w.text_qpc_hafs).join(' ');await emitMemory(p,text);
  await p.waitForFunction(async()=>{const s=await AllimStorage.snapshot();return (AllimLearning.project(s.records,AllimAccountUI.catalogue).heartMushaf.turkishWallPages[1]?.verseCounts['1:7']||0)===1;});
  pass('Real reader matches full verses, advances linked 33 and Turkish wall independently, without crediting 300');

  await p.locator('[data-hifz-choice-mode=adaptive]').click();
  const credits=rows(await snap(p),'hifz_credit').length;
  const check=p.locator('[data-mj-test-form]');await check.locator('select[name=surah]').selectOption('1');await check.locator('button').click();
  await p.waitForFunction(async()=>{const s=await AllimStorage.snapshot();const key=s.records.find(r=>r.kind==='reading_position'&&!r.deleted)?.value.verse_key;return !!key&&ALLIMJourney.isCheck(key);});
  await p.waitForFunction(()=>document.querySelector('[data-mj-test-form]').hidden&&!document.querySelector('[data-mj-next]').disabled);const key=rows(await snap(p),'reading_position')[0].value.verse_key;await wait(950);assert.ok(await p.evaluate(key=>ALLIMJourney.isCheck(key),key));
  const checkText=await p.evaluate(key=>{const [surah,ayah]=key.split(':').map(Number);return QuranCompanionData.surahs.find(s=>s.id===surah).verses.find(v=>v.ayah===ayah).text;},key);
  await p.locator('#start-memory-recognition').click();await emitMemory(p,checkText);await p.waitForFunction(()=>ALLIMJourney.isCheckComplete());
  assert.equal(rows(await snap(p),'hifz_credit').length,credits);await p.locator('[data-mj-end]').click();pass('Quick recall check records an attempt and leaves memorization method counters unchanged');

  await p.locator('[data-hifz-method=mauritanianLawh]').click();await p.locator('#lawh-photo-input').setInputFiles({name:'new-page.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
  await p.waitForFunction(()=>!document.querySelector('#lawh-save-local').disabled);
  for(const input of await p.locator('[data-lawh-check]').all())await input.check();
  await p.locator('#lawh-verify-page').click();await p.locator('#lawh-mark-read').click();await p.locator('#lawh-mark-recall').click();await p.locator('#lawh-save-local').click();
  await p.waitForFunction(()=>document.querySelector('#lawh-save-local').disabled&&document.querySelector('#lawh-storage-status').textContent.includes('сохран')).catch(async error=>{
   console.error('Lawh save state',await p.evaluate(async()=>({status:document.querySelector('#lawh-storage-status').textContent,button:document.querySelector('#lawh-save-local').disabled,storage:AllimStorage.state,error:AllimStorage.error,photos:(await AllimStorage.snapshot()).records.filter(r=>r.kind==='lawh_photo').map(r=>({id:r.id,deleted:r.deleted}))})));
   throw error;
  });
  assert.ok(rows(await snap(p),'lawh_practice').length===2);assert.ok(rows(await snap(p),'lawh_image_part').length>1);pass('Lawh photo, manual line verification and self-reported reading/recall use durable owner-scoped records');

  const oldRaw=await p.evaluate(()=>localStorage.getItem('allim-memory-journey-v1'));
  await login(c,'a');await reload(p);assert.equal(rows(await snap(p),'memory_plan').length,0);assert.equal(rows(await snap(p),'lawh_photo').length,0);
  await p.evaluate(()=>AllimImportUI.review());await p.waitForSelector('#allim-import-dialog input[value=learning]');
  const dialog=p.locator('#allim-import-dialog');for(const input of await dialog.locator('input[name=category]').all())await input.uncheck();await dialog.locator('input[value=learning]').check();await dialog.locator('input[value=lawh]').check();await dialog.locator('input[value=settings]').check();await dialog.locator('button[type=submit]').click();
  s=await sync(p);assert.equal(rows(s,'memory_plan').length,2);assert.ok(rows(s,'lawh_photo').length>=1);fs.writeFileSync(path.join(artifacts,'import-diagnostic.json'),JSON.stringify(Object.values(s.imports).flatMap(j=>j.results.filter(r=>!['applied','noop'].includes(r.outcome)).map(r=>j.operations.find(o=>o.op_id===r.op_id)))));assert.deepEqual(Object.values(s.imports).flatMap(j=>j.results.filter(r=>!['applied','noop'].includes(r.outcome)).map(r=>({kind:j.operations.find(o=>o.op_id===r.op_id)?.kind,code:r.error?.code}))),[],'import rejections');
  assert.equal(await p.evaluate(()=>localStorage.getItem('allim-memory-journey-v1')),oldRaw);pass('Sign-in keeps guest work separate; explicit selected import preserves original keys and server receipts');

  await p.locator('[data-hifz-method=foundation300]').click();await sync(p);const c2=await context(browser);contexts.push(c2);await login(c2,'a');const p2=await open(c2);assert.ok((await snap(p2)).canonical.some(r=>r.kind==='lawh_image_part'&&r.payload_omitted),'account opens before downloading photo bytes');await quiet(p2);assert.equal((await project(p2)).heartMushaf.linked33Pages[1].verseCounts['1:1'],33);assert.equal((await project(p2)).heartMushaf.turkishWallPages[1].verseCounts['1:7'],1);await p2.locator('[data-hifz-method=mauritanianLawh]').click();
  s=await sync(p2);assert.equal(rows(s,'memory_plan').length,2);assert.equal((await p2.evaluate(()=>AllimLawh.list())).length,rows(s,'lawh_photo').length);
  const photos=await p2.evaluate(async()=>Promise.all((await AllimLawh.list()).map(async r=>({id:r.id,size:r.blob.size,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await r.blob.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('')}))));
  for(const photo of photos){assert.equal(photo.hash,require('node:crypto').createHash('sha256').update(Buffer.from(image,'base64')).digest('hex'));const meta=rows(s,'lawh_photo').find(r=>r.id===photo.id).value;assert.equal(photo.size,meta.bytes);assert.equal(photo.hash,meta.sha256);}
  pass('Clean second browser restores account methods, plans, Lawh counters and exact photo bytes');

  await p2.locator('[data-hifz-method=linked33]').click();await sync(p2);
  const peer=await open(c2);await p2.bringToFront();await p2.locator('#heart-start-practice').click();await emitMemory(p2,'الحمد لله رب العالمين');
  await peer.bringToFront();await peer.waitForFunction(()=>document.querySelector('[data-hifz-method=linked33]').getAttribute('aria-pressed')==='true');await peer.locator('#heart-start-practice').click();await emitMemory(peer,'الحمد لله رب العالمين');
  await p2.bringToFront();await sync(p2);assert.equal((await project(p2)).heartMushaf.linked33Pages[1].verseCounts['1:2'],2);await peer.close();
  pass('Two tabs record independent repetitions of the same step without overwriting or doubling them');

  await p2.locator('[data-hifz-method=mauritanianLawh]').click();
  await p2.locator('#lawh-library-list .lawh-library-card button').first().click();
  await p2.waitForSelector('#lawh-preview:not([hidden])');
  const replacement=await makeImage(p2,'Replacement page requires a new verification');
  await p2.locator('#lawh-photo-input').setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:Buffer.from(replacement,'base64')});
  await p2.waitForFunction(()=>!document.querySelector('#lawh-save-local').disabled);
  await p2.locator('#lawh-save-local').click();await sync(p2);await reload(p2);
  await p2.waitForSelector('#lawh-verification:not([hidden])');
  assert.equal(await p2.locator('#lawh-practice').isVisible(),false);
  for(const input of await p2.locator('[data-lawh-check]').all())await input.check();
  await p2.locator('#lawh-verify-page').click();await p2.waitForSelector('#lawh-practice:not([hidden])');await sync(p2);
  pass('A replacement photo cannot inherit the previous photo verification');

  const planId=rows(s,'memory_plan')[0].id;
  const oldPlan=rows(s,'memory_plan')[0];await p.evaluate(async v=>AllimStorage.mutate({kind:'memory_plan',id:v.id,value:{...v.value,portion:4},base_version:v.version}),oldPlan);await sync(p);
  await p2.evaluate(async v=>AllimStorage.mutate({kind:'memory_plan',id:v.id,value:{...v.value,portion:5},base_version:v.version}),oldPlan);
  await p2.evaluate(()=>AllimStorage.sync());s=await snap(p2);assert.ok(rows(s,'conflict').some(r=>r.value.target_kind==='memory_plan'&&r.value.status==='open'));
  const conflictValue=rows(s,'conflict').find(r=>r.value.target_kind==='memory_plan'&&r.value.status==='open').value.proposed_value;
  await p2.evaluate(async v=>AllimStorage.resolve('memory_plan',v.id,v.value),{id:planId,value:conflictValue});await sync(p2);pass('Concurrent plan edits preserve both versions and require an explicit choice');

  await offline(c2,true);await plan(p2);await p2.evaluate(async image=>{const blob=new Blob([Uint8Array.from(atob(image),c=>c.charCodeAt(0))],{type:'image/png'});await AllimLawh.save({id:'2:2',blob,width:1600,height:1200,fileName:'offline.png'});},image);
  s=await snap(p2);assert.ok(s.pending.some(r=>r.kind==='memory_plan'));assert.ok(s.pending.some(r=>r.kind==='lawh_photo'));
  const stampA=await p2.evaluate(()=>AllimStorage.stamp());const privateImage=rows(s,'lawh_photo')[0].value.image_id;
  await login(c2,'b');await offline(c2,false);await reload(p2);await p2.waitForFunction(()=>AllimStorage.auth?.legacy_owner==='allim-storage-b@example.invalid');
  s=await sync(p2);assert.equal(rows(s,'memory_plan').length,0);assert.equal(rows(s,'lawh_photo').length,0);assert.equal((await p2.evaluate(()=>AllimLawh.list())).length,0);
  assert.ok(await p2.evaluate(async image_id=>{try{await AllimStorage.api('image_parts',{image_id},AllimStorage.stamp());return false;}catch(e){return e.code==='photo_not_found';}},privateImage));const leaked=await p2.evaluate(async a=>{const [,account,epoch]=a.scope.split(':');const r=await fetch('/api/method/allimquran.account_storage.pull?after_seq=0',{headers:{'X-Allim-Account':account,'X-Allim-Epoch':epoch,'X-Allim-Session':a.session_binding}});return r.status;},stampA);assert.ok([401,403,404,409].includes(leaked));pass('Offline plan/photo queue survives account switch; account B cannot view or request account A data');
  let lostAck=false;await c2.route('**/api/method/allimquran.account_storage.apply',async route=>{if(!lostAck&&route.request().postDataJSON().operations.some(o=>o.kind==='lawh_photo')){lostAck=true;await route.fetch();await route.abort('connectionreset');}else await route.continue();});await login(c2,'a');await reload(p2);s=await sync(p2);await c2.unroute('**/api/method/allimquran.account_storage.apply');assert.ok(lostAck);assert.equal(rows(s,'memory_plan').length,3);assert.ok(rows(s,'lawh_photo').some(r=>r.id==='2:2'));pass('Returning to account A delivers its offline plan/photo once, including a lost acknowledgement');

  await p2.locator('[data-view=progress]:visible').first().click().catch(()=>p2.goto(base+'/learn?view=progress'));await p2.locator('[data-mj-label=recent]').click();await p2.waitForSelector('[data-mj-recent]');
  const flagged=rows(await snap(p2),'recall_attempt').find(r=>r.value.flags.length);
  const recent=p2.locator(`[data-session-id="${flagged.id}"]`);await recent.locator('summary').click();await recent.locator('button').first().click();await sync(p2);
  assert.ok(rows(await snap(p2),'recall_flag').some(r=>r.id===flagged.id+'/1'&&r.value.dismissed));pass('Incorrect recognition flags can be dismissed without rewriting the original attempt');

  const exported=await p2.evaluate(async()=>{
   const stamp=AllimStorage.stamp(),meta=await AllimStorage.api('export_data',{},stamp,true);
   const [,account,epoch]=stamp.scope.split(':');
   const response=await fetch('/api/method/allimquran.account_storage.download_export?export_id='+meta.export_id,{headers:{'X-Allim-Account':account,'X-Allim-Epoch':epoch,'X-Allim-Session':stamp.session_binding}});
   const body=await response.json();
   return {status:response.status,private:response.headers.get('cache-control').includes('no-store'),photos:body.records?.filter(r=>r.kind==='lawh_photo'&&!r.deleted).length,missing:body.records?.filter(r=>r.kind==='lawh_image_part'&&!r.deleted&&!r.value.data).length};
  });
  assert.equal(exported.status,200);assert.ok(exported.private);assert.ok(exported.photos>0);assert.equal(exported.missing,0);
  pass('Private server export includes complete photo bytes and remains separate from thin login scans');

  for(const locale of ['ru','en','ar']){await p2.locator('#language-switch').selectOption(locale);await p2.locator('[data-view=memorize]:visible').first().click();assert.ok(await p2.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow '+locale);await p2.screenshot({path:path.join(artifacts,`${engine}-${locale}.png`)});}
  pass('Mobile RU/EN/AR learning screens have no horizontal overflow');
  const deletedImage=rows(await snap(p2),'lawh_photo').find(r=>r.id==='2:2').value.image_id;await p2.evaluate(()=>AllimLawh.remove('2:2'));s=await sync(p2);const deleted=s.canonical.find(r=>r.kind==='lawh_photo'&&r.id==='2:2');assert.ok(deleted.deleted);assert.ok(s.canonical.filter(r=>r.kind==='lawh_image_part'&&r.id.startsWith(deletedImage+'/')).every(r=>r.deleted));
  pass('Deleting a Lawh photo tombstones its content; practice history remains');
  assert.deepEqual(errors,[],'unhandled browser errors');
  fs.writeFileSync(path.join(artifacts,`${engine}-report.json`),JSON.stringify({engine,version:browser.version(),offline_mode:engine==='webkit'?'personal HTTP unavailable; native local Blob reads available':'browser offline',native_read_cancellations:transportCancellations,unhandled_errors:errors,passed},null,2));
 }finally{for(const ctx of contexts)await ctx.close();await browser.close();for(const profile of profiles)fs.rmSync(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
