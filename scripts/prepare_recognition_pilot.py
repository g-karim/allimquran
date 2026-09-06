"""Create PRIVATE engineering controls, not a teacher-reviewed learner benchmark.

Downloads six explicitly selected public EveryAyah references only when requested.
Their reuse/publication rights are not inferred from public availability. Never
commit recordings, derived audio or generated transcripts to the source repository.
"""

import argparse
import subprocess
import urllib.request
import wave
from pathlib import Path

from allimquran.evaluation.dataset import digest, require, write_private

REFERENCES = {
	"001001": "بسم الله الرحمن الرحيم",
	"001005": "إياك نعبد وإياك نستعين",
	"112004": "ولم يكن له كفوا أحد",
}
RECITERS = {"husary": "Husary_128kbps", "alafasy": "Alafasy_128kbps"}
RATE = 16000


def write_wav(path, pcm):
	with path.open("xb") as file:
		path.chmod(0o600)
		with wave.open(file, "wb") as audio:
			audio.setnchannels(1)
			audio.setsampwidth(2)
			audio.setframerate(RATE)
			audio.writeframes(pcm)


def create(root):
	root = Path(root)
	root.mkdir(mode=0o700, parents=True, exist_ok=False)
	(root / "audio").mkdir(mode=0o700)
	samples = []

	def add(identifier, speaker, pcm, expected, spoken, verdict, *, kind="synthetic_control", errors=None):
		path = root / "audio" / f"{identifier}.wav"
		write_wav(path, pcm)
		samples.append(
			{
				"id": identifier,
				"speaker_id": speaker,
				"recording_group": speaker + "-pilot",
				"split": "dev",
				"kind": kind,
				"audio": f"audio/{identifier}.wav",
				"sha256": digest(path),
				"duration_seconds": len(pcm) / (RATE * 2),
				"tags": [identifier.split("-")[0]],
				"metadata": {
					"native_language": "not_collected",
					"device": "public_reference",
					"noise": "reference",
					"pace": "reference",
					"riwayah": "hafs_reference_not_teacher_verified",
				},
				"rights": {
					"evaluation_allowed": True,
					"redistribution_allowed": False,
					"basis": (
						"Public EveryAyah reference; local checks only; no redistribution license asserted"
					),
				},
				"annotation": {
					"status": "reference",
					"reviewer_ids": [],
					"disputed": False,
					"expected_words": expected.split(),
					"spoken_text": spoken,
					"verdict": verdict,
					"errors": errors or [],
				},
			}
		)

	for speaker, folder in RECITERS.items():
		pcm_by_key = {}
		for key, expected in REFERENCES.items():
			url = f"https://everyayah.com/data/{folder}/{key}.mp3"
			with urllib.request.urlopen(url, timeout=45) as response:
				data = response.read(2_000_001)
			require(len(data) <= 2_000_000, "Unexpectedly large reference download")
			pcm = subprocess.run(
				[
					"ffmpeg",
					"-nostdin",
					"-v",
					"error",
					"-protocol_whitelist",
					"file,pipe",
					"-i",
					"pipe:0",
					"-vn",
					"-ac",
					"1",
					"-ar",
					str(RATE),
					"-f",
					"s16le",
					"pipe:1",
				],
				input=data,
				capture_output=True,
				check=True,
				timeout=30,
			).stdout
			pcm_by_key[key] = pcm
			add(f"reference-{speaker}-{key}", speaker, pcm, expected, expected, "correct", kind="reference")
			samples[-1]["source_url"] = url
		keys = list(REFERENCES)
		for index, key in enumerate(keys):
			expected = REFERENCES[keys[(index + 1) % len(keys)]]
			add(
				f"wrongverse-{speaker}-{key}",
				speaker,
				pcm_by_key[key],
				expected,
				REFERENCES[key],
				"incorrect",
				errors=[
					{
						"kind": "substitution",
						"expected_index": 0,
						"start_ms": 0,
						"end_ms": len(pcm_by_key[key]) / (RATE * 2) * 1000,
					}
				],
			)
		pause = bytes(int(RATE * 0.6) * 2)
		first, last = pcm_by_key["001005"], pcm_by_key["112004"]
		add(
			f"insertion-{speaker}",
			speaker,
			last + pause + first,
			REFERENCES["001005"],
			REFERENCES["112004"] + " " + REFERENCES["001005"],
			"incorrect",
			errors=[
				{
					"kind": "insertion",
					"expected_index": 0,
					"start_ms": 0,
					"end_ms": len(last) / (RATE * 2) * 1000,
				}
			],
		)
		add(
			f"repeat-{speaker}",
			speaker,
			first + pause + first,
			REFERENCES["001005"],
			(REFERENCES["001005"] + " ") * 2,
			"correct",
		)
		basmala = pcm_by_key["001001"]
		for name, pcm in [("long-unbroken", basmala * 6), ("long-paused", (basmala + pause) * 6)]:
			add(
				f"{name}-{speaker}",
				speaker,
				pcm,
				REFERENCES["001001"],
				(REFERENCES["001001"] + " ") * 6,
				"correct",
			)
	add("silence-control", "synthetic-silence", bytes(RATE * 2 * 2), REFERENCES["001001"], "", "unscorable")
	manifest = {"schema_version": 1, "dataset_id": "engineering-pilot-v1", "samples": samples}
	write_private(root / "manifest.json", manifest)
	return manifest


if __name__ == "__main__":
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("output", type=Path, help="New private directory, e.g. .eval-data/pilot-v1")
	parser.add_argument("--download-public-references", action="store_true", required=True)
	args = parser.parse_args()
	print(f"Created {len(create(args.output)['samples'])} engineering controls; zero learner recordings")
