from __future__ import annotations

import json
from pathlib import Path

import frappe


REQUEST_DOCTYPE = "ALLIM Trial Lesson Request"
CLIENT_SCRIPT_NAME = "ALLIM Trial Request Workflow"
SIDEBAR_MARKER = "ALLIM_TRIAL_REQUESTS_SIDEBAR_V1"


def main() -> None:
    app_package = Path(frappe.get_app_path("lms"))
    source_path = app_package.parent / "frontend" / "src" / "utils" / "index.js"
    source = source_path.read_text(encoding="utf-8")

    custom_fields = {}
    for fieldname in ("workflow_section", "student_user", "learning_group"):
        custom_fields[fieldname] = bool(
            frappe.db.exists(
                "Custom Field", {"dt": REQUEST_DOCTYPE, "fieldname": fieldname}
            )
        )

    client_script = frappe.db.get_value(
        "Client Script",
        CLIENT_SCRIPT_NAME,
        ["name", "enabled", "dt", "view"],
        as_dict=True,
    )
    if not client_script:
        raise RuntimeError("Missing trial-request Client Script")

    recent = frappe.get_all(
        REQUEST_DOCTYPE,
        fields=[
            "name",
            "full_name",
            "status",
            "student_user",
            "learning_group",
            "creation",
        ],
        order_by="creation desc",
        limit_page_length=5,
    )
    result = {
        "sidebar_marker": SIDEBAR_MARKER in source,
        "custom_fields": custom_fields,
        "client_script": client_script,
        "recent_requests": recent,
        "counts": {
            "requests": frappe.db.count(REQUEST_DOCTYPE),
            "batches": frappe.db.count("LMS Batch"),
            "batch_enrollments": frappe.db.count("LMS Batch Enrollment"),
        },
    }
    if not result["sidebar_marker"] or not all(custom_fields.values()):
        raise RuntimeError(f"Workflow verification failed: {result}")

    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
