"""Parse standalone and inline JavaScript without executing website code."""

import subprocess
from html.parser import HTMLParser
from pathlib import Path


class Scripts(HTMLParser):
	def __init__(self):
		super().__init__(convert_charrefs=False)
		self.active = False
		self.parts = []
		self.scripts = []

	def handle_starttag(self, tag, attrs):
		attrs = dict(attrs)
		if tag == "script":
			self.active = not attrs.get("src") and attrs.get("type", "") in {
				"",
				"text/javascript",
				"application/javascript",
				"module",
			}
			self.parts = []

	def handle_data(self, data):
		if self.active:
			self.parts.append(data)

	def handle_endtag(self, tag):
		if tag == "script" and self.active:
			self.scripts.append("".join(self.parts))
			self.active = False


def main():
	app = Path(__file__).resolve().parents[1] / "allimquran"
	root = app / "website_content"
	count = 0
	for path in sorted(root.rglob("*")):
		if path.suffix == ".js":
			sources = [path.read_text()]
		elif path.suffix == ".html":
			parser = Scripts()
			parser.feed(path.read_text())
			sources = parser.scripts
		else:
			continue
		for index, source in enumerate(sources):
			result = subprocess.run(["node", "--check"], input=source, text=True, capture_output=True)
			if result.returncode:
				raise SystemExit(f"JavaScript syntax error in {path} script {index}:\n{result.stderr}")
			count += 1
	for path in (app / "allim_quran" / "page").rglob("*.js"):
		subprocess.run(["node", "--check", str(path)], check=True)
		count += 1
	for path in (app / "public" / "js").rglob("*.js"):
		subprocess.run(["node", "--check", str(path)], check=True)
		count += 1
	print(f"JavaScript syntax OK: {count} standalone/inline scripts")


if __name__ == "__main__":
	main()
