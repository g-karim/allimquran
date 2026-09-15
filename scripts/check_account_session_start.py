"""Regression check for concurrent CSRF initialization on a local fixture site.

Logs in and opens only the two named fixture accounts; never resets their data.
No passwords, cookies or CSRF/session tokens are printed. A failure is an open
release blocker, not a reason to disable CSRF or pre-warm the tested session.
"""

import argparse
import concurrent.futures
import json
import threading
from pathlib import Path
from urllib.parse import urlparse

import requests


def check(url, credentials):
	with requests.Session() as session:
		session.trust_env = False
		login = session.post(
			url + "/api/method/login",
			json={"usr": credentials["user"], "pwd": credentials["password"]},
			timeout=20,
		)
		assert login.status_code == 200, ("fixture login", login.status_code)
		cookies = session.cookies.copy()
		barrier = threading.Barrier(6)

		def first_context(_):
			with requests.Session() as client:
				client.trust_env = False
				client.cookies.update(cookies)
				barrier.wait(timeout=10)
				response = client.get(url + "/api/method/allimquran.account_storage.context", timeout=20)
				assert response.status_code == 200, ("context", response.status_code)
				assert "no-store" in response.headers.get("Cache-Control", "")
				assert "Set-Cookie" not in response.headers
				return response.json()["message"]

		with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
			contexts = list(pool.map(first_context, range(6)))
		results = []
		for context in contexts:
			response = session.post(
				url + "/api/method/allimquran.account_storage.open",
				json={},
				headers={"X-Frappe-CSRF-Token": context["csrf_token"]},
				timeout=20,
			)
			results.append(
				{
					"status": response.status_code,
					"exception": response.json().get("exc_type"),
					"no_store": "no-store" in response.headers.get("Cache-Control", ""),
					"sets_cookie": "Set-Cookie" in response.headers,
				}
			)
		result = {
			"parallel_first_contexts": len(contexts),
			"distinct_csrf_tokens": len({context["csrf_token"] for context in contexts}),
			"opens": results,
		}
		print(json.dumps(result, indent=2))
		assert result["distinct_csrf_tokens"] == 1, "Concurrent first contexts produced different CSRF tokens"
		assert all(row["status"] == 200 for row in results), "A first context could not open its account"
		assert all(row["no_store"] and not row["sets_cookie"] for row in results)
		print("PASS concurrent fresh-session contexts return one usable CSRF token")


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--url", default="http://127.0.0.1:18143")
	parser.add_argument("--credentials", type=Path, required=True)
	parser.add_argument("--user", choices=("a", "b"), default="b")
	args = parser.parse_args()
	parsed = urlparse(args.url)
	if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost"):
		parser.error("Only a loopback HTTP fixture site is accepted")
	credentials = json.loads(args.credentials.read_text())[args.user]
	if credentials["user"] != f"allim-storage-{args.user}@example.invalid":
		parser.error("Only the named synthetic fixture account is accepted")
	check(args.url.rstrip("/"), credentials)


if __name__ == "__main__":
	main()
