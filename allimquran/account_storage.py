"""Session-owned personal progress API. Guest learning never writes here."""

import base64
import functools
import hashlib
import hmac
import secrets
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import frappe
from werkzeug.wrappers import Response

from allimquran.storage.repository import (
	CHANGE,
	EXPORT,
	OPERATION,
	RECORD,
	RESET,
	STATE,
	Repository,
	ensure_indexes,
	insert,
	open_account,
)
from allimquran.storage.service import Service
from allimquran.storage.validation import (
	MAX_REQUEST,
	StorageError,
	canonical,
	capabilities,
	digest,
	fields,
	integer,
	parse_json,
	require,
	utc_now,
	uuid,
)

PREFIX = "/api/method/allimquran.account_storage."
PRIVATE_HEADERS = {
	"Cache-Control": "private, no-store, max-age=0",
	"Pragma": "no-cache",
	"Vary": "Cookie",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "no-referrer",
}
CONTEXT_FIELDS = {"expected_account_id", "epoch", "session_binding"}


def after_request(response):
	if getattr(frappe.local, "request", None) and frappe.request.path.startswith(PREFIX):
		response.headers.update(PRIVATE_HEADERS)
		# Frappe normally reissues sid on every response. A delayed background
		# reply from A must not overwrite B's newer login cookie. Login remains
		# owned by Frappe's login route; logout invalidates the session on the server.
		manager = getattr(frappe.local, "cookie_manager", None)
		if manager:
			manager.cookies.clear()
			manager.to_delete.clear()
		response.headers.remove("Set-Cookie")
	return response


def secret():
	key = frappe.conf.get("encryption_key")
	require(isinstance(key, str) and len(key) >= 32, "storage_not_configured", 503)
	return key.encode()


def binding():
	sid = frappe.session.sid
	require(sid and sid != "Guest", "session_required", 401)
	return hmac.new(secret(), ("allim-session:" + sid).encode(), hashlib.sha256).hexdigest()


def sign(value):
	payload = base64.urlsafe_b64encode(canonical(value).encode()).decode().rstrip("=")
	return payload + "." + hmac.new(secret(), payload.encode(), hashlib.sha256).hexdigest()


def verify(token, purpose):
	try:
		require(isinstance(token, str) and len(token) < 2048, "invalid_token")
		payload, signature = token.split(".")
		require(
			hmac.compare_digest(signature, hmac.new(secret(), payload.encode(), hashlib.sha256).hexdigest()),
			"invalid_token",
		)
		value = parse_json(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)), 2048)
		require(value["purpose"] == purpose and value["expires"] >= time.time(), "token_expired", 409)
		return value
	except (ValueError, KeyError, TypeError) as exc:
		raise StorageError("invalid_token") from exc


def request_data():
	if frappe.request.method == "GET":
		return dict(frappe.request.args)
	return parse_json(frappe.request.get_data(cache=True), MAX_REQUEST)


def authenticated(*, csrf=False):
	user = frappe.session.user
	require(user != "Guest" and frappe.db.get_value("User", user, "enabled"), "session_required", 401)
	binding()
	if csrf:
		expected = frappe.session.data.get("csrf_token")
		provided = frappe.get_request_header("X-Frappe-CSRF-Token") or ""
		require(
			isinstance(expected, str) and bool(expected) and secrets.compare_digest(expected, provided),
			"csrf_invalid",
			403,
		)
	return user


def rate_limit(user, write):
	window = int(time.time()) // 60
	key = "allim-storage-rate:" + digest([user, window, bool(write)])
	cache = frappe.cache
	count = cache.incr(key)
	if count == 1:
		cache.expire(key, 120)
	if count > (60 if write else 120):
		frappe.local.response_headers["Retry-After"] = str(60 - int(time.time()) % 60)
		raise StorageError("rate_limited", 429, True)


