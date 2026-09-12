from __future__ import annotations

import re
import sys
from pathlib import Path

from content import ARTICLE_ORDER, ARTICLES, LOCALES
from digital_mushaf_content import ARTICLE_KEY, FEATURED_OVERRIDES, FEATURED_VISUAL, build_addon, render_card_visual


ROOT = Path(__file__).resolve().parent
TURKISH_LOCALE, DIGITAL_MUSHAF = build_addon(ROOT)
LOCALES["tr"] = TURKISH_LOCALE
for code, values in FEATURED_OVERRIDES.items():
    LOCALES[code].update(values)
ARTICLES[ARTICLE_KEY] = DIGITAL_MUSHAF
if ARTICLE_KEY not in ARTICLE_ORDER:
    ARTICLE_ORDER.append(ARTICLE_KEY)


def replace_tokens(template: str, values: dict[str, object]) -> str:
    result = template
    for key, value in values.items():
        result = result.replace("{{" + key + "}}", str(value))
    remaining = sorted(set(re.findall(r"\{\{([A-Z0-9_]+)\}\}", result)))
    if remaining:
        raise RuntimeError("Unresolved template tokens: " + ", ".join(remaining))
    return result


def available_order(locale_code: str) -> list[str]:
    return [key for key in ARTICLE_ORDER if locale_code in ARTICLES[key]["content"] and locale_code in ARTICLES[key]["routes"]]


def toc(items: list[tuple[str, str]]) -> str:
    return "".join(f'<a href="#{anchor}">{label}</a>' for anchor, label in items)


def faq(items: list[tuple[str, str]]) -> str:
    return "".join(f'<article class="faq-item"><h3>{question}</h3><p>{answer}</p></article>' for question, answer in items)


def sources(items: list[tuple[str, str]]) -> str:
    return '<p class="basis-links">' + '<span aria-hidden="true"> · </span>'.join(f'<a href="{url}">{label}</a>' for label, url in items) + "</p>"


def locale_links(item: dict[str, object]) -> str:
    return "".join(f'<a href="article-{ARTICLE_KEY}-{code}.html">{code.upper()}</a>' for code in ("en", "ar", "ru", "tr") if code in item["routes"] and code in item["content"])


def hub_locale_links() -> str:
    return "".join(f'<a href="index-{code}.html">{code.upper()}</a>' for code in ("en", "ar", "ru", "tr"))


def render_hub(locale_code: str) -> str:
    locale = LOCALES[locale_code]
    cards = []
    for number, key in enumerate(available_order(locale_code), start=1):
        copy = ARTICLES[key]["content"][locale_code]
        cards.append(
            f'<article class="article-card" data-article-key="{key}"><a href="article-{key}-{locale_code}.html">'
            f'<span class="card-number">{number:02d}</span>{render_card_visual(key)}<h3>{copy["title"]}</h3>'
            f'<p>{copy["deck"]}</p><span class="read-more">{locale["read_more"]} <span aria-hidden="true">→</span></span></a></article>'
        )
    values = {
        "LANG": locale["lang"], "DIR": locale["dir"], "LOCALE": locale_code,
        "META_TITLE": locale["hub_meta_title"], "META_DESCRIPTION": locale["hub_meta_description"],
        "SKIP": locale["skip"], "NAV_LABEL": locale["nav_label"], "NAV_HOME": locale["nav_home"],
        "NAV_COMPANION": locale["nav_companion"], "NAV_ACADEMY": locale["nav_academy"], "NAV_INSIGHTS": locale["nav_insights"],
        "LANGUAGE_LABEL": locale["language_label"], "MENU_LABEL": locale["menu_label"], "HUB_ROUTE": f"index-{locale_code}.html",
        "HUB_LOCALE_LINKS": hub_locale_links(), "EYEBROW": locale["eyebrow"], "TITLE": locale["title"], "LEAD": locale["lead"],
        "FEATURED_KIND": locale["featured_kind"], "FEATURED_TITLE": locale["featured_title"], "FEATURED_EXCERPT": locale["featured_excerpt"],
        "READ_GUIDE": locale["read_guide"], "FEATURED_ROUTE": f"article-{ARTICLE_KEY}-{locale_code}.html",
        "FEATURED_VISUAL_LABEL": locale["featured_visual_label"], "FEATURED_VISUAL_TEXT": locale["featured_visual_text"],
        "FEATURED_VISUAL": FEATURED_VISUAL, "LIBRARY_EYEBROW": locale["library_eyebrow"], "LIBRARY_TITLE": locale["library_title"],
        "ARTICLE_CARDS": "".join(cards), "TRUST_EYEBROW": locale["trust_eyebrow"], "TRUST_TITLE": locale["trust_title"],
        "TRUST_ONE": locale["trust_one"], "TRUST_TWO": locale["trust_two"], "TRUST_THREE": locale["trust_three"],
        "CTA_TITLE": locale["cta_title"], "CTA_TEXT": locale["cta_text"], "CTA_ACTION": locale["cta_action"], "BACK_HOME": locale["back_home"],
    }
    return replace_tokens((ROOT / "index.html").read_text(encoding="utf-8"), values)


