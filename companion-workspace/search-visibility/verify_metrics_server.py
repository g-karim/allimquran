from __future__ import annotations

import json

import frappe


def main() -> None:
    latest = frappe.db.get_value(
        "ALLIM Search Audit",
        {},
        ["batch_id"],
        order_by="audited_at desc",
    )
    audits = frappe.get_all(
        "ALLIM Search Audit",
        filters={"batch_id": latest},
        fields=["route", "score", "status"],
    )
    course = next((row for row in audits if row.route == "/lms/courses"), None)
    counts: dict[str, int] = {}
    for row in audits:
        counts[row.status] = counts.get(row.status, 0) + 1
    result = {
        "batch_id": latest,
        "pages": len(audits),
        "average_score": round(sum(row.score for row in audits) / len(audits)) if audits else 0,
        "statuses": counts,
        "course_collection": dict(course) if course else None,
        "opportunities": {
            status: frappe.db.count("ALLIM Search Opportunity", {"status": status})
            for status in ("Open", "Resolved")
        },
        "observations": frappe.db.count("ALLIM Search Observation"),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))


main()
