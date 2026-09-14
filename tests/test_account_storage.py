import copy
import unittest
from uuid import uuid4

from allimquran.storage.projection import project
from allimquran.storage.service import Service
from allimquran.storage.validation import StorageError, catalogue, digest, parse_json, validate_record


def new_id():
	return str(uuid4())


def operation(kind, key, value=None, action="create", version=0, **extra):
	return {
		"op_id": new_id(),
		"action": action,
		"kind": kind,
		"id": key,
		"base_version": version,
		**({"value": value} if value is not None else {}),
		**extra,
	}


def event(**extra):
	return {
		"event_type": "verse_completed",
		"attempt_id": new_id(),
		"occurred_at": "2026-09-14T08:00:00.000Z",
		"local_date": "2026-09-14",
		"utc_offset_minutes": 0,
		"time_zone": "UTC",
		"verse_key": "1:1",
		"mode": "read",
		"matched_words": 4,
		"hints_used": 0,
		"full_verse": True,
		"alignment_complete": True,
		"evidence": "client_alignment",
		"ruleset": "current-300-v1",
		**extra,
	}


class MemoryRepository:
	"""Pure operation tests only; real DB/HTTP verification is a separate script."""

	def __init__(self):
		self.epoch = new_id()
		self.seq = 0
		self.rows = {}
		self.receipts = {}
		self.events = {}
		self.points = {}

	def record(self, kind, key):
		return self.rows.get((kind, key))

	def records(self, kind=None):
		return [copy.deepcopy(row) for (group, _), row in self.rows.items() if kind is None or kind == group]

	def receipt(self, key):
		return self.receipts.get(key)

	def save_receipt(self, key, hashed, result):
		self.receipts[key] = {"digest": hashed, "result": result}

	def next_seq(self):
		self.seq += 1
		return self.seq

	def save_record(self, row, semantic_key=None, import_item_id=None):
		self.rows[(row["kind"], row["id"])] = copy.deepcopy(row)
		if semantic_key:
			self.events[semantic_key] = row["id"]

	def event(self, key):
		return self.record("learning_event", self.events.get(key))

	def savepoint(self, name):
		self.points[name] = copy.deepcopy((self.rows, self.events, self.seq))

	def rollback(self, name):
		self.rows, self.events, self.seq = self.points[name]


