"""Initialize Frappe's CSRF token before concurrent pages can create their own."""

import secrets
import time

import frappe


def before_request():
	# Runs after HTTPRequest's CSRF validation, including on the login request.
	# on_session_creation runs too early: its new token would reject the login POST.
	session = getattr(frappe.local, "session", None)
	if not session or session.user == "Guest" or session.sid == "Guest" or session.data.csrf_token:
		return
	for attempt in range(8):
		try:
			_initialize(session)
			return
		except (frappe.QueryDeadlockError, frappe.QueryTimeoutError):
			# MariaDB can abort a locking read after another worker changes a
			# session loaded by this transaction. Restart the entire initialization,
			# including its persisted snapshot, before application code runs.
			frappe.db.rollback()
			if attempt == 7:
				raise
			time.sleep((10 + secrets.randbelow(40)) / 1000)


def _initialize(session):
	# Other workers may already hold a tokenless copy of this session. Serialize
	# initialization on its DB row and reread it with a locking (current) read;
	# RedisWrapper.hget would reuse the stale request-local cache here.
	sessions = frappe.qb.DocType("Sessions")
	rows = (
		frappe.qb.from_(sessions)
		.select(sessions.user, sessions.sessiondata)
		.where(sessions.sid == session.sid)
		.for_update()
		.run(as_dict=True)
	)
	if not rows or rows[0].user != session.user:
		# A logout may have deleted the row while this request was waiting.
		frappe.throw("Session expired. Please log in again.", frappe.AuthenticationError)

	# Replace the entire stale snapshot, including last_updated: the deferred
	# Session.update must not write an older, tokenless version back afterwards.
	session.data = frappe.parse_json(rows[0].sessiondata or "{}")
	from frappe.sessions import get_csrf_token

	# Use native random generation/persistence. Its forced update commits the
	# session before any application writes; a follower uses the stored token.
	get_csrf_token()
