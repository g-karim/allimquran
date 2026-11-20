const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.ALLIM_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),pageRoot=path.join(root,'allimquran/website_content/pages/learn');
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+fs.readFileSync(path.join(pageRoot,'css.css'))+'</style></head><body>'+fs.readFileSync(path.join(pageRoot,'main_section_html.html'))+'<script>'+fs.readFileSync(path.join(pageRoot,'javascript.js'))+'</script></body></html>';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/learn'){res.setHeader('content-type','text/html;charset=utf-8');res.end(html);return;}
 const relative=url.pathname.replace('/assets/allimquran/','');const file=path.resolve(root,'allimquran/public',relative);
 if(file.startsWith(path.join(root,'allimquran/public/'))&&fs.existsSync(file)&&fs.statSync(file).isFile()){
 res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));return;}
 res.statusCode=404;res.end();
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
 try{
 for(const lang of ['ru','en','ar']){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(lang=>{
 localStorage.setItem('allim-system-intro-seen-v1','1');
 window.__speech=[];window.SpeechRecognition=class{constructor(){window.__speech.push(this);}start(){queueMicrotask(()=>this.onstart?.());}stop(){this.onend?.();}abort(){this.onend?.();}};
 },lang);
 await context.route('**/api/**',route=>{
 const u=new URL(route.request().url());let data={};
 if(u.pathname.includes('account_storage.context'))data={message:{mode:'guest'}};
 else if(u.pathname.endsWith('/chapters'))data={chapters:[{id:1,name_arabic:'الفاتحة',name_simple:'Al-Fatihah',verses_count:7},{id:2,name_arabic:'البقرة',name_simple:'Al-Baqarah',verses_count:286}]};
 else if(u.pathname.includes('/locate/'))data={page:1};
 else if(u.pathname.includes('/mushaf/page/'))data=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/mushaf-comfort/page-'+u.pathname.split('/').at(-1)+'.json')));
 else if(u.pathname.endsWith('/research'))data={enabled:false};
 else if(u.pathname.endsWith('/health'))data={ready:false};
 else if(u.pathname.endsWith('get_logged_user'))data={message:'Guest'};
 if(u.pathname.includes('/mushaf/page/')) data.page=Number(u.pathname.split('/').at(-1));
 return route.fulfill({json:data});
 });
 await context.route('https://**',route=>route.abort());
 await page.goto(base+'/learn?view=read&intro=0&lang='+lang,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.AllimAccountUI?.initialized);
 await page.evaluate(async lang=>{
 for(const [id,selected] of Object.entries({language:lang,selectedSurah:1,selectedAyah:1,recognitionMode:'browser',recognitionModeExplicit:true,recitationFlow:'single',recitationFlowExplicit:true,autoAdvance:false,soundCues:false,mushafFont:'readable'})) await AllimStorage.mutate({kind:'preference',id,value:{selected}});
 },lang);
 // Existing preference schema does not expose every runtime switch: configure through the UI.
 await page.locator('#surah-select').selectOption('1');await page.locator('#ayah-select').selectOption('1');
 await page.locator('[data-reader-mode="mushaf"]').last().click();
 await page.waitForSelector('#mushaf-page .mushaf-glyph');
 for(const [width,height] of [[1440,1000],[768,1024],[390,844],[320,568],[844,390]]){
 await page.setViewportSize({width,height});await page.waitForTimeout(120);
 const positions=await page.evaluate(()=>{
 const ids=['recitation-panel','allim-journal-summary','allim-storage-panel'];
 const boxes=ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,w:r.width,h:r.height};});
 return{boxes,overflow:document.documentElement.scrollWidth>innerWidth+1,next:document.getElementById('mushaf-next-page').getBoundingClientRect().x,prev:document.getElementById('mushaf-prev-page').getBoundingClientRect().x};});
 assert(!positions.overflow,lang+' '+width+' overflow');assert(positions.next<positions.prev,'next page must be left');
 for(let i=0;i<positions.boxes.length;i++)for(let j=i+1;j<positions.boxes.length;j++){
 const a=positions.boxes[i],b=positions.boxes[j];assert(!(a.w&&a.h&&b.w&&b.h&&a.x<b.x+b.w-1&&a.x+a.w>b.x+1&&a.y<b.y+b.h-1&&a.y+a.h>b.y+1),JSON.stringify(positions));}
 results.push({lang,width,height,nonOverlapping:true});
 if(width===390||width===1440)await page.screenshot({path:path.join(root,'../'+lang+'-'+width+'.png')});
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#mushaf-next-page').click();await page.waitForFunction(()=>document.getElementById('mushaf-page-number').value==='2');
 await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.getElementById('mushaf-page-number').value==='3');
 await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.getElementById('mushaf-page-number').value==='2');
 await page.locator('#mushaf-prev-page').click();await page.waitForFunction(()=>document.getElementById('mushaf-page-number').value==='1');
 assert(await page.locator('#mushaf-prev-page').isDisabled());
 await page.locator('#mushaf-page').evaluate(node=>{
  node.dispatchEvent(new TouchEvent('touchstart',{touches:[new Touch({identifier:1,target:node,clientX:100,clientY:200})]}));
  node.dispatchEvent(new TouchEvent('touchend',{changedTouches:[new Touch({identifier:1,target:node,clientX:200,clientY:200})]}));
 });
 await page.waitForFunction(()=>document.getElementById('mushaf-page-number').value==='2');
 await page.locator('#mushaf-prev-page').click();await page.waitForFunction(()=>document.getElementById('mushaf-page-number').value==='1');
 await page.locator('#mushaf-page-number').fill('604');await page.locator('#mushaf-page-number').press('Enter');
 await page.waitForFunction(()=>document.getElementById('mushaf-next-page').disabled);
 await page.locator('#mushaf-page-number').fill('1');await page.locator('#mushaf-page-number').press('Enter');
 await page.waitForFunction(()=>document.getElementById('mushaf-prev-page').disabled);

 await page.locator('#allim-storage-panel summary').click();assert(await page.locator('#allim-storage-panel details').evaluate(el=>el.open));
 await page.locator('#allim-storage-panel summary').click();
 await page.locator('#allim-journal-summary button').click();assert(await page.locator('#allim-journal-dialog').evaluate(el=>el.open));await page.locator('#allim-journal-dialog button').first().click();
 // Node identity and listeners survive entry/exit.
 await page.locator('#mushaf-exit').click();assert.equal(await page.locator('#mushaf-reading-dock #recitation-panel').count(),0);

 if(lang==='ru'){
   await page.locator('#surah-select').selectOption('1');await page.locator('#ayah-select').selectOption('1');
   await page.evaluate(()=>{document.querySelector('[data-recognition-choice="browser"]').click();document.querySelector('[data-recitation-flow="single"]').click();});
   const start=async()=>{await page.locator('#start-recognition').click();await page.waitForFunction(()=>document.querySelector('#start-recognition').getAttribute('aria-pressed')==='true');};
   const emit=(text,final=true)=>page.evaluate(({text,final})=>window.__speech.at(-1).onresult({results:[Object.assign([{transcript:text}],{isFinal:final})]}),{text,final});
   const end=()=>page.evaluate(()=>window.__speech.at(-1).onend());
   await start();await emit('بسم الله');
   assert.equal(await page.locator('.quran-word.is-recognized').count(),2);
   assert.equal(await page.locator('.quran-word.is-error').count(),0);assert(await page.locator('#skip-recitation-check').isHidden());
   await end();await start();await emit('الله الرحمن',false);
   assert.equal(await page.locator('.quran-word.is-recognized').count(),2,'interim after a pause preserves confirmed words');
   await emit('الله الرحمن');assert.equal(await page.locator('.quran-word.is-recognized').count(),3);await end();
   await start();await emit('الرحيم');assert.equal(await page.locator('.quran-word.is-recognized').count(),4);
   await page.evaluate(()=>AllimStorage.chain);
   await page.locator('#ayah-select').selectOption('2');
   await start();await emit('خطأ خطأ');assert(await page.locator('#skip-recitation-check').isVisible());
   const countBefore=await page.evaluate(async()=> (await AllimStorage.snapshot()).records.filter(r=>r.kind==='learning_event').length);
   await page.locator('#skip-recitation-check').click();
   assert.equal(await page.locator('#ayah-select').inputValue(),'3');
   const countAfter=await page.evaluate(async()=> (await AllimStorage.snapshot()).records.filter(r=>r.kind==='learning_event').length);
   assert.equal(countBefore,countAfter,'skip must not credit a verse');
   await page.evaluate(()=>document.querySelector('[data-recitation-flow="continuous"]').click());
   await start();
   for(let n=0;n<4;n++){
    const before=await page.evaluate(()=>window.__speech.length);
    await page.evaluate(()=>window.__speech.at(-1).onerror({error:'no-speech'}));
    await page.waitForFunction(before=>window.__speech.length>before,before);
    await page.waitForFunction(()=>document.querySelector('#start-recognition').getAttribute('aria-pressed')==='true');
    assert.equal(await page.locator('.quran-word.is-error').count(),0);
   }
   await page.locator('#start-recognition').click();
   console.log('PASS silence across four continuous restarts stays non-blocking');
   console.log('PASS actual app: pause, repeated restart, interim stability, completion, skip without credit');
 }
 assert.deepEqual(errors,[],lang);await context.close();
 }
 fs.writeFileSync(path.join(root,'../browser-checks.json'),JSON.stringify(results,null,2));console.log('PASS '+results.length+' layouts, navigation, dock controls and restoration');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
