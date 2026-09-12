"""Private teacher annotation workflow. Never exports or trains on contributions."""

import json
import re

from allimquran.asr.research import VERSION

STATES = ("pending", "draft", "reviewed", "disputed", "adjudicated")
KINDS = ("substitution", "omission", "insertion", "order", "letter", "vowel", "tajwid")
TAGS = ("noise", "clipped", "repeat", "self_correction", "other_speech")
IDENTIFIER = re.compile(r"^[a-f0-9]{64}$")


class ReviewError(Exception):
	def __init__(self, status, message):
		self.status = status
		super().__init__(message)


def text_field(data, key, limit):
	value = data.get(key, "")
	if not isinstance(value, str) or len(value) > limit:
		raise ReviewError(422, f"Invalid {key}")
	return value.strip()


def validate_annotation(data, duration, final):
	if not isinstance(data, dict) or set(data) - {
		"spoken_text",
		"expected_text",
		"verdict",
		"riwayah",
		"notes",
		"errors",
		"tags",
	}:
		raise ReviewError(422, "Invalid annotation fields")
	result = {
		key: text_field(data, key, limit)
		for key, limit in (("spoken_text", 4000), ("expected_text", 4000), ("notes", 1000), ("riwayah", 80))
	}
	result["verdict"] = data.get("verdict", "")
	if result["verdict"] not in ("", "correct", "incorrect", "unscorable"):
		raise ReviewError(422, "Invalid verdict")
	errors = data.get("errors", [])
	tags = data.get("tags", [])
	if not isinstance(tags, list) or len(tags) > len(TAGS) or any(tag not in TAGS for tag in tags):
		raise ReviewError(422, "Invalid tags")
	if not isinstance(errors, list) or len(errors) > 80:
		raise ReviewError(422, "Too many errors")
	result["tags"] = list(dict.fromkeys(tags))
	result["errors"] = []
	for error in errors:
		if not isinstance(error, dict) or set(error) != {"kind", "word_index", "start_ms", "end_ms", "note"}:
			raise ReviewError(422, "Invalid error fields")
		if error["kind"] not in KINDS:
			raise ReviewError(422, "Invalid error kind")
		start, end, index = (error[k] for k in ("start_ms", "end_ms", "word_index"))
		if any(type(value) is not int for value in (start, end, index)):
			raise ReviewError(422, "Error positions must be integers")
		if not 0 <= start <= end <= round(duration * 1000):
			raise ReviewError(422, "Error time is outside the clip")
		if not 0 <= index < len(result["expected_text"].split()) + (error["kind"] == "insertion"):
			raise ReviewError(422, "Word position is outside the expected fragment")
		result["errors"].append({**error, "note": text_field(error, "note", 300)})
	if final:
		if not result["verdict"]:
			raise ReviewError(422, "Choose a verdict")
		if result["verdict"] != "unscorable" and not all(
			result[k] for k in ("spoken_text", "expected_text", "riwayah")
		):
			raise ReviewError(422, "Verbatim speech, expected fragment and riwayah are required")
		if result["verdict"] == "incorrect" and not errors:
			raise ReviewError(422, "Mark at least one reading error")
		if result["verdict"] == "correct" and errors:
			raise ReviewError(422, "A correct reading cannot contain marked errors")
		if result["verdict"] == "unscorable" and not result["notes"]:
			raise ReviewError(422, "Explain why this clip cannot be assessed")
	return result


