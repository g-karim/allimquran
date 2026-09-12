REQUEST_DOCTYPE = "ALLIM Trial Lesson Request"
CLIENT_SCRIPT_NAME = "ALLIM Trial Request Workflow"
ENTRY_ROUTE = "academy/trial-requests"

client_script = r'''
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
'''.strip()

translations = {
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

counts_before = {
    "batches": frappe.db.count("LMS Batch"),
    "batch_enrollments": frappe.db.count("LMS Batch Enrollment"),
}

translation_sources = []
for language in translations:
    for source_text in translations[language]:
        if source_text not in translation_sources:
            translation_sources.append(source_text)

settings = frappe.get_doc("LMS Settings", "LMS Settings")
backups = {
    "custom_fields": frappe.get_all(
        "Custom Field",
        filters={"dt": REQUEST_DOCTYPE},
        fields="*",
        limit_page_length=0,
    ),
    "client_scripts": frappe.get_all(
        "Client Script",
        filters={"dt": REQUEST_DOCTYPE},
        fields="*",
        limit_page_length=0,
    ),
    "translations": frappe.get_all(
        "Translation",
        filters={"source_text": ["in", translation_sources]},
        fields="*",
        limit_page_length=0,
    ),
    "sidebar_items": [row.as_dict() for row in settings.sidebar_items],
    "request_links": frappe.get_all(
        REQUEST_DOCTYPE,
        fields=["name", "email", "status"],
        limit_page_length=0,
    ),
    "counts": counts_before,
}

timestamp = frappe.utils.now_datetime().strftime("%Y%m%dT%H%M%S")
backup_file = frappe.get_doc(
    {
        "doctype": "File",
        "file_name": timestamp + "-trial-request-workflow-backup.json",
        "is_private": 1,
        "content": frappe.as_json(backups, indent=2),
    }
)
backup_file.flags.ignore_permissions = True
backup_file.insert()

custom_fields = [
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

for values in custom_fields:
    field_name = frappe.db.exists(
        "Custom Field",
        {"dt": REQUEST_DOCTYPE, "fieldname": values["fieldname"]},
    )
    field = frappe.get_doc("Custom Field", field_name) if field_name else frappe.new_doc("Custom Field")
    field.dt = REQUEST_DOCTYPE
    field.fieldname = values["fieldname"]
    field.label = values["label"]
    field.fieldtype = values["fieldtype"]
    field.insert_after = values["insert_after"]
    field.options = values.get("options")
    field.is_system_generated = 1
    field.flags.ignore_permissions = True
    field.save()

script_name = frappe.db.exists("Client Script", CLIENT_SCRIPT_NAME)
script = frappe.get_doc("Client Script", script_name) if script_name else frappe.new_doc("Client Script")
if not script_name:
    script.name = CLIENT_SCRIPT_NAME
script.dt = REQUEST_DOCTYPE
script.view = "Form"
script.enabled = 1
script.script = client_script
script.flags.ignore_permissions = True
script.save()

for language in translations:
    for source_text in translations[language]:
        translation_name = frappe.db.exists(
            "Translation",
            {
                "language": language,
                "source_text": source_text,
                "context": ["is", "not set"],
            },
        )
        translation = frappe.get_doc("Translation", translation_name) if translation_name else frappe.new_doc("Translation")
        translation.language = language
        translation.source_text = source_text
        translation.translated_text = translations[language][source_text]
        translation.context = None
        translation.flags.ignore_permissions = True
        translation.save()

entry_name = frappe.db.exists("Web Page", {"route": ENTRY_ROUTE})
entry = frappe.get_doc("Web Page", entry_name) if entry_name else frappe.new_doc("Web Page")
entry.title = "Trial Lesson Requests"
entry.route = ENTRY_ROUTE
entry.published = 1
entry.content_type = "HTML"
entry.main_section_html = '''
<section class="allim-trial-entry">
  <p class="eyebrow">ALLIM ACADEMY</p>
  <h1>Trial Lesson Requests · Заявки на пробный урок · طلبات الدروس التجريبية</h1>
  <p>Open the protected Academy request list.</p>
  <a href="/desk/allim-trial-lesson-request">Open requests</a>
</section>
'''.strip()
entry.insert_style = 1
entry.css = '''
.allim-trial-entry{width:min(760px,calc(100% - 32px));margin:64px auto;padding:32px;border:1px solid #d7ddd8;border-radius:18px;background:#fffdf8;color:#17352e;box-shadow:0 24px 70px rgba(31,65,56,.1)}
.allim-trial-entry h1{font:500 clamp(28px,5vw,46px)/1.08 Georgia,serif}.allim-trial-entry p{line-height:1.6}.allim-trial-entry .eyebrow{color:#376b5e;font-size:11px;font-weight:800;letter-spacing:.14em}.allim-trial-entry a{display:inline-flex;min-height:48px;align-items:center;margin-top:12px;padding:0 22px;border-radius:14px;background:#244f45;color:#fff;text-decoration:none}
'''.strip()
entry.javascript = 'window.location.replace("/desk/allim-trial-lesson-request");'
entry.full_width = 1
entry.show_title = 0
entry.show_sidebar = 0
entry.enable_comments = 0
entry.flags.ignore_permissions = True
entry.save()

settings = frappe.get_doc("LMS Settings", "LMS Settings")
sidebar_row = None
for row in settings.sidebar_items:
    if row.web_page == entry.name:
        sidebar_row = row
        break
if sidebar_row:
    sidebar_row.icon = "ClipboardList"
else:
    settings.append(
        "sidebar_items",
        {"web_page": entry.name, "icon": "ClipboardList"},
    )
settings.flags.ignore_permissions = True
settings.save()

backfilled = []
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
    backfilled.append({"request": request.name, "student_user": user})

frappe.clear_cache(doctype=REQUEST_DOCTYPE)
frappe.clear_cache()

counts_after = {
    "batches": frappe.db.count("LMS Batch"),
    "batch_enrollments": frappe.db.count("LMS Batch Enrollment"),
}
if counts_after != counts_before:
    frappe.throw("The deployment unexpectedly changed batch or enrollment counts")

result = {
    "backup_file": backup_file.file_url,
    "entry_route": ENTRY_ROUTE,
    "client_script": script.name,
    "backfilled": backfilled,
    "counts_before": counts_before,
    "counts_after": counts_after,
}
log(frappe.as_json(result, indent=2))
