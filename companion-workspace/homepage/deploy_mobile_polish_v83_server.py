from __future__ import annotations

import datetime as dt
import hashlib
import json
from pathlib import Path

import frappe


BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")
CSS_MARKER = "/* ALLIM home mobile polish v83 */"
OLD_ORNAMENT = '<div class="mission-ornament" aria-hidden="true">۞</div>'
OLD_AI_TITLE = "ИИ-помощник, который знает, когда слушать — и когда не выдумывать."
NEW_AI_TITLE = "ИИ-помощник для чтения, повторения и ответов по проверенным источникам."
OLD_AI_LEAD = (
    "АЛЛИМ проектируется вокруг проверенного текста Корана, ясного указания источников "
    "и честного признания неопределённости. Он должен помогать двигаться по надёжному "
    "знанию, а не выдавать догадку за тафсир или машинную оценку за иджазу преподавателя."
)
NEW_AI_LEAD = (
    "АЛЛИМ опирается на проверенный текст Корана и показывает источники рядом с ответом. "
    "Если надёжного основания недостаточно, помощник прямо сообщает об этом и предлагает "
    "обратиться к преподавателю — без догадок, выдаваемых за тафсир, и без подмены иджазы "
    "автоматической оценкой."
)


def digest(value: str | None) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


def replace_once(value: str, old: str, new: str, label: str) -> str:
    count = value.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label}; found {count}")
    return value.replace(old, new, 1)


page_name = frappe.db.get_value("Web Page", {"route": "home"}, "name")
if not page_name:
    raise RuntimeError("Published page with route home was not found")

page = frappe.get_doc("Web Page", page_name)
html = page.main_section_html or ""
css = page.css or ""
javascript = page.javascript or ""

if CSS_MARKER in css:
    raise RuntimeError("Mobile polish v83 is already present")

html = replace_once(html, OLD_ORNAMENT, "", "hadith ornament")

ru_start = javascript.index("    ru: {")
ru_end = javascript.index("\n    tr: {", ru_start)
ru_block = javascript[ru_start:ru_end]
ru_block = ru_block.replace("ALLIM QUR’AN ACADEMY", "Академия АЛЛИМ")
ru_block = ru_block.replace("ALLIM", "АЛЛИМ")
ru_block = replace_once(ru_block, OLD_AI_TITLE, NEW_AI_TITLE, "Russian AI title")
ru_block = replace_once(ru_block, OLD_AI_LEAD, NEW_AI_LEAD, "Russian AI description")
ru_block = ru_block.replace("Academy добавляет человеческий слой", "Академия добавляет человеческое сопровождение")
ru_block = ru_block.replace("ОТКРЫТЫЙ АЛЛИМ", "ОТКРЫТЫЙ АЛЛИМ")
ru_block = ru_block.replace("ACADEMY С ПРЕПОДАВАТЕЛЕМ", "АКАДЕМИЯ С ПРЕПОДАВАТЕЛЕМ")
ru_block = ru_block.replace("Оставить интерес к Academy", "Оставить заявку в Академию")
ru_block = ru_block.replace("Посмотреть модель Academy", "Посмотреть модель Академии")
javascript = javascript[:ru_start] + ru_block + javascript[ru_end:]
javascript = replace_once(
    javascript,
    "Послушайте, как отвечает ALLIM",
    "Послушайте, как отвечает АЛЛИМ",
    "Russian recitation-demo brand spelling",
)

