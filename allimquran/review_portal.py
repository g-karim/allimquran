"""Website-only review permissions and private ASR bridge. No audio in Frappe Files."""

import hashlib
import hmac
import json
import secrets
from urllib.parse import quote

import frappe
import requests
from werkzeug.wrappers import Response

ROLE = "ALLIM Recitation Reviewer"
BRIDGE_URL = "http://127.0.0.1:4175/internal/review"


def private_headers():
	frappe.local.response_headers.update(
		{
			"Cache-Control": "private, no-store, max-age=0",
			"Pragma": "no-cache",
			"Vary": "Cookie",
			"X-Robots-Tag": "noindex, nofollow",
			"Referrer-Policy": "no-referrer",
			"X-Content-Type-Options": "nosniff",
		}
	)


def allowed():
	user = frappe.session.user
	# Live DB checks: removing the role/disable takes effect on the next request.
	return bool(
		user != "Guest"
		and frappe.db.get_value("User", user, "enabled")
		and (
			user == "Administrator"
			or frappe.db.exists("Has Role", {"parent": user, "parenttype": "User", "role": ROLE})
		)
	)


def require_reviewer():
	private_headers()
	if not allowed():
		frappe.throw("Доступ только для назначенных проверяющих ALLIM.", frappe.PermissionError)


def ensure_role():
	"""Run on install/migration or explicitly from bench; not a public API."""
	if not frappe.db.exists("Role", ROLE):
		frappe.get_doc({"doctype": "Role", "role_name": ROLE, "desk_access": 0}).insert(
			ignore_permissions=True
		)


def _bridge(action, **kwargs):
	require_reviewer()
	secret = frappe.conf.get("allim_review_secret", "")
	if not isinstance(secret, str) or len(secret) < 64:
		frappe.local.response["http_status_code"] = 503
		return {"error": "Очередь временно недоступна."}
	reviewer = hmac.new(secret.encode(), frappe.session.user.encode(), hashlib.sha256).hexdigest()
	try:
		response = requests.post(
			BRIDGE_URL,
			json={**kwargs, "action": action, "reviewer": reviewer},
			headers={"X-Allim-Review-Key": secret},
			timeout=(2, 15),
			allow_redirects=False,
		)
	except requests.RequestException:
		frappe.local.response["http_status_code"] = 503
		return {"error": "Очередь временно недоступна. Попробуйте позже."}
	if response.status_code != 200:
		status = response.status_code if response.status_code in (404, 409, 413, 422) else 503
		frappe.local.response["http_status_code"] = status
		messages = {
			404: "Запись недоступна: согласие отозвано, истекло или запись удалена.",
			409: "Версия изменилась или нужен другой проверяющий. Обновите запись.",
			413: "Слишком большая разметка.",
			422: "Проверьте текст, итог, ошибки и временные отметки.",
		}
		return {"error": messages.get(status, "Очередь временно недоступна.")}
	if action == "audio":
		return Response(
			response.content,
			mimetype="audio/wav",
			headers={
				"Cache-Control": "private, no-store",
				"X-Content-Type-Options": "nosniff",
			},
		)
	return response.json()


@frappe.whitelist(allow_guest=True, methods=["GET"])
def access():
	private_headers()
	username = None
	if frappe.session.user != "Guest":
		username = frappe.db.get_value("User", frappe.session.user, "username")
	return {
		"allowed": allowed(),
		"profile_url": "/lms/user/" + quote(username, safe="") if username else "/academy",
	}


@frappe.whitelist(methods=["GET"])
def queue(status="pending", offset=0):
	require_reviewer()
	try:
		offset = int(offset)
	except (ValueError, TypeError):
		frappe.throw("Неверная страница очереди.", frappe.ValidationError)
	return _bridge("list", status=status, offset=offset)


@frappe.whitelist(methods=["GET"])
def detail(clip_id):
	return _bridge("detail", id=clip_id)


@frappe.whitelist(methods=["GET"])
def audio(clip_id):
	return _bridge("audio", id=clip_id)


@frappe.whitelist(methods=["POST"])
def save(clip_id, revision, status, annotation):
	require_reviewer()
	# Also enforce CSRF here if a site's generic Frappe CSRF check is disabled.
	expected = frappe.session.data.get("csrf_token")
	provided = frappe.get_request_header("X-Frappe-CSRF-Token") or ""
	if not expected or not secrets.compare_digest(provided, expected):
		frappe.throw("Обновите страницу: проверка безопасности не пройдена.", frappe.PermissionError)
	if isinstance(annotation, str):
		if len(annotation) > 32000:
			frappe.throw("Слишком большая разметка.", frappe.ValidationError)
		try:
			annotation = json.loads(annotation)
		except ValueError:
			frappe.throw("Неверная разметка.", frappe.ValidationError)
	try:
		revision = int(revision)
	except (ValueError, TypeError):
		frappe.throw("Неверная версия записи.", frappe.ValidationError)
	return _bridge("save", id=clip_id, revision=revision, status=status, annotation=annotation)
