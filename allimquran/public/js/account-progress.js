/* Pure projections shared by Learn and Academy. Recognition decisions stay in recitation-core. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AllimProgress = factory();
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const copy = value => JSON.parse(JSON.stringify(value));
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const pref = {language: "language", arabicSize: "arabic_size", showMeaning: "show_meaning", selectedReciter: "selected_reciter", audioRepeat: "audio_repeat", showInterlinear: "show_interlinear", mushafFont: "mushaf_font", mushafPaper: "mushaf_paper", mushafInk: "mushaf_ink", autoAdvance: "auto_advance", soundCues: "sound_cues", strictCorrection: "strict_correction"};
  const reflectionFields = {verseKey: "verse_key", reference: "reference", reflection: "reflection", action: "action", completed: "completed", fawaidId: "fawaid_id", fawaidScholar: "fawaid_scholar", fawaidBenefit: "fawaid_benefit", fawaidSourceUrl: "fawaid_source_url", trigger: "trigger", reviewAt: "review_at", completedAt: "completed_at", createdAt: "authored_at", updatedAt: "edited_at"};
  const unit = () => ({weekCounts: [0, 0, 0], daily: {}, maintenanceCount: 0, maintenanceLevel: 0, startedAt: "", lastAcceptedAt: "", completedAt: "", nextReviewAt: "", permanent: false});
  const page = n => ({pageNumber: Number(n), connectedAttempts: 0, connectedReviews: 0, lastConnectedAt: "", sealedAt: "", permanent: false});
  const total = item => (item?.weekCounts || []).reduce((a, b) => a + b, 0);
  const order = {connected_started: 0, hint_used: 1, verse_completed: 2, connected_completed: 3};
  const intervals = [30, 60, 90, 180, 365];
  function addDays(value, days) {
    const target = new Date(value.local_date + "T12:00:00.000Z");
    target.setUTCDate(target.getUTCDate() + days);
    if (!value.time_zone) return new Date(+target - value.utc_offset_minutes * 60000).toISOString();
    const formatter = new Intl.DateTimeFormat("en-GB", {timeZone: value.time_zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"});
    let result = +target;
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(result)).map(part => [part.type, part.value]));
      const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
      result += +target - local;
    }
    return new Date(result).toISOString();
  }
  function project(records, catalogue = {}, baseline = {}) {
    const result = {sessions: Number(baseline.sessions) || 0, wordsReviewed: Number(baseline.wordsReviewed) || 0,
      hints: Number(baseline.hints) || 0, activity: copy(baseline.activity || {}), heartMushaf: copy(baseline.heartMushaf || {units: {}, pages: {}})};
    const units = result.heartMushaf.units ||= {}, pages = result.heartMushaf.pages ||= {}, events = [];
    const unitFields = {week_counts: "weekCounts", maintenance_count: "maintenanceCount", maintenance_level: "maintenanceLevel", started_at: "startedAt", last_accepted_at: "lastAcceptedAt", completed_at: "completedAt", next_review_at: "nextReviewAt", permanent: "permanent"};
    const pageFields = {connected_attempts: "connectedAttempts", connected_reviews: "connectedReviews", last_connected_at: "lastConnectedAt", sealed_at: "sealedAt", permanent: "permanent"};
    for (const row of records) {
      if (row.deleted || !row.value) continue;
      const value = row.value, id = row.id;
      if (row.kind === "learning_event") events.push(row);
      if (row.kind === "activity_baseline") Object.assign(result, {sessions: value.sessions, wordsReviewed: value.words_reviewed, hints: value.hints});
      if (row.kind === "activity_day_baseline") result.activity[id] = value.count;
      if (row.kind === "hifz_unit_baseline") { const item = units[id] ||= unit(); for (const [a, b] of Object.entries(unitFields)) item[b] = value[a] == null ? "" : copy(value[a]); }
      if (row.kind === "hifz_day_baseline") { const [verse, day] = id.split("/"); (units[verse] ||= unit()).daily[day] = value.count; }
      if (row.kind === "hifz_page_baseline") { const item = pages[id] ||= page(id); for (const [a, b] of Object.entries(pageFields)) item[b] = value[a] ?? ""; }
    }
    const started = new Set();
    const pageKeys = {};
    const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
    events.sort((a, b) => compare(a.value.occurred_at, b.value.occurred_at) || order[a.value.event_type] - order[b.value.event_type] || compare(a.id, b.id));
    for (const row of events) {
      const value = row.value, kind = value.event_type, now = value.occurred_at, day = value.local_date;
      if (kind === "hint_used") result.hints++;
      else if (kind === "verse_completed") {
        result.sessions++; result.wordsReviewed += value.matched_words; result.activity[day] = (result.activity[day] || 0) + 1;
        if (!value.full_verse || value.hints_used) continue;
        const item = units[value.verse_key] ||= unit();
        item.startedAt ||= now; item.lastAcceptedAt = now; item.daily[day] = (item.daily[day] || 0) + 1;
        if (total(item) < 300) {
          item.weekCounts[item.weekCounts.findIndex(count => count < 100)]++;
          if (total(item) === 300) Object.assign(item, {completedAt: now, permanent: true, nextReviewAt: addDays(value, 30), maintenanceCount: 0});
        } else if (item.nextReviewAt && now >= item.nextReviewAt) {
          item.maintenanceCount++;
          if (item.maintenanceCount === 20) { item.maintenanceLevel++; item.maintenanceCount = 0; item.nextReviewAt = addDays(value, intervals[Math.min(item.maintenanceLevel, 4)]); }
        }
      } else if (kind === "connected_started" || kind === "connected_completed") {
        const item = pages[value.page] ||= page(value.page);
        const keys = pageKeys[value.page] ||= Object.keys(catalogue).filter(key => catalogue[key].includes(value.page));
        const ready = keys.length > 0 && keys.every(key => total(units[key]) >= 300);
        const attempt = value.attempt_id + "/" + value.page;
        if (kind === "connected_started") { item.connectedAttempts++; if (ready) started.add(attempt); }
        else if (ready && started.has(attempt)) {
          item.lastConnectedAt = now;
          if (item.permanent) item.connectedReviews++;
          else Object.assign(item, {sealedAt: now, permanent: true});
        }
      }
    }
    return result;
  }
  function compose(snapshot, defaults = {}, catalogue = {}) {
    const object = value => value && typeof value === "object" && !Array.isArray(value);
    const raw = snapshot.scope?.startsWith("guest:") && object(snapshot.legacy.learn) ? snapshot.legacy.learn : {};
    const legacy = copy(raw);
    const validVerse = id => typeof id === "string" && /^[1-9][0-9]{0,2}:[1-9][0-9]{0,2}$/.test(id) && (!Object.keys(catalogue).length || Object.hasOwn(catalogue, id));
    for (const field of ["savedVerses", "reviewQueue"]) legacy[field] = Array.isArray(raw[field]) ? raw[field].filter(validVerse) : [];
    legacy.lifePractice = {entries: Array.isArray(raw.lifePractice?.entries) ? raw.lifePractice.entries.filter(item => object(item) && typeof item.id === "string" && validVerse(item.verseKey)) : []};
    legacy.activity = object(raw.activity) ? raw.activity : {};
    legacy.heartMushaf = {units: {}, pages: {}};
    if (object(raw.heartMushaf?.units)) for (const [key, value] of Object.entries(raw.heartMushaf.units)) {
      if (!validVerse(key) || !object(value)) continue;
      const normalized = {...unit(), ...value};
      const accepted = Math.max(0, Math.min(300, Number(value.accepted) || 0));
      const counts = Array.isArray(value.weekCounts) ? value.weekCounts : [accepted, accepted - 100, accepted - 200];
      normalized.weekCounts = [0, 1, 2].map(i => Math.max(0, Math.min(100, Number(counts[i]) || 0)));
      normalized.daily = object(value.daily) ? value.daily : {};
      legacy.heartMushaf.units[key] = normalized;
    }
    if (object(raw.heartMushaf?.pages)) for (const [key, value] of Object.entries(raw.heartMushaf.pages)) {
      if (/^[1-9][0-9]{0,2}$/.test(key) && +key <= 604 && object(value)) legacy.heartMushaf.pages[key] = {...page(key), ...value};
    }
    const state = copy(defaults);
    // Copy only fields understood by this screen; keep unknown legacy data solely in backup.
    for (const field of Object.keys(defaults)) if (Object.hasOwn(legacy, field) && typeof legacy[field] === typeof defaults[field] && legacy[field] !== null) state[field] = copy(legacy[field]);
    Object.assign(state, project(snapshot.records, catalogue, legacy));
    const bookmarks = new Map((legacy.savedVerses || []).map((id, i) => [id, i]));
    const reviews = new Map((legacy.reviewQueue || []).map((id, i) => [id, i]));
    const reflections = new Map((legacy.lifePractice?.entries || []).map(item => [item.id, copy(item)]));
    for (const row of snapshot.records) {
      const value = row.value;
      if (row.kind === "bookmark" || row.kind === "review_item") {
        const set = row.kind === "bookmark" ? bookmarks : reviews;
        if (row.deleted) set.delete(row.id); else set.set(row.id, value.position);
      }
      if (row.kind === "reflection") {
        if (row.deleted) reflections.delete(row.id);
        else {
          const item = {id: row.id};
          for (const [a, b] of Object.entries(reflectionFields)) if (Object.hasOwn(value, b)) item[a] = value[b];
          reflections.set(row.id, item);
        }
      }
      if (row.deleted || !value) continue;
      if (row.kind === "preference") {
        const field = Object.keys(pref).find(field => pref[field] === row.id);
        if (field) state[field] = value.selected;
        if (row.id === "recitation_flow") { state.recitationFlow = value.selected.mode; state.recitationFlowExplicit = value.selected.explicit; }
      }
      if (row.kind === "daily_goal") state.dailyGoal = value.sessions;
      if (row.kind === "reading_position") { const parts = value.verse_key.split(":").map(Number); state.selectedSurah = parts[0]; state.selectedAyah = parts[1]; }
    }
    state.savedVerses = [...bookmarks].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([id]) => id);
    state.reviewQueue = [...reviews].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([id]) => id);
    state.lifePractice = {entries: [...reflections.values()].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))};
    const device = snapshot.device.recognition || {mode: legacy.recognitionMode || defaults.recognitionMode || "auto", explicit: !!legacy.recognitionModeExplicit};
    state.recognitionMode = device.mode; state.recognitionModeExplicit = device.explicit;
    // The supported display fallback must never become a write of a different preferred language.
    if (!["ru", "en", "ar"].includes(state.language)) state.language = "ru";
    if (state.arabicSize !== undefined && (!Number.isInteger(state.arabicSize) || state.arabicSize < 34 || state.arabicSize > 66)) state.arabicSize = defaults.arabicSize;
    if (state.dailyGoal !== undefined && ![1, 2, 3, 5].includes(state.dailyGoal)) state.dailyGoal = defaults.dailyGoal;
    if (state.selectedSurah !== undefined && !validVerse(state.selectedSurah + ":" + state.selectedAyah)) { state.selectedSurah = defaults.selectedSurah; state.selectedAyah = defaults.selectedAyah; }
    return state;
  }
  function diff(before, after) {
    const intents = [];
    const set = (kind, id, value) => intents.push({kind, id, value, action: "set"});
    for (const [field, id] of Object.entries(pref)) if (!equal(before[field], after[field])) set("preference", id, {selected: after[field]});
    if (before.recitationFlow !== after.recitationFlow || before.recitationFlowExplicit !== after.recitationFlowExplicit) set("preference", "recitation_flow", {selected: {mode: after.recitationFlow, explicit: !!after.recitationFlowExplicit}});
    if (before.dailyGoal !== after.dailyGoal) set("daily_goal", "current", {sessions: after.dailyGoal});
    if (before.selectedSurah !== after.selectedSurah || before.selectedAyah !== after.selectedAyah) set("reading_position", "last", {verse_key: after.selectedSurah + ":" + after.selectedAyah});
    for (const [field, kind] of [["savedVerses", "bookmark"], ["reviewQueue", "review_item"]]) {
      const old = before[field] || [], next = after[field] || [];
      for (const id of old) if (!next.includes(id)) intents.push({kind, id, action: "delete"});
      // Existing members retain their position; insertions do not rewrite every other bookmark.
      next.forEach((id, index) => { if (!old.includes(id)) set(kind, id, {position: index === 0 ? -Date.now() : Date.now() + index}); });
    }
    const oldEntries = new Map((before.lifePractice?.entries || []).map(row => [row.id, row]));
    const nextEntries = after.lifePractice?.entries || [];
    for (const row of nextEntries) if (!equal(oldEntries.get(row.id), row)) {
      const value = {verse_key: row.verseKey, reflection: row.reflection || "", action: row.action || "", completed: !!row.completed};
      for (const [a, b] of Object.entries(reflectionFields)) if (Object.hasOwn(row, a)) value[b] = row[a] || (["completed", "reflection", "action"].includes(a) ? value[b] : null);
      set("reflection", row.id, value);
    }
    for (const id of oldEntries.keys()) if (!nextEntries.some(row => row.id === id)) intents.push({kind: "reflection", id, action: "delete"});
    return intents;
  }
  function timing(now = new Date()) {
    return {occurred_at: now.toISOString(), local_date: new Date(+now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10), utc_offset_minutes: -now.getTimezoneOffset(), time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || null};
  }
  return {project, compose, diff, timing, addDays, reflectionFields};
});
