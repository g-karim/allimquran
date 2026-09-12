from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path

import frappe


SOURCE_ROOT = Path("/tmp/allim-header-center-v1")
BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")
START_MARKER = "/* ALLIM_MUSHAF_HEADER_CENTER_V1_START */"
END_MARKER = "/* ALLIM_MUSHAF_HEADER_CENTER_V1_END */"


def sha256(value: str) -> str:
    return __import__("hashlib").sha256(value.encode("utf-8")).hexdigest()


source_css = (SOURCE_ROOT / "mushaf_header_center.css").read_text(encoding="utf-8")
match = re.search(
    re.escape(START_MARKER) + r".*?" + re.escape(END_MARKER),
    source_css,
    flags=re.S,
)
if not match:
    raise RuntimeError("The centered Mushaf header CSS block was not found")

incoming_block = match.group(0)
page_name = frappe.db.get_value("Web Page", {"route": "learn"}, "name")
if not page_name:
    raise RuntimeError("Published page with route learn was not found")

page = frappe.get_doc("Web Page", page_name)
existing_css = page.css or ""
clean_css = re.sub(
    re.escape(START_MARKER) + r".*?" + re.escape(END_MARKER),
    "",
    existing_css,
    flags=re.S,
).rstrip()
updated_css = clean_css + "\n\n" + incoming_block + "\n"

timestamp = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
backup_dir = BACKUP_ROOT / f"{timestamp}-allim-mushaf-header-center"
backup_dir.mkdir(parents=True, exist_ok=False)
(backup_dir / "learn-page.json").write_text(
    json.dumps(page.as_dict(), ensure_ascii=False, indent=2, default=str),
    encoding="utf-8",
)
(backup_dir / "learn.css").write_text(existing_css, encoding="utf-8")
(backup_dir / "incoming-mushaf-header-center.css").write_text(
    incoming_block,
    encoding="utf-8",
)

page.css = updated_css
page.save(ignore_permissions=True)
frappe.db.commit()
frappe.clear_cache()

stored_css = frappe.get_doc("Web Page", page.name).css or ""
if stored_css.count(START_MARKER) != 1 or stored_css.count(END_MARKER) != 1:
    raise RuntimeError("Centered Mushaf header CSS did not persist exactly once")
if sha256(stored_css) != sha256(updated_css):
    raise RuntimeError("Stored CSS hash does not match the prepared CSS hash")

print(
    json.dumps(
        {
            "page": page.name,
            "route": page.route,
            "backup": str(backup_dir),
            "previous_css_sha256": sha256(existing_css),
            "published_css_sha256": sha256(stored_css),
            "marker_count": stored_css.count(START_MARKER),
        },
        ensure_ascii=False,
    )
)
