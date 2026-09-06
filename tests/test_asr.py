import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from allimquran.asr import server
from allimquran.asr.audio import outcome


class ASRTests(unittest.TestCase):
	def setUp(self):
		self.pipeline = patch.object(server, "_get_pipeline", return_value=object())
		self.pipeline.start()
		self.client = TestClient(server.app)
		server._request_times.clear()
		self.headers = {"Origin": server.ALLOWED_ORIGIN, "X-Requested-With": "QuranCompanion"}

	def tearDown(self):
		self.client.close()
		self.pipeline.stop()

	def post(self, payload=b"test", key="1:1", mime="audio/webm", headers=None):
		return self.client.post(
			"/api/quran-asr",
			data={"verse_key": key},
			files={"audio": ("clip.webm", payload, mime)},
			headers=self.headers if headers is None else headers,
		)

	def test_health(self):
		response = self.client.get("/api/quran-asr/health")
		self.assertEqual(response.status_code, 200)
		self.assertIn("ready", response.json())
		self.assertEqual(response.headers["cache-control"], "no-store")

	def test_origin_and_header_are_required(self):
		self.assertEqual(self.post(headers={}).status_code, 403)
		self.assertEqual(
			self.post(headers={**self.headers, "Origin": "https://example.net"}).status_code, 403
		)

	def test_invalid_verse_and_mime(self):
		self.assertEqual(self.post(key="115:1").status_code, 422)
		self.assertEqual(self.post(mime="text/plain").status_code, 415)

	def test_empty_audio(self):
		self.assertEqual(self.post(payload=b"").status_code, 422)

	def test_oversize_audio(self):
		with patch.object(server, "MAX_AUDIO_BYTES", 2):
			self.assertEqual(self.post().status_code, 413)

	def test_transcript_contract_and_temp_cleanup(self):
		paths = []

		def transcribe(path):
			paths.append(path)
			self.assertTrue(Path(path).is_file())
			return outcome("بسم الله", "transcribed")

		with patch.object(server, "_transcribe", side_effect=transcribe):
			response = self.post()
		self.assertEqual(response.json(), {**outcome("بسم الله", "transcribed"), "verse_key": "1:1"})
		self.assertTrue(all(not Path(path).exists() for path in paths))

	def test_rate_limit(self):
		with (
			patch.object(server, "RATE_LIMIT_PER_MINUTE", 1),
			patch.object(server, "_transcribe", return_value=outcome(status="no_speech", reason="silence")),
		):
			self.assertEqual(self.post().status_code, 200)
			self.assertEqual(self.post().status_code, 429)

	def test_non_transcribed_outcomes_are_distinct(self):
		for status, reason in [("no_speech", "silence"), ("uncertain", "unrecognized_audio")]:
			with patch.object(server, "_transcribe", return_value=outcome(status=status, reason=reason)):
				response = self.post()
			self.assertEqual(response.status_code, 200)
			self.assertEqual(response.json()["status"], status)
			self.assertEqual(response.json()["reason"], reason)

	def test_old_clients_cannot_credit_uncertain_preview_text(self):
		with patch.object(
			server, "_transcribe", return_value=outcome("بسم الله", reason="unsafe_audio_boundary")
		):
			response = self.post()
		self.assertEqual(response.json()["transcript"], "")
		self.assertEqual(response.json()["preview_transcript"], "بسم الله")
		self.assertEqual(response.json()["status"], "uncertain")

	def test_processing_error_is_not_http_200_and_upload_is_deleted(self):
		paths = []

		def broken(path):
			paths.append(Path(path))
			raise HTTPException(503, detail={"code": "asr_failed"})

		with patch.object(server, "_transcribe", side_effect=broken):
			response = self.post()
		self.assertEqual(response.status_code, 503)
		self.assertEqual(response.json()["detail"]["code"], "asr_failed")
		self.assertTrue(all(not path.exists() for path in paths))

	def test_invalid_mushaf_inputs(self):
		for path, status in [
			("/api/mushaf/page/0", 404),
			("/api/mushaf/page/605", 404),
			("/api/mushaf/page/1?mushaf=3", 422),
			("/api/mushaf/locate/115/1", 404),
			("/api/quran/words/0/1", 404),
		]:
			self.assertEqual(self.client.get(path).status_code, status)

	def test_chapters_contract(self):
		with patch.object(server, "_cached_quran_json", return_value={"chapters": [{}] * 114}):
			response = self.client.get("/api/mushaf/chapters")
		self.assertEqual(len(response.json()["chapters"]), 114)
		self.assertIn("public", response.headers["cache-control"])

	def test_cache_reuses_source_response(self):
		with tempfile.TemporaryDirectory() as directory:
			with (
				patch.object(server, "MUSHAF_CACHE_ROOT", Path(directory)),
				patch.object(server, "_fetch_quran_json", return_value={"chapters": []}) as fetch,
			):
				self.assertEqual(
					server._cached_quran_json("chapters.json", "https://example.org"), {"chapters": []}
				)
				server._cached_quran_json("chapters.json", "https://example.org")
				fetch.assert_called_once()

	def test_reconciled_russian_translation_contract_and_cache_policy(self):
		for resource_id, author in [(45, "Эльмир Кулиев"), (79, "Абу Адель")]:
			with (
				self.subTest(resource_id=resource_id),
				patch.object(
					server,
					"_cached_quran_json",
					return_value={"verse": {"translations": [{"text": "<p>Перевод &amp; смысл</p>"}]}},
				) as cached,
			):
				response = self.client.get(f"/api/quran/translation/1/1?resource_id={resource_id}")
				self.assertEqual(response.status_code, 200)
				data = response.json()
				self.assertEqual(data["verse_key"], "1:1")
				self.assertEqual(data["resource_id"], resource_id)
				self.assertEqual(data["author"], author)
				self.assertEqual(data["text"], "Перевод & смысл")
				self.assertEqual(data["source"], "Quran Foundation")
				self.assertIn("public, max-age=3600", response.headers["cache-control"])
				self.assertEqual(cached.call_args.args[2], server.QURAN_TRANSLATION_CACHE_SECONDS)
				self.assertIn(f"translations={resource_id}", cached.call_args.args[1])

	def test_translation_rejects_unsupported_edition_and_invalid_verse(self):
		for path, status in [
			("/api/quran/translation/1/1?resource_id=1", 422),
			("/api/quran/translation/0/1", 404),
			("/api/quran/translation/1/287", 404),
		]:
			self.assertEqual(self.client.get(path).status_code, status)

	def test_missing_translation_is_an_upstream_error(self):
		with patch.object(server, "_cached_quran_json", return_value={"verse": {"translations": []}}):
			self.assertEqual(self.client.get("/api/quran/translation/1/1").status_code, 502)
