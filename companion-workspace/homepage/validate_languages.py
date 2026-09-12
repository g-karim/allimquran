from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("allim_build_i18n", ROOT / "build_i18n.py")
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)

source_keys = set(module.source_copy())
html = (ROOT / "index.html").read_text(encoding="utf-8")
javascript = (ROOT / "script.js").read_text(encoding="utf-8")
generated = (ROOT / "i18n.js").read_text(encoding="utf-8")
copies_start = generated.index("window.ALLIM_EXTRA_COPIES = ") + len("window.ALLIM_EXTRA_COPIES = ")
copies_end = generated.index(";\nwindow.ALLIM_LANGUAGE_META = ")
copies = json.loads(generated[copies_start:copies_end])
share_keys = {
    "referralLabel", "referralTitle", "referralText", "referralAction",
    "shareEyebrow", "shareTitle", "shareText", "shareFaith", "shareAction",
    "shareOpenTitle", "shareOpenText", "shareLevelTitle", "shareLevelText",
    "shareMessage", "shareCopied", "shareComplete", "shareFailed", "footerShare",
}

selector_labels = ["TR · Türkçe", "TG · Тоҷикӣ", "UZ · O‘zbekcha", "TT · Татарча"]
selector_positions = [html.index(label) for label in selector_labels]
assert selector_positions == sorted(selector_positions), "Language selector order is incorrect"
assert '"tr","tg","uz","tt"' in re.sub(r"\s+", "", html), "Schema language order is incorrect"
assert '"tr", "tg", "uz", "tt"' in javascript, "Runtime language order is incorrect"
assert '"tg"].indexOf(code)' not in javascript, "Tajik still falls back to Russian"
assert 'Asia/Dushanbe' in javascript and 'Tashkent|Samarkand' in javascript

for code in ("tg", "uz", "tt"):
    curated = json.loads((ROOT / f"i18n-{code}.json").read_text(encoding="utf-8"))
    assert not (source_keys - curated.keys()), f"{code} curated dictionary is incomplete"
    assert set(copies[code]) == source_keys, f"{code} generated dictionary does not match homepage keys"
    assert copies[code]["languageLabel"] != "Language"
    assert copies[code]["heroTitle"] != module.source_copy()["heroTitle"]

for code, language_copy in copies.items():
    assert not (share_keys - language_copy.keys()), f"{code} share copy is incomplete"
    assert language_copy["shareFaith"].strip(), f"{code} spiritual-reward boundary is empty"
    assert language_copy["referralText"].strip(), f"{code} referral terms are empty"

assert html.count("data-share-trigger") == 1, "Expected one active general ALLIM share action"
assert 'id="share-benefit"' in html, "Share-the-benefit section is missing"
assert 'class="academy-referral"' in html, "Academy referral strip is missing"
assert 'class="academy-referral-status"' in html, "Academy referral development badge is missing"
assert 'data-copy="developmentStatus"' in html, "Referral development status is not localized"
assert '<b>10%</b>' in html, "Planned 10% marker is missing"
assert 'disabled aria-disabled="true" data-referral-placeholder' in html, "Academy invitation must remain an inactive placeholder"
assert 'id="i-share"' in html and 'id="i-ticket"' in html, "Share icons are missing"
assert "navigator.share" in javascript, "Native share action is missing"
assert "navigator.clipboard" in javascript, "Clipboard fallback is missing"
assert "second level" in module.source_copy()["referralText"], "Single-level boundary is missing"
assert "Neither the Academy invitation nor automatic discount accrual is active yet" in module.source_copy()["referralText"], "Inactive Academy referral boundary is missing"
assert "planned" in module.source_copy()["shareLevelText"].lower(), "Planned discount boundary is missing"
assert "Функция приглашения в Академию и автоматическое начисление пока не подключены" in javascript, "Russian inactive Academy referral boundary is missing"
assert "لم تُفعّل دعوة الأكاديمية ولا آلية احتساب الخصم تلقائيًا بعد" in javascript, "Arabic inactive Academy referral boundary is missing"
assert "does not promise or count spiritual reward" in module.source_copy()["shareFaith"], "Spiritual-reward boundary is missing"
assert "JAZARION" not in html + javascript + generated, "Wrong-project copy found in ALLIM homepage"

print(json.dumps({"languages": sorted(copies), "keys_each": len(source_keys), "share_actions": 1, "academy_placeholder": True, "status": "passed"}))
