/* Learning facts and projections. Shared by Learn, imports and the browser checks. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AllimLearning = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const copy = value => JSON.parse(JSON.stringify(value));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const methods = ["foundation300", "linked33", "turkishWall33", "mauritanianLawh"];
  const live = rows => rows.filter(row => !row.deleted && row.value);
  const pageKeys = (catalogue, page) => Object.keys(catalogue).filter(key => catalogue[key].includes(+page));
  function tasks(method, keys) {
    const result = [];
    if (method === "linked33") {
      keys.forEach((key, i) => { result.push({type: "verse", key, keys: [key]}); if (i || keys.length === 1) result.push({type: "segment", key: keys.length === 1 ? "__page__" : key, keys: keys.slice(0, i + 1)}); });
    } else if (keys.length) {
      let i = keys.length - 1;
      result.push({type: "verse", key: keys[i], keys: [keys[i]]});
      if (!i) result.push({type: "segment", key: "__page__", keys: keys.slice()});
      while (i) {
        const jump = Math.max(0, i - 2);
        result.push({type: "verse", key: keys[jump], keys: [keys[jump]]});
        if (jump + 1 < i) result.push({type: "verse", key: keys[jump + 1], keys: [keys[jump + 1]]});
        i = jump; result.push({type: "segment", key: keys[i], keys: keys.slice(i)});
      }
    }
    return result;
  }
  function project(records, catalogue, legacy = {}) {
    const heart = {linked33Pages: copy(legacy.heartMushaf?.linked33Pages || {}), turkishWallPages: copy(legacy.heartMushaf?.turkishWallPages || {}), lawhPages: copy(legacy.heartMushaf?.lawhPages || {})};
    const signals = copy(legacy.hifzCoach?.signals || []), rows = live(records);
    const methodPage = (method, number) => {
      const map = method === "linked33" ? heart.linked33Pages : heart.turkishWallPages;
      return map[number] ||= {pageNumber: +number, verseCounts: {}, [method === "linked33" ? "segmentCounts" : "wallCounts"]: {}, daily: {}, startedAt: "", lastAcceptedAt: "", completedAt: ""};
    };
    const lawh = key => heart.lawhPages[key] ||= {verifiedAt: "", readCount: 0, recallCount: 0, updatedAt: ""};
    for (const row of rows) {
      const v = row.value;
      if (row.kind === "hifz_method_baseline") {
        const [method, number] = row.id.split("/"), p = methodPage(method, number);
        Object.assign(p, {verseCounts: copy(v.verse_counts), [method === "linked33" ? "segmentCounts" : "wallCounts"]: copy(v.link_counts), daily: copy(v.daily), startedAt: v.started_at || "", lastAcceptedAt: v.last_accepted_at || "", completedAt: v.completed_at || ""});
      }
      if (row.kind === "hifz_coach_baseline") signals.push(...copy(v.signals));
      if (row.kind === "lawh_unit_baseline") Object.assign(lawh(row.id), {verifiedAt: v.verified_at || "", readCount: v.read_count, recallCount: v.recall_count, updatedAt: v.updated_at || ""});
    }
    const byTime = (a, b) => String(a.value.occurred_at || a.value.at || "").localeCompare(String(b.value.occurred_at || b.value.at || "")) || a.id.localeCompare(b.id);
    const taskCache = new Map();
    const taskIndex = row => {
      const v = row.value, key = v.method + "/" + v.page;
      if (!taskCache.has(key)) taskCache.set(key, tasks(v.method, pageKeys(catalogue, v.page)));
      return taskCache.get(key).findIndex(t => t.type === v.task_type && t.key === v.task_key);
    };
    // Credit prerequisites before later steps even when offline devices have different clocks.
    const credits = rows.filter(r => r.kind === "hifz_credit").sort((a, b) => a.value.method.localeCompare(b.value.method) || a.value.page - b.value.page || taskIndex(a) - taskIndex(b) || byTime(a, b));
    const ordered = rows.filter(r => r.kind !== "hifz_credit").sort(byTime).concat(credits);
    for (const row of ordered) {
      const v = row.value;
      if (row.kind === "hifz_signal") signals.push(copy(v));
      if (row.kind === "hifz_credit") {
        const p = methodPage(v.method, v.page), links = p[v.method === "linked33" ? "segmentCounts" : "wallCounts"];
        const all = tasks(v.method, pageKeys(catalogue, v.page));
        const current = all.find(t => (t.type === "verse" ? p.verseCounts[t.key] || 0 : links[t.key] || 0) < 33);
        if (!current || current.type !== v.task_type || current.key !== v.task_key) continue;
        const counts = current.type === "verse" ? p.verseCounts : links;
        counts[current.key] = Math.min(33, (counts[current.key] || 0) + 1);
        p.daily[v.local_date] = (p.daily[v.local_date] || 0) + 1;
        p.startedAt ||= v.occurred_at; p.lastAcceptedAt = v.occurred_at;
        if (all.every(t => (t.type === "verse" ? p.verseCounts[t.key] || 0 : links[t.key] || 0) >= 33)) p.completedAt ||= v.occurred_at;
      }
      if (row.kind === "lawh_practice") {
        const p = lawh(v.verse_key); p[v.practice === "read" ? "readCount" : "recallCount"]++;
        p.updatedAt = v.occurred_at; p.verifiedAt ||= v.verified_at;
      }
    }
    for (const row of rows) if (row.kind === "lawh_verification") lawh(row.id).verifiedAt = row.value.verified_at;
    signals.sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
    return {heartMushaf: heart, hifzCoach: {selectionMode: legacy.hifzCoach?.selectionMode === "adaptive" ? "adaptive" : "manual", signals: signals.slice(-240)}};
  }
  function apply(state, snapshot, catalogue) {
    const legacy = copy(snapshot.scope?.startsWith("guest:") ? snapshot.legacy?.learn || {} : {});
    if (snapshot.learningMigrated) {
      if (legacy.hifzCoach) legacy.hifzCoach.signals = [];
      if (legacy.heartMushaf) for (const field of ["linked33Pages", "turkishWallPages", "lawhPages"]) legacy.heartMushaf[field] = {};
    }
    const projected = project(snapshot.records, catalogue, legacy);
    state.heartMushaf = {...state.heartMushaf, ...projected.heartMushaf};
    state.hifzCoach = projected.hifzCoach;
    state.memorizationMethod = methods.includes(legacy.memorizationMethod) ? legacy.memorizationMethod : "foundation300";
    for (const row of live(snapshot.records)) if (row.kind === "preference") {
      if (row.id === "memorization_method") state.memorizationMethod = row.value.selected;
      if (row.id === "hifz_choice_mode") state.hifzCoach.selectionMode = row.value.selected;
    }
    return state;
  }
  function diff(before, after) {
    const intents = [];
    if (before.memorizationMethod !== after.memorizationMethod) intents.push({kind: "preference", id: "memorization_method", value: {selected: after.memorizationMethod}});
    if (before.hifzCoach?.selectionMode !== after.hifzCoach?.selectionMode) intents.push({kind: "preference", id: "hifz_choice_mode", value: {selected: after.hifzCoach.selectionMode}});
    return intents;
  }
  function journey(snapshot) {
    const old = snapshot.scope?.startsWith("guest:") && !snapshot.learningMigrated ? snapshot.legacy?.journey : null;
    const plans = new Map((old?.plans || []).map(p => [p.id, copy(p)])), sessions = new Map((old?.sessions || []).map(s => [s.id, copy(s)]));
    for (const row of snapshot.records) {
      const v = row.value;
      if (row.kind === "memory_plan") {
        if (row.deleted) plans.delete(row.id); else plans.set(row.id, {id: row.id, action: v.action, keys: v.verse_keys, portion: v.portion, created: v.created_on, deadline: v.deadline || ""});
      }
      if (row.kind === "recall_attempt") {
        if (row.deleted) sessions.delete(row.id); else sessions.set(row.id, {id: row.id, key: v.verse_key, mode: v.mode, date: v.local_date, complete: v.complete, total: v.total_words, hints: v.hints, flags: v.flags, dismissed: [], seconds: v.seconds, recordedAt: v.recorded_at || "", legacyOrder: v.legacy_order ?? null});
      }
    }
    for (const row of live(snapshot.records)) if (row.kind === "recall_flag") {
      const split = row.id.lastIndexOf("/"), id = row.id.slice(0, split), index = +row.id.slice(split + 1), s = sessions.get(id);
      if (s && s.flags.includes(index)) s.dismissed = row.value.dismissed ? [...new Set([...s.dismissed, index])] : s.dismissed.filter(i => i !== index);
    }
    const order = (a,b) => a.date.localeCompare(b.date) || (a.recordedAt && b.recordedAt ? a.recordedAt.localeCompare(b.recordedAt) : a.recordedAt ? 1 : b.recordedAt ? -1 : (a.legacyOrder ?? 0) - (b.legacyOrder ?? 0)) || a.id.localeCompare(b.id);
    return {version: 1, plans: [...plans.values()].sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id)), sessions: [...sessions.values()].sort(order)};
  }
  const planValue = p => ({action: p.action, verse_keys: p.keys, portion: p.portion, created_on: p.created, deadline: p.deadline || null});
  const sessionValue = (s,index=0) => ({verse_key: s.key, mode: s.mode, local_date: s.date, complete: s.complete, total_words: s.total, hints: s.hints, flags: s.flags, seconds: s.seconds, recorded_at: s.recordedAt || null, legacy_order: s.recordedAt ? null : s.legacyOrder ?? index});
  function journeyDiff(before, after) {
    const intents = [];
    for (const [field, kind, value] of [["plans", "memory_plan", planValue], ["sessions", "recall_attempt", sessionValue]]) {
      const old = new Map(before[field].map(row => [row.id, row])), next = new Set(after[field].map(row => row.id));
      for (const item of after[field]) {
        const previous = old.get(item.id);
        if (!previous || !same(value(previous), value(item))) intents.push({kind, id: item.id, value: value(item)});
        if (kind === "recall_attempt") for (const index of item.flags) if (!!previous?.dismissed.includes(index) !== item.dismissed.includes(index)) intents.push({kind: "recall_flag", id: item.id + "/" + index, value: {dismissed: item.dismissed.includes(index)}});
      }
      for (const id of old.keys()) if (!next.has(id)) intents.push({kind, id, action: "delete"});
    }
    return intents;
  }
  function validLegacyRecord(kind, id, v, catalogue) {
    const int = (n, lo = 0, hi = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= lo && n <= hi;
    const date = d => typeof d === "string" && /^\d{4}-\d\d-\d\d$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d + "T12:00:00Z").toISOString().slice(0, 10) === d;
    const instant = d => d === null || typeof d === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(d) && !Number.isNaN(Date.parse(d));
    const object = a => !!a && typeof a === "object" && !Array.isArray(a);
    const keys = a => Array.isArray(a) && a.length > 0 && a.length <= 604 && a.every(k => typeof k === "string" && Object.hasOwn(catalogue, k)) && new Set(a).size === a.length;
    const indexes = (a, total) => Array.isArray(a) && a.every(i => int(i, 0, total - 1)) && new Set(a).size === a.length;
    if (!object(v)) return false;
    if (kind === "memory_plan") return ["read", "memorize", "review"].includes(v.action) && keys(v.verse_keys) && int(v.portion, 1, 50) && date(v.created_on) && (v.deadline === null || date(v.deadline) && v.deadline >= v.created_on);
    if (kind === "recall_attempt") {
      const n = catalogue[v.verse_key]?.length;
      return !!n && ["read", "memory", "test", "manual-read", "manual-memory", "manual-review"].includes(v.mode) && date(v.local_date) && typeof v.complete === "boolean" && v.total_words === n && int(v.hints, 0, n) && indexes(v.flags, n) && int(v.seconds, 0, 86400) && (!v.mode.startsWith("manual-") || v.complete && !v.hints && !v.flags.length && !v.seconds);
    }
    if (kind === "hifz_method_baseline") {
      const [method, number] = id.split("/");
      if (!["linked33", "turkishWall33"].includes(method) || !int(+number, 1, 604)) return false;
      const all = tasks(method, pageKeys(catalogue, number));
      const counts = (a, type) => object(a) && Object.entries(a).every(([key, n]) => int(n, 0, 33) && all.some(t => t.type === type && t.key === key));
      return counts(v.verse_counts, "verse") && counts(v.link_counts, "segment") && object(v.daily) && Object.entries(v.daily).every(([d, n]) => date(d) && int(n)) && [v.started_at, v.last_accepted_at, v.completed_at].every(instant);
    }
    if (kind === "hifz_coach_baseline") return Array.isArray(v.signals) && v.signals.length <= 240 && v.signals.every(s => object(s) && methods.includes(s.method) && ["clean", "assisted", "incomplete"].includes(s.outcome) && ["verse", "connected"].includes(s.source) && int(s.hints, 0, 300) && instant(s.at));
    if (kind === "lawh_unit_baseline") return Object.hasOwn(catalogue, id) && int(v.read_count) && int(v.recall_count) && instant(v.verified_at) && instant(v.updated_at);
    return true; // Photo records are produced by the bounded binary encoder; flags are checked with their attempt.
  }
  return {methods, tasks, pageKeys, project, apply, diff, journey, journeyDiff, planValue, sessionValue, validLegacyRecord};
});
