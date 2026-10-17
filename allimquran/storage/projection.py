"""Deterministic projections of accepted facts; never assesses microphone audio."""

from copy import deepcopy
from datetime import UTC, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from allimquran.storage.validation import catalogue

ORDER = {"connected_started": 0, "hint_used": 1, "verse_completed": 2, "connected_completed": 3}
INTERVALS = (30, 60, 90, 180, 365)


def empty_unit():
	return {
		"weekCounts": [0, 0, 0],
		"daily": {},
		"maintenanceCount": 0,
		"maintenanceLevel": 0,
		"startedAt": "",
		"lastAcceptedAt": "",
		"completedAt": "",
		"nextReviewAt": "",
		"permanent": False,
	}


def empty_page(page):
	return {
		"pageNumber": int(page),
		"connectedAttempts": 0,
		"connectedReviews": 0,
		"lastConnectedAt": "",
		"sealedAt": "",
		"permanent": False,
	}


def add_days(value, days):
	tz = (
		ZoneInfo(value["time_zone"])
		if value.get("time_zone")
		else timezone(timedelta(minutes=value["utc_offset_minutes"]))
	)
	current = datetime.fromisoformat(value["occurred_at"].replace("Z", "+00:00")).astimezone(tz)
	future = current.replace(hour=12, minute=0, second=0, microsecond=0) + timedelta(days=days)
	return future.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def project(records):
	result = {
		"sessions": 0,
		"wordsReviewed": 0,
		"hints": 0,
		"activity": {},
		"heartMushaf": {"units": {}, "pages": {}},
	}
	units, pages = result["heartMushaf"]["units"], result["heartMushaf"]["pages"]
	events = []
	for row in records:
		if row["deleted"]:
			continue
		kind, key, value = row["kind"], row["id"], row["value"]
		if kind == "learning_event":
			events.append(row)
		elif kind == "activity_baseline":
			result.update(
				sessions=value["sessions"], wordsReviewed=value["words_reviewed"], hints=value["hints"]
			)
		elif kind == "activity_day_baseline":
			result["activity"][key] = value["count"]
		elif kind == "hifz_unit_baseline":
			unit = units.setdefault(key, empty_unit())
			for old, new in (
				("week_counts", "weekCounts"),
				("maintenance_count", "maintenanceCount"),
				("maintenance_level", "maintenanceLevel"),
				("started_at", "startedAt"),
				("last_accepted_at", "lastAcceptedAt"),
				("completed_at", "completedAt"),
				("next_review_at", "nextReviewAt"),
				("permanent", "permanent"),
			):
				unit[new] = deepcopy(value[old]) if value[old] is not None else ""
		elif kind == "hifz_day_baseline":
			verse_key, day = key.split("/")
			units.setdefault(verse_key, empty_unit())["daily"][day] = value["count"]
		elif kind == "hifz_page_baseline":
			page = pages.setdefault(key, empty_page(key))
			for old, new in (
				("connected_attempts", "connectedAttempts"),
				("connected_reviews", "connectedReviews"),
				("last_connected_at", "lastConnectedAt"),
				("sealed_at", "sealedAt"),
				("permanent", "permanent"),
			):
				page[new] = value[old] if value[old] is not None else ""
	started = set()
	for row in sorted(
		events, key=lambda row: (row["value"]["occurred_at"], ORDER[row["value"]["event_type"]], row["id"])
	):
		value = row["value"]
		kind = value["event_type"]
		day = value["local_date"]
		now = value["occurred_at"]
		if kind == "hint_used":
			result["hints"] += 1
		elif kind == "verse_completed":
			result["sessions"] += 1
			result["wordsReviewed"] += value["matched_words"]
			result["activity"][day] = result["activity"].get(day, 0) + 1
			if (
				not value["full_verse"]
				or value["hints_used"]
				or value.get("hifz_method", "foundation300") != "foundation300"
			):
				continue
			unit = units.setdefault(value["verse_key"], empty_unit())
			unit["startedAt"] = unit["startedAt"] or now
			unit["lastAcceptedAt"] = now
			unit["daily"][day] = unit["daily"].get(day, 0) + 1
			if sum(unit["weekCounts"]) < 300:
				index = next(i for i, count in enumerate(unit["weekCounts"]) if count < 100)
				unit["weekCounts"][index] += 1
				if sum(unit["weekCounts"]) == 300:
					unit.update(
						completedAt=now, permanent=True, nextReviewAt=add_days(value, 30), maintenanceCount=0
					)
			elif unit["nextReviewAt"] and now >= unit["nextReviewAt"]:
				unit["maintenanceCount"] += 1
				if unit["maintenanceCount"] == 20:
					unit["maintenanceLevel"] += 1
					unit["maintenanceCount"] = 0
					unit["nextReviewAt"] = add_days(
						value, INTERVALS[min(unit["maintenanceLevel"], len(INTERVALS) - 1)]
					)
		elif kind in ("connected_started", "connected_completed"):
			page = pages.setdefault(str(value["page"]), empty_page(value["page"]))
			keys = [key for key, word_pages in catalogue().items() if value["page"] in word_pages]
			ready = all(sum(units.get(key, empty_unit())["weekCounts"]) >= 300 for key in keys)
			if kind == "connected_started":
				page["connectedAttempts"] += 1
				if ready:
					started.add((value["attempt_id"], value["page"]))
			elif ready and (value["attempt_id"], value["page"]) in started:
				page["lastConnectedAt"] = now
				if page["permanent"]:
					page["connectedReviews"] += 1
				else:
					page.update(sealedAt=now, permanent=True)
	return result
