const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../allimquran/website_content/pages/learn/javascript.js'),'utf8');
function fn(name){const start=source.indexOf('  function '+name+'(');let brace=source.indexOf('{',start),depth=1,i=brace+1;for(;depth;i++){if(source[i]==='{')depth++;if(source[i]==='}')depth--;}return source.slice(start,i);}
function setup(method='foundation300',counts={'2:1':17,'2:2':4}){
 const events=[],units=Object.fromEntries(Object.entries(counts).map(([k,n])=>[k,{n}]));const page={verseCounts:{...counts},daily:{}};
 const c={console,crypto:require('node:crypto'),Date,Math,Number,String,Boolean,Array,Object,
 getMushafVerseText:v=>v.text,getHeartUnit:k=>units[k]||= {n:0},getHeartFoundationTotal:u=>u.n,
 getLinked33PageUnit:()=>page,recordHeartRecitation:k=>units[k].n++,recordStructuredCredit:()=>{},
 getLinked33PageSummary:()=>({complete:false}),saveLearningEvent:(kind,value)=>events.push({kind,value}),
 logActivity:()=>{},saveState:()=>{},renderHeartMushaf:()=>{},renderHeartReadCounter:()=>{},showToast:()=>{},formatMetric:String,t:x=>x,formatText:x=>x,
 state:{sessions:0,wordsReviewed:0},HEART_FOUNDATION_TOTAL:300,LINKED_33_TARGET:33,heartPageCache:{},heartCurrentPageData:{page:2},
 linked33Session:{method,pageNumber:2,key:'2:1',keys:['2:1','2:2'],nextIndex:0,openingGroup:true,pending:{}},
 };
 vm.createContext(c);vm.runInContext(['getOpeningStudyGroup','openingGroupCount','registerLinked33SegmentVerse'].map(fn).join('\n'),c);
 return {c,events,units,page};
}
const verse=(key,text)=>({verse_key:key,text});
test('only entire standalone openings group; consecutive openings include following full ayah',()=>{
 const {c}=setup();const group=(verses,key)=>JSON.parse(JSON.stringify(c.getOpeningStudyGroup({verses},key)));
 assert.deepEqual(group([verse('2:1','الٓمٓ'),verse('2:2','ذَٰلِكَ الْكِتَابُ')],'2:1'),['2:1','2:2']);
 assert.deepEqual(group([verse('42:1','حم'),verse('42:2','عسق'),verse('42:3','كذلك يوحي')],'42:2'),['42:1','42:2','42:3']);
 assert.equal(group([verse('50:1','ق والقرآن المجيد'),verse('50:2','بل عجبوا')],'50:1'),null);
 assert.equal(group([verse('2:1','الم')],'2:1'),null);
 assert.equal(group([verse('2:1','الم'),verse('3:1','الم')],'2:1'),null);
});
for(const method of ['foundation300','linked33'])test(method+': partial group grants nothing; completion preserves unequal legacy progress',()=>{
 const {c,events,units,page}=setup(method);
 c.linked33Session.pending['2:1']={verse_key:'2:1',matched_words:1};
 assert.equal(c.registerLinked33SegmentVerse('2:1').cycleComplete,false);assert.equal(events.length,0);
 assert.equal(units['2:1'].n,17);assert.equal(page.verseCounts['2:1'],17);
 c.linked33Session.pending['2:2']={verse_key:'2:2',matched_words:4};
 assert.equal(c.registerLinked33SegmentVerse('2:2').restart,true);assert.equal(events.length,2);
 const actual=method==='foundation300'?Object.fromEntries(Object.entries(units).map(([k,u])=>[k,u.n])):page.verseCounts;
 assert.deepEqual(actual,{'2:1':18,'2:2':5});
 assert.equal(c.linked33Session.nextIndex,0);assert.equal(Object.keys(c.linked33Session.pending).length,0);
});
test('wrong order resets the cycle and cannot award credit',()=>{const {c,events}=setup();c.registerLinked33SegmentVerse('2:2');assert.equal(c.linked33Session.nextIndex,0);assert.equal(events.length,0)});
test('a full counter is preserved while the other ayah catches up',()=>{const {c,page}=setup('linked33',{'2:1':33,'2:2':32});c.linked33Session.pending={'2:1':{matched_words:1},'2:2':{matched_words:3}};c.registerLinked33SegmentVerse('2:1');assert.equal(c.registerLinked33SegmentVerse('2:2').restart,false);assert.deepEqual(page.verseCounts,{'2:1':33,'2:2':33});});

test('letter names require the entire isolated opening in order',()=>{const core=require('../allimquran/public/js/recitation-core.js');assert.equal(core.align(['الٓمٓ'],'ألف لام ميم',true).complete,true);assert.equal(core.align(['الٓمٓ'],'ألف لام',true).complete,false);assert.equal(core.align(['الٓمٓ'],'ألف ميم لام',true).complete,false);assert.equal(core.align(['الٓمٓ'],'ألف لام ميم كلمة',true).complete,false);});
