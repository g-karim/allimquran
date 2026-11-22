(function (root) {
  'use strict';
  const model = root.AllimHeartReview, storage = root.AllimStorage;
  const messages = {
    ru: {title:'Коран в сердце · каждый день', intro:'После семи дней без повторения проявленность постепенно уменьшается. Достижения и история остаются. Это напоминание вернуться, а не утверждение, что вы забыли аят.', open:'Маршрут на сегодня', close:'Закрыть', review:'Сохранить выученное', hafiz:'Я хафиз: повторять весь Коран', cycle:'Полный круг повторения, дней', khatm:'Чтение для хатма', month:'Один хатм за месяц', ramadan:'Два хатма за Рамадан', start:'Дата начала хатма', ramadanDays:'Дней в Рамадане', save:'Сохранить план', settings:'Настроить маршрут', due:'Пора вернуться к повторению', empty:'На сегодня повторение завершено или пока нет заученных аятов. Начните собирать Коран в сердце.', read:'Открыть', repeat:'Повторить', markReview:'Повторил · самоотчёт', markRead:'Прочитал · самоотчёт', pages:'Страницы', cycleLabel:'Хатм', done:'Выполнено', remaining:'Осталось страниц', deadline:'До', noPlan:'Выберите месяц или Рамадан, чтобы распределить чтение по дням.', error:'Не удалось сохранить. Проверьте соединение и состояние хранения данных.', saved:'План сохранён.', changed:'Новый срок или режим начинает отдельный план. Предыдущие записи и достижения сохраняются.', evidence:'Отметка самостоятельного повторения не является проверкой учителя. Проверка слов доступна в тренировке по памяти; таджвид оценивает преподаватель.', expired:'Срок плана завершён. Сохранённые чтения остаются в журнале. Задайте новый срок для следующего хатма.', future:'Маршрут начнётся в выбранную дату.', planned:'Сегодня по плану', self:'Самоотчёт', recorded:'Сохранённый прогресс', aligned:'Проверка слов', unknown:'Нет даты повторения', last:'Последнее повторение', readingNote:'Чтение и повторение учитываются отдельно. Одну выполненную практику можно отметить в обоих разделах, если вы действительно выполнили обе задачи.', day:'дн.', todayDone:'Сегодня выполнено', loading:'Загружаем маршрут…'},
    en: {title:'Quran in your heart · every day', intro:'After seven days without review, the revealed text gradually fades. Achievements and history remain. This is a reminder to return, not a claim that you forgot an ayah.', open:'Today’s route', close:'Close', review:'Keep what you have learned', hafiz:'I am a hafiz: review the whole Quran', cycle:'Full review cycle, days', khatm:'Reading for khatm', month:'One khatm in a month', ramadan:'Two khatms in Ramadan', start:'Khatm start date', ramadanDays:'Days in Ramadan', save:'Save plan', settings:'Plan settings', due:'Ready for review', empty:'Today’s review is complete, or there are no learned ayahs yet. Start collecting the Quran in your heart.', read:'Open', repeat:'Review', markReview:'Reviewed · self-report', markRead:'Read · self-report', pages:'Pages', cycleLabel:'Khatm', done:'Completed', remaining:'Pages remaining', deadline:'By', noPlan:'Choose a month or Ramadan plan to distribute your reading.', error:'Could not save. Check your connection and storage status.', saved:'Plan saved.', changed:'Changing the date or mode starts a separate plan. Earlier records and achievements remain.', evidence:'Self-reported review is not a teacher assessment. Word checking is available in memory practice; tajwid needs a teacher.', expired:'This plan has ended. Your reading records remain in the journal. Choose new dates for your next khatm.', future:'The route begins on the selected date.', planned:'Planned today', self:'Self-report', recorded:'Saved progress', aligned:'Word check', unknown:'Review date unknown', last:'Last reviewed', readingNote:'Reading and review are tracked separately. Mark both only when you have actually completed both activities.', day:'days', todayDone:'Completed today', loading:'Loading your route…'},
    ar: {title:'القرآن في قلبك · كل يوم', intro:'بعد سبعة أيام دون مراجعة، يبدأ وضوح النص بالتلاشي تدريجيًا. تبقى إنجازاتك وسجلك محفوظين. هذا تذكير بالمراجعة، وليس حكمًا بأنك نسيت الآية.', open:'ورد اليوم', close:'إغلاق', review:'تعاهد ما حفظت', hafiz:'أنا حافظ: أراجع القرآن كاملًا', cycle:'مدة دورة المراجعة بالأيام', khatm:'ورد الختمة', month:'ختمة في شهر', ramadan:'ختمتان في رمضان', start:'تاريخ بدء الختمة', ramadanDays:'عدد أيام رمضان', save:'حفظ الخطة', settings:'إعداد الورد', due:'حان وقت المراجعة', empty:'أكملت مراجعة اليوم، أو لم تُسجّل آيات محفوظة بعد. ابدأ بجمع القرآن في قلبك.', read:'فتح', repeat:'مراجعة', markReview:'راجعت · تسجيل ذاتي', markRead:'قرأت · تسجيل ذاتي', pages:'الصفحات', cycleLabel:'الختمة', done:'المكتمل', remaining:'الصفحات المتبقية', deadline:'حتى', noPlan:'اختر خطة شهرية أو خطة رمضان لتوزيع القراءة على الأيام.', error:'تعذّر الحفظ. تحقق من الاتصال وحالة حفظ البيانات.', saved:'حُفظت الخطة.', changed:'تغيير التاريخ أو نوع الخطة يبدأ خطة مستقلة، مع الاحتفاظ بالسجلات والإنجازات السابقة.', evidence:'التسجيل الذاتي ليس تقييمًا من معلّم. تتاح مطابقة الكلمات في تدريب التسميع، ويقيّم المعلّم أحكام التجويد.', expired:'انتهت مدة الخطة، وسجل القراءة محفوظ. حدد موعدًا جديدًا للختمة التالية.', future:'يبدأ الورد في التاريخ المحدد.', planned:'ورد اليوم', self:'تسجيل ذاتي', recorded:'تقدّم محفوظ', aligned:'مطابقة الكلمات', unknown:'تاريخ المراجعة غير معروف', last:'آخر مراجعة', readingNote:'تُسجّل القراءة والمراجعة منفصلتين. يمكنك تسجيل النشاط في القسمين إذا أنجزت المهمتين فعلًا.', day:'أيام', todayDone:'اكتمل ورد اليوم', loading:'جارٍ إعداد الورد…'}
  };
  const lang = () => messages[document.documentElement.lang] ? document.documentElement.lang : 'en';
  const t = key => messages[lang()][key];
  const num = n => new Intl.NumberFormat(lang()==='ar'?'ar-u-nu-arab':lang()).format(n);
  const date = d => new Intl.DateTimeFormat(lang()==='ar'?'ar-u-ca-gregory-nu-arab':lang(), {dateStyle:'medium'}).format(new Date(d + 'T12:00:00Z'));
  function node(tag, text, host, className) {const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; if (host) host.append(el); return el;}
  function button(label, host, action) {const b=node('button',label,host,'secondary-button'); b.type='button'; b.onclick=action; return b;}
  let bridge, dialog, opener, snapshot, data, revision=0, busy=false, editing=false, message='';
  function owner(s) {const now=storage.stamp(); if (s.scope!==now.scope || s.generation!==now.generation || s.expectedStamp.session_binding!==now.session_binding) throw Error('owner_changed');return s.expectedStamp;}
  const planOf = s => s.records.find(r=>r.kind==='devotional_plan' && r.id==='current' && !r.deleted);
  async function write(intents, origin) {
    if (busy) return; busy=true; editing=false;
    dialog.querySelectorAll('button,input,select').forEach(e=>e.disabled=true);
    try {await storage.mutateMany(intents, owner(origin)); message='';}
    catch (_) {message='error';}
    finally {busy=false; if(message==='error'){dialog.querySelectorAll('button,input,select').forEach(e=>e.disabled=false);dialog.querySelector('[role=status]').textContent=t('error');editing=true;}else await render();}
  }
  function reviewRecord(value) {return {kind:'heart_review',id:crypto.randomUUID(),value:{...value,recorded_at:new Date().toISOString(),local_date:model.localDay(),evidence:'self_reported'}};}
  async function render() {
    if (!bridge || busy) return;
    const ticket=++revision;
    try {
      await storage.chain;
      const stamp=storage.stamp(); const s=await storage.snapshot(); if(ticket!==revision)return; s.expectedStamp=stamp; owner(s);
      if(!s.scope) {dialog?.close(); return;}
      if(snapshot && (s.scope!==snapshot.scope || s.generation!==snapshot.generation)) dialog?.close();
      snapshot=s;
      const state=bridge.state(); data=model.project(s.records,bridge.catalogue(),state.heartMushaf);
      const plan=planOf(s)?.value, today=model.localDay(), review=model.reviewRoute(data,plan,today);
      document.querySelectorAll('[data-daily-practice]').forEach(host=>{
        host.replaceChildren(); node('strong',t('title'),host); node('p',t('intro'),host);
        const count=review.keys.length+review.ranges.reduce((n,r)=>n+r.last-r.first+1,0);
        const b=button(t('open')+(count?' · '+num(count):''),host,()=>{opener=b; show();});
      });
      if(dialog?.open && !editing) contents(plan,review,today,s);
    } catch (_) {if(dialog?.open) dialog.querySelector('[role=status]').textContent=t('error');}
  }
  function show() {
    if(!dialog) {
      dialog=node('dialog',undefined,document.body,'allim-daily-dialog'); dialog.id='allim-daily-dialog';
      dialog.setAttribute('aria-labelledby','daily-practice-title');
      dialog.addEventListener('close',()=>{editing=false; const target=[...document.querySelectorAll('[data-daily-practice] button')].find(b=>b.getBoundingClientRect().width);(target||opener)?.focus();});
    }
    dialog.replaceChildren(); node('p',t('loading'),dialog).setAttribute('role','status'); dialog.showModal(); render();
  }
  function contents(plan,review,today,origin) {
    dialog.dir=lang()==='ar'?'rtl':'ltr'; dialog.replaceChildren();
    const head=node('header',undefined,dialog); node('h2',t('title'),head).id='daily-practice-title'; button(t('close'),head,()=>dialog.close());
    const status=node('p',message?t(message):'',dialog); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    node('p',t('intro'),dialog,'daily-note');
    const grid=node('div',undefined,dialog,'daily-route-grid');
    const left=node('section',undefined,grid,'daily-route-card'); node('h3',t('review'),left);
    node('p',t('evidence'),left,'daily-note');
    if(!review.keys.length && !review.ranges.length) node('p',t(plan?.hafiz || Object.values(data.earned).some(n=>n>0) ? 'todayDone' : 'empty'),left);
    for(const key of review.keys) {
      const card=node('article',undefined,left,'daily-portion'); node('strong',bridge.reference(key),card);
      const last=data.verses[key]; node('small',last?t('last')+': '+date(model.localDay(new Date(last.at)))+' · '+t(last.evidence==='self_reported'?'self':last.evidence==='client_alignment'?'aligned':'recorded'):t('unknown'),card);
      button(t('repeat'),card,()=>go(key,false));
      button(t('markReview'),card,()=>write([reviewRecord({verse_key:key})],origin));
    }
    for(const range of review.ranges) {
      const card=rangeCard(left,range); button(t('repeat'),card,()=>go(range.first,true));
      button(t('markReview'),card,()=>write([reviewRecord({first_page:range.first,last_page:range.last})],origin));
    }
    const right=node('section',undefined,grid,'daily-route-card'); node('h3',t('khatm'),right); node('p',t('readingNote'),right,'daily-note');
    if(!plan) node('p',t('noPlan'),right);
    else {
      const route=model.khatmRoute(plan,origin.records,bridge.catalogue(),today);
      node('p',t('done')+': '+num(route.completed)+' / '+num(604*plan.cycle_ids.length)+' · '+t('deadline')+' '+date(route.end),right);
      if(route.expired) node('p',t('expired'),right);
      if(today<plan.khatm_start) node('p',t('future'),right);
      if(!route.remaining) node('p',t('done')+' ✓',right);
      else if(!route.ranges.length && !route.expired && today>=plan.khatm_start) node('p',t('todayDone')+' ✓ · '+t('remaining')+': '+num(route.remaining),right);
      for(const range of route.ranges) {
        const card=rangeCard(right,range); node('small',t('cycleLabel')+' '+num(plan.cycle_ids.indexOf(range.cycle)+1),card);
        button(t('read'),card,()=>go(range.first,true,range.cycle));
        button(t('markRead'),card,()=>write([{kind:'reading_entry',id:crypto.randomUUID(),value:{cycle_id:range.cycle,local_date:today,source:'digital',evidence:'self_reported',parts:root.AllimJournal.pageParts(range.first,range.last)}}],origin));
      }
    }
    const settings=node('details',undefined,dialog); settings.open=!plan; node('summary',t('settings'),settings);
    node('p',t('changed'),settings,'daily-note'); const form=node('form',undefined,settings,'daily-plan-form'); form.addEventListener('input',()=>{editing=true;});
    const field=(label,tag,type)=>{const box=node('label',undefined,form); node('span',t(label),box); const input=node(tag,undefined,box); if(type)input.type=type;return input;};
    const hafiz=field('hafiz','input','checkbox'); hafiz.checked=!!plan?.hafiz;
    const days=field('cycle','select'); [7,15,30].forEach(n=>days.add(new Option(num(n),n))); days.value=plan?.review_days||30;
    const mode=field('khatm','select'); ['month','ramadan'].forEach(v=>mode.add(new Option(t(v),v)));mode.value=plan?.khatm_mode||'month';
    const start=field('start','input','date');start.required=true;start.value=plan?.khatm_start||today;
    const ramadan=field('ramadanDays','select');[29,30].forEach(n=>ramadan.add(new Option(num(n),n)));ramadan.value=plan?.ramadan_days||30;
    mode.onchange=()=>{ramadan.closest('label').hidden=mode.value!=='ramadan';};mode.onchange();
    const submit=node('button',t('save'),form,'primary-button');submit.type='submit';
    form.onsubmit=event=>{
      event.preventDefault();if(!form.reportValidity())return;
      const changed=!plan || plan.khatm_mode!==mode.value || plan.khatm_start!==start.value || (mode.value==='ramadan' && plan.ramadan_days!==+ramadan.value);
      const ids=changed?Array.from({length:mode.value==='ramadan'?2:1},()=>crypto.randomUUID()):plan.cycle_ids;
      const value={hafiz:hafiz.checked,review_start:plan?.review_start||today,review_days:+days.value,khatm_mode:mode.value,khatm_start:start.value,ramadan_days:+ramadan.value,cycle_ids:ids};
      const intents=changed?ids.map(id=>({kind:'reading_cycle',id,value:{dataset_id:root.AllimJournal.DATASET}})):[];
      if(changed) intents.push({kind:'reading_plan',id:'current',base_version:origin.records.find(r=>r.kind==='reading_plan'&&r.id==='current')?.version||0,value:{cycle_id:ids[0],deadline:model.planEnd(value)}});
      intents.push({kind:'devotional_plan',id:'current',base_version:planOf(origin)?.version||0,value});
      write(intents,origin);
    };
  }
  function rangeCard(host,range) {const card=node('article',undefined,host,'daily-portion');node('strong',t('pages')+' '+num(range.first)+'–'+num(range.last),card);return card;}
  async function go(value,page,cycle) {
    const origin=snapshot;if(busy)return;busy=true;
    try {const stamp=owner(origin);
      if(cycle) await storage.mutateMany([{kind:'reading_plan',id:'current',base_version:origin.records.find(r=>r.kind==='reading_plan'&&r.id==='current')?.version||0,value:{cycle_id:cycle,deadline:model.planEnd(planOf(origin).value)}}],stamp);
      owner(origin);dialog.close();await bridge.open(value,page);
    } catch (_) {message='error';if(!dialog.open)show();} finally {busy=false;await render();}
  }
  function mount(adapter) {
    bridge=adapter; storage.subscribe((_,reason)=>{if(reason==='owner'){dialog?.close();snapshot=null;}if(reason==='owner'||reason==='records')render();});
    new MutationObserver(()=>render()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    root.addEventListener('focus',()=>render());
    root.setInterval(()=>{if(!document.hidden)render();},60000);
    render(); return {render,close:()=>dialog?.close()};
  }
  root.AllimDailyPractice={mount};
})(window);
