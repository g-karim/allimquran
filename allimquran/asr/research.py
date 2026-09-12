"""Opt-in private evaluation corpus. No account, IP, filename or user-agent storage.

SQLite transactions serialize capture, withdrawal and expiry across workers.
Audio lives in this database only; secure_delete clears deleted payload pages.
This first version deliberately has no export or model-training endpoint.
"""

import hashlib
import io
import json
import os
import re
import sqlite3
import subprocess
import time
import wave
from contextlib import contextmanager
from pathlib import Path

from allimquran.asr import audio as audio_module

VERSION = "2026-09-07-v1"
RETENTION_DAYS = 90
TOKEN = re.compile(r"^[a-f0-9]{64}$")
SESSION = re.compile(r"^[a-f0-9]{32}$")
AUDIO_CODE_SHA256 = hashlib.sha256(Path(audio_module.__file__).read_bytes()).hexdigest()


class Corpus:
	def __init__(self, root, *, max_bytes=512 * 1024 * 1024, clock=time.time):
		self.root = Path(root)
		self.max_bytes = max_bytes
		self.clock = clock

	@contextmanager
	def transaction(self):
		self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
		if self.root.is_symlink():
			raise ValueError("Research directory must not be a symlink")
		self.root.chmod(0o700)
		path = self.root / "corpus.sqlite3"
		fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
		os.fchmod(fd, 0o600)
		os.close(fd)
		connection = sqlite3.connect(path, timeout=5)
		try:
			connection.execute("PRAGMA secure_delete=ON")
			connection.execute("PRAGMA foreign_keys=ON")
			connection.execute(
				"CREATE TABLE IF NOT EXISTS consents (id TEXT PRIMARY KEY, version TEXT NOT NULL, "
				"created REAL NOT NULL, expires REAL NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)"
			)
			connection.execute(
				"CREATE TABLE IF NOT EXISTS clips (id TEXT PRIMARY KEY, consent_id TEXT NOT NULL "
				"REFERENCES consents(id) ON DELETE CASCADE, created REAL NOT NULL, "
				"metadata TEXT NOT NULL, audio BLOB NOT NULL)"
			)
			connection.execute("CREATE INDEX IF NOT EXISTS clips_consent ON clips(consent_id)")
			# Keep annotations in the same private store and deletion boundary as audio.
			connection.execute(
				"CREATE TABLE IF NOT EXISTS reviews (clip_id TEXT PRIMARY KEY REFERENCES clips(id) "
				"ON DELETE CASCADE, revision INTEGER NOT NULL, status TEXT NOT NULL, "
				"annotation TEXT NOT NULL, reviewer TEXT NOT NULL, updated REAL NOT NULL, "
				"disputed_by TEXT)"
			)
			connection.execute(
				"CREATE TABLE IF NOT EXISTS review_history (clip_id TEXT NOT NULL REFERENCES clips(id) "
				"ON DELETE CASCADE, revision INTEGER NOT NULL, status TEXT NOT NULL, "
				"annotation TEXT NOT NULL, reviewer TEXT NOT NULL, updated REAL NOT NULL, "
				"PRIMARY KEY (clip_id, revision))"
			)
			connection.execute("BEGIN IMMEDIATE")
			connection.execute("DELETE FROM consents WHERE expires <= ?", (self.clock(),))
			yield connection
			connection.commit()
		finally:
			connection.close()

	@staticmethod
	def identity(token):
		if not isinstance(token, str) or not TOKEN.fullmatch(token):
			raise ValueError("Invalid contribution key")
		return hashlib.sha256(token.encode("ascii")).hexdigest()

	def grant(self, token, version, adult):
		identifier = self.identity(token)
		if version != VERSION or adult is not True:
			raise ValueError("Current consent and adult confirmation required")
		with self.transaction() as db:
			row = db.execute("SELECT expires, revoked FROM consents WHERE id=?", (identifier,)).fetchone()
			if row:
				if row[1]:
					raise ValueError("This contribution key was withdrawn")
				return row[0]
			if db.execute("SELECT count(*) FROM consents").fetchone()[0] >= 2000:
				raise ValueError("Pilot participation limit reached")
			expires = self.clock() + RETENTION_DAYS * 86400
			db.execute(
				"INSERT INTO consents VALUES (?, ?, ?, ?, 0)", (identifier, version, self.clock(), expires)
			)
			return expires

	def revoke(self, token):
		identifier = self.identity(token)
		with self.transaction() as db:
			count = db.execute("SELECT count(*) FROM clips WHERE consent_id=?", (identifier,)).fetchone()[0]
			db.execute("DELETE FROM clips WHERE consent_id=?", (identifier,))
			# Tombstone also blocks a grant request that arrives after a withdrawal.
			db.execute(
				"INSERT INTO consents VALUES (?, ?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET revoked=1",
				(identifier, VERSION, self.clock(), self.clock() + RETENTION_DAYS * 86400),
			)
			return count

	def active(self, token):
		identifier = self.identity(token)
		with self.transaction() as db:
			return (
				db.execute(
					"SELECT 1 FROM consents WHERE id=? AND revoked=0 AND version=?", (identifier, VERSION)
				).fetchone()
				is not None
			)

	def purge(self):
		with self.transaction():
			pass

	def capture(self, token, session, path, verse_key, result, model, elapsed, language, mode, revision=None):
		if not TOKEN.fullmatch(token or "") or not SESSION.fullmatch(session or ""):
			return False
		if not self.active(token):
			return False
		# A decoded, metadata-free mono WAV avoids retaining tags or hidden container tracks.
		decoded = subprocess.run(
			[
				"ffmpeg",
				"-nostdin",
				"-v",
				"error",
				"-protocol_whitelist",
				"file,pipe",
				"-i",
				str(path),
				"-map",
				"0:a:0",
				"-vn",
				"-ac",
				"1",
				"-ar",
				"16000",
				"-t",
				"61",
				"-f",
				"s16le",
				"pipe:1",
			],
			capture_output=True,
			check=True,
			timeout=30,
		).stdout
		if not 6400 <= len(decoded) <= 60 * 32000:
			return False
		buffer = io.BytesIO()
		with wave.open(buffer, "wb") as audio:
			audio.setnchannels(1)
			audio.setsampwidth(2)
			audio.setframerate(16000)
			audio.writeframes(decoded)
		payload = buffer.getvalue()
		identifier = self.identity(token)
		audio_hash = hashlib.sha256(payload).hexdigest()
		clip_id = hashlib.sha256((identifier + session + audio_hash).encode()).hexdigest()
		metadata = {
			"schema_version": 1,
			"consent_version": VERSION,
			"consent_id": identifier,
			"speaker_group": identifier,
			"recording_group": session,
			"verse_key": verse_key,
			"sha256": audio_hash,
			"duration_seconds": len(decoded) / 32000,
			"model_id": model,
			"model_revision": revision,
			"audio_code_sha256": AUDIO_CODE_SHA256,
			"processing_seconds": elapsed,
			"interface_language": language if language in {"ru", "en", "ar"} else "other",
			"mode": mode if mode in {"read", "memory"} else "unknown",
			"prediction": {
				key: result.get(key) for key in ("transcript", "preview_transcript", "status", "reason")
			},
			"annotation_status": "pending",
			"training_allowed": False,
			"redistribution_allowed": False,
		}
		with self.transaction() as db:
			# Recheck after decoding: withdrawal/expiry must win over an in-flight capture.
			if not db.execute(
				"SELECT 1 FROM consents WHERE id=? AND revoked=0 AND version=?", (identifier, VERSION)
			).fetchone():
				return False
			if (
				db.execute("SELECT count(*) FROM clips WHERE consent_id=?", (identifier,)).fetchone()[0]
				>= 100
			):
				return False
			if (
				db.execute(
					"SELECT count(*) FROM clips WHERE consent_id=? AND created>?",
					(identifier, self.clock() - 86400),
				).fetchone()[0]
				>= 20
			):
				return False
			used = db.execute("SELECT coalesce(sum(length(audio)), 0) FROM clips").fetchone()[0]
			if used + len(payload) > self.max_bytes:
				return False
			cursor = db.execute(
				"INSERT OR IGNORE INTO clips VALUES (?, ?, ?, ?, ?)",
				(clip_id, identifier, self.clock(), json.dumps(metadata, ensure_ascii=False), payload),
			)
			return cursor.rowcount == 1
