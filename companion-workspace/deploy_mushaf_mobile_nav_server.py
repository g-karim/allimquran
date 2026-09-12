from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import frappe


BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")

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

HTML_BLOCK = """<!-- ALLIM_MUSHAF_MOBILE_EXIT_V1_START -->
              <nav class="mushaf-mobile-nav" aria-label="Навигация мусхафа" data-i18n-aria="mushafNavigation">
                <button class="mushaf-exit-button" id="mushaf-exit" type="button" aria-label="Вернуться к чтению" data-i18n-aria="mushafBack">
                  <svg aria-hidden="true"><use href="#i-arrow"/></svg><span data-i18n="mushafBack">Назад</span>
                </button>
                <a class="mushaf-home-button" href="https://allimquran.com/" data-home-link aria-label="На главную АЛЛИМ" data-i18n-aria="mushafHome">
                  <svg aria-hidden="true"><use href="#i-home"/></svg><span class="sr-only" data-i18n="mushafHome">На главную АЛЛИМ</span>
                </a>
              </nav>
              <!-- ALLIM_MUSHAF_MOBILE_EXIT_V1_END -->"""

CSS_BLOCK = """/* ALLIM_MUSHAF_MOBILE_EXIT_V1_START */
.mushaf-mobile-nav { display: none; }

@media (max-width: 760px) {
  body.mushaf-view .mushaf-mobile-nav {
    position: fixed;
    z-index: 79;
    left: 10px;
    bottom: calc(10px + env(safe-area-inset-bottom));
    display: flex;
    align-items: center;
    gap: 6px;
  }
  body.mushaf-view .mushaf-exit-button,
  body.mushaf-view .mushaf-home-button {
    display: inline-flex;
    min-height: 54px;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(142,162,152,.72);
    border-radius: 18px;
    color: var(--forest);
    background: rgba(255,254,249,.96);
    box-shadow: 0 12px 34px rgba(17,52,45,.18),inset 0 1px 0 rgba(255,255,255,.9);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }
  body.mushaf-view .mushaf-exit-button {
    gap: 7px;
    padding: 0 14px 0 12px;
    cursor: pointer;
    font: 800 11px/1 var(--sans);
  }
  body.mushaf-view .mushaf-home-button {
    width: 54px;
    flex: 0 0 54px;
    color: var(--forest);
    text-decoration: none;
  }
  body.mushaf-view .mushaf-exit-button svg,
  body.mushaf-view .mushaf-home-button svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
  }
  body.mushaf-view .mushaf-exit-button svg { transform: rotate(180deg); }
  [dir="rtl"] body.mushaf-view .mushaf-exit-button { padding: 0 12px 0 14px; }
  [dir="rtl"] body.mushaf-view .mushaf-exit-button svg { transform: none; }
  body.mushaf-view .mushaf-exit-button:focus-visible,
  body.mushaf-view .mushaf-home-button:focus-visible {
    border-color: var(--gold);
    outline: 3px solid rgba(214,168,76,.24);
    outline-offset: 2px;
  }
  body.mushaf-view .mushaf-exit-button:active,
  body.mushaf-view .mushaf-home-button:active { transform: scale(.96); }
}
/* ALLIM_MUSHAF_MOBILE_EXIT_V1_END */"""

JS_TRANSLATIONS_BLOCK = """/* ALLIM_MUSHAF_MOBILE_EXIT_TRANSLATIONS_V1_START */
  Object.assign(translations.ru, {
    mushafNavigation: "Навигация мусхафа", mushafBack: "Назад к чтению", mushafHome: "На главную АЛЛИМ"
  });
  Object.assign(translations.en, {
    mushafNavigation: "Mushaf navigation", mushafBack: "Back to reading", mushafHome: "Go to the ALLIM home page"
  });
  Object.assign(translations.ar, {
    mushafNavigation: "التنقل في المصحف", mushafBack: "العودة إلى القراءة", mushafHome: "الانتقال إلى صفحة أليم الرئيسية"
  });
  /* ALLIM_MUSHAF_MOBILE_EXIT_TRANSLATIONS_V1_END */"""

JS_FUNCTION_BLOCK = """/* ALLIM_MUSHAF_MOBILE_EXIT_FUNCTION_V1_START */
  function exitMushafToReading(restoreFocus) {
    document.body.classList.remove("audio-view");
    setMushafMode(false);
    stopVerseAudio(false);
    var audioPanel = document.getElementById("audio-panel");
    if (audioPanel) audioPanel.hidden = true;
    setStudioMode(false);
    selectReaderMode("read");
    setMeaningVisibility(state.showMeaning);
    if (restoreFocus) {
      window.requestAnimationFrame(function () {
        var mobileHome = document.querySelector(".mobile-brand");
        if (mobileHome) mobileHome.focus();
      });
    }
  }
  /* ALLIM_MUSHAF_MOBILE_EXIT_FUNCTION_V1_END */"""

JS_LISTENER_BLOCK = """/* ALLIM_MUSHAF_MOBILE_EXIT_LISTENER_V1_START */
    document.getElementById("mushaf-exit").addEventListener("click", function () { exitMushafToReading(true); });
    /* ALLIM_MUSHAF_MOBILE_EXIT_LISTENER_V1_END */"""


