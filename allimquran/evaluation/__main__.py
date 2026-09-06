"""Validate and score private corpora; no model downloads or network requests."""

import argparse
import json
from pathlib import Path

from .compare import compare
from .dataset import load_manifest, manifest_digest, selected_samples, write_private
from .metrics import evaluate


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	sub = parser.add_subparsers(dest="command", required=True)
	validate = sub.add_parser("validate")
	validate.add_argument("manifest", type=Path)
	validate.add_argument("--metadata-only", action="store_true")
	score = sub.add_parser("score")
	score.add_argument("manifest", type=Path)
	score.add_argument("predictions", type=Path)
	score.add_argument("--split", choices=["dev", "test"], default="dev")
	score.add_argument("--allow-heldout", action="store_true")
	score.add_argument("--output", type=Path, required=True)
	paired = sub.add_parser("compare")
	paired.add_argument("before", type=Path)
	paired.add_argument("after", type=Path)
	paired.add_argument("--output", type=Path, required=True)
	args = parser.parse_args()
	if args.command == "compare":
		report = compare(json.loads(args.before.read_text()), json.loads(args.after.read_text()))
		write_private(args.output, report)
		print(json.dumps(report["regressions"]))
		return
	manifest = load_manifest(args.manifest, check_audio=not getattr(args, "metadata_only", False))
	if args.command == "validate":
		print(
			json.dumps(
				{
					"samples": len(manifest["samples"]),
					"manifest_sha256": manifest_digest(manifest),
					"audio_checked": not args.metadata_only,
				}
			)
		)
	else:
		selected_samples(manifest, args.split, args.allow_heldout)
		run = json.loads(args.predictions.read_text())
		report = evaluate(manifest, run, split=args.split, allow_heldout=args.allow_heldout)
		write_private(args.output, report)
		print(
			json.dumps(
				{"summary": report["summary"], "learner_summary": report["learner_summary"]},
				ensure_ascii=False,
			)
		)


if __name__ == "__main__":
	main()
