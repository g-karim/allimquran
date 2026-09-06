import copy
import json
import shutil
import tempfile
import unittest
import wave
from pathlib import Path

from allimquran.evaluation.compare import compare
from allimquran.evaluation.dataset import digest, manifest_digest, selected_samples, validate, write_private
from allimquran.evaluation.metrics import edit_counts, evaluate, normalize, percentile, validate_predictions


def example():
	return {
		"schema_version": 1,
		"dataset_id": "test-corpus",
		"samples": [
			{
				"id": "clip-001",
				"speaker_id": "speaker-001",
				"recording_group": "session-001",
				"kind": "learner",
				"split": "dev",
				"audio": "audio/clip.wav",
				"sha256": "a" * 64,
				"duration_seconds": 1.0,
				"tags": ["short"],
				"metadata": {
					"native_language": "ru",
					"device": "phone",
					"noise": "quiet",
					"pace": "slow",
					"riwayah": "hafs",
				},
				"rights": {
					"evaluation_allowed": True,
					"redistribution_allowed": False,
					"basis": "Private research consent",
					"consent_status": "granted",
					"consent_id": "consent-001",
				},
				"annotation": {
					"status": "reviewed",
					"reviewer_ids": ["teacher-001"],
					"disputed": False,
					"expected_words": ["بسم", "الله"],
					"spoken_text": "بسم الله",
					"verdict": "correct",
					"errors": [],
				},
			}
		],
	}


def run_for(manifest, response=None):
	return {
		"schema_version": 1,
		"manifest_sha256": manifest_digest(manifest),
		"split": "dev",
		"engine": {"model": "test-only", "revision": "fixture"},
		"predictions": [
			{
				"id": r["id"],
				"audio_sha256": r["sha256"],
				"elapsed_seconds": 0.5,
				"response": copy.deepcopy(response or {"status": "transcribed", "transcript": "بسم الله"}),
			}
			for r in manifest["samples"]
			if r["split"] == "dev"
		],
	}


class DatasetTests(unittest.TestCase):
	def test_valid_metadata_and_deterministic_manifest_hash(self):
		manifest = example()
		self.assertEqual(len(validate(manifest, Path("."), check_audio=False)), 1)
		self.assertEqual(manifest_digest(manifest), manifest_digest(json.loads(json.dumps(manifest))))

	def test_permission_and_annotation_guards(self):
		for target, key, value in [
			("rights", "evaluation_allowed", False),
			("rights", "consent_status", "withdrawn"),
			("rights", "redistribution_allowed", True),
			("annotation", "status", "draft"),
			("annotation", "status", "reference"),
			("annotation", "spoken_text", None),
			("annotation", "spoken_text", ""),
			("annotation", "reviewer_ids", []),
			("annotation", "disputed", True),
		]:
			with self.subTest(target=target, key=key):
				manifest = example()
				manifest["samples"][0][target][key] = value
				with self.assertRaises(ValueError):
					validate(manifest, Path("."), check_audio=False)

	def test_adjudication_requires_distinct_reviewers(self):
		manifest = example()
		annotation = manifest["samples"][0]["annotation"]
		annotation.update(status="adjudicated", disputed=True)
		with self.assertRaises(ValueError):
			validate(manifest, Path("."), check_audio=False)
		annotation["reviewer_ids"] *= 2
		with self.assertRaises(ValueError):
			validate(manifest, Path("."), check_audio=False)
		annotation["reviewer_ids"] = ["teacher-001", "teacher-002"]
		validate(manifest, Path("."), check_audio=False)

	def test_speaker_session_and_exact_audio_cannot_leak_into_test(self):
		for retained in ["speaker_id", "recording_group", "sha256"]:
			with self.subTest(retained=retained):
				manifest = example()
				first = manifest["samples"][0]
				second = copy.deepcopy(first)
				second.update(
					id="clip-002",
					speaker_id="speaker-002",
					recording_group="session-002",
					sha256="b" * 64,
					split="test",
				)
				second[retained] = first[retained]
				manifest["samples"].append(second)
				with self.assertRaises(ValueError):
					validate(manifest, Path("."), check_audio=False)

	def test_duplicate_ids_are_rejected(self):
		manifest = example()
		manifest["samples"] *= 2
		with self.assertRaises(ValueError):
			validate(manifest, Path("."), check_audio=False)

	def test_test_split_requires_explicit_opt_in(self):
		manifest = example()
		manifest["samples"][0]["split"] = "test"
		with self.assertRaises(ValueError):
			selected_samples(manifest, "test")
		self.assertEqual(len(selected_samples(manifest, "test", True)), 1)

	def test_paths_and_symlinks_cannot_escape_private_dataset(self):
		with tempfile.TemporaryDirectory() as directory:
			root = Path(directory)
			(root / "outside-link").symlink_to(root.parent, target_is_directory=True)
			for path in ["../secret.wav", "/tmp/secret.wav", "outside-link/secret.wav"]:
				manifest = example()
				manifest["samples"][0]["audio"] = path
				with self.assertRaises(ValueError):
					validate(manifest, root, check_audio=False)

	def test_errors_require_valid_time_and_word_positions(self):
		for index, end in [(2, 100), (True, 100), (0, 1001.1), (0, float("nan"))]:
			manifest = example()
			annotation = manifest["samples"][0]["annotation"]
			annotation.update(
				verdict="incorrect",
				errors=[{"kind": "substitution", "expected_index": index, "start_ms": 0, "end_ms": end}],
			)
			with self.assertRaises(ValueError):
				validate(manifest, Path("."), check_audio=False)

	@unittest.skipUnless(shutil.which("ffprobe"), "ffprobe required for audio-integrity check")
	def test_audio_hash_and_duration_are_verified(self):
		with tempfile.TemporaryDirectory() as directory:
			root = Path(directory)
			(root / "audio").mkdir()
			path = root / "audio/clip.wav"
			with wave.open(str(path), "wb") as audio:
				audio.setnchannels(1)
				audio.setsampwidth(2)
				audio.setframerate(16000)
				audio.writeframes(bytes(32000))
			manifest = example()
			row = manifest["samples"][0]
			row["sha256"] = digest(path)
			validate(manifest, root)
			row["duration_seconds"] = 100
			with self.assertRaises(ValueError):
				validate(manifest, root)
			row["duration_seconds"] = 1
			row["sha256"] = "b" * 64
			with self.assertRaises(ValueError):
				validate(manifest, root)

	def test_outputs_are_private_and_never_overwritten(self):
		with tempfile.TemporaryDirectory() as directory:
			path = Path(directory) / "result.json"
			write_private(path, {"test": True})
			self.assertEqual(path.stat().st_mode & 0o777, 0o600)
			with self.assertRaises(FileExistsError):
				write_private(path, {"test": False})
			self.assertTrue(json.loads(path.read_text())["test"])


