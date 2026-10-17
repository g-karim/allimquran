/* ALLIM learning plans and recall records. */
(function (root) {
  'use strict';
  const fresh = () => ({ version: 1, plans: [], sessions: [] });
  const int = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
  const day = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const dateOK = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d+'T12:00:00Z')) && new Date(d+'T12:00:00Z').toISOString().slice(0,10) === d;
  const distance = (a,b) => Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
  const shift = (d,n) => new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  const catalog = surahs => new Map(surahs.flatMap(s => s.verses.map(v => [`${s.id}:${v.ayah}`, {surah:s,verse:v}])));
  const flags = s => s.flags.filter(i => !s.dismissed.includes(i));
  function validate(book, data) {
    if (!book || book.version !== 1 || !Array.isArray(book.plans) || !Array.isArray(book.sessions)) throw Error('invalid');
    const ids = new Set();
    const identity = id => { if (typeof id !== 'string' || !/^(?:[\w-]{1,80}|import:[a-f0-9]{64})$/.test(id) || ids.has(id)) throw Error('id'); ids.add(id); };
    book.plans.forEach(p => {
      identity(p.id);
      if (!['read','memorize','review'].includes(p.action) || !Array.isArray(p.keys) || !p.keys.length || p.keys.length>604 || new Set(p.keys).size!==p.keys.length || !p.keys.every(k=>data.has(k)) || !int(p.portion,1,50) || !dateOK(p.created) || !(p.deadline==='' || dateOK(p.deadline) && p.deadline>=p.created)) throw Error('plan');
    });
    book.sessions.forEach(s => {
      identity(s.id);
      const positions = a => Array.isArray(a) && a.length<=s.total && new Set(a).size===a.length && a.every(i=>int(i,0,s.total-1));
      if (!data.has(s.key) || !['read','memory','test','manual-read','manual-memory','manual-review'].includes(s.mode) || !dateOK(s.date) || typeof s.complete!=='boolean' || !int(s.total,1,300) || !int(s.hints,0,s.total) || !positions(s.flags) || !positions(s.dismissed) || !s.dismissed.every(i=>s.flags.includes(i)) || !int(s.seconds,0,86400)) throw Error('session');
    });
    return book;
  }
  function eligible(s,action) {
    if (!s.complete) return false;
    if (action==='read') return s.mode==='read' || s.mode==='manual-read';
    if (s.mode.startsWith('manual-')) return action==='memorize' ? s.mode==='manual-memory' : s.mode==='manual-review';
    return ['memory','test'].includes(s.mode) && s.hints===0;
  }
  function progress(p, sessions, today) {
    const events = sessions.filter(s=>s.date>=p.created && p.keys.includes(s.key) && eligible(s,p.action));
    const covered = new Set(events.map(s=>s.key));
    const remaining = p.keys.filter(k=>!covered.has(k));
    const days = p.deadline ? distance(today,p.deadline)+1 : 0;
    const target = !remaining.length ? 0 : p.deadline && days>0 ? Math.ceil(remaining.length/days) : p.portion;
    return { done:covered.size, remaining, target, expired: !!p.deadline && days<=0 && remaining.length>0, today:new Set(events.filter(s=>s.date===today).map(s=>s.key)).size, manual:new Set(events.filter(s=>s.mode.startsWith('manual-')).map(s=>s.key)).size };
  }
  function due(sessions,today) {
    const byVerse = new Map();
    sessions.filter(s=>!s.mode.startsWith('manual-') && ['memory','test'].includes(s.mode)).forEach(s=>{
      if (!byVerse.has(s.key)) byVerse.set(s.key,[]);
      byVerse.get(s.key).push(s);
    });
    const intervals = [1,3,7,14,30];
    return Array.from(byVerse,([key,events])=>{
      let streak=0, lastClean='', date='', pending=0;
      events.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach(s=>{
        if (!s.complete && !s.hints && !flags(s).length) return;
        date=s.date;
        if (!s.complete || s.hints || flags(s).length) { streak=0; lastClean=''; pending=flags(s).length+s.hints; }
        else if (lastClean!==s.date) { streak++; lastClean=s.date; pending=0; }
      });
      return {key,date:date ? shift(date,intervals[Math.max(0,Math.min(streak-1,4))]) : '', pending};
    }).filter(v=>v.date && v.date<=today).sort((a,b)=>b.pending-a.pending || a.date.localeCompare(b.date));
  }
  function difficult(sessions) {
    const words = new Map();
    sessions.filter(s=>!s.mode.startsWith('manual-')).forEach(s=>flags(s).forEach(index=>{
      const id=s.key+':'+index, item=words.get(id)||{key:s.key,index,count:0}; item.count++; words.set(id,item);
    }));
    return Array.from(words.values()).sort((a,b)=>b.count-a.count);
  }
  function sample(keys,count,random=Math.random) {
    const pool=Array.from(new Set(keys));
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]];}
    return pool.slice(0,count);
  }
  const core={fresh,validate,catalog,progress,due,difficult,flags,sample,dateOK,day};
  if (typeof module!=='undefined' && module.exports) { module.exports=core; return; }
  const messages={
    en:{title:'My learning plan',intro:'Choose a passage, practice from memory, then return to the words that need attention.',add:'Create a plan',surah:'Surah',from:'First ayah',to:'Last ayah',action:'Practice',read:'Reading',memorize:'Memorization',review:'Review',portion:'Ayahs per day',deadline:'Finish by · optional',save:'Save plan',remove:'Remove plan',confirmRemove:'Remove this plan? Your session history will stay.',local:'Without an account, plans stay on this device. After sign-in, new plans and attempts are saved to your account. Audio is not stored.',empty:'Create your first plan. Opening a verse does not count as practice.',today:'Today',done:'Ayahs covered',manual:'Self-reported',expired:'The target date has passed. Create a plan with a new date.',start:'Practice next ayah',manualLog:'Log a session outside ALLIM',manualNote:'I confirm that I practiced this passage. This is a personal record, without microphone verification.',logged:'Session saved.',error:'Could not save. Check the range, storage access and other open tabs.',saved:'Plan saved.',history:'Recall and difficult words',historyIntro:'A recognition flag is a signal to review, not a judgement of your recitation.',attempts:'Recorded attempts',clean:'Complete recalls without hints or flags',hints:'Hints used',due:'Ready for review',dueEmpty:'Review dates will appear after practice from memory.',difficult:'Words to revisit',difficultyEmpty:'No recognition flags have been recorded.',recent:'Recent attempts',incomplete:'Not completed',complete:'Completed',dismiss:'Remove incorrect recognition flag',undo:'Restore flag',flagged:'Word flagged',test:'Quick recall check',testIntro:'Random ayahs from the selected surah. Recite the full ayah. Hints are recorded separately. This checks word sequence, not tajweed or vowel marks.',questions:'Questions',beginTest:'Start check',next:'Next question',skip:'Skip question',end:'End check',testDone:'Check finished',testResult:'Complete recalls without hints or flags',testRunning:'Question',testFinish:'Passage finished. Continue to the next question.',testSkip:'Skipped',testLimit:'The check uses only ayahs from the verified local text collection.',busy:'Opening the ayah…',backup:'Download backup',import:'Restore backup',confirmImport:'Replace plans and recall history with this backup?',invalid:'This file is not a valid learning backup.',clear:'Delete plans and history',confirmClear:'Delete all learning plans and recall history in the current profile?',retained:'Plan progress is calculated from your saved attempts.',practice:'Memory practice',testMode:'Recall check',notice:'For a check, the 300× and 33× counters stay unchanged.',counts:'times',record:'Confirm session',past:'Session date',exportError:'Could not download the backup.'},
    ar:{title:'خطتي للتعلّم',intro:'اختر مقطعًا، وتمرّن على تسميعه، ثم عُد إلى الكلمات التي تحتاج إلى مراجعة.',add:'إنشاء خطة',surah:'السورة',from:'من الآية',to:'إلى الآية',action:'نوع التدريب',read:'قراءة',memorize:'حفظ',review:'مراجعة',portion:'آيات في اليوم',deadline:'الإتمام بحلول · اختياري',save:'حفظ الخطة',remove:'حذف الخطة',confirmRemove:'هل تريد حذف الخطة؟ سيبقى سجل الجلسات محفوظًا.',local:'دون حساب تبقى الخطط على الجهاز. بعد الدخول تُحفظ الخطط والمحاولات الجديدة في الحساب. لا يُحفظ الصوت.',empty:'أنشئ خطتك الأولى. فتح الآية وحده لا يُحتسب تدريبًا.',today:'اليوم',done:'الآيات المُنجزة',manual:'بحسب تسجيلك الشخصي',expired:'انقضى الموعد المستهدف. أنشئ خطة بموعد جديد.',start:'تدرّب على الآية التالية',manualLog:'تسجيل جلسة خارج ALLIM',manualNote:'أؤكد أنني تدربت على هذا المقطع. هذا تسجيل شخصي دون تحقق بالميكروفون.',logged:'حُفظت الجلسة.',error:'تعذّر الحفظ. تحقّق من المقطع وإتاحة التخزين وعلامات التبويب الأخرى.',saved:'حُفظت الخطة.',history:'التسميع والكلمات التي تحتاج إلى مراجعة',historyIntro:'ملاحظة التعرّف الصوتي إشارة للمراجعة، وليست حكمًا على تلاوتك.',attempts:'المحاولات المسجلة',clean:'تسميع كامل دون تلميحات أو ملاحظات',hints:'التلميحات المستخدمة',due:'حان وقت المراجعة',dueEmpty:'تظهر مواعيد المراجعة بعد التدريب على التسميع.',difficult:'كلمات للمراجعة',difficultyEmpty:'لا توجد ملاحظات مسجلة من التعرّف الصوتي.',recent:'المحاولات الأخيرة',incomplete:'لم تكتمل',complete:'اكتملت',dismiss:'إزالة ملاحظة تعرّف صوتي غير صحيحة',undo:'إعادة الملاحظة',flagged:'كلمة عليها ملاحظة',test:'اختبار تسميع قصير',testIntro:'آيات عشوائية من السورة المختارة. سمّع الآية كاملة. تُسجّل التلميحات على حدة. يتحقق هذا من تسلسل الكلمات، دون أحكام التجويد أو الحركات.',questions:'عدد الأسئلة',beginTest:'بدء الاختبار',next:'السؤال التالي',skip:'تجاوز السؤال',end:'إنهاء الاختبار',testDone:'انتهى الاختبار',testResult:'تسميع كامل دون تلميحات أو ملاحظات',testRunning:'السؤال',testFinish:'اكتمل المقطع. انتقل إلى السؤال التالي.',testSkip:'تم التجاوز',testLimit:'يشمل الاختبار الآيات المتاحة في مجموعة النصوص المحلية الموثّقة فقط.',busy:'جارٍ فتح الآية…',backup:'تنزيل نسخة احتياطية',import:'استعادة نسخة احتياطية',confirmImport:'استبدال الخطط وسجل التسميع بهذه النسخة؟',invalid:'هذا الملف ليس نسخة احتياطية صالحة للتعلّم.',clear:'حذف الخطط والسجل',confirmClear:'حذف جميع خطط التعلّم وسجل التسميع في الملف الحالي؟',retained:'يُحسب تقدم الخطط من المحاولات المحفوظة.',practice:'تدريب على التسميع',testMode:'اختبار تسميع',notice:'لا يغيّر الاختبار عدّادات ٣٠٠ و٣٣ تكرارًا.',counts:'مرات',record:'تأكيد الجلسة',past:'تاريخ الجلسة',exportError:'تعذّر تنزيل النسخة الاحتياطية.'},
    ru:{title:'Мой план обучения',intro:'Выберите отрывок, проверьте себя по памяти и вернитесь к словам, которые требуют внимания.',add:'Создать план',surah:'Сура',from:'С аята',to:'По аят',action:'Занятие',read:'Чтение',memorize:'Запоминание',review:'Повторение',portion:'Аятов в день',deadline:'Завершить к дате · необязательно',save:'Сохранить план',remove:'Удалить план',confirmRemove:'Удалить план? История занятий сохранится.',local:'Без аккаунта планы остаются на устройстве. После входа новые планы и попытки сохраняются в аккаунте. Аудио не сохраняется.',empty:'Создайте первый план. Открытие аята не засчитывается как занятие.',today:'Сегодня',done:'Пройдено аятов',manual:'По вашей записи',expired:'Дата цели прошла. Создайте план с новой датой.',start:'Заняться следующим аятом',manualLog:'Записать занятие вне ALLIM',manualNote:'Подтверждаю, что занимался этим отрывком. Это личная запись без проверки микрофоном.',logged:'Занятие записано.',error:'Не удалось сохранить. Проверьте диапазон, доступ к хранилищу и другие открытые вкладки.',saved:'План сохранён.',history:'Проверка памяти и трудные слова',historyIntro:'Отметка распознавания — повод повторить слово, а не оценка качества чтения.',attempts:'Записано попыток',clean:'Полных чтений по памяти без подсказок и отметок',hints:'Использовано подсказок',due:'Пора повторить',dueEmpty:'Даты повторения появятся после чтения по памяти.',difficult:'Слова для повторения',difficultyEmpty:'Отметок распознавания пока нет.',recent:'Последние попытки',incomplete:'Не завершено',complete:'Завершено',dismiss:'Снять неверную отметку распознавания',undo:'Вернуть отметку',flagged:'Отмечено слово',test:'Короткая проверка памяти',testIntro:'Случайные аяты выбранной суры. Читайте аят целиком. Подсказки учитываются отдельно. Проверяем последовательность слов, без оценки таджвида и огласовок.',questions:'Вопросов',beginTest:'Начать проверку',next:'Следующий вопрос',skip:'Пропустить вопрос',end:'Завершить проверку',testDone:'Проверка завершена',testResult:'Полных чтений без подсказок и отметок',testRunning:'Вопрос',testFinish:'Отрывок завершён. Переходите к следующему вопросу.',testSkip:'Пропущено',testLimit:'Проверка охватывает только аяты проверенного локального корпуса.',busy:'Открываю аят…',backup:'Скачать резервную копию',import:'Восстановить копию',confirmImport:'Заменить планы и историю проверки памяти этой копией?',invalid:'Файл не является корректной резервной копией обучения.',clear:'Удалить планы и историю',confirmClear:'Удалить все планы обучения и историю проверки памяти в текущем профиле?',retained:'Прогресс планов рассчитывается по сохранённым попыткам.',practice:'Тренировка памяти',testMode:'Проверка памяти',notice:'Проверка не изменяет счётчики методик 300× и 33×.',counts:'раз',record:'Подтвердить занятие',past:'Дата занятия',exportError:'Не удалось скачать резервную копию.'}
  };
  let data, book=fresh(), ownerStamp=null, revision=0, versions=new Map(), failed=false, bridge, attempt=null, check=null, lastCheck=null, lastStatus='', busy=false, ready=false;
  const lang=()=>messages[document.documentElement.lang] ? document.documentElement.lang : 'en';
  const tr=k=>messages[lang()][k]||k;
  const num=n=>new Intl.NumberFormat(lang()).format(n);
  const fraction=(a,b)=>`\u2066${num(a)} / ${num(b)}\u2069`;
  const el=(tag,text,cls)=>{const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n;};
  const button=(text,fn,cls='secondary-button')=>{const b=el('button',text,cls); b.type='button'; b.onclick=fn; return b;};
  const status=key=>{lastStatus=key;document.querySelectorAll('[data-mj-status]').forEach(n=>n.textContent=tr(key));};
  const ref=(key,through)=>{const v=data.get(key), reference=key+(through?'–'+through.split(':')[1]:'');return v ? `${v.surah.names[lang()]} · \u2066${reference}\u2069` : reference;};
  const words=key=>String(data.get(key)?.verse.text||'').trim().split(/\s+/).filter(token=>/[\u0621-\u064A\u0671]/.test(token));
  const id=()=>root.crypto.randomUUID();
  async function read() {
    const n=revision, snapshot=await root.AllimStorage.snapshot();
    if(n!==revision)return;
    book=root.AllimLearning.journey(snapshot);
    versions=new Map((snapshot.canonical||snapshot.records).map(r=>[r.kind+'/'+r.id,r.version]));
    failed=false;render();
  }
  async function commit(next) {
    try {
      if(!ready)throw Error("owner_changed");
      validate(next,data);
      const intents=root.AllimLearning.journeyDiff(book,next).map(intent=>({...intent,base_version:versions.get(intent.kind+'/'+intent.id)||0}));
      revision++;book=next;render();
      await root.AllimStorage.mutateMany(intents,ownerStamp);
      await read();return true;
    }catch(_){failed=true;status('error');return false;}
  }
  function append(events) {return commit({...book,sessions:[...book.sessions,...events]});}
  function flush(complete=false) {
    if(!attempt || !attempt.observed && !attempt.hints) {attempt=null;return null;}
    const a=attempt; attempt=null;
    const record={id:id(),key:a.key,mode:a.mode,date:day(),recordedAt:new Date().toISOString(),complete,total:words(a.key).length,hints:a.hints,flags:Array.from(a.flags),dismissed:[],seconds:Math.min(86400,Math.round((Date.now()-a.start)/1000))};
    append([record]).catch(()=>status('error'));return record;
  }
  function begin(mode,key) {
    if(!ready || !data.has(key)) return;
    if(attempt && attempt.mode===mode && attempt.key===key) return;
    flush();attempt={key,mode,start:Date.now(),flags:new Set(),hints:0,observed:false};
  }
  function observe(mode,key,alignment,final) {
    if(!ready || !data.has(key))return;
    begin(check && mode==='memory' && check.keys[check.index]===key ? 'test' : mode,key);
    if(!attempt)return;
    attempt.observed=true;
    if(final) alignment.statuses.forEach((value,i)=>{if(value==='error' || value==='warning')attempt.flags.add(i);});
  }
  function hint(key,index) {
    begin(check && check.keys[check.index]===key ? 'test' : 'memory',key);
    if(attempt)attempt.hints=Math.min(words(key).length,attempt.hints+1);
  }
  function completed(mode,key,full=true) {
    const testing=!!check && mode==='memory' && check.keys[check.index]===key;
    begin(testing ? 'test' : mode,key);
    if(attempt)attempt.observed=true;
    const record=flush(full);
    if(testing){check.results[check.index]=record;check.finished=true;renderCheck();}
    return testing;
  }
  function range(form) {
    const s=Number(form.elements.surah.value),from=Number(form.elements.from.value),to=Number(form.elements.to.value);
    if(!int(from,1,300)||!int(to,from,300))throw Error('range');
    const keys=[];for(let a=from;a<=to;a++){const key=s+':'+a;if(!data.has(key))throw Error('range');keys.push(key);}return keys;
  }
  function formMarkup(manual) {
    return `<form data-mj-form="${manual?'manual':'plan'}" class="mj-form"><label><span data-mj-label="surah"></span><select name="surah" required></select></label><div class="mj-fields"><label><span data-mj-label="from"></span><input name="from" type="number" min="1" max="300" value="1" required></label><label><span data-mj-label="to"></span><input name="to" type="number" min="1" max="300" value="1" required></label></div><label><span data-mj-label="action"></span><select name="action"><option value="memorize" data-mj-label="memorize"></option><option value="review" data-mj-label="review"></option><option value="read" data-mj-label="read"></option></select></label>${manual?'<label><span data-mj-label="past"></span><input type="date" name="date" required></label><label class="mj-confirm"><input type="checkbox" name="confirmed" required><span data-mj-label="manualNote"></span></label>':'<div class="mj-fields"><label><span data-mj-label="portion"></span><input type="number" name="portion" min="1" max="50" value="3" required></label><label><span data-mj-label="deadline"></span><input name="deadline" type="date"></label></div>'}<button class="primary-button" type="submit" data-mj-label="${manual?'record':'save'}"></button></form>`;
  }
  function populate(form) {
    root.QuranCompanionData.surahs.forEach(s=>{const o=el('option',s.names[lang()]);o.value=s.id;form.elements.surah.append(o);});
    form.elements.surah.onchange=()=>{const s=root.QuranCompanionData.surahs.find(s=>s.id===Number(form.elements.surah.value));const a=s.verses[0].ayah,b=s.verses.at(-1).ayah;for(const field of ['from','to']){form.elements[field].min=a;form.elements[field].max=b;}form.elements.from.value=a;form.elements.to.value=b;};
    form.elements.surah.onchange();
    if(form.elements.date){form.elements.date.value=day();form.elements.date.max=day();}else form.elements.deadline.min=day();
    form.onsubmit=async e=>{
      e.preventDefault();if(busy)return;
      try{const keys=range(form),action=form.elements.action.value;
        if(form.dataset.mjForm==='manual'){
          const date=form.elements.date.value;if(!form.elements.confirmed.checked||!dateOK(date)||date>day())throw Error('date');
          const mode='manual-'+({read:'read',memorize:'memory',review:'review'}[action]);
          if(await append(keys.map(key=>({id:id(),key,mode,date,recordedAt:new Date().toISOString(),complete:true,total:words(key).length,hints:0,flags:[],dismissed:[],seconds:0})))){status('logged');form.elements.confirmed.checked=false;}
        }else{
          const deadline=form.elements.deadline.value,portion=Number(form.elements.portion.value);
          const plan={id:id(),action,keys,portion,created:day(),deadline};
          if(await commit({...book,plans:[...book.plans,plan]}))status('saved');
        }
      }catch(_){status('error');}
    };
  }
  async function open(key,mode) {
    if(busy)return false;busy=true;status('busy');
    try{flush();const ok=await bridge.open(key,mode);if(!ok)throw Error('open');status('');return true;}
    catch(_){status('error');return false;}finally{busy=false;renderCheck();}
  }
  function renderPlans() {
    const target=document.querySelector('[data-mj-plans]');target.replaceChildren();
    if(!book.plans.length){target.append(el('p',tr('empty'),'mj-note'));return;}
    book.plans.forEach(p=>{
      const s=progress(p,book.sessions,day()),card=el('article',undefined,'mj-plan');
      card.append(el('strong',`${tr(p.action)} · ${ref(p.keys[0],p.keys.at(-1))}`));
      card.append(el('p',`${tr('done')}: ${fraction(s.done,p.keys.length)} · ${tr('today')}: ${fraction(s.today,s.target)}`));
      const meter=el('progress');meter.max=p.keys.length;meter.value=s.done;meter.setAttribute('aria-label',tr('done'));card.append(meter);
      if(s.manual)card.append(el('small',`${tr('manual')}: ${num(s.manual)}`));
      if(p.deadline)card.append(el('small',new Intl.DateTimeFormat(lang()).format(new Date(p.deadline+'T12:00:00'))));
      if(s.expired)card.append(el('small',tr('expired')));
      const actions=el('div',undefined,'mj-actions');
      if(s.remaining.length)actions.append(button(tr('start'),()=>open(s.remaining[0],p.action==='read'?'read':'memory')));
      actions.append(button(tr('remove'),async()=>{if(root.confirm(tr('confirmRemove')))await commit({...book,plans:book.plans.filter(x=>x.id!==p.id)});},'text-button'));
      card.append(actions);target.append(card);
    });
  }
  function renderHistory() {
    const all=book.sessions, recalled=all.filter(s=>['memory','test'].includes(s.mode));
    const values={attempts:all.length,clean:recalled.filter(s=>s.complete&&!s.hints&&!flags(s).length).length,hints:all.reduce((n,s)=>n+s.hints,0)};
    const metrics=document.querySelector('[data-mj-metrics]');metrics.replaceChildren();
    Object.entries(values).forEach(([key,value])=>{const a=el('article');a.append(el('small',tr(key)),el('strong',num(value)));metrics.append(a);});
    const queue=document.querySelector('[data-mj-due]');queue.replaceChildren();const ready=due(all,day());
    if(!ready.length)queue.append(el('p',tr('dueEmpty'),'mj-note'));
    ready.slice(0,8).forEach(v=>queue.append(button(ref(v.key),()=>open(v.key,'memory'))));
    const list=document.querySelector('[data-mj-difficult]');list.replaceChildren();const difficulties=difficult(all);
    if(!difficulties.length)list.append(el('p',tr('difficultyEmpty'),'mj-note'));
    difficulties.slice(0,10).forEach(v=>{const row=el('div',undefined,'mj-word');const word=el('b',words(v.key)[v.index]);word.lang='ar';word.dir='rtl';row.append(word,button(`${ref(v.key)} · ${num(v.count)} ${tr('counts')}`,()=>open(v.key,'memory'),'text-button'));list.append(row);});
    const recent=document.querySelector('[data-mj-recent]');
    const opened=new Set(Array.from(recent.querySelectorAll('details[open]')).map(n=>n.dataset.sessionId));
    recent.replaceChildren();
    all.slice(-20).reverse().forEach(s=>{
      const row=el('details',undefined,'mj-session'),head=el('summary');
      row.dataset.sessionId=s.id;row.open=opened.has(s.id);
      head.textContent=`${ref(s.key)} · ${tr(s.mode.startsWith('manual-')?'manual':s.mode==='test'?'testMode':s.mode==='read'?'read':'practice')} · ${tr(s.complete?'complete':'incomplete')}`;
      row.append(head,el('small',`${new Intl.DateTimeFormat(lang()).format(new Date(s.date+'T12:00:00'))} · ${tr('hints')}: ${num(s.hints)}`));
      s.flags.forEach(index=>{
        const line=el('div',undefined,'mj-word'),word=el('b',words(s.key)[index]);word.lang='ar';word.dir='rtl';
        const dismissed=s.dismissed.includes(index);line.append(word,button(tr(dismissed?'undo':'dismiss'),()=>{const next={...s,dismissed:dismissed?s.dismissed.filter(i=>i!==index):[...s.dismissed,index]};commit({...book,sessions:book.sessions.map(x=>x.id===s.id?next:x)});},'text-button'));row.append(line);
      });
      recent.append(row);
    });
  }
  async function startCheck() {
    if(busy || check)return;
    const form=document.querySelector('[data-mj-test-form]'),s=Number(form.elements.surah.value);
    const keys=Array.from(data.keys()).filter(k=>Number(k.split(':')[0])===s);
    lastCheck=null;check={keys:sample(keys,Number(form.elements.count.value)),index:0,results:[],finished:false};
    if(!await open(check.keys[0],'memory'))check=null;
    renderCheck();
  }
  async function nextCheck() {
    if(!check || busy)return;
    bridge.stop();
    if(!check.finished){const record=flush(false);check.results[check.index]=record;}
    check.index++;check.finished=false;
    if(check.index>=check.keys.length){endCheck();return;}
    if(!await open(check.keys[check.index],'memory'))endCheck();
    renderCheck();
  }
  function endCheck() {
    if(!check)return;
    bridge.stop();flush(false);
    lastCheck={total:check.keys.length,ids:check.results.filter(Boolean).map(s=>s.id)};
    check=null;renderCheck();
  }
  function renderCheck() {
    const panel=document.querySelector('[data-mj-test-state]');if(!panel)return;
    const form=document.querySelector('[data-mj-test-form]');form.hidden=!!check;
    document.querySelector('[data-mj-test-actions]').hidden=!check;
    if(check){panel.textContent=`${tr('testRunning')} ${fraction(check.index+1,check.keys.length)} · ${ref(check.keys[check.index])} · ${tr(check.finished?'testFinish':'notice')}`;}
    else if(lastCheck){const clean=book.sessions.filter(s=>lastCheck.ids.includes(s.id)&&s.complete&&!s.hints&&!flags(s).length).length;panel.textContent=`${tr('testDone')} · ${tr('testResult')}: ${fraction(clean,lastCheck.total)}`;}
    else panel.textContent='';
    const next=document.querySelector('[data-mj-next]');next.textContent=tr(check?.finished?'next':'skip');next.disabled=busy;
    document.querySelector('[data-mj-end]').disabled=busy;
  }
  function render() {
    if(!ready)return;
    document.querySelectorAll('[data-mj-label]').forEach(n=>n.textContent=tr(n.dataset.mjLabel));
    document.querySelectorAll('[data-mj-form] select[name=surah], [data-mj-test-form] select[name=surah]').forEach(select=>Array.from(select.options).forEach(o=>o.textContent=root.QuranCompanionData.surahs.find(s=>s.id===Number(o.value)).names[lang()]));
    renderPlans();renderHistory();renderCheck();
    status(failed?'error':lastStatus);
  }
  function clear() {
    if(check)endCheck();attempt=null;lastCheck=null;
    return commit(fresh(),true);
  }
  async function init(config) {
    bridge=config;ownerStamp=root.AllimStorage.stamp();data=catalog(root.QuranCompanionData.surahs);await read();
    const panel=document.getElementById('allim-journey');
    if(!panel)return;
    panel.setAttribute('aria-labelledby','mj-plan-heading');
    panel.innerHTML='<h3 id="mj-plan-heading" data-mj-label="title"></h3><p class="mj-note" data-mj-label="intro"></p><div data-mj-plans></div><details><summary data-mj-label="add"></summary>'+formMarkup(false)+'</details><details><summary data-mj-label="manualLog"></summary>'+formMarkup(true)+'</details><p class="mj-note" data-mj-label="local"></p><p data-mj-status role="status" aria-live="polite"></p>';
    document.getElementById('allim-recall').setAttribute('aria-labelledby','mj-check-heading');
    document.getElementById('allim-recall').innerHTML='<h3 id="mj-check-heading" data-mj-label="test"></h3><p class="mj-note" data-mj-label="testIntro"></p><form data-mj-test-form class="mj-test-form"><label><span data-mj-label="surah"></span><select name="surah"></select></label><label><span data-mj-label="questions"></span><select name="count"><option>3</option><option selected>5</option><option>10</option></select></label><button type="submit" class="primary-button" data-mj-label="beginTest"></button></form><p data-mj-test-state role="status" aria-live="polite"></p><div data-mj-test-actions class="mj-actions" hidden><button type="button" class="primary-button" data-mj-next></button><button type="button" class="secondary-button" data-mj-end data-mj-label="end"></button></div><small class="mj-note" data-mj-label="testLimit"></small>';
    document.getElementById('allim-journey-history').setAttribute('aria-labelledby','mj-history-heading');
    document.getElementById('allim-journey-history').innerHTML='<h3 id="mj-history-heading" data-mj-label="history"></h3><p class="mj-note" data-mj-label="historyIntro"></p><div class="mj-metrics" data-mj-metrics></div><h4 data-mj-label="due"></h4><div class="mj-actions" data-mj-due></div><h4 data-mj-label="difficult"></h4><div data-mj-difficult></div><details><summary data-mj-label="recent"></summary><div data-mj-recent></div></details><p class="mj-note" data-mj-label="retained"></p><div class="mj-actions"><button type="button" class="secondary-button" data-mj-export data-mj-label="backup"></button><label class="mj-import"><span data-mj-label="import"></span><input type="file" accept="application/json,.json" data-mj-import></label><button type="button" class="text-button" data-mj-clear data-mj-label="clear"></button></div><p data-mj-status role="status" aria-live="polite"></p>';
    document.querySelectorAll('[data-mj-form]').forEach(populate);
    const form=document.querySelector('[data-mj-test-form]');root.QuranCompanionData.surahs.forEach(s=>{const o=el('option',s.names[lang()]);o.value=s.id;form.elements.surah.append(o);});form.elements.surah.value='112';
    form.onsubmit=e=>{e.preventDefault();startCheck().catch(()=>status('error'));};
    document.querySelector('[data-mj-next]').onclick=()=>nextCheck().catch(()=>status('error'));
    document.querySelector('[data-mj-end]').onclick=endCheck;
    document.querySelector('[data-mj-export]').onclick=()=>{try{const url=URL.createObjectURL(new Blob([JSON.stringify(book,null,2)],{type:'application/json'}));const link=el('a');link.href=url;link.download=`allim-learning-${day()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(_){status('exportError');}};
    document.querySelector('[data-mj-import]').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>16*1024*1024)throw Error('size');const next=validate(JSON.parse(await file.text()),data);for(const field of ['plans','sessions'])for(const item of next[field])if(!/^(?:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}|import:[a-f0-9]{64})$/.test(item.id))item.id='import:'+await root.AllimImport.hash(['learning-backup',field,item.id]);next.sessions.forEach((s,index)=>{if(!s.recordedAt&&!Number.isInteger(s.legacyOrder))s.legacyOrder=index;});if(root.confirm(tr('confirmImport'))){bridge.stop();check=null;lastCheck=null;attempt=null;if(await commit(next))status('saved');}}catch(_){status('invalid');}e.target.value='';};
    document.querySelector('[data-mj-clear]').onclick=()=>{if(root.confirm(tr('confirmClear')))clear();};
    new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    root.AllimStorage.subscribe((_,reason)=>{if(reason==='records')read().catch(()=>status('error'));if(reason==='owner'){attempt=null;check=null;ready=false;}});
    root.addEventListener('pagehide',()=>flush());
    ready=true;render();
  }
  root.ALLIMJourney={init,begin,observe,hint,completed,flush,clear,isChecking:()=>!!check,isCheck:key=>!!check && check.keys[check.index]===key,isCheckComplete:()=>!!check && check.finished,reset:()=>{if(attempt&&attempt.mode!=='read')flush();},navigate:view=>{flush();if(check&&view!=='memorize')endCheck();},changed:key=>{if(attempt&&attempt.key!==key)flush();if(check&&check.keys[check.index]!==key)endCheck();}};
}(typeof window!=='undefined'?window:globalThis));
