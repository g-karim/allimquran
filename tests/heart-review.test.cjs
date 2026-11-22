const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../allimquran/public/js/heart-review.js');
const cat=require('../allimquran/public/data/account-storage-catalogue.json').verses;
const now=new Date('2026-11-22T12:00:00Z');
const past=days=>new Date(+now-days*model.DAY).toISOString();
const row=(kind,value,id='test')=>({kind,id,value});
test('seven days are protected; gradual fading preserves completed and partial achievements',()=>{
  assert.equal(model.freshness(300,300,past(7),now).factor,1);
  const factors=[7,8,14,21,35,100].map(d=>model.freshness(300,300,past(d),now).factor);
  assert.equal(factors[1]>factors[2],true);assert.equal(factors[2]>factors[3],true);assert.ok(Math.abs(factors[4]-.05)<1e-12);assert.equal(factors[5],.05);
  assert.equal(model.freshness(150,300,past(21),now).acquired,.5);
  assert.equal(model.freshness(300,300,past(0),now).reveal,1);
});
test('unknown, corrupt and future dates ask for a check without inventing forgetting',()=>{
  for(const d of ['', 'wrong', past(-1)]) {const f=model.freshness(300,300,d,now);assert.equal(f.unknown,true);assert.equal(f.reveal,1);}
  assert.equal(model.freshness(0,300,'',now).due,false);
});
test('review restores presentation without rewriting counters or achievements',()=>{
  const heart={units:{'1:1':{weekCounts:[100,100,100],permanent:true,lastAcceptedAt:past(30)}}};const frozen=JSON.stringify(heart);
  const v={verse_key:'1:1',recorded_at:past(0),local_date:'2026-11-22',evidence:'self_reported'};
  const result=model.project([row('heart_review',v)],cat,heart,now);
  assert.equal(result.verses['1:1'].evidence,'self_reported');assert.equal(model.freshness(300,300,result.verses['1:1'].at,now).reveal,1);assert.equal(JSON.stringify(heart),frozen);
});
test('partial, hinted, failed, reading-only and deleted recalls do not refresh memory',()=>{
  const base={verse_key:'1:1',recorded_at:past(0),mode:'memory',complete:true,hints:0,flags:[]};
  for(const change of [{complete:false},{hints:1},{flags:[0]},{mode:'read'}]) assert.deepEqual(model.project([row('recall_attempt',{...base,...change})],cat,{},now).verses,{});
  assert.deepEqual(model.project([{...row('heart_review',{verse_key:'1:1',recorded_at:past(0)}),deleted:true}],cat,{},now).verses,{});
  assert.equal(model.project([row('recall_attempt',base)],cat,{},now).verses['1:1'].evidence,'client_alignment');
});
test('33 credits refresh only their actual ayahs; one page is not a whole crossing ayah',()=>{
  const c={'1:1':[1,1],'1:2':[1,2],'1:3':[2,2]};
  let result=model.project([row('hifz_credit',{verse_keys:['1:1'],occurred_at:past(0)})],c,{},now);
  assert.deepEqual(Object.keys(result.verses),['1:1']);
  const one=row('heart_review',{first_page:1,last_page:1,recorded_at:past(1),local_date:'2026-11-21'});
  result=model.project([one],c,{},now);assert.equal(result.verses['1:2'],undefined);
  result=model.project([one,row('heart_review',{first_page:2,last_page:2,recorded_at:past(0),local_date:'2026-11-22'})],c,{},now);
  assert.equal(result.verses['1:2'].at,past(1));
});
test('hafiz route covers the whole Quran without skipping after a missed day',()=>{
  const plan={hafiz:true,review_days:30,review_start:'2026-11-01'}, pages={},seen=new Set();
  for(let d=0;d<30;d++) {
    const today=model.addDays('2026-11-01',d),route=model.reviewRoute({pages},plan,today,new Date(today+'T12:00:00Z'));
    for(const r of route.ranges)for(let p=r.first;p<=r.last;p++){seen.add(p);pages[p]={at:today+'T12:00:00Z',day:today};}
    assert.equal(model.reviewRoute({pages},plan,today).ranges.length,0);
  }
  assert.equal(seen.size,604);
  assert.equal(model.reviewRoute({pages:{}},plan,'2026-11-15').ranges[0].first,1);
});
test('khatm plans for calendar months and 29/30-day Ramadan finish exact separate cycles',()=>{
  for(const [mode,start,days,count] of [['month','2026-02-01',28,1],['month','2028-02-01',29,1],['month','2026-11-01',30,1],['month','2026-12-01',31,1],['ramadan','2026-11-01',29,2],['ramadan','2026-11-01',30,2]]) {
    const plan={khatm_start:start,khatm_mode:mode,ramadan_days:days,cycle_ids:Array.from({length:count},(_,i)=>'cycle'+i)};
    const records=[];
    for(let i=0;i<days;i++) {
      const today=model.addDays(start,i),route=model.khatmRoute(plan,records,cat,today);
      for(const r of route.ranges)records.push(row('reading_entry',{cycle_id:r.cycle,local_date:today,parts:Array.from({length:r.last-r.first+1},(_,i)=>({page:r.first+i,full:true,word_keys:[]}))}));
      assert.equal(model.khatmRoute(plan,records,cat,today).ranges.length,0,'no second daily quota');
    }
    assert.equal(model.khatmRoute(plan,records,cat,model.addDays(start,days-1)).remaining,0);
  }
});
test('missed reading increases remaining quota, duplicates do not inflate khatm, future plans wait',()=>{
  const plan={khatm_start:'2026-11-01',khatm_mode:'ramadan',ramadan_days:30,cycle_ids:['a','b']};
  assert.equal(model.khatmRoute(plan,[],cat,'2026-11-16').quota,81);
  assert.equal(model.khatmRoute(plan,[],cat,'2026-10-31').ranges.length,0);
  assert.equal(model.khatmRoute(plan,[],cat,'2026-12-01').expired,true);
  const r=row('reading_entry',{cycle_id:'a',local_date:'2026-11-01',parts:[{page:1,full:true,word_keys:[]}]});
  assert.equal(model.khatmRoute(plan,[r,r],cat,'2026-11-02').completed,1);
});
