"""Apply the ALLIM search layer to the current LMS build, without editing LMS."""

import re
from pathlib import Path

HEAD = Path(__file__).parent / "templates" / "includes" / "lms_search_head.html"
LEGACY_HEAD = r"<!-- ALLIM SEARCH HEAD START -->.*?<!-- ALLIM SEARCH HEAD END -->"
UPSTREAM_HEAD = r"<title>.*?</title>\s*(?:<meta\b[^>]*>\s*)+"
FALLBACK = r'(<div id="seo-content">).*?(</div>)'
HIDE_FALLBACK = (
	r"<script>\s*document\.getElementById\(['\"]seo-content['\"]\)"
	r"\.style\.display\s*=\s*['\"]none['\"];?\s*</script>"
)


def with_search_layer(source):
	"""Preserve LMS assets/boot code and fail closed if its template contract changes."""
	pattern = LEGACY_HEAD if "<!-- ALLIM SEARCH HEAD START -->" in source else UPSTREAM_HEAD
	source, heads = re.subn(pattern, lambda _match: HEAD.read_text().strip() + "\n", source, flags=re.S)
	source, bodies = re.subn(
		FALLBACK,
		lambda match: match[1] + "{{ seo.fallback_html | safe }}" + match[2],
		source,
		flags=re.S,
	)
	if heads != 1 or bodies != 1:
		raise ValueError(
			"Unsupported LMS template: expected one metadata block and one seo-content container"
		)
	return re.sub(HIDE_FALLBACK, "", source)
