import base64
import hashlib
import unittest

from test_account_storage import MemoryRepository, event, new_id, operation

from allimquran.storage.learning import page_keys, tasks
from allimquran.storage.projection import project
from allimquran.storage.service import Service
from allimquran.storage.validation import StorageError, digest, validate_record


class LearningRepository(MemoryRepository):
	def records(self, kind=None, *, prefix=None):
		rows = super().records(kind)
		return [row for row in rows if prefix is None or row["id"].startswith(prefix)]

	def event(self, key):
		return next((r for r in self.rows.values() if r["id"] == self.events.get(key)), None)


class LearningStorageTests(unittest.TestCase):
	def setUp(self):
		self.repo = LearningRepository()
		self.service = Service(self.repo)

	def apply(self, kind, key, value=None, **options):
		return self.service.apply(operation(kind, key, value, **options))

	def photo(self, *, image=None, payload=None):
		payload = payload or b"\x89PNG\r\n\x1a\n" + b"x" * 50000
		encoded = base64.b64encode(payload).decode()
		image = image or new_id()
		parts = [encoded[i : i + 32768] for i in range(0, len(encoded), 32768)]
		for index, part in enumerate(parts):
			self.assertEqual(
				self.apply("lawh_image_part", f"{image}/{index}", {"data": part})["outcome"], "applied"
			)
		return {
			"image_id": image,
			"parts": len(parts),
			"bytes": len(payload),
			"sha256": hashlib.sha256(payload).hexdigest(),
			"mime": "image/png",
			"width": 1600,
			"height": 2000,
			"file_name": "my-page.png",
		}

	def test_method_preferences_validate(self):
		for method in ("foundation300", "linked33", "turkishWall33", "mauritanianLawh"):
			validate_record("preference", "memorization_method", {"selected": method})
		with self.assertRaises(StorageError):
			validate_record("preference", "memorization_method", {"selected": "invented"})

	def test_legacy_method_baseline_never_adds_to_new_account_practice(self):
		source_id, source_digest = new_id(), "a" * 64
		manifest = "import:" + digest([source_digest, 1])
		self.apply(
			"import_manifest",
			manifest,
			{"source_id": source_id, "source_digest": source_digest, "mapping_version": 1},
			action="begin_import",
		)
		v = event()
		credit = {
			k: v[k] for k in ("occurred_at", "local_date", "utc_offset_minutes", "time_zone", "attempt_id")
		}
		credit.update(
			method="linked33",
			page=1,
			task_type="verse",
			task_key="1:1",
			verse_keys=["1:1"],
			evidence="client_alignment",
			without_hints=True,
		)
		self.apply("hifz_credit", new_id(), credit)
		for method, expected in [("linked33", "skipped_conflict"), ("turkishWall33", "applied")]:
			key = method + "/1"
			source_key = {"legacy_key": "hifz_method_baseline/" + key, "occurrence_index": 0}
			item = "import:" + digest([source_id, "hifz_method_baseline", source_key["legacy_key"], 0])
			value = {
				"verse_counts": {"1:1": 32},
				"link_counts": {},
				"daily": {},
				"started_at": None,
				"last_accepted_at": None,
				"completed_at": None,
				"provenance": {
					"source_id": source_id,
					"source_digest": source_digest,
					"mapping_version": 1,
					"legacy_key": source_key["legacy_key"],
				},
			}
			op = operation(
				"hifz_method_baseline",
				key,
				value,
				action="import_item",
				import_id=manifest,
				import_item_id=item,
				source_key=source_key,
			)
			self.assertEqual(self.service.apply(op)["import_result"]["outcome"], expected)
			self.assertTrue(self.service.apply(op)["replayed"])

	def test_plan_cas_conflict_and_tombstone_fence(self):
		key = new_id()
		value = {
			"action": "memorize",
			"verse_keys": ["1:1", "1:2"],
			"portion": 1,
			"created_on": "2026-10-17",
			"deadline": None,
		}
		self.assertEqual(self.apply("memory_plan", key, value)["outcome"], "applied")
		self.apply("memory_plan", key, {**value, "portion": 2}, action="put", version=1)
		self.assertEqual(
			self.apply("memory_plan", key, {**value, "portion": 3}, action="put", version=1)["outcome"],
			"conflict",
		)
		self.assertEqual(self.repo.record("memory_plan", key)["value"]["portion"], 2)
		conflict = self.repo.records("conflict")[0]
		self.apply(
			"memory_plan",
			key,
			action="resolve",
			version=2,
			resolution="delete",
			conflicts=[{"id": conflict["id"], "version": 1}],
		)
		self.assertTrue(self.repo.record("memory_plan", key)["deleted"])
		self.assertEqual(
			self.apply("memory_plan", key, value, action="put", version=1)["error"]["code"], "deleted"
		)

	def test_recall_is_immutable_and_flags_are_separate_cas_records(self):
		key = new_id()
		value = {
			"verse_key": "1:1",
			"mode": "test",
			"local_date": "2026-10-17",
			"complete": True,
			"total_words": 4,
			"hints": 0,
			"flags": [1],
			"seconds": 12,
		}
		op = operation("recall_attempt", key, value)
		self.assertEqual(self.service.apply(op)["outcome"], "applied")
		self.assertTrue(self.service.apply(op)["replayed"])
		self.assertEqual(
			self.apply("recall_attempt", key, {**value, "hints": 1}, action="put", version=1)["error"][
				"code"
			],
			"immutable_record",
		)
		self.assertEqual(self.apply("recall_flag", key + "/1", {"dismissed": True})["outcome"], "applied")
		self.assertEqual(
			self.apply("recall_flag", key + "/2", {"dismissed": True})["error"]["code"], "invalid_recall_flag"
		)
		self.assertEqual(
			project(self.repo.records())["sessions"], 0, "a quick check never earns foundation credit"
		)

	def test_hifz_task_order_and_retry_identity(self):
		self.assertEqual(
			[t[:2] for t in tasks("linked33", ["1:1", "1:2", "1:3"])],
			[("verse", "1:1"), ("verse", "1:2"), ("segment", "1:2"), ("verse", "1:3"), ("segment", "1:3")],
		)
		self.assertEqual(
			[t[:2] for t in tasks("turkishWall33", ["1:1", "1:2", "1:3", "1:4"])],
			[
				("verse", "1:4"),
				("verse", "1:2"),
				("verse", "1:3"),
				("segment", "1:2"),
				("verse", "1:1"),
				("segment", "1:1"),
			],
		)
		v = event()
		value = {
			k: v[k] for k in ("occurred_at", "local_date", "utc_offset_minutes", "time_zone", "attempt_id")
		}
		value.update(
			method="linked33",
			page=1,
			task_type="verse",
			task_key="1:1",
			verse_keys=["1:1"],
			evidence="client_alignment",
			without_hints=True,
		)
		self.assertEqual(self.apply("hifz_credit", new_id(), value)["outcome"], "applied")
		self.assertEqual(self.apply("hifz_credit", new_id(), value)["outcome"], "noop")
		with self.assertRaises(StorageError):
			validate_record("hifz_credit", new_id(), {**value, "verse_keys": ["2:1"]})
		with self.assertRaises(StorageError):
			validate_record("hifz_credit", new_id(), {**value, "without_hints": False})
		self.assertEqual(page_keys(1)[0], "1:1")

	def test_selected_method_never_increments_other_foundation_counter(self):
		self.apply("learning_event", new_id(), event(hifz_method="linked33"))
		self.assertEqual(project(self.repo.records())["sessions"], 1)
		self.assertEqual(project(self.repo.records())["heartMushaf"]["units"], {})

	def test_private_multipart_image_integrity_and_deletion(self):
		photo = self.photo()
		self.assertEqual(self.apply("lawh_photo", "1:1", photo)["outcome"], "applied")
		self.assertEqual(
			self.apply("lawh_image_part", photo["image_id"] + "/0", action="delete", version=1)["error"][
				"code"
			],
			"image_in_use",
		)
		self.assertEqual(self.apply("lawh_photo", "1:1", action="delete", version=1)["outcome"], "applied")
		self.assertTrue(
			all(r["deleted"] and r["value"] is None for r in self.repo.records("lawh_image_part"))
		)
		self.assertEqual(
			self.apply("lawh_photo", "1:1", photo, action="put", version=1)["error"]["code"], "deleted"
		)
		new = self.photo()
		self.assertEqual(
			self.apply("lawh_photo", "1:1", new, action="restore_membership", version=2)["outcome"], "applied"
		)

	def test_reject_incomplete_corrupt_and_active_images(self):
		photo = self.photo()
		for bad in [
			{**photo, "sha256": "0" * 64},
			{**photo, "image_id": new_id()},
			{**photo, "mime": "image/jpeg"},
		]:
			self.assertEqual(self.apply("lawh_photo", "1:1", bad)["outcome"], "rejected")
		with self.assertRaises(StorageError):
			validate_record("lawh_photo", "1:1", {**photo, "mime": "image/svg+xml"})
		with self.assertRaises(StorageError):
			validate_record("lawh_image_part", "../../public/0", {"data": "AAAA"})

	def test_photo_conflict_preserves_both_until_explicit_resolution(self):
		a, b, c = self.photo(), self.photo(), self.photo()
		self.apply("lawh_photo", "1:1", a)
		self.apply("lawh_photo", "1:1", b, action="put", version=1)
		self.assertTrue(self.repo.record("lawh_image_part", a["image_id"] + "/0")["deleted"])
		self.assertEqual(self.apply("lawh_photo", "1:1", c, action="put", version=1)["outcome"], "conflict")
		self.assertFalse(self.repo.record("lawh_image_part", c["image_id"] + "/0")["deleted"])
		conflict = self.repo.records("conflict")[0]
		self.apply(
			"lawh_photo",
			"1:1",
			c,
			action="resolve",
			version=2,
			conflicts=[{"id": conflict["id"], "version": 1}],
		)
		self.assertEqual(self.repo.record("lawh_photo", "1:1")["value"], c)
		self.assertTrue(self.repo.record("lawh_image_part", b["image_id"] + "/0")["deleted"])

	def test_unknown_fields_and_malformed_new_records_are_rejected(self):
		for kind, key in [
			("hifz_credit", new_id()),
			("lawh_practice", new_id()),
			("recall_flag", "broken"),
			("hifz_method_baseline", "broken"),
			("lawh_image_part", "broken"),
		]:
			with self.subTest(kind=kind), self.assertRaises(StorageError):
				validate_record(kind, key, {}, importing=True)
		with self.assertRaises(StorageError):
			validate_record(
				"recall_attempt",
				new_id(),
				{
					"verse_key": "1:1",
					"mode": "test",
					"local_date": "2026-10-17",
					"complete": True,
					"total_words": 999,
					"hints": 0,
					"flags": [],
					"seconds": 0,
				},
			)


if __name__ == "__main__":
	unittest.main()
