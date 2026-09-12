from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import frappe


SITE = "allimquran.com"
SOURCE_ROOT = Path("/tmp/allim-academy-v2")
BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")
REQUEST_DOCTYPE = "ALLIM Trial Lesson Request"


def body_markup(document: str) -> str:
    match = re.search(r"<body[^>]*>(.*)</body>", document, flags=re.I | re.S)
    if not match:
        raise RuntimeError("Could not find the Academy HTML body")
    body = match.group(1)
    return re.sub(r"<script\b[^>]*\bsrc=[^>]*>\s*</script>", "", body, flags=re.I | re.S).strip()


def page_shell() -> str:
    return """
body:has(.allim-academy-root) .navbar,
body:has(.allim-academy-root) .web-footer,
body:has(.allim-academy-root) footer:not(.site-footer),
body:has(.allim-academy-root) .page-header,
body:has(.allim-academy-root) .page-breadcrumbs { display: none !important; }
body:has(.allim-academy-root) .page-content-wrapper,
body:has(.allim-academy-root) .web-page-content,
body:has(.allim-academy-root) .page_content,
body:has(.allim-academy-root) main.container { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
body:has(.allim-academy-root) { margin: 0 !important; background: #f4f2ec !important; }
"""


def snapshot(doctype: str, name: str) -> dict | None:
    return frappe.get_doc(doctype, name).as_dict() if frappe.db.exists(doctype, name) else None


def snapshot_web_form(route: str) -> dict | None:
    name = frappe.db.exists("Web Form", {"route": route})
    return snapshot("Web Form", name) if name else None


def ensure_request_doctype() -> dict:
    if frappe.db.exists("DocType", REQUEST_DOCTYPE):
        return {"name": REQUEST_DOCTYPE, "created": False}

    document = frappe.new_doc("DocType")
    document.update({
        "name": REQUEST_DOCTYPE,
        "module": "LMS",
        "custom": 1,
        "autoname": "format:ALLIM-TRIAL-{YYYY}-{#####}",
        "title_field": "full_name",
        "track_changes": 1,
        "allow_import": 1,
    })
    fields = [
        {"fieldname": "full_name", "label": "Full name", "fieldtype": "Data", "reqd": 1, "in_list_view": 1},
        {"fieldname": "email", "label": "Email", "fieldtype": "Data", "options": "Email", "reqd": 1, "in_list_view": 1},
        {"fieldname": "phone", "label": "Phone or messenger", "fieldtype": "Data", "in_list_view": 1},
        {"fieldname": "preferred_contact", "label": "Preferred way to contact", "fieldtype": "Data"},
        {"fieldname": "note", "label": "What should the teacher know?", "fieldtype": "Small Text"},
        {"fieldname": "diagnostic_section", "label": "Diagnostic context", "fieldtype": "Section Break"},
        {"fieldname": "learner_stage", "label": "Learner stage", "fieldtype": "Data", "read_only": 1},
        {"fieldname": "learning_goal", "label": "Learning goal", "fieldtype": "Data", "read_only": 1},
        {"fieldname": "recommended_route", "label": "Recommended route", "fieldtype": "Data", "read_only": 1, "in_list_view": 1},
        {"fieldname": "daily_minutes", "label": "Daily minutes", "fieldtype": "Int", "read_only": 1},
        {"fieldname": "language", "label": "Language", "fieldtype": "Data", "read_only": 1},
        {"fieldname": "source", "label": "Source", "fieldtype": "Data", "read_only": 1, "default": "academy-diagnostic"},
        {"fieldname": "consent", "label": "Consent to be contacted about the trial lesson", "fieldtype": "Check", "reqd": 1},
        {"fieldname": "status", "label": "Status", "fieldtype": "Select", "options": "New\nContacted\nScheduled\nEnrolled\nClosed", "default": "New", "in_list_view": 1},
    ]
    for field in fields:
        document.append("fields", field)
    document.append("permissions", {
        "role": "System Manager",
        "read": 1,
        "write": 1,
        "create": 1,
        "delete": 1,
        "report": 1,
        "export": 1,
        "share": 1,
    })
    document.flags.ignore_permissions = True
    document.insert()
    frappe.clear_cache(doctype=REQUEST_DOCTYPE)
    return {"name": REQUEST_DOCTYPE, "created": True}


