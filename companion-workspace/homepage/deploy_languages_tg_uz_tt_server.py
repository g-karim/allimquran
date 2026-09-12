from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from pathlib import Path

import frappe


SOURCE_ROOT = Path("/tmp/allim-home-languages-tg-uz-tt-v84")
BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")
LANGUAGES = (
    ("tg", "TG · Тоҷикӣ"),
    ("uz", "UZ · O‘zbekcha"),
    ("tt", "TT · Татарча"),
)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def read_dictionary(code: str) -> dict[str, str]:
    payload = json.loads((SOURCE_ROOT / f"i18n-{code}.json").read_text(encoding="utf-8"))
    if len(payload) < 180 or not payload.get("heroTitle") or not payload.get("languageLabel"):
        raise RuntimeError(f"Incomplete {code} homepage dictionary")
    return payload


def update_language_options(html: str) -> str:
    for code, _label in LANGUAGES:
        html = re.sub(
            rf"^[ \t]*<option value=\"{code}\">.*?</option>[ \t]*\n?",
            "",
            html,
            flags=re.M,
        )
    anchor = re.search(r"^(?P<indent>[ \t]*)<option value=\"tr\">TR · Türkçe</option>[ \t]*$", html, flags=re.M)
    if not anchor:
        raise RuntimeError("Turkish language option was not found in the homepage HTML")
    indent = anchor.group("indent")
    addition = "".join(f'\n{indent}<option value="{code}">{label}</option>' for code, label in LANGUAGES)
    return html[: anchor.end()] + addition + html[anchor.end() :]


def update_schema_languages(html: str) -> str:
    def replace(match: re.Match[str]) -> str:
        values = json.loads("[" + match.group("values") + "]")
        for code, _label in LANGUAGES:
            if code in values:
                values.remove(code)
        insert_at = values.index("tr") + 1 if "tr" in values else min(4, len(values))
        values[insert_at:insert_at] = [code for code, _label in LANGUAGES]
        return match.group("prefix") + json.dumps(values, ensure_ascii=False)[1:-1] + "]"

    updated, count = re.subn(
        r'(?P<prefix>"inLanguage"\s*:\s*\[)(?P<values>[^\]]*)\]',
        replace,
        html,
    )
    if count < 1:
        raise RuntimeError("Homepage inLanguage metadata was not found")
    return updated


def update_translation_catalog(javascript: str, dictionaries: dict[str, dict[str, str]]) -> str:
    pattern = re.compile(
        r"(?P<copies_prefix>window\.ALLIM_EXTRA_COPIES\s*=\s*)(?P<copies>\{.*?\})"
        r"(?P<meta_prefix>;\s*window\.ALLIM_LANGUAGE_META\s*=\s*)(?P<meta>\{.*?\})(?P<suffix>;)",
        flags=re.S,
    )
    match = pattern.search(javascript)
    if not match:
        raise RuntimeError("ALLIM homepage translation catalog was not found")
    copies = json.loads(match.group("copies"))
    metadata = json.loads(match.group("meta"))
    for code, label in LANGUAGES:
        copies[code] = dictionaries[code]
        metadata[code] = {"api": code, "name": label.split(" · ", 1)[1]}
    replacement = (
        match.group("copies_prefix")
        + json.dumps(copies, ensure_ascii=False, indent=2)
        + match.group("meta_prefix")
        + json.dumps(metadata, ensure_ascii=False, indent=2)
        + match.group("suffix")
    )
    return javascript[: match.start()] + replacement + javascript[match.end() :]


