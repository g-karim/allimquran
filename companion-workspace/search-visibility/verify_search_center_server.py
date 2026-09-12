from __future__ import annotations

import json

import frappe


def main() -> None:
    doctypes = [
        "ALLIM Search Audit",
        "ALLIM Search Prompt",
        "ALLIM Search Observation",
        "ALLIM Search Opportunity",
    ]
    settings = frappe.get_single("LMS Settings")
    page = frappe.db.exists("Page", "allim-search-center")
    routes = {}
    for name in ("courses",):
        routes[name] = frappe.get_all("Website Meta Tag", filters={"parent": name}, fields=["key", "value"], order_by="idx asc")
    result = {
        "doctypes": {name: bool(frappe.db.exists("DocType", name)) for name in doctypes},
        "page": page,
        "prompt_count": frappe.db.count("ALLIM Search Prompt") if frappe.db.exists("DocType", "ALLIM Search Prompt") else None,
        "audit_count": frappe.db.count("ALLIM Search Audit") if frappe.db.exists("DocType", "ALLIM Search Audit") else None,
        "lms_settings": {
            "meta_description": settings.meta_description,
            "meta_image": settings.meta_image,
            "meta_keywords": settings.meta_keywords,
        },
        "route_meta": routes,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))


main()
