import shutil
import subprocess
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import numpy as np
import soundfile as sf
from fastapi import HTTPException

from allimquran.asr import audio


@unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg is required for audio integration tests")
class AudioTests(unittest.TestCase):
	def setUp(self):
		self.directory = tempfile.TemporaryDirectory()
		self.addCleanup(self.directory.cleanup)
		self.path = str(Path(self.directory.name) / "input.wav")
		self.pipeline = Mock(return_value={"text": "بِسْمِ اللَّهِ"})
		self.factory = Mock(return_value=self.pipeline)
		self.lock = threading.Lock()

	def samples(self, seconds=1, amplitude=0.1):
		values = amplitude * np.sin(np.arange(int(seconds * audio.SAMPLE_RATE)) * 0.08)
		sf.write(self.path, values, audio.SAMPLE_RATE, subtype="PCM_16")

	def transcribe(self):
		return audio.transcribe_audio(self.path, self.factory, self.lock)

	def test_short_audio_is_decoded_without_prompting_with_expected_text(self):
		self.samples()
		self.assertEqual(self.transcribe(), audio.outcome("بِسْمِ اللَّهِ", "transcribed"))
		data = self.pipeline.call_args.args[0]
		self.assertEqual(data["sampling_rate"], 16000)
		self.assertEqual(len(data["raw"]), 16000)
		self.assertNotIn("chunk_length_s", self.pipeline.call_args.kwargs)
		self.assertFalse(self.lock.locked())

	def test_long_unbroken_audio_is_chunked_but_cannot_silently_earn_credit(self):
		for seconds in [20.001, 30, 31, 55, 60]:
			with self.subTest(seconds=seconds):
				self.samples(seconds)
				self.assertEqual(self.transcribe()["reason"], "unsafe_audio_boundary")
				data = self.pipeline.call_args.args[0]
				self.assertEqual(len(data["raw"]), int(seconds * 16000))
				self.assertEqual(self.pipeline.call_args.kwargs["chunk_length_s"], 20)
				self.assertEqual(self.pipeline.call_args.kwargs["stride_length_s"], 3)
				self.assertFalse(self.pipeline.call_args.kwargs["return_timestamps"])

	def test_pause_segmentation_preserves_samples_and_real_repeated_phrases(self):
		phrase = np.sin(np.arange(4 * audio.SAMPLE_RATE) * 0.08) * 0.1
		repeated = np.tile(np.concatenate([phrase, np.zeros(audio.SAMPLE_RATE)]), 7)
		sf.write(self.path, repeated, audio.SAMPLE_RATE, subtype="PCM_16")
		decoded, _ = sf.read(self.path, dtype="float32")
		segments = audio.split_at_pauses(decoded)
		self.assertEqual(len(segments), 7)
		np.testing.assert_array_equal(np.concatenate(segments), decoded)
		result = self.transcribe()
		self.assertEqual(result["status"], "transcribed")
		self.assertEqual(result["transcript"], " ".join(["بِسْمِ اللَّهِ"] * 7))
		self.assertEqual(self.pipeline.call_count, 7)
		self.assertTrue(all("chunk_length_s" not in call.kwargs for call in self.pipeline.call_args_list))

	def test_an_unrecognized_segment_cannot_return_a_successful_partial_transcript(self):
		phrase = np.sin(np.arange(2 * audio.SAMPLE_RATE) * 0.08) * 0.1
		sf.write(self.path, np.concatenate([phrase, np.zeros(audio.SAMPLE_RATE), phrase]), audio.SAMPLE_RATE)
		self.pipeline.side_effect = [{"text": "بسم"}, {"text": ""}]
		result = self.transcribe()
		self.assertEqual(result["transcript"], "")
		self.assertEqual(result["preview_transcript"], "بسم")
		self.assertEqual(result["status"], "uncertain")

	def test_oversize_duration_is_rejected_not_silently_clipped(self):
		self.samples(60.01)
		with self.assertRaises(HTTPException) as raised:
			self.transcribe()
		self.assertEqual(raised.exception.detail["code"], "audio_too_long")
		self.assertEqual(raised.exception.status_code, 422)
		self.factory.assert_not_called()

	def test_silence_never_calls_the_model(self):
		self.samples(amplitude=0)
		self.assertEqual(self.transcribe(), audio.outcome(status="no_speech", reason="silence"))
		self.factory.assert_not_called()

	def test_quiet_audio_is_uncertain_not_a_reading_error_or_silence(self):
		self.samples(amplitude=0.0005)
		self.assertEqual(self.transcribe()["reason"], "audio_too_quiet")
		self.factory.assert_not_called()

	def test_short_non_silent_audio_is_uncertain(self):
		self.samples(0.1)
		self.assertEqual(self.transcribe()["reason"], "audio_too_short")
		self.factory.assert_not_called()

	def test_empty_model_output_is_uncertain_not_no_speech(self):
		self.samples()
		self.pipeline.return_value = {"text": " "}
		self.assertEqual(self.transcribe(), audio.outcome(reason="unrecognized_audio"))

	def test_model_value_error_is_an_explicit_service_error(self):
		self.samples(31)
		self.pipeline.side_effect = ValueError("private transcript must not be logged")
		with self.assertLogs(audio.logger, "ERROR") as logs:
			with self.assertRaises(HTTPException) as raised:
				self.transcribe()
		self.assertEqual(raised.exception.status_code, 503)
		self.assertEqual(raised.exception.detail["code"], "asr_failed")
		self.assertNotIn("private transcript", " ".join(logs.output))
		self.assertFalse(self.lock.locked())

	def test_invalid_model_output_is_never_stringified_as_a_transcript(self):
		self.samples()
		for result in [None, {"text": None}, ["بسم الله"]]:
			self.pipeline.return_value = result
			with self.assertRaises(HTTPException):
				self.transcribe()

	def test_corrupt_audio_is_not_silence(self):
		Path(self.path).write_bytes(b"not an audio container")
		with self.assertRaises(HTTPException) as raised:
			self.transcribe()
		self.assertEqual(raised.exception.detail["code"], "invalid_audio")
		self.factory.assert_not_called()

	def test_decode_timeout_has_a_separate_error_code(self):
		with patch.object(audio.subprocess, "run", side_effect=subprocess.TimeoutExpired("ffmpeg", 30)):
			with self.assertRaises(HTTPException) as raised:
				self.transcribe()
		self.assertEqual(raised.exception.status_code, 504)
		self.assertEqual(raised.exception.detail["code"], "decode_timeout")

	def test_busy_queue_does_not_load_another_model(self):
		self.samples()
		lock = Mock()
		lock.acquire.return_value = False
		with self.assertRaises(HTTPException) as raised:
			audio.transcribe_audio(self.path, self.factory, lock)
		self.assertEqual(raised.exception.detail["code"], "asr_busy")
		self.factory.assert_not_called()
		lock.release.assert_not_called()

	def test_normalized_audio_is_deleted_on_success_and_failure(self):
		self.samples()
		original = tempfile.NamedTemporaryFile
		paths = []

		def tracked(*args, **kwargs):
			file = original(*args, **kwargs)
			paths.append(Path(file.name))
			return file

		with patch.object(audio.tempfile, "NamedTemporaryFile", side_effect=tracked):
			self.transcribe()
			self.pipeline.side_effect = RuntimeError("inference failed")
			with self.assertRaises(HTTPException):
				self.transcribe()
		self.assertEqual(len(paths), 2)
		self.assertTrue(all(not path.exists() for path in paths))
