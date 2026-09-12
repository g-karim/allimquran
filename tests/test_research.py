import io
import json
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from allimquran.asr import server
from allimquran.asr.audio import outcome
from allimquran.asr.research import RETENTION_DAYS, VERSION, Corpus

TOKEN = "a" * 64
SESSION = "b" * 32


class ResearchTests(unittest.TestCase):
	def setUp(self):
		self.directory = tempfile.TemporaryDirectory()
		self.now = 1000
		self.corpus = Corpus(Path(self.directory.name) / "private", clock=lambda: self.now)
		self.audio = Path(self.directory.name) / "source.wav"
		buffer = io.BytesIO()
		with wave.open(buffer, "wb") as audio:
			audio.setnchannels(1)
			audio.setsampwidth(2)
			audio.setframerate(16000)
			audio.writeframes(b"\x01\x02" * 16000)
		self.payload = buffer.getvalue()
		self.audio.write_bytes(self.payload)
		self.patches = [
			patch.object(server, "research_corpus", self.corpus),
			patch.object(server, "RESEARCH_ENABLED", True),
			patch.object(server, "_transcribe", return_value=outcome("بسم الله", "transcribed")),
		]
		for item in self.patches:
			item.start()
		self.client = TestClient(server.app)
		server._request_times.clear()
		self.headers = {
			"Origin": server.ALLOWED_ORIGIN,
			"X-Requested-With": "QuranCompanion",
			"X-Allim-Contribution": TOKEN,
		}

	def tearDown(self):
		self.client.close()
		for item in reversed(self.patches):
			item.stop()
		self.directory.cleanup()

	def grant(self):
		return self.client.post(
			"/api/quran-asr/research", headers=self.headers, json={"version": VERSION, "adult": True}
		)

	def upload(self, token=TOKEN):
		headers = dict(self.headers)
		if token:
			headers["X-Allim-Contribution"] = token
		else:
			headers.pop("X-Allim-Contribution")
		return self.client.post(
			"/api/quran-asr",
			headers=headers,
			data={
				"verse_key": "1:1",
				"research_session": SESSION,
				"research_language": "ru",
				"research_mode": "read",
			},
			files={"audio": ("personal-name.wav", self.payload, "audio/wav")},
		)

	def count(self):
		with self.corpus.transaction() as db:
			return db.execute("SELECT count(*) FROM clips").fetchone()[0]

	def test_explicit_current_adult_consent_required(self):
		for body in [
			{"version": VERSION, "adult": False},
			{"version": "old", "adult": True},
			{"version": VERSION, "adult": "true"},
			{"version": VERSION, "adult": True, "name": "no"},
		]:
			self.assertEqual(
				self.client.post("/api/quran-asr/research", headers=self.headers, json=body).status_code, 422
			)
		self.assertEqual(self.upload().status_code, 200)
		self.assertEqual(self.upload(None).status_code, 200)
		self.assertEqual(self.upload("../../wrong").status_code, 200)
		self.assertEqual(self.count(), 0)

	def test_grant_capture_delete_and_late_upload(self):
		self.assertEqual(self.grant().status_code, 200)
		self.assertEqual(self.upload().status_code, 200)
		self.assertEqual(self.count(), 1)
		response = self.client.delete("/api/quran-asr/research", headers=self.headers)
		self.assertEqual(response.json(), {"withdrawn": True, "deleted_clips": 1})
		self.assertEqual(self.upload().status_code, 200)
		self.assertEqual(self.count(), 0)
		self.assertEqual(self.grant().status_code, 422)

	def test_delete_before_grant_blocks_inflight_grant(self):
		self.client.delete("/api/quran-asr/research", headers=self.headers)
		self.assertEqual(self.grant().status_code, 422)

	def test_idempotent_grant_and_upload_no_retention_extension(self):
		first = self.grant().json()["expires"]
		self.now += 50
		self.assertEqual(self.grant().json()["expires"], first)
		self.upload()
		self.upload()
		self.assertEqual(self.count(), 1)

	def test_expiry_purges_audio_without_new_capture(self):
		self.grant()
		self.upload()
		self.now += RETENTION_DAYS * 86400
		self.corpus.purge()
		self.assertEqual(self.count(), 0)
		self.assertFalse(self.corpus.active(TOKEN))

	def test_other_key_cannot_delete_or_read_audio(self):
		self.grant()
		self.upload()
		response = self.client.delete(
			"/api/quran-asr/research", headers={**self.headers, "X-Allim-Contribution": "c" * 64}
		)
		self.assertEqual(response.json()["deleted_clips"], 0)
		self.assertEqual(self.count(), 1)
		self.assertEqual(self.client.get("/api/quran-asr/research/corpus.sqlite3").status_code, 404)

	def test_disabled_collection_does_not_disable_withdrawal(self):
		self.grant()
		self.upload()
		with patch.object(server, "RESEARCH_ENABLED", False):
			self.assertFalse(self.client.get("/api/quran-asr/research").json()["enabled"])
			self.assertEqual(self.grant().status_code, 503)
			self.assertEqual(
				self.client.delete("/api/quran-asr/research", headers=self.headers).status_code, 200
			)
		self.assertEqual(self.count(), 0)

	def test_capture_rechecks_consent_after_decode(self):
		self.grant()
		import subprocess

		original = subprocess.run

		def withdraw_during_decode(*args, **kwargs):
			self.corpus.revoke(TOKEN)
			return original(*args, **kwargs)

		with patch("allimquran.asr.research.subprocess.run", side_effect=withdraw_during_decode):
			self.upload()
		self.assertEqual(self.count(), 0)

	def test_storage_failure_and_quota_do_not_break_recognition(self):
		self.grant()
		self.corpus.max_bytes = 1
		self.assertEqual(self.upload().status_code, 200)
		self.assertEqual(self.count(), 0)
		with patch.object(self.corpus, "capture", side_effect=OSError("disk full")):
			self.assertEqual(self.upload().json()["transcript"], "بسم الله")

	def test_only_allowlisted_metadata_and_private_permissions(self):
		self.grant()
		self.upload()
		with self.corpus.transaction() as db:
			metadata, audio = db.execute("SELECT metadata, audio FROM clips").fetchone()
			self.assertEqual(json.loads(metadata)["annotation_status"], "pending")
			self.assertFalse(json.loads(metadata)["training_allowed"])
			for forbidden in [TOKEN, "personal-name", "testclient", "user_agent", "account"]:
				self.assertNotIn(forbidden, metadata)
			self.assertTrue(audio.startswith(b"RIFF"))
		self.assertEqual(self.corpus.root.stat().st_mode & 0o777, 0o700)
		self.assertEqual((self.corpus.root / "corpus.sqlite3").stat().st_mode & 0o777, 0o600)

	def test_origin_cannot_be_bypassed_by_referer(self):
		headers = {
			**self.headers,
			"Origin": "https://evil.example",
			"Referer": server.ALLOWED_ORIGIN + "/learn",
		}
		self.assertEqual(
			self.client.post(
				"/api/quran-asr/research", headers=headers, json={"version": VERSION, "adult": True}
			).status_code,
			403,
		)
		self.assertEqual(self.client.delete("/api/quran-asr/research", headers=headers).status_code, 403)

	def test_symlink_database_refused(self):
		self.corpus.root.mkdir()
		(self.corpus.root / "corpus.sqlite3").symlink_to(self.audio)
		with self.assertRaises(OSError):
			self.corpus.grant(TOKEN, VERSION, True)
		self.assertEqual(self.audio.read_bytes(), self.payload)
