import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("reading_core", ROOT / "allimquran/reading_journal_core.py")
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


class JournalValidation(unittest.TestCase):
	def entry(self):
		return {
			"id": "one",
			"date": "2026-09-12",
			"cycle": 1,
			"source": "paper",
			"parts": [{"page": 1, "full": True, "total": 0, "keys": [], "letters": None}],
		}

	def test_valid_and_canonical(self):
		b = core.fresh()
		b["entries"] = [self.entry()]
		validated, text, digest = core.validate(b)
		self.assertEqual(validated, b)
		self.assertEqual(core.validate(json.dumps(b, sort_keys=True))[2], digest)

	def test_invalid_inputs(self):
		variants = []
		for field, value in (
			("past", True),
			("past", -1),
			("cycle", 0),
			("deadline", "2026-02-30"),
			("version", True),
		):
			b = core.fresh()
			b[field] = value
			variants.append(b)
		b = core.fresh()
		b["entries"] = [self.entry(), self.entry()]
		variants.append(b)
		b = core.fresh()
		e = self.entry()
		e["parts"][0]["page"] = 605
		b["entries"] = [e]
		variants.append(b)
		b = core.fresh()
		e = self.entry()
		e["parts"][0].update(full=False, total=0)
		b["entries"] = [e]
		variants.append(b)
		b = core.fresh()
		e = self.entry()
		e["parts"][0]["keys"] = ["115:1:1"]
		b["entries"] = [e]
		variants.append(b)
		b = core.fresh()
		b["owner"] = "other"
		variants.append(b)
		for value in variants:
			with self.subTest(value=value), self.assertRaises(ValueError):
				core.validate(value)

	def test_idempotency(self):
		operation = "12345678-1234-1234-1234-123456789abc"
		self.assertEqual(core.decide(0, None, None, 0, operation, "digest"), "save")
		self.assertEqual(core.decide(1, operation, "digest", 0, operation, "digest"), "replayed")
		with self.assertRaises(ValueError):
			core.decide(1, operation, "digest", 0, operation, "different")
		self.assertEqual(core.decide(2, None, None, 1, operation, "digest"), "conflict")
		with self.assertRaises(ValueError):
			core.decide(0, None, None, True, operation, "digest")

	def test_private_schema(self):
		schema = json.loads(
			(
				ROOT / "allimquran/allim_quran/doctype/allim_reading_journal/allim_reading_journal.json"
			).read_text()
		)
		self.assertEqual(schema["has_web_view"], 0)
		self.assertEqual(schema["permissions"], [{"role": "System Manager", "read": 1}])
		self.assertEqual(next(f for f in schema["fields"] if f["fieldname"] == "account")["unique"], 1)


class EndpointBoundary(unittest.TestCase):
	def setUp(self):
		import types
		from unittest.mock import patch

		self.row = None
		self.locked = False
		self.enabled = True
		self.token = "csrf-token"
		self.f = types.ModuleType("frappe")
		self.f.PermissionError = PermissionError
		self.f.ValidationError = ValueError
		self.f.session = types.SimpleNamespace(user="reader-a", data={"csrf_token": self.token})
		self.f.local = types.SimpleNamespace(response_headers={})
		self.f.whitelist = lambda **kwargs: lambda fn: fn
		self.f.throw = lambda text, kind: (_ for _ in ()).throw(kind(text))
		self.f.get_request_header = lambda _: self.token
		self.f.db = types.SimpleNamespace(
			get_value=lambda *args: self.enabled,
			exists=lambda *args: self.row is not None,
			sql=self.sql,
			set_value=self.set_value,
		)
		self.f.get_doc = self.get_doc
		sessions = types.ModuleType("frappe.sessions")
		sessions.get_csrf_token = lambda: self.token
		package = types.ModuleType("allimquran")
		package.__path__ = []
		self.modules = patch.dict(
			"sys.modules",
			{
				"frappe": self.f,
				"frappe.sessions": sessions,
				"allimquran": package,
				"allimquran.reading_journal_core": core,
			},
		)
		self.modules.start()
		self.addCleanup(self.modules.stop)
		spec = importlib.util.spec_from_file_location(
			"reading_endpoint", ROOT / "allimquran/reading_journal.py"
		)
		self.api = importlib.util.module_from_spec(spec)
		spec.loader.exec_module(self.api)

	def sql(self, query, params, as_dict=False):
		import types

		self.assertIn("for update", query.lower())
		if "`tabUser`" in query:
			self.locked = True
			return [types.SimpleNamespace(name=params[0], enabled=self.enabled)]
		self.assertTrue(self.locked)
		return [self.row] if self.row else []

	def set_value(self, doctype, name, values):
		self.assertTrue(self.locked)
		for key, value in values.items():
			setattr(self.row, key, value)

	def get_doc(self, doctype, name=None):
		import types

		if isinstance(doctype, dict):
			row = types.SimpleNamespace(**doctype)

			def insert(ignore_permissions):
				self.assertTrue(self.locked)
				self.assertTrue(ignore_permissions)
				self.row = row

			row.insert = insert
			return row
		return self.row

	def test_guest_disabled_and_other_account(self):
		self.f.session.user = "Guest"
		with self.assertRaises(PermissionError):
			self.api.load()
		self.f.session.user = "reader-a"
		self.enabled = False
		with self.assertRaises(PermissionError):
			self.api.load()
		self.enabled = True
		with self.assertRaises(PermissionError):
			self.api.save(core.fresh(), 0, "a" * 36, "reader-b")
		self.assertFalse(self.locked)

	def test_csrf_and_owner_boundary(self):
		self.token = "invalid"
		with self.assertRaises(PermissionError):
			self.api.save(core.fresh(), 0, "a" * 36, "reader-a")
		self.assertIsNone(self.row)
		self.assertFalse(self.locked)

	def test_round_trip_retry_and_conflict(self):
		operation = "12345678-1234-1234-1234-123456789abc"
		initial = self.api.load()
		self.assertEqual(initial["revision"], 0)
		result = self.api.save(core.fresh(), 0, operation, "reader-a")
		self.assertEqual(result["revision"], 1)
		self.assertEqual(self.row.account, "reader-a")
		self.assertEqual(self.api.save(core.fresh(), 0, operation, "reader-a")["status"], "replayed")
		self.assertEqual(
			self.api.save(core.fresh(), 0, "22345678-1234-1234-1234-123456789abc", "reader-a")["status"],
			"conflict",
		)
		self.assertEqual(self.row.revision, 1)
		self.assertEqual(self.f.local.response_headers["Cache-Control"], "private, no-store")


if __name__ == "__main__":
	unittest.main()
