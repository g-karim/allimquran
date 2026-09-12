from __future__ import annotations

import json
import re
import urllib.error
import urllib.request


BASE = "https://allimquran.com"


def fetch(path: str) -> tuple[int, str]:
    request = urllib.request.Request(BASE + path, headers={"User-Agent": "ALLIM-Release-QA/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, response.read(2_500_000).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        return error.code, error.read(500_000).decode("utf-8", errors="replace")


def value(source: str, pattern: str) -> str | None:
    match = re.search(pattern, source, re.I | re.S)
    return match.group(1).strip() if match else None


course_status, course_html = fetch("/lms/courses?release_qa=20260905")
demo_status, demo_html = fetch("/lms/courses/a-guide-to-frappe-learning?release_qa=20260905")
robots_status, robots = fetch("/robots.txt?release_qa=20260905")
sitemap_status, sitemap = fetch("/sitemap.xml?release_qa=20260905")
schema_source = value(course_html, r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>')
schema = json.loads(schema_source) if schema_source else {}
types = [entry.get("@type") for entry in schema.get("@graph", [])]

result = {
    "course_collection": {
        "status": course_status,
        "title": value(course_html, r"<title>(.*?)</title>"),
        "description": value(course_html, r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']'),
        "canonical": value(course_html, r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\'](.*?)["\']'),
        "robots": value(course_html, r'<meta[^>]+name=["\']robots["\'][^>]+content=["\'](.*?)["\']'),
        "og_url": value(course_html, r'<meta[^>]+property=["\']og:url["\'][^>]+content=["\'](.*?)["\']'),
        "og_image_is_absolute": bool(re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']https://', course_html, re.I)),
        "twitter_card": value(course_html, r'<meta[^>]+name=["\']twitter:card["\'][^>]+content=["\'](.*?)["\']'),
        "schema_types": types,
        "server_h1": bool(re.search(r'<h1[^>]*>[^<]+</h1>', course_html, re.I)),
    },
    "protected_demo": {
        "status": demo_status,
        "noindex": bool(re.search(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\']noindex', demo_html, re.I)),
        "course_schema_suppressed": '"@type":"Course"' not in demo_html,
    },
    "robots": {"status": robots_status, "has_sitemap": "Sitemap: https://allimquran.com/sitemap.xml" in robots},
    "sitemap": {"status": sitemap_status, "has_course_collection": "/lms/courses" in sitemap},
}
print(json.dumps(result, ensure_ascii=False, indent=2))
