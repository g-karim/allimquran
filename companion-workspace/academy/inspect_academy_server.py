from __future__ import annotations

import json

import frappe


SITE = "allimquran.com"


def field_names(doctype: str) -> list[str]:
    if not frappe.db.exists("DocType", doctype):
        return []
    return [field.fieldname for field in frappe.get_meta(doctype).fields if field.fieldname]


def count(doctype: str) -> int | None:
    if not frappe.db.exists("DocType", doctype):
        return None
    return frappe.db.count(doctype)


def main() -> None:
    frappe.init(site=SITE, sites_path=".")
    frappe.connect()
    try:
        doctypes = [
            "LMS Course",
            "LMS Enrollment",
            "LMS Batch",
            "LMS Batch Enrollment",
            "LMS Live Class",
            "LMS Assignment",
            "LMS Assignment Submission",
            "LMS Program",
            "LMS Program Member",
            "LMS Course Progress",
        ]
        workspaces = frappe.get_all(
            "Workspace",
            filters={"name": ["in", ["Learning", "Academy", "ALLIM Academy"]]},
            fields=["name", "title", "public", "for_user", "module"],
        )
        result = {
            "workspaces": workspaces,
            "counts": {doctype: count(doctype) for doctype in doctypes},
            "fields": {doctype: field_names(doctype) for doctype in doctypes},
            "roles": frappe.get_all(
                "Role",
                filters={"name": ["in", ["LMS Student", "Course Creator", "Moderator", "Batch Evaluator"]]},
                fields=["name", "desk_access", "disabled"],
            ),
        }
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    finally:
        frappe.destroy()


if __name__ == "__main__":
    main()
