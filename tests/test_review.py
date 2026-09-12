import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from allimquran.asr import server
from allimquran.asr.research import RETENTION_DAYS, VERSION, Corpus
from allimquran.asr.review import ReviewError, ReviewQueue

CLIP = "c" * 64
REVIEWER = "d" * 64
TOKEN = "a" * 64
SECRET = "e" * 64
ANNOTATION = {"spoken_text": "بسم الله", "expected_text": "بسم الله", "riwayah": "Hafs", "verdict": "correct"}


class QueueTests(unittest.TestCase):
	def setUp(self):
		self.directory = tempfile.TemporaryDirectory()
		self.now = 1000
		self.corpus = Corpus(self.directory.name, clock=lambda: self.now)
		self.corpus.grant(TOKEN, VERSION, True)
		with self.corpus.transaction() as db:
			db.execute(
				"INSERT INTO clips VALUES(?,?,?,?,?)",
				(
					CLIP,
					self.corpus.identity(TOKEN),
					self.now,
					json.dumps(
						{
							"verse_key": "1:1",
							"duration_seconds": 2,
							"consent_id": "private",
							"prediction": {"transcript": "not ground truth"},
						}
					),
					b"RIFF-test",
				),
			)
		self.queue = ReviewQueue(self.corpus)

	def tearDown(self):
		self.directory.cleanup()

	def save(self, revision=0, status="reviewed", reviewer=REVIEWER, **changes):
		return self.queue.save(CLIP, reviewer, revision, status, {**ANNOTATION, **changes})

	def test_empty_annotation_and_no_prediction_or_identity_in_queue(self):
		self.assertEqual(self.queue.listing()["counts"]["pending"], 1)
		self.assertEqual(self.queue.detail(CLIP, REVIEWER)["annotation"], {})
		for data in [self.queue.listing(), self.queue.detail(CLIP, REVIEWER)]:
			for forbidden in ["consent_id", "prediction", "not ground truth", "speaker_group"]:
				self.assertNotIn(forbidden, json.dumps(data))

	def test_draft_finalize_and_revision_conflict(self):
		self.save(status="draft", spoken_text="")
		self.assertEqual(self.save(1)["status"], "reviewed")
		with self.assertRaises(ReviewError) as caught:
			self.save(1, spoken_text="overwrite")
		self.assertEqual(caught.exception.status, 409)
		self.assertEqual(self.queue.detail(CLIP, REVIEWER)["annotation"]["spoken_text"], "بسم الله")

	def test_dispute_requires_other_teacher_even_after_draft(self):
		self.save(status="disputed", notes="Please verify the vowel")
		self.save(1, status="draft")
		with self.assertRaises(ReviewError):
			self.save(2)
		self.assertFalse(self.queue.detail(CLIP, REVIEWER)["can_adjudicate"])
		self.assertTrue(self.queue.detail(CLIP, "f" * 64)["can_adjudicate"])
		self.assertEqual(self.save(2, reviewer="f" * 64)["status"], "adjudicated")

	def test_revocation_cascades_annotation_and_history(self):
		self.save()
		self.corpus.revoke(TOKEN)
		for operation in [
			lambda: self.queue.audio(CLIP),
			lambda: self.queue.detail(CLIP, REVIEWER),
			self.save,
		]:
			with self.assertRaises(ReviewError) as caught:
				operation()
			self.assertEqual(caught.exception.status, 404)
		with self.corpus.transaction() as db:
			for table in ("clips", "reviews", "review_history"):
				self.assertEqual(db.execute(f"SELECT count(*) FROM {table}").fetchone()[0], 0)

	def test_expiry_cascades_without_teacher_access(self):
		self.save()
		self.now += RETENTION_DAYS * 86400
		self.corpus.purge()
		self.assertEqual(self.queue.listing()["counts"]["reviewed"], 0)
		with self.corpus.transaction() as db:
			self.assertEqual(db.execute("SELECT count(*) FROM review_history").fetchone()[0], 0)

	def test_required_final_fields_and_valid_times(self):
		error = {"kind": "omission", "word_index": 1, "start_ms": 1500, "end_ms": 1500, "note": ""}
		for changes in [
			{"spoken_text": ""},
			{"expected_text": ""},
			{"riwayah": ""},
			{"verdict": ""},
			{"verdict": "incorrect"},
			{"verdict": "unscorable"},
			{"notes": "a" * 1001},
			{"errors": [error]},
			{"tags": ["email"]},
			{"email": "must not be stored"},
			{"verdict": "incorrect", "errors": [{**error, "end_ms": 2100}]},
			{"verdict": "incorrect", "errors": [{**error, "start_ms": -1}]},
			{"verdict": "incorrect", "errors": [{**error, "word_index": 3}]},
			{"verdict": "incorrect", "errors": [{**error, "word_index": True}]},
		]:
			with self.subTest(changes=changes), self.assertRaises(ReviewError):
				self.save(**changes)
		self.assertEqual(self.save(verdict="incorrect", errors=[error])["status"], "reviewed")

	def test_unscorable_requires_reason_not_invented_transcript(self):
		self.save(verdict="unscorable", spoken_text="", expected_text="", riwayah="", notes="silence")
		self.assertEqual(self.queue.detail(CLIP, REVIEWER)["annotation"]["spoken_text"], "")

	def test_invalid_ids_filters_and_reviewers(self):
		for invalid in ["../corpus.sqlite3", "'; DROP TABLE clips;--", None]:
			with self.assertRaises(ReviewError):
				self.queue.audio(invalid)
		for status, offset in [("all", 0), ("pending", -1), ("pending", True)]:
			with self.assertRaises(ReviewError):
				self.queue.listing(status, offset)
		with self.assertRaises(ReviewError):
			self.save(reviewer="email@example.com")

	def test_internal_api_fail_closed_and_is_not_public(self):
		with (
			patch.object(server, "research_corpus", self.corpus),
			patch.object(server, "REVIEW_SECRET", SECRET),
		):
			client = TestClient(server.app, client=("127.0.0.1", 12345))
			self.assertEqual(client.post("/internal/review", json={"action": "list"}).status_code, 403)
			headers = {"X-Allim-Review-Key": SECRET}
			response = client.post("/internal/review", headers=headers, json={"action": "list"})
			self.assertEqual(response.status_code, 200)
			self.assertEqual(response.headers["cache-control"], "no-store")
			response = client.post("/internal/review", headers=headers, json={"action": "audio", "id": CLIP})
			self.assertEqual(response.content, b"RIFF-test")
			self.assertEqual(
				client.post("/internal/review", headers=headers, content=b"a" * 65537).status_code, 413
			)
			self.assertEqual(client.post("/internal/review", headers=headers, json=[]).status_code, 422)
			remote = TestClient(server.app, client=("203.0.113.1", 12345))
			self.assertEqual(
				remote.post("/internal/review", headers=headers, json={"action": "list"}).status_code, 403
			)
			with patch.object(server, "REVIEW_SECRET", ""):
				self.assertEqual(
					client.post("/internal/review", headers=headers, json={"action": "list"}).status_code, 403
				)


