"""Read-only site preflight using a staged checkout on PYTHONPATH."""

import json
import sys

import frappe

frappe.init(site=sys.argv[1])
frappe.connect()
try:
	from allimquran.setup import preflight

	print(json.dumps(preflight(), ensure_ascii=False, indent=2))
finally:
	frappe.db.rollback()
	frappe.destroy()
