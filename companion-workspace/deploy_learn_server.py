from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json
import re
import shutil
from pathlib import Path

import frappe


SOURCE_ROOT = Path("/tmp/allim-v86-personal-hifz")
BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")
PUBLIC_FILES = {"allim-brand-icon.png": "allim-brand-icon.png"}
RELEASE = "86-personal-hifz"


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
javascript = "\n\n".join(
    [
        read_text("quran-data.js"),
        read_text("tafsir-data.js"),
        read_text("fawaid-data.js"),
        read_text("reading-journal.js"),
        read_text("app.js"),
    ]
)

body_match = re.search(r"<body[^>]*>(.*?)</body>", html, flags=re.I | re.S)
if not body_match:
    raise RuntimeError("Could not extract the page body")

body = re.sub(r"<script\b[^>]*>.*?</script>", "", body_match.group(1), flags=re.I | re.S).strip()
audio_uri = "data:audio/mp4;base64," + base64.b64encode(
    (SOURCE_ROOT / "assets" / "audio" / "allim-dua-ar-v2.m4a").read_bytes()
).decode("ascii")
body = body.replace("/assets/audio/allim-dua-ar-v2.m4a", audio_uri)
body = body.replace('src="allim-brand-icon.png"', 'src="/files/allim-brand-icon.png?v=86"')
favicon_markup = '<link rel="icon" href="/files/allim-brand-icon.png?v=86" type="image/png"><link rel="apple-touch-icon" href="/files/allim-brand-icon.png?v=86">'
recitation_integrations = (
    '<script src="/assets/allimquran/js/recitation-core.js?v=1"></script>'
    '<script src="/assets/allimquran/js/recitation-consent.js?v=1"></script>'
    '<link rel="stylesheet" href="/assets/allimquran/css/recitation-consent.css?v=1">'
)
content = recitation_integrations + favicon_markup + f'<div class="allim-web-root" data-allim-release="{RELEASE}">' + body + "</div>"
platform_css = """
body:has(.allim-web-root) .navbar,
body:has(.allim-web-root) .web-footer,
body:has(.allim-web-root) footer:not(.site-footer),
body:has(.allim-web-root) .page-header,
body:has(.allim-web-root) .page-breadcrumbs { display: none !important; }
body:has(.allim-web-root) .page-content-wrapper,
body:has(.allim-web-root) .web-page-content,
body:has(.allim-web-root) .page_content,
body:has(.allim-web-root) main.container,
body:has(.allim-web-root) main:not(#main-content) { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
body:has(.allim-web-root) { margin: 0 !important; background: #f7f5ef !important; }
""".strip()
css = platform_css + "\n\n" + styles

page_name = frappe.db.get_value("Web Page", {"route": "learn"}, "name")
if not page_name:
    raise RuntimeError("Published page with route learn was not found")