class MetricTests(unittest.TestCase):
	def test_normalization_does_not_hide_consonant_errors(self):
		self.assertEqual(normalize("بِسْمِ ٱللَّهِ"), "بسم الله")
		for left, right in [("نستعين", "نستغين"), ("ة", "ه"), ("ؤ", "و"), ("ئ", "ي"), ("أ", "ا")]:
			self.assertNotEqual(normalize(left), normalize(right))

	def test_edit_counts_include_substitutions_insertions_and_deletions(self):
		self.assertEqual(
			edit_counts("abc", "axcd"),
			{"substitutions": 1, "deletions": 0, "insertions": 1, "reference_units": 3},
		)
		self.assertEqual(edit_counts(["a", "a"], ["a"])["deletions"], 1)
		self.assertEqual(edit_counts(["a", "b"], [])["deletions"], 2)
		self.assertEqual(percentile([1, 2, 3, 4], 0.95), 4)

	def test_missing_duplicate_or_changed_predictions_fail_closed(self):
		manifest = example()
		for mutation in [
			lambda r: r["predictions"].clear(),
			lambda r: r["predictions"].append(copy.deepcopy(r["predictions"][0])),
			lambda r: r.update(manifest_sha256="b" * 64),
			lambda r: r["predictions"][0].update(audio_sha256="b" * 64),
			lambda r: r["predictions"][0].update(elapsed_seconds=float("nan")),
			lambda r: r["predictions"][0].update(elapsed_seconds=-1),
		]:
			run = run_for(manifest)
			mutation(run)
			with self.assertRaises(ValueError):
				validate_predictions(manifest, run, "dev")


