from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from pathlib import Path

import frappe


SOURCE_ROOT = Path("/tmp/allim-blog-v50-digital-mushaf")
BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")
SEO_HEAD_START = "<!-- ALLIM SEO START -->"
SEO_HEAD_END = "<!-- ALLIM SEO END -->"


def read_text(name: str) -> str:
    return (SOURCE_ROOT / name).read_text(encoding="utf-8")


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def body_markup(document: str) -> str:
    match = re.search(r"<body[^>]*>(.*)</body>", document, flags=re.I | re.S)
    if not match:
        raise RuntimeError("Could not find the HTML body")
    return re.sub(
        r"<script\b[^>]*\bsrc=[^>]*>\s*</script>",
        "",
        match.group(1),
        flags=re.I | re.S,
    ).strip()


def page_shell() -> str:
    return """
body:has(.allim-insights-root) .navbar,
body:has(.allim-insights-root) .web-footer,
body:has(.allim-insights-root) footer:not(.site-footer),
body:has(.allim-insights-root) .page-header,
body:has(.allim-insights-root) .page-breadcrumbs { display: none !important; }
body:has(.allim-insights-root) .page-content-wrapper,
body:has(.allim-insights-root) .web-page-content,
body:has(.allim-insights-root) .page_content,
body:has(.allim-insights-root) main.container { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
body:has(.allim-insights-root) { margin: 0 !important; background: #f6f4ee !important; }
""".strip()


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


def seo_page_title(value: str) -> str:
    return re.sub(r"\s*(?:\||—)\s*ALLIM(?: QURAN| Qur’an)\s*$", "", value, flags=re.I).strip()


def load_content() -> tuple[dict[str, object], dict[str, object], list[str], dict[str, object]]:
    namespace: dict[str, object] = {}
    path = SOURCE_ROOT / "content.py"
    exec(compile(path.read_text(encoding="utf-8"), str(path), "exec"), namespace, namespace)
    addon_namespace: dict[str, object] = {}
    addon_path = SOURCE_ROOT / "digital_mushaf_content.py"
    exec(compile(addon_path.read_text(encoding="utf-8"), str(addon_path), "exec"), addon_namespace, addon_namespace)
    locales = namespace["LOCALES"]
    articles = namespace["ARTICLES"]
    order = namespace["ARTICLE_ORDER"]
    turkish_locale, digital_mushaf = addon_namespace["build_addon"](SOURCE_ROOT)
    locales["tr"] = turkish_locale
    for code, values in addon_namespace["FEATURED_OVERRIDES"].items():
        locales[code].update(values)
    articles[addon_namespace["ARTICLE_KEY"]] = digital_mushaf
    if addon_namespace["ARTICLE_KEY"] not in order:
        order.append(addon_namespace["ARTICLE_KEY"])
    return locales, articles, order, addon_namespace


def render_toc(items: list[tuple[str, str]]) -> str:
    return "".join(f'<a href="#{anchor}">{label}</a>' for anchor, label in items)


def render_faq(items: list[tuple[str, str]]) -> str:
    return "".join(f'<article class="faq-item"><h3>{question}</h3><p>{answer}</p></article>' for question, answer in items)


def render_sources(items: list[tuple[str, str]]) -> str:
    return '<p class="basis-links">' + '<span aria-hidden="true"> · </span>'.join(
        f'<a href="{url}" target="_blank" rel="noopener noreferrer">{label}</a>' for label, url in items
    ) + "</p>"


def render_locale_links(article: dict[str, object], locales: dict[str, object]) -> str:
    labels = {"en": "EN", "ar": "AR", "ru": "RU", "tr": "TR"}
    return "".join(
        f'<a href="{article["routes"][code]}" hreflang="{locales[code]["lang"]}" lang="{locales[code]["lang"]}">{labels[code]}</a>'
        for code in ("en", "ar", "ru", "tr")
        if code in article["routes"] and code in article["content"]
    )