class PortalTests(unittest.TestCase):
	def setUp(self):
		self.frappe = MagicMock()
		self.frappe.whitelist.side_effect = lambda **kwargs: lambda f: f
		self.frappe.PermissionError = PermissionError
		self.frappe.ValidationError = ValueError
		self.frappe.throw.side_effect = lambda message, error: (_ for _ in ()).throw(error(message))
		self.frappe.session.user = "karim@example.com"
		self.frappe.db.get_value.return_value = 1
		self.frappe.db.exists.return_value = True
		self.frappe.conf.get.return_value = SECRET
		spec = importlib.util.spec_from_file_location(
			"tested_review_portal", Path("allimquran/review_portal.py")
		)
		self.portal = importlib.util.module_from_spec(spec)
		with patch.dict(sys.modules, {"frappe": self.frappe}):
			spec.loader.exec_module(self.portal)

	def test_unauthorized_cannot_read_list_detail_audio_or_write(self):
		for user, enabled, role in [
			("Guest", 1, True),
			("learner@example.com", 1, False),
			("karim@example.com", 0, True),
		]:
			self.frappe.session.user = user
			self.frappe.db.get_value.return_value = enabled
			self.frappe.db.exists.return_value = role
			for op in [
				self.portal.queue,
				lambda: self.portal.detail(CLIP),
				lambda: self.portal.audio(CLIP),
				lambda: self.portal.save(CLIP, 0, "draft", {}),
			]:
				with self.subTest(user=user), patch.object(self.portal.requests, "post") as request:
					with self.assertRaises(PermissionError):
						op()
					request.assert_not_called()

	def test_bridge_uses_server_identity_and_fixed_loopback(self):
		with patch.object(self.portal.requests, "post") as request:
			request.return_value.status_code = 200
			request.return_value.json.return_value = {"items": []}
			self.assertEqual(self.portal.queue(), {"items": []})
			args, kwargs = request.call_args
			self.assertEqual(args[0], "http://127.0.0.1:4175/internal/review")
			self.assertEqual(len(kwargs["json"]["reviewer"]), 64)
			self.assertNotIn("karim@example.com", json.dumps(kwargs))
			self.assertFalse(kwargs["allow_redirects"])

	def test_role_removed_during_session_applies_immediately(self):
		self.assertTrue(self.portal.allowed())
		self.frappe.db.exists.return_value = False
		self.assertFalse(self.portal.allowed())

	def test_missing_secret_fails_closed(self):
		self.frappe.conf.get.return_value = ""
		with patch.object(self.portal.requests, "post") as request:
			self.assertIn("error", self.portal.queue())
			request.assert_not_called()

	def test_save_requires_csrf_even_if_generic_site_check_disabled(self):
		self.frappe.session.data.get.return_value = "expected-token"
		self.frappe.get_request_header.return_value = "wrong-token"
		with patch.object(self.portal.requests, "post") as request:
			with self.assertRaises(PermissionError):
				self.portal.save(CLIP, 0, "draft", {})
			request.assert_not_called()
		self.frappe.get_request_header.return_value = "expected-token"
		with patch.object(self.portal.requests, "post") as request:
			request.return_value.status_code = 200
			self.portal.save(CLIP, 0, "draft", {})
			request.assert_called_once()