def endpoint(method, *, guest=False):
	def decorate(function):
		@functools.wraps(function)
		def wrapped(**_kwargs):
			frappe.local.response_headers.update(PRIVATE_HEADERS)
			frappe.flags.disable_traceback = True
			try:
				if not guest:
					user = authenticated(csrf=method == "POST")
					rate_limit(user, method == "POST")
				params = request_data()
				require(isinstance(params, dict))
				for attempt in range(8):
					try:
						if attempt and not guest:
							authenticated(csrf=method == "POST")
						return function(params)
					except (frappe.QueryDeadlockError, frappe.QueryTimeoutError):
						# MariaDB snapshot isolation can reject a locking read after
						# another request commits. Restart the complete transaction;
						# never retry only the failed INSERT or change an op_id.
						frappe.db.rollback()
						if attempt == 7:
							raise StorageError("storage_busy", 503, True) from None
						time.sleep((10 + secrets.randbelow(40)) / 1000)
			except StorageError as exc:
				# Error responses returned normally would otherwise be committed by Frappe.
				frappe.db.rollback()
				frappe.local.response["http_status_code"] = exc.status
				return {"error": {"code": exc.code, "retryable": exc.retryable}}

		return frappe.whitelist(allow_guest=True, methods=[method])(wrapped)

	return decorate


def check_params(params, required=(), optional=()):
	fields(params, required, set(optional) | (CONTEXT_FIELDS if frappe.request.method == "POST" else set()))


def scope_value(params, field, header):
	body, other = params.get(field), frappe.get_request_header(header)
	require(body is None or other is None or body == other, "account_changed", 409)
	return body if body is not None else other


def repository(params, *, lock=False, epoch=True):
	account = scope_value(params, "expected_account_id", "X-Allim-Account")
	uuid(account)
	current_binding = scope_value(params, "session_binding", "X-Allim-Session")
	require(
		isinstance(current_binding, str) and secrets.compare_digest(current_binding, binding()),
		"session_changed",
		403,
	)
	repo = Repository(account, frappe.session.user, lock=lock)
	if epoch:
		require(scope_value(params, "epoch", "X-Allim-Epoch") == repo.epoch, "epoch_changed", 409)
	return repo


def number(value, default=0):
	if value is None:
		return default
	if isinstance(value, str):
		require(value.isascii() and value.isdigit())
		value = int(value)
	return integer(value)


@endpoint("GET", guest=True)
def context(params):
	fields(params, ())
	if frappe.session.user == "Guest":
		return {"mode": "guest"}
	authenticated()
	from frappe.sessions import get_csrf_token

	return {
		"mode": "account",
		"csrf_token": get_csrf_token(),
		"session_binding": binding(),
		"legacy_owner": frappe.session.user,
	}


@endpoint("POST")
def open(params):
	fields(params, ())
	repo = open_account(frappe.session.user)
	token = sign(
		{
			"purpose": "scan",
			"account": repo.account,
			"epoch": repo.epoch,
			"after": repo.seq,
			"expires": int(time.time()) + 1800,
		}
	)
	return {
		"protocol_version": 1,
		"schema_version": 1,
		"account_id": repo.account,
		"epoch": repo.epoch,
		"session_binding": binding(),
		"last_seq": repo.seq,
		"scan_token": token,
		"capabilities": capabilities(),
		"limits": {
			"operations": 25,
			"request_bytes": MAX_REQUEST,
			"value_bytes": 60 * 1024,
			"page_records": 200,
			"page_bytes": 1024 * 1024,
		},
	}


@endpoint("POST")
def apply(params):
	check_params(params, ("protocol_version", "device_id", "operations"))
	require(
		params["protocol_version"] == 1 and type(params["protocol_version"]) is int,
		"protocol_unsupported",
		409,
	)
	uuid(params["device_id"])
	operations = params["operations"]
	require(isinstance(operations, list) and 1 <= len(operations) <= 25, "invalid_batch")
	# Validate the envelope of every item before touching any record.
	for operation in operations:
		require(isinstance(operation, dict) and "op_id" in operation)
		uuid(operation["op_id"])
	require(len({op["op_id"] for op in operations}) == len(operations), "duplicate_operation")
	repo = repository(params, lock=True)
	service = Service(repo)
	results = [service.apply(operation) for operation in operations]
	return {"account_id": repo.account, "epoch": repo.epoch, "results": results, "last_seq": repo.seq}