def update_language_runtime(javascript: str) -> str:
    pattern = re.compile(r"var supportedLanguages = \[(?P<values>.*?)\];")
    match = pattern.search(javascript)
    if not match:
        raise RuntimeError("supportedLanguages was not found")
    values = json.loads("[" + match.group("values") + "]")
    for code, _label in LANGUAGES:
        if code in values:
            values.remove(code)
    insert_at = values.index("tr") + 1
    values[insert_at:insert_at] = [code for code, _label in LANGUAGES]
    javascript = javascript[: match.start("values")] + json.dumps(values)[1:-1] + javascript[match.end("values") :]
    javascript = javascript.replace(
        '["uk", "be", "kk", "ky", "tg"].indexOf(code)',
        '["uk", "be", "kk", "ky"].indexOf(code)',
    )
    timezone_anchor = '    if (zone === "Europe/Istanbul") return "tr";'
    timezone_patch = (
        timezone_anchor
        + '\n    if (zone === "Asia/Dushanbe") return "tg";'
        + '\n    if (/^Asia\\/(Tashkent|Samarkand)$/.test(zone)) return "uz";'
    )
    javascript = javascript.replace('    if (zone === "Asia/Dushanbe") return "tg";\n', "")
    javascript = javascript.replace('    if (/^Asia\\/(Tashkent|Samarkand)$/.test(zone)) return "uz";\n', "")
    if timezone_anchor not in javascript:
        raise RuntimeError("Turkish timezone anchor was not found")
    return javascript.replace(timezone_anchor, timezone_patch, 1)


dictionaries = {code: read_dictionary(code) for code, _label in LANGUAGES}
page_name = frappe.db.get_value("Web Page", {"route": "home"}, "name")
if not page_name:
    raise RuntimeError("Published homepage was not found")

page = frappe.get_doc("Web Page", page_name)
before_html = page.main_section_html or ""
before_javascript = page.javascript or ""
after_html = update_schema_languages(update_language_options(before_html))
after_javascript = update_language_runtime(update_translation_catalog(before_javascript, dictionaries))

timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
backup_dir = BACKUP_ROOT / f"{timestamp}-allim-home-languages-tg-uz-tt"
backup_dir.mkdir(parents=True, exist_ok=False)
(backup_dir / "records.json").write_text(
    json.dumps(
        {
            "created_at": timestamp,
            "site": frappe.local.site,
            "page": page.as_dict(),
            "hashes_before": {"html": digest(before_html), "javascript": digest(before_javascript)},
            "hashes_after": {"html": digest(after_html), "javascript": digest(after_javascript)},
        },
        ensure_ascii=False,
        indent=2,
        default=str,
    ),
    encoding="utf-8",
)

page.main_section_html = after_html
page.javascript = after_javascript
page.save(ignore_permissions=True)
frappe.db.commit()
frappe.clear_cache()

stored = frappe.get_doc("Web Page", page.name)
stored_html = stored.main_section_html or ""
stored_javascript = stored.javascript or ""
expected_options = ["TR · Türkçe", "TG · Тоҷикӣ", "UZ · O‘zbekcha", "TT · Татарча"]
positions = [stored_html.index(label) for label in expected_options]
if positions != sorted(positions):
    raise RuntimeError("Language selector order did not persist")
for code, _label in LANGUAGES:
    if f'"{code}": {{' not in stored_javascript:
        raise RuntimeError(f"Missing {code} translation dictionary")
if '"tr", "tg", "uz", "tt"' not in stored_javascript:
    raise RuntimeError("New language runtime order did not persist")
if '["uk", "be", "kk", "ky", "tg"]' in stored_javascript:
    raise RuntimeError("Tajik still falls back to Russian")
if '"inLanguage":["ar", "en", "ru", "tr", "tg", "uz", "tt"' not in stored_html.replace(" ", ""):
    normalized = re.sub(r"\s+", "", stored_html)
    if '"inLanguage":["ar","en","ru","tr","tg","uz","tt"' not in normalized:
        raise RuntimeError("Homepage language metadata did not persist")

print(
    json.dumps(
        {
            "page": stored.name,
            "route": stored.route,
            "backup": str(backup_dir),
            "languages": [code for code, _label in LANGUAGES],
            "hashes": {"html": digest(stored_html), "javascript": digest(stored_javascript)},
        },
        ensure_ascii=False,
    )
)
