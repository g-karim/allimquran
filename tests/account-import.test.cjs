const {test} = require('node:test');
const assert = require('node:assert/strict');
const migration = require('../allimquran/public/js/account-import.js');
const catalogue = require('../allimquran/public/data/account-storage-catalogue.json').verses;
const sourceId = 'ae6f207a-a9dd-4e5a-bbce-b01ee6e0c3e0';
const digest = 'c'.repeat(64);
const fixture = () => ({legacy: {home_language: 'en', learn: {language: 'ru', sessions: 7, wordsReviewed: 28, hints: 2, savedVerses: ['1:1', '1:2'], reviewQueue: ['1:3'], heartMushaf: {units: {'1:1': {accepted: 150, daily: {'2026-09-14': 2}}}, pages: {'1': {connectedAttempts: 3}}}, lifePractice: {entries: [{id: 'life-old', verseKey: '1:1', reflection: 'Сохранить текст', action: '', completed: true}]}, unknownMethod: {count: 42}}}, records: []});
test('explicit settings import preserves guest mushaf choices', async () => {
 const source = fixture();
 source.records = [
  {kind:'preference',id:'mushaf_layout',value:{selected:'adaptive'}},
  {kind:'preference',id:'mushaf_text_size',value:{selected:48}}
 ];
 const mapped = migration.mapSource(source, catalogue);
 assert.deepEqual(mapped.items.filter(r => r.id.startsWith('mushaf_')).map(r => r.value.selected), ['adaptive',48]);
 const excluded = await migration.compile(source,sourceId,digest,['bookmarks'],catalogue,'ru');
 assert.equal(excluded.operations.some(r => r.id.startsWith('mushaf_')), false);
});
test('maps old aggregates without synthesizing sessions; retains missing timestamps', () => {
 const result = migration.mapSource(fixture(), catalogue);
 assert.equal(result.languageConflict, true);
 assert.ok(result.warnings.includes('unknown:unknownMethod'));
 assert.deepEqual(result.items.find(r => r.kind === 'hifz_unit_baseline').value.week_counts, [100,50,0]);
 assert.equal(result.items.find(r => r.kind === 'reflection').value.completed_at, undefined);
 assert.equal(result.items.filter(r => r.kind === 'learning_event').length, 0);
});
test('guest edits and tombstones override the old snapshot', () => {
 const source = fixture(); source.records = [{kind:'bookmark',id:'1:1',deleted:true}, {kind:'reflection',id:'life-old',value:{verse_key:'1:1',reflection:'Changed',action:'',completed:false},deleted:false}];
 const result = migration.mapSource(source,catalogue);
 assert.equal(result.items.filter(r=>r.kind==='bookmark').length,1);
 assert.equal(result.items.find(r=>r.kind==='reflection').value.reflection,'Changed');
});
test('duplicate legacy note ids preserve occurrences with distinct stable import ids', async () => {
 const source = fixture(); source.legacy.learn.lifePractice.entries.push({...source.legacy.learn.lifePractice.entries[0],reflection:'Second'});
 const compiled = await migration.compile(source,sourceId,digest,['notes'],catalogue);
 assert.equal(new Set(compiled.operations.map(op=>op.id)).size,2);
 const again = await migration.compile(source,sourceId,digest,['notes'],catalogue);
 assert.deepEqual(compiled.operations.map(op=>op.id),again.operations.map(op=>op.id));
});
test('partial journal coverage uses canonical word identities; recovery is never counted', async () => {
 const source = fixture(); source.raw={'allim-reading-recovery-v1':'[{"book":{}}]'};
 source.journal={version:1,past:3,cycle:1,deadline:'',entries:[{id:'j',cycle:1,date:'2026-09-14',source:'mic',parts:[{page:1,full:false,total:99,keys:['1:1:1','1:1:2']}]}]};
 const compiled=await migration.compile(source,sourceId,digest,['journal'],catalogue);
 const cycle=compiled.operations.find(op=>op.kind==='reading_cycle');
 const entry=compiled.operations.find(op=>op.kind==='reading_entry');
 assert.equal(entry.value.cycle_id,cycle.id);
 assert.equal(entry.value.evidence,'legacy_import');
 assert.deepEqual(entry.value.parts,[{page:1,full:false,word_keys:['1:1:1','1:1:2']}]);
 assert.ok(compiled.warnings.includes('reading_recovery_backup_only'));
 source.journal.entries[0].parts[0].page=2;
 assert.equal(migration.mapSource(source,catalogue).items.filter(r=>r.kind==='reading_entry').length,0);
});
test('category selection does not send settings, raw unknown fields or consent', async () => {
 const compiled=await migration.compile(fixture(),sourceId,digest,['bookmarks'],catalogue);
 assert.ok(compiled.operations.every(op=>['bookmark','review_item'].includes(op.kind)));
 assert.ok(!JSON.stringify(compiled.operations).includes('unknownMethod'));
});
test('canonical digest has an order independent representation', async () => {
 assert.equal(await migration.hash({b:2,a:'Аят'}),await migration.hash({a:'Аят',b:2}));
});
module.exports={fixture};
