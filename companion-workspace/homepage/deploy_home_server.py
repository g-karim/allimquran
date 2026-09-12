from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json
import re
import shutil
from pathlib import Path

import frappe


SOURCE_ROOT = Path("/tmp/allim-home-v83-mobile-polish")
BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")
PUBLIC_FILES = {
    "allim-brand-icon.png": "allim-brand-icon.png",
    "allim-header-logo.png": "allim-header-logo.png",
    "literata-medium.woff2": "allim-literata-medium.woff2",
    "fonts/onest-cyrillic-ext.woff2": "allim-onest-cyrillic-ext.woff2",
    "fonts/onest-cyrillic.woff2": "allim-onest-cyrillic.woff2",
    "fonts/onest-latin-ext.woff2": "allim-onest-latin-ext.woff2",
    "fonts/onest-latin.woff2": "allim-onest-latin.woff2",
    "ALLIM-Quran-Companion-RU.mp4": "allim-quran-companion-ru.mp4",
    "ALLIM-Quran-Companion-RU-poster.jpg": "allim-quran-companion-ru-poster.jpg",
    "ALLIM-Quran-Companion-RU.vtt": "allim-quran-companion-ru.vtt",
    "ALLIM-Quran-Companion-EN.mp4": "allim-quran-companion-en.mp4",
    "ALLIM-Quran-Companion-EN-poster.jpg": "allim-quran-companion-en-poster.jpg",
    "ALLIM-Quran-Companion-EN.vtt": "allim-quran-companion-en.vtt",
    "ALLIM-Quran-Companion-AR.mp4": "allim-quran-companion-ar.mp4",
    "ALLIM-Quran-Companion-AR-poster.jpg": "allim-quran-companion-ar-poster.jpg",
    "ALLIM-Quran-Companion-AR.vtt": "allim-quran-companion-ar.vtt",
}


def read_text(name: str) -> str:
    return (SOURCE_ROOT / name).read_text(encoding="utf-8")


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


html = read_text("index.html")
styles = read_text("styles.css")
for local_font, public_font in (
    ("fonts/onest-cyrillic-ext.woff2", "allim-onest-cyrillic-ext.woff2"),
    ("fonts/onest-cyrillic.woff2", "allim-onest-cyrillic.woff2"),
    ("fonts/onest-latin-ext.woff2", "allim-onest-latin-ext.woff2"),
    ("fonts/onest-latin.woff2", "allim-onest-latin.woff2"),
):
    styles = styles.replace(f'url("{local_font}")', f'url("/files/{public_font}")')
javascript = read_text("i18n.js") + "\n\n" + read_text("script.js")

body_match = re.search(r"<body[^>]*>(.*?)</body>", html, flags=re.I | re.S)
if not body_match:
    raise RuntimeError("Could not extract the page body")

body = re.sub(
    r"<script\b[^>]*\bsrc=[^>]*>\s*</script>",
    "",
    body_match.group(1),
    flags=re.I | re.S,
).strip()
for audio_name in (
    "allim-dua-ar-v2.m4a",
    "allim-hero-neutral-demo-v1.mp3",
):
    audio_mime = "audio/mpeg" if audio_name.endswith(".mp3") else "audio/mp4"
    audio_uri = f"data:{audio_mime};base64," + base64.b64encode(
        (SOURCE_ROOT / audio_name).read_bytes()
    ).decode("ascii")
    body = body.replace(f"/assets/audio/{audio_name}", audio_uri)
body = re.sub(r'src="(?:\.\/)?allim-brand-icon\.png(?:\?v=\d+)?"', 'src="/files/allim-brand-icon.png?v=65"', body)
body = re.sub(r'src="(?:\.\/)?allim-header-logo\.png(?:\?v=\d+)?"', 'src="/files/allim-header-logo.png?v=11"', body)
favicon_markup = '<link rel="icon" href="/files/allim-brand-icon.png?v=65" type="image/png"><link rel="apple-touch-icon" href="/files/allim-brand-icon.png?v=65">'
content = favicon_markup + '<div class="allim-web-root">' + body + "</div>"
platform_css = """
body:has(.allim-web-root) .navbar,
body:has(.allim-web-root) .web-footer,
body:has(.allim-web-root) footer:not(.site-footer),
body:has(.allim-web-root) .page-header,
body:has(.allim-web-root) .page-breadcrumbs { display: none !important; }
body:has(.allim-web-root) .page-content-wrapper,
body:has(.allim-web-root) .web-page-content,
body:has(.allim-web-root) .page_content,
body:has(.allim-web-root) main.container { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
body:has(.allim-web-root) { margin: 0 !important; background: #f6f4ef !important; }
""".strip()
css = platform_css + "\n\n" + styles

