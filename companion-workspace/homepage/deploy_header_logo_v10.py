from __future__ import annotations

import datetime as dt
import hashlib
import json
import shutil
from pathlib import Path

import frappe


SOURCE_ROOT = Path("/tmp/allim-header-v10")
BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")
PUBLIC_NAME = "allim-header-logo.png"
PUBLIC_URL = "/files/allim-header-logo.png?v=10"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


page_name = frappe.db.get_value("Web Page", {"route": "home"}, "name")
if not page_name:
    raise RuntimeError("Published page with route home was not found")

page = frappe.get_doc("Web Page", page_name)
source_path = SOURCE_ROOT / PUBLIC_NAME
if not source_path.exists():
    raise RuntimeError(f"Missing release asset: {source_path}")

content = page.main_section_html or ""
relative_source = 'src="allim-header-logo.png?v=10"'
public_source = f'src="{PUBLIC_URL}"'
if relative_source in content:
    updated_content = content.replace(relative_source, public_source, 1)
elif public_source in content:
    updated_content = content
else:
    raise RuntimeError("Expected ALLIM header logo marker was not found")

if updated_content.count(public_source) != 1:
    raise RuntimeError("ALLIM header logo must appear exactly once in the header")

timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
backup_dir = BACKUP_ROOT / f"{timestamp}-allim-header-logo-v10"
backup_dir.mkdir(parents=True, exist_ok=False)
(backup_dir / "home-web-page.json").write_text(
    json.dumps(page.as_dict(), ensure_ascii=False, indent=2, default=str),
    encoding="utf-8",
)

public_root = Path(frappe.get_site_path("public", "files"))
public_root.mkdir(parents=True, exist_ok=True)
target_path = public_root / PUBLIC_NAME
if target_path.exists():
    shutil.copy2(target_path, backup_dir / PUBLIC_NAME)

shutil.copy2(source_path, target_path)
page.main_section_html = updated_content
page.save(ignore_permissions=True)
frappe.db.commit()
frappe.clear_cache()

stored_page = frappe.get_doc("Web Page", page.name)
if public_source not in (stored_page.main_section_html or ""):
    raise RuntimeError("Public ALLIM header logo URL did not persist")
if sha256_file(target_path) != sha256_file(source_path):
    raise RuntimeError("Published ALLIM header logo hash mismatch")

print(
    json.dumps(
        {
            "page": page.name,
            "route": page.route,
            "backup": str(backup_dir),
            "asset": str(target_path),
            "sha256": sha256_file(target_path),
        },
        ensure_ascii=False,
    )
)
