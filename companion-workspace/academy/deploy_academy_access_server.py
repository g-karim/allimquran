from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from pathlib import Path

import frappe


SOURCE_ROOT = Path("/tmp/allim-v77-teacher-assessment/academy")
BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")


def read_text(name: str) -> str:
    return (SOURCE_ROOT / name).read_text(encoding="utf-8")


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


html = read_text("index.html")
styles = read_text("styles.css")
javascript = read_text("script.js")

body_match = re.search(r"<body[^>]*>(.*?)</body>", html, flags=re.I | re.S)
if not body_match:
    raise RuntimeError("Could not extract the Academy page body")

body = re.sub(
    r"<script\b[^>]*>.*?</script>",
    "",
    body_match.group(1),
    flags=re.I | re.S,
).strip()
content = '<div class="allim-academy-root">' + body + "</div>"
platform_css = """
body:has(.allim-academy-root) .navbar,
body:has(.allim-academy-root) .web-footer,
body:has(.allim-academy-root) footer:not(.site-footer),
body:has(.allim-academy-root) .page-header,
body:has(.allim-academy-root) .page-breadcrumbs { display: none !important; }
body:has(.allim-academy-root) .page-content-wrapper,
body:has(.allim-academy-root) .web-page-content,
body:has(.allim-academy-root) .page_content,
body:has(.allim-academy-root) main.container,
body:has(.allim-academy-root) main:not(#academy-main) { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
body:has(.allim-academy-root) { margin: 0 !important; background: #f4f2ec !important; }
""".strip()
css = platform_css + "\n\n" + styles

page_name = frappe.db.get_value("Web Page", {"route": "academy"}, "name")
if not page_name:
    raise RuntimeError("Published page with route academy was not found")

page = frappe.get_doc("Web Page", page_name)
timestamp = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
backup_dir = BACKUP_ROOT / f"{timestamp}-allim-academy"
backup_dir.mkdir(parents=True, exist_ok=False)
backup = {
    "created_at": timestamp,
    "site": frappe.local.site,
    "pages": {"academy": page.as_dict()},
    "current_hashes": {
        "content": sha256(page.main_section_html or ""),
        "css": sha256(page.css or ""),
        "javascript": sha256(page.javascript or ""),
    },
    "incoming_hashes": {
        "content": sha256(content),
        "css": sha256(css),
        "javascript": sha256(javascript),
    },
}
(backup_dir / "records.json").write_text(
    json.dumps(backup, ensure_ascii=False, indent=2, default=str),
    encoding="utf-8",
)

page.main_section_html = content
page.css = css
page.javascript = javascript
page.save(ignore_permissions=True)
frappe.db.commit()
frappe.clear_cache()

stored = frappe.get_doc("Web Page", page.name)
stored_html = stored.main_section_html or ""
stored_js = stored.javascript or ""
for marker in (
    "open-access-line",
    "basic-access-line",
    "guided-access-line",
    "advanced-recall-card",
    "advanced-recall-status",
    "advanced-recall-action",
    "strict-assessment-card",
    "strict-assessment-status",
    "strict-assessment-action",
):
    if marker not in stored_html:
        raise RuntimeError(f"Published Academy HTML did not persist marker: {marker}")
for marker in (
    "threeLevels",
    "secondAccessActive",
    "levelThreeActive",
    "LMS Batch Enrollment",
    "academy=page-recall",
    'params.get("feature")==="page-recall"',
    "strictAssessmentActive",
    "assessment=teacher",
    'params.get("feature")==="strict-assessment"',
):
    if marker not in stored_js:
        raise RuntimeError(f"Published Academy JavaScript did not persist marker: {marker}")

print(
    json.dumps(
        {
            "ok": True,
            "route": "academy",
            "backup": str(backup_dir),
            "hashes": {
                "content": sha256(stored_html),
                "css": sha256(stored.css or ""),
                "javascript": sha256(stored_js),
            },
        },
        ensure_ascii=False,
    )
)
