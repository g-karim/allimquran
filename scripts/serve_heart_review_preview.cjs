// Local guest fixture server. Never proxies production APIs.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root = path.resolve(__dirname, '..');
const pageRoot = path.join(root, 'allimquran/website_content/pages/learn');
const publicRoot = path.join(root, 'allimquran/public');
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

const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/fixtures'){
 res.setHeader('Content-Type','text/html;charset=utf-8');res.end(`<!doctype html><meta charset="utf-8"><h1>ALLIM — локальные тестовые данные</h1><button id="seed">Загрузить три тестовых аята</button><p id="result"></p><script src="/assets/allimquran/js/account-storage.js"></script><script>
 document.getElementById('seed').onclick=async()=>{
 await AllimStorage.open();const stamp=AllimStorage.stamp();if(!stamp.scope.startsWith('guest:'))throw Error('guest_only');
 const rows=[14,35,0].map((days,i)=>({kind:'hifz_unit_baseline',id:'1:'+(i+1),value:{week_counts:i===1?[100,50,0]:[100,100,100],maintenance_count:0,maintenance_level:0,started_at:new Date(Date.now()-40*86400000).toISOString(),last_accepted_at:new Date(Date.now()-days*86400000).toISOString(),completed_at:i===1?null:new Date(Date.now()-40*86400000).toISOString(),next_review_at:null,permanent:i!==1}}));
 rows.push({kind:'reading_position',id:'last',value:{verse_key:'1:1'}},{kind:'preference',id:'memorization_method',value:{selected:'foundation300'}});
 await AllimStorage.mutateMany(rows,stamp);document.getElementById('result').textContent='Тестовые аяты сохранены: 300 / 150 / 300. Давность: 14 / 35 / 0 дней.';
 };</script>`);return;
 }
 if(url.pathname==='/lms/programs'){
 const covers=JSON.parse(fs.readFileSync(path.join(publicRoot,'data/academy-covers.json'))).covers.filter(c=>['aq35','aq09','aq21','aq30'].includes(c.id));
 res.setHeader('Content-Type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/allimquran/css/academy-covers.css"><style>body{font:16px system-ui;background:#141817;color:#f5f5f2;margin:0;padding:32px}main{max-width:1200px;margin:auto}section{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}button{font:inherit;color:inherit;background:#222725;border:1px solid #39463e;text-align:start}button>div{margin-bottom:10px}button>div:first-child{font-weight:700}@media(max-width:600px){section{grid-template-columns:1fr}body{padding:16px}}</style><main><h1>ALLIM · программы</h1><p>Локальная проверка обложек на разметке карточек программ.</p><section>${covers.map(c=>'<button type="button"><div>'+c.title+'</div><div>Учебная программа</div></button>').join('')}</section></main><script defer src="/assets/allimquran/js/academy-covers.js"></script></html>`);return;
 }
 if(url.pathname==='/learn'){
  res.setHeader('Content-Type','text/html;charset=utf-8');
  res.end(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join(pageRoot,'css.css'))}</style></head><body>${fs.readFileSync(path.join(pageRoot,'main_section_html.html'))}<script>${fs.readFileSync(path.join(pageRoot,'javascript.js'))}</script></body></html>`);return;
 }
 const prefix='/assets/allimquran/';
 if(url.pathname.startsWith(prefix)){
  const file=path.resolve(publicRoot,url.pathname.slice(prefix.length));
  if(file.startsWith(publicRoot+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
   res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));return;
  }
 }
 const data=apiResponse(url);if(data){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;}
 res.statusCode=404;res.end();
});server.listen(18148,'127.0.0.1',()=>console.log('ALLIM isolated guest preview http://127.0.0.1:18148/learn?view=home&intro=0&lang=ru'));
