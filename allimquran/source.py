"""Source manifest and deterministic drift detection; does not import Frappe."""

import hashlib
import json
from pathlib import Path

CONTENT = Path(__file__).parent / "website_content"
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
	"idx",
	"docstatus",
}


def clean(value, child=False):
	if callable(getattr(value, "as_dict", None)):
		value = value.as_dict()
	if isinstance(value, dict):
		return {
			key: clean(item)
			for key, item in value.items()
			if key not in METADATA and not (child and key == "name") and not key.startswith("__")
		}
	if isinstance(value, list):
		return [clean(item, child=True) for item in value]
	return value


def project(value, template):
	"""Ignore framework-owned fields not managed by this source record."""
	if isinstance(template, dict):
		return {key: project((value or {}).get(key), item) for key, item in template.items()}
	if isinstance(template, list):
		if not template:
			return value or []
		return [
			project(item, template[index] if index < len(template) else template[-1])
			for index, item in enumerate(value or [])
		]
	return value


def fingerprint(value, template):
	data = project(clean(value), clean(template))
	return hashlib.sha256(
		json.dumps(data, ensure_ascii=False, sort_keys=True, default=str).encode()
	).hexdigest()


def records():
	for path in sorted((CONTENT.parent / "allim_quran" / "doctype").glob("*/*.json")):
		doc = json.loads(path.read_text())
		doc.pop("field_order", None)
		yield doc
	for path in sorted((CONTENT.parent / "allim_quran" / "page").glob("*/*.json")):
		yield json.loads(path.read_text())
	for group in ("pages", "forms"):
		for path in sorted((CONTENT / group).rglob("page.json")):
			doc = json.loads(path.read_text())
			for field, filename in doc.pop("_source_files", {}).items():
				source = (path.parent / filename).resolve()
				if not source.is_relative_to(CONTENT.resolve()):
					raise ValueError(f"Source path escapes content directory: {filename}")
				doc[field] = source.read_text()
			yield doc
	yield from json.loads((CONTENT / "route_meta.json").read_text())
	for doctype, fields in json.loads((CONTENT / "settings.json").read_text()).items():
		yield {"doctype": doctype, "name": doctype, **fields}
