(function (root) {
  'use strict';
  const journal=root.AllimJournal, storage=root.AllimStorage, progress=root.AllimProgress;
  const strings={
    ru:{title:'Журнал чтения',current:'Текущий хатм',pages:'стр.',volume:'Всего прочитано, с повторами',today:'Сегодня',completed:'Завершено хатмов',details:'Открыть журнал',add:'Добавить чтение',edit:'Исправить',remove:'Удалить',removeConfirm:'Удалить эту запись журнала? Прочитанный объём будет пересчитан.',close:'Закрыть',empty:'Здесь появятся завершённые чтения. Чтение с бумаги можно добавить вручную.',source:'Источник',paper:'С бумаги',digital:'С экрана',mic:'Проверено в чтении',legacy:'Из прежнего журнала',manual:'Отмечено вручную',cycle:'Хатм',newCycle:'Начать новый хатм',newConfirm:'Начать новый хатм? Прежние записи останутся в журнале.',deadline:'Завершить к дате',saveGoal:'Сохранить цель',noDeadline:'Срок не задан',perDay:'Для цели в день',overdue:'Срок прошёл',past:'Хатмы до этого журнала',pastHelp:'Только хатмы, которых нет среди записей ниже.',savePast:'Сохранить число',date:'Дата чтения',range:'Прочитанный диапазон',pageRange:'Страницы',verseRange:'Аяты',keep:'Сохранить прежний диапазон',from:'От',to:'До',save:'Сохранить запись',invalid:'Проверьте дату и диапазон: страницы 1–604 или существующие аяты вида 2:1. Конец должен следовать за началом.',failure:'Не удалось сохранить. Введённые данные оставлены в форме; проверьте панель «Ваши данные».',count:'Записей',more:'Показать ещё',correction:'Исправление журнала не меняет результаты проверки чтения и хифза.',newEntry:'Новое чтение',editEntry:'Исправить запись',noActive:'Первый хатм',goalDone:'Цель выполнена',unique:'Без повторного учёта одних и тех же слов',dateFuture:'Дата чтения не может быть в будущем.'},
    en:{title:'Reading journal',current:'Current khatm',pages:'pages',volume:'Total read, including repeats',today:'Today',completed:'Completed khatms',details:'Open journal',add:'Add reading',edit:'Edit',remove:'Delete',removeConfirm:'Delete this journal entry? Reading volume will be recalculated.',close:'Close',empty:'Completed readings will appear here. You can add paper readings manually.',source:'Source',paper:'Paper',digital:'Screen',mic:'Accepted in reading',legacy:'From the earlier journal',manual:'Marked manually',cycle:'Khatm',newCycle:'Start a new khatm',newConfirm:'Start a new khatm? Earlier entries will remain in the journal.',deadline:'Finish by',saveGoal:'Save goal',noDeadline:'No deadline set',perDay:'Daily amount for this goal',overdue:'Deadline has passed',past:'Khatms before this journal',pastHelp:'Only khatms not represented by the entries below.',savePast:'Save count',date:'Reading date',range:'Read range',pageRange:'Pages',verseRange:'Verses',keep:'Keep the existing range',from:'From',to:'To',save:'Save entry',invalid:'Check the date and range: pages 1–604 or valid verses such as 2:1. The end must follow the start.',failure:'Could not save. Your input remains in this form; check Your data.',count:'Entries',more:'Show more',correction:'Journal corrections do not change reading assessment or memorization progress.',newEntry:'New reading',editEntry:'Edit entry',noActive:'First khatm',goalDone:'Goal completed',unique:'Each word counts once toward this khatm',dateFuture:'Reading date cannot be in the future.'},
    ar:{title:'سجل القراءة',current:'الختمة الحالية',pages:'صفحة',volume:'مجموع القراءة مع التكرار',today:'اليوم',completed:'الختمات المكتملة',details:'فتح السجل',add:'إضافة قراءة',edit:'تصحيح',remove:'حذف',removeConfirm:'حذف هذه القراءة من السجل؟ سيُعاد حساب المجموع.',close:'إغلاق',empty:'ستظهر القراءات المكتملة هنا. يمكنك إضافة القراءة من المصحف الورقي يدويًا.',source:'المصدر',paper:'مصحف ورقي',digital:'الشاشة',mic:'قراءة مقبولة',legacy:'من السجل السابق',manual:'أضيفت يدويًا',cycle:'الختمة',newCycle:'بدء ختمة جديدة',newConfirm:'بدء ختمة جديدة؟ تبقى القراءات السابقة في السجل.',deadline:'الإتمام قبل',saveGoal:'حفظ الهدف',noDeadline:'لم يُحدد موعد',perDay:'المقدار اليومي للهدف',overdue:'انتهى الموعد',past:'الختمات قبل هذا السجل',pastHelp:'فقط الختمات غير الممثلة في القراءات أدناه.',savePast:'حفظ العدد',date:'تاريخ القراءة',range:'النطاق المقروء',pageRange:'الصفحات',verseRange:'الآيات',keep:'الإبقاء على النطاق الحالي',from:'من',to:'إلى',save:'حفظ القراءة',invalid:'تحقق من التاريخ والنطاق: صفحات من 1 إلى 604 أو آيات صحيحة مثل 2:1. يجب أن تأتي النهاية بعد البداية.',failure:'تعذر الحفظ. بقيت البيانات في النموذج؛ تحقق من لوحة بياناتك.',count:'القراءات',more:'عرض المزيد',correction:'تصحيح السجل لا يغيّر نتائج التحقق من القراءة أو تقدم الحفظ.',newEntry:'قراءة جديدة',editEntry:'تصحيح القراءة',noActive:'الختمة الأولى',goalDone:'اكتمل الهدف',unique:'تُحسب كل كلمة مرة واحدة في هذه الختمة',dateFuture:'لا يمكن أن يكون تاريخ القراءة في المستقبل.'}
  };
  const t=key=>(strings[document.documentElement.lang]||strings.ru)[key]||key;
  const today=()=>progress.timing().local_date;
  const catalogue=()=>root.AllimAccountUI.catalogue;
  const fraction=value=>'\u2066'+number(value)+' / 604\u2069';
  const number=value=>new Intl.NumberFormat(document.documentElement.lang||'ru',{maximumFractionDigits:2}).format(value);
  const node=(tag,text,parent)=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;if(parent)parent.append(item);return item;};
  function working(host){const controls=[...host.querySelectorAll('button,input,select')].map(item=>[item,item.disabled]);for(const [item]of controls)item.disabled=true;return()=>{for(const [item,disabled]of controls)item.disabled=disabled;};}
  function button(text,parent,action){const item=node('button',text,parent);item.type='button';item.onclick=async()=>{const release=dialog?.open?working(dialog):()=>{};item.disabled=true;try{await action();}catch(_){if(dialog?.open)node('p',t('failure'),dialog);}finally{release();item.disabled=false;}};return item;}
  function input(form,name,label,type,value){const wrap=node('label',label,form),item=node('input',undefined,wrap);item.type=type;item.name=name;item.value=value??'';return item;}
  function select(form,name,label,options,value){const wrap=node('label',label,form),item=node('select',undefined,wrap);item.name=name;for(const [id,text]of options){const option=node('option',text,item);option.value=id;}item.value=value;return item;}
  const cycleOptions=data=>data.cycles.length?data.cycles.map((cycle,i)=>[cycle.id,t('cycle')+' '+(i+1)+' · '+fraction(cycle.current)]):[['',t('noActive')]];
  function goalText(data){if(!data.plan?.deadline)return t('noDeadline');if(data.remaining===0)return t('goalDone');return data.days>0?t('perDay')+': '+number(data.perDay)+' '+t('pages')+' · '+data.plan.deadline:t('overdue')+' · '+data.plan.deadline;}
  let dialog, dialogStamp, rendering=0, mounted=false;
  function close(){if(dialog){dialog.close();dialog.remove();dialog=null;}}
  function openShell(title,snapshot){close();dialogStamp={scope:snapshot.scope,generation:snapshot.generation};dialog=node('dialog',undefined,document.body);dialog.id='allim-journal-dialog';dialog.className='allim-personal-dialog';dialog.dir=document.documentElement.dir||'ltr';node('h2',title,dialog);button(t('close'),dialog,close);dialog.showModal();return dialog;}
  async function current(){const stamp=storage.stamp();await storage.chain;const snapshot=await storage.snapshot();if(!snapshot.scope||snapshot.scope!==stamp.scope||snapshot.generation!==stamp.generation)throw Error('storage_not_ready');return {snapshot,data:journal.summary(snapshot.records,catalogue(),today())};}
  function checkOwner(snapshot){const stamp=storage.stamp();if(snapshot.scope!==stamp.scope||snapshot.generation!==stamp.generation)throw Error('owner_changed');}
  function metrics(parent,data){
    const list=node('dl',undefined,parent);list.className='allim-journal-metrics';
    for(const [label,value]of [[t('current'),fraction(data.current)+' '+t('pages')],[t('volume'),number(data.volume)+' '+t('pages')],[t('today'),number(data.todayVolume)+' '+t('pages')],[t('completed'),number(data.lifetime)]]){node('dt',label,list);node('dd',value,list);}
    node('p',goalText(data),parent);
  }
  function rangeText(parts){return parts.map(part=>part.full?String(part.page):part.page+' ('+part.word_keys.join(', ')+')').join(', ');}
  async function show(){
    const {snapshot,data}=await current();const host=openShell(t('title'),snapshot);metrics(host,data);
    node('p',t('unique'),host);button(t('add'),host,()=>edit());
    const goals=node('form',undefined,host);goals.id='allim-journal-goal';
    const cycle=select(goals,'cycle',t('cycle'),cycleOptions(data),data.active?.id||data.cycles[0]?.id||'');
    const deadline=input(goals,'deadline',t('deadline'),'date',data.plan?.deadline||'');
    const saveGoal=node('button',t('saveGoal'),goals);saveGoal.type='submit';
    const feedback=node('p','',goals);feedback.setAttribute('role','status');
    goals.onsubmit=async event=>{event.preventDefault();if(deadline.value&&!journal.validDate(deadline.value)){feedback.textContent=t('invalid');return;}const release=working(host);try{checkOwner(snapshot);await storage.mutate({kind:'reading_plan',id:'current',base_version:snapshot.records.find(row=>row.kind==='reading_plan'&&row.id==='current')?.version||0,value:{cycle_id:cycle.value||null,deadline:deadline.value||null}});await show();}catch(_){feedback.textContent=t('failure');release();}};
    button(t('newCycle'),host,async()=>{if(!root.confirm(t('newConfirm')))return;checkOwner(snapshot);const id=crypto.randomUUID();await storage.mutateMany([{kind:'reading_cycle',id,value:{dataset_id:journal.DATASET}},{kind:'reading_plan',id:'current',base_version:snapshot.records.find(row=>row.kind==='reading_plan'&&row.id==='current')?.version||0,value:{cycle_id:id,deadline:null}}]);await show();});
    const pastForm=node('form',undefined,host);pastForm.id='allim-journal-past';const past=input(pastForm,'past',t('past'),'number',data.past);past.min='0';past.max='100000';past.step='1';node('small',t('pastHelp'),pastForm);const savePast=node('button',t('savePast'),pastForm);savePast.type='submit';
    const pastFeedback=node('p','',pastForm);pastForm.onsubmit=async event=>{event.preventDefault();if(!past.reportValidity())return;const release=working(host);try{checkOwner(snapshot);await storage.mutate({kind:'reading_past',id:'baseline',base_version:snapshot.records.find(row=>row.kind==='reading_past')?.version||0,value:{completed_cycles:Number(past.value)}});await show();}catch(_){pastFeedback.textContent=t('failure');release();}};
    node('h3',t('count')+': '+data.entries.length,host);node('p',t('correction'),host);
    if(!data.entries.length)node('p',t('empty'),host);
    const rows=[...data.entries].sort((a,b)=>b.value.local_date.localeCompare(a.value.local_date)||b.id.localeCompare(a.id));let limit=0;
    const list=node('div',undefined,host);list.className='allim-journal-entries';
    const more=button(t('more'),host,append);
    function append(){for(const row of rows.slice(limit,limit+30)){
      const card=node('article',undefined,list);card.dataset.entryId=row.id;
      node('strong',row.value.local_date+' · '+t(row.value.source),card);
      node('p',t('pages')+': '+rangeText(row.value.parts),card).className='allim-journal-range';
      node('small',t('cycle')+' '+(data.cycles.findIndex(cycle=>cycle.id===row.value.cycle_id)+1)+' · '+(row.value.evidence==='legacy_import'?t('legacy'):row.value.evidence==='self_reported'?t('manual'):t('mic')),card);
      button(t('edit'),card,()=>edit(row,snapshot));
      button(t('remove'),card,async()=>{if(!root.confirm(t('removeConfirm')))return;checkOwner(snapshot);await storage.mutate({kind:'reading_entry',id:row.id,action:'delete',base_version:row.version});await show();});
    }limit+=30;more.hidden=limit>=rows.length;}
    append();
  }
  async function edit(row=null,origin=null){
    const {snapshot,data}=await current();if(row&&origin&&(snapshot.scope!==origin.scope||snapshot.generation!==origin.generation))throw Error('owner_changed');const host=openShell(row?t('editEntry'):t('newEntry'),snapshot),form=node('form',undefined,host);form.id='allim-journal-entry';
    // Keep the version and coverage the user opened, even if another device edits meanwhile.
    const id=row?.id||crypto.randomUUID(),value=row?.value;
    const date=input(form,'date',t('date'),'date',value?.local_date||today());date.required=true;date.max=today();
    const cycle=select(form,'cycle',t('cycle'),cycleOptions(data),value?.cycle_id||data.active?.id||data.cycles[0]?.id||'');
    const mode=select(form,'range',t('range'),[...(row?[['keep',t('keep')]]:[]),['pages',t('pageRange')],['verses',t('verseRange')]],row?'keep':'pages');
    if(row)node('p',rangeText(value.parts),form).className='allim-journal-range';
    const from=input(form,'from',t('from'),'number','1'),to=input(form,'to',t('to'),'number','1');
    function rangeMode(){const pages=mode.value==='pages';for(const field of [from,to]){field.parentElement.hidden=mode.value==='keep';field.disabled=mode.value==='keep';field.required=mode.value!=='keep';field.type=pages?'number':'text';field.value=pages?'1':'1:1';field.dir='ltr';if(pages){field.min='1';field.max='604';field.step='1';}}}
    mode.onchange=rangeMode;rangeMode();
    const source=select(form,'source',t('source'),[['paper',t('paper')],['digital',t('digital')]],value?.source==='paper'?'paper':'digital');
    const feedback=node('p','',form);feedback.setAttribute('role','status');const save=node('button',t('save'),form);save.type='submit';
    form.onsubmit=async event=>{event.preventDefault();let parts;
      try{if(!journal.validDate(date.value)||date.value>today())throw Error('invalid_date');parts=mode.value==='keep'?value.parts:mode.value==='pages'?journal.pageParts(Number(from.value),Number(to.value)):journal.verseParts(catalogue(),from.value.trim(),to.value.trim());}catch(_){feedback.textContent=t('invalid');return;}
      const release=working(host);
      try{checkOwner(snapshot);await storage.mutate({kind:'reading_entry',id,base_version:row?.version||0,value:{cycle_id:cycle.value||null,local_date:date.value,source:source.value,evidence:'self_reported',parts}});await show();}
      catch(_){feedback.textContent=t('failure');release();}
    };
  }
  async function render(){
    const revision=++rendering;const snapshot=await storage.snapshot().catch(()=>null);if(revision!==rendering)return;
    if(dialogStamp&&(!snapshot?.scope||snapshot.scope!==dialogStamp.scope||snapshot.generation!==dialogStamp.generation))close();
    const hosts=[document.getElementById('allim-journal-summary'),document.getElementById('allim-journal-progress')].filter(Boolean);
    if(!snapshot?.scope){for(const host of hosts)host.replaceChildren();return;}
    const data=journal.summary(snapshot.records,catalogue(),today());
    for(const host of hosts){host.replaceChildren();node('strong',t('current')+': '+fraction(data.current)+' '+t('pages'),host);node('span',t('volume')+': '+number(data.volume)+' '+t('pages'),host);button(t('details'),host,show);}
  }
  async function mount(){if(mounted)return;mounted=true;await root.AllimAccountUI.ready;try{await root.AllimImport.migrateGuestJournal(storage,catalogue());}catch(error){storage.setError(error);}storage.subscribe(()=>render());new MutationObserver(()=>render()).observe(document.documentElement,{attributes:true,attributeFilter:['lang','dir']});await render();}
  root.AllimJournalUI={mount,show,edit,render};
})(window);
