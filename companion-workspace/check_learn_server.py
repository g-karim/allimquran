import json
import re

import frappe


page_name = frappe.db.get_value("Web Page", {"route": "learn"}, "name")
page = frappe.get_doc("Web Page", page_name)
page_values = page.as_dict()
stored_html = page_values.get("main_section_html") or ""
stored_javascript = page_values.get("javascript") or ""
release_match = re.search(r'data-allim-release="([^"]+)"', stored_html)
html_fields = {
    key: len(value)
    for key, value in page_values.items()
    if isinstance(value, str)
    and ("mushaf-page-number" in value or "heart-mushaf" in value or "allim-web-root" in value)
}
print(
    json.dumps(
        {
            "name": page.name,
            "html_fields": html_fields,
            "release": release_match.group(1) if release_match else None,
            "javascript_length": len(stored_javascript),
            "has_font_select_in_javascript": "mushaf-font-select" in stored_javascript,
            "has_heart_engine": "recordHeartRecitation" in stored_javascript,
            "has_linked_33_engine": all(
                marker in stored_javascript
                for marker in ("LINKED_33_TARGET", "getLinked33PageSummary", "registerLinked33SegmentVerse")
            ),
            "has_method_selector": "data-hifz-method" in stored_html and "heart-stages-33" in stored_html,
            "fieldnames": sorted(page_values.keys()),
        },
        ensure_ascii=False,
    )
)
