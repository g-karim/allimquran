HTML_START = "<!-- ALLIM_MUSHAF_MOBILE_EXIT_V1_START -->"
HTML_END = "<!-- ALLIM_MUSHAF_MOBILE_EXIT_V1_END -->"
CSS_START = "/* ALLIM_MUSHAF_MOBILE_EXIT_V1_START */"
CSS_END = "/* ALLIM_MUSHAF_MOBILE_EXIT_V1_END */"
JS_TRANSLATIONS_START = "/* ALLIM_MUSHAF_MOBILE_EXIT_TRANSLATIONS_V1_START */"
JS_TRANSLATIONS_END = "/* ALLIM_MUSHAF_MOBILE_EXIT_TRANSLATIONS_V1_END */"
JS_FUNCTION_START = "/* ALLIM_MUSHAF_MOBILE_EXIT_FUNCTION_V1_START */"
JS_FUNCTION_END = "/* ALLIM_MUSHAF_MOBILE_EXIT_FUNCTION_V1_END */"
JS_LISTENER_START = "/* ALLIM_MUSHAF_MOBILE_EXIT_LISTENER_V1_START */"
JS_LISTENER_END = "/* ALLIM_MUSHAF_MOBILE_EXIT_LISTENER_V1_END */"

HTML_BLOCK = '''<!-- ALLIM_MUSHAF_MOBILE_EXIT_V1_START -->
<nav class="mushaf-mobile-nav" aria-label="Навигация мусхафа" data-i18n-aria="mushafNavigation">
  <button class="mushaf-exit-button" id="mushaf-exit" type="button" aria-label="Вернуться к чтению" data-i18n-aria="mushafBack">
    <svg aria-hidden="true"><use href="#i-arrow"/></svg><span data-i18n="mushafBack">Назад</span>
  </button>
  <a class="mushaf-home-button" href="https://allimquran.com/" data-home-link aria-label="На главную АЛЛИМ" data-i18n-aria="mushafHome">
    <svg aria-hidden="true"><use href="#i-home"/></svg><span class="sr-only" data-i18n="mushafHome">На главную АЛЛИМ</span>
  </a>
</nav>
<!-- ALLIM_MUSHAF_MOBILE_EXIT_V1_END -->'''

CSS_BLOCK = '''/* ALLIM_MUSHAF_MOBILE_EXIT_V1_START */
.mushaf-mobile-nav { display: none; }
@media (max-width: 760px) {
  body.mushaf-view .mushaf-mobile-nav { position: fixed; z-index: 79; left: 10px; bottom: calc(10px + env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 6px; }
  body.mushaf-view .mushaf-exit-button,
  body.mushaf-view .mushaf-home-button { display: inline-flex; min-height: 54px; align-items: center; justify-content: center; border: 1px solid rgba(142,162,152,.72); border-radius: 18px; color: var(--forest); background: rgba(255,254,249,.96); box-shadow: 0 12px 34px rgba(17,52,45,.18),inset 0 1px 0 rgba(255,255,255,.9); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
  body.mushaf-view .mushaf-exit-button { gap: 7px; padding: 0 14px 0 12px; cursor: pointer; font: 800 11px/1 var(--sans); }
  body.mushaf-view .mushaf-home-button { width: 54px; flex: 0 0 54px; color: var(--forest); text-decoration: none; }
  body.mushaf-view .mushaf-exit-button svg,
  body.mushaf-view .mushaf-home-button svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; }
  body.mushaf-view .mushaf-exit-button svg { transform: rotate(180deg); }
  [dir="rtl"] body.mushaf-view .mushaf-exit-button { padding: 0 12px 0 14px; }
  [dir="rtl"] body.mushaf-view .mushaf-exit-button svg { transform: none; }
  body.mushaf-view .mushaf-exit-button:focus-visible,
  body.mushaf-view .mushaf-home-button:focus-visible { border-color: var(--gold); outline: 3px solid rgba(214,168,76,.24); outline-offset: 2px; }
  body.mushaf-view .mushaf-exit-button:active,
  body.mushaf-view .mushaf-home-button:active { transform: scale(.96); }
}
/* ALLIM_MUSHAF_MOBILE_EXIT_V1_END */'''

JS_TRANSLATIONS_BLOCK = '''/* ALLIM_MUSHAF_MOBILE_EXIT_TRANSLATIONS_V1_START */
Object.assign(translations.ru, { mushafNavigation: "Навигация мусхафа", mushafBack: "Назад к чтению", mushafHome: "На главную АЛЛИМ" });
Object.assign(translations.en, { mushafNavigation: "Mushaf navigation", mushafBack: "Back to reading", mushafHome: "Go to the ALLIM home page" });
Object.assign(translations.ar, { mushafNavigation: "التنقل في المصحف", mushafBack: "العودة إلى القراءة", mushafHome: "الانتقال إلى صفحة أليم الرئيسية" });
/* ALLIM_MUSHAF_MOBILE_EXIT_TRANSLATIONS_V1_END */'''