page_name = frappe.db.get_value("Web Page", {"route": "home"}, "name")
if not page_name:
    raise RuntimeError("Published page with route home was not found")

page = frappe.get_doc("Web Page", page_name)
timestamp = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
backup_dir = BACKUP_ROOT / f"{timestamp}-allim-home"
backup_dir.mkdir(parents=True, exist_ok=False)
backup = {
    "created_at": timestamp,
    "site": frappe.local.site,
    "pages": {"home": page.as_dict()},
    "current_hashes": {
        "content": sha256(page.main_section_html or ""),
        "css": sha256(page.css or ""),
        "javascript": sha256(page.javascript or ""),
    },
    "incoming_hashes": {
        "content": sha256(content),
        "css": sha256(css),
        "javascript": sha256(javascript),
        "public_files": {
            public_name: sha256_file(SOURCE_ROOT / source_name)
            for source_name, public_name in PUBLIC_FILES.items()
        },
    },
}
(backup_dir / "records.json").write_text(
    json.dumps(backup, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
)

page.main_section_html = content
page.css = css
page.javascript = javascript
page.full_width = 1
page.show_title = 0
page.show_sidebar = 0
page.save(ignore_permissions=True)
frappe.db.commit()

public_root = Path(frappe.get_site_path("public", "files"))
public_root.mkdir(parents=True, exist_ok=True)
for source_name, public_name in PUBLIC_FILES.items():
    source_path = SOURCE_ROOT / source_name
    target_path = public_root / public_name
    if target_path.exists():
        shutil.copy2(target_path, backup_dir / public_name)
    shutil.copy2(source_path, target_path)

frappe.clear_cache()

stored_page = frappe.get_doc("Web Page", page.name)
if "ALLIM design system v24" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist the v24 design system")
if "/files/allim-onest-cyrillic.woff2" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist the Cyrillic type system")
if "floating-notice-drift" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist the floating notification motion")
if "journey-card.is-accent > p:not(.card-number)" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist the high-contrast journey copy")
if 'id="heart-mushaf"' not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the Qur’an-in-the-heart section")
if 'id="allim-system-intro"' not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the system intro")
if 'id="hero-demo-play"' not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the recitation demonstration")
if 'id="product-film"' not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the product film section")
if 'id="guides"' not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the learning library section")
if "data-blog-article" not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist localized learning-library links")
if ".learning-journal-grid" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist the learning-library layout")
if ".academy-card > .text-link" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist the aligned Academy actions")
if ".academy-card h3 { color: #f5f4f0; }" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist the Academy heading contrast")
if 'class="early-routes"' not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the clear self-study and Academy routes")
if 'id="share-benefit"' not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the share-the-benefit section")
if (stored_page.main_section_html or "").count("data-share-trigger") != 1:
    raise RuntimeError("Published HTML did not persist the active general ALLIM share action")
if 'class="academy-referral"' not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the single-level Academy referral strip")
if 'class="academy-referral-status"' not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the referral development badge")
if 'disabled aria-disabled="true" data-referral-placeholder' not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not keep the Academy invitation as an inactive placeholder")
if "Функция приглашения в Академию и автоматическое начисление пока не подключены" not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist the inactive Academy referral boundary")
if "navigator.share" not in (stored_page.javascript or "") or "navigator.clipboard" not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist the native share flow and copy fallback")
if "АЛЛИМ не обещает и не подсчитывает награду в вечной жизни" not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist the Russian spiritual-reward boundary")
if "لا يَعِد ALLIM بأجر أخروي ولا يحسبه" not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist the Arabic spiritual-reward boundary")
if "JAZARION" in ((stored_page.main_section_html or "") + (stored_page.javascript or "")):
    raise RuntimeError("Wrong-project copy found in the ALLIM homepage")
if ".early-route:hover .feature-icon" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist the interactive route icons")
if ".share-benefit-rule:hover .feature-icon" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist the interactive share icons")
if "One learning journey. Choose how you want to begin." not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the revised early-access message")
if "Один путь обучения. Выберите, как начать." not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist the revised Russian early-access message")
if "overflow-wrap: normal; word-break: normal; hyphens: none" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist whole-word Academy heading wrapping")
if "linear-gradient(112deg,#287e88 0%,#298f8d 46%,#28a47f 100%)" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist the mineral gradient header")
if ".site-header.is-header-hidden" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist the auto-hiding header state")
if "min-height: max(600px,calc(100svh - 82px))" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist the unclipped responsive sections")
if "/files/allim-brand-icon.png" not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the ALLIM brand icon")
if "/files/allim-header-logo.png?v=11" not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the ALLIM header wordmark")
if "/files/allim-quran-companion-en.mp4" not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the default English product film source")
if "allim-hero-neutral-demo-v1.mp3" in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not inline the neutral hero voice")
if "husary" in (stored_page.main_section_html or "").lower():
    raise RuntimeError("Published Hero still references a named reciter")
if "قَالَ رَسُولُ اللَّهِ" not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the Arabic hadith introduction")
if "mission-ornament" in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML still contains the removed hadith ornament")
if "ИИ-помощник для чтения, повторения и ответов по проверенным источникам." not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist the clearer Russian AI message")
if "Как АЛЛИМ превращает один аят" not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist the Russian АЛЛИМ spelling")
if ".hero-actions .button,\n  .mobile-menu .button" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist equal-width mobile actions")
if ".floating-card { position: relative;" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist non-overlapping mobile notice cards")
if ".intelligence::before {\n  content: none;\n  background-image: none;" not in (stored_page.css or ""):
    raise RuntimeError("Published CSS did not persist the removed intelligence ornament")
if 'data-ai-flow="recitation"' not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the interactive intelligence cards")
if 'class="map-particle particle-listen"' not in (stored_page.main_section_html or ""):
    raise RuntimeError("Published HTML did not persist the animated intelligence flow")
if "setupSystemIntro" not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist the system intro controller")
if "setBrandFavicon" not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist the ALLIM favicon controller")
if "updateHeaderPosition" not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist the scroll-aware header controller")
if "setupHeroRecitationDemo" not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist the recitation demonstration")
if "setupIntelligenceMap" not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist the intelligence map controller")
if "applyFilmLanguage" not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist localized product-film switching")
if "ALLIM_EXTRA_COPIES" not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist the full language catalog")
for language in ("tg", "uz", "tt", "bs", "fr", "zh", "ja", "es", "de", "ms", "id", "ur", "hi", "pt", "sw"):
    if f'"{language}": {{' not in (stored_page.javascript or ""):
        raise RuntimeError(f"Published JavaScript did not persist the {language} translation")
for language in ("en", "ar", "ru"):
    if f"/files/allim-quran-companion-{language}.mp4" not in (stored_page.javascript or ""):
        raise RuntimeError(f"Published JavaScript did not persist the {language} product film")
if "window.localStorage.getItem(storageName)" not in (stored_page.javascript or ""):
    raise RuntimeError("Published JavaScript did not persist the first-visit intro rule")
for source_name, public_name in PUBLIC_FILES.items():
    target_path = public_root / public_name
    if not target_path.exists() or sha256_file(target_path) != sha256_file(SOURCE_ROOT / source_name):
        raise RuntimeError(f"Published media did not persist: {public_name}")

print(
    json.dumps(
        {
            "page": page.name,
            "route": page.route,
            "backup": str(backup_dir),
            "hashes": backup["incoming_hashes"],
        },
        ensure_ascii=False,
    )
)
