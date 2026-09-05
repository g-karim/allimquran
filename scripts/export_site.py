"""Read-only, source-only export. Run with the site's Bench Python from bench/sites.

No users, submitted forms, course records, private files, or site_config are exported.
"""

import argparse
import json
from pathlib import Path

import frappe

METADATA = {
	"owner",
	"modified_by",
	"creation",
	"modified",
	"_user_tags",
	"_comments",
	"_assign",
	"_liked_by",
	"parent",
	"parenttype",
	"parentfield",
}


def clean(value, child=False):
	if callable(getattr(value, "as_dict", None)):
		value = value.as_dict()
	if isinstance(value, dict):
		return {
			key: clean(item, isinstance(item, list))
			for key, item in value.items()
			if key not in METADATA and not (child and key == "name") and not key.startswith("__")
		}
	if isinstance(value, list):
		return [clean(item, True) for item in value]
	return value


def export(site, destination):
	frappe.init(site=site)
	frappe.connect()
	try:
		pages = [frappe.get_doc("Web Page", name) for name in frappe.get_all("Web Page", pluck="name")]
		forms = [
			frappe.get_doc("Web Form", name)
			for name in frappe.get_all(
				"Web Form", filters={"doc_type": "ALLIM Trial Lesson Request"}, pluck="name"
			)
		]
		settings_fields = {
			"Website Settings": [
				"app_name",
				"title_prefix",
				"home_page",
				"website_theme",
				"head_html",
				"robots_txt",
				"hide_footer_signup",
				"hide_login",
				"show_language_picker",
				"navbar_search",
				"disable_signup",
				"show_footer_on_login",
				"show_account_deletion_link",
				"auto_account_deletion",
				"route_redirects",
				"top_bar_items",
				"footer_items",
			],
			"Website Script": ["javascript"],
			"Navbar Settings": ["app_logo"],
			"Portal Settings": ["hide_standard_menu"],
			"LMS Settings": ["allow_guest_access", "disable_signup", "disable_pwa", "default_home"],
		}
		settings = {
			doctype: clean({field: frappe.get_single(doctype).get(field) for field in fields})
			for doctype, fields in settings_fields.items()
		}
		result = {
			"pages": [clean(doc.as_dict()) for doc in pages],
			"forms": [clean(doc.as_dict()) for doc in forms],
			"doctypes": [clean(frappe.get_doc("DocType", "ALLIM Trial Lesson Request").as_dict())],
			"route_meta": [
				clean(frappe.get_doc("Website Route Meta", name).as_dict())
				for name in frappe.get_all("Website Route Meta", pluck="name")
			],
			"settings": settings,
			"revisions": {doc.doctype + ":" + doc.name: str(doc.modified) for doc in [*pages, *forms]},
		}
		Path(destination).write_text(json.dumps(result, ensure_ascii=False, indent=2, default=str) + "\n")
	finally:
		frappe.db.rollback()
		frappe.destroy()


if __name__ == "__main__":
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("site")
	parser.add_argument("destination")
	args = parser.parse_args()
	export(args.site, args.destination)
