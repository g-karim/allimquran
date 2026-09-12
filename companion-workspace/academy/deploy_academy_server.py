from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import frappe


SITE = "allimquran.com"
BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")
SEO_HEAD_START = "<!-- ALLIM SEO START -->"
SEO_HEAD_END = "<!-- ALLIM SEO END -->"


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
    return frappe.get_doc("Web Page", name).as_dict() if name else None


def upsert_page(values: dict[str, object]) -> dict[str, object]:
    name = frappe.db.exists("Web Page", {"route": values["route"]})
    page = frappe.get_doc("Web Page", name) if name else frappe.new_doc("Web Page")
    page.update(values)
    page.flags.ignore_permissions = True
    page.save()
    return {"name": page.name, "route": page.route, "published": page.published, "modified": str(page.modified)}


def replace_tokens(template: str, values: dict[str, object]) -> str:
    result = template
    for key, value in values.items():
        result = result.replace("{{" + key + "}}", str(value))
    remaining = sorted(set(re.findall(r"\{\{([A-Z0-9_]+)\}\}", result)))
    if remaining:
        raise RuntimeError("Unresolved template tokens: " + ", ".join(remaining))
    return result


def schema_markup(payload: dict[str, object]) -> str:
    return '<script type="application/ld+json">' + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "</script>"


def upsert_route_meta(route: str, values: dict[str, str]) -> None:
    name = frappe.db.exists("Website Route Meta", route)
    document = frappe.get_doc("Website Route Meta", name) if name else frappe.new_doc("Website Route Meta")
    if not name:
        document.name = route
    document.set("meta_tags", [])
    for key, value in values.items():
        document.append("meta_tags", {"key": key, "value": value})
    document.flags.ignore_permissions = True
    document.save()


def load_blog_content(path: Path) -> tuple[dict[str, object], dict[str, object], list[str]]:
    namespace: dict[str, object] = {}
    exec(compile(path.read_text(encoding="utf-8"), str(path), "exec"), namespace, namespace)
    return namespace["LOCALES"], namespace["ARTICLES"], namespace["ARTICLE_ORDER"]


def render_toc(items: list[tuple[str, str]]) -> str:
    return "".join(f'<a href="#{anchor}">{label}</a>' for anchor, label in items)


def render_faq(items: list[tuple[str, str]]) -> str:
    return "".join(f'<article class="faq-item"><h3>{question}</h3><p>{answer}</p></article>' for question, answer in items)


def render_sources(items: list[tuple[str, str]]) -> str:
    return "<ul>" + "".join(f'<li><a href="{url}" target="_blank" rel="noopener noreferrer">{label}</a></li>' for label, url in items) + "</ul>"


def render_locale_links(article: dict[str, object], locales: dict[str, object]) -> str:
    labels = {"en": "EN", "ar": "AR", "ru": "RU"}
    return "".join(
        f'<a href="{article["routes"][code]}" hreflang="{locales[code]["lang"]}" lang="{locales[code]["lang"]}">{labels[code]}</a>'
        for code in ("en", "ar", "ru")
    )


def article_schema(route: str, locale: dict[str, object], article: dict[str, object]) -> dict[str, object]:
    url = "https://allimquran.com" + route
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Article",
                "@id": url + "#article",
                "headline": article["title"],
                "description": article["meta_description"],
                "datePublished": "2026-09-03",
                "dateModified": "2026-09-03",
                "inLanguage": locale["lang"],
                "mainEntityOfPage": {"@type": "WebPage", "@id": url},
                "author": {"@type": "Organization", "name": "ALLIM Learning Team", "url": "https://allimquran.com/"},
                "publisher": {"@type": "Organization", "name": "ALLIM Qur’an", "url": "https://allimquran.com/"},
            },
            {
                "@type": "FAQPage",
                "@id": url + "#faq",
                "inLanguage": locale["lang"],
                "mainEntity": [
                    {"@type": "Question", "name": question, "acceptedAnswer": {"@type": "Answer", "text": answer}}
                    for question, answer in article["faq"]
                ],
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": locale["nav_home"], "item": "https://allimquran.com/"},
                    {"@type": "ListItem", "position": 2, "name": locale["nav_insights"], "item": "https://allimquran.com" + locale["hub"]},
                    {"@type": "ListItem", "position": 3, "name": article["title"], "item": url},
                ],
            },
        ],
    }