def render_hub_locale_links(locales: dict[str, object]) -> str:
    return "".join(
        f'<a href="{locales[code]["hub"]}" hreflang="{locales[code]["lang"]}" lang="{locales[code]["lang"]}">{code.upper()}</a>'
        for code in ("en", "ar", "ru", "tr")
        if code in locales
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
                "datePublished": article.get("date_iso", "2026-09-03"),
                "dateModified": article.get("date_iso", "2026-09-03"),
                "inLanguage": locale["lang"],
                "mainEntityOfPage": {"@type": "WebPage", "@id": url},
                "author": {"@type": "Organization", "name": article.get("author", "ALLIM Learning Team"), "url": "https://allimquran.com/"},
                "publisher": {"@type": "Organization", "name": "ALLIM QURAN", "url": "https://allimquran.com/"},
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


def render_pages() -> tuple[list[dict[str, object]], list[list[dict[str, str]]]]:
    locales, articles, order, addon = load_content()
    hub_template = read_text("index.html")
    article_template = read_text("article.html")
    css = page_shell() + "\n\n" + read_text("styles.css")
    javascript = read_text("script.js")
    pages: list[dict[str, object]] = []

    for locale_code, locale in locales.items():
        available_order = [key for key in order if locale_code in articles[key]["content"] and locale_code in articles[key]["routes"]]
        cards = []
        for number, key in enumerate(available_order, start=1):
            item = articles[key]
            copy = item["content"][locale_code]
            cards.append(
                f'<article class="article-card" data-article-key="{key}"><a href="{item["routes"][locale_code]}"><span class="card-number">{number:02d}</span>{addon["render_card_visual"](key)}<h3>{copy["title"]}</h3><p>{copy["deck"]}</p><span class="read-more">{locale["read_more"]} <span aria-hidden="true">→</span></span></a></article>'
            )
        featured_key = addon["ARTICLE_KEY"]
        hub_html = replace_tokens(hub_template, {
            "LANG": locale["lang"], "DIR": locale["dir"], "LOCALE": locale_code,
            "META_TITLE": locale["hub_meta_title"], "META_DESCRIPTION": locale["hub_meta_description"],
            "SKIP": locale["skip"], "NAV_LABEL": locale["nav_label"], "NAV_HOME": locale["nav_home"], "NAV_COMPANION": locale["nav_companion"], "NAV_ACADEMY": locale["nav_academy"], "NAV_INSIGHTS": locale["nav_insights"], "LANGUAGE_LABEL": locale["language_label"], "MENU_LABEL": locale["menu_label"], "HUB_ROUTE": locale["hub"], "HUB_LOCALE_LINKS": render_hub_locale_links(locales),
            "EYEBROW": locale["eyebrow"], "TITLE": locale["title"], "LEAD": locale["lead"],
            "FEATURED_KIND": locale["featured_kind"], "FEATURED_TITLE": locale["featured_title"], "FEATURED_EXCERPT": locale["featured_excerpt"], "READ_GUIDE": locale["read_guide"], "FEATURED_ROUTE": articles[featured_key]["routes"][locale_code], "FEATURED_VISUAL_LABEL": locale["featured_visual_label"], "FEATURED_VISUAL_TEXT": locale["featured_visual_text"], "FEATURED_VISUAL": addon["FEATURED_VISUAL"],
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
                for number, key in enumerate(available_order, start=1)
            ]},
        }
        pages.append({"route": hub_route.lstrip("/"), "title": seo_page_title(locale["hub_meta_title"]), "description": locale["hub_meta_description"], "html": body_markup(hub_html) + schema_markup(hub_schema), "css": css, "javascript": javascript, "language": locale["lang"], "type": "website"})

        for index, key in enumerate(available_order):
            item = articles[key]
            copy = item["content"][locale_code]
            if len(available_order) > 1:
                next_key = available_order[(index + 1) % len(available_order)]
                next_item = articles[next_key]
                next_copy = next_item["content"][locale_code]
                next_title = next_copy["title"]
                next_route = next_item["routes"][locale_code]
                next_action = locale["article"]["next_action"]
            else:
                next_title = locale["title"]
                next_route = locale["hub"]
                next_action = locale["article"]["back_blog"]
            ui = locale["article"]
            article_html = replace_tokens(article_template, {
                "LANG": locale["lang"], "DIR": locale["dir"], "LOCALE": locale_code,
                "META_TITLE": copy.get("seo_title", copy["title"] + " — ALLIM QURAN"), "META_DESCRIPTION": copy["meta_description"],
                "SKIP": locale["skip"], "NAV_LABEL": locale["nav_label"], "NAV_HOME": locale["nav_home"], "NAV_COMPANION": locale["nav_companion"], "NAV_ACADEMY": locale["nav_academy"], "NAV_INSIGHTS": locale["nav_insights"], "LANGUAGE_LABEL": locale["language_label"], "MENU_LABEL": locale["menu_label"], "HUB_ROUTE": locale["hub"], "LOCALE_LINKS": render_locale_links(item, locales),
                "BREADCRUMB_LABEL": ui["breadcrumb_label"], "CATEGORY": copy["category"], "TITLE": copy["title"], "DECK": copy["deck"], "AUTHOR": copy.get("author", ui["author"]), "DATE_ISO": copy.get("date_iso", ui["date_iso"]), "DATE_LABEL": copy.get("date_label", ui["date_label"]), "READ_TIME": copy["read_time"],
                "IN_THIS_GUIDE": ui["in_this_guide"], "TOC": render_toc(copy["toc"]), "METHOD_NOTE": ui["method_note"], "SHORT_ANSWER_LABEL": ui["short_answer_label"], "SHORT_ANSWER": copy["short_answer"], "BODY": copy["body"],
                "FAQ_LABEL": ui["faq_label"], "FAQ_TITLE": ui["faq_title"], "FAQ": render_faq(copy["faq"]), "SOURCES_TITLE": copy.get("sources_title", ui["sources_title"]), "SOURCES": render_sources(copy["sources"]), "AUTHORSHIP_TITLE": copy.get("authorship_title", ui["authorship_title"]), "AUTHORSHIP_TEXT": copy.get("authorship_text", ui["authorship_text"]),
                "NEXT_EYEBROW": ui["next_eyebrow"], "NEXT_TITLE": next_title, "NEXT_ROUTE": next_route, "NEXT_ACTION": next_action, "BACK_BLOG": ui["back_blog"],
            })
            route = item["routes"][locale_code]
            pages.append({"route": route.lstrip("/"), "title": seo_page_title(copy.get("seo_title", copy["title"])), "description": copy["meta_description"], "html": body_markup(article_html) + schema_markup(article_schema(route, locale, copy)), "css": css, "javascript": javascript, "language": locale["lang"], "type": "article"})

    route_groups = [[{"code": code, "route": locales[code]["hub"]} for code in ("en", "ar", "ru", "tr") if code in locales]]
    route_groups.extend([
        [{"code": code, "route": articles[key]["routes"][code]} for code in ("en", "ar", "ru", "tr") if code in articles[key]["routes"]]
        for key in order
    ])
    return pages, route_groups


