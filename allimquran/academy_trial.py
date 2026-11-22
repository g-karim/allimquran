"""Contact details for the signed-in learner's lesson request."""

import frappe


def current_contact():
    user = frappe.session.user
    if not user or user == "Guest":
        return {}
    profile = frappe.db.get_value("User", user, ["full_name", "email"], as_dict=True)
    return {key: profile.get(key) or "" for key in ("full_name", "email")} if profile else {}


@frappe.whitelist()
def contact():
    return current_contact()
