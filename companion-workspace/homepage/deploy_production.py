from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import frappe


SITE = "allimquran.com"
BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")


def body_markup(document: str) -> str:
    match = re.search(r"<body[^>]*>(.*)</body>", document, flags=re.I | re.S)
    if not match:
        raise RuntimeError("Could not find the HTML body")
    body = match.group(1)
    body = re.sub(r"<script\b[^>]*\bsrc=[^>]*>\s*</script>", "", body, flags=re.I | re.S)
    return body.strip()


def page_shell(root_class: str, background: str) -> str:
    return f"""
body:has(.{root_class}) .navbar,
body:has(.{root_class}) .web-footer,
body:has(.{root_class}) footer:not(.site-footer),
body:has(.{root_class}) .page-header,
body:has(.{root_class}) .page-breadcrumbs {{ display: none !important; }}
body:has(.{root_class}) .page-content-wrapper,
body:has(.{root_class}) .web-page-content,
body:has(.{root_class}) .page_content,
body:has(.{root_class}) main.container {{ max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }}
body:has(.{root_class}) {{ margin: 0 !important; background: {background} !important; }}
"""


def snapshot_page(route: str) -> dict[str, object] | None:
    name = frappe.db.exists("Web Page", {"route": route})
    if not name:
        return None
    return frappe.get_doc("Web Page", name).as_dict()


def upsert_page(values: dict[str, object]) -> dict[str, object]:
    name = frappe.db.exists("Web Page", {"route": values["route"]})
    page = frappe.get_doc("Web Page", name) if name else frappe.new_doc("Web Page")
    page.update(values)
    page.flags.ignore_permissions = True
    page.save()
    return {
        "name": page.name,
        "route": page.route,
        "published": page.published,
        "modified": str(page.modified),
    }


def main() -> None:
    release_dir = Path(sys.argv[1])
    home_dir = release_dir / "homepage"
    app_dir = release_dir / "app"

    home_html = (home_dir / "index.html").read_text(encoding="utf-8")
    home_css = (home_dir / "styles.css").read_text(encoding="utf-8")
    home_js = (home_dir / "script.js").read_text(encoding="utf-8")
    app_html = (app_dir / "index.html").read_text(encoding="utf-8")
    app_css = (app_dir / "styles.css").read_text(encoding="utf-8")
    app_js = "\n\n".join(
        (app_dir / filename).read_text(encoding="utf-8")
        for filename in ("quran-data.js", "tafsir-data.js", "app.js")
    )

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = BACKUP_ROOT / f"{timestamp}-allim-home-learn"

    frappe.init(site=SITE, sites_path=".")
    frappe.connect()
    try:
        settings = frappe.get_single("Website Settings")
        backup = {
            "site": SITE,
            "created_at": timestamp,
            "website_settings": {
                "home_page": getattr(settings, "home_page", None),
                "home_page_is_website_page": getattr(settings, "home_page_is_website_page", None),
            },
            "pages": {
                "home": snapshot_page("home"),
                "learn": snapshot_page("learn"),
            },
        }
        backup_dir.mkdir(parents=True, exist_ok=False)
        (backup_dir / "records.json").write_text(frappe.as_json(backup, indent=2), encoding="utf-8")

        home_result = upsert_page(
            {
                "title": "ALLIM Qur’an",
                "route": "home",
                "published": 1,
                "content_type": "HTML",
                "main_section_html": '<div class="allim-web-root">' + body_markup(home_html) + "</div>",
                "insert_style": 1,
                "css": page_shell("allim-web-root", "#f6f4ef") + home_css,
                "javascript": home_js,
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
        learn_result = upsert_page(
            {
                "title": "ALLIM Qur’an Companion",
                "route": "learn",
                "published": 1,
                "content_type": "HTML",
                "main_section_html": '<div class="allim-app-root">' + body_markup(app_html) + "</div>",
                "insert_style": 1,
                "css": page_shell("allim-app-root", "#f7f5ef") + app_css,
                "javascript": app_js,
                "full_width": 1,
                "show_title": 0,
                "show_sidebar": 0,
                "enable_comments": 0,
                "meta_title": "ALLIM Qur’an Companion — Memorize, understand and review",
                "meta_description": (
                    "A developing Qur’an learning companion for recitation practice, memorization, "
                    "Qur’anic Arabic, source-attributed tafsir and personal progress."
                ),
            }
        )

        if settings.meta.has_field("home_page"):
            settings.home_page = "home"
        if settings.meta.has_field("home_page_is_website_page"):
            settings.home_page_is_website_page = 1
        settings.flags.ignore_permissions = True
        settings.save()

        frappe.db.commit()
        print(
            json.dumps(
                {
                    "backup": str(backup_dir),
                    "home": home_result,
                    "learn": learn_result,
                    "website_home_page": getattr(settings, "home_page", None),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    except Exception:
        frappe.db.rollback()
        raise
    finally:
        frappe.destroy()


if __name__ == "__main__":
    main()
