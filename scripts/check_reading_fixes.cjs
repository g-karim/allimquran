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
 const context=await browser.newContext({hasTouch:true,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));let useEditionFixture=false;
 await context.addInitScript(lang=>{
 localStorage.setItem('allim-system-intro-seen-v1','1');
 window.__speech=[];window.SpeechRecognition=class{constructor(){window.__speech.push(this);}start(){queueMicrotask(()=>this.onstart?.());}stop(){this.onend?.();}abort(){this.onend?.();}};
 },lang);
 await context.route('**/api/**',route=>{
 const u=new URL(route.request().url());let data={};
 if(u.pathname.includes('account_storage.context'))data={message:{mode:'guest'}};
 else if(u.pathname.endsWith('/chapters'))data={chapters:[{id:1,name_arabic:'الفاتحة',name_simple:'Al-Fatihah',verses_count:7},{id:2,name_arabic:'البقرة',name_simple:'Al-Baqarah',verses_count:286},{id:91,name_arabic:'الشمس',name_simple:'Ash-Shams',verses_count:15},{id:92,name_arabic:'الليل',name_simple:'Al-Layl',verses_count:21},{id:93,name_arabic:'الضحى',name_simple:'Ad-Duha',verses_count:11},{id:112,name_arabic:'الإخلاص',name_simple:'Al-Ikhlas',verses_count:4}]};
 else if(u.pathname.includes('/locate/'))data={page:u.pathname.includes('/112/')?604:1};
 else if(useEditionFixture && u.pathname.endsWith('/mushaf/page/595'))data=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/mushaf-comfort/page-595.json')));
 else if(u.pathname.endsWith('/mushaf/page/595'))data={page:595,verses:['وَٱلشَّمۡسِ وَضُحَىٰهَا','وَٱلۡقَمَرِ إِذَا تَلَىٰهَا','وَٱلنَّهَارِ إِذَا جَلَّىٰهَا'].map((text,i)=>({verse_key:'91:'+(i+1),verse_number:i+1,page_number:595,words:text.split(' ').map((word,j)=>({position:j+1,char_type_name:'word',text_qpc_hafs:word,code_v1:word,code_v2:word,line_number:i+3,page_number:595}))}))};
 else if(u.pathname.includes('/mushaf/page/'))data=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/mushaf-comfort/page-'+u.pathname.split('/').at(-1)+'.json')));
 else if(u.pathname.endsWith('/research'))data={enabled:false};
 else if(u.pathname.endsWith('/health'))data={ready:false};
 else if(u.pathname.endsWith('get_logged_user'))data={message:'Guest'};
 if(u.pathname.includes('/mushaf/page/')) data.page=Number(u.pathname.split('/').at(-1));
 return route.fulfill({json:data});
 });
 await context.route('https://**',route=>{if(process.env.ALLIM_PAGE595_FONT && route.request().url().includes('/v1/woff2/p595.woff2'))return route.fulfill({body:fs.readFileSync(process.env.ALLIM_PAGE595_FONT),contentType:'font/woff2'});return route.abort();});
 await page.goto(base+'/learn?view=read&intro=0&lang='+lang,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.AllimAccountUI?.initialized);
 await page.evaluate(async lang=>{
 for(const [id,selected] of Object.entries({language:lang,selectedSurah:1,selectedAyah:1,recognitionMode:'browser',recognitionModeExplicit:true,recitationFlow:'single',recitationFlowExplicit:true,autoAdvance:false,soundCues:false,mushafFont:'readable'})) await AllimStorage.mutate({kind:'preference',id,value:{selected}});
 },lang);
 // Existing preference schema does not expose every runtime switch: configure through the UI.
 await page.locator('#surah-select').selectOption('1');await page.locator('#ayah-select').selectOption('1');
 await page.locator('[data-reader-mode="mushaf"]').last().click();
 await page.waitForSelector('#mushaf-page .mushaf-glyph');
 for(const [width,height] of [[1440,900],[1280,720],[768,1024],[390,844],[320,568],[844,390]]){
 await page.setViewportSize({width,height});await page.waitForTimeout(120);
 const positions=await page.evaluate(()=>{
 const ids=['recitation-panel','allim-journal-summary','allim-storage-panel'];
 const boxes=ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,w:r.width,h:r.height};});
 return{boxes,overflow:document.documentElement.scrollWidth>innerWidth+1,next:document.getElementById('mushaf-next-page').getBoundingClientRect().x,prev:document.getElementById('mushaf-prev-page').getBoundingClientRect().x};});
 assert(!positions.overflow,lang+' '+width+' overflow');
 const sheet=await page.locator('#mushaf-page').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,dock:document.getElementById('mushaf-reading-dock').getBoundingClientRect().top}});
 assert(sheet.top>=0&&sheet.bottom<=sheet.dock+2,JSON.stringify({lang,width,sheet}));if(width>600) assert(positions.next<positions.prev,'next page must be left');
 if(width<=600) assert.equal(await page.locator('#mushaf-next-page').evaluate(el=>getComputedStyle(el).clipPath),'inset(50%)');
 for(let i=0;i<positions.boxes.length;i++)for(let j=i+1;j<positions.boxes.length;j++){
 const a=positions.boxes[i],b=positions.boxes[j];assert(!(a.w&&a.h&&b.w&&b.h&&a.x<b.x+b.w-1&&a.x+a.w>b.x+1&&a.y<b.y+b.h-1&&a.y+a.h>b.y+1),JSON.stringify(positions));}
 results.push({lang,width,height,nonOverlapping:true});
 if(width===390||width===1440)await page.screenshot({path:path.join(root,'../'+lang+'-'+width+'.png')});
 }
 await page.setViewportSize({width:1440,height:1000});
 assert.equal(await page.locator('#mushaf-next-page svg').evaluate(el=>getComputedStyle(el).transform),'none');
 assert.equal(await page.locator('#mushaf-prev-page svg path').getAttribute('d'),'M5 12h14m-5-5 5 5-5 5');
 await page.locator('#mushaf-next-page').click();await page.waitForFunction(()=>document.getElementById('mushaf-page-number').value==='2');
 await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.getElementById('mushaf-page-number').value==='3');
 await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.getElementById('mushaf-page-number').value==='2');
 await page.locator('#mushaf-prev-page').click();await page.waitForFunction(()=>document.getElementById('mushaf-page-number').value==='1');
 assert(await page.locator('#mushaf-prev-page').isDisabled());
 await page.locator('#mushaf-page').evaluate(node=>{
  document.querySelector('[data-mushaf-layout="page"]').click();
  node.dispatchEvent(new TouchEvent('touchstart',{touches:[new Touch({identifier:1,target:node,clientX:100,clientY:200})]}));
  node.dispatchEvent(new TouchEvent('touchend',{changedTouches:[new Touch({identifier:1,target:node,clientX:200,clientY:200})]}));
 });
 await page.waitForFunction(()=>document.getElementById('mushaf-page-number').value==='2');
 await page.locator('#mushaf-prev-page').click();await page.waitForFunction(()=>document.getElementById('mushaf-page-number').value==='1');
 await page.locator('#mushaf-page-number').fill('604');await page.locator('#mushaf-page-number').press('Enter');
 await page.waitForFunction(()=>document.getElementById('mushaf-next-page').disabled);
 await page.locator('#mushaf-page-number').fill('1');await page.locator('#mushaf-page-number').press('Enter');
 await page.waitForFunction(()=>document.getElementById('mushaf-prev-page').disabled);

 await page.locator('.mushaf-appearance-picker > summary').click();
 await page.locator('#allim-storage-panel summary').click();assert(await page.locator('#allim-storage-panel details').evaluate(el=>el.open));
 await page.locator('#allim-storage-panel summary').click();
 await page.locator('#allim-journal-summary button').click();assert(await page.locator('#allim-journal-dialog').evaluate(el=>el.open));await page.locator('#allim-journal-dialog button').first().click();
 // Node identity and listeners survive entry/exit.
 await page.locator('.mushaf-appearance-picker > summary').click();
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
   await page.locator('.mushaf-appearance-picker > summary').click();
   await page.locator('#ayah-select').selectOption('1');
   await page.locator('.mushaf-appearance-picker > summary').click();
   await start();
   await emit('بسم الله الرحمن الرحيم');
   await page.waitForFunction(()=>document.getElementById('ayah-select').value==='2');
   await page.waitForFunction(()=>document.querySelector('#start-recognition').getAttribute('aria-pressed')==='true');
   await page.locator('#start-recognition').click();
   await page.locator('#mushaf-page-number').fill('595');await page.locator('#mushaf-page-number').press('Enter');
   await page.waitForSelector('[data-verse-key="91:1"]');
   const sunEvents=()=>page.evaluate(async()=>{await AllimStorage.chain;return (await AllimStorage.snapshot()).records.filter(r=>r.kind==='learning_event' && r.value.event_type==='verse_completed' && ['91:1','91:2'].includes(r.value.verse_key)).length;});
   for(const width of [1440,390]) {
     await page.setViewportSize({width,height:900});
     const selectFirst=async()=>{await page.locator('[data-verse-key="91:1"]').first().click();};
     await selectFirst();await start();
     await emit('والشمس وضحاها');
     await page.waitForFunction(()=>document.querySelector('[data-verse-key="91:2"].is-current'));
     await page.waitForFunction(()=>document.querySelector('#start-recognition').getAttribute('aria-pressed')==='true');
     await emit('والقمر');await end();
     await page.waitForFunction(()=>document.querySelector('#start-recognition').getAttribute('aria-pressed')==='true');
     await emit('إذا تلاها');
     await page.waitForFunction(()=>document.querySelector('[data-verse-key="91:3"].is-current'));
     await page.waitForFunction(()=>document.querySelector('#start-recognition').getAttribute('aria-pressed')==='true');
     await page.locator('#start-recognition').click();
     const beforeCombined=await sunEvents();
     await selectFirst();await start();
     await emit('والشمس وضحاها والقمر إذا تلاها',false);
     assert.equal(await sunEvents(),beforeCombined,'interim must not persist progress');
     assert(await page.locator('[data-verse-key="91:1"]').first().evaluate(e=>e.classList.contains('is-current')),'interim cannot advance');
     await emit('والشمس وضحاها والقمر إذا تلاها');
     await page.waitForFunction(()=>document.querySelector('[data-verse-key="91:3"].is-current'));
     await page.waitForFunction(()=>document.querySelector('#start-recognition').getAttribute('aria-pressed')==='true');
     await page.locator('#start-recognition').click();
     assert.equal(await sunEvents(),beforeCombined+2,'each completed ayah credited exactly once');
     await selectFirst();await start();
     await emit('والشمس وضحاها والقمر');
     await page.waitForFunction(()=>document.querySelector('[data-verse-key="91:2"].is-recognized'));
     await page.waitForFunction(()=>document.querySelector('#start-recognition').getAttribute('aria-pressed')==='true');
     assert.equal(await sunEvents(),beforeCombined+3,'carried partial ayah gets no credit');
     await emit('إذا تلاها');
     await page.waitForFunction(()=>document.querySelector('[data-verse-key="91:3"].is-current'));
     await page.waitForFunction(()=>document.querySelector('#start-recognition').getAttribute('aria-pressed')==='true');
     await page.locator('#start-recognition').click();
     assert.equal(await sunEvents(),beforeCombined+4,'carried partial resumes and earns one credit');
   }
   await page.locator('#mushaf-exit').click();
   await page.setViewportSize({width:1440,height:900});
   await page.locator('[data-view="memorize"]').first().click();
   await page.locator('#heart-surah-select').selectOption('112');
   await page.locator('#heart-ayah-select').selectOption('1');
   await page.locator('#hifz-practice-panel > summary').click();
   for(const width of [1440,390]) {
     await page.setViewportSize({width,height:900});
     await page.locator('#reset-memory').click();
     await page.locator('#start-memory-recognition').click();
     await page.waitForFunction(()=>document.getElementById('start-memory-recognition').getAttribute('aria-pressed')==='true');
     await emit('قل هو الله');
     assert.equal(await page.locator('[data-answer-word].is-correct').count(),1);
     const capturesBeforePause=await page.evaluate(()=>window.__speech.length);
     await end();
     await page.waitForFunction(n=>window.__speech.length>n,capturesBeforePause);
     await page.waitForFunction(()=>document.getElementById('start-memory-recognition').getAttribute('aria-pressed')==='true');
     assert.equal(await page.locator('[data-answer-word].is-correct').count(),1,'capture restart keeps confirmed word');
     await emit('أَحَدْ');
     assert.equal(await page.locator('[data-answer-word].is-correct').count(),2,'stopped ahad reveals last word');
     await page.locator('#stop-memory-recognition').click();
   }
   await page.locator('#heart-surah-select').selectOption('93');
   await page.locator('#heart-ayah-select').selectOption('2');
   await page.locator('#heart-start-practice').click();
   await page.waitForFunction(()=>document.getElementById('start-memory-recognition').getAttribute('aria-pressed')==='true');
   assert((await page.locator('#memory-reference').textContent()).includes('93:2'));
   assert.equal(await page.locator('#heart-surah-select').inputValue(),'93');
   assert.equal(await page.locator('#heart-ayah-select').inputValue(),'2');
   await emit('والليل إذا سجى');
   assert.equal(await page.locator('[data-answer-word].is-correct').count(),2,'both hidden words of 93:2 reveal');
   await page.locator('#stop-memory-recognition').click();
   await page.setViewportSize({width:1440,height:900});
   await page.locator('[data-view="read"]').first().click();
   await page.locator('[data-reader-mode="mushaf"]').last().click();
   useEditionFixture=true;
   await page.locator('.mushaf-appearance-picker > summary').click();
   await page.locator('#mushaf-font-select').selectOption('classic');
   await page.locator('#mushaf-page-number').fill('595');await page.locator('#mushaf-page-number').press('Enter');
   await page.waitForSelector('[data-verse-key="92:14"]');
   for(const width of [1440,390]) {
     await page.setViewportSize({width,height:900});
     await page.locator('.mushaf-appearance-picker > summary').click();
     await page.locator('[data-mushaf-layout="page"]').click();
     await page.waitForTimeout(150);
     const before=await page.locator('#mushaf-page').evaluate(e=>({width:e.getBoundingClientRect().width,lines:[...e.querySelectorAll('.mushaf-line')].map(x=>x.textContent),keys:[...e.querySelectorAll('.mushaf-glyph')].map(x=>x.dataset.verseKey)}));
     assert.equal(before.keys[0],'91:1');assert.equal(before.keys.at(-1),'92:14');
     await page.locator('#mushaf-size-up').click();await page.waitForTimeout(150);
     const after=await page.locator('#mushaf-page').evaluate(e=>({width:e.getBoundingClientRect().width,lines:[...e.querySelectorAll('.mushaf-line')].map(x=>x.textContent),layout:e.dataset.readingLayout}));
     assert.equal(after.layout,'page');assert.deepEqual(after.lines,before.lines);assert(after.width>before.width*1.05);
     await page.locator('#mushaf-size-down').click();await page.waitForTimeout(150);
     await page.locator('.mushaf-appearance-picker > summary').click();
     if(process.env.ALLIM_PAGE595_FONT)await page.screenshot({path:'/tmp/allim-book-'+width+'.png'});
   }
   console.log('PASS book page595: verse order, desktop/mobile zoom preserves every line');
   console.log('PASS hidden-memory desktop/mobile: prefix, pause/restart, ahad at stop and word reveal');
   console.log('PASS Ash-Shams desktop/mobile: two ayahs, pause, resumed microphone, combined utterance and interim guard');
   console.log('PASS completed recitation automatically advances and resumes listening');
   console.log('PASS silence across four continuous restarts stays non-blocking');
   console.log('PASS actual app: pause, repeated restart, interim stability, completion, skip without credit');
 }
 assert.deepEqual(errors,[],lang);await context.close();
 }
 fs.writeFileSync(path.join(root,'../browser-checks.json'),JSON.stringify(results,null,2));console.log('PASS '+results.length+' layouts, navigation, dock controls and restoration');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
