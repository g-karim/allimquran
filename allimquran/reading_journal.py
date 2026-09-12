"""Private account journal endpoints."""

import hashlib
import secrets

import frappe
from frappe.sessions import get_csrf_token

from allimquran.reading_journal_core import decide, fresh, validate

DOCTYPE = "ALLIM Reading Journal"


def identity(expected_user=None):
	frappe.local.response_headers.update(
		{
			"Cache-Control": "private, no-store",
			"Pragma": "no-cache",
			"Vary": "Cookie",
			"X-Robots-Tag": "noindex, nofollow",
		}
	)
	user = frappe.session.user
	if (
		user == "Guest"
		or not frappe.db.get_value("User", user, "enabled")
		or (expected_user is not None and user != expected_user)
	):
		frappe.throw("account_required", frappe.PermissionError)
	return user


def name_for(user):
	return hashlib.sha256(user.encode()).hexdigest()


def snapshot(user, doc=None):
	if doc is None:
		name = name_for(user)
		doc = frappe.get_doc(DOCTYPE, name) if frappe.db.exists(DOCTYPE, name) else None
	if doc and doc.account != user:
		frappe.throw("account_mismatch", frappe.PermissionError)
	return {
		"user": user,
		"revision": int(doc.revision) if doc else 0,
		"book": validate(doc.journal_json)[0] if doc else fresh(),
	}


@frappe.whitelist(methods=["GET"])
def load():
	user = identity()
	result = snapshot(user)
	result["csrf"] = get_csrf_token()
	return result


@frappe.whitelist(methods=["POST"])
def save(book, revision, operation, expected_user):
	user = identity(expected_user)
	expected = frappe.session.data.get("csrf_token")
	supplied = frappe.get_request_header("X-Frappe-CSRF-Token") or ""
	if not expected or not secrets.compare_digest(supplied, expected):
		frappe.throw("refresh_session", frappe.PermissionError)
	try:
		_, serialized, digest = validate(book)
		if type(revision) is not int:
			raise ValueError("invalid_revision")
	except (ValueError, TypeError, KeyError) as error:
		frappe.throw(str(error), frappe.ValidationError)
	# Lock the existing account row: this also serializes the first journal insert.
	accounts = frappe.db.sql(
		"select name, enabled from `tabUser` where name=%s for update", (user,), as_dict=True
	)
	if not accounts or not accounts[0].enabled:
		frappe.throw("account_required", frappe.PermissionError)
	name = name_for(user)
	rows = frappe.db.sql(
		"select account, revision, journal_json, last_operation, last_digest "
		"from `tabALLIM Reading Journal` where name=%s for update",
		(name,),
		as_dict=True,
	)
	doc = rows[0] if rows else None
	if doc and doc.account != user:
		frappe.throw("account_mismatch", frappe.PermissionError)
	try:
		action = decide(
			int(doc.revision) if doc else 0,
			doc.last_operation if doc else None,
			doc.last_digest if doc else None,
			revision,
			operation,
			digest,
		)
	except ValueError as error:
		frappe.throw(str(error), frappe.ValidationError)
	if action != "save":
		return {"status": action, **snapshot(user, doc)}
	values = {
		"journal_json": serialized,
		"revision": int(doc.revision) + 1 if doc else 1,
		"last_operation": operation,
		"last_digest": digest,
	}
	# The owner is always derived from the authenticated session, never a document ID supplied by a client.
	if doc is None:
		frappe.get_doc({"doctype": DOCTYPE, "name": name, "account": user, **values}).insert(
			ignore_permissions=True
		)
	else:
		frappe.db.set_value(DOCTYPE, name, values)
	return {"status": "saved", "user": user, "revision": values["revision"]}
