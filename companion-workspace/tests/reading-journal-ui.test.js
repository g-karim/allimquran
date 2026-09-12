'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('/Users/rafael/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Fixtures verify accounting; they are not Quran source verification or an ASR quality test.
 await page.route('**/api/mushaf/page/**',r=>{const n=Number(r.request().url().match(/page\/(\d+)/)[1]);return r.fulfill({json:{page:n,verses:[{verse_key:'1:1',words:[{position:1,text_qpc_hafs:'بسم',page_number:n,char_type_name:'word'},{position:2,text_qpc_hafs:'الله',page_number:n,char_type_name:'word'}]}]}});});
 await page.goto('http://127.0.0.1:4187/?lang=ru&view=read',{waitUntil:'domcontentloaded'});
 const panel=page.locator('#reading-journal'); await panel.waitFor({state:'visible'}); await panel.locator(':scope > summary').click();
 await panel.locator('[data-j-form-details] summary').click();
 const form=panel.locator('[data-j-form]'); await form.locator('[name=to]').fill('2');await form.locator('[type=submit]').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('allim-reading-journal-v1'))?.entries.length===1);
 assert.match(await panel.locator('[data-j-value=pages]').textContent(),/^2 \/ 604/);
 assert.equal(await panel.locator('[data-j-value=reward]').textContent(),'140');
 await form.locator('[type=submit]').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('allim-reading-journal-v1'))?.entries.length===2);
 assert.match(await panel.locator('[data-j-value=pages]').textContent(),/^2 \/ 604/);
 assert.equal(await panel.locator('[data-j-value=volume]').textContent(),'4');
 await panel.locator('[data-j-settings]').locator('..').locator('summary').click();
 await panel.locator('[name=past]').fill('5');await panel.locator('[data-j-settings] [type=submit]').click();
 assert.equal(await panel.locator('[data-j-value=lifetime]').textContent(),'5');
 await page.reload({waitUntil:'domcontentloaded'}); await page.waitForFunction(()=>document.querySelector('[data-j-value=lifetime]')?.textContent==='5'); assert.equal(await panel.locator('[data-j-value=lifetime]').textContent(),'5');
 await panel.locator(':scope > summary').click();
 await page.screenshot({path:'/tmp/allim-reading-ru-mobile.png',fullPage:true});
 for(const lang of ['en','ar']){
  await page.goto('http://127.0.0.1:4187/?view=read&lang='+lang,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('[data-j-value=lifetime]')?.textContent==='5');
  await panel.locator(':scope > summary').click();
  assert.equal(await page.locator('html').getAttribute('dir'),lang==='ar'?'rtl':'ltr');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await panel.screenshot({path:'/tmp/allim-reading-'+lang+'-mobile.png'});
 }
 await page.setViewportSize({width:1280,height:900});await panel.screenshot({path:'/tmp/allim-reading-ar-desktop.png'});
 await page.route('**/api/mushaf/page/3?*',r=>r.fulfill({status:503,body:'unavailable'}));
 await panel.locator('[data-j-form-details] summary').click();
 await form.locator('[name=from]').fill('3'); await form.locator('[name=to]').fill('3'); await form.locator('[type=submit]').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('allim-reading-journal-v1'))?.entries.length===3);
 assert.equal(await panel.locator('[data-j-unknown]').isVisible(),true);
 await page.unroute('**/api/mushaf/page/3?*');
 await panel.locator('[data-j-retry]').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('allim-reading-journal-v1'))?.entries[2].parts[0].letters===7);
 assert.equal(await panel.locator('[data-j-unknown]').isVisible(),false);
 await panel.locator('[data-j-history]').locator('..').locator('summary').click();
 page.once('dialog',d=>d.accept()); await panel.locator('[data-j-undo]').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('allim-reading-journal-v1'))?.entries.length===2);
 assert.deepEqual(errors,[]); console.log('UI passed: manual saving, overlap, letter estimate, lifetime, persistence, EN/AR/RU, RTL and mobile overflow.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