class AccountStorageTests(unittest.TestCase):
	def setUp(self):
		self.repo = MemoryRepository()
		self.service = Service(self.repo)

	def apply(self, op):
		return self.service.apply(op)

	def test_lost_response_is_replayed_without_new_credit(self):
		op = operation("learning_event", new_id(), event())
		first = self.apply(op)
		second = self.apply(copy.deepcopy(op))
		self.assertEqual(first["changed"], second["changed"])
		self.assertTrue(second["replayed"])
		self.assertEqual(self.repo.seq, 1)
		self.assertEqual(project(self.repo.records())["sessions"], 1)

	def test_same_attempt_with_different_operation_id_is_not_another_recitation(self):
		value = event()
		first = operation("learning_event", new_id(), value)
		self.apply(first)
		result = self.apply(operation("learning_event", new_id(), value))
		self.assertEqual(result["outcome"], "noop")
		self.assertEqual(result["event_id"], first["id"])
		self.assertEqual(project(self.repo.records())["heartMushaf"]["units"]["1:1"]["weekCounts"], [1, 0, 0])

	def test_reusing_operation_id_for_different_body_is_rejected(self):
		op = operation("daily_goal", "current", {"sessions": 1})
		self.apply(op)
		with self.assertRaisesRegex(StorageError, "op_id_reused"):
			self.apply({**op, "value": {"sessions": 5}})
		self.assertEqual(self.repo.record("daily_goal", "current")["value"], {"sessions": 1})

	def test_concurrent_note_edit_preserves_both_and_resolution_checks_version(self):
		key = new_id()
		initial = {"verse_key": "1:1", "reflection": "initial", "action": "", "completed": False}
		self.apply(operation("reflection", key, initial))
		self.apply(operation("reflection", key, {**initial, "reflection": "device A"}, "put", 1))
		conflict = self.apply(operation("reflection", key, {**initial, "reflection": "device B"}, "put", 1))
		draft = self.repo.record("conflict", conflict["conflict_id"])
		self.assertEqual(draft["value"]["proposed_value"]["reflection"], "device B")
		self.assertEqual(self.repo.record("reflection", key)["value"]["reflection"], "device A")
		bad = self.apply(
			operation("reflection", key, initial, "resolve", 1, conflicts=[{"id": draft["id"], "version": 1}])
		)
		self.assertEqual(bad["error"]["code"], "conflict_again")
		good = self.apply(
			operation(
				"reflection",
				key,
				{**initial, "reflection": "combined"},
				"resolve",
				2,
				conflicts=[{"id": draft["id"], "version": 1}],
			)
		)
		self.assertEqual(good["outcome"], "applied")
		self.assertNotIn("proposed_value", self.repo.record("conflict", draft["id"])["value"])

	def test_stale_edit_and_recreate_cannot_resurrect_a_deleted_note(self):
		key = new_id()
		value = {"verse_key": "1:1", "reflection": "private", "action": "", "completed": False}
		self.apply(operation("reflection", key, value))
		self.apply(operation("reflection", key, action="delete", version=1))
		for action, version in (("create", 0), ("put", 1)):
			self.assertEqual(
				self.apply(operation("reflection", key, value, action, version))["error"]["code"], "deleted"
			)
		self.assertIsNone(self.repo.record("reflection", key)["value"])

	def test_membership_restoration_is_explicit_and_versioned(self):
		self.apply(operation("bookmark", "2:255", {"position": 0}))
		self.apply(operation("bookmark", "2:255", action="delete", version=1))
		self.assertEqual(
			self.apply(operation("bookmark", "2:255", {"position": -1}))["error"]["code"], "deleted"
		)
		self.assertEqual(
			self.apply(operation("bookmark", "2:255", {"position": -1}, "restore_membership", 2))["outcome"],
			"applied",
		)

	def test_voiding_event_does_not_free_semantic_key(self):
		value = event()
		key = new_id()
		self.apply(operation("learning_event", key, value))
		self.apply(operation("learning_event", key, action="delete", version=1))
		self.assertEqual(self.apply(operation("learning_event", new_id(), value))["error"]["code"], "deleted")
		self.assertEqual(project(self.repo.records())["sessions"], 0)

	def test_bad_value_gets_receipt_without_partial_mutation(self):
		op = operation("daily_goal", "current", {"sessions": True})
		self.assertEqual(self.apply(op)["outcome"], "rejected")
		self.assertTrue(self.apply(op)["replayed"])
		self.assertEqual(self.repo.seq, 0)

	def test_actual_quran_references_are_checked(self):
		self.assertEqual(len(catalogue()), 6236)
		self.assertEqual(len(catalogue()["1:1"]), 4)
		with self.assertRaises(StorageError):
			validate_record("bookmark", "1:8", {"position": 0})
		value = {
			"cycle_id": new_id(),
			"local_date": "2026-09-14",
			"source": "digital",
			"evidence": "self_reported",
			"parts": [{"page": 1, "full": False, "word_keys": ["2:255:1"]}],
		}
		with self.assertRaisesRegex(StorageError, "invalid_word_coverage"):
			validate_record("reading_entry", new_id(), value)

	def test_hint_and_partial_reading_do_not_credit_hifz(self):
		self.apply(
			operation("learning_event", new_id(), event(mode="memory", hints_used=1, full_verse=False))
		)
		self.assertEqual(project(self.repo.records())["sessions"], 1)
		self.assertEqual(project(self.repo.records())["heartMushaf"]["units"], {})

	def test_order_of_delivery_does_not_change_projection(self):
		for hour in (11, 9, 10):
			self.apply(
				operation("learning_event", new_id(), event(occurred_at=f"2026-09-14T{hour:02}:00:00.000Z"))
			)
		rows = self.repo.records()
		self.assertEqual(project(rows), project(list(reversed(rows))))
		self.assertEqual(
			project(rows)["heartMushaf"]["units"]["1:1"]["lastAcceptedAt"], "2026-09-14T11:00:00.000Z"
		)

	def test_timezone_and_invalid_calendar_date(self):
		with self.assertRaisesRegex(StorageError, "clock_invalid"):
			validate_record(
				"learning_event", new_id(), event(time_zone="Europe/Moscow", utc_offset_minutes=0)
			)
		with self.assertRaises(StorageError):
			validate_record("learning_event", new_id(), event(local_date="2026-02-30"))

	def test_unknown_fields_duplicate_keys_and_unsafe_numbers(self):
		for text in ('{"x":1,"x":2}', '{"x":NaN}', '{"x":1.5}', '{"x":9007199254740992}', '{"__proto__":{}}'):
			with self.assertRaises(StorageError):
				parse_json(text)
		with self.assertRaises(StorageError):
			validate_record("preference", "language", {"selected": "ru", "owner": "other"})

	def test_import_is_idempotent_and_refuses_overlapping_aggregates(self):
		source = new_id()
		hashed = digest({"old": "data"})
		manifest = "import:" + digest([hashed, 1])
		self.apply(
			operation(
				"import_manifest",
				manifest,
				{"source_id": source, "source_digest": hashed, "mapping_version": 1},
				"begin_import",
			)
		)
		self.apply(operation("learning_event", new_id(), event()))
		item = "import:" + digest([source, "activity_baseline", "totals", 0])
		value = {
			"sessions": 200,
			"words_reviewed": 800,
			"hints": 3,
			"provenance": {
				"source_id": source,
				"source_digest": hashed,
				"mapping_version": 1,
				"legacy_key": "totals",
			},
		}
		op = operation(
			"activity_baseline",
			"totals",
			value,
			"import_item",
			import_id=manifest,
			import_item_id=item,
			source_key={"legacy_key": "totals", "occurrence_index": 0},
		)
		result = self.apply(op)
		self.assertEqual(result["import_result"]["outcome"], "skipped_conflict")
		self.assertTrue(self.apply(op)["replayed"])
		self.assertEqual(project(self.repo.records())["sessions"], 1)