css_patch = r'''

/* ALLIM home mobile polish v83 */
.allim-web-root {
  --font-ui: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-display: "ALLIM Literata", Georgia, "Times New Roman", serif;
  --font-arabic: "SF Arabic", "Geeza Pro", "Noto Naskh Arabic", serif;
  font-family: var(--font-ui);
}
.allim-web-root .brand-name,
.allim-web-root .hero h1,
.allim-web-root .product-film-copy h2,
.allim-web-root .section-intro h2,
.allim-web-root .journey-card h3,
.allim-web-root .heart-feature-copy h2,
.allim-web-root .intelligence-copy h2,
.allim-web-root .stage-copy h3,
.allim-web-root .action-visual p,
.allim-web-root .academy-intro h2,
.allim-web-root .academy-card h3,
.allim-web-root .ijazah-note strong,
.allim-web-root .learning-journal-heading h2,
.allim-web-root .journal-feature h3,
.allim-web-root .journal-card h3,
.allim-web-root .trust-heading h2,
.allim-web-root .trust-grid h3,
.allim-web-root .early-copy h2,
.allim-web-root .early-route h3 {
  font-family: var(--font-display);
}
.allim-web-root .mission-strip {
  grid-template-columns: minmax(0,1fr);
  justify-items: center;
  gap: 12px;
  text-align: center;
}
.allim-web-root .mission-strip > div { display: grid; justify-items: center; gap: 3px; }
.allim-web-root .mission-strip > div p:last-child { font-family: var(--font-display); }
.allim-web-root .mission-source,
[dir="rtl"] .allim-web-root .mission-source {
  grid-column: auto;
  justify-self: center;
  max-width: 760px;
  text-align: center;
  text-wrap: balance;
}
@media (max-width: 820px) {
  .allim-web-root .mission-strip { grid-template-columns: 1fr; padding: 30px 20px; }
}
@media (max-width: 580px) {
  .allim-web-root .button-large { min-height: 56px; border-radius: 18px; }
  .allim-web-root .hero-actions { display: grid; grid-template-columns: 1fr; width: 100%; }
  .allim-web-root .hero-actions .button,
  .allim-web-root .mobile-menu .button,
  .allim-web-root .heart-feature-action,
  .allim-web-root .early-route .button { width: 100%; min-width: 0; }
  .allim-web-root .hero-product {
    display: grid;
    min-height: 0;
    width: 100%;
    gap: 10px;
    margin: 14px 0 0;
    transform: none;
  }
  .allim-web-root .recitation-demo { width: 100%; min-height: 570px; padding: 18px; border-radius: 24px; }
  .allim-web-root .demo-reference { margin-top: 42px; }
  .allim-web-root .demo-ayah { min-height: 150px; margin-top: 22px; padding-inline: 0; font-size: clamp(27px,8.6vw,34px); }
  .allim-web-root .demo-controls { margin-top: 28px; }
  .allim-web-root .floating-card {
    position: relative;
    inset: auto;
    width: 100%;
    min-height: 66px;
    opacity: 1;
    animation: none;
    transform: none;
  }
  .allim-web-root .floating-card > div { min-width: 0; }
  .allim-web-root .floating-card strong,
  .allim-web-root .floating-card small { overflow-wrap: anywhere; }
  .allim-web-root .early-route .button { align-self: stretch; }
}
'''
css += css_patch

timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
backup_dir = BACKUP_ROOT / f"{timestamp}-allim-home-mobile-v83"
backup_dir.mkdir(parents=True, exist_ok=False)
(backup_dir / "records.json").write_text(
    json.dumps(
        {
            "created_at": timestamp,
            "site": frappe.local.site,
            "page": page.as_dict(),
            "hashes_before": {
                "html": digest(page.main_section_html),
                "css": digest(page.css),
                "javascript": digest(page.javascript),
            },
        },
        ensure_ascii=False,
        indent=2,
        default=str,
    ),
    encoding="utf-8",
)

page.main_section_html = html
page.css = css
page.javascript = javascript
page.save(ignore_permissions=True)
frappe.db.commit()
frappe.clear_cache()

stored = frappe.get_doc("Web Page", page.name)
if OLD_ORNAMENT in (stored.main_section_html or ""):
    raise RuntimeError("Hadith ornament was not removed")
if NEW_AI_TITLE not in (stored.javascript or ""):
    raise RuntimeError("Clearer Russian AI title was not saved")
if "Как АЛЛИМ превращает один аят" not in (stored.javascript or ""):
    raise RuntimeError("Russian АЛЛИМ spelling was not saved")
if CSS_MARKER not in (stored.css or ""):
    raise RuntimeError("Mobile CSS patch was not saved")

print(
    json.dumps(
        {
            "page": stored.name,
            "route": stored.route,
            "backup": str(backup_dir),
            "hashes_after": {
                "html": digest(stored.main_section_html),
                "css": digest(stored.css),
                "javascript": digest(stored.javascript),
            },
        },
        ensure_ascii=False,
    )
)
