"""Check the extracted legacy validator without loading Frappe or exposing an API."""

import importlib.util
import json
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
	"reading_journal_candidate", ROOT / "proposals/account-storage/reading_journal_v1.py"
)
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)


class ReadingJournalCandidateTests(unittest.TestCase):
	def book(self):
		return {
			**legacy.fresh(),
			"entries": [
				{
					"id": "example-reading",
					"date": "2026-09-14",
					"cycle": 1,
					"source": "paper",
					"parts": [{"page": 1, "full": True, "total": 0, "keys": [], "letters": None}],
				}
			],
		}

	def test_legacy_backup_round_trip_and_stable_digest(self):
		book = self.book()
		validated, serialized, digest = legacy.validate(book)
		self.assertEqual(validated, book)
		self.assertEqual(json.loads(serialized), book)
		self.assertEqual(legacy.validate(json.dumps(book, sort_keys=True))[2], digest)
		book["past"] = 2
		self.assertNotEqual(legacy.validate(book)[2], digest)

	def test_reject_invalid_dates_and_boolean_counters(self):
		for field, value in (("past", True), ("past", -1), ("cycle", 0), ("deadline", "2026-02-30")):
			with self.subTest(field=field, value=value), self.assertRaises(ValueError):
				legacy.validate({**self.book(), field: value})

	def test_reject_duplicate_entries_and_pages(self):
		book = self.book()
		book["entries"].append(book["entries"][0])
		with self.assertRaisesRegex(ValueError, "duplicate_or_invalid_id"):
			legacy.validate(book)
		book = self.book()
		book["entries"][0]["parts"] *= 2
		with self.assertRaisesRegex(ValueError, "invalid_page"):
			legacy.validate(book)

	def test_partial_page_requires_word_evidence(self):
		book = self.book()
		part = book["entries"][0]["parts"][0]
		part.update(full=False, total=4)
		with self.assertRaisesRegex(ValueError, "invalid_partial_page"):
			legacy.validate(book)
		part["keys"] = ["1:1:1", "1:1:2"]
		self.assertEqual(legacy.validate(book)[0], book)
		part["keys"].append("1:1:1")
		with self.assertRaisesRegex(ValueError, "invalid_word"):
			legacy.validate(book)

	def test_reject_out_of_range_page_and_word(self):
		book = self.book()
		part = book["entries"][0]["parts"][0]
		part["page"] = 605
		with self.assertRaisesRegex(ValueError, "invalid_page"):
			legacy.validate(book)
		part.update(page=1, keys=["115:1:1"])
		with self.assertRaisesRegex(ValueError, "invalid_word"):
			legacy.validate(book)

	def test_owner_fields_are_not_accepted_from_a_backup(self):
		with self.assertRaisesRegex(ValueError, "invalid_journal"):
			legacy.validate({**self.book(), "owner": "someone-else"})

	def test_size_limit_applies_to_parsed_and_serialized_backups(self):
		book = self.book()
		with patch.object(legacy, "MAX_BYTES", 10):
			for value in (book, json.dumps(book)):
				with self.subTest(value=value), self.assertRaisesRegex(ValueError, "journal_too_large"):
					legacy.validate(value)

	def test_last_operation_retry_and_stale_revision(self):
		operation = "12345678-1234-1234-1234-123456789abc"
		self.assertEqual(legacy.decide(0, None, None, 0, operation, "digest"), "save")
		self.assertEqual(legacy.decide(1, operation, "digest", 0, operation, "digest"), "replayed")
		with self.assertRaisesRegex(ValueError, "operation_reused"):
			legacy.decide(1, operation, "digest", 0, operation, "different")
		self.assertEqual(legacy.decide(2, None, None, 1, operation, "digest"), "conflict")


if __name__ == "__main__":
	unittest.main()
