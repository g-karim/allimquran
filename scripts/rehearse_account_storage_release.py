"""Back up and rehearse page rollback on the named isolated release site only.

Keeps the running storage API and all personal tables. A full database restore
is a separate disaster-recovery test, never the page rollback strategy.
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--sites-path", type=Path, required=True)
	parser.add_argument("--previous-source", type=Path, required=True)
	parser.add_argument("--backup-dir", type=Path, required=True)
	args = parser.parse_args()
	sites = args.sites_path.resolve()
	previous = args.previous_source.resolve()
	assert sites.joinpath("allim-release.localhost/site_config.json").is_file()
	assert previous.joinpath("allimquran/setup.py").is_file()
	assert not previous.joinpath("allimquran/account_storage.py").exists(), "Pre-account release required"
	os.chdir(sites)
	import frappe

	from allimquran import setup
	from allimquran.storage.repository import TABLES

	def connect():
		frappe.init("allim-release.localhost")
		frappe.connect()
		frappe.set_user("Administrator")

	def snapshot():
		result = {}
		for doctype in (*TABLES, "User", "ALLIM Trial Lesson Request", "LMS Course", "LMS Enrollment"):
			rows = frappe.get_all(doctype, fields=["*"], order_by="name", limit_page_length=0)
			result[doctype] = {
				"rows": len(rows),
				"sha256": hashlib.sha256(json.dumps(rows, sort_keys=True, default=str).encode()).hexdigest(),
			}
		return result

	connect()
	assert frappe.__version__.startswith("16.")
	assert set(("frappe", "payments", "lms", "allimquran")) <= set(frappe.get_installed_apps())
	before = snapshot()
	assert before["ALLIM Progress Record"]["rows"] >= 10002
	page = frappe.db.get_value("Web Page", {"route": "learn"}, "name")
	original = frappe.db.get_value("Web Page", page, "javascript")
	try:
		frappe.db.set_value("Web Page", page, "javascript", original + "\n// isolated drift fixture")
		try:
			setup.deploy()
		except frappe.ValidationError as exc:
			assert "source drift" in str(exc)
		else:
			raise AssertionError("Unreviewed page drift accepted")
	finally:
		frappe.db.rollback()
	assert snapshot() == before
	print("PASS real deployment guard refuses page drift before schema/page publication")

	from frappe.utils.backups import new_backup

	folder = args.backup_dir.resolve()
	folder.mkdir(parents=True, exist_ok=True)
	folder.chmod(0o700)
	backup = new_backup(ignore_files=False, compress=True, force=True, backup_path=str(folder))
	manifest = []
	for value in (
		backup.backup_path_db,
		backup.backup_path_files,
		backup.backup_path_private_files,
		backup.backup_path_conf,
	):
		path = Path(value).resolve()
		path.chmod(0o600)
		manifest.append(
			{
				"path": str(path),
				"bytes": path.stat().st_size,
				"sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
			}
		)
	folder.joinpath("manifest.json").write_text(json.dumps(manifest, indent=2))
	folder.joinpath("checkpoint.json").write_text(json.dumps(before, indent=2))
	frappe.destroy()
	code = """
import frappe
frappe.init('allim-release.localhost'); frappe.connect(); frappe.set_user('Administrator')
from allimquran.setup import preflight, sync
print('ROLLBACK_PREFLIGHT', preflight()); print('ROLLBACK_PAGES', sync())
frappe.destroy()
"""
	subprocess.run(
		[sys.executable, "-c", code], cwd=sites, env={**os.environ, "PYTHONPATH": str(previous)}, check=True
	)
	connect()
	assert snapshot() == before
	assert "account-storage.js" not in frappe.db.get_value("Web Page", page, "main_section_html")
	print("PASS old pages restored; progress, receipts, users, inquiries and enrollment hashes unchanged")
	print("REDEPLOY", setup.deploy())
	assert "account-storage.js" in frappe.db.get_value("Web Page", page, "main_section_html")
	assert snapshot() == before
	assert setup.deploy()["updated"] == []
	print("PASS current pages redeployed twice; protected data hashes unchanged")
	print("BACKUP_FILES", [{"bytes": row["bytes"], "sha256": row["sha256"]} for row in manifest])
	frappe.destroy()


if __name__ == "__main__":
	main()
