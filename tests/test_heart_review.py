import unittest
from uuid import uuid4

from test_account_storage import MemoryRepository, operation

from allimquran.storage.service import Service
from allimquran.storage.validation import StorageError, validate_record


class HeartReviewTests(unittest.TestCase):
	def plan(self, **changes):
		return {
			"hafiz": True,
			"review_start": "2026-11-22",
			"review_days": 30,
			"khatm_mode": "ramadan",
			"khatm_start": "2026-11-22",
			"ramadan_days": 29,
			"cycle_ids": [str(uuid4()), str(uuid4())],
			**changes,
		}

	def test_plan_bounds_and_cycles(self):
		validate_record("devotional_plan", "current", self.plan())
		for changes in (
			{"review_days": 0},
			{"hafiz": 1},
			{"ramadan_days": 31},
			{"cycle_ids": [str(uuid4())]},
			{"khatm_start": "2026-02-30"},
		):
			with self.assertRaises(StorageError):
				validate_record("devotional_plan", "current", self.plan(**changes))

	def test_review_is_bounded_and_self_reported(self):
		base = {
			"recorded_at": "2026-11-22T12:00:00.000Z",
			"local_date": "2026-11-22",
			"evidence": "self_reported",
		}
		validate_record("heart_review", str(uuid4()), {**base, "verse_key": "1:1"})
		validate_record("heart_review", str(uuid4()), {**base, "first_page": 1, "last_page": 21})
		for extra in (
			{"first_page": 0, "last_page": 1},
			{"first_page": 2, "last_page": 1},
			{"verse_key": "1:1", "first_page": 1},
			{"verse_key": "1:1", "evidence": "teacher"},
		):
			with self.assertRaises(StorageError):
				validate_record("heart_review", str(uuid4()), {**base, **extra})

	def test_plan_references_owned_cycles_and_preserves_history(self):
		repo = MemoryRepository()
		service = Service(repo)
		plan = self.plan()
		result = service.apply(operation("devotional_plan", "current", plan))
		self.assertEqual(result["error"]["code"], "cycle_not_found")
		for cycle in plan["cycle_ids"]:
			self.assertEqual(
				service.apply(operation("reading_cycle", cycle, {"dataset_id": "hafs-madinah-604-v1"}))[
					"outcome"
				],
				"applied",
			)
		self.assertEqual(service.apply(operation("devotional_plan", "current", plan))["outcome"], "applied")
		result = service.apply(operation("reading_cycle", plan["cycle_ids"][0], action="delete", version=1))
		self.assertEqual(result["error"]["code"], "cycle_in_use")

	def test_review_retries_are_idempotent(self):
		repo = MemoryRepository()
		service = Service(repo)
		op = operation(
			"heart_review",
			str(uuid4()),
			{
				"verse_key": "1:1",
				"recorded_at": "2026-11-22T12:00:00.000Z",
				"local_date": "2026-11-22",
				"evidence": "self_reported",
			},
		)
		self.assertEqual(service.apply(op)["outcome"], "applied")
		self.assertTrue(service.apply(op)["replayed"])
		self.assertEqual(len(repo.records("heart_review")), 1)
