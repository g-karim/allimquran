/* Personal storage. No microphone, transcript, LMS or research-consent data. */
(function (root) {
  "use strict";
  const API = "/api/method/allimquran.account_storage.";
  const DB_NAME = "allim-personal-data";
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const uuid = () => root.crypto.randomUUID();
  const key = row => row.kind + "/" + row.id;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const request = req => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const failure = (code, status = 0) => Object.assign(new Error(code), {code, status});
  const privateRow = row => { const result = {...row}; delete result.scope; return result; };

  class PersonalStorage {
    constructor() {
      this.listeners = new Set();
      this.state = "opening";
      this.control = null;
      this.auth = null;
      this.chain = Promise.resolve();
      this.db = null;
      this.lastError = null;
      this.localWrites = 0;
      this.unsaved = [];
      this.paused = false;
      this.channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("allim-personal-data") : null;
      if (this.channel) this.channel.onmessage = () => this.externalChange();
      root.addEventListener("storage", event => { if (event.key === "allim-storage-signal-v1") this.externalChange(); });
      root.addEventListener("online", () => this.sync());
      root.addEventListener("focus", () => this.sync());
      root.document.addEventListener("visibilitychange", () => { if (!root.document.hidden) this.sync(); });
      this.timer = root.setInterval(() => { if (!root.document.hidden) this.sync(); }, 20000);
    }

    async transaction(names, mode, work) {
      const tx = this.db.transaction(names, mode);
      const done = new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error || failure("transaction_aborted"));
        tx.onerror = () => {}; // onabort is the single transaction failure path.
      });
      const stores = Object.fromEntries(names.map(name => [name, tx.objectStore(name)]));
      try {
        const result = await work(stores);
        await done;
        return result;
      } catch (error) {
        try { tx.abort(); } catch (_) { /* already finished */ }
        await done.catch(() => {});
        throw error;
      }
    }

    async open() {
      if (this.opening) return this.opening;
      this.opening = this.start().catch(error => {
        this.setError(error);
        this.opening = null;
        throw error;
      });
      return this.opening;
    }

    async start() {
      if (!root.indexedDB) throw failure("storage_unavailable");
      const req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore("control", {keyPath: "id"});
        db.createObjectStore("scopes", {keyPath: "scope"});
        for (const name of ["records", "outbox"]) {
          const store = db.createObjectStore(name, {keyPath: name === "records" ? ["scope", "kind", "id"] : ["scope", "op_id"]});
          store.createIndex("scope", "scope");
        }
      };
      req.onblocked = () => { this.state = "upgrade_required"; this.notify(); };
      this.db = await request(req);
      this.db.onversionchange = () => { this.paused = true; this.db.close(); this.state = "upgrade_required"; this.notify(); };
      await this.transaction(["control", "scopes"], "readwrite", async stores => {
        let control = await request(stores.control.get("active"));
        if (!control) {
          const guest = "guest:" + uuid();
          const legacy = this.readLegacy();
          const mode = legacy.learn?.recognitionMode;
          const device = ["auto", "browser", "quran"].includes(mode) ? {recognition: {mode, explicit: !!legacy.learn.recognitionModeExplicit}} : {};
          control = {id: "active", guest_scope: guest, scope: guest, generation: 1, device_id: uuid(), device};
          await request(stores.control.put(control));
          await request(stores.scopes.put({scope: guest, ready: true, cursor: 0, sequence: 0, legacy}));
        }
        this.control = control;
      });
      for (let attempt = 0; attempt < 5; attempt++) {
        try { await this.refreshContext(false, false, true); break; }
        catch (error) {
          if (error.code !== "owner_changed" || attempt === 4) throw error;
          await this.adoptControl();
        }
      }
      this.kick();
      return this;
    }

    readLegacy() {
      // Read once for local compatibility. Original keys remain untouched until explicit migration.
      const result = {};
      for (const [name, storageKey] of Object.entries({learn: "quran-companion-prototype-v4", plan: "allim-academy-plan-v1", diagnostic: "allim-academy-diagnostic-v1"})) {
        try { result[name] = JSON.parse(root.localStorage.getItem(storageKey) || "null"); } catch (_) { result[name] = null; }
      }
      try { result.home_language = root.localStorage.getItem("allim-language-preference-v1"); } catch (_) { /* original key remains intact */ }
      return result;
    }

    stamp() {
      if (!this.control) throw failure("storage_not_ready");
      return {scope: this.control.scope, generation: this.control.generation, session_binding: this.control.session_binding};
    }

    async guard(stores, stamp) {
      const current = await request(stores.control.get("active"));
      if (!current || current.scope !== stamp.scope || current.generation !== stamp.generation || current.session_binding !== stamp.session_binding) throw failure("owner_changed");
      return current;
    }

    async guarded(stamp, names, mode, work) {
      return this.transaction(["control", ...names], mode, async stores => {
        await this.guard(stores, stamp);
        return work(stores);
      });
    }

    async api(method, body = {}, stamp = null, post = false) {
      const headers = {Accept: "application/json"};
      if (post) {
        headers["Content-Type"] = "application/json";
        headers["X-Frappe-CSRF-Token"] = this.auth?.csrf_token || "";
      }
      if (stamp) {
        await this.guarded(stamp, [], "readonly", () => {});
        const [, account, epoch] = stamp.scope.split(":");
        if (post) body = {...body, expected_account_id: account, epoch, session_binding: stamp.session_binding};
        else Object.assign(headers, {"X-Allim-Account": account, "X-Allim-Epoch": epoch, "X-Allim-Session": stamp.session_binding});
      }
      const abort = new AbortController();
      const timeout = root.setTimeout(() => abort.abort(), 12000);
      try {
        const response = await root.fetch(API + method + (post ? "" : "?" + new URLSearchParams(body)), {
          method: post ? "POST" : "GET", headers, credentials: "same-origin", cache: "no-store",
          ...(post ? {body: JSON.stringify(body)} : {}), signal: abort.signal
        });
        const payload = await response.json();
        if (stamp) await this.guarded(stamp, [], "readonly", () => {});
        if (!response.ok || payload.message?.error) throw failure(payload.message?.error?.code || "http_" + response.status, response.status);
        if (stamp) {
          await this.guarded(stamp, [], "readonly", () => {});
          if (payload.message?.account_id && (payload.message.account_id !== stamp.scope.split(":")[1] || (method !== "reset" && "account:" + payload.message.account_id + ":" + payload.message.epoch !== stamp.scope))) throw failure("owner_changed");
        }
        return payload.message;
      } catch (error) {
        if (!error.code) throw failure("network_unavailable");
        throw error;
      } finally { root.clearTimeout(timeout); }
    }

    async eraseScope(stores, scope) {
      for (const row of await request(stores.records.index("scope").getAll(scope))) await request(stores.records.delete([scope, row.kind, row.id]));
      const meta = await request(stores.scopes.get(scope));
      if (meta) await request(stores.scopes.put({...meta, ready: false, cursor: 0}));
    }

    async activate(scope, sessionBinding = null) {
      const control = await this.transaction(["control", "records", "scopes"], "readwrite", async stores => {
        const current = await request(stores.control.get("active"));
        if (!current) throw failure("owner_changed");
        if (current.scope !== scope || current.session_binding !== sessionBinding) {
          if (current.scope.startsWith("account:")) await this.eraseScope(stores, current.scope);
          current.scope = scope;
          current.session_binding = sessionBinding;
          current.generation++;
        }
        current.locked = false;
        await request(stores.control.put(current));
        if (!await request(stores.scopes.get(scope))) await request(stores.scopes.put({scope, ready: false, cursor: 0, sequence: 0}));
        return current;
      });
      const changed = this.control?.generation !== control.generation;
      this.control = control;
      this.paused = false;
      if (changed) { this.notify("owner"); this.broadcast(); }
      return this.stamp();
    }

    async refreshContext(forceOpen = false, resume = false, handshake = false) {
      const initial = this.stamp();
      let observed = initial;
      try {
        const context = await this.api("context");
        // A delayed context reply must never undo a logout or a change in another tab.
        await this.guarded(initial, [], "readonly", () => {});
        if (this.control.pending_logout && context.session_binding === this.control.pending_logout.session_binding) {
          const pending = this.control.pending_logout;
          this.auth = context;
          await this.api("end_session", {expected_account_id: pending.account_id, epoch: pending.epoch, session_binding: pending.session_binding}, null, true);
          await this.guarded(initial, [], "readonly", () => {});
          await this.guarded(initial, [], "readwrite", async stores => {
            const control = await request(stores.control.get("active"));
            delete control.pending_logout;
            await request(stores.control.put(control));
            this.control = control;
          });
          context.mode = "guest";
        }
        if (this.control.explicit_logout && !resume && (context.mode === "guest" || context.session_binding === this.control.suppressed_binding)) {
          await this.activate(this.control.guest_scope);
          this.state = "guest";
          this.notify();
          return;
        }
        if (context.mode === "guest") {
          // Expired authentication is locked, not silently converted into a guest.
          if (this.control.scope.startsWith("account:")) { await this.lockAccount(); return; }
          await this.activate(this.control.guest_scope);
          this.state = "guest";
          this.notify();
          return;
        }
        this.auth = context;
        if (!forceOpen && !handshake && this.control.scope.startsWith("account:") && context.session_binding === this.control.session_binding && !this.control.locked) {
          const meta = await this.guarded(initial, ["scopes"], "readonly", stores => request(stores.scopes.get(initial.scope)));
          if (meta?.ready) { this.state = "account_ready"; this.notify(); return; }
        }
        this.state = "opening_account";
        this.notify();
        const opened = await this.api("open", {}, null, true);
        await this.guarded(initial, [], "readonly", () => {});
        if (opened.session_binding !== context.session_binding) throw failure("session_changed", 403);
        if (opened.protocol_version !== 1 || opened.schema_version !== 1) throw failure("protocol_unsupported");
        const stamp = await this.activate("account:" + opened.account_id + ":" + opened.epoch, opened.session_binding);
        observed = stamp;
        this.capabilities = opened.capabilities;
        await this.guarded(stamp, ["scopes"], "readwrite", async stores => {
          const control = await request(stores.control.get("active"));
          delete control.explicit_logout; delete control.pending_logout; delete control.suppressed_binding;
          await request(stores.control.put(control));
          this.control = control;
        });
        const meta = await this.guarded(stamp, ["scopes"], "readonly", stores => request(stores.scopes.get(stamp.scope)));
        if (!meta.ready || forceOpen) await this.bootstrap(opened, stamp);
        this.state = "account_ready";
        this.lastError = null;
        this.notify("records");
      } catch (error) {
        try { await this.guarded(observed, [], "readonly", () => {}); }
        catch (_) { error = failure("owner_changed"); }
        if (error.code === "owner_changed") { this.paused = true; this.notify("owner"); throw error; }
        if (error.status === 401 || error.status === 403) { await this.lockAccount(); return; }
        const meta = await this.guarded(initial, ["scopes"], "readonly", stores => request(stores.scopes.get(initial.scope))).catch(() => null);
        if (error.code === "network_unavailable" && meta?.ready && !this.control.locked) {
          this.state = initial.scope.startsWith("account:") ? "account_offline" : "guest";
          this.notify();
          return;
        }
        throw error;
      }
    }

    async lockAccount() {
      const stamp = this.stamp();
      await this.guarded(stamp, [], "readwrite", async stores => {
        const control = await request(stores.control.get("active"));
        control.locked = true;
        control.generation++;
        await request(stores.control.put(control));
        this.control = control;
      });
      this.state = "account_locked";
      this.auth = null;
      this.notify("owner");
      this.broadcast();
    }

    async bootstrap(opened, stamp) {
      // A scan is staged in memory, never published with a partially advanced cursor.
      // A crashed tab restarts the scan; the durable outbox is independent of it.
      const rows = new Map();
      let after, page;
      do {
        page = await this.api("scan", {scan_token: opened.scan_token, ...(after ? {after_key: JSON.stringify(after)} : {})}, stamp);
        for (const row of page.records) rows.set(key(row), row);
        after = page.after_key;
      } while (page.has_more);
      let cursor = page.catchup_from;
      const through = page.through_seq;
      do {
        const delta = await this.api("pull", {after_seq: cursor, through_seq: through}, stamp);
        for (const row of delta.records) if (!rows.has(key(row)) || rows.get(key(row)).change_seq < row.change_seq) rows.set(key(row), row);
        cursor = delta.next_seq;
        if (!delta.has_more) break;
      } while (true);
      await this.guarded(stamp, ["records", "scopes"], "readwrite", async stores => {
        const meta = await request(stores.scopes.get(stamp.scope));
        // Another tab may have finished a newer bootstrap/pull while this scan ran.
        if (meta.ready && meta.cursor > cursor) return;
        await this.eraseScope(stores, stamp.scope);
        for (const row of rows.values()) await request(stores.records.put({...row, scope: stamp.scope}));
        await request(stores.scopes.put({...meta, ready: true, cursor}));
      });
    }

    async pull(stamp) {
      let through;
      do {
        const meta = await this.guarded(stamp, ["scopes"], "readonly", stores => request(stores.scopes.get(stamp.scope)));
        if (through !== undefined && meta.cursor >= through) return;
        const page = await this.api("pull", {after_seq: meta.cursor, ...(through !== undefined ? {through_seq: through} : {})}, stamp);
        through = page.through_seq;
        await this.guarded(stamp, ["records", "scopes"], "readwrite", async stores => {
          const latest = await request(stores.scopes.get(stamp.scope));
          for (const row of page.records) {
            const old = await request(stores.records.get([stamp.scope, row.kind, row.id]));
            if (!old || old.change_seq < row.change_seq) await request(stores.records.put({...row, scope: stamp.scope}));
          }
          latest.cursor = Math.max(latest.cursor, page.next_seq);
          await request(stores.scopes.put(latest));
        });
        if (!page.has_more) break;
      } while (true);
    }

    mutate(intent) { return this.mutateMany([intent]); }
    mutateMany(intents) {
      // Capture ownership when the user acts, before any asynchronous local work.
      const stamp = this.stamp();
      const input = clone(intents);
      this.localWrites++;
      this.notify();
      const operation = this.chain.then(async () => {
        if (this.paused || this.control.locked || !["guest", "account_ready", "account_offline"].includes(this.state)) throw failure("storage_not_ready");
        const ids = await this.guarded(stamp, ["records", "scopes", "outbox"], "readwrite", async stores => {
          const meta = await request(stores.scopes.get(stamp.scope));
          if (!meta?.ready) throw failure("storage_not_ready");
          const ids = [];
          for (const intent of input) {
            if (!intent.kind || !intent.id || !["set", "delete", "resolve"].includes(intent.action || "set")) throw failure("invalid_intent");
            if (new TextEncoder().encode(JSON.stringify(intent.value || {})).length > 61440) throw failure("payload_too_large");
            const old = await request(stores.records.get([stamp.scope, intent.kind, intent.id]));
            const queue = (await request(stores.outbox.index("scope").getAll(stamp.scope))).filter(row => key(row) === key(intent)).sort((a, b) => a.sequence - b.sequence);
            const parent = queue.at(-1);
            const visible = parent ? {deleted: parent.intent.action === "delete", value: parent.intent.value} : old;
            const deleted = intent.action === "delete";
            if (intent.action !== "resolve" && visible && visible.deleted === deleted && (deleted || same(visible.value, intent.value))) continue;
            const opId = uuid();
            ids.push(opId);
            meta.sequence++;
            if (stamp.scope.startsWith("guest:")) {
              await request(stores.records.put({scope: stamp.scope, schema_version: 1, kind: intent.kind, id: intent.id, value: deleted ? null : intent.value, deleted, version: (old?.version || 0) + 1, change_seq: meta.sequence}));
            } else {
              await request(stores.outbox.put({scope: stamp.scope, op_id: opId, kind: intent.kind, id: intent.id,
                sequence: meta.sequence, intent, status: "queued", depends_on: intent.action === "resolve" || intent.supersedes ? null : parent?.op_id,
                base_version: intent.base_version ?? old?.version ?? 0, base_deleted: !!old?.deleted, base_value: old?.value ?? null,
                supersedes: intent.action === "resolve" || intent.supersedes ? queue.map(row => row.op_id) : []}));
            }
          }
          await request(stores.scopes.put(meta));
          return ids;
        });
        this.notify("records"); this.broadcast(); this.kick();
        return {local_committed: true, op_ids: ids, sync_state: stamp.scope.startsWith("guest:") ? "local" : "pending"};
      });
      this.chain = operation.catch(error => {
        // Keep an exportable in-memory draft, clearly labelled as NOT durably saved.
        this.unsaved.push({scope: stamp.scope, intents: input});
        this.setError(error);
      });
      const finished = () => { this.localWrites--; this.notify(); };
      operation.then(finished, finished);
      return operation;
    }

    async snapshot() {
      if (!this.db || !this.control || this.control.locked || this.paused) return {records: [], pending: [], legacy: {}, device: {}, scope: null};
      const stamp = this.stamp();
      return this.guarded(stamp, ["records", "outbox", "scopes"], "readonly", async stores => {
        const canonical = await request(stores.records.index("scope").getAll(stamp.scope));
        const pending = (await request(stores.outbox.index("scope").getAll(stamp.scope))).sort((a, b) => a.sequence - b.sequence);
        const visible = new Map(canonical.map(row => [key(row), privateRow(row)]));
        for (const row of pending) {
          // Rejected drafts are exposed separately, never counted as accepted learning facts.
          if (row.status === "needs_choice" && row.kind === "learning_event") continue;
          visible.set(key(row), {kind: row.kind, id: row.id, value: row.intent.value, deleted: row.intent.action === "delete", version: row.base_version, pending: true});
        }
        const meta = await request(stores.scopes.get(stamp.scope));
        const recovery = stamp.scope.startsWith("account:") ?
          (await request(stores.outbox.index("scope").getAll(IDBKeyRange.bound(stamp.scope.split(":").slice(0, 2).join(":") + ":", stamp.scope.split(":").slice(0, 2).join(":") + ":\uffff")))).filter(row => row.scope !== stamp.scope) : [];
        const guestMeta = await request(stores.scopes.get(this.control.guest_scope));
        const legacyPresent = Object.values(guestMeta?.legacy || {}).some(value => value && (typeof value !== "object" || Object.keys(value).length));
        const hasGuestData = !!legacyPresent || (await request(stores.records.index("scope").count(this.control.guest_scope))) > 0;
        return {hasGuestData, recovery, scope: stamp.scope, generation: stamp.generation, records: [...visible.values()], canonical: canonical.map(privateRow), pending: pending.map(clone), legacy: meta?.legacy || {}, device: clone(this.control.device || {})};
      });
    }
    async get(kind, id) { return (await this.list(kind)).find(row => row.id === id); }
    async list(kind) { return (await this.snapshot()).records.filter(row => !row.deleted && (!kind || row.kind === kind)); }

    async setDevice(value) {
      const stamp = this.stamp();
      await this.guarded(stamp, [], "readwrite", async stores => {
        const control = await request(stores.control.get("active"));
        control.device = {...control.device, ...clone(value)};
        await request(stores.control.put(control));
        this.control = control;
      });
    }

    async batch(stamp) {
      return this.guarded(stamp, ["outbox"], "readwrite", async stores => {
        const queue = (await request(stores.outbox.index("scope").getAll(stamp.scope))).sort((a, b) => a.sequence - b.sequence);
        const selected = [], seen = new Set();
        let bytes = 1024;
        for (const row of queue) {
          if (row.status !== "queued" || row.depends_on || seen.has(key(row))) continue;
          if (!row.wire) {
            let action = row.intent.action || "set";
            if (action === "set") action = row.base_version === 0 ? "create" : row.base_deleted && ["bookmark", "review_item"].includes(row.kind) ? "restore_membership" : "put";
            row.wire = {op_id: row.op_id, action, kind: row.kind, id: row.id, base_version: row.base_version,
              ...(action === "delete" ? {} : {value: row.intent.value}),
              ...(action === "resolve" ? {conflicts: row.intent.conflicts} : {})};
            await request(stores.outbox.put(row));
          }
          const size = new TextEncoder().encode(JSON.stringify(row.wire)).length + 1;
          if (selected.length === 25 || bytes + size > 250000) break;
          bytes += size; selected.push(row); seen.add(key(row));
        }
        return selected;
      });
    }

    async settle(stamp, selected, response) {
      await this.guarded(stamp, ["outbox", "records"], "readwrite", async stores => {
        for (const result of response.results) {
          const row = await request(stores.outbox.get([stamp.scope, result.op_id]));
          if (!row || !selected.some(item => item.op_id === result.op_id)) continue;
          const canonical = await request(stores.records.get([stamp.scope, row.kind, row.id]));
          if (!["applied", "noop"].includes(result.outcome)) {
            row.status = "needs_choice";
            row.result = result;
            await request(stores.outbox.put(row));
            continue;
          }
          const changed = result.changed.find(item => key(item) === key(row));
          // Use the receipt's version, not an unrelated newer edit observed by pull.
          const baseVersion = changed?.version ?? (canonical && same(canonical.value, row.intent.value) ? canonical.version : row.base_version);
          const others = await request(stores.outbox.index("scope").getAll(stamp.scope));
          for (const dependent of others) {
            if (row.supersedes.includes(dependent.op_id)) await request(stores.outbox.delete([stamp.scope, dependent.op_id]));
            else if (dependent.depends_on === row.op_id) {
              dependent.depends_on = null;
              dependent.base_version = baseVersion;
              dependent.base_deleted = row.intent.action === "delete";
              dependent.base_value = row.intent.value || null;
              await request(stores.outbox.put(dependent));
            }
          }
          await request(stores.outbox.delete([stamp.scope, row.op_id]));
        }
      });
    }

    kick() {
      if (!this.kickTimer) this.kickTimer = root.setTimeout(() => { this.kickTimer = null; this.sync(); }, 300);
    }
    sync() {
      if (this.syncing) return this.syncing;
      this.syncing = this.runSync().finally(() => { this.syncing = null; });
      return this.syncing;
    }
    async runSync() {
      if (!this.db || this.running || this.paused || this.state === "upgrade_required") return;
      this.running = true;
      const work = async () => {
        try {
          await this.chain;
          await this.refreshContext();
          if (this.state !== "account_ready") return;
          const stamp = this.stamp();
          await this.pull(stamp);
          for (let round = 0; round < 20; round++) {
            const selected = await this.batch(stamp);
            if (!selected.length) break;
            const response = await this.api("apply", {protocol_version: 1, device_id: this.control.device_id, operations: selected.map(row => row.wire)}, stamp, true);
            // Until pull succeeds, keep the identical operations for idempotent replay.
            await this.pull(stamp);
            await this.settle(stamp, selected, response);
          }
          this.lastError = null;
          this.notify("records"); this.broadcast();
        } catch (error) {
          if (error.code === "cursor_expired" || error.code === "epoch_changed") {
            await this.refreshContext(true).catch(next => this.setError(next));
          } else if (error.status === 401 || error.status === 403) await this.lockAccount().catch(() => {});
          else if (error.code === "owner_changed") await this.adoptControl();
          else this.setError(error);
        }
      };
      try {
        if (root.navigator.locks) await root.navigator.locks.request("allim-personal-sync", {ifAvailable: true}, lock => lock ? work() : undefined);
        else await work();
      } finally { this.running = false; }
    }

    async adoptControl() {
      this.control = await this.transaction(["control"], "readonly", stores => request(stores.control.get("active")));
      this.paused = false;
      this.auth = null;
      if (!this.control) { this.paused = true; this.state = "storage_error"; this.notify("owner"); return; }
      this.state = this.control.locked ? "account_locked" : "opening";
      this.notify("owner");
      this.kick();
    }
    async externalChange() {
      if (!this.db) return;
      try {
        const current = await this.transaction(["control"], "readonly", stores => request(stores.control.get("active")));
        if (!current || current.generation !== this.control?.generation) { await this.adoptControl(); }
        else this.notify("records");
      } catch (error) { this.setError(error); }
    }

    async leave({endSession = false, discardPending = false, clearGuest = false} = {}) {
      const stamp = this.stamp();
      this.paused = true;
      const oldAuth = this.auth;
      let pendingCount = 0;
      await this.guarded(stamp, ["records", "outbox", "scopes"], "readwrite", async stores => {
        const control = await request(stores.control.get("active"));
        const pending = await request(stores.outbox.index("scope").getAll(stamp.scope));
        pendingCount = pending.length;
        if (discardPending) for (const row of pending) await request(stores.outbox.delete([stamp.scope, row.op_id]));
        if (stamp.scope.startsWith("account:")) {
          await this.eraseScope(stores, stamp.scope);
          control.explicit_logout = true;
          control.suppressed_binding = stamp.session_binding;
          if (endSession) {
            const [, account_id, epoch] = stamp.scope.split(":");
            control.pending_logout = {account_id, epoch, session_binding: stamp.session_binding};
          }
        } else if (clearGuest) {
          await this.eraseScope(stores, stamp.scope);
          await request(stores.scopes.put({scope: stamp.scope, ready: true, cursor: 0, sequence: 0, legacy: {}}));
        }
        control.scope = control.guest_scope;
        control.session_binding = null;
        control.locked = false;
        control.generation++;
        await request(stores.control.put(control));
        this.control = control;
      });
      if (discardPending) this.unsaved = this.unsaved.filter(row => row.scope !== stamp.scope);
      this.auth = oldAuth;
      this.paused = false;
      this.state = "guest";
      this.notify("owner"); this.broadcast();
      // No new sync starts; the old binding makes this harmless after another login.
      if (endSession && this.control.pending_logout && root.navigator.onLine) this.refreshContext().catch(error => {
        if (error.code === "owner_changed") this.adoptControl().catch(next => this.setError(next));
        else this.setError(error);
      });
      return {pending: discardPending ? 0 : pendingCount};
    }
    logout() { return this.leave({endSession: true}); }
    clearLocal(options = {}) { return this.leave({...options, clearGuest: true}); }
    async resumeAccount() { await this.refreshContext(false, true); this.kick(); }

    async resolve(kind, id, value) {
      const snapshot = await this.snapshot();
      const current = snapshot.canonical.find(row => row.kind === kind && row.id === id);
      const conflicts = snapshot.canonical.filter(row => row.kind === "conflict" && !row.deleted && row.value.status === "open" && row.value.target_kind === kind && row.value.target_id === id);
      if (!current || !conflicts.length) throw failure("conflict_not_found");
      return this.mutate({kind, id, action: "resolve", value, base_version: current.version, conflicts: conflicts.map(row => ({id: row.id, version: row.version}))});
    }
    async retryDraft(opId) {
      const snapshot = await this.snapshot();
      const draft = snapshot.pending.find(row => row.op_id === opId);
      if (!draft || draft.status !== "needs_choice") throw failure("draft_not_found");
      const current = snapshot.canonical.find(row => key(row) === key(draft));
      return this.mutate({...draft.intent, action: draft.intent.action === "delete" ? "delete" : "set", base_version: current?.version || 0, supersedes: true});
    }
    async discardDraft(opId) {
      const stamp = this.stamp();
      await this.guarded(stamp, ["outbox"], "readwrite", async stores => {
        const all = await request(stores.outbox.index("scope").getAll(stamp.scope));
        const removed = new Set([opId]);
        for (const row of all.sort((a, b) => a.sequence - b.sequence)) {
          if (removed.has(row.op_id) || removed.has(row.depends_on)) {
            removed.add(row.op_id);
            await request(stores.outbox.delete([stamp.scope, row.op_id]));
          }
        }
      });
      this.notify("records"); this.broadcast();
    }
    async discardPreviousEpochs() {
      const stamp = this.stamp();
      if (!stamp.scope.startsWith("account:")) throw failure("account_required");
      const prefix = stamp.scope.split(":").slice(0, 2).join(":") + ":";
      await this.guarded(stamp, ["outbox"], "readwrite", async stores => {
        const rows = await request(stores.outbox.index("scope").getAll(IDBKeyRange.bound(prefix, prefix + "\uffff")));
        for (const row of rows) if (row.scope !== stamp.scope) await request(stores.outbox.delete([row.scope, row.op_id]));
      });
      this.notify("records"); this.broadcast();
    }
    async exportLocal() {
      const snapshot = await this.snapshot();
      // Deliberately excludes authentication, transport bindings and other owners.
      return {format: "allim-local-recovery-v1", exported_at: new Date().toISOString(), scope: snapshot.scope,
        records: snapshot.records, canonical: snapshot.canonical || [], pending: snapshot.pending, previous_epochs: snapshot.recovery || [],
        legacy: snapshot.legacy, not_durably_saved: this.unsaved.filter(row => row.scope === snapshot.scope).map(row => row.intents)};
    }
    subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    getStatus() { return {state: this.state, scope: this.control?.scope, generation: this.control?.generation, error: this.lastError, localWrites: this.localWrites, unsaved: this.unsaved.filter(row => row.scope === this.control?.scope).length, localLogoutPending: !!this.control?.pending_logout}; }
    notify(reason = "status") { for (const listener of this.listeners) { try { listener(this.getStatus(), reason); } catch (_) { /* A view failure cannot roll back a committed IDB transaction. */ } } }
    broadcast() {
      const signal = {generation: this.control?.generation, at: Date.now(), nonce: uuid()};
      if (this.channel) this.channel.postMessage(signal);
      try { root.localStorage.setItem("allim-storage-signal-v1", JSON.stringify(signal)); } catch (_) { /* IDB guards remain authoritative */ }
    }
    setError(error) {
      this.lastError = error.code || error.name || "storage_error";
      if (error.code === "protocol_unsupported") this.state = "upgrade_required";
      else if (error.code === "network_unavailable" && this.control?.scope.startsWith("account:") && !this.control.locked) this.state = "account_offline";
      else if (this.control?.locked) this.state = "account_locked";
      else if (error.status === 429 || error.status >= 500) this.state = "account_offline";
      else this.state = "storage_error";
      this.notify();
    }
  }
  root.AllimPersonalStorage = PersonalStorage;
  root.AllimStorage = new PersonalStorage();
})(window);
