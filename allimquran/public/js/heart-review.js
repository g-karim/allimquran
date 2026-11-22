/* Calendar reminders are not a measurement of memory. Achievements stay immutable. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AllimHeartReview = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000, PAGES = 604;
  const validDay = d => typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) === d;
  const dayNumber = d => { if (!validDay(d)) throw Error('invalid_date'); return Date.parse(d + 'T12:00:00Z') / DAY; };
  const localDay = (date = new Date()) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const addDays = (d, n) => new Date((dayNumber(d) + n) * DAY).toISOString().slice(0, 10);
  const active = rows => rows.filter(r => !r.deleted && r.value);
  const total = u => (u?.weekCounts || []).reduce((sum, n) => sum + Math.max(0, +n || 0), 0);
  function freshness(earned, target, last, now = new Date()) {
    const acquired = Math.min(1, Math.max(0, earned / target || 0));
    const elapsed = last ? (+now - Date.parse(last)) / DAY : NaN;
    const known = Number.isFinite(elapsed) && elapsed >= 0;
    const days = known ? Math.floor(elapsed) : null;
    const factor = known ? Math.max(.05, 1 - Math.max(0, elapsed - 7) * .95 / 28) : 1;
    return {acquired, factor, reveal: acquired * factor, days, due: acquired > 0 && (!known || elapsed > 7), unknown: acquired > 0 && !known};
  }
  function project(records, catalogue, heart = {}, now = new Date()) {
    const verses = {}, pages = {}, earned = {}, rows = active(records);
    const accept = (key, at, evidence) => {
      const time = Date.parse(at);
      if (!catalogue[key] || !Number.isFinite(time) || time > +now) return;
      if (!verses[key] || (time > Date.parse(verses[key].at) || time === Date.parse(verses[key].at) && evidence === 'client_alignment')) verses[key] = {at, evidence};
    };
    for (const [key, unit] of Object.entries(heart.units || {})) {
      earned[key] = Math.min(1, total(unit) / 300);
      accept(key, unit.lastAcceptedAt, 'recorded');
    }
    for (const [number, page] of Object.entries(heart.pages || {})) if (page.lastConnectedAt) {
      for (const [key, words] of Object.entries(catalogue)) if (words.includes(+number)) accept(key, page.lastConnectedAt, 'recorded');
    }
    for (const name of ['linked33Pages', 'turkishWallPages']) for (const page of Object.values(heart[name] || {})) {
      for (const [key, count] of Object.entries(page.verseCounts || {})) {
        earned[key] = Math.max(earned[key] || 0, count / 33);
        // A page timestamp alone cannot prove when an unfinished verse was last practised.
        if (page.completedAt) accept(key, page.completedAt, 'recorded');
      }
    }
    for (const [key, unit] of Object.entries(heart.lawhPages || {})) if (unit.recallCount) {
      earned[key] = Math.max(earned[key] || 0, Math.min(1, unit.recallCount / 33));
    }
    for (const row of rows) {
      const v = row.value;
      if (row.kind === 'learning_event' && v.event_type === 'verse_completed' && v.full_verse && v.alignment_complete && !v.hints_used) accept(v.verse_key, v.occurred_at, 'client_alignment');
      if (row.kind === 'hifz_credit') for (const key of v.verse_keys || []) accept(key, v.occurred_at, 'client_alignment');
      if (row.kind === 'lawh_practice' && v.practice === 'recall') accept(v.verse_key, v.occurred_at, 'self_reported');
      if (row.kind === 'recall_attempt' && ['memory', 'test', 'manual-memory', 'manual-review'].includes(v.mode) && v.complete && !v.hints && !v.flags.length) accept(v.verse_key, v.recorded_at, v.mode.startsWith('manual-') ? 'self_reported' : 'client_alignment');
      if (row.kind === 'heart_review') {
        if (v.verse_key) accept(v.verse_key, v.recorded_at, 'self_reported');
        else if (Date.parse(v.recorded_at) <= +now) for (let p = v.first_page; p <= v.last_page; p++) {
          if (!pages[p] || Date.parse(v.recorded_at) > Date.parse(pages[p].at)) pages[p] = {at: v.recorded_at, day: v.local_date, evidence: 'self_reported'};
        }
      }
    }
    // A verse spanning pages is refreshed only after every part has been reviewed.
    for (const [key, words] of Object.entries(catalogue)) {
      const unique = [...new Set(words)];
      if (unique.every(p => pages[p])) accept(key, unique.map(p => pages[p].at).sort()[0], 'self_reported');
    }
    const pageVerses = {};
    for (const [key, words] of Object.entries(catalogue)) for (const page of new Set(words)) (pageVerses[page] ||= []).push(key);
    for (const [page, keys] of Object.entries(pageVerses)) if (keys.every(k => verses[k])) {
      const at = keys.map(k => verses[k].at).sort()[0];
      if (!pages[page] || Date.parse(at) > Date.parse(pages[page].at)) pages[page] = {at, day: localDay(new Date(at)), evidence: keys.every(k => verses[k].evidence === 'client_alignment') ? 'client_alignment' : 'self_reported'};
    }
    return {verses, pages, earned};
  }
  function ranges(items) {
    const result = [];
    for (const item of items) {
      const last = result.at(-1);
      if (last && last.cycle === item.cycle && last.last + 1 === item.page) last.last = item.page;
      else result.push({cycle: item.cycle, first: item.page, last: item.page});
    }
    return result;
  }
  function reviewRoute(data, plan, today, now = new Date()) {
    if (!plan?.hafiz) {
      const keys = Object.keys(data.earned).filter(key => data.earned[key] > 0 && (!data.verses[key] || localDay(new Date(data.verses[key].at)) !== today));
      keys.sort((a, b) => (Date.parse(data.verses[a]?.at) || 0) - (Date.parse(data.verses[b]?.at) || 0) || a.localeCompare(b, undefined, {numeric: true}));
      return {keys: keys.slice(0, 5), ranges: [], due: keys.filter(k => freshness(data.earned[k], 1, data.verses[k]?.at, now).due).length};
    }
    if (today < plan.review_start) return {keys: [], ranges: [], due: 0};
    const quota = Math.ceil(PAGES / plan.review_days);
    const done = Object.values(data.pages).filter(p => p.day === today).length;
    const pages = Array.from({length: PAGES}, (_, i) => i + 1).filter(p => data.pages[p]?.day !== today);
    pages.sort((a, b) => (Date.parse(data.pages[a]?.at) || 0) - (Date.parse(data.pages[b]?.at) || 0) || a - b);
    return {keys: [], ranges: ranges(pages.slice(0, Math.max(0, quota - done)).map(page => ({page}))), due: pages.filter(p => freshness(1, 1, data.pages[p]?.at, now).due).length};
  }
  function planEnd(plan) {
    const start = plan.khatm_start;
    if (plan.khatm_mode === 'ramadan') return addDays(start, plan.ramadan_days - 1);
    // A calendar month from the selected date; clamp the anniversary in shorter months.
    const date = new Date(start + 'T12:00:00Z'), day = date.getUTCDate();
    date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + 1);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).getUTCDate();
    date.setUTCDate(Math.min(day, last));
    return addDays(date.toISOString().slice(0, 10), -1);
  }
  function khatmRoute(plan, records, catalogue, today) {
    const end = planEnd(plan), days = dayNumber(end) - dayNumber(today) + 1;
    const covered = new Map(), before = new Map(), canonical = new Map();
    for (const [key, words] of Object.entries(catalogue)) words.forEach((p, i) => {
      if (!canonical.has(p)) canonical.set(p, new Set());
      canonical.get(p).add(key + ':' + (i + 1));
    });
    for (const row of active(records)) if (row.kind === 'reading_entry' && row.value.local_date <= today && plan.cycle_ids.includes(row.value.cycle_id)) {
      for (const part of row.value.parts) {
        const id = row.value.cycle_id + '/' + part.page;
        const set = covered.get(id) || new Set(); covered.set(id, set);
        const earlier = before.get(id) || new Set(); before.set(id, earlier);
        for (const word of part.full ? canonical.get(part.page) || [] : part.word_keys) if (canonical.get(part.page)?.has(word)) {
          set.add(word); if (row.value.local_date < today) earlier.add(word);
        }
      }
    }
    const missing = []; let missingBefore = 0;
    for (const cycle of plan.cycle_ids) for (let page = 1; page <= PAGES; page++) {
      if (!canonical.get(page)?.size || covered.get(cycle + '/' + page)?.size !== canonical.get(page).size) missing.push({cycle, page});
      if (!canonical.get(page)?.size || before.get(cycle + '/' + page)?.size !== canonical.get(page).size) missingBefore++;
    }
    const doneToday = missingBefore - missing.length;
    const quota = days > 0 ? Math.max(0, Math.ceil(missingBefore / days) - doneToday) : 0;
    return {end, days, remaining: missing.length, completed: PAGES * plan.cycle_ids.length - missing.length,
      ranges: today < plan.khatm_start ? [] : ranges(missing.slice(0, quota)), quota, expired: days <= 0 && missing.length > 0};
  }
  return {DAY, PAGES, validDay, dayNumber, localDay, addDays, freshness, project, ranges, reviewRoute, planEnd, khatmRoute};
});
