const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.ALLIM_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),pageRoot=path.join(root,'allimquran/website_content/pages/academy');
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+fs.readFileSync(path.join(pageRoot,'css.css'))+'</style></head><body>'+fs.readFileSync(path.join(pageRoot,'main_section_html.html'))+'<script>'+fs.readFileSync(path.join(pageRoot,'javascript.js'))+'</script></body></html>';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/academy'){res.setHeader('content-type','text/html;charset=utf-8');res.end(html);return;}
 const relative=url.pathname.replace('/assets/allimquran/','');const file=path.resolve(root,'allimquran/public',relative);
 if(file.startsWith(path.join(root,'allimquran/public/'))&&fs.existsSync(file)&&fs.statSync(file).isFile()){
 res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));return;}
 res.statusCode=404;res.end();
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r)); const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 for(const lang of ['ru','en','ar']) {
  const context=await browser.newContext();const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/api/**',route=>{const url=route.request().url();return route.fulfill({json:url.includes('account_storage.context')?{message:{mode:'guest'}}:url.includes('get_logged_user')?{message:'student@example.test'}:{message:{},data:[]}})});
  await context.route('https://**',route=>route.abort());
  await page.goto(base+'/academy');await page.waitForFunction(()=>window.AllimAccountUI?.initialized);
  while(await page.locator('#language-button').textContent()!==lang.toUpperCase()) await page.locator('#language-button').click();
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:900});
   assert(await page.locator('#academy-entry-card').isHidden(),'entry funnel must not dominate dashboard');
   assert(await page.locator('.today-plan-card').isVisible());
   assert(await page.locator('#allim-storage-panel').isHidden());
   await page.locator('[data-copy="deviceProgress"]').click();
   assert(await page.locator('#allim-storage-panel details').evaluate(e=>e.open));
   await page.keyboard.press('Escape');assert(await page.locator('#allim-storage-panel').isHidden());
   if(lang==='ru')await page.screenshot({path:'/tmp/allim-academy-'+width+'.png'});
   await page.locator('#open-academy-route').click();
   assert(await page.locator('#academy-entry-card').isVisible());
   if(lang==='ru')await page.screenshot({path:'/tmp/allim-academy-route-'+width+'.png'});
   assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)));
   await page.locator(await page.locator('#start-diagnostic').isVisible()?'#start-diagnostic':'#retake-diagnostic').click();
   assert(await page.locator('#academy-route-dialog').isHidden());
   await page.locator('label:has([name="level"][value="letters"])').click();
   await page.locator('label:has([name="goal"][value="tajwid"])').click();
   await page.locator('#diagnostic-form button[type="submit"]').click();
   await page.waitForSelector('#academy-route-result',{state:'visible'});
   assert((await page.locator('#book-trial-lesson').getAttribute('href')).includes('route=foundation'));
   await page.locator('#academy-route-dialog .close-button').click();
   await page.locator('#open-academy-route').click();
   await page.locator('#retake-diagnostic').click();
   await page.locator('#cancel-diagnostic').click();

  }
  assert.deepEqual(errors,[]);await context.close();
 }
 for(const locale of ['en','ru','ar']) {
  for(const mode of ['account','typed','guest','error']) {
   const page=await browser.newPage();
   await page.setContent('<main><div id="full_name"><input></div><div id="email"><input></div></main>');
   await page.evaluate(({mode})=>{
    const values=mode==='typed'?{full_name:'Entered name',email:'entered@example.test'}:{};
    const fields={};for(const name of ['full_name','email'])fields[name]={df:{hidden:0},$wrapper:[document.getElementById(name)],refresh(){this.$wrapper[0].hidden=Boolean(this.df.hidden)}};
    window.frappe={web_form:{fields_dict:fields,get_value:k=>values[k],set_value:(k,v)=>{values[k]=v}}};
    window.fetch=async()=>{if(mode==='error')throw Error('offline');return {ok:mode!=='guest',json:async()=>({message:{full_name:'Test Learner',email:'learner@example.test'}})}};
   },{mode});
   const folder=locale==='en'?'academy-trial':locale==='ru'?'ru/probnyj-urok':'ar/academy-trial';
   await page.addScriptTag({content:fs.readFileSync(path.join(root,'allimquran/website_content/forms',folder,'client_script.js'),'utf8')});
   await page.waitForTimeout(50);
   if(mode==='account'){
    assert.equal(await page.locator('.allim-account-contact').count(),1);
    assert(await page.locator('#email').isHidden());
    await page.locator('.allim-account-contact button').click();assert(await page.locator('#email').isVisible());
   } else {assert.equal(await page.locator('.allim-account-contact').count(),0);assert(await page.locator('#email').isVisible());}
   if(mode==='typed')assert.equal(await page.evaluate(()=>frappe.web_form.get_value('email')),'entered@example.test');
   await page.close();
  }
 }
 console.log('PASS trial contact: prefill, edit, typed values, guest and offline fallback in 3 languages');
 console.log('PASS Academy route dialog, saved diagnostic, dashboard focus: RU/EN/AR desktop/mobile');
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
