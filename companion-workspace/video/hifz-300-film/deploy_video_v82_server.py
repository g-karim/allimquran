from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
import shutil
from pathlib import Path

import frappe


SOURCE_ROOT = Path("/tmp/allim-hifz-video-v82")
BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")
VERSION = "82"
PUBLIC_FILES = {
    "ALLIM-Quran-v-serdtse-300-RU-1080p.mp4": "allim-quran-companion-ru.mp4",
    "ALLIM-Quran-v-serdtse-300-RU-poster.jpg": "allim-quran-companion-ru-poster.jpg",
    "ALLIM-Quran-v-serdtse-300-RU.vtt": "allim-quran-companion-ru.vtt",
}


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
javascript = page.javascript or ""
timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
backup_dir = BACKUP_ROOT / f"{timestamp}-allim-hifz-video-v82"
backup_dir.mkdir(parents=True, exist_ok=False)
(backup_dir / "home-web-page.json").write_text(
    json.dumps(page.as_dict(), ensure_ascii=False, indent=2, default=str),
    encoding="utf-8",
)

public_root = Path(frappe.get_site_path("public", "files"))
public_root.mkdir(parents=True, exist_ok=True)
incoming_hashes = {}
for source_name, public_name in PUBLIC_FILES.items():
    source_path = SOURCE_ROOT / source_name
    if not source_path.exists():
        raise RuntimeError(f"Missing release asset: {source_path}")
    target_path = public_root / public_name
    if target_path.exists():
        shutil.copy2(target_path, backup_dir / public_name)
    shutil.copy2(source_path, target_path)
    incoming_hashes[public_name] = sha256_file(source_path)

for filename in PUBLIC_FILES.values():
    pattern = rf"(/files/{re.escape(filename)}\?v=)\d+"
    javascript, count = re.subn(pattern, rf"\g<1>{VERSION}", javascript)
    if count != 1:
        raise RuntimeError(f"Expected one versioned reference for {filename}, found {count}")

page.javascript = javascript
page.save(ignore_permissions=True)
frappe.db.commit()
frappe.clear_cache()

stored = frappe.get_doc("Web Page", page.name)
for public_name, expected_hash in incoming_hashes.items():
    marker = f"/files/{public_name}?v={VERSION}"
    if marker not in (stored.javascript or ""):
        raise RuntimeError(f"Version marker did not persist: {marker}")
    target_path = public_root / public_name
    if sha256_file(target_path) != expected_hash:
        raise RuntimeError(f"Published file hash mismatch: {public_name}")

print(
    json.dumps(
        {
            "page": page.name,
            "route": page.route,
            "backup": str(backup_dir),
            "version": VERSION,
            "public_files": incoming_hashes,
        },
        ensure_ascii=False,
    )
)
