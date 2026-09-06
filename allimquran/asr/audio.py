"""Bounded audio decoding and explicit ASR outcomes; no pronunciation verdicts."""

from __future__ import annotations

import logging
import subprocess
import tempfile
from pathlib import Path

from fastapi import HTTPException

SAMPLE_RATE = 16000
MAX_AUDIO_SECONDS = 60
CHUNK_SECONDS = 20
STRIDE_SECONDS = 3
logger = logging.getLogger(__name__)


def outcome(transcript="", status="uncertain", reason=None):
	return {
		# Old open tabs only inspect transcript. Never let them credit uncertain text.
		"transcript": transcript if status == "transcribed" else "",
		"preview_transcript": transcript if status == "uncertain" else "",
		"status": status,
		"reason": reason,
		"assessment": "word_sequence_only",
	}


def failure(status, code, message):
	return HTTPException(status_code=status, detail={"code": code, "message": message})


def split_at_pauses(samples):
	"""Partition at sustained quiet gaps; never deduplicate words across real pauses.

	This conservative energy rule is not a learned speech detector. Every input
	sample belongs to exactly one segment. Keep short tails with the prior segment.
	"""
	import numpy as np

	frame = SAMPLE_RATE // 100
	count = len(samples) // frame
	if not count:
		return [samples]
	rms = np.sqrt(np.mean(np.square(samples[: count * frame].reshape(count, frame)), axis=1))
	quiet = rms < 0.0008
	boundaries = [0]
	start = None
	for index, silent in enumerate(quiet):
		if silent and start is None:
			start = index
		elif not silent and start is not None:
			boundary = (start + index) // 2 * frame
			if (
				index - start >= 30
				and boundary - boundaries[-1] >= SAMPLE_RATE
				and len(samples) - boundary >= SAMPLE_RATE
			):
				boundaries.append(boundary)
			start = None
	boundaries.append(len(samples))
	return [samples[left:right] for left, right in zip(boundaries[:-1], boundaries[1:], strict=True)]


def transcribe_audio(path, get_pipeline, inference_lock):
	"""Keep every audio sample up to the limit and report unsafe segmentation explicitly.

	Short-window decoding avoids this checkpoint's unsupported long-form generation.
	No expected verse or canonical text is supplied as a decoding prompt.
	"""
	import numpy as np
	import soundfile as sf

	normalized_path = None
	try:
		with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as normalized:
			normalized_path = normalized.name
		try:
			subprocess.run(
				[
					"ffmpeg",
					"-nostdin",
					"-v",
					"error",
					"-protocol_whitelist",
					"file,pipe",
					"-i",
					path,
					"-vn",
					"-ac",
					"1",
					"-ar",
					str(SAMPLE_RATE),
					# Decode one extra second to detect oversize instead of silently truncating.
					"-t",
					str(MAX_AUDIO_SECONDS + 1),
					"-c:a",
					"pcm_s16le",
					"-y",
					normalized_path,
				],
				check=True,
				timeout=30,
				capture_output=True,
			)
			samples, rate = sf.read(normalized_path, dtype="float32", always_2d=False)
			samples = np.asarray(samples, dtype=np.float32).reshape(-1)
		except subprocess.TimeoutExpired as error:
			logger.warning("ASR decoding timeout")
			raise failure(504, "decode_timeout", "Audio decoding timed out") from error
		except (subprocess.CalledProcessError, sf.LibsndfileError, ValueError) as error:
			# Do not log uploaded content, transcripts, stderr or temporary filenames.
			logger.warning("ASR invalid audio (%s)", type(error).__name__)
			raise failure(422, "invalid_audio", "Audio could not be decoded") from error
		if rate != SAMPLE_RATE or not samples.size or not np.isfinite(samples).all():
			raise failure(422, "invalid_audio", "Audio contains no valid samples")
		if samples.size > SAMPLE_RATE * MAX_AUDIO_SECONDS:
			raise failure(422, "audio_too_long", "Audio must be at most 60 seconds")
		peak = float(np.max(np.abs(samples)))
		rms = float(np.sqrt(np.mean(np.square(samples), dtype=np.float64)))
		if peak < 0.0001:
			return outcome(status="no_speech", reason="silence")
		if samples.size < SAMPLE_RATE // 5:
			return outcome(reason="audio_too_short")
		if rms < 0.0008 or peak < 0.008:
			return outcome(reason="audio_too_quiet")

		# Bound queueing too. Reject overload explicitly instead of accumulating jobs
		# after clients time out. The existing service still runs one model at a time.
		if not inference_lock.acquire(timeout=5):
			raise failure(503, "asr_busy", "Recognition is busy; please retry shortly")
		try:
			texts = []
			uncertainty = None
			pipeline = get_pipeline()
			for segment in split_at_pauses(samples):
				if float(np.max(np.abs(segment))) < 0.0001:
					continue
				options = {
					"return_timestamps": False,
					"generate_kwargs": {"do_sample": False, "max_new_tokens": 224, "num_beams": 1},
				}
				if segment.size > SAMPLE_RATE * CHUNK_SECONDS:
					options.update(chunk_length_s=CHUNK_SECONDS, stride_length_s=STRIDE_SECONDS)
					# Token overlap merging can erase real repetitions. It may provide
					# preview text but cannot authorize a word-sequence completion.
					uncertainty = "unsafe_audio_boundary"
				result = pipeline({"raw": segment, "sampling_rate": SAMPLE_RATE}, **options)
				if not isinstance(result, dict) or not isinstance(result.get("text"), str):
					raise ValueError("Invalid model output")
				text = result["text"].strip()
				if not text:
					uncertainty = uncertainty or "unrecognized_audio"
				else:
					texts.append(text)
		finally:
			inference_lock.release()
		text = " ".join(texts)
		if uncertainty or not text:
			return outcome(text, reason=uncertainty or "unrecognized_audio")
		return outcome(text, "transcribed")
	except HTTPException:
		raise
	except Exception as error:
		logger.error("ASR processing failed (%s)", type(error).__name__)
		raise failure(503, "asr_failed", "Recognition could not process this recording") from error
	finally:
		if normalized_path:
			try:
				Path(normalized_path).unlink(missing_ok=True)
			except OSError:
				logger.warning("ASR temporary audio cleanup failed")
