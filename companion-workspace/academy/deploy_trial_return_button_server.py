from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import frappe


BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")
SCRIPT_START = "/* ALLIM_RETURN_ACTION_START */"
SCRIPT_END = "/* ALLIM_RETURN_ACTION_END */"
CSS_START = "/* ALLIM_RETURN_BUTTON_START */"
CSS_END = "/* ALLIM_RETURN_BUTTON_END */"

FORMS = {
    "en": {"route": "academy-trial", "label": "Back to Academy"},
    "ru": {"route": "ru/probnyj-urok", "label": "Перейти обратно"},
    "ar": {"route": "ar/academy-trial", "label": "العودة إلى الأكاديمية"},
}


def replace_marked_block(source: str, start: str, end: str, block: str) -> str:
    cleaned = re.sub(
        re.escape(start) + r".*?" + re.escape(end),
        "",
        source or "",
        flags=re.S,
    ).rstrip()
    return f"{cleaned}\n\n{block}\n" if cleaned else f"{block}\n"


def return_script(label: str) -> str:
    encoded_label = json.dumps(label, ensure_ascii=False)
    return f"""{SCRIPT_START}
function apply_allim_return_action() {{
  var link = document.querySelector('.success-footer .success_url_message a');
  if (!link) return;
  link.textContent = {encoded_label};
  link.classList.add('allim-return-button');
}}
var allim_previous_after_load = frappe.web_form.after_load;
frappe.web_form.after_load = function () {{
  if (typeof allim_previous_after_load === 'function') allim_previous_after_load();
  apply_allim_return_action();
}};
window.setTimeout(apply_allim_return_action, 0);
{SCRIPT_END}"""


def return_css() -> str:
    return f"""{CSS_START}
.success-footer .success_url_message {{ margin:0; }}
.success-footer .allim-return-button {{ display:inline-flex; min-height:48px; align-items:center; justify-content:center; padding:0 24px; border:1px solid #244f45; border-radius:999px; background:#244f45; color:#fff!important; font-weight:650; text-decoration:none!important; box-shadow:0 12px 30px rgba(36,79,69,.18); transition:transform .2s ease,box-shadow .2s ease,background .2s ease; }}
.success-footer .allim-return-button:hover {{ background:#1b4038; transform:translateY(-2px); box-shadow:0 16px 34px rgba(36,79,69,.24); }}
.success-footer .allim-return-button:focus-visible {{ outline:3px solid rgba(36,79,69,.28); outline-offset:3px; }}
.success-footer .new-btn {{ min-height:46px; padding-inline:20px; border-radius:999px; }}
{CSS_END}"""


def main() -> None:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = BACKUP_ROOT / f"{timestamp}-trial-return-button"
    backup_dir.mkdir(parents=True, exist_ok=False)

    backups = {}
    forms = {}
    for locale, values in FORMS.items():
        name = frappe.db.exists("Web Form", {"route": values["route"]})
        if not name:
            raise RuntimeError(f"Missing Web Form for route: {values['route']}")
        form = frappe.get_doc("Web Form", name)
        backups[locale] = form.as_dict()

        form.success_url = "/academy"
        form.client_script = replace_marked_block(
            form.client_script or "",
            SCRIPT_START,
            SCRIPT_END,
            return_script(values["label"]),
        )
        form.custom_css = replace_marked_block(
            form.custom_css or "",
            CSS_START,
            CSS_END,
            return_css(),
        )
        form.flags.ignore_permissions = True
        form.save()
        forms[locale] = {
            "name": form.name,
            "route": form.route,
            "success_url": form.success_url,
            "label": values["label"],
        }

    (backup_dir / "web-forms.json").write_text(
        frappe.as_json(backups, indent=2),
        encoding="utf-8",
    )
    frappe.db.commit()
    frappe.clear_cache()

    for locale, values in FORMS.items():
        stored = frappe.get_doc("Web Form", forms[locale]["name"])
        if stored.success_url != "/academy":
            raise RuntimeError(f"Return URL did not persist for {locale}")
        if SCRIPT_START not in (stored.client_script or ""):
            raise RuntimeError(f"Return action did not persist for {locale}")
        if CSS_START not in (stored.custom_css or ""):
            raise RuntimeError(f"Return button styles did not persist for {locale}")

    print(json.dumps({"backup": str(backup_dir), "forms": forms}, ensure_ascii=False, indent=2))


main()