def render_blog_pages(blog_dir: Path) -> list[dict[str, object]]:
    locales, articles, order = load_blog_content(blog_dir / "content.py")
    hub_template = (blog_dir / "index.html").read_text(encoding="utf-8")
    article_template = (blog_dir / "article.html").read_text(encoding="utf-8")
    css = (blog_dir / "styles.css").read_text(encoding="utf-8")
    javascript = (blog_dir / "script.js").read_text(encoding="utf-8")
    rendered: list[dict[str, object]] = []

    for locale_code, locale in locales.items():
        cards = []
        for number, key in enumerate(order, start=1):
            item = articles[key]
            copy = item["content"][locale_code]
            cards.append(
                f'<article class="article-card"><a href="{item["routes"][locale_code]}"><span class="card-number">{number:02d}</span><h3>{copy["title"]}</h3><p>{copy["deck"]}</p><span class="read-more">{locale["read_more"]} →</span></a></article>'
            )
        hub_html = replace_tokens(hub_template, {
            "LANG": locale["lang"], "DIR": locale["dir"], "LOCALE": locale_code,
            "META_TITLE": locale["hub_meta_title"], "META_DESCRIPTION": locale["hub_meta_description"],
            "SKIP": locale["skip"], "NAV_LABEL": locale["nav_label"], "NAV_HOME": locale["nav_home"], "NAV_COMPANION": locale["nav_companion"], "NAV_ACADEMY": locale["nav_academy"], "NAV_INSIGHTS": locale["nav_insights"], "LANGUAGE_LABEL": locale["language_label"], "MENU_LABEL": locale["menu_label"], "HUB_ROUTE": locale["hub"],
            "EYEBROW": locale["eyebrow"], "TITLE": locale["title"], "LEAD": locale["lead"],
            "FEATURED_KIND": locale["featured_kind"], "FEATURED_TITLE": locale["featured_title"], "FEATURED_EXCERPT": locale["featured_excerpt"], "READ_GUIDE": locale["read_guide"], "FEATURED_ROUTE": articles["alphabet"]["routes"][locale_code], "FEATURED_VISUAL_LABEL": locale["featured_visual_label"], "FEATURED_VISUAL_TEXT": locale["featured_visual_text"],
            "LIBRARY_EYEBROW": locale["library_eyebrow"], "LIBRARY_TITLE": locale["library_title"], "ARTICLE_CARDS": "".join(cards),
            "TRUST_EYEBROW": locale["trust_eyebrow"], "TRUST_TITLE": locale["trust_title"], "TRUST_ONE": locale["trust_one"], "TRUST_TWO": locale["trust_two"], "TRUST_THREE": locale["trust_three"],
            "CTA_TITLE": locale["cta_title"], "CTA_TEXT": locale["cta_text"], "CTA_ACTION": locale["cta_action"], "BACK_HOME": locale["back_home"],
        })
        hub_route = locale["hub"]
        hub_schema = {
            "@context": "https://schema.org", "@type": "CollectionPage", "@id": "https://allimquran.com" + hub_route,
            "name": locale["hub_meta_title"], "description": locale["hub_meta_description"], "inLanguage": locale["lang"],
            "isPartOf": {"@id": "https://allimquran.com/#website"},
            "mainEntity": {"@type": "ItemList", "itemListElement": [
                {"@type": "ListItem", "position": number, "url": "https://allimquran.com" + articles[key]["routes"][locale_code], "name": articles[key]["content"][locale_code]["title"]}
                for number, key in enumerate(order, start=1)
            ]},
        }
        rendered.append({"route": hub_route.lstrip("/"), "title": locale["hub_meta_title"], "description": locale["hub_meta_description"], "html": body_markup(hub_html) + schema_markup(hub_schema), "css": css, "javascript": javascript, "language": locale["lang"], "type": "website"})

        for index, key in enumerate(order):
            item = articles[key]
            copy = item["content"][locale_code]
            next_item = articles[order[(index + 1) % len(order)]]
            next_copy = next_item["content"][locale_code]
            ui = locale["article"]
            article_html = replace_tokens(article_template, {
                "LANG": locale["lang"], "DIR": locale["dir"], "LOCALE": locale_code,
                "META_TITLE": copy["title"] + " — ALLIM Qur’an", "META_DESCRIPTION": copy["meta_description"],
                "SKIP": locale["skip"], "NAV_LABEL": locale["nav_label"], "NAV_HOME": locale["nav_home"], "NAV_COMPANION": locale["nav_companion"], "NAV_ACADEMY": locale["nav_academy"], "NAV_INSIGHTS": locale["nav_insights"], "LANGUAGE_LABEL": locale["language_label"], "MENU_LABEL": locale["menu_label"], "HUB_ROUTE": locale["hub"], "LOCALE_LINKS": render_locale_links(item, locales),
                "BREADCRUMB_LABEL": ui["breadcrumb_label"], "CATEGORY": copy["category"], "TITLE": copy["title"], "DECK": copy["deck"], "AUTHOR": ui["author"], "DATE_ISO": ui["date_iso"], "DATE_LABEL": ui["date_label"], "READ_TIME": copy["read_time"],
                "IN_THIS_GUIDE": ui["in_this_guide"], "TOC": render_toc(copy["toc"]), "METHOD_NOTE": ui["method_note"], "SHORT_ANSWER_LABEL": ui["short_answer_label"], "SHORT_ANSWER": copy["short_answer"], "BODY": copy["body"],
                "FAQ_LABEL": ui["faq_label"], "FAQ_TITLE": ui["faq_title"], "FAQ": render_faq(copy["faq"]), "SOURCES_TITLE": ui["sources_title"], "SOURCES": render_sources(copy["sources"]), "AUTHORSHIP_TITLE": ui["authorship_title"], "AUTHORSHIP_TEXT": ui["authorship_text"],
                "NEXT_EYEBROW": ui["next_eyebrow"], "NEXT_TITLE": next_copy["title"], "NEXT_ROUTE": next_item["routes"][locale_code], "NEXT_ACTION": ui["next_action"], "BACK_BLOG": ui["back_blog"],
            })
            route = item["routes"][locale_code]
            rendered.append({"route": route.lstrip("/"), "title": copy["title"], "description": copy["meta_description"], "html": body_markup(article_html) + schema_markup(article_schema(route, locale, copy)), "css": css, "javascript": javascript, "language": locale["lang"], "type": "article"})
    return rendered