FORM_LOCALES = {
    "en": {
        "name": "allim-academy-trial-en",
        "route": "academy-trial",
        "title": "Book a trial lesson — ALLIM Academy",
        "intro": "<p>Your diagnostic has prepared a starting route. Leave your contact details and the Academy team can arrange a short introductory lesson with a teacher.</p>",
        "button": "Send lesson request",
        "success": "Your request has been received. The Academy team will contact you to arrange the trial lesson.",
        "return_label": "Back to Academy",
        "return_url": "/academy",
        "labels": {"full_name": "Your name", "email": "Email", "phone": "Phone or messenger", "preferred_contact": "How should we contact you?", "note": "What should the teacher know before the lesson?", "consent": "I agree to be contacted about this trial lesson"},
    },
    "ru": {
        "name": "allim-academy-trial-ru",
        "route": "ru/probnyj-urok",
        "title": "Пробный урок — ALLIM Academy",
        "intro": "<p>Диагностика уже подготовила точку старта. Оставьте контакты — команда Академии сможет согласовать короткий пробный урок с преподавателем.</p>",
        "button": "Отправить заявку",
        "success": "Заявка принята. Команда Академии свяжется с вами, чтобы согласовать пробный урок.",
        "return_label": "Перейти обратно",
        "return_url": "/academy",
        "labels": {"full_name": "Ваше имя", "email": "Электронная почта", "phone": "Телефон или мессенджер", "preferred_contact": "Как с вами связаться?", "note": "Что преподавателю важно знать до урока?", "consent": "Я согласен на связь по поводу пробного урока"},
    },
    "ar": {
        "name": "allim-academy-trial-ar",
        "route": "ar/academy-trial",
        "title": "احجز درسًا تجريبيًا — أكاديمية ALLIM",
        "intro": "<p>حدّد التشخيص نقطة البداية. اترك وسيلة التواصل ليتمكن فريق الأكاديمية من ترتيب درس تعريفي قصير مع معلّم.</p>",
        "button": "أرسل طلب الدرس",
        "success": "تم استلام طلبك. سيتواصل معك فريق الأكاديمية لترتيب الدرس التجريبي.",
        "return_label": "العودة إلى الأكاديمية",
        "return_url": "/academy",
        "labels": {"full_name": "الاسم", "email": "البريد الإلكتروني", "phone": "الهاتف أو تطبيق المراسلة", "preferred_contact": "كيف نتواصل معك؟", "note": "ما الذي ينبغي أن يعرفه المعلّم قبل الدرس؟", "consent": "أوافق على التواصل معي بشأن الدرس التجريبي"},
    },
}


def web_form_client_script(return_label: str) -> str:
    return f"""function apply_allim_diagnostic_context() {{
  var params = new URLSearchParams(window.location.search);
  var values = {{
    learner_stage: params.get('level') || '',
    learning_goal: params.get('goal') || '',
    recommended_route: params.get('route') || '',
    daily_minutes: Number(params.get('minutes')) || 15,
    language: params.get('lang') || document.documentElement.lang || 'en',
    source: params.get('source') || 'academy-diagnostic'
  }};
  Object.keys(values).forEach(function (fieldname) {{
    if (frappe.web_form && frappe.web_form.set_value) frappe.web_form.set_value(fieldname, values[fieldname]);
  }});
}}
function apply_allim_return_action() {{
  var link = document.querySelector('.success-footer .success_url_message a');
  if (!link) return;
  link.textContent = {json.dumps(return_label, ensure_ascii=False)};
  link.classList.add('allim-return-button');
}}
function initialize_allim_trial_form() {{
  apply_allim_diagnostic_context();
  apply_allim_return_action();
}}
frappe.web_form.after_load = initialize_allim_trial_form;
window.setTimeout(initialize_allim_trial_form, 0);"""


def web_form_css(rtl: bool) -> str:
    direction = "direction:rtl;text-align:right;" if rtl else ""
    return f"""
body {{ background:#f4f2ec; color:#17352e; }}
.navbar, .web-footer, footer {{ display:none!important; }}
.page-content-wrapper, .web-page-content {{ max-width:none!important; padding:0!important; }}
.web-form-container {{ max-width:760px; margin:42px auto; padding:clamp(22px,4vw,44px); border:1px solid #d7ddd8; border-radius:24px; background:#fffdf8; box-shadow:0 24px 70px rgba(31,65,56,.1); {direction} }}
.web-form-container h1 {{ font-family:Georgia,'Times New Roman',serif; letter-spacing:-.035em; }}
.web-form-container .btn-primary {{ min-height:48px; padding-inline:22px; border:0; border-radius:14px; background:#244f45; }}
.web-form-container .form-control {{ min-height:46px; border-radius:12px; }}
.success-footer .success_url_message {{ margin:0; }}
.success-footer .allim-return-button {{ display:inline-flex; min-height:48px; align-items:center; justify-content:center; padding:0 24px; border:1px solid #244f45; border-radius:999px; background:#244f45; color:#fff!important; font-weight:650; text-decoration:none!important; box-shadow:0 12px 30px rgba(36,79,69,.18); transition:transform .2s ease,box-shadow .2s ease,background .2s ease; }}
.success-footer .allim-return-button:hover {{ background:#1b4038; transform:translateY(-2px); box-shadow:0 16px 34px rgba(36,79,69,.24); }}
.success-footer .allim-return-button:focus-visible {{ outline:3px solid rgba(36,79,69,.28); outline-offset:3px; }}
.success-footer .new-btn {{ min-height:46px; padding-inline:20px; border-radius:999px; }}
.frappe-control[data-fieldname="learner_stage"],
.frappe-control[data-fieldname="learning_goal"],
.frappe-control[data-fieldname="recommended_route"],
.frappe-control[data-fieldname="daily_minutes"],
.frappe-control[data-fieldname="language"],
.frappe-control[data-fieldname="source"] {{ display:none!important; }}
"""


