"""Paired regressions only; never rank runs on different datasets or subsets."""

from .dataset import require


def compare(before, after):
	for key in ("schema_version", "manifest_sha256", "split", "normalization"):
		require(before.get(key) == after.get(key) and key in before, f"Incompatible reports: {key}")
	old = {row["id"]: row for row in before["cases"]}
	new = {row["id"]: row for row in after["cases"]}
	require(
		set(old) == set(new) and len(old) == len(before["cases"]) == len(after["cases"]),
		"Different or duplicate case sets cannot be compared",
	)
	changes, regressions = (
		[],
		{
			"new_false_accepts": 0,
			"new_false_mismatches": 0,
			"correct_matches_lost": 0,
			"new_technical_failures": 0,
		},
	)
	for identifier in sorted(old):
		left, right = old[identifier], new[identifier]
		for key in ("verdict", "has_word_error", "has_phonetic_error", "kind", "duration_seconds"):
			require(left[key] == right[key], "Ground truth changed between reports")
		a, b = left["assessment"], right["assessment"]
		word_error = right["verdict"] == "incorrect" and right["has_word_error"]
		correct = right["verdict"] == "correct"
		regressions["new_false_accepts"] += word_error and b == "matched" and a != "matched"
		regressions["new_false_mismatches"] += correct and b == "mismatch" and a != "mismatch"
		regressions["correct_matches_lost"] += correct and a == "matched" and b != "matched"
		regressions["new_technical_failures"] += b == "technical_error" and a != "technical_error"
		if a != b or left["wer"] != right["wer"]:
			changes.append(
				{
					"id": identifier,
					"before": a,
					"after": b,
					"wer_edits_before": sum(
						left["wer"][k] for k in ("substitutions", "deletions", "insertions")
					),
					"wer_edits_after": sum(
						right["wer"][k] for k in ("substitutions", "deletions", "insertions")
					),
				}
			)
	return {
		"schema_version": 1,
		"manifest_sha256": before["manifest_sha256"],
		"split": before["split"],
		"before_engine": before["engine"],
		"after_engine": after["engine"],
		"assessment_core_changed": before["assessment_core_sha256"] != after["assessment_core_sha256"],
		"regressions": regressions,
		"changed_cases": changes,
		"before_summary": before["summary"],
		"after_summary": after["summary"],
		"note": "Compare latency on equivalent hardware, runtime, threads and load. No automatic winner.",
	}
