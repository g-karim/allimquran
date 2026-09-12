(function (root) {
  'use strict';
  const stable = value => JSON.stringify(value, function (_, item) {
    return item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
  });
  async function fingerprint(book) { const bytes = new TextEncoder().encode(stable(book)); return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256', bytes))).map(n=>n.toString(16).padStart(2,'0')).join(''); }
  const empty = book => book.entries.length === 0 && book.past === 0 && book.cycle === 1 && !book.deadline;
  function controller(options) {
    let meta = options.load() || { user: null, revision: 0, base: null, pending: null, conflict: false };
    let running = false, remote = null;
    const emit = name => options.state(name, meta.user);
    function persist(next) { options.store(next); meta = next; }
    function check(result) {
      if (!result || typeof result.user !== 'string' || !Number.isInteger(result.revision) || result.revision < 0) throw Error('response');
      if (meta.user && meta.user !== result.user) throw Error('account');
    }
    async function upload(csrf) {
      const operation = meta.pending;
      const result = await options.request('save', { book: operation.book, revision: operation.revision, operation: operation.id, expected_user: meta.user }, csrf);
      check(result);
      if (result.status === 'conflict') { remote = result; persist({ ...meta, conflict: true, pending: null }); emit('conflict'); return false; }
      if (!['saved', 'replayed'].includes(result.status) || result.revision !== operation.revision + 1) throw Error('response');
      persist({ ...meta, revision: result.revision, base: await fingerprint(operation.book), pending: null, conflict: false });
      return true;
    }
    async function sync() {
      if (running) return; running = true; emit('working');
      try {
        const found = await options.request('load'); check(found); options.validate(found.book);
        if (!found.csrf) throw Error('response');
        remote = found;
        if (!meta.user) persist({ ...meta, user: found.user });
        if (meta.pending && !await upload(found.csrf)) return;
        // Re-read after a retry: the acknowledged revision may differ from the initial GET.
        const latest = meta.revision > found.revision ? await options.request('load') : found;
        check(latest); options.validate(latest.book); remote = latest;
        const local = options.getBook(), localText = stable(local), remoteText = stable(latest.book);
        const localDigest = await fingerprint(local), remoteDigest = await fingerprint(latest.book);
        if (stable(options.getBook()) !== localText) { emit('dirty'); return; }
        if (localText === remoteText) { persist({ ...meta, revision: latest.revision, base: localDigest, conflict: false }); emit('synced'); return; }
        if (meta.conflict) { emit('conflict'); return; }
        if ((meta.base !== null && localDigest === meta.base) || (meta.base === null && empty(local))) {
          if (!options.setBook(latest.book)) throw Error('storage');
          persist({ ...meta, revision: latest.revision, base: remoteDigest }); emit('synced'); return;
        }
        if ((meta.base === null && latest.revision !== 0) || (meta.base !== null && latest.revision !== meta.revision)) {
          persist({ ...meta, conflict: true }); emit('conflict'); return;
        }
        persist({ ...meta, pending: { id: options.id(), revision: latest.revision, book: JSON.parse(localText) } });
        if (await upload(latest.csrf)) emit(await fingerprint(options.getBook()) === meta.base ? 'synced' : 'dirty');
      } catch (error) { emit(error.message === 'account' ? 'account' : 'offline'); }
      finally { running = false; }
    }
    async function acceptRemote() {
      if (running) return; running = true; emit('working');
      try {
        const found = await options.request('load'); check(found); options.validate(found.book);
        // Keep a durable recovery copy before replacing local history.
        const remoteDigest = await fingerprint(found.book);
        options.backup(options.getBook());
        if (!options.setBook(found.book)) throw Error('storage');
        persist({ user: found.user, revision: found.revision, base: remoteDigest, pending: null, conflict: false }); remote = found; emit('synced');
      } catch (error) { emit(error.message === 'account' ? 'account' : 'offline'); }
      finally { running = false; }
    }
    return { sync, acceptRemote, disconnect: () => { if(running)return false;try{persist({user:null,revision:0,base:null,pending:null,conflict:false});emit('local');return true;}catch(_){emit('offline');return false;} }, linked: () => Boolean(meta.user), busy: () => running, changed: () => emit(meta.conflict ? 'conflict' : 'dirty') };
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { controller, stable }; return; }
  const copy = {
    ru: { title:'История в аккаунте', sync:'Синхронизировать с аккаунтом', use:'Сохранить местную копию и загрузить историю аккаунта', recovery:'Скачать сохранённую местную копию', local:'Пока только в этом браузере. Войдите в ALLIM и включите синхронизацию.', synced:'История сохранена в аккаунте.', dirty:'Есть изменения в этом браузере, ожидающие синхронизации.', working:'Синхронизация…', offline:'Синхронизация недоступна. Местная история сохранена. Проверьте вход в аккаунт и соединение; повторите попытку.', account:'В браузере открыт другой аккаунт. Синхронизация остановлена, история не перенесена. Войдите в связанный аккаунт.', conflict:'На устройствах есть разные изменения. Автоматическая замена остановлена. Можно сохранить местную копию и загрузить историю аккаунта.', confirm:'Текущая история будет сохранена как отдельная местная резервная копия, затем заменена историей аккаунта. Продолжить?', linked:'Связанный аккаунт', caveat:'После подключения новые записи отправляются автоматически при доступном соединении. При конфликте обе версии сохраняются.' },
    en: { title:'Account history', sync:'Sync with account', use:'Keep a local backup and load account history', recovery:'Download preserved local copy', local:'Stored only in this browser. Sign in to ALLIM and enable sync.', synced:'History saved to your account.', dirty:'Local changes are waiting to sync.', working:'Syncing…', offline:'Sync is unavailable. Your local history is safe. Check your sign-in and connection, then retry.', account:'A different account is signed in. Sync stopped without transferring history. Sign in to the linked account.', conflict:'Devices have different changes. Automatic replacement stopped. Keep a local backup and load account history to continue.', confirm:'Your current history will be preserved as a separate local backup, then replaced with account history. Continue?', linked:'Linked account', caveat:'After connecting, new entries sync automatically when online. Conflicting versions are preserved.' },
    ar: { title:'السجل في الحساب', sync:'مزامنة مع الحساب', use:'حفظ نسخة محلية وتحميل سجل الحساب', recovery:'تنزيل النسخة المحلية المحفوظة', local:'محفوظ في هذا المتصفح فقط. سجّل دخولك إلى ALLIM وفعّل المزامنة.', synced:'حُفظ السجل في حسابك.', dirty:'هناك تغييرات محلية تنتظر المزامنة.', working:'جارٍ المزامنة…', offline:'المزامنة غير متاحة. سجلك المحلي محفوظ. تحقق من تسجيل الدخول والاتصال، ثم أعد المحاولة.', account:'تم تسجيل الدخول بحساب آخر. توقفت المزامنة دون نقل السجل. سجّل الدخول بالحساب المرتبط.', conflict:'توجد تغييرات مختلفة على الأجهزة. أُوقفت الاستبدالات التلقائية. يمكنك حفظ نسخة محلية ثم تحميل سجل الحساب.', confirm:'سيُحفظ سجلك الحالي كنسخة احتياطية محلية منفصلة، ثم يُستبدل بسجل الحساب. هل تريد المتابعة؟', linked:'الحساب المرتبط', caveat:'بعد الربط، تُزامَن القراءات الجديدة تلقائيًا عند توفر الاتصال. تُحفظ النسختان عند التعارض.' }
  };
  const key='allim-reading-sync-v1', recoveryKey='allim-reading-recovery-v1';
  let api, host, timer, last='local', user='', applying=false;
  const t=k=>(copy[document.documentElement.lang] || copy.en)[k];
  function draw() {
    if(!host)return;
    host.querySelectorAll('[data-sync-text]').forEach(n=>n.textContent=t(n.dataset.syncText));
    host.querySelector('[data-sync-state]').textContent=t(last)+(user ? ' '+t('linked')+': '+user : '');
    host.querySelector('[data-sync-use]').hidden=last!=='conflict';
    host.querySelector('[data-sync-run]').disabled=last==='working';
    host.querySelector('[data-sync-use]').disabled=last==='working';
    try {const list=JSON.parse(localStorage.getItem(recoveryKey)||'[]');host.querySelector('[data-sync-recovery]').hidden=!list.length;const select=host.querySelector('[data-sync-backups]');const selected=select.value;select.replaceChildren();list.forEach((item,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=new Date(item.savedAt).toLocaleString(document.documentElement.lang);select.append(option);});if(selected)select.value=selected;select.hidden=!list.length;select.setAttribute('aria-label',t('recovery'));}catch(_){}
  }
  async function request(method,data,csrf) {
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch('/api/method/allimquran.reading_journal.'+method,{method:method==='load'?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json',...(data?{'Content-Type':'application/json','X-Frappe-CSRF-Token':csrf}:{})},...(data?{body:JSON.stringify(data)}:{})});
      if(!response.ok)throw Error('network');
      const value=await response.json();return value.message;
    } finally {clearTimeout(timeout);}
  }
  function init(config) {
    host=document.getElementById('reading-account-sync'); if(!host)return;
    host.innerHTML='<h4 data-sync-text="title"></h4><p role="status" aria-live="polite" data-sync-state></p><div class="journal-actions"><button class="secondary-button" type="button" data-sync-run data-sync-text="sync"></button><button class="secondary-button" type="button" data-sync-use data-sync-text="use" hidden></button><select data-sync-backups hidden></select><button class="secondary-button" type="button" data-sync-recovery data-sync-text="recovery" hidden></button></div><p class="journal-note" data-sync-text="caveat"></p>';
    try {
      api=controller({load:()=>JSON.parse(localStorage.getItem(key)||'null'),store:value=>localStorage.setItem(key,JSON.stringify(value)),backup:book=>{const list=JSON.parse(localStorage.getItem(recoveryKey)||'[]');list.push({savedAt:new Date().toISOString(),book});localStorage.setItem(recoveryKey,JSON.stringify(list));},getBook:config.getBook,validate:config.validate,setBook:book=>{applying=true;try{return config.setBook(book);}finally{applying=false;}},id:()=>crypto.randomUUID(),request,state:(name,owner)=>{last=name;user=owner||'';draw();if(name==='dirty'&&api&&api.linked()){clearTimeout(timer);timer=setTimeout(()=>api.sync(),800);}}});
    } catch(_) {last='offline';draw();return;}
    host.querySelector('[data-sync-run]').onclick=()=>api.sync();
    host.querySelector('[data-sync-use]').onclick=()=>{if(confirm(t('confirm')))api.acceptRemote();};
    host.querySelector('[data-sync-recovery]').onclick=()=>{
      const list=JSON.parse(localStorage.getItem(recoveryKey)||'[]');const chosen=list[Number(host.querySelector('[data-sync-backups]').value)];if(!chosen)return;const saved=JSON.stringify(chosen.book);
      const url=URL.createObjectURL(new Blob([saved],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='allim-reading-recovery.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    new MutationObserver(draw).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    root.addEventListener('online',()=>{if(api.linked())api.sync();});
    draw(); if(api.linked())api.sync();
  }
  function changed() {if(!api||applying)return;api.changed();clearTimeout(timer);if(api.linked())timer=setTimeout(()=>api.sync(),800);}
  root.ALLIMReadingSync={init,changed,disconnect:()=>{clearTimeout(timer);return !api||api.disconnect();}};
}(typeof window!=='undefined'?window:globalThis));
