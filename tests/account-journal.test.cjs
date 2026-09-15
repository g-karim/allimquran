const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const journal=require('../allimquran/public/js/account-journal.js');
const catalogue=require('../allimquran/public/data/account-storage-catalogue.json').verses;
const cycleId='ae6f207a-a9dd-4e5a-bbce-b01ee6e0c3e0';
const cycle={kind:'reading_cycle',id:cycleId,value:{dataset_id:journal.DATASET}};
const plan={kind:'reading_plan',id:'current',value:{cycle_id:cycleId,deadline:null}};
const entry=(parts,date='2026-09-15')=>({kind:'reading_entry',id:randomUUID(),value:{cycle_id:cycleId,local_date:date,source:'paper',evidence:'self_reported',parts}});
test('repeated partial verses increase volume, but each canonical word covers the cycle once',()=>{
 const parts=journal.verseParts(catalogue,'1:1'), count=journal.index(catalogue).get(1).size;
 const s=journal.summary([cycle,plan,entry(parts),entry(parts)],catalogue,'2026-09-15');
 assert.equal(s.current,4/count);assert.equal(s.volume,8/count);assert.equal(s.todayVolume,s.volume);
});
test('manual and microphone overlap is unioned with a whole page; dates and deleted entries count correctly',()=>{
 const deleted={...entry(journal.pageParts(2,4)),deleted:true};
 const s=journal.summary([cycle,plan,entry(journal.verseParts(catalogue,'1:1'),'2026-09-14'),entry(journal.pageParts(1,1)),deleted],catalogue,'2026-09-15');
 assert.equal(s.current,1);assert.equal(s.fullPages,1);assert.equal(s.todayVolume,1);assert.ok(s.volume>1);
});
test('all 604 pages complete one cycle; previous khatms do not invent page entries',()=>{
 const s=journal.summary([cycle,plan,entry(journal.pageParts(1,604)),{kind:'reading_past',id:'baseline',value:{completed_cycles:3}}],catalogue,'2026-09-15');
 assert.equal(s.current,604);assert.equal(s.completed,1);assert.equal(s.lifetime,4);assert.equal(s.volume,604);assert.equal(s.remaining,0);
});
test('deadline rate includes today and past deadlines do not produce negative daily amounts',()=>{
 const rows=[cycle,{...plan,value:{cycle_id:cycleId,deadline:'2026-09-16'}},entry(journal.pageParts(1,4))];
 assert.equal(journal.summary(rows,catalogue,'2026-09-15').perDay,300);
 const past=journal.summary(rows,catalogue,'2026-09-17');assert.equal(past.perDay,null);assert.equal(past.days,0);
});
test('cross-page verse ranges use canonical pages and reject reversed or missing ranges',()=>{
 const parts=journal.verseParts(catalogue,'1:1','2:5');assert.deepEqual(parts.map(p=>p.page),[1,2]);assert.ok(parts.every(p=>p.full));
 assert.throws(()=>journal.verseParts(catalogue,'2:5','1:1'));
 assert.throws(()=>journal.verseParts(catalogue,'1:9'));
 assert.throws(()=>journal.pageParts(0,3));assert.equal(journal.validDate('2026-02-30'),false);
});
test('only accepted full read events create journal entries; interim, assisted and memory do not',()=>{
 const event={event_type:'verse_completed',attempt_id:randomUUID(),mode:'read',verse_key:'1:1',matched_words:4,hints_used:0,full_verse:true,alignment_complete:true,evidence:'client_alignment',local_date:'2026-09-15'};
 const entry=journal.entryForEvent(event,catalogue);assert.equal(entry.id,event.attempt_id);assert.ok(entry.insert_once);
 for(const changed of [{alignment_complete:false},{full_verse:false},{evidence:'assisted_completion'},{mode:'memory'},{matched_words:3},{hints_used:1}])assert.equal(journal.entryForEvent({...event,...changed},catalogue),null);
});
test('first cycle is stable per owner epoch; existing plan wins; repeated/deleted attempt is not resurrected',()=>{
 const intent={kind:'reading_entry',id:randomUUID(),insert_once:true,value:{cycle_id:null}};
 const first=journal.expand([intent],[],'account:other:'+cycleId);assert.equal(first[0].id,cycleId);assert.equal(first[2].value.cycle_id,cycleId);
 const again=journal.expand([intent],[cycle,plan], 'account:other:'+cycleId);assert.equal(again.length,1);
 assert.deepEqual(journal.expand([intent],[{kind:'reading_entry',id:intent.id,deleted:true}],'guest:'+cycleId),[]);
});
