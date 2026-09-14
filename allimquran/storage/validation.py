"""Typed personal records. No Frappe, network calls, or learner audio."""

import hashlib
import json
import re
from datetime import UTC, date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DATA = Path(__file__).resolve().parents[1] / "public" / "data"
MAX_VALUE = 64 * 1024
MAX_REQUEST = 256 * 1024
MAX_INTEGER = 9007199254740991
DATASET = "hafs-madinah-604-v1"
SERVICE_KINDS = {"conflict", "import_manifest", "import_receipt"}
BASELINES = {
	"activity_baseline",
	"activity_day_baseline",
	"hifz_unit_baseline",
	"hifz_day_baseline",
	"hifz_page_baseline",
}
BOOL_PREFS = {
	"show_meaning",
	"audio_repeat",
	"show_interlinear",
	"auto_advance",
	"sound_cues",
	"strict_correction",
}


class StorageError(Exception):
	def __init__(self, code, status=422, retryable=False):
		super().__init__(code)
		self.code, self.status, self.retryable = code, status, retryable


def require(condition, code="validation_error", status=422):
	if not condition:
		raise StorageError(code, status)


def canonical(value):
	try:
		return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
	except (TypeError, ValueError, UnicodeError, RecursionError) as exc:
		raise StorageError("invalid_json") from exc


def digest(value):
	return hashlib.sha256(canonical(value).encode()).hexdigest()


def parse_json(value, limit=MAX_REQUEST):
	def unique(pairs):
		result = {}
		for key, item in pairs:
			require(key not in result, "duplicate_json_key")
			result[key] = item
		return result

	if isinstance(value, (str, bytes)):
		require(len(value.encode() if isinstance(value, str) else value) <= limit, "payload_too_large", 413)
		try:
			value = json.loads(
				value, object_pairs_hook=unique, parse_constant=lambda _: require(False, "invalid_json")
			)
		except (ValueError, UnicodeError, RecursionError) as exc:
			raise StorageError("invalid_json") from exc
	text = canonical(value)
	require(len(text.encode()) <= limit, "payload_too_large", 413)

	def walk(item, depth=0):
		require(depth <= 16, "json_too_deep")
		if isinstance(item, dict):
			for key, child in item.items():
				require(isinstance(key, str) and key not in {"__proto__", "constructor", "prototype"})
				walk(child, depth + 1)
		elif isinstance(item, list):
			for child in item:
				walk(child, depth + 1)
		elif isinstance(item, (float, int)) and not isinstance(item, bool):
			require(type(item) is int and abs(item) <= MAX_INTEGER)
		elif isinstance(item, str):
			require(not any(0xD800 <= ord(char) <= 0xDFFF for char in item))

	walk(value)
	return value


def fields(value, required, optional=()):
	require(isinstance(value, dict))
	require(set(required) <= set(value) <= set(required) | set(optional), "invalid_fields")


def integer(value, low=0, high=MAX_INTEGER):
	require(type(value) is int and low <= value <= high)
	return value


def string(value, maximum=2000, nullable=False):
	if nullable and value is None:
		return value
	require(isinstance(value, str) and len(value) <= maximum)
	return value


def uuid(value):
	try:
		parsed = UUID(value)
		require(parsed.version == 4 and str(parsed) == value, "invalid_id")
	except (ValueError, TypeError, AttributeError) as exc:
		raise StorageError("invalid_id") from exc
	return value


def entity_id(value):
	if isinstance(value, str) and re.fullmatch(r"import:[a-f0-9]{64}", value):
		return value
	return uuid(value)


def day(value, nullable=False):
	if nullable and value is None:
		return None
	try:
		require(isinstance(value, str) and date.fromisoformat(value).isoformat() == value)
	except (ValueError, TypeError) as exc:
		raise StorageError("invalid_date") from exc
	return value


