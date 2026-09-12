(() => {
  const copy = {
    en: {
      processing: "Processing",
      mark_contacted: "Mark as contacted",
      contacted_done: "Request marked as contacted",
      mark_scheduled: "Mark as scheduled",
      scheduled_done: "Trial lesson marked as scheduled",
      select_group: "Select a learning group before scheduling.",
      open_group: "Open linked group",
      open_groups: "Open learning groups",
      check_enrollment: "Check enrollment",
      not_enrolled: "The student is not enrolled yet. Open the linked group and add the student first.",
      enrollment_done: "Enrollment confirmed and request updated",
      update_error: "Could not update status",
      check_error: "Could not check enrollment",
      retry: "Please try again."
    },
    ru: {
      processing: "Обработка",
      mark_contacted: "Отметить: связались",
      contacted_done: "Заявка отмечена как обработанная",
      mark_scheduled: "Отметить: запланировано",
      scheduled_done: "Пробный урок отмечен как запланированный",
      select_group: "Перед назначением выберите учебную группу.",
      open_group: "Открыть выбранную группу",
      open_groups: "Открыть учебные группы",
      check_enrollment: "Проверить зачисление",
      not_enrolled: "Ученик ещё не зачислен. Откройте выбранную группу и сначала добавьте ученика.",
      enrollment_done: "Зачисление подтверждено, заявка обновлена",
      update_error: "Не удалось обновить статус",
      check_error: "Не удалось проверить зачисление",
      retry: "Попробуйте ещё раз."
    },
    ar: {
      processing: "المتابعة",
      mark_contacted: "تحديد: تم التواصل",
      contacted_done: "تم تحديث الطلب إلى: تم التواصل",
      mark_scheduled: "تحديد: تمت الجدولة",
      scheduled_done: "تم تحديد الدرس التجريبي كموعد مجدول",
      select_group: "اختر مجموعة تعليمية قبل الجدولة.",
      open_group: "فتح المجموعة المحددة",
      open_groups: "فتح المجموعات التعليمية",
      check_enrollment: "التحقق من التسجيل",
      not_enrolled: "لم يتم تسجيل الطالب بعد. افتح المجموعة المحددة وأضف الطالب أولاً.",
      enrollment_done: "تم تأكيد التسجيل وتحديث الطلب",
      update_error: "تعذر تحديث الحالة",
      check_error: "تعذر التحقق من التسجيل",
      retry: "يرجى المحاولة مرة أخرى."
    }
  };

  const activeLanguage = () => {
    const language = (frappe.boot && frappe.boot.lang) || "en";
    return language.toLowerCase().split("-")[0];
  };

  const t = (key) => {
    const language = activeLanguage();
    return (copy[language] && copy[language][key]) || copy.en[key] || key;
  };

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

      const processing = t("processing");

      const updateStatus = async (status, successKey) => {
        try {
          await frm.set_value("status", status);
          await frm.save();
          frappe.show_alert({ message: t(successKey), indicator: "green" });
        } catch (error) {
          frappe.msgprint({
            title: t("update_error"),
            message: error && error.message ? error.message : t("retry"),
            indicator: "red"
          });
        }
      };

      if (frm.doc.status === "New") {
        frm.add_custom_button(
          t("mark_contacted"),
          () => updateStatus("Contacted", "contacted_done"),
          processing
        );
      }

      if (frm.doc.status === "Contacted") {
        frm.add_custom_button(
          t("mark_scheduled"),
          async () => {
            if (!frm.doc.learning_group) {
              frappe.msgprint(t("select_group"));
              return;
            }
            await updateStatus("Scheduled", "scheduled_done");
          },
          processing
        );
      }

      if (frm.doc.learning_group) {
        frm.add_custom_button(
          t("open_group"),
          () => window.location.assign(
            "/lms/batches/" + encodeURIComponent(frm.doc.learning_group)
          ),
          processing
        );
      } else {
        frm.add_custom_button(
          t("open_groups"),
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
          t("check_enrollment"),
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
                frappe.msgprint(t("not_enrolled"));
                return;
              }
              await frm.set_value("status", "Enrolled");
              await frm.save();
              frappe.show_alert({ message: t("enrollment_done"), indicator: "green" });
            } catch (error) {
              frappe.msgprint({
                title: t("check_error"),
                message: error && error.message ? error.message : t("retry"),
                indicator: "red"
              });
            }
          },
          processing
        );
      }
    }
  });
})();
