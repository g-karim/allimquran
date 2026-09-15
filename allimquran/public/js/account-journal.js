/* Journal accounting: unique coverage per cycle, practice volume including repeats. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AllimJournal = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const DATASET = 'hafs-madinah-604-v1';
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10) === value;
  function index(catalogue) {
    const pages = new Map();
    for (const [verse, words] of Object.entries(catalogue)) words.forEach((page, i) => { if (!pages.has(page)) pages.set(page, new Set()); pages.get(page).add(verse+':'+(i+1)); });
    return pages;
  }
  function verseParts(catalogue, first, last = first) {
    const keys = Object.keys(catalogue), start = keys.indexOf(first), end = keys.indexOf(last);
    if (start < 0 || end < start) throw Error('invalid_range');
    const pages = new Map();
    for (const verse of keys.slice(start, end+1)) catalogue[verse].forEach((page, i) => {
      if (!pages.has(page)) pages.set(page, {page, full:false, word_keys:[]});
      pages.get(page).word_keys.push(verse+':'+(i+1));
    });
    const parts = [...pages.values()];
    // Full canonical pages can use the compact representation; there is no guessed denominator.
    const counts = index(catalogue);
    return parts.map(part => part.word_keys.length === counts.get(part.page).size ? {page:part.page,full:true,word_keys:[]} : part);
  }
  function pageParts(first, last) {
    if (!Number.isInteger(first) || !Number.isInteger(last) || first<1 || last>604 || last<first) throw Error('invalid_range');
    return Array.from({length:last-first+1},(_,i)=>({page:first+i,full:true,word_keys:[]}));
  }
  function validLegacy(book, catalogue) {
    if (!book || book.version !== 1 || !Number.isInteger(book.past) || book.past < 0 || book.past > 100000 || !Number.isInteger(book.cycle) || book.cycle < 1 || book.cycle > 100000 || !Array.isArray(book.entries) || typeof book.deadline !== 'string' || (book.deadline && !validDate(book.deadline))) return false;
    const pages = index(catalogue);
    return book.entries.every(entry => {
      if (!entry || !validDate(entry.date) || !Number.isInteger(entry.cycle) || entry.cycle < 1 || entry.cycle > book.cycle || !['paper','digital','mic'].includes(entry.source) || !Array.isArray(entry.parts) || !entry.parts.length) return false;
      const seen = new Set();
      return entry.parts.every(part => {
        if (!part || !pages.has(part.page) || seen.has(part.page) || typeof part.full !== 'boolean' || !Array.isArray(part.keys)) return false;
        seen.add(part.page);
        return part.full || (part.keys.length > 0 && part.keys.every(key => pages.get(part.page).has(key)));
      });
    });
  }
  function entryForEvent(value, catalogue) {
    if (value.event_type !== 'verse_completed' || value.mode !== 'read' || value.evidence !== 'client_alignment' || !value.full_verse || !value.alignment_complete || value.hints_used !== 0 || catalogue[value.verse_key]?.length !== value.matched_words) return null;
    return {kind:'reading_entry',id:value.attempt_id,action:'set',insert_once:true,value:{cycle_id:null,local_date:value.local_date,occurred_at:value.occurred_at,utc_offset_minutes:value.utc_offset_minutes,time_zone:value.time_zone,source:'mic',evidence:'client_alignment',parts:verseParts(catalogue,value.verse_key)}};
  }
  function expand(intents, records, scope) {
    const existing = (kind,id) => records.find(row=>row.kind===kind && row.id===id);
    const input = intents.filter(intent=>!intent.insert_once || !existing(intent.kind,intent.id));
    const needsCycle = input.some(intent=>['reading_entry','reading_plan'].includes(intent.kind) && intent.action !== 'delete' && !intent.value?.cycle_id);
    if (!needsCycle) return input;
    const plan = existing('reading_plan','current'), cycleId = plan && !plan.deleted ? plan.value.cycle_id : scope.split(':').at(-1);
    const prefix = [];
    if (!existing('reading_cycle',cycleId)) prefix.push({kind:'reading_cycle',id:cycleId,value:{dataset_id:DATASET}});
    if ((!plan || plan.deleted) && !input.some(intent=>intent.kind==='reading_plan')) prefix.push({kind:'reading_plan',id:'current',value:{cycle_id:cycleId,deadline:null}});
    return prefix.concat(input.map(intent=>['reading_entry','reading_plan'].includes(intent.kind) && intent.action !== 'delete' && !intent.value?.cycle_id ? {...intent,value:{...intent.value,cycle_id:cycleId}} : intent));
  }
  function summary(records, catalogue, today) {
    const canonical = index(catalogue), rows = records.filter(row=>!row.deleted && row.value), entries = rows.filter(row=>row.kind==='reading_entry');
    const cycles = rows.filter(row=>row.kind==='reading_cycle').sort((a,b)=>(a.change_seq || 0)-(b.change_seq || 0) || a.id.localeCompare(b.id));
    const plan = rows.find(row=>row.kind==='reading_plan' && row.id==='current')?.value;
    const past = rows.find(row=>row.kind==='reading_past' && row.id==='baseline')?.value.completed_cycles || 0;
    const covered = new Map(); let volume = 0, todayVolume = 0;
    for (const row of entries) {
      if (!cycles.some(cycle=>cycle.id===row.value.cycle_id)) continue;
      const pages = covered.get(row.value.cycle_id) || new Map(); covered.set(row.value.cycle_id,pages);
      for (const part of row.value.parts) {
        const canonicalKeys = canonical.get(part.page); if (!canonicalKeys?.size) continue;
        const keys = new Set(part.full ? canonicalKeys : part.word_keys.filter(key=>canonicalKeys.has(key)));
        const page = pages.get(part.page) || new Set(); pages.set(part.page,page); for (const key of keys) page.add(key);
        const amount = keys.size/canonicalKeys.size; volume+=amount; if (row.value.local_date===today) todayVolume+=amount;
      }
    }
    const totals = cycles.map(cycle=>{
      const pages = covered.get(cycle.id) || new Map(); let current = 0, fullPages=0;
      for (const [page,keys] of pages) {current+=keys.size/canonical.get(page).size;if(keys.size===canonical.get(page).size)fullPages++;}
      return {...cycle,current,fullPages,complete:fullPages===604};
    });
    const active = totals.find(cycle=>cycle.id===plan?.cycle_id) || null;
    const current = active?.current || 0, remaining = Math.max(0,604-current);
    const days = plan?.deadline && validDate(today) ? Math.floor((Date.parse(plan.deadline+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000)+1 : null;
    const completed = totals.filter(cycle=>cycle.complete).length;
    return {cycles:totals,entries,active,plan,past,current,fullPages:active?.fullPages || 0,volume,todayVolume,completed,lifetime:past+completed,remaining,days,perDay:days>0?remaining/days:null};
  }
  return {DATASET,validDate,validLegacy,index,verseParts,pageParts,entryForEvent,expand,summary};
});
