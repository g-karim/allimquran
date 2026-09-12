from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


REQUEST_DOCTYPE = "ALLIM Trial Lesson Request"
CLIENT_SCRIPT_NAME = "ALLIM Trial Request Workflow"
BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")
SIDEBAR_MARKER = "ALLIM_TRIAL_REQUESTS_SIDEBAR_V1"


CLIENT_SCRIPT = r"""
frappe.ui.form.on("ALLIM Trial Lesson Request", {
  refresh: async function (frm) {
    if (frm.is_new()) return;

    if (!frm.doc.student_user && frm.doc.email) {
      try {
        const response = await frappe.db.get_value(
          "User",
          { email: frm.doc.email, enabled: 1 },
          "name"
        );
        const user = response && response.message && response.message.name;
        if (user) await frm.set_value("student_user", user);
      } catch (error) {
        console.warn("Could not match the trial request to a user account", error);
      }
    }

    const processing = __("Processing");

    const updateStatus = async function (status, successMessage) {
      try {
        await frm.set_value("status", status);
        await frm.save();
        frappe.show_alert({ message: __(successMessage), indicator: "green" });
      } catch (error) {
        frappe.msgprint({
          title: __("Could not update status"),
          message: error && error.message ? error.message : __("Please try again."),
          indicator: "red"
        });
      }
    };

    if (frm.doc.status === "New") {
      frm.add_custom_button(
        __("Mark as contacted"),
        () => updateStatus("Contacted", "Request marked as contacted"),
        processing
      );
    }

    if (frm.doc.status === "Contacted") {
      frm.add_custom_button(
        __("Mark as scheduled"),
        async () => {
          if (!frm.doc.learning_group) {
            frappe.msgprint(__("Select a learning group before scheduling."));
            return;
          }
          await updateStatus("Scheduled", "Trial lesson marked as scheduled");
        },
        processing
      );
    }

    if (frm.doc.learning_group) {
      frm.add_custom_button(
        __("Open linked group"),
        () => window.location.assign(
          "/lms/batches/" + encodeURIComponent(frm.doc.learning_group)
        ),
        processing
      );
    } else {
      frm.add_custom_button(
        __("Open learning groups"),
        () => window.location.assign("/lms/batches"),
        processing
      );
    }

    if (
      frm.doc.status === "Scheduled" &&
      frm.doc.student_user &&
      frm.doc.learning_group
    ) {
      frm.add_custom_button(
        __("Check enrollment"),
        async () => {
          try {
            const response = await frappe.db.get_value(
              "LMS Batch Enrollment",
              {
                batch: frm.doc.learning_group,
                member: frm.doc.student_user
              },
              "name"
            );
            const enrollment = response && response.message && response.message.name;
            if (!enrollment) {
              frappe.msgprint(
                __("The student is not enrolled yet. Open the linked group and add the student first.")
              );
              return;
            }
            await frm.set_value("status", "Enrolled");
            await frm.save();
            frappe.show_alert({
              message: __("Enrollment confirmed and request updated"),
              indicator: "green"
            });
          } catch (error) {
            frappe.msgprint({
              title: __("Could not check enrollment"),
              message: error && error.message ? error.message : __("Please try again."),
              indicator: "red"
            });
          }
        },
        processing
      );
    }
  }
});
""".strip()


