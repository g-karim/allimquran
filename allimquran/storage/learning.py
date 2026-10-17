"""Typed learning extensions. Photos use the same private, epoch-scoped record API."""

import base64
import binascii
import hashlib
import re

from allimquran.storage.validation import (
	StorageError,
	catalogue,
	day,
	entity_id,
	fields,
	instant,
	integer,
	provenance,
	require,
	string,
	timing,
	uuid,
	verse,
)

METHODS = ("foundation300", "linked33", "turkishWall33", "mauritanianLawh")
BASELINES = {"hifz_method_baseline", "hifz_coach_baseline", "lawh_unit_baseline"}
FACTS = {"hifz_credit", "hifz_signal", "lawh_practice", "recall_attempt", "lawh_image_part"}
KINDS = BASELINES | FACTS | {"lawh_verification", "lawh_photo", "memory_plan", "recall_flag"}
PART_SIZE = 32768  # base64 characters; bounded by the existing value/request limits.
MAX_PHOTO = 8 * 1024 * 1024
MIMES = ("image/jpeg", "image/png", "image/webp")


def page_keys(page):
	integer(page, 1, 604)
	return [key for key, pages in catalogue().items() if page in pages]


def tasks(method, keys):
	"""The reviewed CMS task order; both clients and server use this sequence."""
	if method == "linked33":
		result = []
		for index, key in enumerate(keys):
			result.append(("verse", key, [key]))
			if index or len(keys) == 1:
				result.append(("segment", "__page__" if len(keys) == 1 else key, keys[: index + 1]))
		return result
	if not keys:
		return []
	index = len(keys) - 1
	result = [("verse", keys[index], [keys[index]])]
	if len(keys) == 1:
		return [*result, ("segment", "__page__", keys[:])]
	while index:
		jump = max(0, index - 2)
		result.append(("verse", keys[jump], [keys[jump]]))
		if jump + 1 < index:
			result.append(("verse", keys[jump + 1], [keys[jump + 1]]))
		index = jump
		result.append(("segment", keys[index], keys[index:]))
	return result


def counts(value, allowed, maximum):
	require(isinstance(value, dict) and len(value) <= maximum)
	for key, count in value.items():
		require(key in allowed)
		integer(count, 0, 33)


def signal(value, *, legacy=False):
	fields(value, ("method", "outcome", "source", "hints", "at"))
	require(value["method"] in METHODS)
	require(value["outcome"] in ("clean", "assisted", "incomplete"))
	require(value["source"] in ("verse", "connected"))
	integer(value["hints"], 0, 300)
	instant(value["at"], nullable=legacy)


