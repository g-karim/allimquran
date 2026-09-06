"""Verbatim ASR accuracy and clip-level assessment, with abstentions in denominators."""

import collections
import json
import math
import subprocess
import unicodedata
from pathlib import Path

from .dataset import digest, finite_number, manifest_digest, require, selected_samples, validate

ROOT = Path(__file__).resolve().parents[1]
WORD_ERRORS = {"substitution", "omission", "insertion", "order"}


def normalize(text):
	"""WER policy v1: spelling, not phonemes. Preserve different consonants and hamza."""
	result = []
	for char in unicodedata.normalize("NFKC", text):
		if char == "ـ" or unicodedata.category(char).startswith("M"):
			continue
		if char == "ٱ":
			char = "ا"
		result.append(char if unicodedata.category(char).startswith(("L", "N")) else " ")
	return " ".join("".join(result).split())


def edit_counts(reference, hypothesis):
	"""Minimum edits with stable tie-breaking; no fuzzy substitutions or deduplication."""
	previous = [(j, 0, 0, j) for j in range(len(hypothesis) + 1)]
	for i, expected in enumerate(reference, 1):
		current = [(i, 0, i, 0)]
		for j, heard in enumerate(hypothesis, 1):
			cost, substitutions, deletions, insertions = previous[j - 1]
			different = int(expected != heard)
			options = [(cost + different, substitutions + different, deletions, insertions)]
			cost, substitutions, deletions, insertions = previous[j]
			options.append((cost + 1, substitutions, deletions + 1, insertions))
			cost, substitutions, deletions, insertions = current[-1]
			options.append((cost + 1, substitutions, deletions, insertions + 1))
			current.append(min(options, key=lambda item: item[0]))
		previous = current
	_, substitutions, deletions, insertions = previous[-1]
	return {
		"substitutions": substitutions,
		"deletions": deletions,
		"insertions": insertions,
		"reference_units": len(reference),
	}


def rate(numerator, denominator):
	return numerator / denominator if denominator else None


def percentile(values, fraction):
	return sorted(values)[max(0, math.ceil(len(values) * fraction) - 1)] if values else None


def validate_predictions(manifest, run, split, allow_heldout=False):
	require(run.get("schema_version") == 1, "Unsupported predictions schema")
	require(run.get("manifest_sha256") == manifest_digest(manifest), "Predictions use another manifest")
	require(run.get("split") == split, "Predictions split mismatch")
	require(isinstance(run.get("engine"), dict) and run["engine"].get("model"), "Missing engine identity")
	selected = selected_samples(manifest, split, allow_heldout)
	by_id = {row["id"]: row for row in selected}
	predictions = run.get("predictions")
	require(isinstance(predictions, list), "Missing predictions")
	require(len(predictions) == len(selected), "Missing/extra predictions: failures must not be dropped")
	seen = set()
	for prediction in predictions:
		identifier = prediction.get("id")
		require(identifier in by_id and identifier not in seen, "Unknown or duplicate prediction id")
		seen.add(identifier)
		require(prediction.get("audio_sha256") == by_id[identifier]["sha256"], "Prediction audio mismatch")
		require(finite_number(prediction.get("elapsed_seconds")), "Invalid prediction timing")
		response = prediction.get("response")
		require(isinstance(response, dict), "Missing response (use status=error for failed requests)")
		require(
			response.get("status") in {"transcribed", "uncertain", "no_speech", "error"}, "Invalid status"
		)
		for key in ("transcript", "preview_transcript"):
			require(isinstance(response.get(key, ""), str), f"Invalid {key}")
			require(len(response.get(key, "")) <= 20000, "Unbounded transcript")
		if response["status"] != "transcribed":
			require(
				not response.get("transcript"), "Non-transcribed response must not contain creditable text"
			)
	return selected, {row["id"]: row for row in predictions}


def assess(rows, predictions):
	inputs = [
		{
			"id": row["id"],
			"expected_words": row["annotation"]["expected_words"],
			"response": predictions[row["id"]]["response"],
		}
		for row in rows
	]
	bridge = ROOT / "evaluation" / "bridge.cjs"
	result = subprocess.run(
		["node", str(bridge)],
		input=json.dumps(inputs),
		text=True,
		capture_output=True,
		timeout=120,
		check=True,
	)
	return {row["id"]: row for row in json.loads(result.stdout)}


