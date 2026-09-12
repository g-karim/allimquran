from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path


HOOKS = Path("/home/frappe/frappe-bench/apps/allimquran/allimquran/hooks.py")
BACKUPS = Path("/home/frappe/frappe-bench/sites/deploy-backups")
LINE = 'update_website_context = ["allimquran.search_intelligence.extend_website_context"]'


def main() -> None:
    source = HOOKS.read_text(encoding="utf-8")
    if LINE in source:
        print("already-present")
        return
    marker = "# ALLIM SEARCH INTELLIGENCE END"
    if marker not in source:
        raise RuntimeError("Search intelligence hook marker is missing.")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = BACKUPS / f"{timestamp}-allim-search-hooks.py"
    shutil.copy2(HOOKS, backup)
    HOOKS.write_text(source.replace(marker, LINE + "\n" + marker, 1), encoding="utf-8")
    shutil.chown(HOOKS, user="frappe", group="frappe")
    print(str(backup))


main()