def render_article(locale_code: str, key: str) -> str:
    locale = LOCALES[locale_code]
    ui = locale["article"]
    item = ARTICLES[key]
    copy = item["content"][locale_code]
    order = available_order(locale_code)
    if len(order) > 1:
        next_key = order[(order.index(key) + 1) % len(order)]
        next_title = ARTICLES[next_key]["content"][locale_code]["title"]
        next_route = f"article-{next_key}-{locale_code}.html"
        next_action = ui["next_action"]
    else:
        next_title = locale["title"]
        next_route = f"index-{locale_code}.html"
        next_action = ui["back_blog"]
    values = {
        "LANG": locale["lang"], "DIR": locale["dir"], "LOCALE": locale_code,
        "META_TITLE": copy.get("seo_title", copy["title"] + " — ALLIM QURAN"), "META_DESCRIPTION": copy["meta_description"],
        "SKIP": locale["skip"], "NAV_LABEL": locale["nav_label"], "NAV_HOME": locale["nav_home"],
        "NAV_COMPANION": locale["nav_companion"], "NAV_ACADEMY": locale["nav_academy"], "NAV_INSIGHTS": locale["nav_insights"],
        "LANGUAGE_LABEL": locale["language_label"], "MENU_LABEL": locale["menu_label"], "HUB_ROUTE": f"index-{locale_code}.html",
        "LOCALE_LINKS": locale_links(item), "BREADCRUMB_LABEL": ui["breadcrumb_label"], "CATEGORY": copy["category"],
        "TITLE": copy["title"], "DECK": copy["deck"], "AUTHOR": copy.get("author", ui["author"]),
        "DATE_ISO": copy.get("date_iso", ui["date_iso"]), "DATE_LABEL": copy.get("date_label", ui["date_label"]),
        "READ_TIME": copy["read_time"], "IN_THIS_GUIDE": ui["in_this_guide"], "TOC": toc(copy["toc"]),
        "METHOD_NOTE": ui["method_note"], "SHORT_ANSWER_LABEL": ui["short_answer_label"], "SHORT_ANSWER": copy["short_answer"],
        "BODY": copy["body"], "FAQ_LABEL": ui["faq_label"], "FAQ_TITLE": ui["faq_title"], "FAQ": faq(copy["faq"]),
        "SOURCES_TITLE": copy.get("sources_title", ui["sources_title"]), "SOURCES": sources(copy["sources"]),
        "AUTHORSHIP_TITLE": copy.get("authorship_title", ui["authorship_title"]), "AUTHORSHIP_TEXT": copy.get("authorship_text", ui["authorship_text"]),
        "NEXT_EYEBROW": ui["next_eyebrow"], "NEXT_TITLE": next_title, "NEXT_ROUTE": next_route,
        "NEXT_ACTION": next_action, "BACK_BLOG": ui["back_blog"],
    }
    return replace_tokens((ROOT / "article.html").read_text(encoding="utf-8"), values)


def main() -> None:
    output = Path(sys.argv[1])
    output.mkdir(parents=True, exist_ok=True)
    (output / "styles.css").write_text((ROOT / "styles.css").read_text(encoding="utf-8"), encoding="utf-8")
    (output / "script.js").write_text((ROOT / "script.js").read_text(encoding="utf-8"), encoding="utf-8")
    for locale_code in LOCALES:
        (output / f"index-{locale_code}.html").write_text(render_hub(locale_code), encoding="utf-8")
        for key in available_order(locale_code):
            (output / f"article-{key}-{locale_code}.html").write_text(render_article(locale_code, key), encoding="utf-8")


if __name__ == "__main__":
    main()
