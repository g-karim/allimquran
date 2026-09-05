"""Attach the versioned API snippet to exactly one HTTPS site server block.

Run separately for Bench's generated config and the active nginx config.
This tool backs up changed files but does NOT reload nginx. Run nginx -t first.
Reapply after bench setup nginx, which regenerates and removes custom includes.
"""

import argparse
import os
import re
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path


def configure(text, site, snippet):
	if not re.fullmatch(r"[a-zA-Z0-9.-]+", site) or not re.fullmatch(r"/[a-zA-Z0-9/_.-]+", snippet):
		raise ValueError("Expected a literal hostname and absolute snippet path")
	starts = [match.start() for match in re.finditer(r"(?m)^[ \t]*server[ \t]*\{", text)]
	bounds = list(zip(starts, starts[1:] + [len(text)], strict=True))
	targets = []
	for start, end in bounds:
		block = text[start:end]
		match = re.search(r"\bserver_name\s+([^;]+);", block)
		if match and site in match.group(1).split() and re.search(r"\blisten\s+[^;]*\b443\b", block):
			targets.append((start, end, match.end()))
	if len(targets) != 1:
		raise ValueError(f"Expected exactly one HTTPS server for {site}, found {len(targets)}")
	start, end, insertion = targets[0]
	block = text[start:end]
	include = f"\n\t# ALLIM_QURAN_ASR_BEGIN\n\tinclude {snippet};\n\t# ALLIM_QURAN_ASR_END"
	pattern = r"(?ms)^[ \t]*# ALLIM_QURAN_ASR_BEGIN.*?^[ \t]*# ALLIM_QURAN_ASR_END[^\n]*"
	if "ALLIM_QURAN_ASR_BEGIN" in block:
		block, count = re.subn(pattern, lambda _match: include.lstrip("\n"), block)
		if count != 1:
			raise ValueError("Ambiguous or incomplete ALLIM marker block")
	else:
		block = block[:insertion] + include + block[insertion:]
	return text[:start] + block + text[end:]


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("config", type=Path)
	parser.add_argument("--site", required=True)
	parser.add_argument("--snippet", required=True)
	args = parser.parse_args()
	path = args.config.resolve(strict=True)
	original = path.read_text()
	updated = configure(original, args.site, args.snippet)
	if updated == original:
		print(f"Unchanged: {path}")
		return
	stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
	backup = path.with_name(path.name + f".allim-{stamp}.bak")
	shutil.copy2(path, backup)
	stat = path.stat()
	with tempfile.NamedTemporaryFile(
		mode="w", dir=path.parent, prefix=".allim-nginx-", delete=False
	) as output:
		output.write(updated)
		temporary = Path(output.name)
	os.chmod(temporary, stat.st_mode)
	os.chown(temporary, stat.st_uid, stat.st_gid)
	os.replace(temporary, path)
	print(f"Updated: {path}; backup: {backup}. Validate with nginx -t before reload.")


if __name__ == "__main__":
	main()
