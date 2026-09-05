import importlib.util
import json
import sys
import unittest
from contextlib import nullcontext
from pathlib import Path
from unittest.mock import MagicMock, patch

from allimquran.source import fingerprint


class SetupTests(unittest.TestCase):
	def setUp(self):
		self.frappe = MagicMock()
		self.frappe.flags.in_install = False
		self.frappe.get_meta.return_value.issingle = False
		self.frappe.db.get_default.return_value = None

		def throw(message):
			raise RuntimeError(message)

		self.frappe.throw.side_effect = throw
		self.frappe.cache.lock.return_value = nullcontext()
		spec = importlib.util.spec_from_file_location("tested_setup", Path("allimquran/setup.py"))
		self.setup = importlib.util.module_from_spec(spec)
		with patch.dict(sys.modules, {"frappe": self.frappe}):
			spec.loader.exec_module(self.setup)
		self.source = {"doctype": "Web Page", "name": "test", "css": "new"}
		self.key = "Web Page:test"
		self.setup.records = lambda: iter([self.source])
		self.setup.CONTENT = MagicMock()
		self.setup.CONTENT.__truediv__.return_value.read_text.return_value = "{}"
		self.setup._current = MagicMock(return_value=None)

	def baseline(self, current):
		self.setup.CONTENT.__truediv__.return_value.read_text.return_value = json.dumps(
			{self.key: fingerprint(current, self.source)}
		)

	def state(self, current, source=None):
		self.frappe.db.get_default.return_value = json.dumps(
			{
				self.key: {
					"current": fingerprint(current, self.source),
					"source": fingerprint(source or self.source, self.source),
				}
			}
		)

	def test_new_record_can_be_installed(self):
		self.assertEqual(self.setup.preflight(), {"records": 1, "changes": [self.key]})
		self.frappe.db.commit.assert_not_called()

	def test_first_migration_accepts_exact_baseline(self):
		current = {**self.source, "css": "old"}
		self.setup._current.return_value = current
		self.baseline(current)
		self.assertEqual(self.setup.preflight()["changes"], [self.key])

	def test_unreconciled_desk_edit_aborts_without_writes(self):
		self.setup._current.return_value = {**self.source, "css": "manual edit"}
		with self.assertRaisesRegex(RuntimeError, "source drift"):
			self.setup.sync()
		self.frappe.db.commit.assert_not_called()
		self.frappe.db.set_default.assert_not_called()

	def test_tracked_source_allows_next_version(self):
		current = {**self.source, "css": "old"}
		self.setup._current.return_value = current
		self.state(current, current)
		self.assertEqual(self.setup.preflight()["changes"], [self.key])

	def test_export_baseline_cannot_bypass_drift_after_installation(self):
		baseline = {**self.source, "css": "original prototype"}
		self.baseline(baseline)
		self.state({**self.source, "css": "deployed"})
		self.setup._current.return_value = baseline
		with self.assertRaisesRegex(RuntimeError, "source drift"):
			self.setup.preflight()

	def test_unchanged_deployment_saves_no_documents(self):
		current = {**self.source}
		self.setup._current.return_value = current
		self.state(current)
		with patch.dict(sys.modules, {"frappe.website.utils": MagicMock()}):
			result = self.setup.sync()
		self.assertEqual(result, {"records": 1, "updated": []})
		self.frappe.get_doc.assert_not_called()

	def test_dry_run_never_commits(self):
		self.setup.sync(dry_run=True)
		self.frappe.cache.lock.assert_not_called()
		self.frappe.db.commit.assert_not_called()