class ReviewQueue:
	def __init__(self, corpus):
		self.corpus = corpus

	def _clip(self, db, clip_id):
		if not isinstance(clip_id, str) or not IDENTIFIER.fullmatch(clip_id):
			raise ReviewError(404, "Recording unavailable")
		row = db.execute(
			"SELECT c.metadata FROM clips c JOIN consents s ON s.id=c.consent_id "
			"WHERE c.id=? AND s.revoked=0 AND s.expires>? AND s.version=?",
			(clip_id, self.corpus.clock(), VERSION),
		).fetchone()
		if not row:
			raise ReviewError(404, "Recording unavailable or consent withdrawn")
		return json.loads(row[0])

	@staticmethod
	def _public(metadata):
		return {
			key: metadata.get(key)
			for key in ("verse_key", "duration_seconds", "interface_language", "mode", "model_id")
		}

	def listing(self, status="pending", offset=0):
		if status not in STATES or type(offset) is not int or not 0 <= offset <= 200000:
			raise ReviewError(422, "Invalid queue filter")
		with self.corpus.transaction() as db:
			base = (
				" FROM clips c JOIN consents s ON s.id=c.consent_id "
				"LEFT JOIN reviews r ON r.clip_id=c.id "
				"WHERE s.revoked=0 AND s.expires>? AND s.version=?"
			)
			params = (self.corpus.clock(), VERSION)
			counts = dict.fromkeys(STATES, 0)
			counts.update(
				dict(
					db.execute(
						"SELECT coalesce(r.status, 'pending'), count(*)" + base + " GROUP BY 1", params
					).fetchall()
				)
			)
			rows = db.execute(
				"SELECT c.id, c.metadata, coalesce(r.revision, 0)"
				+ base
				+ " AND coalesce(r.status, 'pending')=? ORDER BY c.created,c.id LIMIT 25 OFFSET ?",
				(*params, status, offset),
			).fetchall()
			return {
				"counts": counts,
				"offset": offset,
				"page_size": 25,
				"items": [
					{"id": row[0], **self._public(json.loads(row[1])), "revision": row[2], "status": status}
					for row in rows
				],
			}

	def detail(self, clip_id, reviewer):
		with self.corpus.transaction() as db:
			metadata = self._clip(db, clip_id)
			row = db.execute(
				"SELECT revision,status,annotation,updated,disputed_by FROM reviews WHERE clip_id=?",
				(clip_id,),
			).fetchone()
			return {
				"id": clip_id,
				**self._public(metadata),
				"revision": row[0] if row else 0,
				"status": row[1] if row else "pending",
				"annotation": json.loads(row[2]) if row else {},
				"updated": row[3] if row else None,
				"can_adjudicate": bool(row and row[4] and row[4] != reviewer),
				# Prediction is deliberately absent: independent human ground truth comes first.
			}

	def audio(self, clip_id):
		with self.corpus.transaction() as db:
			self._clip(db, clip_id)
			return db.execute("SELECT audio FROM clips WHERE id=?", (clip_id,)).fetchone()[0]

	def save(self, clip_id, reviewer, revision, action, annotation):
		if not isinstance(reviewer, str) or not IDENTIFIER.fullmatch(reviewer):
			raise ReviewError(403, "Invalid reviewer")
		if type(revision) is not int or revision < 0 or action not in ("draft", "reviewed", "disputed"):
			raise ReviewError(422, "Invalid review operation")
		with self.corpus.transaction() as db:
			metadata = self._clip(db, clip_id)
			row = db.execute(
				"SELECT revision,status,disputed_by FROM reviews WHERE clip_id=?", (clip_id,)
			).fetchone()
			if (row[0] if row else 0) != revision:
				raise ReviewError(409, "Another review was saved. Reload before editing.")
			if revision >= 200:
				raise ReviewError(409, "Review revision limit reached")
			data = validate_annotation(annotation, metadata["duration_seconds"], action == "reviewed")
			disputed_by = row[2] if row else None
			status = action
			if action == "disputed":
				if not data["notes"]:
					raise ReviewError(422, "Explain the disputed issue")
				disputed_by = disputed_by or reviewer
			elif disputed_by:
				if action == "reviewed":
					if disputed_by == reviewer:
						raise ReviewError(409, "A disputed clip requires a different reviewer")
					status = "adjudicated"
					disputed_by = None
				else:
					status = "disputed"
			now = self.corpus.clock()
			encoded = json.dumps(data, ensure_ascii=False)
			db.execute(
				"INSERT INTO reviews VALUES(?,?,?,?,?,?,?) ON CONFLICT(clip_id) DO UPDATE SET "
				"revision=excluded.revision,status=excluded.status,annotation=excluded.annotation,"
				"reviewer=excluded.reviewer,updated=excluded.updated,disputed_by=excluded.disputed_by",
				(clip_id, revision + 1, status, encoded, reviewer, now, disputed_by),
			)
			db.execute(
				"INSERT INTO review_history VALUES(?,?,?,?,?,?)",
				(clip_id, revision + 1, status, encoded, reviewer, now),
			)
			return {"id": clip_id, "revision": revision + 1, "status": status}
