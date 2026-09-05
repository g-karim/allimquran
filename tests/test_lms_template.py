import re
import unittest

from allimquran.lms_template import with_search_layer

UPSTREAM = """<html><head><link rel="icon" href="/icon.png">
<meta name="viewport" content="width=device-width">
<title>{{ title | e }}</title>
<meta name="description" content="{{ meta.description | e }}">
<meta name="twitter:description" content="{{ meta.description | e }}">
<script type="module" src="/assets/lms/frontend/assets/index-NEW.js"></script>
<link rel="stylesheet" href="/assets/lms/frontend/assets/index-NEW.css">
</head><body><div id="app"><div id="seo-content"><h1>{{ meta.title | e }}</h1></div></div>
<script>document.getElementById('seo-content').style.display = 'none';</script>
<script>window.boot = {{ boot | tojson }};</script></body></html>"""


class LMSTemplateTests(unittest.TestCase):
	def test_upstream_build_assets_and_boot_are_preserved(self):
		result = with_search_layer(UPSTREAM)
		for marker in (
			"/assets/lms/frontend/assets/index-NEW.js",
			"/assets/lms/frontend/assets/index-NEW.css",
			"window.boot = {{ boot | tojson }};",
			'<meta name="viewport" content="width=device-width">',
			'<link rel="icon" href="/icon.png">',
		):
			self.assertIn(marker, result)
		self.assertIn("{{ seo.fallback_html | safe }}", result)
		self.assertIn("{{ seo.canonical | e }}", result)
		self.assertNotIn("style.display", result)
		self.assertEqual(len(re.findall(r"<title>", result)), 1)
		self.assertEqual(len(re.findall(r'name="description"', result)), 1)

	def test_legacy_live_template_can_be_adopted_without_duplicate_tags(self):
		once = with_search_layer(UPSTREAM)
		twice = with_search_layer(once)
		self.assertEqual(re.sub(r"\s+", " ", once), re.sub(r"\s+", " ", twice))

	def test_unknown_upstream_layout_is_rejected(self):
		for source in ("<html></html>", UPSTREAM.replace('id="seo-content"', 'id="changed"')):
			with self.assertRaisesRegex(ValueError, "Unsupported LMS template"):
				with_search_layer(source)
