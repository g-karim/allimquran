from __future__ import annotations

import json
import re
import urllib.request


BASE = "https://allimquran.com"
ROUTES = {
    "en": "/blog/digital-mushaf-reading-understanding-remembering",
    "ar": "/ar/blog/al-mushaf-al-raqami-qiraa-fahm-hifz",
    "ru": "/ru/blog/cifrovoj-mushaf-chtenie-ponimanie-zapominanie",
    "tr": "/tr/blog/dijital-mushaf-okuma-anlama-hatirlama",
}
HEADLINES = {
    "en": "Beyond a page on a screen",
    "ar": "أبعد من صفحة على شاشة",
    "ru": "Не просто Коран на экране",
    "tr": "Ekrandaki bir sayfadan fazlası",
}
VISITOR_SECTIONS = {
    "en": "Why a digital Mushaf should still feel like a page",
    "ar": "لماذا ينبغي أن يبقى للمصحف الرقمي إحساس الصفحة؟",
    "ru": "Зачем цифровому мусхафу сохранять ощущение страницы",
    "tr": "Dijital mushaf neden hâlâ bir sayfa gibi hissettirmelidir?",
}


def fetch(path: str) -> tuple[int, str]:
    request = urllib.request.Request(BASE + path, headers={"User-Agent": "ALLIM-publication-verifier/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.status, response.read().decode("utf-8", errors="replace")


checks = {}
for code, route in ROUTES.items():
    status, body = fetch(route + "?qa=20260905-public")
    checks[code] = {
        "status": status,
        "bytes": len(body.encode("utf-8")),
        "headline": HEADLINES[code] in body,
        "visitor_section": VISITOR_SECTIONS[code] in body,
        "faq_schema": '"@type":"FAQPage"' in body,
        "article_schema": '"@type":"Article"' in body,
        "language_marker": f'data-lang="{code}"' in body,
        "direction_marker": ('data-dir="rtl"' if code == "ar" else 'data-dir="ltr"') in body,
        "technical_phrase_absent": not re.search(
            r"Capture every page|Снять каждую страницу|Sayfaların her birini|التقط كل صفحة|visual diff|"
            r"photograph or PDF|фотографию или PDF|fotoğrafını veya PDF|ملف PDF|Unicode|interactive coordinates|"
            r"интерактивные координаты|dokunma koordinatları|إحداثيات التفاعل",
            body,
            flags=re.I,
        ),
    }

sitemap_status, sitemap = fetch("/sitemap.xml")
checks["sitemap"] = {
    "status": sitemap_status,
    "routes": {code: route in sitemap for code, route in ROUTES.items()},
}

failures = [
    f"{scope}.{name}"
    for scope, values in checks.items()
    for name, value in values.items()
    if (name != "bytes" and value is not True and value != 200 and not isinstance(value, dict))
]
if not all(checks["sitemap"]["routes"].values()):
    failures.append("sitemap.routes")

print(json.dumps({"checks": checks, "failures": failures}, ensure_ascii=False, indent=2))
if failures:
    raise SystemExit(1)
