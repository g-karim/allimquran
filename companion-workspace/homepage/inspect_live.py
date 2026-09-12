from __future__ import annotations

import hashlib
import json

import frappe


SITE = "allimquran.com"


def digest(value: str | None) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


def main() -> None:
    frappe.init(site=SITE, sites_path="/home/frappe/frappe-bench/sites")
    frappe.connect()
    try:
        pages = []
        for route in ("home", "learn", "app", "allim-home-preview"):
            name = frappe.db.exists("Web Page", {"route": route})
            if not name:
                pages.append({"route": route, "exists": False})
                continue
            page = frappe.get_doc("Web Page", name)
            pages.append(
                {
                    "route": route,
                    "exists": True,
                    "name": page.name,
                    "published": page.published,
                    "modified": str(page.modified),
                    "html_sha256": digest(page.main_section_html),
                    "css_sha256": digest(page.css),
                    "javascript_sha256": digest(page.javascript),
                }
            )

        settings = frappe.get_single("Website Settings")
        print(
            json.dumps(
                {
                    "pages": pages,
                    "home_page": getattr(settings, "home_page", None),
                    "home_page_is_website_page": getattr(settings, "home_page_is_website_page", None),
                    "installed_apps": frappe.get_installed_apps(),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    finally:
        frappe.destroy()


if __name__ == "__main__":
    main()