page = frappe.get_doc("Web Page", page_name)
timestamp = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
backup_dir = BACKUP_ROOT / f"{timestamp}-allim-learn"
backup_dir.mkdir(parents=True, exist_ok=False)
backup = {
    "created_at": timestamp,
    "site": frappe.local.site,
    "pages": {"learn": page.as_dict()},
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
stored_html = stored_page.main_section_html or ""
stored_js = stored_page.javascript or ""
for marker in ("recitation-core.js", "recitation-consent.js", "recitation-consent.css", "mushaf-font-select", "mushaf-appearance-picker", "mushaf-play-audio", "mushaf-exit", "mushaf-home-button", "data-mushaf-paper-choice", "heart-mushaf", "heart-start-practice", "heart-page-dialog", "heart-page-sheet", "heart-read-count", "heart-page-launch", "memory-session-bar", "memory-heart-count", "memory-heart-target", "memory-quick-stop", "stop-memory-recognition", "allim-system-intro", "interlinear-status", "quran-search-dialog", "quran-search-input", "open-quran-search", "heart-page-next-step", "start-linked-page-state", "data-state=\"locked\"", "page-recall-card", "start-page-recall", "page-recall-mic", "page-recall-access", "page-recall-access-label", "life-practice-dialog", "open-life-practice-today", "recognition-scope-note", "teacher-assessment-banner", "teacher-assessment-result", "teacher-assessment-word-score", "meaning-attribution", "meaning-edition", "meaning-source", "mobile-recognition-toggle", "reader-mode-picker", "reader-mode-picker-label", "life-fawaid", "life-fawaid-content", "data-hifz-method", "heart-stages-33", "heart-stages-turkish", "lawh-workspace", "lawh-photo-input", "lawh-verification", "lawh-practice", "lawh-verify-page", "lawh-save-local", "lawh-library-list", "86-personal-hifz"):
    if marker not in stored_html:
        raise RuntimeError(f"Published HTML did not persist marker: {marker}")
for marker in (
    "setBrandFavicon", "recordHeartRecitation", "memoryFullVerseMatched", "HEART_FOUNDATION_TOTAL",
    "registerLinkedPageVerse", "heartPageSealed", "renderHeartPageLaunch", "renderHeartMushafPage",
    "applyMushafAppearance", "exitMushafToReading", "memorySeriesActive", "queueMemoryRestart",
    "startMemoryVad", "pauseMemoryRecognition", "beginRecognitionStart", "micRequestTimeout",
    "quranSubmitController", "controller.signal", "browserRecognitionSupported", "luhaidan",
    "salman-utaybi", "setupSystemIntro", "ensureInterlinearWords", "/api/quran/words/",
    "idghamJoinVariants", "idghamJoinThreshold", "idgham-join", "russianSurahNames",
    "selectVerseByReference", "loadMushafForCurrentVerse", "renderQuranSearchResults", "quranCatalogReady",
    "remoteSurah", "mushafSwipeStart", "navigateMushafPage", "makeMushafSurahWing",
    "mushaf-surah-title", "playSuccessCue", "heartLinkedLockedProgress", "heartCollectProgress",
    "aria-disabled", "startPageRecall", "registerPageRecallVerse", "getPageRecallAcademyAccess",
    "pageRecallAccessTier", "pageRecallAccountRequired", "openLifePracticeDialog", "saveLifePractice",
    "recognitionScopeNote", "teacherAssessmentRequested", "initializeTeacherAssessmentMode",
    "LMS%20Batch%20Enrollment", "teacherAssessmentNotFinal", "ensureVerifiedVerseTranslation",
    "/api/quran/translation/", "quranFoundationAttribution", "stopRecognitionImmediately",
    "focusMobileReadingTarget", "setRecognitionControlsDisabled", "reader-mode-picker-label",
    "QuranCompanionFawaid", "renderLifeFawaid", "fawaidScholar", "lifeFawaidChooseFirst",
    "LINKED_33_TARGET", "getLinked33PageSummary", "getTurkishWallPageSummary", "normalizeHifzCoach",
    "getHifzRecommendation", "handleLawhPhoto", "confirmLawhVerification", "recordLawhPractice",
    "openLawhDatabase", "saveCurrentLawhPage", "restoreLawhDraftForCurrentKey", "renderLawhLibrary",
    "registerLinked33SegmentVerse", "selectMemorizationMethod",
):
    if marker not in stored_js:
        raise RuntimeError(f"Published JavaScript did not persist marker: {marker}")
if "window.localStorage.getItem(storageName)" not in stored_js:
    raise RuntimeError("Published JavaScript did not persist the first-visit intro rule")
for marker in ("--mushaf-command-height", ".mobile-recognition-fab", ".mushaf-mobile-nav", ".reader-mode-picker", "body.page-recall-mode .page-recall-dock", ".hifz-method-picker", ".lawh-verification", ".lawh-practice-actions", ".lawh-library-card", ".lawh-storage"):
    if marker not in (stored_page.css or ""):
        raise RuntimeError(f"Published CSS did not persist marker: {marker}")
if "abu-adel-source" in stored_html or "quran.com/ru/" in stored_html:
    raise RuntimeError("Published HTML still contains the removed external translation link")
if "/files/allim-brand-icon.png" not in stored_html:
    raise RuntimeError("Published HTML did not persist the ALLIM brand icon")
for source_name, public_name in PUBLIC_FILES.items():
    target_path = public_root / public_name
    if not target_path.exists() or sha256_file(target_path) != sha256_file(SOURCE_ROOT / source_name):
        raise RuntimeError(f"Published asset did not persist: {public_name}")

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
