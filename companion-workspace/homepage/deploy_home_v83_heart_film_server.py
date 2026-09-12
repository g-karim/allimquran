from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json
import re
import shutil
from pathlib import Path

import frappe


SOURCE_ROOT = Path("/tmp/allim-home-v83-heart-film")
BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")
PUBLIC_FILES = {
    "ALLIM-Quran-in-heart-300-RU-Web-720p.mp4": "allim-quran-in-heart-300-ru.mp4",
    "ALLIM-Quran-in-heart-300-RU-poster.jpg": "allim-quran-in-heart-300-ru-poster.jpg",
    "ALLIM-Quran-in-heart-300-RU.vtt": "allim-quran-in-heart-300-ru.vtt",
    "ALLIM-Quran-in-heart-300-EN-Web-720p.mp4": "allim-quran-in-heart-300-en.mp4",
    "ALLIM-Quran-in-heart-300-EN-poster.jpg": "allim-quran-in-heart-300-en-poster.jpg",
    "ALLIM-Quran-in-heart-300-EN.vtt": "allim-quran-in-heart-300-en.vtt",
    "ALLIM-Quran-in-heart-300-AR-Web-720p.mp4": "allim-quran-in-heart-300-ar.mp4",
    "ALLIM-Quran-in-heart-300-AR-poster.jpg": "allim-quran-in-heart-300-ar-poster.jpg",
    "ALLIM-Quran-in-heart-300-AR.vtt": "allim-quran-in-heart-300-ar.vtt",
    "ALLIM-Quran-in-heart-300-TR-Web-720p.mp4": "allim-quran-in-heart-300-tr.mp4",
    "ALLIM-Quran-in-heart-300-TR-poster.jpg": "allim-quran-in-heart-300-tr-poster.jpg",
    "ALLIM-Quran-in-heart-300-TR.vtt": "allim-quran-in-heart-300-tr.vtt",
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
for audio_name in ("allim-dua-ar-v2.m4a", "allim-hero-neutral-demo-v1.mp3"):
    audio_mime = "audio/mpeg" if audio_name.endswith(".mp3") else "audio/mp4"
    audio_uri = f"data:{audio_mime};base64," + base64.b64encode(
        (SOURCE_ROOT / audio_name).read_bytes()
    ).decode("ascii")
    body = body.replace(f"/assets/audio/{audio_name}", audio_uri)
body = re.sub(r'src="(?:\./)?allim-brand-icon\.png(?:\?v=\d+)?"', 'src="/files/allim-brand-icon.png?v=65"', body)
body = re.sub(r'src="(?:\./)?allim-header-logo\.png(?:\?v=\d+)?"', 'src="/files/allim-header-logo.png?v=11"', body)
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
timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
backup_dir = BACKUP_ROOT / f"{timestamp}-allim-home-v83-heart-film"
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

stored = frappe.get_doc("Web Page", page.name)
stored_html = stored.main_section_html or ""
stored_css = stored.css or ""
stored_js = stored.javascript or ""
if 'id="product-film"' in stored_html:
    raise RuntimeError("Generic product film still exists outside its thematic context")
if 'id="heart-film-video"' not in stored_html or 'preload="none"' not in stored_html:
    raise RuntimeError("The thematic lazy-loaded film player did not persist")
if ".heart-feature-film" not in stored_css:
    raise RuntimeError("The thematic film layout did not persist")
if "applyHeartFilmLanguage" not in stored_js:
    raise RuntimeError("Localized thematic film switching did not persist")
if "МЕТОДИКА В ДЕЙСТВИИ" not in stored_js:
    raise RuntimeError("Russian thematic-film copy did not persist")
if "شاهد المنهج عمليًا" not in stored_js:
    raise RuntimeError("Arabic thematic-film copy did not persist")
if "YÖNTEMİ İŞ BAŞINDA GÖRÜN" not in stored_js:
    raise RuntimeError("Turkish thematic-film copy did not persist")
if "ALLIM_EXTRA_COPIES" not in stored_js:
    raise RuntimeError("The full language catalog did not persist")
for language in ("en", "ar", "ru", "tr"):
    marker = f"/files/allim-quran-in-heart-300-{language}.mp4?v=83"
    if marker not in stored_js and marker not in stored_html:
        raise RuntimeError(f"Missing thematic film marker: {marker}")
for source_name, public_name in PUBLIC_FILES.items():
    target_path = public_root / public_name
    if not target_path.exists() or sha256_file(target_path) != sha256_file(SOURCE_ROOT / source_name):
        raise RuntimeError(f"Published media did not persist: {public_name}")

print(json.dumps({
    "page": page.name,
    "route": page.route,
    "backup": str(backup_dir),
    "hashes": backup["incoming_hashes"],
}, ensure_ascii=False))