def sha256(value: str) -> str:
    return __import__("hashlib").sha256(value.encode("utf-8")).hexdigest()


def replace_or_insert(value: str, start: str, end: str, block: str, anchor: str, guard: str) -> str:
    regex = __import__("re")
    pattern = regex.escape(start) + r".*?" + regex.escape(end)
    matches = regex.findall(pattern, value, flags=regex.S)
    if len(matches) > 1:
        raise RuntimeError(f"Found more than one patch block: {start}")
    if matches:
        return regex.sub(pattern, lambda _: block, value, count=1, flags=regex.S)
    if guard and guard in value:
        raise RuntimeError(f"Guard exists without its patch markers: {guard}")
    if value.count(anchor) != 1:
        raise RuntimeError(f"Expected exactly one insertion anchor: {anchor}")
    return value.replace(anchor, block + "\n" + anchor, 1)


page_name = frappe.db.get_value("Web Page", {"route": "learn"}, "name")
if not page_name:
    raise RuntimeError("Published page with route learn was not found")

page = frappe.get_doc("Web Page", page_name)
existing_html = page.main_section_html or ""
existing_css = page.css or ""
existing_js = page.javascript or ""

updated_html = replace_or_insert(
    existing_html,
    HTML_START,
    HTML_END,
    HTML_BLOCK,
    '<div class="mushaf-toolbar">',
    'id="mushaf-exit"',
)

css_pattern = __import__("re").escape(CSS_START) + r".*?" + __import__("re").escape(CSS_END)
css_matches = __import__("re").findall(css_pattern, existing_css, flags=__import__("re").S)
if len(css_matches) > 1:
    raise RuntimeError("Found more than one mobile Mushaf navigation CSS block")
if css_matches:
    updated_css = __import__("re").sub(css_pattern, lambda _: CSS_BLOCK, existing_css, count=1, flags=__import__("re").S)
else:
    updated_css = existing_css.rstrip() + "\n\n" + CSS_BLOCK + "\n"

updated_js = replace_or_insert(
    existing_js,
    JS_TRANSLATIONS_START,
    JS_TRANSLATIONS_END,
    JS_TRANSLATIONS_BLOCK,
    "  var reciters = [",
    "mushafNavigation:",
)
updated_js = replace_or_insert(
    updated_js,
    JS_FUNCTION_START,
    JS_FUNCTION_END,
    JS_FUNCTION_BLOCK,
    "  function updateMushafFontUi() {",
    "function exitMushafToReading",
)
updated_js = replace_or_insert(
    updated_js,
    JS_LISTENER_START,
    JS_LISTENER_END,
    JS_LISTENER_BLOCK,
    '    document.getElementById("mushaf-prev-page").addEventListener',
    'document.getElementById("mushaf-exit").addEventListener',
)

timestamp = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
backup_dir = BACKUP_ROOT / f"{timestamp}-allim-mushaf-mobile-nav"
backup_dir.mkdir(parents=True, exist_ok=False)
(backup_dir / "learn-page.json").write_text(
    json.dumps(page.as_dict(), ensure_ascii=False, indent=2, default=str),
    encoding="utf-8",
)
(backup_dir / "learn.html").write_text(existing_html, encoding="utf-8")
(backup_dir / "learn.css").write_text(existing_css, encoding="utf-8")
(backup_dir / "learn.js").write_text(existing_js, encoding="utf-8")

page.main_section_html = updated_html
page.css = updated_css
page.javascript = updated_js
page.save(ignore_permissions=True)
frappe.db.commit()
frappe.clear_cache()

stored = frappe.get_doc("Web Page", page.name)
stored_html = stored.main_section_html or ""
stored_css = stored.css or ""
stored_js = stored.javascript or ""

for value, start, end in (
    (stored_html, HTML_START, HTML_END),
    (stored_css, CSS_START, CSS_END),
    (stored_js, JS_TRANSLATIONS_START, JS_TRANSLATIONS_END),
    (stored_js, JS_FUNCTION_START, JS_FUNCTION_END),
    (stored_js, JS_LISTENER_START, JS_LISTENER_END),
):
    if value.count(start) != 1 or value.count(end) != 1:
        raise RuntimeError(f"Patch markers did not persist exactly once: {start}")

for marker in ('id="mushaf-exit"', 'class="mushaf-home-button"', "function exitMushafToReading", 'document.getElementById("mushaf-exit").addEventListener'):
    combined = stored_html + "\n" + stored_js
    if combined.count(marker) != 1:
        raise RuntimeError(f"Navigation marker did not persist exactly once: {marker}")

expected_hashes = {
    "content": sha256(updated_html),
    "css": sha256(updated_css),
    "javascript": sha256(updated_js),
}
stored_hashes = {
    "content": sha256(stored_html),
    "css": sha256(stored_css),
    "javascript": sha256(stored_js),
}
if stored_hashes != expected_hashes:
    raise RuntimeError("Stored Web Page hashes do not match the prepared patch")

print(
    json.dumps(
        {
            "page": stored.name,
            "route": stored.route,
            "backup": str(backup_dir),
            "previous_hashes": {
                "content": sha256(existing_html),
                "css": sha256(existing_css),
                "javascript": sha256(existing_js),
            },
            "published_hashes": stored_hashes,
        },
        ensure_ascii=False,
    )
)
