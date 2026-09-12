from __future__ import annotations

import hashlib
import json


def digest(value: str | None) -> str:
    return __import__("hashlib").sha256((value or "").encode("utf-8")).hexdigest()


page_name = frappe.db.get_value("Web Page", {"route": "home"}, "name")
if not page_name:
    raise RuntimeError("Published page with route home was not found")

page = frappe.get_doc("Web Page", page_name)
print(
    json.dumps(
        {
            "page": page.name,
            "route": page.route,
            "published": page.published,
            "modified": str(page.modified),
            "hashes": {
                "content": digest(page.main_section_html),
                "css": digest(page.css),
                "javascript": digest(page.javascript),
            },
        },
        ensure_ascii=False,
    )
)