def update_website_search_settings(route_groups: list[list[str]]) -> None:
    settings = frappe.get_single("Website Settings")
    settings.title_prefix = "ALLIM Qur’an"
    settings.app_name = "ALLIM Qur’an"
    settings.robots_txt = "User-agent: *\nAllow: /\n\nSitemap: https://allimquran.com/sitemap.xml\n"
    if not any((row.source or "").strip() == "/home" for row in settings.route_redirects):
        settings.append("route_redirects", {"source": "/home", "target": "/", "redirect_http_status": "301", "forward_query_parameters": 1})

    language_map = json.dumps(route_groups, ensure_ascii=False, separators=(",", ":"))
    seo_script = f'''{SEO_HEAD_START}
<script data-allim-seo="1">(function(){{
var path=(location.pathname.replace(/\\/+$/,"")||"/");
var canonical=document.createElement("link");canonical.rel="canonical";canonical.href=location.origin+path;document.head.appendChild(canonical);
var groups={language_map};var group=groups.find(function(items){{return items.indexOf(path)>=0;}});
if(group){{var codes=["en","ar","ru"];group.forEach(function(route,index){{var link=document.createElement("link");link.rel="alternate";link.hreflang=codes[index];link.href=location.origin+route;document.head.appendChild(link);}});var fallback=document.createElement("link");fallback.rel="alternate";fallback.hreflang="x-default";fallback.href=location.origin+group[0];document.head.appendChild(fallback);}}
}})();</script>
{SEO_HEAD_END}'''
    current = settings.head_html or ""
    current = re.sub(re.escape(SEO_HEAD_START) + r".*?" + re.escape(SEO_HEAD_END), "", current, flags=re.S).rstrip()
    settings.head_html = (current + "\n" + seo_script).strip()
    settings.flags.ignore_permissions = True
    settings.save()


