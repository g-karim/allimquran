/* Explicit, resumable transfer of a frozen guest snapshot. Raw backups never go to the API. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AllimImport = api;
})(typeof window === "object" ? window : globalThis, function (root) {
  "use strict";
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === "object" && !Array.isArray(value);
  const req = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  const fail = code => Object.assign(new Error(code), {code});
  const canonical = value => JSON.stringify(sort(value));
  function sort(value) { return Array.isArray(value) ? value.map(sort) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])])) : value; }
  async function hash(value) { return Array.from(new Uint8Array(await root.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value))))).map(byte => byte.toString(16).padStart(2, "0")).join(""); }
  const categories = {settings: ["preference", "daily_goal", "reading_position", "academy_plan", "academy_diagnostic"], bookmarks: ["bookmark", "review_item"], notes: ["reflection"], history: ["activity_baseline", "activity_day_baseline", "hifz_unit_baseline", "hifz_day_baseline", "hifz_page_baseline", "learning_event"], journal: ["reading_cycle", "reading_plan", "reading_past", "reading_entry"]};
  const category = kind => Object.keys(categories).find(key => categories[key].includes(kind));
  const pref = {language: "language", arabicSize: "arabic_size", showMeaning: "show_meaning", selectedReciter: "selected_reciter", audioRepeat: "audio_repeat", showInterlinear: "show_interlinear", mushafFont: "mushaf_font", mushafPaper: "mushaf_paper", mushafInk: "mushaf_ink", mushafLayout: "mushaf_layout", mushafTextSize: "mushaf_text_size", autoAdvance: "auto_advance", soundCues: "sound_cues", strictCorrection: "strict_correction"};
  const noteFields = {verseKey: "verse_key", reference: "reference", reflection: "reflection", action: "action", completed: "completed", fawaidId: "fawaid_id", fawaidScholar: "fawaid_scholar", fawaidBenefit: "fawaid_benefit", fawaidSourceUrl: "fawaid_source_url", trigger: "trigger", reviewAt: "review_at", completedAt: "completed_at", createdAt: "authored_at", updatedAt: "edited_at"};
  const instant = value => value ? new Date(value).toISOString() : null;
  const legacyKeys = ["quran-companion-prototype-v4", "allim-academy-plan-v1", "allim-academy-diagnostic-v1", "allim-language-preference-v1", "allim-reading-journal-v1", "allim-reading-sync-v1", "allim-reading-recovery-v1"];
  function parse(raw) { try { return JSON.parse(raw || "null"); } catch (_) { return null; } }

  function mapSource(source, catalogue, language) {
    const items = new Map(), warnings = [];
    const add = (kind, id, value, index = 0) => items.set(kind + "/" + id + "/" + index, {kind, id, value, source_key: {legacy_key: kind + "/" + id, occurrence_index: index}});
    const safe = (label, callback) => { try { callback(); } catch (_) { warnings.push(label); } };
    const legacy = source.legacy || {}, learn = object(legacy.learn) ? legacy.learn : {};
    for (const [field, id] of Object.entries(pref)) if (Object.hasOwn(learn, field)) add("preference", id, {selected: learn[field]});
    if (learn.recitationFlow) add("preference", "recitation_flow", {selected: {mode: learn.recitationFlow, explicit: !!learn.recitationFlowExplicit}});
    if (language || legacy.home_language) add("preference", "language", {selected: language || legacy.home_language});
    if (learn.dailyGoal !== undefined) add("daily_goal", "current", {sessions: learn.dailyGoal});
    if (learn.selectedSurah && learn.selectedAyah) add("reading_position", "last", {verse_key: learn.selectedSurah + ":" + learn.selectedAyah});
    for (const [field, kind] of [["savedVerses", "bookmark"], ["reviewQueue", "review_item"]]) {
      if (Array.isArray(learn[field])) learn[field].forEach((id, index) => add(kind, id, {position: index}));
      else if (learn[field] != null) warnings.push(field);
    }
    const plan = legacy.plan;
    if (object(plan)) add("academy_plan", "current", {minutes: plan.minutes, focus: plan.focus, target: plan.target});
    if (object(legacy.diagnostic)) safe("academy_diagnostic", () => { const d = legacy.diagnostic; add("academy_diagnostic", "current", {level: d.level, goal: d.goal, minutes: d.minutes, answered_at: instant(d.createdAt), route: d.route}); });
    if (Array.isArray(learn.lifePractice?.entries)) {
      const occurrences = new Map();
      learn.lifePractice.entries.forEach((entry, index) => safe("reflection/" + index, () => {
        if (!object(entry)) throw fail("invalid_note");
        const id = String(entry.id ?? "position-" + index), occurrence = occurrences.get(id) || 0;
        occurrences.set(id, occurrence + 1);
        const value = {verse_key: entry.verseKey, reflection: entry.reflection || "", action: entry.action || "", completed: !!entry.completed};
        for (const [a, b] of Object.entries(noteFields)) if (Object.hasOwn(entry, a)) value[b] = b.endsWith("_at") ? instant(entry[a]) : entry[a] === "" && !["reflection", "action"].includes(b) ? null : entry[a];
        add("reflection", id, value, occurrence);
      }));
    }
    if ([learn.sessions, learn.wordsReviewed, learn.hints].some(value => value !== undefined && value !== 0)) add("activity_baseline", "totals", {sessions: learn.sessions ?? 0, words_reviewed: learn.wordsReviewed ?? 0, hints: learn.hints ?? 0});
    if (object(learn.activity)) for (const [day, count] of Object.entries(learn.activity)) add("activity_day_baseline", day, {count});
    if (object(learn.heartMushaf?.units)) for (const [id, item] of Object.entries(learn.heartMushaf.units)) safe("hifz/" + id, () => {
      const accepted = Math.max(0, Math.min(300, Number(item.accepted) || 0));
      const counts = Array.isArray(item.weekCounts) ? item.weekCounts : [0, 1, 2].map(i => Math.max(0, Math.min(100, accepted - i * 100)));
      add("hifz_unit_baseline", id, {week_counts: counts, maintenance_count: item.maintenanceCount ?? 0, maintenance_level: item.maintenanceLevel ?? 0, started_at: instant(item.startedAt), last_accepted_at: instant(item.lastAcceptedAt), completed_at: instant(item.completedAt), next_review_at: instant(item.nextReviewAt), permanent: !!item.permanent});
      if (object(item.daily)) for (const [day, count] of Object.entries(item.daily)) add("hifz_day_baseline", id + "/" + day, {count});
    });
    if (object(learn.heartMushaf?.pages)) for (const [id, item] of Object.entries(learn.heartMushaf.pages)) safe("hifz_page/" + id, () => add("hifz_page_baseline", id, {connected_attempts: item.connectedAttempts ?? 0, connected_reviews: item.connectedReviews ?? 0, last_connected_at: instant(item.lastConnectedAt), sealed_at: instant(item.sealedAt), permanent: !!item.permanent}));
    const book = source.journal;
    if (book) safe("legacy_journal", () => {
      if (book.version !== 1 || !Array.isArray(book.entries) || !Number.isInteger(book.cycle) || book.cycle < 1 || book.cycle > 100000) throw fail("invalid_journal");
      const cycles = new Set([book.cycle]);
      for (const entry of book.entries) if (Number.isInteger(entry.cycle) && entry.cycle >= 1 && entry.cycle <= book.cycle) cycles.add(entry.cycle);
      for (const cycle of cycles) add("reading_cycle", "legacy-" + cycle, {dataset_id: "hafs-madinah-604-v1"});
      add("reading_plan", "current", {cycle_id: "legacy-" + book.cycle, deadline: book.deadline || null});
      add("reading_past", "baseline", {completed_cycles: book.past});
      const occurrences = new Map();
      book.entries.forEach((entry, index) => safe("journal/" + index, () => {
        const id = "legacy-" + String(entry.id ?? index), occurrence = occurrences.get(id) || 0;
        occurrences.set(id, occurrence + 1);
        if (!cycles.has(entry.cycle)) throw fail("invalid_cycle");
        const parts = entry.parts.map(part => {
          const keys = [...new Set(part.keys || [])];
          if (!part.full && keys.some(key => { const [s, a, w] = key.split(":"); return catalogue[s + ":" + a]?.[+w - 1] !== part.page; })) throw fail("invalid_word_coverage");
          return {page: part.page, full: part.full, word_keys: part.full ? [] : keys};
        });
        add("reading_entry", id, {cycle_id: "legacy-" + entry.cycle, local_date: entry.date, source: entry.source, evidence: "legacy_import", parts}, occurrence);
      }));
    });
    // New guest records override legacy values, including explicit deletions. Counters stay baselines;
    // real events remain separate facts and are sent only after baselines have been considered.
    for (const row of source.records || []) {
      if (!category(row.kind)) continue;
      const key = row.kind + "/" + row.id + "/0";
      if (row.deleted) items.delete(key); else {
        add(row.kind, row.id, clone(row.value));
        if (row.source_key) items.get(key).source_key = clone(row.source_key);
      }
    }
    if (language) add("preference", "language", {selected: language});
    const recognized = new Set([...Object.keys(pref), "recitationFlow", "recitationFlowExplicit", "recognitionMode", "recognitionModeExplicit", "selectedSurah", "selectedAyah", "sessions", "wordsReviewed", "hints", "dailyGoal", "savedVerses", "reviewQueue", "activity", "heartMushaf", "lifePractice"]);
    for (const field of Object.keys(learn)) if (!recognized.has(field)) warnings.push("unknown:" + field);
    for (const field of Object.keys(learn.heartMushaf || {})) if (!["units", "pages"].includes(field)) warnings.push("unknown:heartMushaf." + field);
    if (source.raw?.["allim-reading-recovery-v1"]) warnings.push("reading_recovery_backup_only");
    return {items: [...items.values()], warnings, languageConflict: !!legacy.home_language && !!learn.language && legacy.home_language !== learn.language};
  }

  async function compile(source, sourceId, digest, selected, catalogue, language) {
    const mapped = mapSource(source, catalogue, language), operations = [], ids = new Map();
    const chosen = mapped.items.filter(item => selected.includes(category(item.kind)));
    for (const item of chosen) {
      item.import_item_id = "import:" + await hash([sourceId, item.kind, item.source_key.legacy_key, item.source_key.occurrence_index]);
      if (["reflection", "reading_entry", "reading_cycle"].includes(item.kind)) ids.set(item.kind + "/" + item.id, item.import_item_id);
    }
    const priority = kind => kind === "reading_cycle" ? 0 : kind === "learning_event" ? 2 : 1;
    chosen.sort((a, b) => priority(a.kind) - priority(b.kind));
    for (const item of chosen) {
      const value = clone(item.value), id = ids.get(item.kind + "/" + item.id) || item.id;
      if (value.cycle_id) value.cycle_id = ids.get("reading_cycle/" + value.cycle_id) || value.cycle_id;
      if (item.kind.endsWith("_baseline") || item.kind === "reading_past") value.provenance = {source_id: sourceId, source_digest: digest, mapping_version: 1, legacy_key: item.source_key.legacy_key};
      operations.push({op_id: root.crypto.randomUUID(), action: item.kind === "learning_event" ? "create" : "import_item", kind: item.kind, id: ["reflection", "reading_entry", "reading_cycle"].includes(item.kind) ? item.import_item_id : id, base_version: 0, value,
        ...(item.kind === "learning_event" ? {} : {import_id: "import:" + await hash([digest, 1]), import_item_id: item.import_item_id, source_key: item.source_key})});
    }
    return {operations, warnings: mapped.warnings};
  }

  async function meta(storage, stamp) { return storage.guarded(stamp, ["scopes"], "readonly", stores => req(stores.scopes.get(stamp.scope))); }
  async function update(storage, stamp, change) {
    return storage.guarded(stamp, ["scopes"], "readwrite", async stores => { const value = await req(stores.scopes.get(stamp.scope)); const result = change(value); await req(stores.scopes.put(value)); return result; });
  }
  async function capture(storage) {
    const stamp = storage.stamp();
    if (!stamp.scope.startsWith("account:") || storage.state !== "account_ready") throw fail("account_required");
    const source = await storage.guarded(stamp, ["scopes", "records"], "readonly", async stores => {
      const guest = await req(stores.scopes.get(storage.control.guest_scope));
      const records = (await req(stores.records.index("scope").getAll(storage.control.guest_scope))).map(({kind, id, value, deleted, source_key}) => ({kind, id, value, deleted, ...(source_key ? {source_key} : {})}));
      return {legacy: guest.legacy || {}, records, legacy_cleared: !!guest.legacy_cleared, journal_migrated: !!guest.journal_migrated, raw: {}};
    });
    for (const key of legacyKeys) { const value = root.localStorage.getItem(key); if (value !== null) source.raw[key] = value; }
    source.journal = source.legacy_cleared || source.journal_migrated ? null : parse(source.raw["allim-reading-journal-v1"]);
    const oldSync = parse(source.raw["allim-reading-sync-v1"]);
    // Any malformed owner marker is quarantined as well. Recovery books are backups, not sessions.
    source.journal_owner = oldSync?.user && oldSync.user !== "Guest" ? String(oldSync.user) : source.raw["allim-reading-sync-v1"] && (!object(oldSync) || (!oldSync.user && (oldSync.base || oldSync.pending || oldSync.conflict))) ? "unknown" : null;
    const digest = await hash(source), bytes = new TextEncoder().encode(JSON.stringify(source)).length;
    const estimate = await root.navigator.storage?.estimate?.();
    if (estimate?.quota && estimate.quota - estimate.usage < bytes * 3 + 65536) throw fail("quota_insufficient");
    // Frozen source first; nothing is mapped or sent before this transaction commits.
    await storage.guarded(stamp, ["scopes"], "readwrite", async stores => {
      const guest = await req(stores.scopes.get(storage.control.guest_scope));
      guest.import_backups ||= {};
      guest.import_backups[digest] ||= {source, captured_at: new Date().toISOString(), source_id: storage.control.guest_scope.slice(6)};
      await req(stores.scopes.put(guest));
    });
    return {source, digest, stamp};
  }
  async function start(storage, captured, selected, language) {
    const {source, digest, stamp} = captured;
    if (!selected.length || selected.some(name => !categories[name])) throw fail("select_categories");
    if (selected.includes("journal") && source.journal_owner && source.journal_owner !== storage.auth?.legacy_owner) throw fail("legacy_owner_mismatch");
    const sourceId = storage.control.guest_scope.slice(6);
    const begin = {op_id: root.crypto.randomUUID(), action: "begin_import", kind: "import_manifest", id: "import:" + await hash([digest, 1]), base_version: 0, value: {source_id: sourceId, source_digest: digest, mapping_version: 1}};
    const mapped = mapSource(source, root.AllimAccountUI?.catalogue || {}, language);
    if (mapped.languageConflict && selected.includes("settings") && !language) throw fail("choose_language");
    await update(storage, stamp, value => {
      value.import_jobs ||= {};
      const existing = value.import_jobs[digest];
      if (existing && !existing.done) return;
      // Additional categories can be chosen later. Existing durable receipts prevent duplicates.
      value.import_jobs[digest] = {digest, guest_scope: storage.control.guest_scope, selected, language, begin, results: [], done: false};
      value.import_dismissed = true;
    });
    storage.notify("records"); storage.broadcast(); storage.kick();
  }
  async function flush(storage, stamp) {
    const jobs = (await meta(storage, stamp))?.import_jobs || {};
    for (const digest of Object.keys(jobs)) {
      let job = jobs[digest];
      if (job.done) continue;
      const backup = await storage.guarded(stamp, ["scopes"], "readonly", async stores => (await req(stores.scopes.get(job.guest_scope)))?.import_backups?.[digest]);
      if (!backup) { await update(storage, stamp, value => { value.import_jobs[digest].error = "source_missing"; }); continue; }
      if (job.selected.includes("journal") && backup.source.journal_owner && backup.source.journal_owner !== storage.auth?.legacy_owner) throw fail("legacy_owner_mismatch");
      const send = operations => storage.api("apply", {protocol_version: 1, device_id: storage.control.device_id, operations}, stamp, true);
      if (!job.operations) {
        const result = (await send([job.begin])).results[0];
        if (!["applied", "noop"].includes(result.outcome)) throw fail(result.error?.code || "import_failed");
        let catalogue = root.AllimAccountUI?.catalogue;
        if (!catalogue || !Object.keys(catalogue).length) { const response = await root.fetch("/assets/allimquran/data/account-storage-catalogue.json"); if (!response.ok) throw fail("catalogue_unavailable"); catalogue = (await response.json()).verses; }
        const compiled = await compile(backup.source, result.canonical_source_id, digest, job.selected, catalogue, job.language);
        job = await update(storage, stamp, value => {
          const current = value.import_jobs[digest];
          if (!current.operations) Object.assign(current, compiled);
          return clone(current);
        });
      }
      // Bounded pass shares time with normal edits. Unfinished work resumes with identical IDs.
      for (let round = 0; round < 4; round++) {
        job = (await meta(storage, stamp)).import_jobs[digest];
        const complete = new Set(job.results.map(result => result.op_id)), selected = [];
        let bytes = 1024;
        for (const operation of job.operations) {
          if (complete.has(operation.op_id)) continue;
          const size = new TextEncoder().encode(JSON.stringify(operation)).length + 1;
          if (size > 245000) throw fail("payload_too_large");
          if (selected.length === 25 || bytes + size > 250000) break;
          selected.push(operation); bytes += size;
        }
        if (!selected.length) {
          await storage.pull(stamp);
          await update(storage, stamp, value => { value.import_jobs[digest].done = true; });
          break;
        }
        const response = await send(selected);
        await storage.pull(stamp);
        const currentRecords = (await storage.snapshot()).canonical;
        for (const result of response.results) {
          if (!["applied", "noop"].includes(result.outcome) || result.import_result?.outcome === "skipped_conflict") continue;
          const operation = selected.find(item => item.op_id === result.op_id);
          const row = currentRecords.find(item => item.kind === operation.kind && item.id === (result.event_id || operation.id));
          const comparable = value => { const copy = clone(value); delete copy.provenance; return canonical(copy); };
          const matches = row && !row.deleted && (["bookmark", "review_item"].includes(row.kind) || comparable(row.value) === comparable(operation.value));
          // A receipt for this source item may predate a later local edit. Never claim that
          // the newly selected text was imported when the receipt actually refers to its old value.
          result.verification = matches ? "confirmed" : "skipped_changed_source";
        }
        await update(storage, stamp, value => {
          const current = value.import_jobs[digest], seen = new Set(current.results.map(item => item.op_id));
          for (const result of response.results) if (!seen.has(result.op_id)) current.results.push(result);
        });
      }
      job = (await meta(storage, stamp)).import_jobs[digest];
      if (!job.done) storage.kick();
    }
  }
  async function report(storage) {
    if (!storage.control || storage.paused || storage.control.locked || !storage.control.scope.startsWith("account:")) return [];
    return Object.values((await meta(storage, storage.stamp()))?.import_jobs || {}).map(job => ({digest: job.digest, done: job.done, error: job.error, total: job.operations?.length, confirmed: job.results.length, skipped: job.results.filter(result => result.verification === "skipped_changed_source" || result.import_result?.outcome === "skipped_conflict" || !["applied", "noop"].includes(result.outcome)).length, warnings: job.warnings || []}));
  }
  async function migrateGuestJournal(storage, catalogue) {
    const stamp = storage.stamp();
    if (!stamp.scope.startsWith("guest:")) return;
    const current = await meta(storage, stamp);
    if (current.journal_migrated || current.legacy_cleared) return;
    const raw = {};
    for (const key of legacyKeys.slice(4)) { const value = root.localStorage.getItem(key); if (value !== null) raw[key] = value; }
    if (!raw["allim-reading-journal-v1"]) return;
    const sync = parse(raw["allim-reading-sync-v1"]), book = parse(raw["allim-reading-journal-v1"]);
    if (raw["allim-reading-sync-v1"] && (!object(sync) || sync.user && sync.user !== "Guest" || !sync.user && (sync.base || sync.pending || sync.conflict))) return;
    if (!root.AllimJournal.validLegacy(book, catalogue)) return;
    const source = {legacy: {}, records: [], raw, journal: book, journal_owner: null};
    const digest = await hash(source), hex = digest.slice(0, 12) + "4" + digest.slice(13, 16) + "8" + digest.slice(17, 32);
    const sourceId = [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join("-");
    const bytes = new TextEncoder().encode(JSON.stringify(source)).length;
    const estimate = await root.navigator.storage?.estimate?.();
    if (estimate?.quota && estimate.quota - estimate.usage < bytes * 3 + 65536) throw fail("quota_insufficient");
    await update(storage, stamp, value => {
      value.import_backups ||= {};
      value.import_backups[digest] ||= {source, captured_at: new Date().toISOString(), source_id: sourceId};
    });
    const compiled = await compile(source, sourceId, digest, ["journal"], catalogue);
    await storage.guarded(stamp, ["scopes", "records"], "readwrite", async stores => {
      const value = await req(stores.scopes.get(stamp.scope));
      if (value.journal_migrated) return;
      for (const operation of compiled.operations) {
        if (await req(stores.records.get([stamp.scope, operation.kind, operation.id]))) continue;
        value.sequence++;
        await req(stores.records.put({scope: stamp.scope, schema_version: 1, kind: operation.kind, id: operation.id, value: operation.value, deleted: false, version: 1, change_seq: value.sequence, source_key: operation.source_key}));
      }
      value.journal_migrated = true;
      await req(stores.scopes.put(value));
    });
    storage.notify("records"); storage.broadcast();
  }
  return {mapSource, compile, hash, categories, category, capture, start, flush, report, meta, update, migrateGuestJournal};
});