def upsert_trial_form(locale: str, values: dict) -> dict:
    existing = frappe.db.exists("Web Form", {"route": values["route"]}) or frappe.db.exists("Web Form", values["name"])
    form = frappe.get_doc("Web Form", existing) if existing else frappe.new_doc("Web Form")
    if not existing:
        form.name = values["name"]
    form.update({
        "title": values["title"],
        "route": values["route"],
        "published": 1,
        "doc_type": REQUEST_DOCTYPE,
        "module": "LMS",
        "is_standard": 0,
        "anonymous": 1,
        "login_required": 0,
        "allow_multiple": 1,
        "allow_edit": 0,
        "apply_document_permissions": 0,
        "show_attachments": 0,
        "introduction_text": values["intro"],
        "button_label": values["button"],
        "success_message": values["success"],
        "success_url": values["return_url"],
        "client_script": web_form_client_script(values["return_label"]),
        "custom_css": web_form_css(locale == "ar"),
        "meta_title": values["title"],
        "meta_description": values["intro"].replace("<p>", "").replace("</p>", ""),
    })
    form.set("web_form_fields", [])
    for fieldname in ("full_name", "email", "phone", "preferred_contact", "note"):
        fieldtype = "Small Text" if fieldname == "note" else "Data"
        form.append("web_form_fields", {"fieldname": fieldname, "fieldtype": fieldtype, "label": values["labels"][fieldname], "reqd": fieldname in ("full_name", "email")})
    for fieldname, fieldtype in (("learner_stage", "Data"), ("learning_goal", "Data"), ("recommended_route", "Data"), ("daily_minutes", "Int"), ("language", "Data"), ("source", "Data")):
        form.append("web_form_fields", {"fieldname": fieldname, "fieldtype": fieldtype, "label": fieldname.replace("_", " ").title(), "hidden": 0, "read_only": 1})
    form.append("web_form_fields", {"fieldname": "consent", "fieldtype": "Check", "label": values["labels"]["consent"], "reqd": 1})
    form.flags.ignore_permissions = True
    form.save()
    return {"name": form.name, "route": form.route, "published": form.published}


def main() -> None:
    academy_html = (SOURCE_ROOT / "index.html").read_text(encoding="utf-8")
    academy_css = (SOURCE_ROOT / "styles.css").read_text(encoding="utf-8")
    academy_js = (SOURCE_ROOT / "script.js").read_text(encoding="utf-8")
    for marker in ("academy-entry-card", "diagnostic-dialog", "book-trial-lesson"):
        if marker not in academy_html:
            raise RuntimeError(f"Academy HTML is missing marker: {marker}")
    for marker in ("allim-academy-diagnostic-v1", "routeFor", "academy-diagnostic"):
        if marker not in academy_js:
            raise RuntimeError(f"Academy JavaScript is missing marker: {marker}")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = BACKUP_ROOT / f"{timestamp}-allim-academy-entry"
    backup_dir.mkdir(parents=True, exist_ok=False)
    academy_name = frappe.db.exists("Web Page", {"route": "academy"})
    backups = {
        "academy_page": snapshot("Web Page", academy_name) if academy_name else None,
        "request_doctype": snapshot("DocType", REQUEST_DOCTYPE),
        "trial_forms": {locale: snapshot_web_form(values["route"]) for locale, values in FORM_LOCALES.items()},
    }
    (backup_dir / "records.json").write_text(frappe.as_json(backups, indent=2), encoding="utf-8")

    academy = frappe.get_doc("Web Page", academy_name) if academy_name else frappe.new_doc("Web Page")
    academy.update({
        "title": "ALLIM Qur’an Academy — Student Cabinet",
        "route": "academy",
        "published": 1,
        "content_type": "HTML",
        "main_section_html": '<div class="allim-academy-root">' + body_markup(academy_html) + "</div>",
        "insert_style": 1,
        "css": page_shell() + academy_css,
        "javascript": academy_js,
        "full_width": 1,
        "show_title": 0,
        "show_sidebar": 0,
        "enable_comments": 0,
        "meta_title": "Student Cabinet — ALLIM Qur’an Academy",
        "meta_description": "A personal Qur’an learning route from a short diagnostic to a trial lesson and guided study.",
    })
    academy.flags.ignore_permissions = True
    academy.save()

    doctype_result = ensure_request_doctype()
    forms = {locale: upsert_trial_form(locale, values) for locale, values in FORM_LOCALES.items()}
    frappe.db.commit()
    frappe.clear_cache()

    stored = frappe.get_doc("Web Page", academy.name)
    if "academy-entry-card" not in (stored.main_section_html or ""):
        raise RuntimeError("Published Academy HTML did not persist the diagnostic route")
    if "allim-academy-diagnostic-v1" not in (stored.javascript or ""):
        raise RuntimeError("Published Academy JavaScript did not persist the diagnostic logic")
    print(json.dumps({
        "backup": str(backup_dir),
        "academy": {"name": stored.name, "route": stored.route, "modified": str(stored.modified)},
        "request_doctype": doctype_result,
        "trial_forms": forms,
    }, ensure_ascii=False, indent=2))


main()
