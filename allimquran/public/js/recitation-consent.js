/* Voluntary, adult-only private evaluation. No microphone is opened by this module. */
(function () {
  "use strict";
  var VERSION = "2026-09-07-v1";
  var KEY = "allim-recitation-contribution-v1";
  var API = "/api/quran-asr/research";
  var copy = {
    ru: {
      title: "Помогите улучшить распознавание Корана",
      short: "Сохраняем фрагменты Quran AI для проверки командой и преподавателями до 90 дней, без имени и аккаунта. Голос может быть узнаваемым. Отказ не ограничивает занятия; записи можно удалить в настройках.",
      more: "Что сохраняем и как удалить записи",
      lead: "Вы можете добровольно поделиться фрагментами своего чтения. Они помогут находить ложные замечания и пропущенные ошибки. Надеемся, что ваш вклад станет садака джария, иншаАллах.",
      details: "С вашего согласия сохраняем фрагменты, отправляемые в Quran AI, выбранный аят и результат распознавания — до 90 дней с момента согласия. Команда проекта и допущенные преподаватели смогут прослушивать их для проверки качества. На этом этапе записи не используются для обучения моделей, не публикуются и не передаются внешним ИИ-сервисам.",
      privacy: "В коллекцию не включаем имя, аккаунт, IP или контакты. Голос может быть узнаваемым: полной анонимности обещать нельзя. Сохраняем только ваше чтение после нажатия микрофона; не записывайте других людей. Распознавание браузером в сборе не участвует.",
      control: "Отказ не ограничивает занятия. Отключить участие и удалить отправленные с этим ключом записи можно в настройках. Сохраните ключ удаления: после очистки данных браузера он потребуется. При общем устройстве отключайте участие после своего занятия.",
      adult: "Мне исполнилось 18 лет, я делюсь своим голосом и согласен(на) с описанным использованием.",
      yes: "Согласен, помочь проекту", no: "Продолжить без сохранения", close: "Закрыть",
      settings: "Помощь в улучшении распознавания", manage: "Управлять участием",
      on: "Участие включено для Quran AI", off: "Сохранение для проекта выключено",
      pending: "Сохранение выключено. Удаление ещё не подтверждено — повторите попытку.",
      unavailable: "Сбор сейчас недоступен. Можно продолжить занятия без сохранения.",
      failure: "Не удалось подтвердить действие. Сохранение выключено. Попробуйте ещё раз.",
      delete: "Отключить и удалить мои записи", deleted: "Участие отключено. Записи с этим ключом удалены.",
      key: "Ключ удаления (сохраните у себя)", restore: "Удалить записи по сохранённому ключу",
      busy: "Подождите…", storage: "Для участия нужно разрешить хранение ключа в этом браузере. Занятия доступны без участия."
    },
    en: {
      title: "Help improve Qur’an recognition",
      short: "We keep Quran AI clips for review by the team and teachers for up to 90 days, without your name or account. Your voice may be recognizable. Declining does not limit practice; you can delete clips in settings.",
      more: "What we keep and how to delete it",
      lead: "You can volunteer clips of your own recitation to help us find false warnings and missed mistakes. We hope your contribution becomes sadaqah jariyah, inshaAllah.",
      details: "With your consent, we keep clips sent to Quran AI, the selected verse and recognition results for up to 90 days from consent. The project team and authorized teachers may listen to them to assess quality. At this stage, clips are not used to train models, published or sent to external AI services.",
      privacy: "The collection excludes your name, account, IP and contact details. A voice may be recognizable, so we cannot promise complete anonymity. Only your recitation after pressing the microphone is eligible; do not record other people. Browser speech recognition does not contribute audio.",
      control: "Declining does not limit practice. Turn participation off and delete clips associated with this key in settings. Save your deletion key: you will need it if browser data is cleared. On shared devices, turn participation off after your practice.",
      adult: "I am at least 18, I am sharing my own voice and agree to the use described above.",
      yes: "Agree and help the project", no: "Continue without saving", close: "Close",
      settings: "Help improve recognition", manage: "Manage participation",
      on: "Participation is on for Quran AI", off: "Saving for the project is off",
      pending: "Saving is off. Deletion is not yet confirmed — please retry.",
      unavailable: "Collection is currently unavailable. You can practise without saving.",
      failure: "The action could not be confirmed. Saving is off. Please try again.",
      delete: "Turn off and delete my clips", deleted: "Participation is off. Clips associated with this key were deleted.",
      key: "Deletion key (keep a copy)", restore: "Delete clips using a saved key",
      busy: "Please wait…", storage: "Participation requires storing a key in this browser. You can practise without participating."
    },
    ar: {
      title: "ساعد في تحسين التعرّف على تلاوة القرآن",
      short: "نحفظ مقاطع Quran AI لمراجعة الفريق والمعلّمين مدة لا تتجاوز 90 يومًا دون اسمك أو حسابك. قد يُعرف الشخص بصوته. الرفض لا يقيّد التعلّم، ويمكن حذف المقاطع من الإعدادات.",
      more: "ما نحفظه وكيف تحذف المقاطع",
      lead: "يمكنك التطوّع بمقاطع من تلاوتك لمساعدتنا في اكتشاف التنبيهات الخاطئة والأخطاء التي لم تُكتشف. نرجو أن تكون مساهمتك صدقة جارية إن شاء الله.",
      details: "بموافقتك نحفظ المقاطع المرسلة إلى Quran AI والآية المختارة ونتائج التعرّف لمدة لا تتجاوز 90 يومًا من الموافقة. يمكن لفريق المشروع والمعلّمين المصرّح لهم الاستماع لتقييم الجودة. في هذه المرحلة لا تُستخدم المقاطع لتدريب النماذج ولا تُنشر ولا تُرسل إلى خدمات ذكاء اصطناعي خارجية.",
      privacy: "لا تتضمن المجموعة اسمك أو حسابك أو عنوان IP أو بيانات اتصالك. قد يُعرف الشخص بصوته، لذلك لا نعد بإخفاء الهوية تمامًا. تُجمع تلاوتك فقط بعد ضغط الميكروفون؛ لا تسجّل أشخاصًا آخرين. التعرّف الصوتي في المتصفح لا يشارك في الجمع.",
      control: "الرفض لا يقيّد التعلّم. يمكنك إيقاف المشاركة وحذف المقاطع المرتبطة بهذا المفتاح من الإعدادات. احتفظ بمفتاح الحذف لاستخدامه بعد مسح بيانات المتصفح. أوقف المشاركة بعد جلستك عند استخدام جهاز مشترك.",
      adult: "أبلغ 18 عامًا على الأقل، وأشارك صوتي وأوافق على الاستخدام الموضّح أعلاه.",
      yes: "أوافق وأساعد المشروع", no: "المتابعة دون حفظ", close: "إغلاق",
      settings: "المساعدة في تحسين التعرّف", manage: "إدارة المشاركة",
      on: "المشاركة مفعّلة مع Quran AI", off: "حفظ المقاطع للمشروع متوقف",
      pending: "الحفظ متوقف. لم يُؤكّد الحذف بعد؛ أعد المحاولة.",
      unavailable: "الجمع غير متاح حاليًا. يمكنك التدرّب دون حفظ.",
      failure: "تعذّر تأكيد الإجراء. الحفظ متوقف. أعد المحاولة.",
      delete: "إيقاف المشاركة وحذف مقاطعي", deleted: "توقفت المشاركة وحُذفت المقاطع المرتبطة بهذا المفتاح.",
      key: "مفتاح الحذف (احتفظ بنسخة)", restore: "حذف المقاطع بمفتاح محفوظ",
      busy: "يرجى الانتظار…", storage: "تتطلب المشاركة حفظ مفتاح في هذا المتصفح. يمكنك التدرّب دون مشاركة."
    }
  };
  window.AllimContribution = function (options) {
    var choice = read(), pending = false, continuation = null, dialog, row, message;
    var session = randomHex(16);
    function language() { return options.language() || "ru"; }
    function t(key) { return (copy[language()] || copy.en)[key]; }
    function randomHex(bytes) {
      if (!window.crypto || !window.crypto.getRandomValues) return "";
      return Array.from(window.crypto.getRandomValues(new Uint8Array(bytes)), function (n) { return n.toString(16).padStart(2, "0"); }).join("");
    }
    function read() {
      try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; }
    }
    function write(value) {
      choice = value;
      try { localStorage.setItem(KEY, JSON.stringify(value)); return true; } catch (_) { return false; }
    }
    function active() { return choice.status === "granted" && choice.version === VERSION && choice.expires > Date.now() / 1000; }
    function request(method, token, body) {
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 6000);
      var headers = { "X-Requested-With": "QuranCompanion" };
      if (token) headers["X-Allim-Contribution"] = token;
      if (body) headers["Content-Type"] = "application/json";
      return fetch(API, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal, cache: "no-store", credentials: "omit" }).then(function (response) {
        if (!response.ok) throw new Error("research-unavailable");
        return response.json();
      }).finally(function () { clearTimeout(timeout); });
    }
    function element(tag, text, parent) {
      var node = document.createElement(tag);
      if (text) node.textContent = text;
      if (parent) parent.appendChild(node);
      return node;
    }
    function button(text, handler, parent, id) {
      var node = element("button", text, parent);
      node.type = "button"; node.className = "secondary-button";
      if (id) node.id = id;
      node.addEventListener("click", handler);
      return node;
    }
    function status() { return t(choice.status === "withdraw_pending" || choice.status === "grant_pending" ? "pending" : active() ? "on" : "off"); }
    function refresh() {
      if (!row) return;
      row.querySelector("strong").textContent = t("settings");
      row.querySelector("small").textContent = status();
      row.querySelector("button").textContent = t("manage");
    }
    function finish(proceed) {
      var next = continuation; continuation = null;
      if (dialog && dialog.open) dialog.close();
      pending = false; refresh();
      if (proceed && next) next();
    }
    function decline(proceed) {
      // Declining while grant is in flight must never turn participation on later.
      if (choice.status === "grant_pending" && choice.token) {
        var token = choice.token;
        write({ status: "withdraw_pending", token: token, version: VERSION });
        request("DELETE", token).then(function (data) {
          if (data.withdrawn && choice.token === token && choice.status === "withdraw_pending") {
            write({ status: "declined", version: VERSION }); refresh();
          }
        }).catch(function () { refresh(); });
      } else if (!choice.token) write({ status: "declined", version: VERSION });
      finish(proceed !== false);
    }
    function withdraw(token) {
      if (!/^[a-f0-9]{64}$/.test(token || "")) { message.textContent = t("failure"); return; }
      write({ status: "withdraw_pending", token: token, version: VERSION });
      options.stop(); refresh();
      message.textContent = t("busy");
      request("DELETE", token).then(function (data) {
        if (!data.withdrawn) throw new Error("not-withdrawn");
        write({ status: "declined", version: VERSION });
        show(false); message.textContent = t("deleted");
      }).catch(function () { message.textContent = t("pending"); refresh(); });
    }
    function show(isFirst) {
      if (!dialog) {
        dialog = element("dialog", "", document.body);
        dialog.id = "allim-contribution-dialog";
        dialog.className = "allim-contribution-dialog";
        dialog.setAttribute("aria-labelledby", "allim-contribution-title");
        dialog.addEventListener("cancel", function (event) {
          event.preventDefault();
          if (choice.status === "grant_pending") decline(false); else finish(false);
        });
      }
      dialog.replaceChildren(); dialog.lang = language(); dialog.dir = language() === "ar" ? "rtl" : "ltr";
      var heading = element("h2", t("title"), dialog);
      heading.id = "allim-contribution-title"; heading.tabIndex = -1;
      ["lead", "short"].forEach(function (key) { element("p", t(key), dialog); });
      var details = element("details", "", dialog);
      element("summary", t("more"), details);
      ["details", "privacy", "control"].forEach(function (key) { element("p", t(key), details); });
      message = element("p", status(), dialog); message.setAttribute("role", "status");
      if (choice.token) {
        var label = element("label", t("key"), dialog);
        var keyInput = element("input", "", label); keyInput.value = choice.token; keyInput.readOnly = true;
        keyInput.dir = "ltr"; keyInput.className = "contribution-key";
        button(t("delete"), function () { withdraw(choice.token); }, dialog, "contribution-delete");
      } else {
        var labelAdult = element("label", "", dialog); labelAdult.className = "contribution-adult";
        var adult = element("input", "", labelAdult); adult.type = "checkbox"; adult.id = "contribution-adult";
        element("span", t("adult"), labelAdult);
        var actions = element("div", "", dialog); actions.className = "contribution-actions";
        var agree = button(t("yes"), function () {
          if (!adult.checked) return;
          var token = randomHex(32);
          if (!token || !write({ status: "grant_pending", token: token, version: VERSION })) {
            message.textContent = t("storage"); return;
          }
          agree.disabled = true; message.textContent = t("busy");
          request("POST", token, { version: VERSION, adult: true }).then(function (data) {
            // A withdrawal or another tab may have superseded this request.
            choice = read();
            if (choice.status !== "grant_pending" || choice.token !== token) return;
            if (!data.granted || data.version !== VERSION) throw new Error("not-granted");
            if (!write({ status: "granted", token: token, version: VERSION, expires: data.expires })) throw new Error("storage");
            finish(true);
          }).catch(function () {
            choice = read();
            show(isFirst); message.textContent = t("failure"); refresh();
          });
        }, actions, "contribution-agree");
        agree.disabled = true;
        adult.addEventListener("change", function () { agree.disabled = !adult.checked; });
        button(t(isFirst ? "no" : "close"), function () { if (isFirst) decline(); else finish(false); }, actions, "contribution-decline");
        if (!isFirst) {
          var saved = element("input", "", dialog); saved.className = "contribution-key";
          saved.setAttribute("aria-label", t("key")); saved.dir = "ltr"; saved.maxLength = 64; saved.autocomplete = "off";
          button(t("restore"), function () { withdraw(saved.value.trim()); }, dialog);
        }
      }
      if (choice.token) button(t(isFirst ? "no" : "close"), function () { if (isFirst) decline(); else finish(false); }, dialog);
      if (!dialog.open) dialog.showModal();
      heading.focus({ preventScroll: true }); dialog.scrollTop = 0;
    }
    function beforeStart(next) {
      choice = read();
      if (choice.version === VERSION && (choice.status === "declined" || active() || choice.status === "withdraw_pending" || choice.status === "grant_pending")) {
        next(); return;
      }
      if (pending) return;
      pending = true; continuation = next;
      request("GET").then(function (data) {
        if (!data.enabled || data.version !== VERSION) { finish(true); return; }
        show(true);
      }).catch(function () { finish(true); });
    }
    function mount() {
      var list = document.querySelector("#view-settings .settings-list");
      if (!list) return;
      row = element("div", "", list); row.className = "setting-row"; row.id = "contribution-settings";
      var content = element("span", "", row); element("strong", "", content); element("small", "", content);
      button("", function () { choice = read(); options.stop(); show(false); }, row);
      refresh();
    }
    window.addEventListener("storage", function (event) {
      if (event.key === KEY || event.key === null) { choice = read(); refresh(); }
    });
    return {
      beforeStart: beforeStart, mount: mount, refresh: refresh,
      context: function () { choice = read(); return active() ? { token: choice.token, session: session, language: language() } : null; },
      append: function (form, context, mode) {
        choice = read();
        var headers = { "X-Requested-With": "QuranCompanion" };
        if (!context || !active() || context.token !== choice.token) return headers;
        headers["X-Allim-Contribution"] = context.token;
        form.append("research_session", context.session); form.append("research_language", context.language);
        form.append("research_mode", mode);
        return headers;
      }
    };
  };
}());