def upsert_page(values: dict[str, object]) -> dict[str, object]:
    name = frappe.db.exists("Web Page", {"route": values["route"]})
    page = frappe.get_doc("Web Page", name) if name else frappe.new_doc("Web Page")
    page.update(values)
    page.flags.ignore_permissions = True
    page.save()
    return {"name": page.name, "route": page.route, "modified": str(page.modified)}


def upsert_route_meta(route: str, page_language: str, page_type: str) -> None:
    name = frappe.db.exists("Website Route Meta", route)
    document = frappe.get_doc("Website Route Meta", name) if name else frappe.new_doc("Website Route Meta")
    if not name:
        document.name = route
    document.set("meta_tags", [])
    values = {
        "robots": "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
        "og:site_name": "ALLIM Qur’an",
        "og:type": "article" if page_type == "article" else "website",
        "og:locale": {"en": "en_US", "ar": "ar_SA", "ru": "ru_RU", "tr": "tr_TR"}.get(page_language, "en_US"),
    }
    for key, value in values.items():
        document.append("meta_tags", {"key": key, "value": value})
    document.flags.ignore_permissions = True
    document.save()


def update_hreflang(route_groups: list[list[dict[str, str]]]) -> None:
    settings = frappe.get_single("Website Settings")
    language_map = json.dumps(route_groups, ensure_ascii=False, separators=(",", ":"))
    seo_script = f'''{SEO_HEAD_START}
<script data-allim-seo="1">(function(){{
var path=(location.pathname.replace(/\\/+$/,«»)||«/»);
var canonical=document.createElement("link");canonical.rel="canonical";canonical.href=location.origin+path;document.head.appendChild(canonical);
var groups={language_map};var group=groups.find(function(items){{return items.some(function(item){{return item.route===path;}});}});
if(group){{group.forEach(function(item){{var link=document.createElement("link");link.rel="alternate";link.hreflang=item.code;link.href=location.origin+item.route;document.head.appendChild(link);}});var fallback=document.createElement("link");fallback.rel="alternate";fallback.hreflang="x-default";var en=group.find(function(item){{return item.code==="en";}});fallback.href=location.origin+(en?en.route:group[0].route);document.head.appendChild(fallback);}}
}})();</script>
{SEO_HEAD_END}'''.replace("«", '"').replace("»", '"')
    current = settings.head_html or ""
    current = re.sub(re.escape(SEO_HEAD_START) + r".*?" + re.escape(SEO_HEAD_END), "", current, flags=re.S).rstrip()
    settings.head_html = (current + "\n" + seo_script).strip()
    settings.flags.ignore_permissions = True
    settings.save()


