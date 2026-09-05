"""Synchronize app-owned website sources without exporting or touching user data.

Web Page/Web Form remain Frappe's runtime records. Git is their source of truth.
Manual Desk edits are detected, never silently discarded by the next deployment.
"""

import json

import frappe

from allimquran import __version__
from allimquran.source import CONTENT, fingerprint, records

STATE_KEY = "allimquran_source_state"


def _current(source):
	doctype, name = source["doctype"], source["name"]
	if frappe.get_meta(doctype).issingle:
		return frappe.get_single(doctype)
	if frappe.db.exists(doctype, name):
		return frappe.get_doc(doctype, name)
	return None


def _plan():
	state = json.loads(frappe.db.get_default(STATE_KEY) or "{}")
	baseline = json.loads((CONTENT / "migration_baseline.json").read_text())
	plan, conflicts = [], []
	for source in records():
		key = source["doctype"] + ":" + source["name"]
		current = _current(source)
		desired_hash = fingerprint(source, source)
		current_hash = fingerprint(current, source) if current is not None else None
		previous = state.get(key, {})
		# A fresh site's singletons have framework defaults, not conflicting ALLIM source.
		fresh_single = frappe.flags.in_install and frappe.get_meta(source["doctype"]).issingle
		if (
			current is not None
			and not fresh_single
			and current_hash
			not in {
				desired_hash,
				previous.get("current"),
				baseline.get(key) if not previous else None,
			}
		):
			conflicts.append(key)
		unchanged = current_hash == desired_hash or (
			previous.get("source") == desired_hash and previous.get("current") == current_hash
		)
		plan.append((source, key, current_hash, desired_hash, unchanged))
	if conflicts:
		frappe.throw(
			"ALLIM source drift detected; export and reconcile before deploying: " + ", ".join(conflicts)
		)
	return plan, state


def preflight():
	"""Read-only guard; also runs before Frappe's schema migration."""
	plan, _state = _plan()
	return {"records": len(plan), "changes": [key for _, key, _, _, same in plan if not same]}


def sync(dry_run=False):
	"""Bench-only command and after_migrate hook. Intentionally not whitelisted."""
	if dry_run:
		return preflight()
	with frappe.cache.lock(f"allimquran:source-sync:{frappe.local.site}", timeout=180, blocking_timeout=1):
		plan, state = _plan()
		changed = []
		previous_import = frappe.flags.in_import
		try:
			frappe.flags.in_import = True
			for source, key, expected_hash, desired_hash, unchanged in plan:
				current = _current(source)
				actual_hash = fingerprint(current, source) if current is not None else None
				if actual_hash != expected_hash:
					frappe.throw(f"ALLIM source changed during deployment: {key}")
				if not unchanged:
					if source["doctype"] == "DocType":
						# Keep the existing table, record names and permissions; sync schema ownership.
						name = frappe.scrub(source["name"])
						frappe.reload_doc("allim_quran", "doctype", name, force=True)
					elif current is not None:
						current.update(source)
						current.save(ignore_permissions=True)
					else:
						frappe.get_doc(source).insert(ignore_permissions=True, set_name=source["name"])
					changed.append(key)
				state[key] = {"source": desired_hash, "current": fingerprint(_current(source), source)}
			frappe.db.set_default(STATE_KEY, json.dumps(state, sort_keys=True))
			installed = {"parent": "Installed Applications", "app_name": "allimquran"}
			if frappe.db.get_value("Installed Application", installed, "app_version") != __version__:
				frappe.db.set_value("Installed Application", installed, "app_version", __version__)
			frappe.db.commit()
		except Exception:
			frappe.db.rollback()
			raise
		finally:
			frappe.flags.in_import = previous_import
		frappe.clear_cache()
		from frappe.website.utils import clear_cache

		clear_cache()
		return {"records": len(plan), "updated": changed}


def after_install():
	"""Install public ALLIM defaults, never demo users, enrollments or requests."""
	return sync()
