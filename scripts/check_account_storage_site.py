"""Destructive ONLY to named fixture users on an isolated local Frappe test site.

Run with the Frappe Python environment and --credentials pointing to a private
JSON file {"a":{"user":...,"password":...},"b":{...}}. No credentials are logged.
This checks real HTTP sessions, CSRF, permissions, MariaDB locks and rollback.
"""

import argparse
import concurrent.futures
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def uid():
	return str(uuid4())


class Client:
	def __init__(self, url, credentials):
		self.url = url
		self.session = requests.Session()
		self.session.trust_env = False
		response = self.session.post(
			url + "/api/method/login",
			json={"usr": credentials["user"], "pwd": credentials["password"]},
			timeout=20,
		)
		assert response.status_code == 200, ("login", response.status_code)
		data = self.request("context", method="GET")
		self.session.headers["X-Frappe-CSRF-Token"] = data["csrf_token"]
		self.opened = self.request("open", {})
		self.scope = {
			"expected_account_id": self.opened["account_id"],
			"epoch": self.opened["epoch"],
			"session_binding": self.opened["session_binding"],
		}

	def request(self, method_name, data=None, *, method="POST", status=200):
		data = dict(data or {})
		headers = {}
		if method == "GET":
			for key, header in (
				("expected_account_id", "X-Allim-Account"),
				("epoch", "X-Allim-Epoch"),
				("session_binding", "X-Allim-Session"),
			):
				if key in data:
					headers[header] = data.pop(key)
		response = self.session.request(
			method,
			self.url + "/api/method/allimquran.account_storage." + method_name,
			**({"params": data, "headers": headers} if method == "GET" else {"json": data}),
			timeout=30,
		)
		assert response.status_code == status, (method_name, response.status_code, response.text[:300])
		assert "no-store" in response.headers.get("Cache-Control", ""), method_name
		return response.json().get("message", {})

	def apply(self, *operations):
		return self.request(
			"apply", {**self.scope, "protocol_version": 1, "device_id": uid(), "operations": list(operations)}
		)

	def reset(self):
		confirm = self.request("prepare_reset", {**self.scope, "scope": "all_personal_progress"})
		request = {
			**self.scope,
			"scope": "all_personal_progress",
			"confirmation": confirm["confirmation"],
			"reset_id": uid(),
		}
		first = self.request("reset", request)
		replay = self.request("reset", request)
		assert first["epoch"] == replay["epoch"] and replay["replayed"]
		self.opened = self.request("open", {})
		self.scope["epoch"] = self.opened["epoch"]
		return request

	def rows(self):
		opened = self.request("open", {})
		rows = {}
		after = None
		while True:
			params = {**self.scope, "scan_token": opened["scan_token"], "limit": 3}
			if after:
				params["after_key"] = json.dumps(after)
			data = self.request("scan", params, method="GET")
			rows.update(((r["kind"], r["id"]), r) for r in data["records"])
			after = data["after_key"]
			if not data["has_more"]:
				break
		cursor = data["catchup_from"]
		through = data["through_seq"]
		while cursor < through:
			data = self.request(
				"pull", {**self.scope, "after_seq": cursor, "through_seq": through, "limit": 3}, method="GET"
			)
			rows.update(((r["kind"], r["id"]), r) for r in data["records"])
			cursor = data["next_seq"]
		return rows


def op(kind, key, value=None, action="create", version=0, **extra):
	return {
		"op_id": uid(),
		"kind": kind,
		"id": key,
		"action": action,
		"base_version": version,
		**({"value": value} if value is not None else {}),
		**extra,
	}


