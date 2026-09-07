(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const labels = {pending:"Новая",draft:"Черновик",reviewed:"Проверена",disputed:"Спорная",adjudicated:"Согласована повторно"};
  const kinds = {substitution:"Замена слова",omission:"Пропуск",insertion:"Лишнее слово",order:"Порядок слов",letter:"Буква / махрадж",vowel:"Огласовка",tajwid:"Таджвид"};
  let selected = null, offset = 0, generation = 0, queueGeneration = 0, blobUrl = null, dirty = false, busy = false;
  const apiRoot = "/api/method/allimquran.review_portal.";
  function notice(message, error = false) { $("notice").textContent = message; $("notice").dataset.error = String(error); }
  async function api(method, data = {}, post = false) {
    const response = await fetch(apiRoot + method + (post ? "" : "?" + new URLSearchParams(data)), {
      credentials:"same-origin", cache:"no-store", method:post ? "POST" : "GET",
      headers:post ? {"Content-Type":"application/json","X-Frappe-CSRF-Token":document.querySelector('meta[name="csrf-token"]').content} : {},
      ...(post ? {body:JSON.stringify(data)} : {})
    });
    if (method === "audio" && response.ok) return response.blob();
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.message?.error) {
      const error = new Error(body.message?.error || (response.status === 403 || response.status === 401 ? "Доступ закрыт. Войдите с аккаунтом проверяющего." : "Не удалось выполнить запрос. Попробуйте ещё раз."));
      error.status = response.status; throw error;
    }
    return body.message;
  }
  function releaseAudio() {
    $("player").pause(); $("player").removeAttribute("src"); $("player").load();
    if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = null;
  }
  function clearSelection() {
    generation++; releaseAudio(); selected = null; dirty = false;
    $("review-form").reset(); $("errors").replaceChildren(); $("word-guide").textContent = "";
    $("review-form").hidden = true; $("empty").hidden = false;
  }
  function handleError(error) {
    if ([401,403,404].includes(error.status)) { clearSelection(); $("queue-list").replaceChildren(); }
    notice(error.message, true);
  }
  function canLeave() { return !dirty || window.confirm("Есть несохранённая разметка. Закрыть её без сохранения?"); }
  async function loadQueue() {
    const ticket = ++queueGeneration;
    try {
      const data = await api("queue", {status:$("status").value,offset});
      if (ticket !== queueGeneration) return;
      $("counts").textContent = Object.entries(data.counts).map(([key,count]) => labels[key]+": "+count).join(" · ");
      $("queue-list").replaceChildren();
      if (!data.items.length) { const p = document.createElement("p"); p.className="muted"; p.textContent="В этом разделе пока нет записей."; $("queue-list").append(p); }
      for (const item of data.items) {
        const button = document.createElement("button"); button.type="button"; button.className="queue-item"; button.dataset.id=item.id;
        button.setAttribute("aria-current",String(item.id===selected?.id));
        button.append(document.createTextNode("Аят "+(item.verse_key||"не указан")));
        const detail = document.createElement("small"); detail.textContent=Number(item.duration_seconds).toFixed(1)+" с · "+item.id.slice(0,8); button.append(detail);
        button.addEventListener("click",()=>{if (!busy && canLeave()) openClip(item.id);}); $("queue-list").append(button);
      }
      $("previous").disabled=offset===0; $("next").disabled=offset+data.page_size>=data.counts[$("status").value];
      $("page-number").textContent=String(Math.floor(offset/data.page_size)+1);
    } catch(error) { if(ticket===queueGeneration) handleError(error); }
  }
  function wordGuide() {
    $("word-guide").textContent=$("expected").value.trim().split(/\s+/).filter(Boolean).map((word,index)=>(index+1)+": "+word).join(" · ");
  }
  function addError(error = {}) {
    const row=document.createElement("div"); row.className="error-row";
    const grid=document.createElement("div"); grid.className="error-grid"; row.append(grid);
    for (const [key,label,type,value] of [
      ["kind","Тип","select",error.kind||"substitution"], ["word_index","Слово №","number",(error.word_index??0)+1],
      ["start_ms","От, с","number",(error.start_ms??Math.round($("player").currentTime*1000))/1000],
      ["end_ms","До, с","number",(error.end_ms??Math.round($("player").currentTime*1000))/1000]
    ]) {
      const wrapper=document.createElement("label"); wrapper.append(document.createTextNode(label));
      const input=document.createElement(type==="select"?"select":"input"); input.dataset.field=key;
      if(type==="select") for(const [code,title] of Object.entries(kinds)) {const option=document.createElement("option"); option.value=code; option.textContent=title; input.append(option);}
      else {input.type=type; input.min=key==="word_index"?"1":"0"; input.step=key==="word_index"?"1":"0.001"; if(key!=="word_index")input.max=String(selected.duration_seconds);}
      input.value=String(value); wrapper.append(input); grid.append(wrapper);
    }
    const label=document.createElement("label"); label.textContent="Комментарий к ошибке";
    const note=document.createElement("input"); note.dataset.field="note"; note.maxLength=300; note.value=error.note||""; label.append(note); row.append(label);
    const remove=document.createElement("button"); remove.type="button"; remove.className="secondary"; remove.textContent="Удалить отметку"; remove.onclick=()=>{row.remove();dirty=true;}; row.append(remove); $("errors").append(row);
  }
  function fill(data) {
    selected=data; const annotation=data.annotation||{};
    $("clip-title").textContent="Аят "+(data.verse_key||"не указан"); $("clip-state").textContent=labels[data.status];
    $("clip-meta").textContent=Number(data.duration_seconds).toFixed(1)+" с · версия "+data.revision+" · "+data.id.slice(0,8);
    for(const [id,key] of [["spoken","spoken_text"],["expected","expected_text"],["verdict","verdict"],["riwayah","riwayah"],["notes","notes"]]) $(id).value=annotation[key]||"";
    $("tags").querySelectorAll("input").forEach(input=>{input.checked=(annotation.tags||[]).includes(input.value);});
    $("errors").replaceChildren(); (annotation.errors||[]).forEach(addError); wordGuide();
    $("review-hint").textContent=data.status==="disputed"&&!data.can_adjudicate?"Этот спорный случай должен завершить другой проверяющий. Вы можете дополнить комментарий.":"Черновик не считается эталоном. Проверенная разметка ещё не является доказательством качества модели.";
    $("review-form").querySelector('[value="reviewed"]').disabled=data.status==="disputed"&&!data.can_adjudicate;
    $("empty").hidden=true; $("review-form").hidden=false; dirty=false;
    document.querySelectorAll(".queue-item").forEach(button=>button.setAttribute("aria-current",String(button.dataset.id===data.id)));
  }
  async function openClip(id) {
    clearSelection(); const ticket=generation; notice("Загружаем запись…");
    try {
      const data=await api("detail",{clip_id:id}); const blob=await api("audio",{clip_id:id});
      if(ticket!==generation)return;
      fill(data); blobUrl=URL.createObjectURL(blob); $("player").src=blobUrl; $("player").playbackRate=Number($("speed").value); notice("");
    } catch(error) {if(ticket===generation)handleError(error);}
  }
  function annotation() {
    return {spoken_text:$("spoken").value,expected_text:$("expected").value,verdict:$("verdict").value,riwayah:$("riwayah").value,notes:$("notes").value,
      tags:[...$("tags").querySelectorAll("input:checked")].map(input=>input.value),
      errors:[...$("errors").children].map(row=>{const value=key=>row.querySelector('[data-field="'+key+'"]').value;return {kind:value("kind"),word_index:Number(value("word_index"))-1,start_ms:Math.round(Number(value("start_ms"))*1000),end_ms:Math.round(Number(value("end_ms"))*1000),note:value("note")};})};
  }
  $("review-form").addEventListener("input",()=>{dirty=true;});
  $("expected").addEventListener("input",wordGuide);
  $("add-error").onclick=()=>{if($("errors").children.length<80){addError();dirty=true;}};
  $("speed").onchange=()=>{$("player").playbackRate=Number($("speed").value);};
  $("review-form").addEventListener("submit",async event=>{
    event.preventDefault(); if(!selected||busy)return;
    const state=event.submitter?.value||"draft"; const value=annotation();
    if(state==="reviewed"&&(!value.verdict||(value.verdict!=="unscorable"&&(!value.spoken_text.trim()||!value.expected_text.trim()||!value.riwayah.trim())))){notice("Заполните дословный текст, ожидаемый фрагмент, риваят и итог.",true);return;}
    if((state==="disputed"||value.verdict==="unscorable")&&!value.notes.trim()){notice("Добавьте пояснение в комментарий.",true);return;}
    if(state==="reviewed"&&((value.verdict==="incorrect"&&!value.errors.length)||(value.verdict==="correct"&&value.errors.length))){notice("Согласуйте итог с отметками ошибок.",true);return;}
    busy=true; const ticket=generation; const id=selected.id;
    $("review-form").querySelectorAll("button,input,select,textarea").forEach(node=>{node.disabled=true;});
    try {
      const result=await api("save",{clip_id:id,revision:selected.revision,status:state,annotation:value},true);
      if(ticket!==generation)return;
      selected.revision=result.revision; selected.status=result.status; dirty=false;
      if(state!=="draft")clearSelection(); else {$("clip-state").textContent=labels[result.status]; $("clip-meta").textContent=Number(selected.duration_seconds).toFixed(1)+" с · версия "+result.revision+" · "+id.slice(0,8);}
      notice(state==="draft"?"Черновик сохранён.":state==="disputed"?"Запись передана на вторую проверку.":"Проверка сохранена."); await loadQueue();
    } catch(error) {if(ticket===generation)handleError(error);}
    finally {busy=false;$("review-form").querySelectorAll("button,input,select,textarea").forEach(node=>{node.disabled=false;});if(selected?.status==="disputed"&&!selected.can_adjudicate)$("review-form").querySelector('[value="reviewed"]').disabled=true;}
  });
  let previousStatus=$("status").value;
  $("status").onchange=()=>{if(busy||!canLeave()){$("status").value=previousStatus;return;}previousStatus=$("status").value;offset=0;clearSelection();loadQueue();};
  $("refresh").onclick=()=>{if(!busy&&canLeave()){clearSelection();loadQueue();}};
  $("previous").onclick=()=>{if(!busy&&canLeave()){offset=Math.max(0,offset-25);clearSelection();loadQueue();}};
  $("next").onclick=()=>{if(!busy&&canLeave()){offset+=25;clearSelection();loadQueue();}};
  window.addEventListener("beforeunload",event=>{if(dirty){event.preventDefault();event.returnValue="";}});
  window.addEventListener("pagehide",clearSelection);
  window.addEventListener("pageshow",event=>{if(event.persisted){clearSelection();loadQueue();}});
  // Recheck access and consent while a clip is open; fail closed on an outage.
  let checking=false;
  async function recheck() {
    if(!selected||busy||checking)return; checking=true; const ticket=generation;
    try {await api("detail",{clip_id:selected.id});} catch(error){if(ticket===generation){clearSelection();handleError(error);}}
    finally {checking=false;}
  }
  document.addEventListener("visibilitychange",()=>{if(document.hidden)$("player").pause();else recheck();});
  window.setInterval(recheck,20000); loadQueue();
}());
