// Isolated teacher UI with synthetic silence and mocked APIs. No production data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const root=path.resolve('allimquran');
const html=(await fs.readFile(root+'/www/teacher.html','utf8')).replace('{{ csrf_token | e }}','test-csrf');
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/teacher'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);return;}
  const relative=url.pathname.replace('/assets/allimquran/','');
  if(!['css/teacher-review.css','js/teacher-review.js','media/allim-header-logo.png','media/allim-brand-icon.png','media/allim-literata-medium.woff2'].includes(relative)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'application/octet-stream');
  res.end(await fs.readFile(root+'/public/'+relative));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const wav=Buffer.alloc(32044);wav.write('RIFF');wav.writeUInt32LE(32036,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(32000,40);
let checks=0;
try{
  for(const scenario of ['empty','correct','incorrect','draft','disputed','conflict','withdrawn','denied','xss','dirty','mobile']){
    const context=await browser.newContext({viewport:{width:scenario==='mobile'?390:1440,height:900}});
    const page=await context.newPage();const errors=[],saves=[];page.on('pageerror',e=>errors.push(e.message));
    const record={id:'c'.repeat(64),verse_key:'1:1',duration_seconds:1,status:scenario==='disputed'?'disputed':'pending',revision:0,annotation:scenario==='xss'?{spoken_text:'<img src=x onerror="window.xss=1">'}:{},can_adjudicate:false};
    await context.route('**/api/method/allimquran.review_portal.*',async route=>{
      const url=new URL(route.request().url());const method=url.pathname.split('.').at(-1);
      let value;
      if(scenario==='denied')return route.fulfill({status:403,json:{message:{error:'Доступ закрыт.'}}});
      if(method==='queue')value={counts:{pending:scenario==='empty'?0:1,draft:0,reviewed:0,disputed:0,adjudicated:0},offset:0,page_size:25,items:scenario==='empty'?[]:[record]};
      if(method==='detail')value=record;
      if(method==='audio')return scenario==='withdrawn'?route.fulfill({status:404,json:{message:{error:'Запись недоступна.'}}}):route.fulfill({contentType:'audio/wav',body:wav});
      if(method==='save'){
        assert.equal(route.request().method(),'POST');assert.equal(route.request().headers()['x-frappe-csrf-token'],'test-csrf');
        const data=route.request().postDataJSON();saves.push(data);
        if(scenario==='conflict')return route.fulfill({status:409,json:{message:{error:'Версия изменилась. Обновите запись.'}}});
        record.revision++;record.status=data.status;record.annotation=data.annotation;
        value={id:record.id,revision:record.revision,status:record.status};
      }
      return route.fulfill({json:{message:value}});
    });
    await page.goto(base+'/teacher');
    if(scenario==='empty'){await page.getByText('В этом разделе пока нет записей.').waitFor();assert.equal(await page.locator('#review-form').isVisible(),false);}
    else if(scenario==='denied'){await page.getByText('Доступ закрыт.').waitFor();}
    else {
      await page.click('.queue-item');
      if(scenario==='withdrawn'){await page.getByText('Запись недоступна.').waitFor();assert.equal(await page.locator('#player').getAttribute('src'),null);assert.equal(await page.locator('#review-form').isVisible(),false);}
      else{
        await page.locator('#review-form').waitFor();
        if(scenario==='xss'){assert.equal(await page.evaluate(()=>window.xss),undefined);assert.equal(await page.locator('#spoken img').count(),0);}
        if(scenario==='disputed'){assert.equal(await page.locator('button[value="reviewed"]').isDisabled(),true);}
        if(scenario==='mobile'){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await fs.mkdir('.migration/teacher-ui',{recursive:true});await page.screenshot({path:'.migration/teacher-ui/mobile.png',fullPage:true});}
        if(['correct','incorrect','draft','conflict','dirty'].includes(scenario)){
          await page.fill('#spoken','بسم الله');await page.fill('#expected','بسم الله');await page.fill('#riwayah','Хафс от Асима');await page.selectOption('#verdict',scenario==='incorrect'?'incorrect':'correct');
          if(scenario==='incorrect'){
            await page.click('#add-error');await page.selectOption('[data-field="kind"]','omission');await page.fill('[data-field="word_index"]','2');await page.fill('[data-field="start_ms"]','0.5');await page.fill('[data-field="end_ms"]','0.5');
          }
          if(scenario==='dirty'){
            page.on('dialog',dialog=>dialog.dismiss());await page.click('#refresh');assert.equal(await page.inputValue('#spoken'),'بسم الله');
          }else{
            await page.click('button[value="'+(scenario==='draft'?'draft':'reviewed')+'"]');
            await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('сохран')||document.getElementById('notice').textContent.includes('Версия'));
            assert.equal(saves.length,1);assert.equal(saves[0].annotation.spoken_text,'بسم الله');
            if(scenario==='incorrect'){assert.equal(saves[0].annotation.errors[0].word_index,1);assert.equal(saves[0].annotation.errors[0].start_ms,500);}
            if(scenario==='conflict'){assert.equal(await page.inputValue('#spoken'),'بسم الله');assert.equal(await page.locator('#review-form').isVisible(),true);}
            if(scenario==='correct'){assert.equal(await page.locator('#player').getAttribute('src'),null);assert.equal(await page.locator('#review-form').isVisible(),false);}
          }
        }
      }
    }
    assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>localStorage.length),0);await context.close();checks++;console.log('PASS '+scenario);
  }
}finally{await browser.close();server.close();}
console.log(JSON.stringify({checks}));
