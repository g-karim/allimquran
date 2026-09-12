'use strict';
const BASE=process.env.ALLIM_TEST_ORIGIN || 'http://127.0.0.1:4187';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.ALLIM_PLAYWRIGHT_MODULE || 'playwright');
const {fresh}=require('../reading-journal.js');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})});
 const cloud={book:fresh(),revision:0,user:'reader@example.test',last:null};
 const errors=[];
 async function device(seed){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  if(seed)await context.addInitScript(book=>{if(!localStorage.getItem('allim-reading-journal-v1'))localStorage.setItem('allim-reading-journal-v1',JSON.stringify(book));},seed);
  await page.route('**/api/method/allimquran.reading_journal.*',async route=>{
   if(route.request().method()==='GET')return route.fulfill({json:{message:{...cloud,csrf:'csrf-fixture'}}});
   const input=route.request().postDataJSON();assert.equal(input.expected_user,cloud.user);assert.equal(route.request().headers()['x-frappe-csrf-token'],'csrf-fixture');
   if(input.operation===cloud.last)return route.fulfill({json:{message:{status:'replayed',user:cloud.user,revision:cloud.revision}}});
   if(input.revision!==cloud.revision)return route.fulfill({json:{message:{status:'conflict',...cloud}}});
   cloud.book=input.book;cloud.revision++;cloud.last=input.operation;
   return route.fulfill({json:{message:{status:'saved',user:cloud.user,revision:cloud.revision}}});
  });
  await page.goto(`${BASE}/?view=read&lang=ru`,{waitUntil:'domcontentloaded'});
  await page.locator('#reading-journal > summary').click();await page.locator('[data-sync-run]').click();
  await page.waitForFunction(()=>document.querySelector('[data-sync-state]')?.textContent.includes('История сохранена'));
  return page;
 }
 const first=await device({...fresh(),past:6});assert.equal(cloud.book.past,6);
 const second=await device();assert.equal(await second.locator('[data-j-value=lifetime]').textContent(),'6');
 assert.equal(await second.locator('[data-j-settings] [name=past]').inputValue(),'6');
 await first.locator('[data-j-settings]').locator('..').locator('summary').click();
 await first.locator('[data-j-settings] [name=past]').fill('7');await first.locator('[data-j-settings] [type=submit]').click();
 await first.waitForFunction(()=>document.querySelector('[data-sync-state]')?.textContent.includes('История сохранена'));
 assert.equal(cloud.book.past,7);
 await second.locator('[data-sync-run]').click();await second.waitForFunction(()=>document.querySelector('[data-j-value=lifetime]')?.textContent==='7');
 await second.locator('#reading-account-sync').screenshot({path:'/tmp/allim-sync-ru-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('Sync UI passed: connect, CSRF header, account binding, two browsers, automatic upload, cloud download and settings consistency.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
