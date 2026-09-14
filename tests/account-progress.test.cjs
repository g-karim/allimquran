const {test} = require('node:test');
const assert = require('node:assert/strict');
const progress = require('../allimquran/public/js/account-progress.js');
const snapshot = (scope, records, legacy = {}) => ({scope, records, legacy, device: {}});
const defaults = {language: 'ru', recognitionMode: 'auto', recognitionModeExplicit: false, savedVerses: [], reviewQueue: [], lifePractice: {entries: []}};
test('account composition never picks up guest aggregates or notes', () => {
  const legacy = {learn: {sessions: 400, savedVerses: ['1:1'], lifePractice: {entries: [{id: 'old', reflection: 'guest secret'}]}}};
  const state = progress.compose(snapshot('account:a:e', [], legacy), defaults);
  assert.equal(state.sessions, 0); assert.deepEqual(state.savedVerses, []); assert.deepEqual(state.lifePractice.entries, []);
});
test('guest tombstones override legacy memberships without touching the original backup', () => {
  const legacy = {learn: {sessions: 7, savedVerses: ['1:1', '1:2']}};
  const state = progress.compose(snapshot('guest:a', [{kind:'bookmark',id:'1:1',deleted:true}], legacy), defaults);
  assert.deepEqual(state.savedVerses, ['1:2']); assert.equal(state.sessions, 7); assert.deepEqual(legacy.learn.savedVerses, ['1:1','1:2']);
});
test('screen language fallback does not overwrite an account locale during another action', () => {
  const before = progress.compose(snapshot('account:a:e', [{kind:'preference',id:'language',value:{selected:'tr'}}]), defaults);
  const intents = progress.diff(before, {...before, dailyGoal:3});
  assert.equal(before.language, 'ru'); assert.deepEqual(intents, [{kind:'daily_goal',id:'current',value:{sessions:3},action:'set'}]);
});
test('aggregate state changes never turn into replacement snapshots or synthetic events', () => {
  const before = {...defaults, sessions:0, wordsReviewed:0, hints:0, activity:{}, heartMushaf:{units:{},pages:{}}};
  assert.deepEqual(progress.diff(before, {...before,sessions:4,wordsReviewed:100,hints:3,activity:{'2026-09-14':4}}), []);
});
test('device recognition settings are excluded from account intentions', () => {
  assert.deepEqual(progress.diff(defaults,{...defaults,recognitionMode:'quran',recognitionModeExplicit:true}),[]);
});
test('new membership does not rewrite positions of existing entries', () => {
  const changes=progress.diff({...defaults,savedVerses:['1:1','1:2']},{...defaults,savedVerses:['1:3','1:1','1:2']});
  assert.equal(changes.length,1);assert.equal(changes[0].id,'1:3');
});
