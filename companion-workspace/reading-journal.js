/* ALLIM reading journal: page coverage is separate from repeated reading volume. */
(function (root) {
  'use strict';
  const TOTAL = 604;
  const fresh = () => ({ version: 1, past: 0, cycle: 1, deadline: '', entries: [] });
  const integer = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10) === value;
  function validate(book) {
    if (!book || book.version !== 1 || !integer(book.past, 0, 100000) || !integer(book.cycle, 1, 100000) || !Array.isArray(book.entries)) throw Error('invalid');
    if (typeof book.deadline !== 'string' || (book.deadline && !validDate(book.deadline))) throw Error('invalid');
    const ids = new Set();
    book.entries.forEach(e => {
      if (!e || typeof e.id !== 'string' || ids.has(e.id) || !integer(e.cycle, 1, book.cycle) || !validDate(e.date) || !['paper', 'digital', 'mic'].includes(e.source) || !Array.isArray(e.parts) || !e.parts.length) throw Error('invalid');
      ids.add(e.id);
      e.parts.forEach(p => {
        if (!integer(p.page, 1, TOTAL) || typeof p.full !== 'boolean' || !(p.letters === null || integer(p.letters, 0, 100000)) || !Array.isArray(p.keys) || !p.keys.every(k => /^\d+:\d+:\d+$/.test(k)) || !integer(p.total, 0, 1000) || (!p.full && (!p.total || !p.keys.length || p.keys.length > p.total))) throw Error('invalid');
      });
    });
    return book;
  }
  function summary(book, today) {
    const cycles = new Map(); let letters = 0, unknown = 0, volume = 0, todayVolume = 0;
    book.entries.forEach(e => {
      if (!cycles.has(e.cycle)) cycles.set(e.cycle, new Map());
      const pages = cycles.get(e.cycle);
      e.parts.forEach(p => {
        if (!pages.has(p.page)) pages.set(p.page, { full: false, keys: new Set(), total: p.total });
        const covered = pages.get(p.page);
        covered.full = covered.full || p.full;
        covered.total = Math.max(covered.total, p.total);
        p.keys.forEach(k => covered.keys.add(k));
        if (p.letters === null) unknown++; else letters += p.letters;
        const amount = p.full ? 1 : p.keys.length / p.total;
        volume += amount; if (e.date === today) todayVolume += amount;
      });
    });
    const count = pages => !pages ? 0 : Array.from(pages.values()).reduce((n, p) => n + (p.full ? 1 : Math.min(1, p.keys.size / p.total)), 0);
    const current = count(cycles.get(book.cycle));
    const completed = Array.from(cycles.values()).filter(p => count(p) >= TOTAL).length;
    const fullPages = Array.from((cycles.get(book.cycle) || new Map()).values()).filter(p => p.full || p.keys.size >= p.total).length;
    return { current, fullPages, percent: current / TOTAL * 100, completed, lifetime: book.past + completed, letters, unknown, volume, todayVolume };
  }
  function countLetters(text) {
    return (String(text).normalize('NFKC').match(/[\u0621-\u063A\u0641-\u064A\u0671]/g) || []).length;
  }
  function pagePart(data, verseKey) {
    const words = [];
    (data.verses || []).forEach(v => (v.words || []).forEach((w, i) => {
      if (w.char_type_name === 'end' || (w.page_number && Number(w.page_number) !== Number(data.page))) return;
      words.push({ key: v.verse_key + ':' + (w.position || i + 1), verse: v.verse_key, text: w.text_qpc_hafs || w.text_uthmani || '' });
    }));
    if (!integer(Number(data.page), 1, TOTAL) || !words.length) throw Error('page');
    const selected = verseKey ? words.filter(w => w.verse === verseKey) : words;
    if (!selected.length) throw Error('verse');
    return { page: Number(data.page), full: !verseKey, total: words.length, keys: selected.map(w => w.key), letters: selected.every(w => w.text) ? selected.reduce((n, w) => n + countLetters(w.text), 0) : null };
  }
  const core = { fresh, validate, summary, countLetters, pagePart };
  if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }
  const messages = {
    ru: {
      retry: 'Досчитать буквы по тексту', title: 'Мой хатм', intro: 'Каждый прочитанный отрывок — часть вашего пути.', pages: 'Страницы текущего хатма', lifetime: 'Хатмов за жизнь', volume: 'Прочитано страниц с повторами', reward: 'Условный ориентир хасанатов', note: 'Ориентир: учтённые буквы × 10 по хадису ат-Тирмизи 2910. Истинная награда — у Аллаха. Программа считает письменные буквы без огласовок; это приблизительный расчёт.', unknown: 'Есть записи без текста: их буквы пока не включены в расчёт.', add: 'Записать чтение', paper: 'Бумажный мусхаф', digital: 'Чтение в приложении', mic: 'Микрофон · сопоставлено', source: 'Способ чтения', from: 'Со страницы', to: 'По страницу', date: 'Дата чтения', edition: 'Нумерация мединского мусхафа, 604 страницы. Для другого издания сначала найдите соответствующий отрывок в цифровом мусхафе.', save: 'Подтверждаю: отрывок прочитан', local: 'Журнал хранится только в этом браузере, без синхронизации с аккаунтом. Сохраняйте резервную копию.', saved: 'Чтение записано.', error: 'Не удалось сохранить. Проверьте диапазон и дату, доступ к хранилищу и другую открытую вкладку.', past: 'Хатмы до начала этого журнала (по вашей записи)', settings: 'История и цель', apply: 'Сохранить настройки', deadline: 'Завершить к дате · например, конец Рамадана', target: 'Страниц в день до выбранной даты', today: 'Прочитано сегодня', history: 'Последние записи', empty: 'Начните с первого прочитанного отрывка.', undo: 'Удалить последнюю запись', confirmUndo: 'Удалить последнюю запись? Прогресс и число хатмов будут пересчитаны.', next: 'Начать следующий хатм', export: 'Скачать резервную копию', restore: 'Восстановить копию', confirmRestore: 'Заменить журнал данными из выбранной резервной копии?', busy: 'Сохраняю…', complete: 'Хатм завершён', goal: 'Достижение', milestone: 'Текущий хатм', pastLabel: 'Внесено из прошлого', recorded: 'Завершено в журнале', help: 'Без микрофона подтвердите прочитанные страницы. При включённом микрофоне завершённые и сопоставленные аяты учитываются автоматически; проверка таджвида этим не подтверждается. Перелистывание и прослушивание не засчитываются как чтение.', current: 'Записать открытую страницу', expired: 'Дата цели прошла. Выберите новую.', loading: 'Загружаю текст для счётчика букв…', backupError: 'Файл не является корректной резервной копией журнала.', newCycle: 'Новый хатм начат. История сохранена.', full: 'Полностью прочитано страниц', achievements: ['Первый отрывок', 'Четверть хатма', 'Половина хатма', 'Три четверти хатма', 'Полный хатм']
    },
    en: {
      retry: 'Update missing letter counts', title: 'My khatm', intro: 'Every passage read is part of your journey.', pages: 'Pages in this khatm', lifetime: 'Lifetime khatms', volume: 'Pages read including repeats', reward: 'Illustrative hasanat estimate', note: 'A reminder: recorded letters × 10, based on Jami at-Tirmidhi 2910. Actual reward is with Allah. Written letters are counted without vowel marks; this is an approximation.', unknown: 'Some entries have no text available; their letters are not yet included.', add: 'Log reading', paper: 'Printed mushaf', digital: 'Reading in the app', mic: 'Microphone · matched', source: 'Reading method', from: 'From page', to: 'Through page', date: 'Reading date', edition: 'Madani mushaf numbering, 604 pages. For another edition, first locate the matching passage in the digital mushaf.', save: 'I confirm I read this passage', local: 'This journal is stored only in this browser, without account sync. Keep a backup.', saved: 'Reading recorded.', error: 'Could not save. Check the range, date, storage access and other open tabs.', past: 'Khatms before this journal (self-reported)', settings: 'History and goal', apply: 'Save settings', deadline: 'Finish by · for example, the end of Ramadan', target: 'Pages per day until the selected date', today: 'Read today', history: 'Recent entries', empty: 'Begin with your first passage.', undo: 'Delete last entry', confirmUndo: 'Delete the last entry? Progress and khatm totals will be recalculated.', next: 'Start next khatm', export: 'Download backup', restore: 'Restore backup', confirmRestore: 'Replace this journal with the selected backup?', busy: 'Saving…', complete: 'Khatm completed', goal: 'Achievement', milestone: 'Current khatm', pastLabel: 'Added from the past', recorded: 'Completed in journal', help: 'Without a microphone, confirm the pages you read. With the microphone on, completed matched ayahs are logged automatically; this does not certify tajweed. Page turns and listening do not count as reading.', current: 'Log the open page', expired: 'Your target date has passed. Choose a new date.', loading: 'Loading text for the letter counter…', backupError: 'This file is not a valid journal backup.', newCycle: 'New khatm started. History preserved.', full: 'Fully read pages', achievements: ['First passage', 'Quarter khatm', 'Half khatm', 'Three quarters', 'Full khatm']
    },
    ar: {
      retry: 'استكمال حساب الحروف', title: 'ختمتي', intro: 'كل مقطع تقرؤه خطوة في رحلتك مع القرآن.', pages: 'صفحات الختمة الحالية', lifetime: 'الختمات طوال الحياة', volume: 'الصفحات المقروءة مع التكرار', reward: 'تقدير رمزي للحسنات', note: 'للتذكير: الحروف المسجلة × ١٠، استنادًا إلى جامع الترمذي ٢٩١٠. الأجر الحقيقي عند الله. يحسب التطبيق الحروف المكتوبة دون التشكيل؛ لذا فالعدد تقريبي.', unknown: 'بعض السجلات لا يتوفر نصها؛ لم تُضف حروفها إلى التقدير بعد.', add: 'تسجيل القراءة', paper: 'مصحف ورقي', digital: 'القراءة في التطبيق', mic: 'الميكروفون · تمت المطابقة', source: 'طريقة القراءة', from: 'من الصفحة', to: 'إلى الصفحة', date: 'تاريخ القراءة', edition: 'ترقيم المصحف المدني، ٦٠٤ صفحات. إذا كانت طبعتك مختلفة، فحدّد المقطع المقابل في المصحف الرقمي أولًا.', save: 'أؤكد أنني قرأت هذا المقطع', local: 'يُحفظ السجل في هذا المتصفح فقط دون مزامنة مع الحساب. احتفظ بنسخة احتياطية.', saved: 'تم تسجيل القراءة.', error: 'تعذر الحفظ. تحقق من الصفحات والتاريخ وإتاحة التخزين وعلامات التبويب الأخرى.', past: 'الختمات السابقة لهذا السجل (بإقرارك)', settings: 'السجل والهدف', apply: 'حفظ الإعدادات', deadline: 'الإتمام بحلول · مثل نهاية رمضان', target: 'صفحات يوميًا حتى التاريخ المحدد', today: 'قراءة اليوم', history: 'آخر القراءات', empty: 'ابدأ بتسجيل أول مقطع قرأته.', undo: 'حذف آخر قراءة', confirmUndo: 'هل تريد حذف آخر قراءة؟ ستُعاد حسابات التقدم والختمات.', next: 'بدء ختمة جديدة', export: 'تنزيل نسخة احتياطية', restore: 'استعادة نسخة', confirmRestore: 'هل تريد استبدال السجل بهذه النسخة الاحتياطية؟', busy: 'جارٍ الحفظ…', complete: 'اكتملت الختمة', goal: 'إنجاز', milestone: 'الختمة الحالية', pastLabel: 'ختمات سابقة مضافة', recorded: 'ختمات مكتملة في السجل', help: 'دون ميكروفون، أكّد الصفحات التي قرأتها. عند تشغيل الميكروفون تُسجّل الآيات المكتملة التي طابقها التطبيق تلقائيًا؛ ولا يُعد ذلك تقييمًا للتجويد. تقليب الصفحات والاستماع لا يُحتسبان قراءة.', current: 'تسجيل الصفحة المفتوحة', expired: 'انتهى موعد الهدف. اختر تاريخًا جديدًا.', loading: 'جارٍ تحميل النص لحساب الحروف…', backupError: 'الملف ليس نسخة احتياطية صالحة.', newCycle: 'بدأت ختمة جديدة مع حفظ السجل.', full: 'صفحات قُرئت كاملة', achievements: ['أول مقطع', 'ربع الختمة', 'نصف الختمة', 'ثلاثة أرباع الختمة', 'ختمة كاملة']
    }
  };
  const storageKey = 'allim-reading-journal-v1';
  let book = fresh(), raw = null, bridge, panel, pending = false, failed = false, epoch = 0;
  const day = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const tr = key => (messages[document.documentElement.lang] || messages.en)[key];
  const ltr = value => '\u2066' + value + '\u2069';
  const number = n => new Intl.NumberFormat(document.documentElement.lang || 'en', { maximumFractionDigits: 2 }).format(n);
  function read() { try { raw = localStorage.getItem(storageKey); book = raw ? validate(JSON.parse(raw)) : fresh(); failed = false; } catch (_) { failed = true; } }
  function commit(next, recovery) {
    try {
      if ((!recovery && failed) || localStorage.getItem(storageKey) !== raw) throw Error('conflict');
      validate(next); const value = JSON.stringify(next); localStorage.setItem(storageKey, value); raw = value; book = next; failed = false; if (recovery) epoch++; render(); return true;
    } catch (_) { status('error'); return false; }
  }
  function status(key) { if (panel) panel.querySelector('[data-j-status]').textContent = tr(key); }
  function element(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
  function appendEntry(parts, source, date, cycle) {
    if (book.cycle !== cycle) return false;
    const entry = { id: crypto.randomUUID(), date, cycle, source, parts };
    return commit({ ...book, entries: book.entries.concat(entry) });
  }
  function render() {
    if (!panel) return;
    panel.querySelectorAll('[data-j-text]').forEach(n => n.textContent = tr(n.dataset.jText));
    const s = summary(book, day());
    const stats = { pages: `${number(s.current)} / ${number(TOTAL)} · ${number(s.fullPages === TOTAL ? 100 : Math.min(99.99, s.percent))}%`, lifetime: number(s.lifetime), volume: number(s.volume), reward: number(s.letters * 10) };
    panel.querySelectorAll('[data-j-value]').forEach(n => { n.textContent = stats[n.dataset.jValue]; n.dir = 'ltr'; });
    panel.querySelector('[data-j-headline]').textContent = `${tr('title')} · ${ltr(stats.pages)}`;
    const progress = panel.querySelector('progress'); progress.value = s.current; progress.setAttribute('aria-label', tr('pages'));
    panel.querySelector('[data-j-unknown]').hidden = !s.unknown;
    panel.querySelector('[data-j-retry]').hidden = !s.unknown;
    panel.querySelector('[data-j-retry]').disabled = pending;
    panel.querySelector('[data-j-full]').textContent = `${tr('full')}: ${ltr(number(s.fullPages) + ' / ' + number(TOTAL))}`;
    panel.querySelector('[data-j-past-summary]').textContent = `${tr('pastLabel')}: ${number(book.past)} · ${tr('recorded')}: ${number(s.completed)}`;
    panel.querySelector('[data-j-next]').disabled = s.fullPages !== TOTAL || pending;
    panel.querySelector('[data-j-undo]').disabled = !book.entries.length || pending;
    const goal = panel.querySelector('[data-j-goal]');
    const days = book.deadline ? Math.round((Date.parse(book.deadline + 'T12:00:00Z') - Date.parse(day() + 'T12:00:00Z')) / 86400000) + 1 : 0;
    goal.textContent = `${tr('today')}: ${number(s.todayVolume)}` + (book.deadline ? days > 0 ? ` · ${tr('target')}: ${number(Math.ceil((TOTAL - s.current) / days))}` : ` · ${tr('expired')}` : '');
    const stage = s.fullPages === TOTAL ? 4 : s.current >= 453 ? 3 : s.current >= 302 ? 2 : s.current >= 151 ? 1 : s.current > 0 ? 0 : -1;
    panel.querySelector('[data-j-achievement]').textContent = stage < 0 ? tr('empty') : `${tr('goal')}: ${tr('achievements')[stage]}`;
    const list = panel.querySelector('[data-j-history]'); list.replaceChildren();
    book.entries.slice(-8).reverse().forEach(e => {
      const pages = Array.from(new Set(e.parts.map(p => p.page))).sort((a,b)=>a-b);
      list.append(element('li', `${new Intl.DateTimeFormat(document.documentElement.lang).format(new Date(e.date+'T12:00:00'))} · ${tr(e.source)} · ${pages.map(number).join(', ')} · ${tr('milestone')} ${number(e.cycle)}`));
    });
    document.querySelectorAll('[data-j-overview]').forEach(n => n.textContent = `${tr('title')}: ${stats.pages} · ${tr('lifetime')}: ${stats.lifetime}`);
  }
  function timed(promise) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('timeout')), 8000); })]).finally(() => clearTimeout(timer));
  }
  async function manual(event) {
    event.preventDefault(); if (pending || failed) { status('error'); return; }
    const form = event.currentTarget; const from = Number(form.elements.from.value), to = Number(form.elements.to.value), date = form.elements.date.value;
    if (!integer(from,1,TOTAL) || !integer(to,from,TOTAL) || !date || date > day()) { status('error'); return; }
    pending = true; const cycle = book.cycle; const source = form.elements.source.value;
    const button = form.querySelector('[type=submit]'); button.disabled = true; status('loading'); render();
    const parts = [];
    // A missing text source must not prevent an honest manual reading entry.
    let unavailable = false;
    for (let page = from; page <= to; page++) {
      let part = { page, full: true, total: 0, keys: [], letters: null };
      if (!unavailable) { try { part = pagePart(await timed(bridge.page(page))); } catch (_) { unavailable = true; } }
      parts.push(part);
    }
    if (appendEntry(parts, source, date, cycle)) status('saved'); else status('error');
    pending = false; button.disabled = false; render();
  }
  function init(config) {
    bridge = config; read();
    panel = document.getElementById('reading-journal');
    if (!panel) return;
    panel.innerHTML = `<summary data-j-headline></summary><header><div><span class="kicker" data-j-text="milestone"></span><h3 data-j-text="title"></h3><p data-j-text="intro"></p></div><button type="button" class="secondary-button" data-j-current data-j-text="current"></button></header><div class="journal-metrics">${['pages','lifetime','volume','reward'].map(k=>`<div><small data-j-text="${k}"></small><strong data-j-value="${k}"></strong></div>`).join('')}</div><progress max="604" value="0"></progress><p data-j-full></p><p data-j-past-summary></p><p data-j-goal></p><p class="journal-achievement" data-j-achievement></p><p class="journal-note" data-j-text="note"></p><a class="journal-source" href="https://sunnah.com/tirmidhi:2910" target="_blank" rel="noopener">Jamiʿ at-Tirmidhi · 2910</a><p data-j-unknown data-j-text="unknown" hidden></p><button class="secondary-button" type="button" data-j-retry data-j-text="retry" hidden></button><details data-j-form-details><summary data-j-text="add"></summary><form data-j-form><label><span data-j-text="source"></span><select name="source"><option value="paper" data-j-text="paper"></option><option value="digital" data-j-text="digital"></option></select></label><div class="journal-fields"><label><span data-j-text="from"></span><input name="from" type="number" min="1" max="604" required value="1"></label><label><span data-j-text="to"></span><input name="to" type="number" min="1" max="604" required value="1"></label><label><span data-j-text="date"></span><input name="date" type="date" required></label></div><p data-j-text="edition"></p><button class="primary-button" type="submit" data-j-text="save"></button></form></details><details><summary data-j-text="settings"></summary><form data-j-settings><label><span data-j-text="past"></span><input name="past" type="number" min="0" max="100000" required></label><label><span data-j-text="deadline"></span><input name="deadline" type="date"></label><button class="secondary-button" type="submit" data-j-text="apply"></button></form></details><details><summary data-j-text="history"></summary><ol data-j-history></ol><button class="secondary-button" type="button" data-j-undo data-j-text="undo"></button></details><div class="journal-actions"><button class="primary-button" type="button" data-j-next data-j-text="next"></button><button class="secondary-button" type="button" data-j-export data-j-text="export"></button><label class="journal-restore"><span data-j-text="restore"></span><input data-j-import type="file" accept="application/json,.json"></label></div><p class="journal-note" data-j-text="help"></p><p class="journal-note" data-j-text="local"></p><p role="status" aria-live="polite" data-j-status></p>`;
    const form = panel.querySelector('[data-j-form]'); form.elements.date.value = day(); form.elements.date.max = day(); form.addEventListener('submit', manual);
    const settings = panel.querySelector('[data-j-settings]'); settings.elements.past.value = book.past; settings.elements.deadline.value = book.deadline;
    settings.addEventListener('submit', e => { e.preventDefault(); if (pending) return; if (commit({ ...book, past: Number(settings.elements.past.value), deadline: settings.elements.deadline.value })) status('saved'); });
    panel.querySelector('[data-j-retry]').onclick = async () => {
      if (pending) return; pending = true; render(); status('loading');
      const cache = new Map(), captured = book.entries;
      try {
        const updated = [];
        for (const e of captured) {
          const parts = [];
          for (const p of e.parts) {
            if (p.letters !== null) { parts.push(p); continue; }
            if (!cache.has(p.page)) cache.set(p.page, await timed(bridge.page(p.page)));
            const resolved = pagePart(cache.get(p.page), p.full ? null : p.keys[0].split(':').slice(0,2).join(':'));
            parts.push({ ...p, letters: resolved.letters });
          }
          updated.push({ ...e, parts });
        }
        const byId = new Map(updated.map(e => [e.id, e]));
        if (commit({ ...book, entries: book.entries.map(e => byId.get(e.id) || e) })) status('saved');
      } catch (_) { status('error'); }
      pending = false; render();
    };
    panel.querySelector('[data-j-current]').onclick = () => { panel.querySelector('[data-j-form-details]').open = true; form.elements.from.value = bridge.currentPage(); form.elements.to.value = bridge.currentPage(); form.elements.source.value = 'digital'; form.elements.from.focus(); };
    panel.querySelector('[data-j-undo]').onclick = () => { if (!pending && root.confirm(tr('confirmUndo'))) commit({ ...book, entries: book.entries.slice(0,-1) }); };
    panel.querySelector('[data-j-next]').onclick = () => { if (!pending && summary(book,day()).fullPages === TOTAL && commit({ ...book, cycle: book.cycle+1 })) status('newCycle'); };
    panel.querySelector('[data-j-export]').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(book,null,2)],{type:'application/json'})); const a = element('a'); a.href=url; a.download=`allim-reading-${day()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); };
    panel.querySelector('[data-j-import]').onchange = async e => { const file=e.target.files[0]; if (!file || pending) return; try { if(file.size>20000000) throw Error('size'); const next=validate(JSON.parse(await file.text())); if(root.confirm(tr('confirmRestore'))) { if(commit(next, true)) { settings.elements.past.value=book.past; settings.elements.deadline.value=book.deadline; status('saved'); } } } catch(_) {status('backupError');} e.target.value=''; };
    new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    root.addEventListener('storage',e=>{if(e.key===storageKey){read();render();settings.elements.past.value=book.past;settings.elements.deadline.value=book.deadline;}});
    render(); if(failed) status('error');
  }
  // The caller supplies only a completed, matched recitation and its captured page data.
  function recognized(surah, ayah) {
    if (!panel) return;
    const cycle = book.cycle, date = day(), key = surah + ':' + ayah, started = epoch;
    timed(bridge.versePage(surah, ayah)).then(data => {
      if (started !== epoch) return;
      if (!appendEntry([pagePart(data, key)], 'mic', date, cycle)) status('error');
    }).catch(() => status('error'));
  }
  root.ALLIMReading = { init, recognized, clear: () => { if (pending) { status('error'); return false; } const saved = commit(fresh(), true); if (saved && panel) { const form = panel.querySelector('[data-j-settings]'); form.elements.past.value = 0; form.elements.deadline.value = ''; } return saved; } };
}(typeof window !== 'undefined' ? window : globalThis));
