"""Prepare user-supplied reference audio privately, without inventing verse timestamps.

Writes a review queue, NOT a scored evaluation manifest. A listener must verify
the spoken text (including isti'adhah/basmala), verse ranges and pause boundaries.
"""

import argparse
import subprocess
from pathlib import Path

import numpy as np

from allimquran.asr.audio import SAMPLE_RATE, split_at_pauses
from allimquran.evaluation.dataset import digest, require, write_private
from scripts.prepare_recognition_pilot import write_wav


def prepare(sources, root):
	root = root.resolve()
	require(".eval-data" in root.parts, "Use a private .eval-data directory")
	root.mkdir(mode=0o700, parents=True, exist_ok=False)
	(root / "audio").mkdir(mode=0o700)
	rows = []
	for source in sources:
		source = source.resolve(strict=True)
		require(source.stem.isdigit(), "Use numbered surah files")
		surah = int(source.stem)
		require(1 <= surah <= 114, "Surah number must be 1..114")
		require(source.stat().st_size <= 50 * 1024 * 1024, "Reference too large")
		pcm = subprocess.run(
			[
				"ffmpeg",
				"-nostdin",
				"-v",
				"error",
				"-protocol_whitelist",
				"file,pipe",
				"-i",
				str(source),
				"-map",
				"0:a:0",
				"-ac",
				"1",
				"-ar",
				str(SAMPLE_RATE),
				"-t",
				"1801",
				"-f",
				"s16le",
				"pipe:1",
			],
			capture_output=True,
			check=True,
			timeout=60,
		).stdout
		require(0 < len(pcm) <= 1800 * SAMPLE_RATE * 2, "Expected at most 30 minutes of audio")
		samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768
		segments = split_at_pauses(samples)
		start = 0
		clips = []
		for index, segment in enumerate(segments):
			end = start + len(segment)
			name = f"husary-{surah:03d}-{index + 1:03d}"
			path = root / "audio" / f"{name}.wav"
			write_wav(path, pcm[start * 2 : end * 2])
			clips.append(
				{
					"id": name,
					"audio": f"audio/{name}.wav",
					"sha256": digest(path),
					"start_seconds": start / SAMPLE_RATE,
					"end_seconds": end / SAMPLE_RATE,
					"duration_seconds": len(segment) / SAMPLE_RATE,
					"needs_shorter_boundary": len(segment) > 60 * SAMPLE_RATE,
					"annotation_status": "pending",
					"spoken_text": None,
					"verse_keys": None,
				}
			)
			start = end
		rows.append(
			{
				"source_name": source.name,
				"source_sha256": digest(source),
				"speaker_id": "husary",
				"recording_group": f"husary-user-reference-{surah:03d}",
				"surah_number_from_filename": surah,
				"duration_seconds": len(samples) / SAMPLE_RATE,
				"kind": "reference",
				"correctness_basis": "User-supplied correct Husary recitation; pending listening review",
				"redistribution_allowed": False,
				"training_allowed": False,
				"clips": clips,
			}
		)
	write_private(root / "review-queue.json", {"schema_version": 1, "sources": rows})
	return {
		"sources": len(rows),
		"clips": sum(len(row["clips"]) for row in rows),
		"seconds": sum(row["duration_seconds"] for row in rows),
		"long_clips": sum(clip["needs_shorter_boundary"] for row in rows for clip in row["clips"]),
	}


if __name__ == "__main__":
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--output", type=Path, required=True)
	parser.add_argument("sources", nargs="+", type=Path)
	args = parser.parse_args()
	print(prepare(args.sources, args.output))