def validate(kind, key, value, importing):
	if kind in FACTS | {"memory_plan"}:
		if kind != "lawh_image_part":
			entity_id(key)
	if kind in {"lawh_unit_baseline", "lawh_verification", "lawh_photo"}:
		verse(key)
	if kind == "memory_plan":
		fields(value, ("action", "verse_keys", "portion", "created_on", "deadline"))
		require(value["action"] in ("read", "memorize", "review"))
		keys = value["verse_keys"]
		require(isinstance(keys, list) and 1 <= len(keys) <= 604)
		require(all(isinstance(k, str) for k in keys) and len(set(keys)) == len(keys))
		for item in keys:
			verse(item)
		integer(value["portion"], 1, 50)
		day(value["created_on"])
		day(value["deadline"], nullable=True)
		require(value["deadline"] is None or value["deadline"] >= value["created_on"])
	elif kind == "recall_attempt":
		fields(
			value,
			("verse_key", "mode", "local_date", "complete", "total_words", "hints", "flags", "seconds"),
			("recorded_at", "legacy_order"),
		)
		if value.get("recorded_at") is not None:
			instant(value["recorded_at"])
		if value.get("legacy_order") is not None:
			integer(value["legacy_order"])
		words = verse(value["verse_key"])
		require(value["mode"] in ("read", "memory", "test", "manual-read", "manual-memory", "manual-review"))
		day(value["local_date"])
		require(type(value["complete"]) is bool)
		integer(value["total_words"], len(words), len(words))
		integer(value["hints"], 0, len(words))
		require(isinstance(value["flags"], list) and len(value["flags"]) <= len(words))
		for index in value["flags"]:
			integer(index, 0, len(words) - 1)
		require(len(set(value["flags"])) == len(value["flags"]))
		integer(value["seconds"], 0, 86400)
		if value["mode"].startswith("manual-"):
			require(value["complete"] and not value["hints"] and not value["flags"] and not value["seconds"])
	elif kind == "recall_flag":
		require(isinstance(key, str) and "/" in key)
		attempt, index = key.rsplit("/", 1)
		entity_id(attempt)
		require(index.isascii() and index.isdigit() and str(int(index)) == index)
		integer(int(index), 0, 299)
		fields(value, ("dismissed",))
		require(type(value["dismissed"]) is bool)
	elif kind == "hifz_credit":
		fields(
			value,
			(
				"occurred_at",
				"local_date",
				"utc_offset_minutes",
				"time_zone",
				"attempt_id",
				"method",
				"page",
				"task_type",
				"task_key",
				"verse_keys",
				"evidence",
				"without_hints",
			),
		)
		timing(value)
		uuid(value["attempt_id"])
		require(value["method"] in ("linked33", "turkishWall33"))
		allowed = tasks(value["method"], page_keys(value["page"]))
		require((value["task_type"], value["task_key"], value["verse_keys"]) in allowed, "invalid_hifz_task")
		require(value["evidence"] == "client_alignment" and value["without_hints"] is True)
	elif kind == "hifz_signal":
		signal(value, legacy=importing)
	elif kind == "lawh_practice":
		fields(
			value,
			(
				"occurred_at",
				"local_date",
				"utc_offset_minutes",
				"time_zone",
				"verse_key",
				"practice",
				"verified_at",
				"evidence",
			),
		)
		verse(value["verse_key"])
		timing(value)
		instant(value["verified_at"])
		require(value["practice"] in ("read", "recall") and value["evidence"] == "self_reported")
	elif kind == "lawh_verification":
		fields(value, ("verified_at", "image_sha256"))
		instant(value["verified_at"])
		require(re.fullmatch(r"[a-f0-9]{64}", string(value["image_sha256"], 64)))
	elif kind == "hifz_method_baseline":
		require(isinstance(key, str) and re.fullmatch(r"(?:linked33|turkishWall33)/[1-9][0-9]{0,2}", key))
		method, page = key.split("/", 1)
		require(method in ("linked33", "turkishWall33"))
		require(page.isascii() and page.isdigit() and str(int(page)) == page)
		allowed = tasks(method, page_keys(int(page)))
		fields(
			value,
			(
				"verse_counts",
				"link_counts",
				"daily",
				"started_at",
				"last_accepted_at",
				"completed_at",
				"provenance",
			),
		)
		counts(value["verse_counts"], {k for t, k, _ in allowed if t == "verse"}, 300)
		counts(value["link_counts"], {k for t, k, _ in allowed if t == "segment"}, 300)
		require(isinstance(value["daily"], dict))
		for local_date, count in value["daily"].items():
			day(local_date)
			integer(count)
		for field in ("started_at", "last_accepted_at", "completed_at"):
			instant(value[field], nullable=True)
		provenance(value["provenance"])
	elif kind == "hifz_coach_baseline":
		require(key == "current")
		fields(value, ("signals", "provenance"))
		require(isinstance(value["signals"], list) and len(value["signals"]) <= 240)
		for item in value["signals"]:
			signal(item, legacy=True)
		provenance(value["provenance"])
	elif kind == "lawh_unit_baseline":
		fields(value, ("read_count", "recall_count", "verified_at", "updated_at", "provenance"))
		integer(value["read_count"])
		integer(value["recall_count"])
		instant(value["verified_at"], nullable=True)
		instant(value["updated_at"], nullable=True)
		provenance(value["provenance"])
	elif kind == "lawh_image_part":
		require(isinstance(key, str) and "/" in key)
		image, index = key.split("/", 1)
		uuid(image)
		require(index.isascii() and index.isdigit() and str(int(index)) == index)
		integer(int(index), 0, 342)
		fields(value, ("data",))
		data = string(value["data"], PART_SIZE)
		require(bool(data) and len(data) % 4 == 0)
		try:
			base64.b64decode(data, validate=True)
		except (ValueError, binascii.Error) as exc:
			raise StorageError("invalid_image") from exc
	elif kind == "lawh_photo":
		fields(value, ("image_id", "parts", "bytes", "sha256", "mime", "width", "height", "file_name"))
		uuid(value["image_id"])
		integer(value["bytes"], 1, MAX_PHOTO)
		integer(value["parts"], 1, 343)
		require(value["parts"] == (4 * ((value["bytes"] + 2) // 3) + PART_SIZE - 1) // PART_SIZE)
		require(re.fullmatch(r"[a-f0-9]{64}", string(value["sha256"], 64)))
		require(value["mime"] in MIMES)
		integer(value["width"], 1, 20000)
		integer(value["height"], 1, 20000)
		string(value["file_name"], 255)
	return value


def verify_photo(repo, value):
	parts = []
	for index in range(value["parts"]):
		row = repo.record("lawh_image_part", f"{value['image_id']}/{index}")
		require(row and not row["deleted"], "image_incomplete", 409)
		data = row["value"]["data"]
		require(index == value["parts"] - 1 or len(data) == PART_SIZE, "invalid_image")
		parts.append(data)
	try:
		data = base64.b64decode("".join(parts), validate=True)
	except (ValueError, binascii.Error):
		require(False, "invalid_image")
	require(
		len(data) == value["bytes"] and hashlib.sha256(data).hexdigest() == value["sha256"], "invalid_image"
	)
	valid = {
		"image/jpeg": data.startswith(b"\xff\xd8\xff"),
		"image/png": data.startswith(b"\x89PNG\r\n\x1a\n"),
		"image/webp": data.startswith(b"RIFF") and data[8:12] == b"WEBP",
	}
	require(valid[value["mime"]], "invalid_image")
