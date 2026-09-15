(function (root) {
  "use strict";
  const storage = root.AllimStorage, progress = root.AllimProgress;
  const copy = value => JSON.parse(JSON.stringify(value));
  const strings = {
    ru: {opening: "Открываем ваши данные…", guest: "На этом устройстве", account_ready: "Сохранено в аккаунте", account_offline: "Нет соединения — изменения на устройстве", pending: "Ожидают отправки", account_locked: "Войдите, чтобы продолжить", needs_choice: "Нужно выбрать вариант", storage_error: "Не удалось сохранить. Не закрывайте страницу; выгрузите копию.", upgrade_required: "Обновите страницу", details: "Ваши данные", login: "Войти", resume: "Открыть аккаунт", retry: "Повторить", logout: "Выйти", export: "Скачать копию", clear: "Очистить данные устройства", clearConfirm: "Удалить локальную копию? Прогресс в аккаунте сохранится. Неотправленные изменения останутся для следующего входа.", logoutNote: "Неотправленные изменения останутся на устройстве для следующего входа в этот аккаунт.", legacy: "История без аккаунта осталась на этом устройстве и доступна после выхода.", conflict: "Изменения в разных местах", server: "В аккаунте", proposed: "Ваш вариант", useServer: "Оставить вариант аккаунта", useMine: "Сохранить мой вариант", rejected: "Это изменение не отправлено. Скачайте копию перед удалением.", discardAll: "Удалить неотправленное с устройства", discardOld: "Удалить черновики до сброса", discardAllConfirm: "Удалить эти неотправленные черновики с устройства? Скачайте копию, если они вам нужны. Уже сохранённые данные аккаунта останутся.", discard: "Удалить этот черновик", discardConfirm: "Удалить этот черновик и следующие изменения этой записи с устройства?", close: "Закрыть", pendingLogout: "Локальный выход завершён; завершение серверной сессии ожидает соединения.", localSaved: "Сохранено на устройстве", recovery: "На устройстве остались неотправленные изменения до сброса аккаунта. Они доступны в скачиваемой копии и не отправляются автоматически.", reflection: "Заметка", preference: "Настройка", academy_plan: "План занятий", academy_diagnostic: "Ответы диагностики", bookmark: "Сохранённый аят", review_item: "Повторение", learning_event: "Результат чтения", reading_position: "Место чтения", daily_goal: "Дневная цель", privacy: "Без аккаунта данные остаются на устройстве. После входа новые изменения сохраняются в аккаунте автоматически."},
    en: {opening: "Opening your data…", guest: "On this device", account_ready: "Saved to your account", account_offline: "Offline — changes are on this device", pending: "Waiting to send", account_locked: "Sign in to continue", needs_choice: "Choose a version", storage_error: "Could not save. Keep this page open and download a copy.", upgrade_required: "Reload this page", details: "Your data", login: "Sign in", resume: "Open account", retry: "Retry", logout: "Sign out", export: "Download a copy", clear: "Clear device data", clearConfirm: "Clear the local copy? Account progress will remain. Unsent changes will be kept for your next sign-in.", logoutNote: "Unsent changes stay on this device for your next sign-in to this account.", legacy: "Your guest history remains on this device and is available after signing out.", conflict: "Changes made in different places", server: "In your account", proposed: "Your version", useServer: "Keep account version", useMine: "Save my version", rejected: "This change was not sent. Download a copy before discarding it.", discardAll: "Discard unsent device drafts", discardOld: "Discard drafts from before reset", discardAllConfirm: "Discard these unsent drafts from this device? Download a copy if you need them. Data already saved to your account will remain.", discard: "Discard this draft", discardConfirm: "Discard this draft and subsequent changes to this record from this device?", close: "Close", pendingLogout: "Signed out locally; server sign-out is waiting for a connection.", localSaved: "Saved on this device", recovery: "Unsent changes from before the account reset remain on this device. They are included in the download and are not sent automatically.", reflection: "Note", preference: "Setting", academy_plan: "Learning plan", academy_diagnostic: "Diagnostic answers", bookmark: "Saved verse", review_item: "Review", learning_event: "Reading result", reading_position: "Reading position", daily_goal: "Daily goal", privacy: "Without an account, data stays on this device. After sign-in, new changes are saved to your account automatically."},
    ar: {opening: "جارٍ فتح بياناتك…", guest: "على هذا الجهاز", account_ready: "محفوظ في حسابك", account_offline: "دون اتصال — التغييرات على الجهاز", pending: "بانتظار الإرسال", account_locked: "سجّل الدخول للمتابعة", needs_choice: "اختر النسخة", storage_error: "تعذّر الحفظ. أبقِ الصفحة مفتوحة ونزّل نسخة.", upgrade_required: "أعد تحميل الصفحة", details: "بياناتك", login: "تسجيل الدخول", resume: "فتح الحساب", retry: "إعادة المحاولة", logout: "تسجيل الخروج", export: "تنزيل نسخة", clear: "مسح بيانات الجهاز", clearConfirm: "مسح النسخة المحلية؟ يبقى تقدم الحساب وتُحفظ التغييرات غير المرسلة لتسجيل الدخول التالي.", logoutNote: "تبقى التغييرات غير المرسلة على الجهاز حتى دخولك التالي إلى هذا الحساب.", legacy: "يبقى سجل الضيف على هذا الجهاز ويمكن فتحه بعد الخروج.", conflict: "تغييرات من أماكن مختلفة", server: "في حسابك", proposed: "نسختك", useServer: "الاحتفاظ بنسخة الحساب", useMine: "حفظ نسختي", rejected: "لم يُرسل هذا التغيير. نزّل نسخة قبل حذفه.", discardAll: "حذف المسودات غير المرسلة", discardOld: "حذف المسودات السابقة للضبط", discardAllConfirm: "حذف هذه المسودات غير المرسلة من الجهاز؟ نزّل نسخة إذا احتجتها. تبقى البيانات المحفوظة في الحساب.", discard: "حذف هذه المسودة", discardConfirm: "حذف المسودة والتغييرات التالية لهذا السجل من الجهاز؟", close: "إغلاق", pendingLogout: "اكتمل الخروج المحلي؛ ينتظر الخروج من الخادم الاتصال.", localSaved: "محفوظ على الجهاز", recovery: "تبقى تغييرات غير مرسلة من قبل إعادة ضبط الحساب على الجهاز. تُضمّن في النسخة المنزّلة ولا تُرسل تلقائيًا.", reflection: "ملاحظة", preference: "إعداد", academy_plan: "خطة التعلم", academy_diagnostic: "إجابات التشخيص", bookmark: "آية محفوظة", review_item: "مراجعة", learning_event: "نتيجة القراءة", reading_position: "موضع القراءة", daily_goal: "الهدف اليومي", privacy: "دون حساب تبقى البيانات على الجهاز. بعد الدخول تُحفظ التغييرات الجديدة في حسابك تلقائيًا."}
  };
  let panel, statusNode, detailNode, refreshId = 0;
  const t = key => (strings[root.document.documentElement.lang] || strings.ru)[key] || key;
  const node = (tag, text, parent) => { const item = root.document.createElement(tag); if (text !== undefined) item.textContent = text; if (parent) parent.append(item); return item; };
  const button = (label, handler, parent) => { const item = node("button", label, parent); item.type = "button"; item.addEventListener("click", () => Promise.resolve().then(handler).catch(error => storage.setError(error))); return item; };
  const roots = () => [...root.document.querySelectorAll(".allim-web-root, .allim-academy-root")];
  function block(hidden) {
    roots().forEach(item => { item.inert = hidden; item.classList.toggle("allim-data-hidden", hidden); });
  }
  async function download() {
    const payload = await storage.exportLocal();
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type: "application/json"}));
    const link = node("a"); link.href = url; link.download = "allim-personal-copy-" + new Date().toISOString().slice(0, 10) + ".json"; link.click();
    root.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function clearLocal() { if (root.confirm(t("clearConfirm"))) await storage.clearLocal(); }
  function displayValue(value, records = []) {
    if (value == null) return "—";
    if (value.cycle_id) {
      const cycles = records.filter(row => row.kind === "reading_cycle" && !row.deleted).sort((a, b) => (a.change_seq || 0) - (b.change_seq || 0) || a.id.localeCompare(b.id));
      const cycle = t("reading_cycle") + " " + (cycles.findIndex(row => row.id === value.cycle_id) + 1);
      if (Array.isArray(value.parts)) return [value.local_date, cycle, t(value.source), t("pages") + ": " + value.parts.map(part => part.full ? part.page : part.page + " (" + part.word_keys.join(", ") + ")").join(", ")].join("\n");
      return cycle + " · " + (value.deadline || t("noDeadline"));
    }
    if (Object.hasOwn(value, "completed_cycles")) return t("reading_past") + ": " + value.completed_cycles;
    if (Object.hasOwn(value, "reflection")) return [value.reference || value.verse_key, value.reflection, value.action].filter(Boolean).join("\n\n");
    if (Object.hasOwn(value, "target")) return [value.target, value.minutes + " min", value.focus].join("\n");
    if (Object.hasOwn(value, "selected")) return typeof value.selected === "object" ? Object.values(value.selected).join(" · ") : String(value.selected);
    return Object.values(value).filter(item => typeof item !== "object").join(" · ");
  }
  async function render() {
    if (!panel) return;
    const version = ++refreshId;
    const status = storage.getStatus();
    const snapshot = await storage.snapshot().catch(() => ({pending: [], records: [], canonical: [], legacy: {}}));
    if (version !== refreshId) return;
    const conflicts = (snapshot.canonical || []).filter(row => row.kind === "conflict" && !row.deleted && row.value.status === "open");
    const rejected = snapshot.pending.filter(row => row.status === "needs_choice" && !conflicts.some(conflict => conflict.value.source_op_id === row.op_id));
    let label = t(status.state === "opening_account" ? "opening" : status.state);
    const importsPending = Object.values(snapshot.imports || {}).filter(job => !job.done).length;
    if (importsPending && status.state === "account_ready") label = t("pending");
    if ((status.state === "account_ready" && snapshot.pending.length) || status.localWrites) label = t("pending") + ": " + (snapshot.pending.length + status.localWrites);
    if (conflicts.length || rejected.length) label = t("needs_choice") + " · " + (conflicts.length + rejected.length);
    if (status.unsaved) label = t("storage_error");
    statusNode.textContent = label;
    panel.dataset.state = status.state;
    panel.dir = root.document.documentElement.dir || "ltr";
    panel.querySelector("summary").textContent = t("details");
    block(["opening", "opening_account", "account_locked", "upgrade_required"].includes(status.state) || (status.state === "storage_error" && !root.AllimAccountUI.initialized));
    detailNode.replaceChildren();
    node("p", t("privacy"), detailNode);
    const actions = node("div", undefined, detailNode); actions.className = "allim-data-actions";
    button(t("retry"), async () => { if (!storage.db) { await storage.open(); root.location.reload(); } else { await storage.sync(); if (!root.AllimAccountUI.initialized) root.location.reload(); } }, actions);
    if (status.scope?.startsWith("account:")) button(t("logout"), () => storage.logout(), actions);
    else button(t("resume"), () => storage.resumeAccount(), actions);
    const login = node("a", t("login"), actions); login.href = "/login?redirect-to=" + encodeURIComponent(root.location.pathname + root.location.search);
    button(t("export"), download, actions);
    button(t("clear"), clearLocal, actions);
    if (snapshot.recovery?.length || snapshot.priorImports?.length) {
      node("p", t("recovery"), detailNode);
      button(t("discardOld"), () => { if (root.confirm(t("discardAllConfirm"))) return storage.discardPreviousEpochs(); }, detailNode);
    }
    if (snapshot.pending.length || importsPending) button(t("discardAll"), () => { if (root.confirm(t("discardAllConfirm"))) return storage.clearLocal({discardPending: true}); }, actions);
    if (snapshot.pending.length) node("p", t("logoutNote"), detailNode);
    if (status.localLogoutPending) node("p", t("pendingLogout"), detailNode);
    if (status.scope?.startsWith("account:") && snapshot.hasGuestData) {
      // No legacy content or counts are exposed in an account view.
      node("p", t("legacy"), detailNode);
    }
    for (const conflict of conflicts) {
      const value = conflict.value;
      const current = snapshot.canonical.find(row => row.kind === value.target_kind && row.id === value.target_id);
      const card = node("section", undefined, detailNode); card.className = "allim-data-conflict";
      node("h3", t(value.target_kind) + " · " + t("conflict"), card);
      node("strong", t("server"), card); node("pre", displayValue(current?.value, snapshot.records), card);
      node("strong", t("proposed"), card); node("pre", displayValue(value.proposed_value, snapshot.records), card);
      button(t("useServer"), () => storage.resolve(value.target_kind, value.target_id, current.value), card);
      button(t("useMine"), () => storage.resolve(value.target_kind, value.target_id, value.proposed_value), card);
    }
    for (const row of rejected) {
      const card = node("section", undefined, detailNode); card.className = "allim-data-conflict";
      const current = snapshot.canonical.find(item => item.kind === row.kind && item.id === row.id);
      node("h3", t(row.kind), card);
      if (current && !current.deleted) { node("strong", t("server"), card); node("pre", displayValue(current.value, snapshot.records), card); }
      if (!["learning_event", "reflection", "reading_entry"].includes(row.kind) || !current?.deleted) button(t("useMine"), () => storage.retryDraft(row.op_id), card);
       node("p", t("rejected"), card); node("pre", displayValue(row.intent.value, snapshot.records), card);
      button(t("discard"), () => { if (root.confirm(t("discardConfirm"))) return storage.discardDraft(row.op_id); }, card);
    }
    if (root.AllimImportUI) root.AllimImportUI.render(detailNode, status, snapshot).catch(() => {});
    // Keep existing badges truthful without coupling storage to LMS enrollment requests.
    root.document.querySelectorAll('[data-i18n="localMode"], [data-copy="deviceProgress"]').forEach(item => { item.textContent = label; });
  }
  async function mount() {
    if (panel) return;
    panel = node("aside", undefined, root.document.body); panel.id = "allim-storage-panel";
    statusNode = node("span", t("opening"), panel); statusNode.setAttribute("role", "status"); statusNode.setAttribute("aria-live", "polite");
    const details = node("details", undefined, panel); node("summary", t("details"), details); detailNode = node("div", undefined, details);
    block(true);
    storage.subscribe(() => render());
    new MutationObserver(() => render()).observe(root.document.documentElement, {attributes: true, attributeFilter: ["lang", "dir"]});
    await render();
  }
  const journalLabels = {
    ru: {reading_entry: "Запись журнала", reading_plan: "Цель чтения", reading_cycle: "Хатм", reading_past: "Прежние хатмы", pages: "Страницы", paper: "С бумаги", digital: "С экрана", mic: "Проверено в чтении", noDeadline: "Без срока"},
    en: {reading_entry: "Journal entry", reading_plan: "Reading goal", reading_cycle: "Khatm", reading_past: "Earlier khatms", pages: "Pages", paper: "Paper", digital: "Screen", mic: "Accepted in reading", noDeadline: "No deadline"},
    ar: {reading_entry: "قراءة في السجل", reading_plan: "هدف القراءة", reading_cycle: "الختمة", reading_past: "الختمات السابقة", pages: "الصفحات", paper: "مصحف ورقي", digital: "الشاشة", mic: "قراءة مقبولة", noDeadline: "دون موعد"}
  };
  for (const language of Object.keys(journalLabels)) Object.assign(strings[language], journalLabels[language]);
  const domReady = root.document.readyState === "loading" ? new Promise(resolve => root.document.addEventListener("DOMContentLoaded", resolve, {once: true})) : Promise.resolve();
  const ready = domReady.then(mount).then(async () => {
    await storage.open();
    const response = await root.fetch("/assets/allimquran/data/account-storage-catalogue.json", {cache: "force-cache"});
    if (!response.ok) throw new Error("catalogue_unavailable");
    const data = await response.json();
    if (data.dataset_id !== "hafs-madinah-604-v1") throw new Error("catalogue_unavailable");
    root.AllimAccountUI.catalogue = data.verses;
    await render();
    return storage;
  });
  ready.catch(error => { storage.setError(error); block(true); });

  class LearnBridge {
    constructor(defaults, changed, ownerChanged) { this.defaults = defaults; this.changed = changed; this.ownerChanged = ownerChanged; this.revision = 0; this.events = []; this.edits = new Map(); this.versions = new Map(); }
    async open() {
      await ready;
      const snapshot = await storage.snapshot();
      if (!snapshot.scope) throw new Error("account_locked");
      this.generation = snapshot.generation;
      this.versions = new Map((snapshot.canonical || snapshot.records).map(row => [row.kind + "/" + row.id, row.version]));
      this.last = progress.compose(snapshot, this.defaults, root.AllimAccountUI.catalogue);
      storage.subscribe((_, reason) => { if (reason === "records" || reason === "owner") this.refresh(); });
      root.AllimAccountUI.initialized = true;
      return copy(this.last);
    }
    async refresh() {
      const revision = this.revision;
      await storage.chain;
      const snapshot = await storage.snapshot().catch(() => null);
      if (!snapshot || revision !== this.revision) return;
      if (snapshot.generation !== this.generation || !snapshot.scope) { this.ownerChanged(); block(true); root.location.reload(); return; }
      this.versions = new Map((snapshot.canonical || snapshot.records).map(row => [row.kind + "/" + row.id, row.version]));
      this.last = progress.compose(snapshot, this.defaults, root.AllimAccountUI.catalogue);
      this.changed(copy(this.last));
    }
    beginEdit(kind, id) { this.edits.set(kind + "/" + id, this.versions.get(kind + "/" + id) || 0); }
    rebase(state) { this.last = copy(state); }
    save(state) {
      if (storage.stamp().generation !== this.generation) {
        const stale = Promise.reject(new Error("owner_changed"));
        stale.catch(() => {}); // Old reader callbacks must not surface errors in the next account.
        return stale;
      }
      this.revision++;
      const intents = progress.diff(this.last, state).concat(this.events.splice(0));
      for (const intent of intents) {
        const key = intent.kind + "/" + intent.id;
        if (this.edits.has(key)) { intent.base_version = this.edits.get(key); this.edits.delete(key); }
      }
      const deviceChanged = this.last.recognitionMode !== state.recognitionMode || this.last.recognitionModeExplicit !== state.recognitionModeExplicit;
      this.last = copy(state);
      const writes = [];
      if (deviceChanged) writes.push(storage.setDevice({recognition: {mode: state.recognitionMode, explicit: !!state.recognitionModeExplicit}}));
      if (intents.length) writes.push(storage.mutateMany(intents));
      const result = Promise.all(writes).then(() => this.refresh());
      result.catch(error => storage.setError(error));
      return result;
    }
    event(eventType, values) {
      const value = {...progress.timing(), event_type: eventType, ...values};
      this.events.push({kind: "learning_event", id: root.crypto.randomUUID(), action: "set", value});
      if (root.AllimJournal) {
        const entry = root.AllimJournal.entryForEvent(value, root.AllimAccountUI.catalogue);
        if (entry) this.events.push(entry);
      }
    }
  }
  root.AllimAccountUI = {ready, LearnBridge, clearLocal, download, render, t, block, catalogue: {}};
})(window);
