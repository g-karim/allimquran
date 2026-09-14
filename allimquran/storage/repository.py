"""Private Frappe persistence; all mutations use the same Account State lock."""

import json
from uuid import uuid4

import frappe

from allimquran.storage.validation import canonical, digest, require

STATE = "ALLIM Account State"
RECORD = "ALLIM Progress Record"
OPERATION = "ALLIM Progress Operation"
CHANGE = "ALLIM Progress Change"
RESET = "ALLIM Progress Reset"
EXPORT = "ALLIM Progress Export"
TABLES = (STATE, RECORD, OPERATION, CHANGE, RESET, EXPORT)


def insert(doctype, name, values):
	doc = frappe.get_doc({"doctype": doctype, "name": name, **values})
	doc.owner = frappe.session.user
	doc.modified_by = frappe.session.user
	# db_insert deliberately bypasses user-facing CRUD, Version and activity logs.
	# Callers already validated types and owner; these DocTypes grant no website role.
	doc.db_insert()
	return doc


def ensure_indexes():
	for doctype, columns in (
		(STATE, ["user"]),
		(RECORD, ["account", "epoch", "kind", "record_key"]),
		(RECORD, ["account", "epoch", "event_key"]),
		(RECORD, ["account", "epoch", "import_item_id"]),
		(OPERATION, ["account", "epoch", "op_id"]),
		(CHANGE, ["account", "epoch", "change_seq"]),
		(RESET, ["account", "reset_id"]),
	):
		frappe.db.add_unique(doctype, columns, constraint_name="allim_" + digest([doctype, columns])[:20])


def open_account(user):
	# The User row exists even when Account State does not. Concurrent first logins
	# lock this row before attempting INSERT, and the user uniqueness is enforced too.
	require(frappe.db.get_value("User", user, "name", for_update=True), "session_required", 401)
	name = frappe.db.get_value(STATE, {"user": user}, "name", for_update=True)
	if not name:
		name = str(uuid4())
		insert(STATE, name, {"user": user, "epoch": str(uuid4()), "last_seq": 0, "min_seq": 0})
	return Repository(name, user, lock=True)


class Repository:
	def __init__(self, account, user, *, lock=False):
		self.state = frappe.db.get_value(
			STATE,
			{"name": account, "user": user},
			["name", "epoch", "last_seq", "min_seq"],
			as_dict=True,
			for_update=lock,
		)
		require(self.state, "account_changed", 409)
		self.locked = lock
		self.account, self.epoch = self.state.name, self.state.epoch
		self.seq, self.min_seq = int(self.state.last_seq or 0), int(self.state.min_seq or 0)

	@property
	def scope(self):
		return {"account": self.account, "epoch": self.epoch}

	def key(self, *parts):
		return digest([self.account, self.epoch, *parts])

	def next_seq(self):
		self.seq += 1
		frappe.db.set_value(STATE, self.account, "last_seq", self.seq, update_modified=False)
		return self.seq

	def record(self, kind, key):
		if not isinstance(kind, str) or not isinstance(key, str):
			return None
		row = frappe.db.get_value(
			RECORD, {**self.scope, "kind": kind, "record_key": key}, "*", as_dict=True, for_update=self.locked
		)
		return self.decode(row) if row else None

	@staticmethod
	def decode(row):
		return {
			"schema_version": 1,
			"kind": row.kind,
			"id": row.record_key,
			"version": int(row.record_version),
			"change_seq": int(row.change_seq),
			"deleted": bool(row.deleted),
			"created_at": row.created_at,
			"updated_at": row.updated_at,
			"value": json.loads(row.value_json) if row.value_json else None,
		}

	def records(self, kind=None):
		filters = {**self.scope, **({"kind": kind} if kind else {})}
		return [
			self.decode(row)
			for row in frappe.db.get_values(
				RECORD,
				filters=filters,
				fieldname="*",
				as_dict=True,
				order_by="kind asc, record_key asc",
				for_update=self.locked,
			)
		]

	def event(self, key):
		row = frappe.db.get_value(
			RECORD, {**self.scope, "event_key": key}, "*", as_dict=True, for_update=self.locked
		)
		return self.decode(row) if row else None

	def save_record(self, record, *, semantic_key=None, import_item_id=None):
		name = self.key("record", record["kind"], record["id"])
		values = {
			**self.scope,
			"kind": record["kind"],
			"record_key": record["id"],
			"record_version": record["version"],
			"change_seq": record["change_seq"],
			"deleted": int(record["deleted"]),
			"created_at": record["created_at"],
			"updated_at": record["updated_at"],
			"value_json": canonical(record["value"]) if not record["deleted"] else None,
		}
		if record["version"] > 1:
			# Preserve event/import keys on tombstones. NULL keys for ordinary records
			# allow multiple rows with no semantic key under the unique indexes.
			frappe.db.set_value(RECORD, name, values, update_modified=False)
		else:
			insert(RECORD, name, {**values, "event_key": semantic_key, "import_item_id": import_item_id})
		insert(
			CHANGE,
			self.key("change", record["change_seq"]),
			{
				**self.scope,
				"kind": record["kind"],
				"record_key": record["id"],
				"change_seq": record["change_seq"],
			},
		)

	def receipt(self, op_id):
		row = frappe.db.get_value(
			OPERATION,
			{**self.scope, "op_id": op_id},
			["digest", "result_json"],
			as_dict=True,
			for_update=self.locked,
		)
		return {"digest": row.digest, "result": json.loads(row.result_json)} if row else None

	def save_receipt(self, op_id, hashed, result):
		insert(
			OPERATION,
			self.key("operation", op_id),
			{**self.scope, "op_id": op_id, "digest": hashed, "result_json": canonical(result)},
		)

	def savepoint(self, name):
		frappe.db.savepoint(name)

	def rollback(self, name):
		frappe.db.rollback(save_point=name)

	def scan(self, after, limit):
		table = frappe.qb.DocType(RECORD)
		query = (
			frappe.qb.from_(table)
			.select(table.star)
			.where((table.account == self.account) & (table.epoch == self.epoch))
		)
		if after:
			query = query.where(
				(table.kind > after[0]) | ((table.kind == after[0]) & (table.record_key > after[1]))
			)
		rows = query.orderby(table.kind, table.record_key).limit(limit).run(as_dict=True)
		return [self.decode(row) for row in rows]

	def pull(self, after, through, limit):
		table = frappe.qb.DocType(CHANGE)
		rows = (
			frappe.qb.from_(table)
			.select(table.kind, table.record_key, table.change_seq)
			.where(
				(table.account == self.account)
				& (table.epoch == self.epoch)
				& (table.change_seq > after)
				& (table.change_seq <= through)
			)
			.orderby(table.change_seq)
			.limit(limit)
			.run(as_dict=True)
		)
		next_seq = int(rows[-1].change_seq) if rows else through
		keys = dict.fromkeys((row.kind, row.record_key) for row in rows)
		return [self.record(*key) for key in keys], next_seq
