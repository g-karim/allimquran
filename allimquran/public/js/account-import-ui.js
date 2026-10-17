(function (root) {
  "use strict";
  const transfer = root.AllimImport, storage = root.AllimStorage;
  const strings = {
    ru: {offer: "На устройстве есть прежняя история", review: "Выбрать данные для переноса", separate: "Оставить отдельно", title: "Перенос в этот аккаунт", description: "Выберите категории. Совпадающие настройки аккаунта сохранятся; пересекающиеся старые счётчики будут пропущены. Исходная копия останется на устройстве.", settings: "Настройки, цели и план занятий", bookmarks: "Закладки и очередь повторения", notes: "Заметки «Аят в жизни»", history: "Занятия и хифз", learning: "Методики, планы и проверка памяти", lawh: "Фотографии Ляуха", journal: "Журнал чтения", owner: "Старый журнал связан с другим аккаунтом или его владелец неизвестен. Его перенос здесь недоступен.", language: "Языки главной и чтения различаются. Выберите язык для переноса:", choose: "Выберите язык", download: "Скачать исходную копию", start: "Перенести выбранное", close: "Закрыть", pending: "Перенос ожидает подтверждения", done: "Перенос подтверждён", skipped: "Пропущено из-за совпадений или ошибок", warnings: "Сохранено только в исходной копии", error: "Не удалось подготовить перенос. Исходные данные сохранены. Повторите после восстановления соединения или свободного места.", report: "Отчёт о переносе", doneHint: "Пропущенные данные остаются в исходной копии; автоматически объединять их с историей аккаунта нельзя.", select: "Выберите хотя бы одну категорию и язык, если они различаются."},
    en: {offer: "This device has earlier history", review: "Choose data to transfer", separate: "Keep separate", title: "Transfer to this account", description: "Choose categories. Existing account settings stay; overlapping old totals will be skipped. The original copy stays on this device.", settings: "Settings, goals and study plan", bookmarks: "Bookmarks and review queue", notes: "Verse in Life notes", history: "Practice and memorization", learning: "Methods, plans and recall checks", lawh: "Lawh photos", journal: "Reading journal", owner: "The old journal belongs to another account or has an unknown owner. It cannot be transferred here.", language: "Home and reading use different languages. Choose the language to transfer:", choose: "Choose language", download: "Download original copy", start: "Transfer selected", close: "Close", pending: "Transfer awaiting confirmation", done: "Transfer confirmed", skipped: "Skipped due to overlaps or errors", warnings: "Kept only in the original copy", error: "Could not prepare the transfer. Original data is intact. Retry with a connection and enough free storage.", report: "Transfer report", doneHint: "Skipped data remains in the original copy; it cannot be merged into account history automatically.", select: "Select at least one category and a language if the old languages differ."},
    ar: {offer: "على هذا الجهاز سجل سابق", review: "اختيار بيانات النقل", separate: "إبقاؤها منفصلة", title: "النقل إلى هذا الحساب", description: "اختر الفئات. تبقى إعدادات الحساب الحالية، وتُتجاوز المجاميع القديمة المتداخلة. تبقى النسخة الأصلية على الجهاز.", settings: "الإعدادات والأهداف وخطة الدراسة", bookmarks: "الآيات المحفوظة وقائمة المراجعة", notes: "ملاحظات آية في الحياة", history: "التدريب والحفظ", learning: "الطرق والخطط والتسميع", lawh: "صور اللوح", journal: "سجل القراءة", owner: "السجل القديم مرتبط بحساب آخر أو بمالك غير معروف. لا يمكن نقله هنا.", language: "لغة الصفحة الرئيسية تختلف عن القراءة. اختر لغة النقل:", choose: "اختر اللغة", download: "تنزيل النسخة الأصلية", start: "نقل المحدد", close: "إغلاق", pending: "النقل بانتظار التأكيد", done: "تم تأكيد النقل", skipped: "تم تجاوزها بسبب التداخل أو الأخطاء", warnings: "محفوظة في النسخة الأصلية فقط", error: "تعذر تجهيز النقل. البيانات الأصلية محفوظة. أعد المحاولة بعد توفر الاتصال ومساحة التخزين.", report: "تقرير النقل", doneHint: "البيانات المتجاوزة باقية في النسخة الأصلية ولا تُدمج تلقائيًا.", select: "اختر فئة واحدة على الأقل ولغة عند اختلاف اللغتين."}
  };
  const t = key => (strings[root.document.documentElement.lang] || strings.ru)[key] || key;
  const node = (tag, text, parent) => { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; if (parent) parent.append(item); return item; };
  function button(text, parent, action) { const item = node("button", text, parent); item.type = "button"; item.onclick = async () => { item.disabled = true; try { await action(); } catch (_) { if (dialog?.open) node("p", t("error"), dialog); } finally { item.disabled = false; } }; return item; }
  function download(value, name) { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type: "application/json"})); const a = node("a"); a.href = url; a.download = name; a.click(); root.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  let dialog, generation;
  function close() { if (dialog) { dialog.close(); dialog.remove(); dialog = null; } }
  async function review() {
    close();
    dialog = node("dialog", undefined, document.body); dialog.id = "allim-import-dialog"; dialog.className = "allim-personal-dialog";
    dialog.dir = document.documentElement.dir || "ltr";
    node("h2", t("title"), dialog); node("p", t("description"), dialog);
    button(t("close"), dialog, close); dialog.showModal();
    generation = storage.stamp().generation;
    const captured = await transfer.capture(storage);
    if (!dialog?.open || generation !== storage.stamp().generation) return;
    const catalogue = root.AllimAccountUI.catalogue, mapped = transfer.mapSource(captured.source, catalogue);
    const journalAllowed = !captured.source.journal_owner || captured.source.journal_owner === storage.auth?.legacy_owner;
    const form = node("form", undefined, dialog);
    for (const category of Object.keys(transfer.categories)) {
      const count = mapped.items.filter(item => transfer.category(item.kind) === category).length;
      if (!count || category === "journal" && !journalAllowed) continue;
      const label = node("label", undefined, form), input = node("input", undefined, label);
      input.type = "checkbox"; input.name = "category"; input.value = category; input.checked = true;
      node("span", t(category) + " · " + count, label);
    }
    if (!journalAllowed) node("p", t("owner"), form);
    let language;
    if (mapped.languageConflict) {
      const label = node("label", t("language"), form); language = node("select", undefined, label); language.name = "language";
      node("option", t("choose"), language).value = "";
      for (const value of [captured.source.legacy.home_language, captured.source.legacy.learn.language]) node("option", value, language).value = value;
    }
    if (mapped.warnings.length) node("p", t("warnings") + ": " + mapped.warnings.length, form);
    button(t("download"), form, () => {
      const source = clone(captured.source);
      if (!journalAllowed) { delete source.journal; delete source.journal_owner; for (const key of ["allim-reading-journal-v1", "allim-reading-sync-v1", "allim-reading-recovery-v1"]) delete source.raw[key]; }
      download({format: "allim-legacy-backup-v1", digest: captured.digest, source}, "allim-original-data.json");
    });
    const feedback = node("p", "", form); feedback.setAttribute("role", "status");
    const submit = node("button", t("start"), form); submit.type = "submit";
    form.onsubmit = async event => {
      event.preventDefault();
      const selected = [...form.querySelectorAll('input[name="category"]:checked')].map(input => input.value);
      if (!selected.length || selected.includes("settings") && language && !language.value) { feedback.textContent = t("select"); return; }
      submit.disabled = true;
      try { await transfer.start(storage, captured, selected, language?.value); close(); }
      catch (_) { feedback.textContent = t("error"); submit.disabled = false; }
    };
  }
  const clone = value => JSON.parse(JSON.stringify(value));
  async function render(parent, status, snapshot) {
    const panel = document.getElementById("allim-storage-panel");
    let offer = document.getElementById("allim-import-offer");
    if (generation && generation !== status.generation) close();
    if (!status.scope?.startsWith("account:") || !snapshot.scope || !["account_ready", "account_offline"].includes(status.state)) { offer?.remove(); return; }
    const stamp = storage.stamp(), meta = await transfer.meta(storage, stamp), reports = await transfer.report(storage);
    if (storage.stamp().generation !== stamp.generation || !parent.isConnected) return;
    // This invitation is visible even when the account details are collapsed; it never starts a transfer.
    if (snapshot.hasGuestData && !meta.import_dismissed) {
      if (!offer) { offer = node("section", undefined, panel); offer.id = "allim-import-offer"; }
      offer.replaceChildren(); node("p", t("offer"), offer);
      button(t("review"), offer, review);
      button(t("separate"), offer, async () => { await transfer.update(storage, stamp, value => { value.import_dismissed = true; }); storage.notify(); storage.broadcast(); });
    } else offer?.remove();
    if (snapshot.hasGuestData) button(t("review"), parent, review);
    for (const report of reports) {
      node("p", (report.done ? t("done") : t("pending")) + ": " + report.confirmed + " / " + (report.total ?? "…"), parent);
      if (report.skipped) node("p", t("skipped") + ": " + report.skipped + ". " + t("doneHint"), parent);
      if (report.warnings.length) node("p", t("warnings") + ": " + report.warnings.length, parent);
      button(t("report"), parent, async () => {
        const current = await transfer.meta(storage, stamp), job = current.import_jobs[report.digest];
        download({format: "allim-import-report-v1", ...report, results: job.results, warnings: job.warnings}, "allim-import-report.json");
      });
    }
  }
  root.AllimImportUI = {render, review};
})(window);
