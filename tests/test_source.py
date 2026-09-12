import json
import os
import re
import unittest
from pathlib import Path

from allimquran.source import CONTENT, clean, fingerprint, records


class SourceTests(unittest.TestCase):
	def setUp(self):
		self.records = list(records())
		self.pages = [doc for doc in self.records if doc["doctype"] == "Web Page"]

	def test_all_pages_and_draft_preserved(self):
		self.assertEqual(len(self.pages), 24)
		self.assertEqual(sum(doc["published"] for doc in self.pages), 23)
		self.assertEqual([doc["route"] for doc in self.pages if not doc["published"]], ["allim-home-preview"])

	def test_unique_routes_and_identities(self):
		identities = [(doc["doctype"], doc["name"]) for doc in self.records]
		self.assertEqual(len(identities), len(set(identities)))
		routes = [doc["route"] for doc in self.records if doc["doctype"] in {"Web Page", "Web Form"}]
		self.assertEqual(len(routes), len(set(routes)))

	def test_forms_keep_routes_and_private_permissions(self):
		forms = [doc for doc in self.records if doc["doctype"] == "Web Form"]
		self.assertEqual(
			{doc["route"] for doc in forms}, {"academy-trial", "ru/probnyj-urok", "ar/academy-trial"}
		)
		self.assertTrue(all(doc["doc_type"] == "ALLIM Trial Lesson Request" for doc in forms))
		schema = next(doc for doc in self.records if doc["name"] == "ALLIM Trial Lesson Request")
		self.assertEqual(schema["custom"], 0)
		self.assertEqual(schema["module"], "ALLIM Quran")
		self.assertEqual({row["role"] for row in schema["permissions"]}, {"System Manager"})
		self.assertTrue(all(not doc["show_list"] and not doc["allow_edit"] for doc in forms))

	def test_progress_keys_preserved(self):
		text = json.dumps(self.pages, ensure_ascii=False)
		self.assertIn("quran-companion-prototype-v4", text)
		self.assertIn("allim-academy-plan-v1", text)

	def test_media_references_resolve(self):
		text = json.dumps(self.records, ensure_ascii=False)
		paths = set(re.findall(r"/assets/allimquran/media/([\w.\-]+)", text))
		self.assertGreaterEqual(len(paths), 10)
		for path in paths:
			self.assertTrue((CONTENT.parent / "public" / "media" / path).is_file(), path)
		self.assertNotIn("/files/allim-", text)

	def test_no_personal_records_or_secret_configuration(self):
		allowed = {
			"Web Page",
			"Web Form",
			"Website Route Meta",
			"DocType",
			"Page",
			"Website Settings",
			"Website Script",
			"Portal Settings",
			"LMS Settings",
		}
		self.assertTrue(all(doc["doctype"] in allowed for doc in self.records))
		settings = json.loads((CONTENT / "settings.json").read_text())
		for fields in settings.values():
			self.assertFalse(any(re.search(r"password|token|secret|api_key", key, re.I) for key in fields))

	def test_fingerprint_ignores_audit_metadata_but_detects_source_changes(self):
		original = {"doctype": "Web Page", "name": "home", "css": "a{}", "modified_by": "someone"}
		changed = {**original, "modified_by": "Administrator", "owner": "Administrator"}
		self.assertEqual(fingerprint(original, original), fingerprint(changed, original))
		changed["css"] = "b{}"
		self.assertNotEqual(fingerprint(original, original), fingerprint(changed, original))

	def test_child_identifiers_are_not_source(self):
		doc = {"name": "parent", "rows": [{"name": "random-id", "parent": "parent", "value": "source"}]}
		self.assertEqual(clean(doc), {"name": "parent", "rows": [{"value": "source"}]})

	def test_heterogeneous_child_fields_are_fingerprinted(self):
		source = {"fields": [{"fieldname": "title"}, {"fieldname": "status", "options": "Open\nClosed"}]}
		changed = {"fields": [{"fieldname": "title"}, {"fieldname": "status", "options": "Open\nDeleted"}]}
		self.assertNotEqual(fingerprint(source, source), fingerprint(changed, source))

	def test_search_definitions_and_turkish_routes_preserved(self):
		schemas = {doc["name"] for doc in self.records if doc["doctype"] == "DocType"}
		self.assertEqual(
			schemas,
			{
				"ALLIM Trial Lesson Request",
				"ALLIM Reading Journal",
				"ALLIM Search Audit",
				"ALLIM Search Observation",
				"ALLIM Search Opportunity",
				"ALLIM Search Prompt",
			},
		)
		page = next(doc for doc in self.records if doc["doctype"] == "Page")
		self.assertEqual(page["name"], "allim-search-center")
		self.assertEqual({row["role"] for row in page["roles"]}, {"System Manager", "Website Manager"})
		self.assertIn("tr/blog", {doc["route"] for doc in self.pages})

	def test_no_anonymous_source_execution(self):
		self.assertTrue(all(not doc.get("context_script") for doc in self.pages))

	def test_snapshot_parity_when_available(self):
		# Migration acceptance is opt-in: an old private snapshot must not prohibit
		# subsequent feature changes. Ordinary source invariants remain unconditional.
		snapshot_path = os.getenv("ALLIM_MIGRATION_SNAPSHOT")
		if not snapshot_path:
			self.skipTest("Set ALLIM_MIGRATION_SNAPSHOT only when validating a migration snapshot")
		path = Path(snapshot_path)
		if not path.exists():
			self.skipTest("Private migration snapshot is not part of the public repository")
		snapshot = json.loads(path.read_text())
		for original in snapshot["pages"] + snapshot["forms"]:
			migrated = next(doc for doc in self.records if doc["name"] == original["name"])
			for field in (
				"main_section_html",
				"css",
				"javascript",
				"client_script",
				"custom_css",
				"introduction_text",
			):
				if field in original:
					expected = original[field]
					if isinstance(expected, str):
						expected = expected.replace("/files/allim-", "/assets/allimquran/media/allim-")
					self.assertEqual(migrated.get(field), expected, (original["route"], field))