def instant(value, nullable=False):
	if nullable and value is None:
		return None
	try:
		require(isinstance(value, str) and re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z", value))
		return datetime.fromisoformat(value.replace("Z", "+00:00"))
	except (TypeError, ValueError) as exc:
		raise StorageError("invalid_time") from exc


def utc_now():
	return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@lru_cache(maxsize=1)
def catalogue():
	return json.loads((DATA / "account-storage-catalogue.json").read_text())["verses"]


@lru_cache(maxsize=1)
def capabilities():
	return json.loads((DATA / "account-storage-capabilities.json").read_text())


def verse(key):
	require(isinstance(key, str) and key in catalogue(), "invalid_verse")
	return catalogue()[key]


@lru_cache(maxsize=604)
def page_words(page):
	integer(page, 1, 604)
	return {
		f"{key}:{index}"
		for key, pages in catalogue().items()
		for index, number in enumerate(pages, 1)
		if number == page
	}


def timing(value):
	when = instant(value["occurred_at"])
	day(value["local_date"])
	offset = integer(value["utc_offset_minutes"], -840, 840)
	zone = value["time_zone"]
	require(zone is None or isinstance(zone, str))
	try:
		tz = ZoneInfo(zone) if zone else timezone(timedelta(minutes=offset))
	except (ZoneInfoNotFoundError, ValueError) as exc:
		raise StorageError("invalid_time_zone") from exc
	local = when.astimezone(tz)
	require(
		local.date().isoformat() == value["local_date"] and local.utcoffset() == timedelta(minutes=offset),
		"clock_invalid",
	)
	require(when <= datetime.now(UTC) + timedelta(hours=24), "clock_invalid")


def provenance(value):
	fields(value, ("source_id", "source_digest", "mapping_version", "legacy_key"))
	uuid(value["source_id"])
	require(re.fullmatch(r"[a-f0-9]{64}", string(value["source_digest"])))
	require(value["mapping_version"] == 1 and type(value["mapping_version"]) is int)
	string(value["legacy_key"])


def validate_record(kind, key, value, *, importing=False):
	parse_json(value, MAX_VALUE - 4 * 1024)
	require(kind not in SERVICE_KINDS, "server_owned_record")
	if kind in BASELINES:
		require(importing, "baseline_requires_import")
	if kind in {"reading_cycle", "reading_entry", "reflection", "learning_event"}:
		entity_id(key)
	if kind in {"bookmark", "review_item"}:
		verse(key)
		fields(value, ("position",))
		integer(value["position"], -MAX_INTEGER)
	elif kind == "preference":
		fields(value, ("selected",))
		selected = value["selected"]
		if key in BOOL_PREFS:
			require(type(selected) is bool)
		elif key == "arabic_size":
			integer(selected, 34, 66)
		elif key == "recitation_flow":
			fields(selected, ("mode", "explicit"))
			require(selected["mode"] in capabilities()[key] and type(selected["explicit"]) is bool)
		else:
			require(
				key in {"language", "selected_reciter", "mushaf_font", "mushaf_paper", "mushaf_ink"},
				"unknown_preference",
			)
			require(selected in capabilities()[key])
	elif kind == "daily_goal":
		require(key == "current")
		fields(value, ("sessions",))
		integer(value["sessions"])
		require(value["sessions"] in (1, 2, 3, 5))
	elif kind == "reading_position":
		require(key == "last")
		fields(value, ("verse_key",))
		verse(value["verse_key"])
	elif kind == "academy_plan":
		require(key == "current")
		fields(value, ("minutes", "focus", "target"))
		integer(value["minutes"], 10, 45)
		string(value["target"])
		require(value["focus"] in ("recitation", "memorization", "arabic", "tafsir"))
	elif kind == "academy_diagnostic":
		require(key == "current")
		fields(value, ("level", "goal", "minutes", "answered_at", "route"))
		require(
			value["level"] in ("letters", "assisted", "independent")
			and value["goal"] in ("reading", "tajwid", "hifz")
		)
		integer(value["minutes"], 10, 30)
		instant(value["answered_at"], nullable=importing)
		route = "foundation" if value["level"] == "letters" else value["goal"]
		require(value["route"] == route, "invalid_route")
	elif kind == "reflection":
		validate_reflection(value, importing)
	elif kind == "reading_cycle":
		fields(value, ("dataset_id",), ("label",))
		require(value["dataset_id"] == DATASET)
		if "label" in value:
			string(value["label"], 200)
	elif kind == "reading_plan":
		require(key == "current")
		fields(value, ("cycle_id", "deadline"))
		entity_id(value["cycle_id"])
		day(value["deadline"], nullable=True)
	elif kind == "reading_past":
		require(key == "baseline")
		fields(value, ("completed_cycles",), ("provenance",))
		integer(value["completed_cycles"], 0, 100000)
		if "provenance" in value:
			provenance(value["provenance"])
	elif kind == "reading_entry":
		validate_reading(value, importing)
	elif kind == "learning_event":
		validate_event(value)
	elif kind in BASELINES:
		validate_baseline(kind, key, value)
	else:
		raise StorageError("unknown_kind")
	return value


def validate_reflection(value, importing):
	fields(
		value,
		("verse_key", "reflection", "action", "completed"),
		(
			"reference",
			"fawaid_id",
			"fawaid_scholar",
			"fawaid_benefit",
			"fawaid_source_url",
			"trigger",
			"review_at",
			"completed_at",
			"authored_at",
			"edited_at",
		),
	)
	verse(value["verse_key"])
	for name in ("reflection", "action", "fawaid_benefit"):
		if name in value:
			string(value[name], 10000, nullable=name.startswith("fawaid"))
	require(bool(value["reflection"].strip() or value["action"].strip()))
	require(type(value["completed"]) is bool)
	for name in ("reference", "fawaid_scholar", "fawaid_id", "fawaid_source_url"):
		if name in value:
			string(value[name], 1000 if name in ("reference", "fawaid_scholar") else 2000, nullable=True)
	url = value.get("fawaid_source_url")
	require(not url or url.startswith(("https://", "http://")))
	if value.get("trigger") is not None:
		require(value["trigger"] in capabilities()["life_trigger"])
	for name in ("review_at", "completed_at", "authored_at", "edited_at"):
		if name in value:
			instant(value[name], nullable=True)
	require(importing or not value["completed"] or bool(value.get("completed_at")))


def validate_reading(value, importing):
	fields(
		value,
		("cycle_id", "local_date", "source", "evidence", "parts"),
		("occurred_at", "utc_offset_minutes", "time_zone", "import_item_id"),
	)
	entity_id(value["cycle_id"])
	day(value["local_date"])
	require(value["source"] in ("paper", "digital", "mic"))
	require(
		value["evidence"]
		in (
			("self_reported", "client_alignment", "legacy_import")
			if importing
			else ("self_reported", "client_alignment")
		)
	)
	require(importing or value["source"] != "mic" or value["evidence"] == "client_alignment")
	if value.get("occurred_at") is not None:
		require({"utc_offset_minutes", "time_zone"} <= set(value))
		timing(value)
	parts = value["parts"]
	require(isinstance(parts, list) and 1 <= len(parts) <= 604)
	seen = set()
	for part in parts:
		fields(part, ("page", "full", "word_keys"))
		integer(part["page"], 1, 604)
		require(part["page"] not in seen)
		seen.add(part["page"])
		require(type(part["full"]) is bool and isinstance(part["word_keys"], list))
		keys = part["word_keys"]
		require(all(isinstance(item, str) for item in keys))
		require(len(keys) == len(set(keys)))
		require(
			not keys if part["full"] else bool(keys) and set(keys) <= page_words(part["page"]),
			"invalid_word_coverage",
		)


def validate_event(value):
	common = ("occurred_at", "local_date", "utc_offset_minutes", "time_zone", "event_type", "attempt_id")
	require(isinstance(value, dict) and set(common) <= set(value))
	timing(value)
	uuid(value["attempt_id"])
	kind = value["event_type"]
	if kind == "verse_completed":
		fields(
			value,
			(
				*common,
				"verse_key",
				"mode",
				"matched_words",
				"hints_used",
				"full_verse",
				"alignment_complete",
				"evidence",
				"ruleset",
			),
		)
		words = verse(value["verse_key"])
		integer(value["matched_words"], 1, len(words))
		integer(value["hints_used"], 0, len(words))
		require(value["mode"] in ("read", "memory"))
		if value["evidence"] == "assisted_completion":
			require(value["mode"] == "memory" and not value["full_verse"] and not value["alignment_complete"])
		else:
			require(value["evidence"] == "client_alignment" and value["alignment_complete"])
		require(type(value["full_verse"]) is bool and type(value["alignment_complete"]) is bool)
		require(value["mode"] == "memory" or value["full_verse"])
		require(not value["full_verse"] or value["matched_words"] == len(words))
		require(value["ruleset"] == "current-300-v1")
	elif kind == "hint_used":
		fields(value, (*common, "verse_key", "hint_index"))
		words = verse(value["verse_key"])
		integer(value["hint_index"], 1, len(words))
	elif kind in ("connected_started", "connected_completed"):
		extra = (
			("ordered_verse_keys", "without_hints", "alignment_complete")
			if kind == "connected_completed"
			else ()
		)
		fields(value, (*common, "page", "ruleset", *extra))
		integer(value["page"], 1, 604)
		require(value["ruleset"] == "current-300-v1")
		if extra:
			expected = [key for key, pages in catalogue().items() if value["page"] in pages]
			require(
				value["ordered_verse_keys"] == expected
				and value["without_hints"] is True
				and value["alignment_complete"] is True
			)
	else:
		raise StorageError("invalid_event_type")


def event_key(value):
	return digest([value["attempt_id"], value["event_type"], value.get("hint_index")])


def validate_baseline(kind, key, value):
	require("provenance" in value)
	provenance(value["provenance"])
	if kind == "activity_baseline":
		require(key == "totals")
		names = ("sessions", "words_reviewed", "hints")
	elif kind in ("activity_day_baseline", "hifz_day_baseline"):
		if kind == "hifz_day_baseline":
			verse_key, local_date = key.split("/", 1)
			verse(verse_key)
			day(local_date)
		else:
			day(key)
		names = ("count",)
	elif kind == "hifz_unit_baseline":
		verse(key)
		fields(
			value,
			(
				"week_counts",
				"maintenance_count",
				"maintenance_level",
				"started_at",
				"last_accepted_at",
				"completed_at",
				"next_review_at",
				"permanent",
				"provenance",
			),
		)
		require(isinstance(value["week_counts"], list) and len(value["week_counts"]) == 3)
		for count in value["week_counts"]:
			integer(count, 0, 100)
		integer(value["maintenance_count"], 0, 20)
		integer(value["maintenance_level"])
		for name in ("started_at", "last_accepted_at", "completed_at", "next_review_at"):
			instant(value[name], nullable=True)
		require(type(value["permanent"]) is bool)
		return
	else:
		require(str(integer(int(key), 1, 604)) == key)
		fields(
			value,
			(
				"connected_attempts",
				"connected_reviews",
				"last_connected_at",
				"sealed_at",
				"permanent",
				"provenance",
			),
		)
		for name in ("connected_attempts", "connected_reviews"):
			integer(value[name])
		for name in ("last_connected_at", "sealed_at"):
			instant(value[name], nullable=True)
		require(type(value["permanent"]) is bool)
		return
	fields(value, (*names, "provenance"))
	for name in names:
		integer(value[name])
