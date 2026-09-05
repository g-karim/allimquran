import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch


class TemplatePageStub:
	def can_render(self):
		return True

	def update_context(self):
		self.context = SimpleNamespace(meta={"title": "Courses"}, boot={"lang": "en"})

	def setup_template_source(self):
		self.original_source = self.source = "upstream template"


class LMSRendererTests(unittest.TestCase):
	def setUp(self):
		self.frappe = SimpleNamespace(form_dict={"app_path": "courses"})
		self.builder = Mock(return_value={"title": "ALLIM courses"})
		spec = importlib.util.spec_from_file_location("tested_renderer", Path("allimquran/lms_renderer.py"))
		self.module = importlib.util.module_from_spec(spec)
		with patch.dict(
			sys.modules,
			{
				"frappe": self.frappe,
				"frappe.website.page_renderers.template_page": SimpleNamespace(TemplatePage=TemplatePageStub),
				"allimquran.search_intelligence": SimpleNamespace(build_lms_seo_context=self.builder),
			},
		):
			spec.loader.exec_module(self.module)
		self.renderer = self.module.AllimLMSPage()

	def test_only_upstream_lms_endpoint_is_claimed(self):
		for path, app, expected in (("_lms", "lms", True), ("home", "lms", False), ("_lms", "other", False)):
			self.renderer.path, self.renderer.app = path, app
			self.assertEqual(self.renderer.can_render(), expected)

	def test_upstream_context_is_extended(self):
		self.renderer.update_context()
		self.builder.assert_called_once_with("courses", {"title": "Courses"}, {"lang": "en"})
		self.assertEqual(self.renderer.context.seo, {"title": "ALLIM courses"})

	def test_modified_source_is_used_by_frappe(self):
		with patch.object(self.module, "with_search_layer", return_value="app template"):
			self.renderer.setup_template_source()
		self.assertEqual(self.renderer.original_source, "upstream template")
		self.assertEqual(self.renderer.source, "app template")
