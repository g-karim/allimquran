"""Regression check for concurrent CSRF initialization on a local fixture site.

Logs in and opens only the two named fixture accounts; never resets their data.
No passwords, cookies or CSRF/session tokens are printed. A failure is an open
release blocker, not a reason to disable CSRF or pre-warm the tested session.
"""

import argparse
import concurrent.futures
import json
import threading
from contextlib import chdir
from pathlib import Path
from urllib.parse import urlparse

import requests


def check(url, credentials, prepare_session=None, peer_url=None):
	workers = (url, peer_url) if peer_url else (url,)
	with requests.Session() as session:
		session.trust_env = False
		login = session.post(
			url + "/api/method/login",
			json={"usr": credentials["user"], "pwd": credentials["password"]},
			timeout=20,
		)
		assert login.status_code == 200, ("fixture login", login.status_code)
		cookies = session.cookies.copy()
		if prepare_session:
			# Local integration fixtures can model a pre-upgrade tokenless session.
			# This callback never runs in the normal fresh-login regression.
			prepare_session(cookies.get("sid"))
		barrier = threading.Barrier(6)

		def first_context(index):
			with requests.Session() as client:
				client.trust_env = False
				client.cookies.update(cookies)
				barrier.wait(timeout=10)
				response = client.get(
					workers[index % len(workers)] + "/api/method/allimquran.account_storage.context",
					timeout=20,
				)
				assert response.status_code == 200, ("context", response.status_code)
				assert "no-store" in response.headers.get("Cache-Control", "")
				assert "Set-Cookie" not in response.headers
				return response.json()["message"]

		with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
			contexts = list(pool.map(first_context, range(6)))
		open_barrier = threading.Barrier(6)

		def first_open(indexed):
			index, context = indexed
			with requests.Session() as client:
				client.trust_env = False
				client.cookies.update(cookies)
				open_barrier.wait(timeout=10)
				response = client.post(
					workers[index % len(workers)] + "/api/method/allimquran.account_storage.open",
					json={},
					headers={"X-Frappe-CSRF-Token": context["csrf_token"]},
					timeout=20,
				)
				return {
					"status": response.status_code,
					"exception": response.json().get("exc_type"),
					"no_store": "no-store" in response.headers.get("Cache-Control", ""),
					"sets_cookie": "Set-Cookie" in response.headers,
				}, response.json().get("message", {}).get("account_id")

		with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
			opens = list(pool.map(first_open, enumerate(contexts)))
		results = [row for row, _account in opens]
		rejected = []
		for headers in ({}, {"X-Frappe-CSRF-Token": "invalid-fixture-token"}):
			response = session.post(
				url + "/api/method/allimquran.account_storage.open", json={}, headers=headers, timeout=20
			)
			rejected.append(response.status_code)
			assert response.json().get("exc_type") == "CSRFTokenError"
			assert (
				"no-store" in response.headers.get("Cache-Control", "")
				and "Set-Cookie" not in response.headers
			)
		result = {
			"server_origins": len(workers),
			"parallel_first_contexts": len(contexts),
			"distinct_csrf_tokens": len({context["csrf_token"] for context in contexts}),
			"distinct_session_bindings": len({context["session_binding"] for context in contexts}),
			"distinct_accounts": len({account for _row, account in opens if account}),
			"opens": results,
			"missing_and_wrong_csrf": rejected,
		}
		print(json.dumps(result, indent=2))
		assert result["distinct_csrf_tokens"] == 1, "Concurrent first contexts produced different CSRF tokens"
		assert result["distinct_session_bindings"] == 1
		assert all(context["legacy_owner"] == credentials["user"] for context in contexts)
		assert result["distinct_accounts"] == 1
		assert all(row["status"] == 200 for row in results), "A first context could not open its account"
		assert all(row["no_store"] and not row["sets_cookie"] for row in results)
		assert rejected == [400, 400], "Missing and wrong CSRF tokens must remain rejected"
		print("PASS concurrent first contexts/opens share one token/account; invalid CSRF stays rejected")
		return result


def clear_fixture_csrf(sid, user, site, sites):
	"""Model an existing pre-upgrade session, exclusively for a loopback fixture."""
	import frappe

	sites = sites.resolve()
	with chdir(sites):
		frappe.init(site=site, sites_path=str(sites))
		frappe.connect()
		try:
			table = frappe.qb.DocType("Sessions")
			rows = (
				frappe.qb.from_(table)
				.select(table.user, table.sessiondata)
				.where(table.sid == sid)
				.for_update()
				.run(as_dict=True)
			)
			assert len(rows) == 1 and rows[0].user == user, "Only the just-created fixture session may change"
			data = json.loads(rows[0].sessiondata)
			data.pop("csrf_token", None)
			frappe.qb.update(table).set(table.sessiondata, json.dumps(data)).where(table.sid == sid).run()
			frappe.db.commit()
			frappe.cache.hdel("session", sid)
		finally:
			frappe.destroy()


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--url", default="http://127.0.0.1:18143")
	parser.add_argument("--credentials", type=Path, required=True)
	parser.add_argument("--user", choices=("a", "b"), default="b")
	parser.add_argument("--peer-url", help="Second local server process sharing the fixture site")
	parser.add_argument(
		"--legacy-site", help="Model a tokenless pre-upgrade session on this .localhost fixture"
	)
	parser.add_argument("--sites", type=Path, help="Fixture sites directory; only needed with --legacy-site")
	args = parser.parse_args()
	for url in filter(None, (args.url, args.peer_url)):
		parsed = urlparse(url)
		if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost"):
			parser.error("Only a loopback HTTP fixture site is accepted")
	if bool(args.legacy_site) != bool(args.sites):
		parser.error("--legacy-site and --sites must be provided together")
	if args.legacy_site and not args.legacy_site.endswith(".localhost"):
		parser.error("Only a .localhost legacy fixture site is accepted")
	credentials = json.loads(args.credentials.read_text())[args.user]
	if credentials["user"] != f"allim-storage-{args.user}@example.invalid":
		parser.error("Only the named synthetic fixture account is accepted")
	prepare = None
	if args.legacy_site:

		def prepare(sid):
			clear_fixture_csrf(sid, credentials["user"], args.legacy_site, args.sites)

	check(args.url.rstrip("/"), credentials, prepare, args.peer_url.rstrip("/") if args.peer_url else None)


if __name__ == "__main__":
	main()
