"""Local browser harness: actual page assets + real isolated Frappe API.

This avoids installing LMS solely to test personal storage. It does not stand in
for a complete website deployment. Never point this at a production site's DB.
"""

import argparse
import mimetypes
import os
from pathlib import Path


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--sites", type=Path, required=True)
	parser.add_argument("--site", required=True)
	parser.add_argument("--port", type=int, default=18133)
	args = parser.parse_args()
	if not args.site.endswith(".localhost"):
		parser.error("The harness only accepts a .localhost fixture site")
	os.chdir(args.sites)
	from frappe.app import application
	from werkzeug.serving import run_simple
	from werkzeug.wrappers import Response

	root = Path(__file__).resolve().parents[1] / "allimquran"

	def app(environ, start_response):
		path = environ.get("PATH_INFO", "")
		if path in ("/learn", "/academy", "/home"):
			page = root / "website_content" / "pages" / path[1:]
			css = next(page.glob("*.css")).read_text()
			content = page.joinpath("main_section_html.html").read_text()
			javascript = page.joinpath("javascript.js").read_text()
			html = (
				'<!doctype html><html lang="ru"><head><meta charset="utf-8">'
				'<meta name="viewport" content="width=device-width,initial-scale=1"><style>'
			)
			html += css + "</style></head><body>" + content
			html += "<script>" + javascript + "</script></body></html>"
			return Response(html, content_type="text/html; charset=utf-8")(environ, start_response)
		if path == "/storage-harness":
			html = '<!doctype html><html lang="ru"><body><div id="fixture"></div>'
			for name in ("account-storage", "account-progress", "account-import"):
				html += f'<script src="/assets/allimquran/js/{name}.js"></script>'
			html += "<script>window.fixtureReady=AllimStorage.open();</script></body></html>"
			return Response(html, content_type="text/html; charset=utf-8")(environ, start_response)
		if path.startswith("/assets/allimquran/"):
			public = root / "public"
			file = public.joinpath(path.removeprefix("/assets/allimquran/")).resolve()
			if file.is_relative_to(public) and file.is_file():
				return Response(
					file.read_bytes(),
					content_type=mimetypes.guess_type(file.name)[0] or "application/octet-stream",
				)(environ, start_response)
		environ["HTTP_X_FRAPPE_SITE_NAME"] = args.site
		return application(environ, start_response)

	run_simple("127.0.0.1", args.port, app, threaded=True, use_reloader=False)


if __name__ == "__main__":
	main()
