from __future__ import annotations

import json
from pathlib import Path

import frappe

from allimquran.source import CONTENT, fingerprint


DOCTYPES = (
    "allim_search_audit",
    "allim_search_prompt",
    "allim_search_observation",
    "allim_search_opportunity",
)


def main() -> None:
    path = CONTENT / "migration_baseline.json"
    baseline = json.loads(path.read_text(encoding="utf-8"))
    updated = []
    for scrubbed in DOCTYPES:
        source = json.loads((CONTENT.parent / "allim_quran" / "doctype" / scrubbed / f"{scrubbed}.json").read_text(encoding="utf-8"))
        source.pop("field_order", None)
        name = source["name"]
        if not frappe.db.exists("DocType", name):
            continue
        key = f"DocType:{name}"
        baseline[key] = fingerprint(frappe.get_doc("DocType", name), source)
        updated.append(key)
    path.write_text(json.dumps(baseline, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"updated": updated, "baseline": str(path)}, ensure_ascii=False, indent=2))


main()