def main():
	parser = argparse.ArgumentParser()
	parser.add_argument("--url", required=True)
	parser.add_argument("--credentials", required=True)
	parser.add_argument("--sites-path", required=True)
	parser.add_argument("--site", required=True)
	args = parser.parse_args()
	assert urlparse(args.url).hostname in ("127.0.0.1", "localhost")
	assert args.site == "allim-storage.localhost", "Fixture site only"
	credentials = json.loads(Path(args.credentials).read_text())
	assert all(credentials[k]["user"] == f"allim-storage-{k}@example.invalid" for k in ("a", "b"))
	a = Client(args.url, credentials["a"])
	b = Client(args.url, credentials["b"])
	a.reset()
	b.reset()
	print("PASS authenticated reset and durable reset replay")
	cycle = op("reading_cycle", uid(), {"dataset_id": "hafs-madinah-604-v1"})

	# Separate HTTP sessions/requests sharing the cookie; no mock API or DB.
	def deliver(_):
		session = requests.Session()
		session.trust_env = False
		session.cookies.update(a.session.cookies)
		session.headers.update(a.session.headers)
		response = session.post(
			args.url + "/api/method/allimquran.account_storage.apply",
			json={**a.scope, "protocol_version": 1, "device_id": uid(), "operations": [cycle]},
			timeout=30,
		)
		assert response.status_code == 200, response.status_code
		return response.json()["message"]["results"][0]

	with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
		results = list(pool.map(deliver, range(6)))
	assert sum(not r["replayed"] for r in results) == 1
	assert len({r["changed"][0]["change_seq"] for r in results}) == 1
	print("PASS six concurrent deliveries produce one record and one version")
	wrong = b.request(
		"pull",
		{**b.scope, "expected_account_id": a.scope["expected_account_id"], "after_seq": 0},
		method="GET",
		status=409,
	)
	assert wrong["error"]["code"] == "account_changed"
	for client in (a, b):
		r = client.session.get(args.url + "/api/resource/ALLIM%20Progress%20Record", timeout=20)
		assert r.status_code == 403, ("generic_resource", r.status_code)
	guest = requests.Session()
	guest.trust_env = False
	assert (
		guest.get(
			args.url + "/api/method/allimquran.account_storage.pull", params={"after_seq": 0}, timeout=20
		).status_code
		== 401
	)
	token = a.session.headers.pop("X-Frappe-CSRF-Token")
	assert a.session.post(
		args.url + "/api/method/allimquran.account_storage.open", json={}, timeout=20
	).status_code in (400, 403)
	a.session.headers["X-Frappe-CSRF-Token"] = token
	print("PASS account isolation, Guest rejection, generic REST denial and CSRF")
	bad = op("daily_goal", "current", {"sessions": True})
	good = op("bookmark", "2:255", {"position": 0})
	mixed = a.apply(good, bad)["results"]
	assert [r["outcome"] for r in mixed] == ["applied", "rejected"]
	assert a.apply(bad)["results"][0]["replayed"]
	print("PASS expected item rejection is isolated and replayable")
	note_id = uid()
	note = {"verse_key": "1:1", "reflection": "first", "action": "", "completed": False}
	a.apply(op("reflection", note_id, note))
	a.apply(op("reflection", note_id, {**note, "reflection": "A"}, "put", 1))
	conflict = a.apply(op("reflection", note_id, {**note, "reflection": "B"}, "put", 1))["results"][0]
	rows = a.rows()
	assert rows["reflection", note_id]["value"]["reflection"] == "A"
	assert rows["conflict", conflict["conflict_id"]]["value"]["proposed_value"]["reflection"] == "B"
	resolved = a.apply(
		op(
			"reflection",
			note_id,
			{**note, "reflection": "merged"},
			"resolve",
			2,
			conflicts=[{"id": conflict["conflict_id"], "version": 1}],
		)
	)["results"][0]
	assert resolved["outcome"] == "applied"
	a.apply(op("reflection", note_id, action="delete", version=3))
	assert a.apply(op("reflection", note_id, note, "put", 2))["results"][0]["error"]["code"] == "deleted"
	print("PASS conflict preservation/resolution and deletion fence")
	exported = a.request("export_data", a.scope)
	params = {**a.scope, "export_id": exported["export_id"]}
	r = a.session.get(
		args.url + "/api/method/allimquran.account_storage.download_export",
		params={"export_id": exported["export_id"]},
		headers={
			"X-Allim-Account": a.scope["expected_account_id"],
			"X-Allim-Epoch": a.scope["epoch"],
			"X-Allim-Session": a.scope["session_binding"],
		},
		timeout=20,
	)
	assert r.status_code == 200 and r.json()["account_id"] == a.scope["expected_account_id"]
	assert (
		b.request(
			"download_export", {**b.scope, "export_id": exported["export_id"]}, method="GET", status=404
		)["error"]["code"]
		== "export_expired"
	)
	a.apply(op("bookmark", "1:1", {"position": -1}))
	assert a.request("download_export", params, method="GET", status=404)["error"]["code"] == "export_expired"
	print("PASS private export and invalidation after a new write")
	# Inject a real DB failure after the progress INSERT but before its change and
	# receipt are written. The trigger is scoped to one synthetic account/record.
	import frappe

	sites_path = str(Path(args.sites_path).resolve())
	os.chdir(sites_path)
	frappe.init(args.site, sites_path=sites_path)
	frappe.connect()
	fixture = uid()
	trigger = "allim_storage_test_rollback"
	try:
		frappe.db.sql(f"DROP TRIGGER IF EXISTS `{trigger}`")
		frappe.db.sql(
			f"CREATE TRIGGER `{trigger}` BEFORE INSERT ON `tabALLIM Progress Change` FOR EACH ROW "
			f"BEGIN IF NEW.record_key = '{fixture}' AND NEW.account = '{a.scope['expected_account_id']}' "
			"THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture rollback'; END IF; END"
		)
		frappe.db.commit()
		failing = op("reading_cycle", fixture, {"dataset_id": "hafs-madinah-604-v1"})
		r = a.session.post(
			args.url + "/api/method/allimquran.account_storage.apply",
			json={**a.scope, "protocol_version": 1, "device_id": uid(), "operations": [failing]},
			timeout=20,
		)
		assert r.status_code >= 500, r.status_code
		assert ("reading_cycle", fixture) not in a.rows()
	finally:
		frappe.db.sql(f"DROP TRIGGER IF EXISTS `{trigger}`")
		frappe.db.commit()
		frappe.destroy()
	assert a.apply(failing)["results"][0]["outcome"] == "applied"
	assert a.apply(failing)["results"][0]["replayed"]
	print("PASS real SQL failure rolls back record, change cursor and receipt; retry succeeds once")
	old_scope = dict(a.scope)
	a.reset()
	r = a.request(
		"apply", {**old_scope, "protocol_version": 1, "device_id": uid(), "operations": [cycle]}, status=409
	)
	assert r["error"]["code"] == "epoch_changed"
	assert not a.rows()
	assert not b.rows()
	print("PASS reset rejects late writes and does not touch another account")
	a.request("end_session", a.scope)
	assert a.request("context", method="GET")["mode"] == "guest"
	print("PASS actual Frappe logout; all server integration checks completed")


if __name__ == "__main__":
	main()