TRANSLATIONS = {
    "ru": {
        "Trial Lesson Requests": "Заявки на пробный урок",
        "ALLIM Trial Lesson Request": "Заявка на пробный урок ALLIM",
        "Processing and enrollment": "Обработка и зачисление",
        "Student account": "Учётная запись ученика",
        "Learning group": "Учебная группа",
        "Processing": "Обработка",
        "Mark as contacted": "Отметить: связались",
        "Request marked as contacted": "Заявка отмечена как обработанная",
        "Mark as scheduled": "Отметить: запланировано",
        "Trial lesson marked as scheduled": "Пробный урок отмечен как запланированный",
        "Select a learning group before scheduling.": "Перед назначением выберите учебную группу.",
        "Open linked group": "Открыть выбранную группу",
        "Open learning groups": "Открыть учебные группы",
        "Check enrollment": "Проверить зачисление",
        "The student is not enrolled yet. Open the linked group and add the student first.": "Ученик ещё не зачислен. Откройте выбранную группу и сначала добавьте ученика.",
        "Enrollment confirmed and request updated": "Зачисление подтверждено, заявка обновлена",
        "Could not update status": "Не удалось обновить статус",
        "Could not check enrollment": "Не удалось проверить зачисление",
        "Please try again.": "Попробуйте ещё раз.",
    },
    "ar": {
        "Trial Lesson Requests": "طلبات الدروس التجريبية",
        "ALLIM Trial Lesson Request": "طلب درس تجريبي في ALLIM",
        "Processing and enrollment": "المتابعة والتسجيل",
        "Student account": "حساب الطالب",
        "Learning group": "المجموعة التعليمية",
        "Processing": "المتابعة",
        "Mark as contacted": "تحديد: تم التواصل",
        "Request marked as contacted": "تم تحديث الطلب إلى: تم التواصل",
        "Mark as scheduled": "تحديد: تمت الجدولة",
        "Trial lesson marked as scheduled": "تم تحديد الدرس التجريبي كموعد مجدول",
        "Select a learning group before scheduling.": "اختر مجموعة تعليمية قبل الجدولة.",
        "Open linked group": "فتح المجموعة المحددة",
        "Open learning groups": "فتح المجموعات التعليمية",
        "Check enrollment": "التحقق من التسجيل",
        "The student is not enrolled yet. Open the linked group and add the student first.": "لم يتم تسجيل الطالب بعد. افتح المجموعة المحددة وأضف الطالب أولاً.",
        "Enrollment confirmed and request updated": "تم تأكيد التسجيل وتحديث الطلب",
        "Could not update status": "تعذر تحديث الحالة",
        "Could not check enrollment": "تعذر التحقق من التسجيل",
        "Please try again.": "يرجى المحاولة مرة أخرى.",
    },
}


def get_sidebar_source_path() -> Path:
    app_package = Path(frappe.get_app_path("lms"))
    return app_package.parent / "frontend" / "src" / "utils" / "index.js"


def patch_sidebar_source(source: str) -> tuple[str, bool]:
    if SIDEBAR_MARKER in source:
        return source, False

    needle = "\t\t\t\t{\n\t\t\t\t\tlabel: 'Certifications',"
    if source.count(needle) != 1:
        raise RuntimeError("Could not locate the Certifications sidebar item safely")

    block = f"""\t\t\t\t// {SIDEBAR_MARKER}_START
\t\t\t\t{{
\t\t\t\t\tlabel: 'Trial Lesson Requests',
\t\t\t\t\ticon: 'ClipboardList',
\t\t\t\t\tto: 'desk/allim-trial-lesson-request',
\t\t\t\t\tcondition: () => {{
\t\t\t\t\t\treturn userResource?.data?.is_system_manager
\t\t\t\t\t}},
\t\t\t\t}},
\t\t\t\t// {SIDEBAR_MARKER}_END
"""
    return source.replace(needle, block + needle, 1), True


def snapshot(doctype: str, filters=None):
    return frappe.get_all(doctype, filters=filters or {}, fields="*", limit_page_length=0)


def upsert_translation(language: str, source: str, target: str) -> str:
    filters = {"language": language, "source_text": source, "context": ["is", "not set"]}
    name = frappe.db.exists("Translation", filters)
    document = frappe.get_doc("Translation", name) if name else frappe.new_doc("Translation")
    document.language = language
    document.source_text = source
    document.translated_text = target
    document.context = None
    document.flags.ignore_permissions = True
    document.save()
    return document.name


def upsert_client_script() -> str:
    name = frappe.db.exists("Client Script", CLIENT_SCRIPT_NAME)
    document = frappe.get_doc("Client Script", name) if name else frappe.new_doc("Client Script")
    if not name:
        document.name = CLIENT_SCRIPT_NAME
    document.dt = REQUEST_DOCTYPE
    document.view = "Form"
    document.enabled = 1
    document.script = CLIENT_SCRIPT
    document.flags.ignore_permissions = True
    document.save()
    return document.name


