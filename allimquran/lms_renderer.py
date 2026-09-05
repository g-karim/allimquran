"""Site-local LMS renderer; leaves upstream code and generated builds untouched."""

import frappe
from frappe.website.page_renderers.template_page import TemplatePage

from allimquran.lms_template import with_search_layer
from allimquran.search_intelligence import build_lms_seo_context


class AllimLMSPage(TemplatePage):
	def can_render(self):
		return self.path == "_lms" and getattr(self, "app", None) == "lms" and super().can_render()

	def update_context(self):
		super().update_context()
		self.context.seo = build_lms_seo_context(
			frappe.form_dict.get("app_path"), self.context.meta, self.context.boot
		)

	def setup_template_source(self):
		super().setup_template_source()
		# Keep original_source unchanged so Frappe renders the transformed string.
		self.source = with_search_layer(self.source)
