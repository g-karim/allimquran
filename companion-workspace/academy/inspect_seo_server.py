from __future__ import annotations

import json

import frappe


def field_names(doctype: str) -> list[str]:
    return [field.fieldname for field in frappe.get_meta(doctype).fields if field.fieldname]


def field_definitions(doctype: str) -> list[dict[str, str | None]]:
    return [
        {"fieldname": field.fieldname, "fieldtype": field.fieldtype, "options": field.options}
        for field in frappe.get_meta(doctype).fields
        if field.fieldname and ("meta" in field.fieldname or "index" in field.fieldname)
    ]


def main() -> None:
    result = {
        "web_page_fields": field_names("Web Page"),
        "website_settings_fields": field_names("Website Settings"),
        "website_route_meta_exists": bool(frappe.db.exists("DocType", "Website Route Meta")),
        "website_route_meta_fields": field_names("Website Route Meta") if frappe.db.exists("DocType", "Website Route Meta") else [],
        "web_page_meta_definitions": field_definitions("Web Page"),
        "website_route_meta_definitions": field_definitions("Website Route Meta") if frappe.db.exists("DocType", "Website Route Meta") else [],
        "blog_post_count": frappe.db.count("Blog Post") if frappe.db.exists("DocType", "Blog Post") else None,
        "blog_category_count": frappe.db.count("Blog Category") if frappe.db.exists("DocType", "Blog Category") else None,
        "public_pages": frappe.get_all(
            "Web Page",
            filters={"published": 1},
            fields=["route", "title", "meta_title", "meta_description", "modified"],
            order_by="route asc",
        ),
    }
    settings = frappe.get_single("Website Settings")
    for key in ("home_page", "robots_txt", "app_name", "app_logo", "favicon", "title_prefix", "enable_google_indexing"):
        if key in result["website_settings_fields"]:
            result.setdefault("website_settings", {})[key] = settings.get(key)
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))


main()
