"""Offline CPU baseline runner. Audio only reaches the local model, never an API."""

import argparse
import importlib.metadata
import os
import platform
import re
import threading
import time
from pathlib import Path

from .dataset import (
	audio_path,
	digest,
	load_manifest,
	manifest_digest,
	require,
	selected_samples,
	write_private,
)


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("manifest", type=Path)
	parser.add_argument("--output", required=True, type=Path)
	parser.add_argument("--model", default="tarteel-ai/whisper-tiny-ar-quran")
	parser.add_argument("--revision", required=True, help="Immutable 40-character Hugging Face commit")
	parser.add_argument("--split", choices=["dev", "test"], default="dev")
	parser.add_argument("--allow-heldout", action="store_true")
	parser.add_argument("--threads", type=int, default=2)
	args = parser.parse_args()
	require(bool(re.fullmatch(r"[0-9a-f]{40}", args.revision)), "Pin an immutable model revision")
	require(1 <= args.threads <= 4, "CPU threads must be 1..4")
	require(not args.output.exists(), "Output exists; use a new experiment filename")
	manifest = load_manifest(args.manifest)
	samples = selected_samples(manifest, args.split, args.allow_heldout)
	# Never download weights implicitly or send recordings to a third-party service.
	os.environ["HF_HUB_OFFLINE"] = "1"
	os.environ["TRANSFORMERS_OFFLINE"] = "1"
	os.environ["TOKENIZERS_PARALLELISM"] = "false"
	import torch
	from fastapi import HTTPException
	from transformers import pipeline

	from allimquran.asr.audio import transcribe_audio

	torch.set_num_threads(args.threads)
	started = time.monotonic()
	model = pipeline(
		"automatic-speech-recognition",
		model=args.model,
		revision=args.revision,
		device=-1,
		trust_remote_code=False,
	)
	startup_seconds = time.monotonic() - started
	lock = threading.Lock()
	predictions = []
	for index, row in enumerate(samples, 1):
		path = audio_path(args.manifest.parent, row)
		# Detect changed audio again immediately before use.
		require(digest(path) == row["sha256"], "Audio changed during the experiment")
		started = time.monotonic()
		try:
			response = transcribe_audio(str(path), lambda: model, lock)
		except HTTPException as error:
			response = {"status": "error", "transcript": "", "code": error.detail["code"]}
		predictions.append(
			{
				"id": row["id"],
				"audio_sha256": row["sha256"],
				"elapsed_seconds": time.monotonic() - started,
				"response": response,
			}
		)
		print(f"Completed {index}/{len(samples)} ({response['status']})", flush=True)
	write_private(
		args.output,
		{
			"schema_version": 1,
			"manifest_sha256": manifest_digest(manifest),
			"split": args.split,
			"engine": {
				"model": args.model,
				"revision": args.revision,
				"device": "cpu",
				"threads": args.threads,
				"startup_seconds": startup_seconds,
				"pipeline": "allimquran.asr.audio.transcribe_audio",
				"python": platform.python_version(),
				"pipeline_sha256": digest(Path(__file__).resolve().parents[1] / "asr/audio.py"),
				"libraries": {
					name: importlib.metadata.version(name)
					for name in ["torch", "transformers", "numpy", "soundfile"]
				},
			},
			"predictions": predictions,
		},
	)


if __name__ == "__main__":
	main()
