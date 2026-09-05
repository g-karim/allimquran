import unittest

from deploy.configure_nginx import configure


class NginxTests(unittest.TestCase):
	def setUp(self):
		self.other = (
			"server {\n listen 443 ssl;\n server_name other.example;\n location / { return 200; }\n}\n"
		)
		self.target = (
			"server {\n listen 443 ssl;\n server_name allim.example;\n location / { return 200; }\n}\n"
		)
		self.redirect = "server {\n listen 80;\n server_name allim.example;\n return 301 https://$host;\n}\n"

	def test_only_target_https_server_changes(self):
		result = configure(
			self.other + self.target + self.redirect, "allim.example", "/etc/nginx/snippets/allim.conf"
		)
		self.assertTrue(result.startswith(self.other))
		self.assertTrue(result.endswith(self.redirect))
		self.assertEqual(result.count("include /etc/nginx/snippets/allim.conf;"), 1)

	def test_idempotent(self):
		result = configure(self.target, "allim.example", "/etc/nginx/snippets/allim.conf")
		self.assertEqual(configure(result, "allim.example", "/etc/nginx/snippets/allim.conf"), result)

	def test_missing_or_ambiguous_site_rejected(self):
		for source in [self.other, self.target + self.target, self.redirect]:
			with self.assertRaises(ValueError):
				configure(source, "allim.example", "/etc/nginx/snippets/allim.conf")

	def test_snippet_injection_rejected(self):
		with self.assertRaises(ValueError):
			configure(self.target, "allim.example", "/bad; return 200;")
