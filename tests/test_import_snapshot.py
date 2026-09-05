import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import import_snapshot


class ImportSnapshotTests(unittest.TestCase):
	def snapshot(self):
		return {
			"pages": [
				{
					"doctype": "Web Page",
					"name": "test",
					"route": "test",
					"main_section_html": '<img src="/files/allim-brand-icon.png">',
					"css": None,
					"javascript": None,
				}
			],
			"forms": [],
			"route_meta": [],
			"settings": {},
			"doctypes": [],
		}

	def test_reviewed_snapshot_can_keep_exact_media_paths(self):
		for keep in (False, True):
			with self.subTest(keep=keep), tempfile.TemporaryDirectory() as directory:
				content = Path(directory)
				with patch.object(import_snapshot, "CONTENT", content):
					import_snapshot.convert(self.snapshot(), keep_media_paths=keep)
				text = (content / "pages/test/main_section_html.html").read_text()
				prefix = "/files/" if keep else "/assets/allimquran/media/"
				self.assertEqual(text, f'<img src="{prefix}allim-brand-icon.png">')

	def test_reexport_does_not_replace_initial_baseline(self):
		with tempfile.TemporaryDirectory() as directory:
			content = Path(directory)
			path = content / "migration_baseline.json"
			path.write_text(json.dumps({"Web Page:test": "original-fingerprint"}))
			with patch.object(import_snapshot, "CONTENT", content):
				import_snapshot.convert(self.snapshot())
			self.assertEqual(json.loads(path.read_text())["Web Page:test"], "original-fingerprint")
