"""Explicit installation entry point; never runs during a reader request."""

import frappe


def install():
	if not frappe.db.exists("Module Def", "ALLIM Quran"):
		raise RuntimeError("Required application module is missing")
	frappe.reload_doc("allim_quran", "doctype", "allim_reading_journal")
	meta = frappe.get_meta("ALLIM Reading Journal")
	for field in ("account", "revision", "journal_json", "last_operation", "last_digest"):
		if not meta.has_field(field):
			raise RuntimeError("Incomplete journal schema")
	return {"schema": "ready", "accounts_migrated": 0}
