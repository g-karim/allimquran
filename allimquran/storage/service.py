"""Transaction-local operations. The repository must hold the owner's row lock."""

from uuid import uuid4

from allimquran.storage.learning import BASELINES as LEARNING_BASELINES
from allimquran.storage.learning import FACTS, verify_photo
from allimquran.storage.validation import (
	BASELINES,
	SERVICE_KINDS,
	StorageError,
	digest,
	event_key,
	fields,
	integer,
	parse_json,
	require,
	string,
	utc_now,
	uuid,
	validate_record,
)

BASELINES = BASELINES | LEARNING_BASELINES
MEMBERSHIPS = {"bookmark", "review_item"}
RESTORABLE = MEMBERSHIPS | {"lawh_photo"}
IMMUTABLE = BASELINES | SERVICE_KINDS | FACTS | {"learning_event"}


class Service:
	def __init__(self, repository):
		self.repo = repository

	def apply(self, operation):
		fields(
			operation,
			("op_id", "action", "kind", "id", "base_version"),
			("value", "conflicts", "resolution", "import_id", "import_item_id", "source_key"),
		)
		uuid(operation["op_id"])
		string(operation["kind"], 40)
		string(operation["id"], 140)
		integer(operation["base_version"])
		require(isinstance(operation["action"], str))
		parse_json(operation)
		op_id, hashed = operation["op_id"], digest([1, self.repo.epoch, operation])
		previous = self.repo.receipt(op_id)
		if previous:
			require(previous["digest"] == hashed, "op_id_reused", 409)
			return {**previous["result"], "replayed": True}
		self.changed = []
		# Expected validation failures leave no partial rows. Unexpected errors escape
		# and roll back the entire Frappe request, including all receipts in the batch.
		savepoint = "allim_" + op_id.replace("-", "")
		self.repo.savepoint(savepoint)
		old_seq = self.repo.seq
		try:
			result = self.execute(operation)
		except StorageError as exc:
			self.repo.rollback(savepoint)
			self.repo.seq = old_seq
			self.changed = []
			result = {"outcome": "rejected", "error": {"code": exc.code, "retryable": False}}
		result = {"op_id": op_id, "replayed": False, "changed": self.changed, **result}
		self.repo.save_receipt(op_id, hashed, result)
		return result

	def write(
		self, kind, key, value, previous=None, *, deleted=False, semantic_key=None, import_item_id=None
	):
		record = {
			"schema_version": 1,
			"kind": kind,
			"id": key,
			"version": previous["version"] + 1 if previous else 1,
			"change_seq": self.repo.next_seq(),
			"deleted": deleted,
			"created_at": previous["created_at"] if previous else utc_now(),
			"updated_at": utc_now(),
			"value": None if deleted else value,
		}
		self.repo.save_record(record, semantic_key=semantic_key, import_item_id=import_item_id)
		self.changed.append({name: record[name] for name in ("kind", "id", "version", "change_seq")})
		return record

	def execute(self, op):
		action, kind, key, value = op["action"], op["kind"], op["id"], op.get("value")
		if action == "begin_import":
			return self.begin_import(op)
		if action == "import_item":
			return self.import_item(op)
		require(kind not in SERVICE_KINDS | BASELINES, "server_owned_record")
		record = self.repo.record(kind, key)
		if action == "resolve":
			return self.resolve(op, record)
		if action in ("create", "put", "restore_membership"):
			validate_record(kind, key, value)
			if action == "create":
				require(op["base_version"] == 0)
				if record:
					require(not record["deleted"], "deleted", 409)
					if kind in MEMBERSHIPS or record["value"] == value:
						return {"outcome": "noop"}
					raise StorageError("id_conflict", 409)
				semantic = (
					event_key(value)
					if kind == "learning_event"
					else digest(
						[
							"hifz_credit",
							value["attempt_id"],
							value["method"],
							value["page"],
							value["task_type"],
							value["task_key"],
						]
					)
					if kind == "hifz_credit"
					else None
				)
				if semantic:
					other = self.repo.event(semantic)
					if other:
						require(not other["deleted"], "deleted", 409)
						require(other["value"] == value, "event_conflict", 409)
						return {"outcome": "noop", "event_id": other["id"]}
				self.references(kind, value, key)
				self.write(kind, key, value, semantic_key=semantic)
				return {"outcome": "applied"}
			require(record is not None, "not_found", 404)
			if action == "restore_membership":
				require(kind in RESTORABLE and record["deleted"], "invalid_restore")
				require(record["version"] == op["base_version"], "version_conflict", 409)
				self.references(kind, value, key)
				self.write(kind, key, value, record)
				return {"outcome": "applied"}
			require(kind not in IMMUTABLE, "immutable_record")
			require(not record["deleted"], "deleted", 409)
			if record["value"] == value:
				return {"outcome": "noop"}
			self.references(kind, value, key)
			if record["version"] != op["base_version"]:
				if kind in MEMBERSHIPS | {"reading_position"}:
					raise StorageError("version_conflict", 409)
				return self.conflict(op, record)
			self.write(kind, key, value, record)
			if kind == "lawh_photo":
				self.prune_photo(record["value"]["image_id"])
			return {"outcome": "applied"}
		if action == "delete":
			require("value" not in op, "invalid_fields")
			require(record is not None, "not_found", 404)
			if record["deleted"]:
				return {"outcome": "noop"}
			require(record["version"] == op["base_version"], "version_conflict", 409)
			require(not self.open_conflicts(kind, key), "unresolved_conflicts", 409)
			self.can_delete(record)
			self.write(kind, key, None, record, deleted=True)
			if kind == "lawh_photo":
				self.prune_photo(record["value"]["image_id"])
			return {"outcome": "applied"}
		raise StorageError("unknown_action")

	def references(self, kind, value, key=None):
		if kind == "lawh_photo":
			verify_photo(self.repo, value)
		if kind == "recall_flag":
			attempt_id, index = key.rsplit("/", 1)
			attempt = self.repo.record("recall_attempt", attempt_id)
			require(
				attempt and not attempt["deleted"] and int(index) in attempt["value"]["flags"],
				"invalid_recall_flag",
			)
		if kind in {"reading_entry", "reading_plan"}:
			cycle = self.repo.record("reading_cycle", value["cycle_id"])
			require(cycle and not cycle["deleted"], "cycle_not_found")
		if kind == "learning_event" and value["event_type"] == "connected_completed":
			# May arrive before its start in another request: do not discard facts.
			# Projection credits it only when its matching start and eligible verses exist.
			return

	def can_delete(self, record):
		if record["kind"] == "lawh_image_part":
			require(not self.image_used(record["id"].split("/")[0]), "image_in_use", 409)
		if record["kind"] == "reading_cycle":
			for row in self.repo.records("reading_entry") + self.repo.records("reading_plan"):
				if not row["deleted"] and row["kind"] in {"reading_entry", "reading_plan"}:
					require(row["value"]["cycle_id"] != record["id"], "cycle_in_use", 409)

	def image_used(self, image_id):
		for row in self.repo.records("lawh_photo") + self.repo.records("conflict"):
			if row["deleted"]:
				continue
			if row["kind"] == "lawh_photo" and row["value"]["image_id"] == image_id:
				return True
			if (
				row["kind"] == "conflict"
				and row["value"]["status"] == "open"
				and row["value"]["target_kind"] == "lawh_photo"
				and row["value"]["proposed_value"]["image_id"] == image_id
			):
				return True
		return False

	def prune_photo(self, image_id):
		if self.image_used(image_id):
			return
		for row in self.repo.records("lawh_image_part", prefix=image_id + "/"):
			if not row["deleted"] and row["id"].startswith(image_id + "/"):
				self.write(row["kind"], row["id"], None, row, deleted=True)

	def open_conflicts(self, kind, key):
		return [
			row
			for row in self.repo.records("conflict")
			if not row["deleted"]
			and row["value"]["status"] == "open"
			and row["value"]["target_kind"] == kind
			and row["value"]["target_id"] == key
		]

	def conflict(self, op, record):
		key = str(uuid4())
		self.write(
			"conflict",
			key,
			{
				"target_kind": record["kind"],
				"target_id": record["id"],
				"base_version": op["base_version"],
				"observed_version": record["version"],
				"proposed_value": op["value"],
				"source_op_id": op["op_id"],
				"status": "open",
			},
		)
		return {"outcome": "conflict", "conflict_id": key}

	def resolve(self, op, record):
		require(record and not record["deleted"], "deleted", 409)
		require(record["kind"] not in IMMUTABLE | MEMBERSHIPS, "invalid_resolution")
		require(record["version"] == op["base_version"], "conflict_again", 409)
		conflicts = self.open_conflicts(record["kind"], record["id"])
		require(conflicts, "conflict_not_found", 409)
		provided = op.get("conflicts")
		require(
			isinstance(provided, list)
			and all(isinstance(item, dict) and set(item) == {"id", "version"} for item in provided)
		)
		require(
			sorted((row["id"], row["version"]) for row in conflicts)
			== sorted((row["id"], row["version"]) for row in provided),
			"conflict_again",
			409,
		)
		deleted = op.get("resolution") == "delete"
		if deleted:
			require("value" not in op)
			self.can_delete(record)
		else:
			validate_record(record["kind"], record["id"], op.get("value"))
			self.references(record["kind"], op["value"], record["id"])
		self.write(record["kind"], record["id"], op.get("value"), record, deleted=deleted)
		for row in conflicts:
			clean = {name: item for name, item in row["value"].items() if name != "proposed_value"}
			self.write("conflict", row["id"], {**clean, "status": "resolved"}, row)
		if record["kind"] == "lawh_photo":
			for image_id in {
				record["value"]["image_id"],
				*(row["value"]["proposed_value"]["image_id"] for row in conflicts),
			}:
				self.prune_photo(image_id)
		return {"outcome": "applied"}

	def begin_import(self, op):
		require(op["kind"] == "import_manifest" and op["base_version"] == 0)
		value = op.get("value")
		fields(value, ("source_id", "source_digest", "mapping_version"))
		uuid(value["source_id"])
		require(value["mapping_version"] == 1 and type(value["mapping_version"]) is int)
		require(
			isinstance(value["source_digest"], str)
			and len(value["source_digest"]) == 64
			and all(c in "0123456789abcdef" for c in value["source_digest"])
		)
		key = "import:" + digest([value["source_digest"], 1])
		require(op["id"] == key, "invalid_import_id")
		previous = self.repo.record("import_manifest", key)
		if previous:
			return {"outcome": "noop", "canonical_source_id": previous["value"]["canonical_source_id"]}
		self.write(
			"import_manifest",
			key,
			{
				**{k: value[k] for k in ("source_digest", "mapping_version")},
				"canonical_source_id": value["source_id"],
			},
		)
		return {"outcome": "applied", "canonical_source_id": value["source_id"]}

	def import_item(self, op):
		kind, key, value = op["kind"], op["id"], op.get("value")
		require(kind not in SERVICE_KINDS | {"learning_event"}, "invalid_import_kind")
		manifest = self.repo.record("import_manifest", op.get("import_id"))
		require(manifest and not manifest["deleted"], "import_not_started")
		source_key = op.get("source_key")
		fields(source_key, ("legacy_key", "occurrence_index"))
		string(source_key["legacy_key"])
		integer(source_key["occurrence_index"])
		item_id = "import:" + digest(
			[
				manifest["value"]["canonical_source_id"],
				kind,
				source_key["legacy_key"],
				source_key["occurrence_index"],
			]
		)
		require(op.get("import_item_id") == item_id, "invalid_import_id")
		previous = self.repo.record("import_receipt", item_id)
		if previous:
			return {"outcome": "noop", "import_result": previous["value"]}
		if kind in {"reading_cycle", "reading_entry", "reflection", "memory_plan", "recall_attempt"}:
			require(key == item_id, "invalid_import_id")
		validate_record(kind, key, value, importing=True)
		if "provenance" in value:
			require(
				value["provenance"]["source_id"] == manifest["value"]["canonical_source_id"]
				and value["provenance"]["source_digest"] == manifest["value"]["source_digest"],
				"invalid_provenance",
			)
		existing = self.repo.record(kind, key)
		if existing:
			if not existing["deleted"] and (existing["value"] == value or kind in MEMBERSHIPS):
				outcome = "noop"
			elif kind in BASELINES or existing["deleted"] or op["base_version"] != existing["version"]:
				outcome = "skipped_conflict"
			else:
				self.references(kind, value, key)
				self.write(kind, key, value, existing)
				outcome = "applied"
		elif kind in BASELINES and self.baseline_occupied(kind, key):
			outcome = "skipped_conflict"
		else:
			require(op["base_version"] == 0, "version_conflict", 409)
			self.references(kind, value, key)
			self.write(kind, key, value, import_item_id=item_id)
			outcome = "applied"
		result = {
			"import_id": op["import_id"],
			"import_item_id": item_id,
			"source_key": source_key,
			"target_kind": kind,
			"target_id": key,
			"outcome": outcome,
		}
		self.write("import_receipt", item_id, result)
		return {"outcome": "applied", "import_result": result}

	def baseline_occupied(self, kind, key):
		if kind in LEARNING_BASELINES:
			related = {
				"hifz_coach_baseline": ("hifz_signal",),
				"lawh_unit_baseline": ("lawh_practice", "lawh_verification"),
				"hifz_method_baseline": ("hifz_credit",),
			}[kind]
			for row in (row for group in related for row in self.repo.records(group)):
				if row["deleted"]:
					continue
				if kind == "hifz_coach_baseline" and row["kind"] == "hifz_signal":
					return True
				if (
					kind == "lawh_unit_baseline"
					and row["kind"] in {"lawh_practice", "lawh_verification"}
					and (row["id"] if row["kind"] == "lawh_verification" else row["value"]["verse_key"])
					== key
				):
					return True
				if (
					kind == "hifz_method_baseline"
					and row["kind"] == "hifz_credit"
					and f"{row['value']['method']}/{row['value']['page']}" == key
				):
					return True
		for row in self.repo.records("learning_event"):
			if row["deleted"]:
				continue
			value = row["value"]
			if kind == "activity_baseline":
				return True
			if kind == "activity_day_baseline" and value["local_date"] == key:
				return True
			if kind == "hifz_unit_baseline" and value.get("verse_key") == key:
				return True
			if kind == "hifz_day_baseline" and key == f"{value.get('verse_key')}/{value['local_date']}":
				return True
			if kind == "hifz_page_baseline" and str(value.get("page")) == key:
				return True
		return False
