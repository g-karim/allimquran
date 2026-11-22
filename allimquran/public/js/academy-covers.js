/* Programs have no image field. Decorate only exact, known program card titles. */
(function () {
  'use strict';
  let covers=null, scheduled=false;
  const normalize=text=>text.trim().replace(/\s+/g,' ');
  function render() {
    scheduled=false;
    if(!covers || !/^\/lms\/programs\/?$/.test(location.pathname))return;
    for(const button of document.querySelectorAll('button[type="button"]')) {
      if(button.closest('[role="dialog"],dialog') || button.querySelector('input,select,a'))continue;
      const title=button.firstElementChild;
      if(!title || title.tagName!=='DIV')continue;
      const cover=covers.get(normalize(title.textContent));
      if(!cover)continue;
      button.classList.add('allim-program-cover');
      button.style.setProperty('--allim-program-art','url("/assets/allimquran/media/academy-covers/'+cover+'")');
    }
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(render);}}
  fetch('/assets/allimquran/data/academy-covers.json').then(r=>{if(!r.ok)throw Error('covers_unavailable');return r.json();}).then(data=>{
    covers=new Map(data.covers.map(item=>[normalize(item.title),item.file]));
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('popstate',schedule);schedule();
  }).catch(()=>{/* Existing program titles remain fully usable without artwork. */});
})();
