'use strict';
const assert = require('node:assert/strict');
const {controller, stable} = require('../reading-sync.js');
const {fresh, validate} = require('../reading-journal.js');
const clone = value => JSON.parse(JSON.stringify(value));
const id = () => crypto.randomUUID();
function setup() {
 const cloud={user:'reader-a',revision:0,book:fresh(),last:null,lose:false,posts:0};
 const request=async(method,data)=>{
  if(method==='load')return {...clone(cloud),csrf:'session-token'};
  cloud.posts++; assert.equal(data.expected_user,cloud.user);
  if(cloud.last===data.operation)return {status:'replayed',user:cloud.user,revision:cloud.revision};
  if(cloud.revision!==data.revision)return {status:'conflict',...clone(cloud)};
  cloud.book=clone(data.book);cloud.revision++;cloud.last=data.operation;
  if(cloud.lose){cloud.lose=false;throw Error('lost-response');}
  return {status:'saved',user:cloud.user,revision:cloud.revision};
 };
 function device(initial=fresh()) {
  let book=clone(initial),meta=null; const states=[],backups=[];
  const api=controller({load:()=>meta,store:value=>{meta=clone(value);},getBook:()=>book,setBook:value=>{book=clone(value);return true;},validate,id,request,backup:value=>backups.push(clone(value)),state:s=>states.push(s)});
  return {api,states,backups,get book(){return book;},get meta(){return meta;},edit:fn=>fn(book)};
 }
 return {cloud,device};
}
(async()=>{
 const env=setup(),a=env.device(); a.edit(b=>b.past=3);
 await a.api.sync();assert.equal(env.cloud.book.past,3);assert.equal(a.states.at(-1),'synced');assert.equal(a.meta.base.length,64);
 await a.api.sync();assert.equal(env.cloud.posts,1,'unchanged sync makes no write');
 const b=env.device();await b.api.sync();assert.equal(b.book.past,3,'empty device downloads');
 a.edit(v=>v.past=4);env.cloud.lose=true;await a.api.sync();assert.equal(a.states.at(-1),'offline');
 const pending=a.meta.pending.id;assert(pending);assert.equal(env.cloud.revision,2);
 await a.api.sync();assert.equal(env.cloud.revision,2,'lost response retry does not create another revision');assert.equal(a.meta.pending,null);
 b.edit(v=>v.past=8);await b.api.sync();assert.equal(b.states.at(-1),'conflict');assert.equal(b.book.past,8);assert.equal(env.cloud.book.past,4);
 await b.api.acceptRemote();assert.equal(b.backups[0].past,8);assert.equal(b.book.past,4);
 b.edit(v=>v.past=9);await b.api.sync();assert.equal(env.cloud.book.past,9);
 await a.api.sync();assert.equal(a.book.past,9,'clean local journal follows new cloud revision');
 const posts=env.cloud.posts;env.cloud.user='reader-b';a.edit(v=>v.past=100);await a.api.sync();assert.equal(a.states.at(-1),'account');assert.equal(env.cloud.posts,posts,'another account cannot receive local journal');
 env.cloud.user='reader-a';assert(a.api.disconnect());a.edit(v=>{Object.assign(v,fresh());});await a.api.sync();assert.equal(a.book.past,9,'local clear must not clear the account');
 const c=env.device({...fresh(),past:22});await c.api.sync();assert.equal(c.states.at(-1),'conflict','first link does not replace two nonempty histories');
 const bad=controller({load:()=>null,store:()=>{throw Error('quota');},getBook:()=>({...fresh(),past:2}),setBook:()=>true,validate,id,request:async()=>({user:'reader',revision:0,book:fresh(),csrf:'token'}),backup:()=>{},state:()=>{}});
 await bad.sync();assert.equal(bad.linked(),false,'failed local metadata persistence must not link or upload');
 assert.equal(stable({b:2,a:1}),stable({a:1,b:2}));
 console.log('Sync passed: first link, restore, duplicate retry, offline acknowledgement, two-device conflict, backup, account isolation and local clear.');
})().catch(e=>{console.error(e);process.exitCode=1;});
