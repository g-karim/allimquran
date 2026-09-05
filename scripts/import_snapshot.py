"""Split a reviewed source-only export into editable application source files."""

import argparse
import json
from pathlib import Path

from allimquran.source import fingerprint

ROOT = Path(__file__).resolve().parents[1] / "allimquran"
CONTENT = ROOT / "website_content"
SOURCE_FIELDS = {
	"pages": {"main_section_html": "html", "css": "css", "javascript": "js"},
	"forms": {"client_script": "js", "custom_css": "css", "introduction_text": "html"},
}


def write_json(path, value):
	path.parent.mkdir(parents=True, exist_ok=True)
	path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def convert(snapshot):
	baseline = {}
	for group, fields in SOURCE_FIELDS.items():
		for original in snapshot[group]:
			doc = dict(original)
			baseline[doc["doctype"] + ":" + doc["name"]] = fingerprint(original, original)
			doc["module"] = "ALLIM Quran"
			folder = CONTENT / group / doc["route"]
			folder.mkdir(parents=True, exist_ok=True)
			sources = {}
			for field, extension in fields.items():
				value = doc.pop(field)
				if value is not None:
					filename = f"{field}.{extension}"
					(folder / filename).write_text(
						value.replace("/files/allim-", "/assets/allimquran/media/allim-")
					)
					sources[field] = filename
				else:
					doc[field] = None
			doc["_source_files"] = sources
			write_json(folder / "page.json", doc)
	for doc in snapshot["route_meta"]:
		baseline[doc["doctype"] + ":" + doc["name"]] = fingerprint(doc, doc)
	write_json(CONTENT / "route_meta.json", snapshot["route_meta"])
	settings = snapshot["settings"]
	# This is another application's Desk branding, not an ALLIM website asset.
	settings.pop("Navbar Settings", None)
	for doctype, fields in settings.items():
		record = {"doctype": doctype, "name": doctype, **fields}
		baseline[doctype + ":" + doctype] = fingerprint(record, record)
	write_json(CONTENT / "settings.json", settings)
	for original in snapshot["doctypes"]:
		doc = dict(original, module="ALLIM Quran", custom=0)
		doc.pop("migration_hash", None)
		doc["field_order"] = [field["fieldname"] for field in doc["fields"]]
		template = {key: value for key, value in doc.items() if key != "field_order"}
		baseline[doc["doctype"] + ":" + doc["name"]] = fingerprint(original, template)
		name = doc["name"].lower().replace(" ", "_")
		write_json(ROOT / "allim_quran" / "doctype" / name / f"{name}.json", doc)
	write_json(CONTENT / "migration_baseline.json", baseline)


if __name__ == "__main__":
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("snapshot", type=Path)
	convert(json.loads(parser.parse_args().snapshot.read_text()))