def summarize(rows):
	counts = collections.Counter(row["assessment"] for row in rows)
	correct = [r for r in rows if r["verdict"] == "correct"]
	incorrect = [r for r in rows if r["verdict"] == "incorrect" and r["has_word_error"]]
	false_alarms = sum(r["assessment"] == "mismatch" for r in correct)
	detected = sum(r["assessment"] == "mismatch" for r in incorrect)
	false_accepts = sum(r["assessment"] == "matched" for r in incorrect)
	wer_counts = {
		key: sum(row["wer"][key] for row in rows)
		for key in ("substitutions", "deletions", "insertions", "reference_units")
	}
	char_errors = sum(row["cer_errors"] for row in rows)
	char_units = sum(row["cer_units"] for row in rows)
	durations = sum(row["duration_seconds"] for row in rows)
	return {
		"clips": len(rows),
		"speaker_groups": len({r["speaker_id"] for r in rows}),
		"duration_seconds": durations,
		"outcomes": dict(counts),
		"correct_clips": len(correct),
		"word_error_clips": len(incorrect),
		"word_error_clip_detection_rate": rate(detected, len(incorrect)),
		"word_error_clip_precision": rate(detected, detected + false_alarms),
		"false_accept_clip_rate": rate(false_accepts, len(incorrect)),
		"false_mismatch_clip_rate": rate(false_alarms, len(correct)),
		"false_mismatch_clips_per_10_correct_minutes": rate(
			false_alarms * 600, sum(r["duration_seconds"] for r in correct)
		),
		"correct_clip_abstention_rate": rate(
			sum(r["assessment"] == "uncertain" for r in correct), len(correct)
		),
		"abstention_rate": rate(counts["uncertain"], len(rows)),
		"technical_failure_rate": rate(counts["technical_error"], len(rows)),
		"canonicalization_flags": sum(r["canonicalization_flag"] for r in rows),
		"phonetic_error_clips_not_assessed": sum(r["has_phonetic_error"] for r in rows),
		"unscorable_clips": sum(r["verdict"] == "unscorable" for r in rows),
		"unscorable_clips_granted_word_match": sum(
			r["verdict"] == "unscorable" and r["assessment"] == "matched" for r in rows
		),
		"wer": {
			**wer_counts,
			"rate": rate(
				sum(wer_counts[k] for k in ("substitutions", "deletions", "insertions")),
				wer_counts["reference_units"],
			),
		},
		"cer": {"edits": char_errors, "reference_units": char_units, "rate": rate(char_errors, char_units)},
		"clip_latency_p50_seconds": percentile([r["elapsed_seconds"] for r in rows], 0.5),
		"clip_latency_p95_seconds": percentile([r["elapsed_seconds"] for r in rows], 0.95),
		"realtime_factor": rate(sum(r["elapsed_seconds"] for r in rows), durations),
	}


def evaluate(manifest, run, *, split="dev", allow_heldout=False):
	validate(manifest, Path("."), check_audio=False)
	selected, predictions = validate_predictions(manifest, run, split, allow_heldout)
	assessments = assess(selected, predictions)
	details = []
	for row in selected:
		prediction, annotation = predictions[row["id"]], row["annotation"]
		response = prediction["response"]
		heard = normalize(
			response.get("preview_transcript", "")
			if response["status"] == "uncertain"
			else response.get("transcript", "")
		)
		spoken = normalize(annotation["spoken_text"])
		# Unknown truth (silence/noise/disputed intelligibility) has no WER denominator.
		if annotation["verdict"] == "unscorable":
			spoken, heard_for_wer = "", ""
		else:
			heard_for_wer = heard
		wer = edit_counts(spoken.split(), heard_for_wer.split())
		cer = edit_counts(spoken.replace(" ", ""), heard_for_wer.replace(" ", ""))
		error_kinds = {e["kind"] for e in annotation["errors"]}
		canonical = normalize(" ".join(annotation["expected_words"]))
		details.append(
			{
				"id": row["id"],
				"speaker_id": row["speaker_id"],
				"kind": row["kind"],
				"metadata": row["metadata"],
				"tags": row["tags"],
				"verdict": annotation["verdict"],
				"has_word_error": bool(error_kinds & WORD_ERRORS),
				"has_phonetic_error": bool(error_kinds - WORD_ERRORS),
				"duration_seconds": row["duration_seconds"],
				"elapsed_seconds": prediction["elapsed_seconds"],
				"assessment": assessments[row["id"]]["outcome"],
				"wer": wer,
				"cer_errors": sum(cer[k] for k in ("substitutions", "deletions", "insertions")),
				"cer_units": cer["reference_units"],
				"canonicalization_flag": annotation["verdict"] == "incorrect"
				and bool(error_kinds & WORD_ERRORS)
				and spoken != canonical
				and heard == canonical,
			}
		)
	groups = {}
	for key in ("kind", "speaker_id", "native_language", "device", "noise", "pace", "riwayah"):
		values = {r.get(key, r["metadata"].get(key)) for r in details}
		groups[key] = {
			value: summarize([r for r in details if r.get(key, r["metadata"].get(key)) == value])
			for value in sorted(values)
		}
	learners = [r for r in details if r["kind"] == "learner"]
	return {
		"schema_version": 1,
		"dataset_id": manifest["dataset_id"],
		"manifest_sha256": manifest_digest(manifest),
		"split": split,
		"engine": run["engine"],
		"normalization": "arabic-spelling-v1-no-vowels-no-consonant-folding",
		"assessment_core_sha256": digest(ROOT / "public/js/recitation-core.js"),
		"scorer_sha256": digest(Path(__file__)),
		"scope": "Offline clip-level word assessment, NOT phonetic error detection or streaming latency",
		"summary": summarize(details),
		"learner_summary": summarize(learners),
		"groups": groups,
		"collection": {
			"reviewed_learner_clips": sum(r["kind"] == "learner" for r in manifest["samples"]),
			"initial_target_minimum": 200,
			"heldout_learner_speakers": len(
				{
					r["speaker_id"]
					for r in manifest["samples"]
					if r["kind"] == "learner" and r["split"] == "test"
				}
			),
		},
		"cases": details,
	}
