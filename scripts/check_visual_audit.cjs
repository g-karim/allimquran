const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.ALLIM_PLAYWRIGHT || 'playwright');

const root = path.resolve(process.env.ALLIM_TEST_CANDIDATE || path.join(__dirname, '..'));
const pageRoot = path.join(root, 'allimquran/website_content/pages/learn');
const publicRoot = path.join(root, 'allimquran/public');
const artifacts = process.env.ALLIM_TEST_ARTIFACTS;
const fixturePages = [1, 2, 3, 604].map(number => {
  const data = JSON.parse(fs.readFileSync(path.join(root, `tests/fixtures/mushaf-comfort/page-${number}.json`)));
  return {...data, page: number};
});
const versePages = new Map(fixturePages.flatMap(page => page.verses.map(verse => [verse.verse_key, page.page])));
const catalogue = JSON.parse(fs.readFileSync(path.join(publicRoot, 'data/account-storage-catalogue.json'))).verses;
const chapterCounts = new Map();
for (const key of Object.keys(catalogue)) {
  const id = Number(key.split(':')[0]);
  chapterCounts.set(id, (chapterCounts.get(id) || 0) + 1);
}
const fixtureNames = {1: ['الفاتحة', 'Al-Fatihah'], 2: ['البقرة', 'Al-Baqarah'], 114: ['الناس', 'An-Nas']};
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join(pageRoot, 'css.css'))}</style></head><body>${fs.readFileSync(path.join(pageRoot, 'main_section_html.html'))}<script>${fs.readFileSync(path.join(pageRoot, 'javascript.js'))}</script></body></html>`;
const contentTypes = {'.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml'};
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/learn') {
    response.setHeader('content-type', 'text/html;charset=utf-8');
    response.end(html);
    return;
  }
  const prefix = '/assets/allimquran/';
  if (url.pathname.startsWith(prefix)) {
    const resource = path.resolve(publicRoot, url.pathname.slice(prefix.length));
    if (resource.startsWith(publicRoot + path.sep) && fs.existsSync(resource) && fs.statSync(resource).isFile()) {
      response.setHeader('content-type', contentTypes[path.extname(resource)] || 'application/octet-stream');
      response.end(fs.readFileSync(resource));
      return;
    }
  }
  response.statusCode = 404;
  response.end();
});

function apiResponse(url) {
  if (url.pathname.endsWith('account_storage.context')) return {message: {mode: 'guest'}};
  if (url.pathname.endsWith('get_logged_user')) return {message: 'Guest'};
  if (url.pathname === '/api/mushaf/chapters') return {chapters: [...chapterCounts].map(([id, verses_count]) => {
    const [name_arabic, name_simple] = fixtureNames[id] || ['', `Surah ${id}`];
    return {id, name_arabic, name_simple, verses_count};
  })};
  const locate = url.pathname.match(/^\/api\/mushaf\/locate\/(\d+)\/(\d+)$/);
  if (locate) {
    const page = versePages.get(`${locate[1]}:${locate[2]}`);
    return page ? {page} : null;
  }
  const mushafPage = url.pathname.match(/^\/api\/mushaf\/page\/(\d+)$/);
  if (mushafPage) return fixturePages.find(page => page.page === Number(mushafPage[1]));
  if (url.pathname.endsWith('/research')) return {enabled: false};
  if (url.pathname.endsWith('/health')) return {ready: false};
  return null;
}

async function openReader(page, origin, lang, view = 'read') {
  await page.goto(`${origin}/learn?view=${view}&intro=0&lang=${lang}`, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.AllimAccountUI?.initialized);
  assert.equal(await page.locator('html').getAttribute('lang'), lang);
}


(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const origin=`http://127.0.0.1:${server.address().port}`;
 const out=process.env.ALLIM_TEST_ARTIFACTS||'/tmp/allim-audit';fs.mkdirSync(out,{recursive:true});
 const results=[];
 try {for(const lang of ['en','ar','ru']){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>localStorage.setItem('allim-system-intro-seen-v1','1'));
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();const data=apiResponse(u);return route.fulfill(data?{json:data}:{status:404,json:{}})});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,768,390,320]){
 await page.setViewportSize({width,height:width===320?568:1000});
 for(const view of ['today','read','memorize','learn','tafsir','progress','settings']){
 await openReader(page,origin,lang,view);await page.evaluate(()=>document.fonts.ready);
 const issues=await page.evaluate(()=>[...document.querySelectorAll('button,select,input,h1,h2,h3,.progress-card,strong,small')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&e.clientWidth>2&&(e.scrollWidth>e.clientWidth+3||e.scrollHeight>e.clientHeight+3)).map(e=>({id:e.id,cls:e.className,text:e.textContent.trim().slice(0,80),w:e.clientWidth,sw:e.scrollWidth,h:e.clientHeight,sh:e.scrollHeight}))) ;
 results.push({lang,width,view,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),issues});
 if(width===390||width===1440)await page.screenshot({path:path.join(out,`${lang}-${width}-${view}.png`),fullPage:true});
 if(view==='memorize') {
 await page.locator('#hifz-settings-open').click();
 await page.locator('.hifz-plan-drawer > summary').click();
 await page.locator('#hifz-settings-dialog .hifz-method-disclosure > summary').click();
 assert(await page.locator('#allim-journey').isVisible());
 assert(await page.locator('#hifz-method-picker').isVisible());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 await page.locator('[data-hifz-method="foundation300"]').click();
 assert.equal(await page.locator('#hifz-settings-dialog .hifz-method-disclosure').getAttribute('open'),null);
 assert((await page.locator('#hifz-selected-method').innerText()).length>0);
 await page.locator('#hifz-settings-close').click();
 }

 }
 for(const id of ['source-dialog','guide-dialog','quran-search-dialog','quiet-recall-dialog','life-practice-dialog','heart-page-dialog']){
 await page.evaluate(id=>document.getElementById(id).showModal(),id);
 const geometry=await page.locator('#'+id).evaluate(e=>({overflow:e.scrollWidth>e.clientWidth+2,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));results.push({lang,width,dialog:id,...geometry});
 if(width===390)await page.screenshot({path:path.join(out,`${lang}-${width}-${id}.png`)});
 await page.evaluate(id=>document.getElementById(id).close(),id);
 }
 }
 results.push({lang,errors});await context.close();
 }}finally{await browser.close();server.close();fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify(results,null,2));}
 const failures=results.filter(x=>x.overflow||x.issues?.length||x.errors?.length); console.log(JSON.stringify(failures,null,2)); assert.deepEqual(failures,[],'layout or browser errors');
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
