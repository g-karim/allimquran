"""Real scan/pull races and cursor expiry on the named local release fixture."""

import argparse
import json
import os
from pathlib import Path

from check_account_storage_site import Client, op


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--sites-path", type=Path, required=True)
	parser.add_argument("--credentials", type=Path, required=True)
	args = parser.parse_args()
	credentials = json.loads(args.credentials.read_text())
	assert credentials["a"]["user"] == "allim-storage-a@example.invalid"
	a = Client("http://127.0.0.1:18143", credentials["a"])
	a.reset()
	original = op("preference", "language", {"selected": "ru"})
	a.apply(original, op("preference", "show_meaning", {"selected": True}))
	opened = a.request("open", {})
	params = {**a.scope, "scan_token": opened["scan_token"], "limit": 1}
	first = a.request("scan", params, method="GET")
	assert first["after_key"] == ["preference", "language"]
	# Insert before the scan cursor; delete an already scanned row; update the next.
	a.apply(
		op("bookmark", "1:1", {"position": 0}),
		op("preference", "language", action="delete", version=1),
		op("preference", "show_meaning", {"selected": False}, action="put", version=1),
	)
	seen = {(row["kind"], row["id"]): row for row in first["records"]}
	page = first
	while page["has_more"]:
		page = a.request("scan", {**params, "after_key": json.dumps(page["after_key"])}, method="GET")
		seen.update(((r["kind"], r["id"]), r) for r in page["records"])
	cursor, through = page["catchup_from"], page["through_seq"]
	while cursor < through:
		page = a.request(
			"pull", {**a.scope, "after_seq": cursor, "through_seq": through, "limit": 1}, method="GET"
		)
		for row in page["records"]:
			key = row["kind"], row["id"]
			if key not in seen or row["version"] >= seen[key]["version"]:
				seen[key] = row
		assert page["next_seq"] > cursor
		cursor = page["next_seq"]
	assert seen == a.rows()
	assert seen["preference", "language"]["deleted"]
	assert not seen["preference", "show_meaning"]["value"]["selected"]
	assert ("bookmark", "1:1") in seen
	print("PASS scan insertion/deletion/update races converge via bounded catch-up")
	os.chdir(args.sites_path)
	import frappe

	from allimquran.account_storage import cleanup
	from allimquran.storage.repository import CHANGE, OPERATION, RECORD

	frappe.init("allim-release.localhost")
	frappe.connect()
	frappe.set_user("Administrator")
	filters = {"account": a.scope["expected_account_id"], "epoch": a.scope["epoch"]}
	before = {dt: frappe.db.count(dt, filters) for dt in (RECORD, OPERATION)}
	frappe.db.set_value(CHANGE, filters, "creation", "2020-01-01 00:00:00", update_modified=False)
	cleanup()
	frappe.db.commit()
	assert frappe.db.count(CHANGE, filters) == 0
	assert before == {dt: frappe.db.count(dt, filters) for dt in (RECORD, OPERATION)}
	frappe.destroy()
	assert (
		a.request("pull", {**a.scope, "after_seq": 0}, method="GET", status=409)["error"]["code"]
		== "cursor_expired"
	)
	assert a.apply(original)["results"][0]["replayed"]
	assert a.rows() == seen
	print(
		"PASS real cleanup expires cursor and retains tombstones/receipts; bootstrap and old replay succeed"
	)


if __name__ == "__main__":
	main()
