"""Seed validated synthetic history on the named local release fixture only.

This measures fixture generation, not HTTP write throughput. Browser acceptance
subsequently measures real paged API bootstrap and local projection.
"""

import argparse
import json
import os
import time
from pathlib import Path
from uuid import uuid4

from check_account_storage_site import Client, op


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--sites-path", type=Path, required=True)
	parser.add_argument("--credentials", type=Path, required=True)
	parser.add_argument("--url", default="http://127.0.0.1:18143")
	args = parser.parse_args()
	assert args.url == "http://127.0.0.1:18143", "Dedicated release fixture only"
	os.chdir(args.sites_path)
	import frappe

	from allimquran.storage.repository import Repository
	from allimquran.storage.service import Service

	credentials = json.loads(args.credentials.read_text())
	assert credentials["a"]["user"] == "allim-storage-a@example.invalid"
	a = Client(args.url, credentials["a"])
	a.reset()
	frappe.init("allim-release.localhost")
	frappe.connect()
	frappe.set_user(credentials["a"]["user"])
	cycle = str(uuid4())
	account = a.scope["expected_account_id"]

	def batch(operations):
		service = Service(Repository(account, credentials["a"]["user"], lock=True))
		for operation in operations:
			result = service.apply(operation)
			assert result["outcome"] == "applied", result
		frappe.db.commit()

	batch(
		[
			op("reading_cycle", cycle, {"dataset_id": "hafs-madinah-604-v1"}),
			op("reading_plan", "current", {"cycle_id": cycle, "deadline": None}),
		]
	)
	started = time.perf_counter()
	for first in range(0, 5000, 25):
		operations = []
		for i in range(first, first + 25):
			attempt = str(uuid4())
			timing = {
				"occurred_at": f"2026-09-01T{i // 3600:02}:{i // 60 % 60:02}:{i % 60:02}.000Z",
				"local_date": "2026-09-01",
				"utc_offset_minutes": 0,
				"time_zone": "UTC",
			}
			operations.append(
				op(
					"learning_event",
					str(uuid4()),
					{
						**timing,
						"attempt_id": attempt,
						"event_type": "verse_completed",
						"verse_key": "1:1",
						"mode": "read",
						"matched_words": 4,
						"hints_used": 0,
						"full_verse": True,
						"alignment_complete": True,
						"evidence": "client_alignment",
						"ruleset": "current-300-v1",
					},
				)
			)
			operations.append(
				op(
					"reading_entry",
					attempt,
					{
						**timing,
						"cycle_id": cycle,
						"source": "digital",
						"evidence": "self_reported",
						"parts": [{"page": 1, "full": True, "word_keys": []}],
					},
				)
			)
		batch(operations)
	print(
		json.dumps(
			{
				"records": 10002,
				"sessions": 5000,
				"journal_entries": 5000,
				"volume_pages": 5000,
				"current_pages": 1,
				"fixture_seconds": round(time.perf_counter() - started, 2),
			}
		)
	)
	frappe.destroy()


if __name__ == "__main__":
	main()
