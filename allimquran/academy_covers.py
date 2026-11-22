"""Reproducible, explicit course-image update; no shared application changes."""

import json
from pathlib import Path

import frappe


def apply(dry_run=True):
	"""Preview first; validate every identity before changing any course image."""
	dry_run = str(dry_run).lower() not in ("false", "0")
	frappe.only_for("System Manager")
	manifest = json.loads((Path(__file__).parent / "public/data/academy-covers.json").read_text())
	changes, missing = [], []
	for cover in manifest["covers"]:
		if cover.get("course"):
			names = [cover["course"]]
		elif cover.get("match_title"):
			names = frappe.get_all("LMS Course", filters={"title": cover["title"]}, pluck="name")
		else:
			continue
		for name in names:
			doc = frappe.db.get_value("LMS Course", name, ["name", "title", "image"], as_dict=True)
			if not doc:
				missing.append(name)
				continue
			if doc.title != cover["title"]:
				frappe.throw("Course title changed; review the cover manifest before applying: " + doc.name)
			url = "/assets/allimquran/media/academy-covers/" + cover["file"]
			if doc.image != url:
				changes.append({"name": doc.name, "title": doc.title, "old_image": doc.image, "image": url})
	if not dry_run and missing:
		frappe.throw("Required courses are missing: " + ", ".join(missing))
	if not dry_run:
		for item in changes:
			doc = frappe.get_doc("LMS Course", item["name"])
			doc.image = item["image"]
			doc.save()
	return {"dry_run": dry_run, "changes": changes, "missing": missing}