JS_FUNCTION_BLOCK = '''/* ALLIM_MUSHAF_MOBILE_EXIT_FUNCTION_V1_START */
function exitMushafToReading(restoreFocus) {
  document.body.classList.remove("audio-view");
  setMushafMode(false);
  stopVerseAudio(false);
  var audioPanel = document.getElementById("audio-panel");
  if (audioPanel) audioPanel.hidden = true;
  setStudioMode(false);
  selectReaderMode("read");
  setMeaningVisibility(state.showMeaning);
  if (restoreFocus) window.requestAnimationFrame(function () {
    var mobileHome = document.querySelector(".mobile-brand");
    if (mobileHome) mobileHome.focus();
  });
}
/* ALLIM_MUSHAF_MOBILE_EXIT_FUNCTION_V1_END */'''

JS_LISTENER_BLOCK = '''/* ALLIM_MUSHAF_MOBILE_EXIT_LISTENER_V1_START */
document.getElementById("mushaf-exit").addEventListener("click", function () { exitMushafToReading(true); });
/* ALLIM_MUSHAF_MOBILE_EXIT_LISTENER_V1_END */'''

page = frappe.get_doc("Web Page", {"route": "learn"})
html = page.main_section_html or ""
css = page.css or ""
javascript = page.javascript or ""

if 'id="mushaf-exit"' in html and HTML_START not in html:
    frappe.throw("Mushaf exit control exists without managed markers")
if "function exitMushafToReading" in javascript and JS_FUNCTION_START not in javascript:
    frappe.throw("Mushaf exit function exists without managed markers")

if HTML_START in html:
    start = html.index(HTML_START)
    end = html.index(HTML_END, start) + len(HTML_END)
    html = html[:start] + HTML_BLOCK + html[end:]
else:
    anchor = '<div class="mushaf-toolbar">'
    if html.count(anchor) != 1:
        frappe.throw("Expected one Mushaf toolbar anchor")
    html = html.replace(anchor, HTML_BLOCK + "\n" + anchor, 1)

if CSS_START in css:
    start = css.index(CSS_START)
    end = css.index(CSS_END, start) + len(CSS_END)
    css = css[:start] + CSS_BLOCK + css[end:]
else:
    css = css.rstrip() + "\n\n" + CSS_BLOCK + "\n"

if JS_TRANSLATIONS_START in javascript:
    start = javascript.index(JS_TRANSLATIONS_START)
    end = javascript.index(JS_TRANSLATIONS_END, start) + len(JS_TRANSLATIONS_END)
    javascript = javascript[:start] + JS_TRANSLATIONS_BLOCK + javascript[end:]
else:
    anchor = "var reciters = ["
    if javascript.count(anchor) != 1:
        frappe.throw("Expected one reciter anchor")
    javascript = javascript.replace(anchor, JS_TRANSLATIONS_BLOCK + "\n" + anchor, 1)

if JS_FUNCTION_START in javascript:
    start = javascript.index(JS_FUNCTION_START)
    end = javascript.index(JS_FUNCTION_END, start) + len(JS_FUNCTION_END)
    javascript = javascript[:start] + JS_FUNCTION_BLOCK + javascript[end:]
else:
    anchor = "function updateMushafFontUi() {"
    if javascript.count(anchor) != 1:
        frappe.throw("Expected one Mushaf function anchor")
    javascript = javascript.replace(anchor, JS_FUNCTION_BLOCK + "\n" + anchor, 1)

if JS_LISTENER_START in javascript:
    start = javascript.index(JS_LISTENER_START)
    end = javascript.index(JS_LISTENER_END, start) + len(JS_LISTENER_END)
    javascript = javascript[:start] + JS_LISTENER_BLOCK + javascript[end:]
else:
    anchor = 'document.getElementById("mushaf-prev-page").addEventListener'
    if javascript.count(anchor) != 1:
        frappe.throw("Expected one Mushaf listener anchor")
    javascript = javascript.replace(anchor, JS_LISTENER_BLOCK + "\n" + anchor, 1)

stamp = frappe.utils.now_datetime().strftime("%Y%m%dT%H%M%S")
backup = frappe.copy_doc(page)
backup.title = "ALLIM Qur'an backup before Mushaf mobile navigation " + stamp
backup.route = "private-backups/allim-mushaf-mobile-nav-" + stamp.lower()
backup.published = 0
backup.insert(ignore_permissions=True)

page.main_section_html = html
page.css = css
page.javascript = javascript
page.save(ignore_permissions=True)
frappe.clear_cache()

stored = frappe.get_doc("Web Page", page.name)
if (stored.main_section_html or "").count(HTML_START) != 1:
    frappe.throw("HTML patch marker verification failed")
if (stored.css or "").count(CSS_START) != 1:
    frappe.throw("CSS patch marker verification failed")
if (stored.javascript or "").count(JS_FUNCTION_START) != 1:
    frappe.throw("JavaScript function verification failed")
if (stored.javascript or "").count(JS_LISTENER_START) != 1:
    frappe.throw("JavaScript listener verification failed")

print("published=" + stored.name)
print("backup=" + backup.name)
print("route=" + stored.route)