def update_learning_workspace() -> dict[str, object] | None:
    if not frappe.db.exists("Workspace", "Learning"):
        return None
    workspace = frappe.get_doc("Workspace", "Learning")
    try:
        content = json.loads(workspace.content or "[]")
    except json.JSONDecodeError:
        content = []
    content = [item for item in content if not str(item.get("id", "")).startswith("allim-academy-")]
    intro = [
        {
            "id": "allim-academy-title",
            "type": "header",
            "data": {"text": '<span class="h4"><b>ALLIM Qur’an Academy</b></span>', "col": 12},
        },
        {
            "id": "allim-academy-student",
            "type": "paragraph",
            "data": {"text": '<a href="/academy">Открыть кабинет ученика</a>', "col": 4},
        },
        {
            "id": "allim-academy-portal",
            "type": "paragraph",
            "data": {"text": '<a href="/lms/courses">Открыть учебные программы</a>', "col": 4},
        },
        {
            "id": "allim-academy-note",
            "type": "paragraph",
            "data": {"text": "Служебная область Академии. Кабинет ученика отделён для защиты учебных и личных данных.", "col": 4},
        },
        {"id": "allim-academy-spacer", "type": "spacer", "data": {"col": 12}},
    ]
    workspace.title = "ALLIM Academy"
    workspace.content = json.dumps(intro + content, ensure_ascii=False, separators=(",", ":"))
    workspace.flags.ignore_permissions = True
    workspace.save()
    return {"name": workspace.name, "title": workspace.title, "modified": str(workspace.modified)}


