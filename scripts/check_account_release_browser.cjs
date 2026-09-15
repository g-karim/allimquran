/* Full installed site: persistent browser restart, real login, mobile locales. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const pw = require(process.env.ALLIM_PLAYWRIGHT || 'playwright');
const engine = process.env.ALLIM_TEST_BROWSER || 'chromium';
const base = process.env.ALLIM_TEST_URL || 'http://127.0.0.1:18143';
assert.ok(['chromium','webkit','firefox'].includes(engine));
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const credentials = JSON.parse(fs.readFileSync(process.env.ALLIM_TEST_CREDENTIALS));
const options = {headless:true, ...(engine==='chromium'?{channel:'chrome'}:{}), viewport:{width:390,height:844}, timezoneId:'UTC'};
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'allim-release-profile-'));
 let context;
 const errors=[], privateWrites=[];
 async function launch(){
  context=await pw[engine].launchPersistentContext(profile,options);
  await context.addInitScript(origin=>{if(location.origin===origin)localStorage.setItem('allim-system-intro-seen-v1','1');},new URL(base).origin);
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  context.on('request',request=>{if(request.method()==='POST'&&request.url().includes('account_storage.'))privateWrites.push(request.url().split('.').at(-1));});
  return context.newPage();
 }
 try{
  let page=await launch();
  await page.goto(base+'/learn?view=read',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>AllimAccountUI.ready);
  await page.evaluate(()=>AllimStorage.mutate({kind:'bookmark',id:'1:6',value:{position:0}}));
  const scope=await page.evaluate(()=>AllimStorage.getStatus().scope);
  await context.close();
  page=await launch();
  await page.goto(base+'/learn?view=read',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>AllimAccountUI.ready);
  assert.equal(await page.evaluate(()=>AllimStorage.getStatus().scope),scope);
  assert.ok(await page.evaluate(()=>AllimStorage.snapshot().then(s=>s.records.some(r=>r.kind==='bookmark'&&r.id==='1:6'&&!r.deleted))));
  assert.deepEqual(privateWrites,[],'guest progress never posted');
  console.log('PASS browser process closes and reopens the same guest IndexedDB; no personal POST');
  for(const language of ['en','ru','ar']){
   await page.evaluate(async language=>AllimStorage.mutate({kind:'preference',id:'language',value:{selected:language}}),language);
   await page.reload({waitUntil:'domcontentloaded'});
   await page.evaluate(()=>AllimAccountUI.ready);
   await page.waitForSelector('#allim-journal-summary button');
   assert.equal(await page.locator('html').getAttribute('lang'),language);
   await page.locator('#allim-journal-summary button').click();
   const dialog=page.locator('#allim-journal-dialog');
   assert.equal(await dialog.getAttribute('dir'),language==='ar'?'rtl':'ltr');
   assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),'mobile dialog overflow');
   await page.screenshot({path:`/tmp/allim-release-${engine}-${language}.png`});
  }
  console.log('PASS mobile EN/RU/AR journal and RTL on real Frappe Web Page');
  await page.goto(base+'/login?redirect-to=%2Flearn%3Fview%3Dread',{waitUntil:'domcontentloaded'});
  await page.locator('#login_email').fill(credentials.a.user);
  await page.locator('#login_password').fill(credentials.a.password);
  await Promise.all([page.waitForURL('**/learn?view=read'),page.locator('.btn-login:not(.btn-login-with-email-link)').click()]);
  await page.evaluate(()=>AllimAccountUI.ready);
  await page.waitForFunction(()=>AllimStorage.state==='account_ready');
  const imports=page.locator('#allim-import-dialog');
  if(await imports.count()){
   await imports.locator('button').first().click();
   await page.reload({waitUntil:'domcontentloaded'});await page.evaluate(()=>AllimAccountUI.ready);
  }
  assert.ok((await page.evaluate(()=>AllimStorage.snapshot())).scope.startsWith('account:'));
  assert.ok(await page.evaluate(()=>AllimStorage.snapshot().then(s=>s.hasGuestData)));
  console.log('PASS real Frappe login form returns to reader; guest history remains separate');
  const lms=await context.newPage();await lms.goto(base+'/lms/courses',{waitUntil:'domcontentloaded'});
  assert.equal((await lms.locator('#app').count()),1,'LMS shell');
  await lms.waitForFunction(()=>document.querySelector('#app').children.length>0);
  console.log('PASS compiled LMS frontend mounts alongside ALLIM');
  assert.deepEqual(errors,[],'unhandled browser errors');
 }finally{if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
