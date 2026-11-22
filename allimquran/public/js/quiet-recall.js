(function (root) {
  "use strict";

  const messages = {
    en: {
      recallStep: "Recite from memory", checkStep: "Reveal and compare", rateStep: "Mark your result",
      open: "Practice from memory", openQueue: "Practice queued ayahs", close: "Close",
      intro: "Recite aloud or silently. No typing or microphone is needed. This is a self-check.",
      length: "Number of ayahs", current: "Starting at {verse}", queue: "Ayahs from your review queue",
      empty: "Your review queue is empty. Add an ayah from the reader or during a practice.",
      start: "Start practice", prompt: "Try to recall the whole ayah, then reveal it to check.",
      hint: "First word", reveal: "Reveal ayah", retry: "Try loading again",
      remembered: "I remembered it", remove: "I remembered it · remove from queue",
      assisted: "Recalled with a hint", again: "Add to review", keep: "Keep for review",
      skip: "Skip", summary: "Practice summary", done: "Done", cleanTotal: "Recalled without a hint",
      assistedTotal: "Recalled with a hint", againTotal: "Left for review", skippedTotal: "Skipped",
      loading: "Loading the ayah…", loadError: "The ayah could not be loaded. Try again or skip it.",
      saving: "Saving to your review queue…", saveError: "Could not update your review queue. Try again.",
      step: "{index} of {total}", noVerse: "Choose an ayah in the reader first."
    },
    ar: {
      recallStep: "سمّع من حفظك", checkStep: "أظهر النص وقارن", rateStep: "اختر نتيجة المراجعة",
      open: "تدرّب على التسميع", openQueue: "راجع الآيات في قائمتك", close: "إغلاق",
      intro: "سمّع بصوتك أو راجع في نفسك. لا تحتاج إلى الكتابة أو الميكروفون. التقييم ذاتي.",
      length: "عدد الآيات", current: "البداية من {verse}", queue: "آيات من قائمة المراجعة",
      empty: "قائمة المراجعة فارغة. يمكنك إضافة آية من المصحف أو أثناء التدريب.",
      start: "ابدأ التدريب", prompt: "حاول تسميع الآية كاملة، ثم أظهر نصها لتراجعه.",
      hint: "الكلمة الأولى", reveal: "أظهر الآية", retry: "أعد تحميل الآية",
      remembered: "تذكّرتها", remove: "تذكّرتها · أزلها من القائمة",
      assisted: "تذكّرتها مع تلميح", again: "أضفها للمراجعة", keep: "أبقها للمراجعة",
      skip: "تجاوز", summary: "ملخّص التدريب", done: "تم", cleanTotal: "تسميع دون تلميح",
      assistedTotal: "تسميع مع تلميح", againTotal: "آيات للمراجعة", skippedTotal: "آيات متجاوزة",
      loading: "جارٍ تحميل الآية…", loadError: "تعذّر تحميل الآية. أعد المحاولة أو تجاوزها.",
      saving: "جارٍ تحديث قائمة المراجعة…", saveError: "تعذّر تحديث قائمة المراجعة. أعد المحاولة.",
      step: "{index} من {total}", noVerse: "اختر آية في المصحف أولًا."
    },
    ru: {
      recallStep: "Произнесите по памяти", checkStep: "Откройте текст и сравните", rateStep: "Отметьте результат",
      open: "Тренировка по памяти", openQueue: "Повторить аяты из очереди", close: "Закрыть",
      intro: "Произнесите аят вслух или про себя. Печатать и включать микрофон не нужно. Результат оцениваете вы.",
      length: "Сколько аятов", current: "Первый аят: {verse}", queue: "Аяты из очереди повторения",
      empty: "Очередь пуста. Добавьте аят в режиме чтения или во время тренировки.",
      start: "Начать", prompt: "Вспомните аят целиком, затем сверьте с текстом.",
      hint: "Первое слово", reveal: "Открыть аят", retry: "Загрузить снова",
      remembered: "Вспомнил", remove: "Вспомнил · убрать из очереди",
      assisted: "Вспомнил с подсказкой", again: "Добавить к повторению", keep: "Оставить для повторения",
      skip: "Пропустить", summary: "Итог тренировки", done: "Готово", cleanTotal: "Вспомнили без подсказки",
      assistedTotal: "Вспомнили с подсказкой", againTotal: "Оставили для повторения", skippedTotal: "Пропустили",
      loading: "Загружаем аят…", loadError: "Аят не загрузился. Попробуйте ещё раз или пропустите его.",
      saving: "Обновляем очередь повторения…", saveError: "Не удалось обновить очередь. Попробуйте снова.",
      step: "{index} из {total}", noVerse: "Сначала выберите аят в режиме чтения."
    }
  };

  function mount(bridge) {
    const node = name => document.getElementById("quiet-recall-" + name);
    const dialog = node("dialog");
    const setup = node("setup");
    const card = node("card");
    const summary = node("summary");
    const length = node("length");
    const openers = document.querySelectorAll("[data-quiet-recall-open]");
    const language = () => document.documentElement.lang;
    const tr = (key, values = {}) => (messages[language()] || messages.en)[key].replace(/\{(\w+)\}/g, (_, name) => values[name]);
    const number = value => new Intl.NumberFormat(language() === "ar" ? "ar-u-nu-arab" : language() || "en").format(value);
    let session = null;
    let opener = null;

    function refresh() {
      document.querySelectorAll("[data-quiet-label]").forEach(element => {
        element.textContent = tr(element.dataset.quietLabel);
      });
      node("close").setAttribute("aria-label", tr("close"));
      node("progress").setAttribute("aria-label", tr("open"));
      openers.forEach(button => {
        button.hidden = button.dataset.quietRecallOpen === "queue" && !bridge.queue().length;
      });
    }

    function setStatus(key) {
      node("status").textContent = key ? tr(key) : "";
    }

    function open(button, returnFocus = button) {
      if (dialog.open) return;
      opener = returnFocus;
      const mode = button.dataset.quietRecallOpen;
      const available = mode === "queue" ? bridge.queue().slice(0, 5) : bridge.passage();
      session = { mode, available, stamp: bridge.stamp(), keys: [], index: 0, totals: { cleanTotal: 0, assistedTotal: 0, againTotal: 0, skippedTotal: 0 } };
      const options = mode === "queue" ? [available.length] : [...new Set([1, 3, 5].map(count => Math.min(count, available.length)))];
      length.replaceChildren(...options.filter(Boolean).map(count => new Option(number(count), count)));
      length.value = String(options[Math.min(1, options.length - 1)]);
      length.closest("label").hidden = mode === "queue" || !available.length;
      node("start").hidden = !available.length;
      node("origin").textContent = mode === "queue" ? tr("queue") : available.length ? tr("current", { verse: bridge.reference(available[0]) }) : "";
      setup.hidden = false;
      card.hidden = true;
      summary.hidden = true;
      setStatus(available.length ? "" : mode === "queue" ? "empty" : "noVerse");
      bridge.stop();
      dialog.showModal();
      (node("start").hidden ? node("close") : length.closest("label").hidden ? node("start") : node("start")).focus();
    }

    function renderCard() {
      const { verse, hint, revealed, busy, failed } = session;
      const text = node("text");
      text.textContent = revealed ? verse.text : hint ? verse.first : "";
      text.hidden = !text.textContent;
      node("prompt").hidden = revealed;
      node("hint").hidden = revealed;
      node("hint").disabled = !verse?.first || hint;
      node("reveal").hidden = revealed;
      node("reveal").disabled = !verse;
      node("retry").hidden = !failed;
      node("remembered").hidden = !revealed;
      node("again").hidden = !revealed;
      node("remembered").disabled = node("again").disabled = node("skip").disabled = busy;
      node("remembered").textContent = tr(hint ? "assisted" : session.mode === "queue" ? "remove" : "remembered");
      node("again").textContent = tr(session.mode === "queue" ? "keep" : "again");
    }

    async function loadCard() {
      const current = session;
      const index = current.index;
      const key = current.keys[index];
      Object.assign(current, { verse: null, hint: false, revealed: false, failed: false, busy: false });
      setup.hidden = true;
      card.hidden = false;
      node("reference").textContent = bridge.reference(key);
      node("step").textContent = tr("step", { index: number(index + 1), total: number(current.keys.length) });
      node("progress").max = current.keys.length;
      node("progress").value = index;
      setStatus("loading");
      renderCard();
      node("reference").focus();
      try {
        const verse = await bridge.verse(key);
        if (session !== current || current.index !== index || !dialog.open) return;
        current.verse = verse;
        setStatus("");
      } catch (_) {
        if (session !== current || current.index !== index || !dialog.open) return;
        current.failed = true;
        setStatus("loadError");
      }
      renderCard();
    }

    function advance(result) {
      session.totals[result]++;
      session.index++;
      if (session.index < session.keys.length) {
        loadCard();
        return;
      }
      card.hidden = true;
      summary.hidden = false;
      const list = summary.querySelector("dl");
      list.replaceChildren(...Object.entries(session.totals).map(([label, count]) => {
        const row = document.createElement("div");
        const title = document.createElement("dt");
        const value = document.createElement("dd");
        title.textContent = tr(label);
        value.textContent = number(count);
        row.append(title, value);
        return row;
      }));
      setStatus("");
      node("summary-title").focus();
    }

    async function rate(again) {
      const current = session;
      if (current.busy || !current.revealed) return;
      const key = current.keys[current.index];
      const shouldAdd = again && !bridge.queue().includes(key);
      const shouldRemove = !again && !current.hint && current.mode === "queue" && bridge.queue().includes(key);
      if (shouldAdd || shouldRemove || !again && !current.hint) {
        current.busy = true;
        setStatus("saving");
        renderCard();
        try {
          await bridge.saveReview(key, shouldAdd, current.stamp, !again && !current.hint, shouldRemove);
        } catch (_) {
          if (session !== current || !dialog.open) return;
          current.busy = false;
          setStatus("saveError");
          renderCard();
          (again ? node("again") : node("remembered")).focus();
          return;
        }
      }
      if (session === current && dialog.open) {
        advance(again ? "againTotal" : current.hint ? "assistedTotal" : "cleanTotal");
      }
    }

    openers.forEach(button => button.addEventListener("click", () => open(button)));
    setup.addEventListener("submit", event => {
      event.preventDefault();
      if (!session || !setup.checkValidity()) return;
      session.keys = session.available.slice(0, Number(length.value));
      if (session.keys.length) loadCard();
    });
    node("hint").addEventListener("click", () => {
      if (!session.verse?.first) return;
      session.hint = true;
      renderCard();
      node("text").focus();
    });
    node("reveal").addEventListener("click", () => {
      session.revealed = true;
      renderCard();
      node("text").focus();
    });
    node("remembered").addEventListener("click", () => rate(false));
    node("again").addEventListener("click", () => rate(true));
    node("skip").addEventListener("click", () => advance("skippedTotal"));
    node("retry").addEventListener("click", loadCard);
    [node("close"), node("done")].forEach(button => button.addEventListener("click", () => dialog.close()));
    dialog.addEventListener("close", () => {
      if (dialog.open) return;
      session = null;
      node("text").textContent = "";
      if (opener && !opener.hidden) opener.focus();
      if (opener?.hidden) {
        const queue = document.getElementById("review-queue-list");
        queue.tabIndex = -1;
        queue.focus();
      }
      opener = null;
    });
    return { refresh, openCurrent: focus => open(Array.from(openers).find(button => button.dataset.quietRecallOpen === "current"), focus), close: () => { if (dialog.open) dialog.close(); } };
  }

  root.AllimQuietRecall = { mount };
})(window);