@endpoint("GET")
def scan(params):
	check_params(params, ("scan_token",), ("after_key", "limit"))
	repo = repository(params)
	token = verify(params["scan_token"], "scan")
	require(token["account"] == repo.account and token["epoch"] == repo.epoch, "epoch_changed", 409)
	require(token["after"] >= repo.min_seq, "cursor_expired", 409)
	after = parse_json(params["after_key"], 1024) if params.get("after_key") else None
	if after:
		require(
			isinstance(after, list)
			and len(after) == 2
			and all(isinstance(item, str) and len(item) <= 140 for item in after)
		)
	limit = min(number(params.get("limit"), 200), 200)
	require(limit > 0)
	candidates = repo.scan(after, limit + 1)
	rows, size = [], 1024
	for row in candidates[:limit]:
		length = len(canonical(row).encode())
		if size + length > 1024 * 1024:
			break
		rows.append(row)
		size += length
	require(rows or not candidates, "record_too_large", 413)
	more = len(candidates) > len(rows)
	return {
		"account_id": repo.account,
		"epoch": repo.epoch,
		"records": rows,
		"after_key": [rows[-1]["kind"], rows[-1]["id"]] if rows else after,
		"has_more": more,
		"catchup_from": token["after"],
		"through_seq": repo.seq if not more else None,
	}


