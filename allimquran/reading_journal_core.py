"""Validation and optimistic concurrency for a private reading journal."""

import datetime as dt
import hashlib
import json
import re

MAX_BYTES = 8_000_000


def fresh():
	return {"version": 1, "past": 0, "cycle": 1, "deadline": "", "entries": []}


def integer(value, low, high):
	return type(value) is int and low <= value <= high


def date(value, optional=False):
	if optional and value == "":
		return True
	try:
		return isinstance(value, str) and dt.date.fromisoformat(value).isoformat() == value
	except (ValueError, TypeError):
		return False


def validate(value):
	if isinstance(value, str):
		if len(value.encode("utf-8")) > MAX_BYTES:
			raise ValueError("journal_too_large")
		value = json.loads(value)
	if not isinstance(value, dict) or set(value) != {"version", "past", "cycle", "deadline", "entries"}:
		raise ValueError("invalid_journal")
	if (
		type(value["version"]) is not int
		or value["version"] != 1
		or not integer(value["past"], 0, 100000)
		or not integer(value["cycle"], 1, 100000)
		or not date(value["deadline"], optional=True)
	):
		raise ValueError("invalid_settings")
	if not isinstance(value["entries"], list) or len(value["entries"]) > 100000:
		raise ValueError("invalid_entries")
	ids = set()
	for e in value["entries"]:
		if not isinstance(e, dict) or set(e) != {"id", "date", "cycle", "source", "parts"}:
			raise ValueError("invalid_entry")
		if (
			not isinstance(e["id"], str)
			or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", e["id"])
			or e["id"] in ids
		):
			raise ValueError("duplicate_or_invalid_id")
		ids.add(e["id"])
		if (
			not date(e["date"])
			or not integer(e["cycle"], 1, value["cycle"])
			or e["source"] not in ("paper", "digital", "mic")
		):
			raise ValueError("invalid_entry")
		if not isinstance(e["parts"], list) or not 1 <= len(e["parts"]) <= 604:
			raise ValueError("invalid_parts")
		pages = set()
		for p in e["parts"]:
			if not isinstance(p, dict) or set(p) != {"page", "full", "total", "keys", "letters"}:
				raise ValueError("invalid_part")
			if (
				not integer(p["page"], 1, 604)
				or p["page"] in pages
				or type(p["full"]) is not bool
				or not integer(p["total"], 0, 1000)
			):
				raise ValueError("invalid_page")
			pages.add(p["page"])
			if p["letters"] is not None and not integer(p["letters"], 0, 100000):
				raise ValueError("invalid_letters")
			if not isinstance(p["keys"], list) or len(p["keys"]) > 1000:
				raise ValueError("invalid_keys")
			seen = set()
			for key in p["keys"]:
				if (
					not isinstance(key, str)
					or not re.fullmatch(r"[1-9][0-9]{0,2}:[1-9][0-9]{0,2}:[1-9][0-9]{0,2}", key)
					or key in seen
				):
					raise ValueError("invalid_word")
				surah, ayah, word = map(int, key.split(":"))
				if surah > 114 or ayah > 286 or word > 999:
					raise ValueError("invalid_word")
				seen.add(key)
			if not p["full"] and (not p["total"] or not p["keys"] or len(p["keys"]) > p["total"]):
				raise ValueError("invalid_partial_page")
	serialized = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
	if len(serialized.encode("utf-8")) > MAX_BYTES:
		raise ValueError("journal_too_large")
	return json.loads(serialized), serialized, hashlib.sha256(serialized.encode()).hexdigest()


def decide(current_revision, last_operation, last_digest, expected_revision, operation, digest):
	if (
		not integer(expected_revision, 0, 2**31 - 1)
		or not isinstance(operation, str)
		or not re.fullmatch(r"[a-f0-9-]{36}", operation)
	):
		raise ValueError("invalid_operation")
	if operation == last_operation:
		if digest != last_digest:
			raise ValueError("operation_reused")
		return "replayed"
	return "save" if expected_revision == current_revision else "conflict"
