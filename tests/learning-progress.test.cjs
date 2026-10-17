const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const learning = require('../allimquran/public/js/learning-progress.js');
const journey = require('../allimquran/public/js/learning-journey.js');
const imports = require('../allimquran/public/js/account-import.js');
const catalogue = require('../allimquran/public/data/account-storage-catalogue.json').verses;
const row = (kind,id,value) => ({kind,id,value,deleted:false});
const credit = (type,key,keys,method='linked33',n=0) => row('hifz_credit',randomUUID(),{method,page:1,task_type:type,task_key:key,verse_keys:keys,occurred_at:new Date(Date.UTC(2026,9,17,0,0,n)).toISOString(),local_date:'2026-10-17'});
test('33 method projections preserve task order, cap counts and combine concurrent facts',()=>{
 const facts = [credit('segment','1:2',['1:1','1:2'])];
 for(let i=1;i<=34;i++)facts.push(credit('verse','1:1',['1:1'],'linked33',i));
 facts.push(credit('verse','1:2',['1:2'],'linked33',35),credit('verse','1:2',['1:2'],'linked33',36));
 const p=learning.project(facts.reverse(),catalogue).heartMushaf.linked33Pages[1];
 assert.equal(p.verseCounts['1:1'],33);assert.equal(p.verseCounts['1:2'],2);
 assert.deepEqual(p.segmentCounts,{});assert.equal(p.daily['2026-10-17'],35);
});
test('Turkish wall starts at the bottom and builds suffixes; a single verse still needs a page link',()=>{
 assert.deepEqual(learning.tasks('turkishWall33',['1:1','1:2','1:3','1:4']).map(t=>[t.type,t.key]),[['verse','1:4'],['verse','1:2'],['verse','1:3'],['segment','1:2'],['verse','1:1'],['segment','1:1']]);
 assert.deepEqual(learning.tasks('linked33',['1:1']).at(-1),{type:'segment',key:'__page__',keys:['1:1']});
 const p=learning.project([credit('verse','1:7',['1:7'],'turkishWall33')],catalogue).heartMushaf;
 assert.equal(p.turkishWallPages[1].verseCounts['1:7'],1);assert.deepEqual(p.linked33Pages,{});
});
test('legacy baselines and new credits are separate; coach keeps only its last 240 observations',()=>{
 const records=[row('hifz_method_baseline','linked33/1',{verse_counts:{'1:1':32},link_counts:{},daily:{},started_at:null,last_accepted_at:null,completed_at:null}),credit('verse','1:1',['1:1'])];
 for(let i=0;i<245;i++)records.push(row('hifz_signal',String(i).padStart(4,'0'),{method:'linked33',outcome:'clean',source:'verse',hints:0,at:new Date(Date.UTC(2026,9,17,0,i)).toISOString()}));
 const p=learning.project(records,catalogue);assert.equal(p.heartMushaf.linked33Pages[1].verseCounts['1:1'],33);assert.equal(p.hifzCoach.signals.length,240);
});
test('account projection ignores every guest learning record; explicit settings alone are diffed',()=>{
 const legacy={learn:{memorizationMethod:'turkishWall33',hifzCoach:{selectionMode:'adaptive',signals:[{outcome:'clean'}]},heartMushaf:{lawhPages:{'1:1':{readCount:200}}}}};
 const state=learning.apply({heartMushaf:{units:{},pages:{}}},{scope:'account:a:b',records:[],legacy},catalogue);
 assert.equal(state.memorizationMethod,'foundation300');assert.deepEqual(state.heartMushaf.lawhPages,{});
 const next=structuredClone(state);next.memorizationMethod='linked33';next.hifzCoach.selectionMode='adaptive';next.heartMushaf.linked33Pages[1]={verseCounts:{'1:1':33}};
 assert.deepEqual(learning.diff(state,next).map(r=>r.id),['memorization_method','hifz_choice_mode']);
});
test('recall flag correction is reversible and does not rewrite immutable attempt evidence',()=>{
 const id=randomUUID(), attempt={id,key:'1:1',mode:'test',date:'2026-10-17',complete:true,total:4,hints:0,flags:[1],dismissed:[],seconds:10};
 const before={version:1,plans:[],sessions:[attempt]},after=structuredClone(before);after.sessions[0].dismissed=[1];
 assert.deepEqual(learning.journeyDiff(before,after),[{kind:'recall_flag',id:id+'/1',value:{dismissed:true}}]);
 const snapshot={scope:'account:a:b',records:[row('recall_attempt',id,learning.sessionValue(attempt)),row('recall_flag',id+'/1',{dismissed:true})]};
 assert.equal(journey.difficult(learning.journey(snapshot).sessions).length,0);
 snapshot.records.at(-1).value.dismissed=false;
 assert.equal(journey.difficult(learning.journey(snapshot).sessions).length,1);
});
test('manual sessions are labelled, do not affect the recognition review schedule, and opening a verse earns nothing',()=>{
 const plan={action:'memorize',keys:['1:1','1:2'],created:'2026-10-17',portion:1,deadline:''};
 assert.equal(journey.progress(plan,[],'2026-10-17').done,0);
 const sessions=[{key:'1:1',mode:'manual-memory',date:'2026-10-17',complete:true,hints:0,flags:[],dismissed:[]}];
 assert.equal(journey.progress(plan,sessions,'2026-10-17').manual,1);assert.deepEqual(journey.due(sessions,'2026-10-20'),[]);
});
test('extended imports retain method baselines, remap recall flags and send photos before metadata',async()=>{
 const source={legacy:{learn:{memorizationMethod:'linked33',heartMushaf:{linked33Pages:{1:{verseCounts:{'1:1':32},segmentCounts:{},daily:{}}}}},journey:{version:1,plans:[{id:'legacy-plan',action:'read',keys:['1:1'],portion:1,created:'2026-10-17',deadline:''}],sessions:[{id:'legacy-attempt',key:'1:1',mode:'test',date:'2026-10-17',complete:true,total:4,hints:0,flags:[1],dismissed:[1],seconds:1}]}},records:[]};
 const sourceId=randomUUID(),digest='b'.repeat(64);
 const one=await imports.compile(source,sourceId,digest,['learning'],catalogue),two=await imports.compile(source,sourceId,digest,['learning'],catalogue);
 assert.deepEqual(one.operations.map(o=>o.id),two.operations.map(o=>o.id));
 const attempt=one.operations.find(o=>o.kind==='recall_attempt');
 assert.equal(one.operations.find(o=>o.kind==='recall_flag').id,attempt.id+'/1');
 assert.equal(one.operations.find(o=>o.kind==='hifz_method_baseline').value.verse_counts['1:1'],32);
 assert.ok(one.operations.every(o=>o.kind!=='preference'));
});
test('malformed legacy plans, word counts and page counts remain backups instead of entering the guest projection',()=>{
 assert.equal(learning.validLegacyRecord('memory_plan','old',{action:'read',verse_keys:['999:1'],portion:1,created_on:'2026-10-17',deadline:null},catalogue),false);
 assert.equal(learning.validLegacyRecord('recall_attempt','old',{verse_key:'1:1',mode:'test',local_date:'2026-10-17',complete:true,total_words:999,hints:0,flags:[],seconds:1},catalogue),false);
 assert.equal(learning.validLegacyRecord('hifz_method_baseline','linked33/1',{verse_counts:{'1:1':34},link_counts:{},daily:{},started_at:null,last_accepted_at:null,completed_at:null},catalogue),false);
 const state=learning.apply({heartMushaf:{units:{},pages:{}}},{scope:'guest:example',learningMigrated:true,records:[],legacy:{learn:{heartMushaf:{linked33Pages:{1:{verseCounts:{'1:1':999}}}},hifzCoach:{signals:[]}}}},catalogue);
 assert.deepEqual(state.heartMushaf.linked33Pages,{});
});
test('same-day recall chronology uses recording time or legacy array order, never random UUID order',()=>{
 const bad={verse_key:'1:1',mode:'test',local_date:'2026-10-17',complete:true,total_words:4,hints:0,flags:[1],seconds:1};
 for(const old of [true,false]){
  const records=[row('recall_attempt','z-bad',{...bad,recorded_at:old?null:'2026-10-17T10:00:00.000Z',legacy_order:old?0:null}),row('recall_attempt','a-clean',{...bad,flags:[],recorded_at:old?null:'2026-10-17T10:01:00.000Z',legacy_order:old?1:null})];
  const book=learning.journey({scope:'account:a:b',records:records.reverse()});
  assert.deepEqual(book.sessions.map(s=>s.id),['z-bad','a-clean']);
  assert.equal(journey.due(book.sessions,'2026-10-18')[0].pending,0);
 }
});