pages, route_groups = render_pages()
timestamp = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
backup_dir = BACKUP_ROOT / f"{timestamp}-allim-blog"
backup_dir.mkdir(parents=True, exist_ok=False)
settings = frappe.get_single("Website Settings")
backup = {
    "created_at": timestamp,
    "site": frappe.local.site,
    "pages": {
        page["route"]: frappe.get_doc("Web Page", frappe.db.exists("Web Page", {"route": page["route"]})).as_dict()
        if frappe.db.exists("Web Page", {"route": page["route"]}) else None
        for page in pages
    },
    "route_meta": {
        page["route"]: frappe.get_doc("Website Route Meta", page["route"]).as_dict()
        if frappe.db.exists("Website Route Meta", page["route"]) else None
        for page in pages
    },
    "website_head_html": settings.head_html,
    "incoming_hashes": {
        name: sha256(read_text(name)) for name in ("index.html", "article.html", "styles.css", "script.js", "content.py", "digital_mushaf_content.py")
    },
}
for code in ("en", "ar", "ru", "tr"):
    draft_name = f"drafts/digital-mushaf-20260905/article-{code}.md"
    backup["incoming_hashes"][draft_name] = sha256(read_text(draft_name))
(backup_dir / "records.json").write_text(json.dumps(backup, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

published = []
for item in pages:
    published.append(upsert_page({
        "title": item["title"],
        "route": item["route"],
        "published": 1,
        "content_type": "HTML",
        "main_section_html": '<div class="allim-insights-root">' + item["html"] + "</div>",
        "insert_style": 1,
        "css": item["css"],
        "javascript": item["javascript"],
        "full_width": 1,
        "show_title": 0,
        "show_sidebar": 0,
        "enable_comments": 0,
        "meta_title": item.get("meta_title", item["title"]),
        "meta_description": item["description"],
    }))
    upsert_route_meta(item["route"], item["language"], item["type"])

update_hreflang(route_groups)
frappe.db.commit()
frappe.clear_cache()

new_routes = {
    "en": "blog/digital-mushaf-reading-understanding-remembering",
    "ar": "ar/blog/al-mushaf-al-raqami-qiraa-fahm-hifz",
    "ru": "ru/blog/cifrovoj-mushaf-chtenie-ponimanie-zapominanie",
    "tr": "tr/blog/dijital-mushaf-okuma-anlama-hatirlama",
}
content_markers = {
    "en": "What this feels like in daily reading",
    "ar": "كيف تبدو هذه التجربة في القراءة اليومية؟",
    "ru": "Как это ощущается в ежедневном чтении",
    "tr": "Günlük okumada bu deneyim nasıl hissedilir?",
}
for code, new_route in new_routes.items():
    new_page_name = frappe.db.exists("Web Page", {"route": new_route})
    if not new_page_name:
        raise RuntimeError(f"Digital Mushaf article was not published for {code}")
    new_page = frappe.get_doc("Web Page", new_page_name)
    for marker in (content_markers[code], "ALLIM QURAN"):
        if marker not in (new_page.main_section_html or "") and marker not in (new_page.title or ""):
            raise RuntimeError(f"Published {code} article did not persist marker: {marker}")

print(json.dumps({"backup": str(backup_dir), "pages": published, "hashes": backup["incoming_hashes"]}, ensure_ascii=False))
