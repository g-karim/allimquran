"""Private, versioned corpus validation and speaker-disjoint split guards."""

import hashlib
import json
import math
import os
import re
import subprocess
from pathlib import Path

SCHEMA_VERSION = 1
ID = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
KINDS = {"learner", "reference", "synthetic_control"}
ERROR_KINDS = {"substitution", "omission", "insertion", "order", "letter", "vowel", "tajwid"}


def require(condition, message):
	if not condition:
		raise ValueError(message)


def digest(path):
	with Path(path).open("rb") as stream:
		hash_value = hashlib.sha256()
		for chunk in iter(lambda: stream.read(1024 * 1024), b""):
			hash_value.update(chunk)
		return hash_value.hexdigest()


def manifest_digest(manifest):
	return hashlib.sha256(
		json.dumps(manifest, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
	).hexdigest()


def audio_duration(path):
	result = subprocess.run(
		[
			"ffprobe",
			"-v",
			"error",
			"-protocol_whitelist",
			"file,pipe",
			"-show_entries",
			"format=duration",
			"-of",
			"json",
			str(path),
		],
		capture_output=True,
		text=True,
		check=True,
		timeout=15,
	)
	seconds = float(json.loads(result.stdout)["format"]["duration"])
	require(finite_number(seconds, minimum=0.001), "Audio has no measurable duration")
	return seconds


def finite_number(value, *, minimum=0):
	return (
		isinstance(value, (int, float))
		and not isinstance(value, bool)
		and math.isfinite(value)
		and value >= minimum
	)


def audio_path(root, sample):
	path = Path(sample["audio"])
	require(not path.is_absolute(), f"{sample['id']}: audio must be relative to the manifest")
	resolved = (root / path).resolve()
	require(resolved.is_relative_to(root.resolve()), f"{sample['id']}: audio escapes the dataset directory")
	return resolved


def validate(manifest, root, *, check_audio=True, require_reviewed=True):
	require(manifest.get("schema_version") == SCHEMA_VERSION, "Unsupported manifest schema")
	require(bool(ID.fullmatch(manifest.get("dataset_id", ""))), "Invalid dataset_id")
	samples = manifest.get("samples")
	require(isinstance(samples, list) and 0 < len(samples) <= 10000, "Expected 1..10000 samples")
	seen, speaker_splits, group_splits, audio_splits = set(), {}, {}, {}
	for row in samples:
		identifier = row.get("id", "")
		require(bool(ID.fullmatch(identifier)) and identifier not in seen, "Invalid or duplicate sample id")
		seen.add(identifier)
		for key in ("speaker_id", "recording_group"):
			require(bool(ID.fullmatch(row.get(key, ""))), f"{identifier}: invalid {key}")
		split, kind = row.get("split"), row.get("kind")
		require(split in {"dev", "test"}, f"{identifier}: split must be dev or test")
		require(kind in KINDS, f"{identifier}: invalid kind")
		for registry, key in [(speaker_splits, row["speaker_id"]), (group_splits, row["recording_group"])]:
			require(key not in registry or registry[key] == split, "Speaker/recording leakage across splits")
			registry[key] = split
		audio_hash = row.get("sha256", "")
		require(bool(SHA256.fullmatch(audio_hash)), f"{identifier}: invalid sha256")
		require(
			audio_hash not in audio_splits or audio_splits[audio_hash] == split, "Audio leakage across splits"
		)
		audio_splits[audio_hash] = split
		require(finite_number(row.get("duration_seconds"), minimum=0.001), f"{identifier}: invalid duration")
		rights = row.get("rights", {})
		require(rights.get("evaluation_allowed") is True, f"{identifier}: evaluation permission is required")
		require(
			isinstance(rights.get("basis"), str) and rights["basis"].strip(), f"{identifier}: document rights"
		)
		require(rights.get("redistribution_allowed") is False, "This private workflow does not publish audio")
		if kind == "learner":
			require(
				rights.get("consent_status") == "granted", f"{identifier}: participant consent is required"
			)
			require(bool(ID.fullmatch(rights.get("consent_id", ""))), "Use a pseudonymous consent reference")
		annotation = row.get("annotation", {})
		status = annotation.get("status")
		require(
			status in {"draft", "reviewed", "adjudicated", "reference"}, f"{identifier}: annotation status"
		)
		if status == "reference":
			require(kind != "learner", "Reference text is not a learner's verified spoken transcript")
		if require_reviewed:
			require(status != "draft", f"{identifier}: annotation is not reviewed")
		if status in {"reviewed", "adjudicated"}:
			reviewers = annotation.get("reviewer_ids", [])
			require(isinstance(reviewers, list) and reviewers, f"{identifier}: reviewer required")
			require(all(isinstance(r, str) and ID.fullmatch(r) for r in reviewers), "Use reviewer pseudonyms")
			require(len(set(reviewers)) == len(reviewers), "Duplicate reviewer ids")
			if status == "adjudicated":
				require(len(reviewers) >= 2, "Adjudication requires two independent reviewers")
		if annotation.get("disputed"):
			require(status == "adjudicated", f"{identifier}: unresolved annotation dispute")
		words = annotation.get("expected_words")
		require(isinstance(words, list) and 0 < len(words) <= 256, f"{identifier}: expected_words required")
		require(
			all(isinstance(w, str) and w.strip() and len(w) <= 100 for w in words), "Invalid expected words"
		)
		spoken = annotation.get("spoken_text")
		require(
			isinstance(spoken, str) and len(spoken) <= 20000, f"{identifier}: actual spoken_text required"
		)
		verdict = annotation.get("verdict")
		require(verdict in {"correct", "incorrect", "unscorable"}, f"{identifier}: invalid verdict")
		if verdict != "unscorable":
			require(bool(spoken.strip()), f"{identifier}: missing verbatim transcript")
		errors = annotation.get("errors")
		require(isinstance(errors, list), f"{identifier}: errors must be a list")
		if verdict == "incorrect":
			require(bool(errors), f"{identifier}: annotate the actual errors")
		if verdict == "correct":
			require(not errors, f"{identifier}: corrected retries belong in tags, not remaining errors")
		for error in errors:
			require(error.get("kind") in ERROR_KINDS, f"{identifier}: unsupported error kind")
			index = error.get("expected_index")
			require(isinstance(index, int) and not isinstance(index, bool), "Error requires expected_index")
			require(0 <= index < len(words) + (error["kind"] == "insertion"), "Error index outside verse")
			start, end = error.get("start_ms"), error.get("end_ms")
			require(
				finite_number(start) and finite_number(end) and start <= end, "Invalid error time interval"
			)
			require(end <= row["duration_seconds"] * 1000 + 1, "Error interval outside recording")
		metadata = row.get("metadata", {})
		require(isinstance(metadata, dict), "metadata must be an object")
		for field in ("native_language", "device", "noise", "pace", "riwayah"):
			require(
				isinstance(metadata.get(field), str) and metadata[field].strip(), f"Missing metadata: {field}"
			)
		require(
			isinstance(row.get("tags"), list) and all(isinstance(t, str) for t in row["tags"]), "Invalid tags"
		)
		path = audio_path(root, row)
		if check_audio:
			require(path.is_file() and digest(path) == audio_hash, f"{identifier}: missing or changed audio")
			require(
				abs(audio_duration(path) - row["duration_seconds"]) <= 0.1,
				f"{identifier}: duration differs from audio (would corrupt timing denominators)",
			)
	return samples


def load_manifest(path, **options):
	path = Path(path)
	manifest = json.loads(path.read_text())
	validate(manifest, path.parent, **options)
	return manifest


def selected_samples(manifest, split, allow_heldout=False):
	require(split in {"dev", "test"}, "Invalid split")
	require(split != "test" or allow_heldout, "Held-out test requires explicit --allow-heldout")
	rows = [s for s in manifest["samples"] if s["split"] == split]
	require(bool(rows), f"No samples in {split}")
	return rows


def write_private(path, value):
	"""Exclusive creation: never overwrite annotations, audio or an earlier experiment."""
	path = Path(path)
	path.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
	fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
	with os.fdopen(fd, "w", encoding="utf-8") as stream:
		json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
		stream.write("\n")
