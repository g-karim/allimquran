"""Cross-language projection contract and assisted-reading evidence."""

import copy
import json
import random
import subprocess
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from allimquran.storage.projection import empty_page, empty_unit, project
from allimquran.storage.validation import StorageError, catalogue, validate_record
from tests.test_account_storage import event

ROOT = Path(__file__).resolve().parents[1]


def row(kind, key, value):
	return {"kind": kind, "id": key, "value": value, "deleted": False}


class ProgressParityTests(unittest.TestCase):
	def compare(self, records):
		result = subprocess.run(
			[
				"node",
				"-e",
				"const p=require('./allimquran/public/js/account-progress.js');"
				"const data=JSON.parse(require('fs').readFileSync(0,'utf8'));"
				"process.stdout.write(JSON.stringify(p.project(data.records,data.catalogue)));",
			],
			input=json.dumps({"records": records, "catalogue": catalogue()}),
			text=True,
			capture_output=True,
			check=True,
			cwd=ROOT,
		)
		self.assertEqual(json.loads(result.stdout), project(records))

	def test_foundation_maintenance_dst_and_out_of_order_delivery(self):
		records = []
		for number in range(300):
			when = datetime(2026, 3, 1, 10, tzinfo=UTC) + timedelta(seconds=number)
			records.append(
				row(
					"learning_event",
					str(uuid4()),
					event(
						occurred_at=when.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
						local_date="2026-03-01",
						time_zone="Europe/Berlin",
						utc_offset_minutes=60,
					),
				)
			)
		for number in range(20):
			when = datetime(2026, 4, 1, 10, tzinfo=UTC) + timedelta(seconds=number)
			records.append(
				row(
					"learning_event",
					str(uuid4()),
					event(
						occurred_at=when.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
						local_date="2026-04-01",
						time_zone="Europe/Berlin",
						utc_offset_minutes=120,
					),
				)
			)
		random.Random(71).shuffle(records)
		self.compare(records)
		unit = project(records)["heartMushaf"]["units"]["1:1"]
		self.assertEqual(unit["nextReviewAt"], "2026-05-31T10:00:00.000Z")
		self.assertEqual(unit["maintenanceLevel"], 1)

	def test_hint_partial_void_and_fixed_timezone(self):
		records = [
			row("learning_event", str(uuid4()), event(mode="memory", full_verse=False, hints_used=1)),
			row(
				"learning_event",
				str(uuid4()),
				{
					key: value
					for key, value in event(event_type="hint_used", hint_index=1).items()
					if key
					in {
						"occurred_at",
						"local_date",
						"utc_offset_minutes",
						"time_zone",
						"attempt_id",
						"event_type",
						"hint_index",
						"verse_key",
					}
				},
			),
			{**row("learning_event", str(uuid4()), event()), "deleted": True},
		]
		self.compare(records)
		self.assertEqual(project(records)["heartMushaf"]["units"], {})

	def test_import_baselines_and_connected_page_eligibility(self):
		records = [
			row("activity_baseline", "totals", {"sessions": 20, "words_reviewed": 80, "hints": 4}),
			row("activity_day_baseline", "2026-09-13", {"count": 3}),
		]
		for key, pages in catalogue().items():
			if 1 not in pages:
				continue
			unit = empty_unit()
			unit["weekCounts"] = [100, 100, 100]
			mapping = {
				"weekCounts": "week_counts",
				"maintenanceCount": "maintenance_count",
				"maintenanceLevel": "maintenance_level",
				"startedAt": "started_at",
				"lastAcceptedAt": "last_accepted_at",
				"completedAt": "completed_at",
				"nextReviewAt": "next_review_at",
				"permanent": "permanent",
			}
			records.append(row("hifz_unit_baseline", key, {b: unit[a] for a, b in mapping.items()}))
			records.append(row("hifz_day_baseline", key + "/2026-09-13", {"count": 2}))
		attempt = str(uuid4())
		for kind in ("connected_completed", "connected_started"):
			records.append(
				row(
					"learning_event",
					str(uuid4()),
					{
						"event_type": kind,
						"attempt_id": attempt,
						"page": 1,
						"occurred_at": "2026-09-14T08:00:00.000Z",
						"local_date": "2026-09-14",
					},
				)
			)
		self.compare(records)
		self.assertTrue(project(records)["heartMushaf"]["pages"]["1"]["permanent"])
		records = [item for item in records if item["value"].get("event_type") != "connected_started"]
		self.compare(records)
		self.assertEqual(project(records)["heartMushaf"]["pages"]["1"], empty_page(1))

	def test_assisted_completion_is_never_full_alignment_evidence(self):
		value = event(
			mode="memory",
			matched_words=2,
			full_verse=False,
			alignment_complete=False,
			evidence="assisted_completion",
		)
		validate_record("learning_event", str(uuid4()), value)
		self.compare([row("learning_event", str(uuid4()), value)])
		for changed in ({"mode": "read"}, {"full_verse": True}, {"alignment_complete": True}):
			with self.assertRaises(StorageError):
				validate_record("learning_event", str(uuid4()), {**copy.deepcopy(value), **changed})


if __name__ == "__main__":
	unittest.main()