@unittest.skipUnless(shutil.which("node"), "Node required to evaluate the actual Companion core")
class EvaluationIntegrationTests(unittest.TestCase):
	def test_paired_comparison_rejects_different_datasets(self):
		manifest = example()
		baseline = evaluate(manifest, run_for(manifest))
		changed = copy.deepcopy(baseline)
		changed["manifest_sha256"] = "b" * 64
		with self.assertRaises(ValueError):
			compare(baseline, changed)
		changed = copy.deepcopy(baseline)
		changed["cases"].clear()
		with self.assertRaises(ValueError):
			compare(baseline, changed)

	def test_paired_comparison_reports_regressions_and_same_run_is_idempotent(self):
		manifest = example()
		before = evaluate(manifest, run_for(manifest))
		after = evaluate(manifest, run_for(manifest, {"status": "transcribed", "transcript": "زيادة"}))
		result = compare(before, after)
		self.assertEqual(result["regressions"]["new_false_mismatches"], 1)
		self.assertEqual(result["regressions"]["correct_matches_lost"], 1)
		self.assertEqual(compare(before, before)["changed_cases"], [])

	def test_canonical_word_repair_is_false_accept_not_asr_success(self):
		manifest = example()
		annotation = manifest["samples"][0]["annotation"]
		annotation.update(
			spoken_text="زيادة الله",
			verdict="incorrect",
			errors=[{"kind": "substitution", "expected_index": 0, "start_ms": 0, "end_ms": 500}],
		)
		report = evaluate(manifest, run_for(manifest))
		self.assertEqual(report["summary"]["false_accept_clip_rate"], 1)
		self.assertEqual(report["summary"]["canonicalization_flags"], 1)
		self.assertEqual(report["summary"]["wer"]["rate"], 0.5)

	def test_uncertainty_cannot_game_detection_or_earn_credit(self):
		manifest = example()
		annotation = manifest["samples"][0]["annotation"]
		annotation.update(
			spoken_text="زيادة الله",
			verdict="incorrect",
			errors=[{"kind": "substitution", "expected_index": 0, "start_ms": 0, "end_ms": 500}],
		)
		run = run_for(manifest, {"status": "uncertain", "transcript": "", "preview_transcript": "زيادة الله"})
		summary = evaluate(manifest, run)["summary"]
		self.assertEqual(summary["word_error_clip_detection_rate"], 0)
		self.assertEqual(summary["false_accept_clip_rate"], 0)
		self.assertEqual(summary["abstention_rate"], 1)
		self.assertEqual(summary["wer"]["rate"], 0)

	def test_failures_remain_in_wer_and_timing_denominators(self):
		manifest = example()
		run = run_for(manifest, {"status": "error", "transcript": "", "code": "asr_failed"})
		summary = evaluate(manifest, run)["summary"]
		self.assertEqual(summary["wer"]["rate"], 1)
		self.assertEqual(summary["technical_failure_rate"], 1)
		self.assertEqual(summary["realtime_factor"], 0.5)

	def test_wrong_result_on_correct_audio_is_a_false_alarm(self):
		manifest = example()
		run = run_for(manifest, {"status": "transcribed", "transcript": "زيادة"})
		summary = evaluate(manifest, run)["summary"]
		self.assertEqual(summary["false_mismatch_clip_rate"], 1)
		self.assertEqual(summary["false_mismatch_clips_per_10_correct_minutes"], 600)

	def test_professional_and_synthetic_controls_never_count_as_learners(self):
		manifest = example()
		manifest["samples"][0]["kind"] = "reference"
		report = evaluate(manifest, run_for(manifest))
		self.assertEqual(report["learner_summary"]["clips"], 0)
		self.assertIsNone(report["learner_summary"]["wer"]["rate"])
		self.assertEqual(report["collection"]["reviewed_learner_clips"], 0)

	def test_phonetic_errors_do_not_become_claimed_word_detection_metrics(self):
		manifest = example()
		annotation = manifest["samples"][0]["annotation"]
		annotation.update(
			verdict="incorrect", errors=[{"kind": "vowel", "expected_index": 0, "start_ms": 0, "end_ms": 100}]
		)
		summary = evaluate(manifest, run_for(manifest))["summary"]
		self.assertEqual(summary["phonetic_error_clips_not_assessed"], 1)
		self.assertIsNone(summary["word_error_clip_detection_rate"])

	def test_silence_has_no_wer_but_fabricated_credit_is_counted(self):
		manifest = example()
		manifest["samples"][0]["annotation"].update(verdict="unscorable", spoken_text="")
		summary = evaluate(manifest, run_for(manifest))["summary"]
		self.assertIsNone(summary["wer"]["rate"])
		self.assertEqual(summary["unscorable_clips_granted_word_match"], 1)

	def test_repeated_words_count_in_verbatim_wer_even_when_a_retry_is_accepted(self):
		manifest = example()
		manifest["samples"][0]["annotation"]["spoken_text"] = "بسم الله بسم الله"
		report = evaluate(manifest, run_for(manifest))
		self.assertEqual(report["summary"]["outcomes"]["matched"], 1)
		self.assertEqual(report["summary"]["wer"]["deletions"], 2)
		self.assertNotIn("spoken_text", report["cases"][0])
