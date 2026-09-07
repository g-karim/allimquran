import frappe
from frappe.sessions import get_csrf_token

from allimquran.review_portal import private_headers, require_reviewer

no_cache = 1
sitemap = 0


def get_context(context):
	private_headers()
	if frappe.session.user == "Guest":
		frappe.local.flags.redirect_location = "/login?redirect-to=%2Fteacher"
		raise frappe.Redirect
	require_reviewer()
	context.no_cache = 1
	context.csrf_token = get_csrf_token()