def main(release_path: str = "/tmp/allim-academy-release") -> None:
    release_dir = Path(release_path)
    home_dir = release_dir / "homepage"
    app_dir = release_dir / "app"
    academy_dir = release_dir / "academy"
    blog_dir = release_dir / "blog"

    home_html = (home_dir / "index.html").read_text(encoding="utf-8")
    home_css = (home_dir / "styles.css").read_text(encoding="utf-8")
    home_js = (home_dir / "script.js").read_text(encoding="utf-8")
    app_html = (app_dir / "index.html").read_text(encoding="utf-8")
    app_css = (app_dir / "styles.css").read_text(encoding="utf-8")
    app_js = "\n\n".join((app_dir / name).read_text(encoding="utf-8") for name in ("quran-data.js", "tafsir-data.js", "app.js"))
    academy_html = (academy_dir / "index.html").read_text(encoding="utf-8")
    academy_css = (academy_dir / "styles.css").read_text(encoding="utf-8")
    academy_js = (academy_dir / "script.js").read_text(encoding="utf-8")
    blog_pages = render_blog_pages(blog_dir)
    target_routes = ["home", "learn", "academy"] + [page["route"] for page in blog_pages]

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = BACKUP_ROOT / f"{timestamp}-allim-academy"

    frappe.init(site=SITE, sites_path=".")
    frappe.connect()
    try:
        backup = {
            "site": SITE,
            "created_at": timestamp,
            "pages": {route: snapshot_page(route) for route in target_routes},
            "route_meta": {route: frappe.get_doc("Website Route Meta", route).as_dict() if frappe.db.exists("Website Route Meta", route) else None for route in target_routes},
            "website_settings": {
                "enable_google_indexing": frappe.get_single("Website Settings").enable_google_indexing,
                "title_prefix": frappe.get_single("Website Settings").title_prefix,
                "app_name": frappe.get_single("Website Settings").app_name,
                "robots_txt": frappe.get_single("Website Settings").robots_txt,
                "head_html": frappe.get_single("Website Settings").head_html,
                "route_redirects": [row.as_dict() for row in frappe.get_single("Website Settings").route_redirects],
            },
            "workspace": frappe.get_doc("Workspace", "Learning").as_dict()
            if frappe.db.exists("Workspace", "Learning")
            else None,
        }
        backup_dir.mkdir(parents=True, exist_ok=False)
        (backup_dir / "records.json").write_text(frappe.as_json(backup, indent=2), encoding="utf-8")

        home = upsert_page({
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
            "meta_title": "ALLIM Qur’an — Memorize, understand and live the Qur’an",
            "meta_description": "ALLIM connects Qur’an recitation, memorization, Qur’anic Arabic, source-attributed tafsir and guided learning in one focused path.",
        })
        learn = upsert_page({
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
            "meta_title": "ALLIM Qur’an Companion — Recite, memorize and understand",
            "meta_description": "Practice Qur’an recitation, build hifz, review on time, study Qur’anic words and read source-attributed tafsir in one learning companion.",
        })
        academy = upsert_page({
            "title": "ALLIM Qur’an Academy — Student Cabinet",
            "route": "academy",
            "published": 1,
            "content_type": "HTML",
            "main_section_html": '<div class="allim-academy-root">' + body_markup(academy_html) + "</div>",
            "insert_style": 1,
            "css": page_shell("allim-academy-root", "#f4f2ec") + academy_css,
            "javascript": academy_js,
            "full_width": 1,
            "show_title": 0,
            "show_sidebar": 0,
            "enable_comments": 0,
            "meta_title": "Student Cabinet — ALLIM Qur’an Academy",
            "meta_description": "A private Qur’an learning cabinet with a personal plan, Companion progress, enrolled courses and teacher-guided learning when connected.",
        })
        published_blog_pages = []
        for page in blog_pages:
            published_blog_pages.append(upsert_page({
                "title": page["title"],
                "route": page["route"],
                "published": 1,
                "content_type": "HTML",
                "main_section_html": '<div class="allim-insights-root">' + page["html"] + "</div>",
                "insert_style": 1,
                "css": page_shell("allim-insights-root", "#f6f4ee") + page["css"],
                "javascript": page["javascript"],
                "full_width": 1,
                "show_title": 0,
                "show_sidebar": 0,
                "enable_comments": 0,
                "meta_title": page["title"],
                "meta_description": page["description"],
            }))

        locales, articles, order = load_blog_content(blog_dir / "content.py")
        route_groups = [[articles[key]["routes"][code] for code in ("en", "ar", "ru")] for key in order]
        route_groups.insert(0, [locales[code]["hub"] for code in ("en", "ar", "ru")])
        update_website_search_settings(route_groups)
        for route in target_routes:
            page_language = next((page["language"] for page in blog_pages if page["route"] == route), "en")
            upsert_route_meta(route, {
                "robots": "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
                "og:site_name": "ALLIM Qur’an",
                "og:type": "article" if any(page["route"] == route and page["type"] == "article" for page in blog_pages) else "website",
                "og:locale": {"en": "en_US", "ar": "ar_SA", "ru": "ru_RU"}.get(page_language, "en_US"),
            })
        workspace = update_learning_workspace()
        frappe.db.commit()
        print(json.dumps({"backup": str(backup_dir), "home": home, "learn": learn, "academy": academy, "blog_pages": published_blog_pages, "workspace": workspace, "crawlable": True, "google_indexing_api": bool(frappe.db.get_single_value("Website Settings", "enable_google_indexing"))}, ensure_ascii=False, indent=2))
    except Exception:
        frappe.db.rollback()
        raise
    finally:
        frappe.destroy()


if __name__ == "__main__":
    main()