@endpoint("GET")
def pull(params):
	check_params(params, ("after_seq",), ("through_seq", "limit"))
	repo = repository(params)
	after = number(params["after_seq"])
	through = number(params.get("through_seq"), repo.seq)
	require(after >= repo.min_seq, "cursor_expired", 409)
	require(after <= through <= repo.seq, "invalid_cursor")
	limit = min(number(params.get("limit"), 200), 200)
	require(limit > 0)
	# A bounded range is retried with fewer changes if current record images exceed
	# the byte cap. Its cursor is recomputed too, so nothing is silently skipped.
	while True:
		rows, next_seq = repo.pull(after, through, limit)
		if len(canonical(rows).encode()) < 1024 * 1024 - 1024:
			break
		require(limit > 1, "record_too_large", 413)
		limit = max(1, limit // 2)
	return {
		"account_id": repo.account,
		"epoch": repo.epoch,
		"records": rows,
		"next_seq": next_seq,
		"through_seq": through,
		"has_more": next_seq < through,
	}


def export_root():
	return Path(frappe.get_site_path("private", "allim-progress-exports")).resolve()


@endpoint("POST")
def export_data(params):
	check_params(params)
	repo = repository(params, lock=True)
	rows = repo.records()
	payload = canonical(
		{
			"schema_version": 1,
			"account_id": repo.account,
			"epoch": repo.epoch,
			"exported_at": utc_now(),
			"through_seq": repo.seq,
			"records": rows,
		}
	)
	require(len(payload.encode()) <= 50 * 1024 * 1024, "export_too_large", 413)
	key = str(uuid4())
	file_name = key + ".json"
	folder = export_root()
	folder.mkdir(parents=True, exist_ok=True)
	path = folder / file_name
	path.write_text(payload, encoding="utf-8")
	path.chmod(0o600)
	frappe.db.after_rollback.add(lambda: path.unlink(missing_ok=True))
	expires = (
		(datetime.now(UTC) + timedelta(hours=1)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
	)
	insert(
		EXPORT, key, {**repo.scope, "through_seq": repo.seq, "expires_at": expires, "file_name": file_name}
	)
	return {"export_id": key, "expires_at": expires, "through_seq": repo.seq}


@endpoint("GET")
def download_export(params):
	check_params(params, ("export_id",))
	repo = repository(params, lock=True)
	uuid(params["export_id"])
	row = frappe.db.get_value(
		EXPORT,
		{"name": params["export_id"], **repo.scope},
		["file_name", "expires_at", "through_seq"],
		as_dict=True,
		for_update=True,
	)
	require(row and row.expires_at >= utc_now() and int(row.through_seq) == repo.seq, "export_expired", 404)
	path = export_root() / row.file_name
	require(path.parent == export_root() and path.is_file(), "export_expired", 404)
	return Response(
		path.read_bytes(),
		mimetype="application/json",
		headers={**PRIVATE_HEADERS, "Content-Disposition": 'attachment; filename="allim-progress.json"'},
	)


@endpoint("POST")
def prepare_reset(params):
	check_params(params, ("scope",))
	require(params["scope"] == "all_personal_progress")
	repo = repository(params, lock=True)
	return {
		"confirmation": sign(
			{
				"purpose": "reset",
				"account": repo.account,
				"epoch": repo.epoch,
				"expires": int(time.time()) + 600,
				"nonce": secrets.token_hex(16),
			}
		),
		"scope": params["scope"],
	}


@endpoint("POST")
def reset(params):
	check_params(params, ("scope", "confirmation", "reset_id"))
	require(params["scope"] == "all_personal_progress")
	uuid(params["reset_id"])
	repo = repository(params, lock=True, epoch=False)
	previous = frappe.db.get_value(
		RESET,
		{"account": repo.account, "reset_id": params["reset_id"]},
		["old_epoch", "new_epoch"],
		as_dict=True,
		for_update=True,
	)
	if previous:
		return {
			"account_id": repo.account,
			"old_epoch": previous.old_epoch,
			"epoch": previous.new_epoch,
			"replayed": True,
		}
	require(params.get("epoch") == repo.epoch, "epoch_changed", 409)
	token = verify(params["confirmation"], "reset")
	require(token["account"] == repo.account and token["epoch"] == repo.epoch, "epoch_changed", 409)
	new_epoch = str(uuid4())
	for table in (RECORD, OPERATION, CHANGE):
		frappe.db.delete(table, repo.scope)
	# Metadata removal and epoch fence revoke access immediately. File cleanup is
	# retried by the scheduler; a crash after commit cannot make old exports public.
	frappe.db.delete(EXPORT, repo.scope)
	frappe.db.set_value(
		STATE, repo.account, {"epoch": new_epoch, "last_seq": 0, "min_seq": 0}, update_modified=False
	)
	insert(
		RESET,
		digest([repo.account, params["reset_id"]]),
		{
			"account": repo.account,
			"reset_id": params["reset_id"],
			"old_epoch": repo.epoch,
			"new_epoch": new_epoch,
		},
	)
	return {"account_id": repo.account, "old_epoch": repo.epoch, "epoch": new_epoch, "replayed": False}


@endpoint("POST")
def end_session(params):
	check_params(params)
	repository(params, epoch=False)
	frappe.local.login_manager.logout()
	return {"mode": "guest"}


def install():
	from frappe.utils.password import get_encryption_key

	get_encryption_key()
	ensure_indexes()


def delete_user_progress(doc, method=None):
	"""Run inside Frappe's authorized User deletion, before link checks/commit."""
	if not frappe.db.table_exists(STATE):
		return
	account = frappe.db.get_value(STATE, {"user": doc.name}, "name", for_update=True)
	if not account:
		return
	for table in (RECORD, OPERATION, CHANGE, RESET, EXPORT):
		frappe.db.delete(table, {"account": account})
	frappe.db.delete(STATE, account)


def cleanup():
	"""Scheduler only. Never prune tombstones, event IDs, or operation receipts."""
	if not frappe.db.table_exists(STATE):
		return
	cutoff = datetime.now(UTC) - timedelta(days=90)
	for state in frappe.get_all(STATE, fields=["name", "user"]):
		repo = Repository(state.name, state.user, lock=True)
		rows = frappe.get_all(
			CHANGE,
			filters={**repo.scope, "creation": ["<", cutoff.replace(tzinfo=None)]},
			fields=["change_seq"],
			order_by="change_seq desc",
			limit_page_length=1,
		)
		if rows:
			floor = int(rows[0].change_seq)
			frappe.db.delete(CHANGE, {**repo.scope, "change_seq": ["<=", floor]})
			frappe.db.set_value(STATE, repo.account, "min_seq", floor, update_modified=False)
	frappe.db.delete(EXPORT, {"expires_at": ["<", utc_now()]})
	live = {row.file_name for row in frappe.get_all(EXPORT, fields=["file_name"])}
	folder = export_root()
	if folder.exists():
		for path in folder.glob("*.json"):
			# A newly written file can precede its transaction's metadata commit.
			if path.name not in live and path.stat().st_mtime < time.time() - 7200:
				path.unlink(missing_ok=True)
