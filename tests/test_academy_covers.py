import importlib.util
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


class AcademyCoverTests(unittest.TestCase):
	def setUp(self):
		self.api = MagicMock()

		def throw(message):
			raise RuntimeError(message)

		self.api.throw.side_effect = throw
		self.api.get_all.return_value = []
		spec = importlib.util.spec_from_file_location("tested_covers", Path("allimquran/academy_covers.py"))
		self.module = importlib.util.module_from_spec(spec)
		with patch.dict(sys.modules, {"frappe": self.api}):
			spec.loader.exec_module(self.module)
		manifest = json.loads(Path("allimquran/public/data/academy-covers.json").read_text())
		self.covers = [row for row in manifest["covers"] if row.get("course")]
		self.documents = {
			row["course"]: SimpleNamespace(name=row["course"], title=row["title"], image="/old.jpg")
			for row in self.covers
		}
		self.api.db.get_value.side_effect = lambda _doctype, name, *_args, **_kwargs: self.documents.get(name)

	def test_default_is_read_only_and_reports_previous_images(self):
		result = self.module.apply()
		self.api.only_for.assert_called_once_with("System Manager")
		self.assertTrue(result["dry_run"])
		self.assertEqual(len(result["changes"]), len(self.covers))
		self.assertTrue(all(row["old_image"] == "/old.jpg" for row in result["changes"]))
		self.api.get_doc.assert_not_called()

	def test_missing_or_renamed_course_aborts_before_any_save(self):
		name = self.covers[-1]["course"]
		doc = self.documents.pop(name)
		with self.assertRaisesRegex(RuntimeError, "missing"):
			self.module.apply(False)
		self.api.get_doc.assert_not_called()
		doc.title = "Changed title"
		self.documents[name] = doc
		with self.assertRaisesRegex(RuntimeError, "title changed"):
			self.module.apply(False)
		self.api.get_doc.assert_not_called()

	def test_explicit_apply_changes_only_image_and_is_idempotent(self):
		for doc in self.documents.values():
			doc.save = MagicMock()
		self.api.get_doc.side_effect = lambda _doctype, name: self.documents[name]
		result = self.module.apply(False)
		self.assertEqual(len(result["changes"]), len(self.covers))
		for cover in self.covers:
			doc = self.documents[cover["course"]]
			self.assertEqual(doc.title, cover["title"])
			self.assertEqual(doc.image, "/assets/allimquran/media/academy-covers/" + cover["file"])
			doc.save.assert_called_once_with()
		self.assertEqual(self.module.apply(False)["changes"], [])

	def test_role_check_precedes_all_data_access(self):
		self.api.only_for.side_effect = PermissionError
		with self.assertRaises(PermissionError):
			self.module.apply(False)
		self.api.db.get_value.assert_not_called()
		self.api.get_doc.assert_not_called()