def backfill_student_links() -> list[dict]:
    updated = []
    requests = frappe.get_all(
        REQUEST_DOCTYPE,
        filters={"student_user": ["is", "not set"]},
        fields=["name", "email"],
        limit_page_length=0,
    )
    for request in requests:
        if not request.email:
            continue
        user = frappe.db.exists("User", request.email) or frappe.db.exists(
            "User", {"email": request.email, "enabled": 1}
        )
        if not user:
            continue
        frappe.db.set_value(
            REQUEST_DOCTYPE,
            request.name,
            "student_user",
            user,
            update_modified=False,
        )
        updated.append({"request": request.name, "student_user": user})
    return updated


def main() -> None:
    if not frappe.db.exists("DocType", REQUEST_DOCTYPE):
        raise RuntimeError(f"Missing DocType: {REQUEST_DOCTYPE}")
    if not frappe.db.exists("DocType", "LMS Batch"):
        raise RuntimeError("Missing LMS Batch DocType")

    source_path = get_sidebar_source_path()
    source = source_path.read_text(encoding="utf-8")
    patched_source, source_changed = patch_sidebar_source(source)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = BACKUP_ROOT / f"{timestamp}-trial-request-workflow"
    backup_dir.mkdir(parents=True, exist_ok=False)
    shutil.copy2(source_path, backup_dir / "lms-sidebar-index.js")

    translation_sources = [source for values in TRANSLATIONS.values() for source in values]
    backups = {
        "custom_fields": snapshot("Custom Field", {"dt": REQUEST_DOCTYPE}),
        "client_scripts": snapshot("Client Script", {"dt": REQUEST_DOCTYPE}),
        "translations": snapshot("Translation", {"source_text": ["in", translation_sources]}),
        "request_links": frappe.get_all(
            REQUEST_DOCTYPE,
            fields=["name", "email", "status"],
            limit_page_length=0,
        ),
        "counts": {
            "batches": frappe.db.count("LMS Batch"),
            "batch_enrollments": frappe.db.count("LMS Batch Enrollment"),
        },
    }
    (backup_dir / "records.json").write_text(
        frappe.as_json(backups, indent=2), encoding="utf-8"
    )

    create_custom_fields(
        {
            REQUEST_DOCTYPE: [
                {
                    "fieldname": "workflow_section",
                    "label": "Processing and enrollment",
                    "fieldtype": "Section Break",
                    "insert_after": "status",
                },
                {
                    "fieldname": "student_user",
                    "label": "Student account",
                    "fieldtype": "Link",
                    "options": "User",
                    "insert_after": "workflow_section",
                },
                {
                    "fieldname": "learning_group",
                    "label": "Learning group",
                    "fieldtype": "Link",
                    "options": "LMS Batch",
                    "insert_after": "student_user",
                },
            ]
        },
        update=True,
    )

    client_script = upsert_client_script()
    translation_names = []
    for language, values in TRANSLATIONS.items():
        for source_text, translated_text in values.items():
            translation_names.append(
                upsert_translation(language, source_text, translated_text)
            )

    backfilled = backfill_student_links()
    if source_changed:
        source_path.write_text(patched_source, encoding="utf-8")

    frappe.db.commit()
    frappe.clear_cache(doctype=REQUEST_DOCTYPE)
    frappe.clear_cache()

    counts_after = {
        "batches": frappe.db.count("LMS Batch"),
        "batch_enrollments": frappe.db.count("LMS Batch Enrollment"),
    }
    if counts_after != backups["counts"]:
        raise RuntimeError("The deployment unexpectedly changed batch or enrollment counts")

    print(
        json.dumps(
            {
                "backup": str(backup_dir),
                "sidebar_source": str(source_path),
                "sidebar_changed": source_changed,
                "client_script": client_script,
                "translations": len(translation_names),
                "student_links_backfilled": backfilled,
                "counts_before": backups["counts"],
                "counts_after": counts_after,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
