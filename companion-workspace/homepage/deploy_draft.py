from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import frappe


SITE = "allimquran.com"
PAGE_TITLE = "ALLIM Home — Flagship Draft"
PAGE_ROUTE = "allim-home-preview"


def body_markup(document: str) -> str:
    match = re.search(r"<body[^>]*>(.*)</body>", document, flags=re.I | re.S)
    if not match:
        raise RuntimeError("Could not find the HTML body")
    body = match.group(1)
    body = re.sub(r"<script\b[^>]*\bsrc=[^>]*>\s*</script>", "", body, flags=re.I | re.S)
    return body.strip()


def main() -> None:
    source_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/allim-home-draft")
    html = (source_dir / "index.html").read_text(encoding="utf-8")
    css = (source_dir / "styles.css").read_text(encoding="utf-8")
    javascript = (source_dir / "script.js").read_text(encoding="utf-8")

    page_css = """
body:has(.allim-web-root) .navbar,
body:has(.allim-web-root) .web-footer,
body:has(.allim-web-root) footer:not(.site-footer),
body:has(.allim-web-root) .page-header,
body:has(.allim-web-root) .page-breadcrumbs { display: none !important; }
body:has(.allim-web-root) .page-content-wrapper,
body:has(.allim-web-root) .web-page-content,
body:has(.allim-web-root) .page_content,
body:has(.allim-web-root) main.container { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
body:has(.allim-web-root) { margin: 0 !important; background: #f7f4ec !important; }
""" + css

    markup = '<div class="allim-web-root">' + body_markup(html) + "</div>"

    frappe.init(site=SITE, sites_path="/home/frappe/frappe-bench/sites")
    frappe.connect()
    try:
        existing = frappe.db.exists("Web Page", {"route": PAGE_ROUTE})
        page = frappe.get_doc("Web Page", existing) if existing else frappe.new_doc("Web Page")
        page.update(
            {
                "title": PAGE_TITLE,
                "route": PAGE_ROUTE,
                "published": 0,
                "content_type": "HTML",
                "main_section_html": markup,
                "insert_style": 1,
                "css": page_css,
                "javascript": javascript,
                "full_width": 1,
                "show_title": 0,
                "show_sidebar": 0,
                "enable_comments": 0,
                "meta_title": "ALLIM — Memorize. Understand. Live the Qur’an.",
                "meta_description": (
                    "ALLIM is a Qur’an learning platform in development, bringing memorization, "
                    "understanding and lived reflection into one guided journey."
                ),
            }
        )
        page.flags.ignore_permissions = True
        page.save()
        frappe.db.commit()
        print(
            json.dumps(
                {
                    "name": page.name,
                    "route": page.route,
                    "published": page.published,
                    "modified": str(page.modified),
                },
                ensure_ascii=False,
            )
        )
    finally:
        frappe.destroy()


if __name__ == "__main__":
    main()
