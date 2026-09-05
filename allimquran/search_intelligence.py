from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from html.parser import HTMLParser
from urllib.parse import quote, urljoin

import frappe
from frappe import _
from frappe.utils import cint, now_datetime, nowdate
from frappe.utils.data import escape_html

SITE_URL = "https://allimquran.com"
BRAND = "ALLIM Qur’an"
INDEX_ROBOTS = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
NOINDEX_ROBOTS = "noindex,nofollow,noarchive"
MANAGER_ROLES = {"System Manager", "Website Manager"}
AUDIT_DOCTYPE = "ALLIM Search Audit"
PROMPT_DOCTYPE = "ALLIM Search Prompt"
OBSERVATION_DOCTYPE = "ALLIM Search Observation"
OPPORTUNITY_DOCTYPE = "ALLIM Search Opportunity"


class SearchHTMLParser(HTMLParser):
	def __init__(self) -> None:
		super().__init__(convert_charrefs=True)
		self.title_parts: list[str] = []
		self.headings: list[tuple[str, str]] = []
		self.meta: dict[str, str] = {}
		self.links: list[dict[str, str]] = []
		self.schemas: list[str] = []
		self.body_parts: list[str] = []
		self._capture_title = False
		self._capture_heading: str | None = None
		self._capture_schema = False
		self._buffer: list[str] = []
		self._in_body = False

	def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
		values = {key.lower(): value or "" for key, value in attrs}
		lowered = tag.lower()
		if lowered == "title":
			self._capture_title = True
		elif lowered in {"h1", "h2", "h3"}:
			self._capture_heading = lowered
			self._buffer = []
		elif lowered == "meta":
			key = (values.get("name") or values.get("property") or "").lower()
			if key:
				self.meta[key] = values.get("content", "").strip()
		elif lowered == "link":
			self.links.append(values)
		elif lowered == "script" and values.get("type", "").lower() == "application/ld+json":
			self._capture_schema = True
			self._buffer = []
		elif lowered == "body":
			self._in_body = True

	def handle_endtag(self, tag: str) -> None:
		lowered = tag.lower()
		if lowered == "title":
			self._capture_title = False
		elif self._capture_heading == lowered:
			self.headings.append((lowered, _clean_text(" ".join(self._buffer))))
			self._capture_heading = None
			self._buffer = []
		elif lowered == "script" and self._capture_schema:
			self.schemas.append("".join(self._buffer).strip())
			self._capture_schema = False
			self._buffer = []
		elif lowered == "body":
			self._in_body = False

	def handle_data(self, data: str) -> None:
		if self._capture_title:
			self.title_parts.append(data)
		if self._capture_heading or self._capture_schema:
			self._buffer.append(data)
		if self._in_body and not self._capture_schema:
			self.body_parts.append(data)


def _clean_text(value: str | None) -> str:
	return re.sub(r"\s+", " ", html.unescape(value or "")).strip()


def _plain_html(value: str | None) -> str:
	return _clean_text(re.sub(r"<[^>]+>", " ", value or ""))


def _absolute_url(value: str | None, fallback: str = "") -> str:
	return urljoin(SITE_URL + "/", (value or fallback).strip())


def _route_meta(app_path: str) -> dict[str, str]:
	rows = frappe.get_all(
		"Website Meta Tag",
		filters={"parent": app_path, "parenttype": "Website Route Meta"},
		fields=["key", "value"],
	)
	return {row.key: row.value for row in rows if row.key}


def _is_demo_course(course: frappe._dict | None) -> bool:
	if not course:
		return False
	tags = {item.strip().lower() for item in (course.get("tags") or "").split(",") if item.strip()}
	return bool(tags.intersection({"demo", "sample", "example"}))


def _course_record(course_name: str) -> frappe._dict | None:
	return frappe.db.get_value(
		"LMS Course",
		course_name,
		[
			"name",
			"title",
			"description",
			"short_introduction",
			"image",
			"tags",
			"category",
			"published",
			"status",
			"lessons",
			"enrollments",
			"rating",
		],
		as_dict=True,
	)


def _published_courses() -> list[frappe._dict]:
	courses = frappe.get_all(
		"LMS Course",
		filters={"published": 1},
		fields=[
			"name",
			"title",
			"description",
			"short_introduction",
			"image",
			"tags",
			"category",
			"status",
			"lessons",
			"enrollments",
			"rating",
		],
		order_by="featured desc, published_on desc, modified desc",
	)
	return [course for course in courses if not _is_demo_course(course)]


def build_lms_seo_context(app_path: str | None, meta: frappe._dict, boot: frappe._dict) -> frappe._dict:
	"""Build the server-rendered search layer for the public learning routes."""
	path = (app_path or "").strip("/")
	route = "/lms" + (f"/{path}" if path else "")
	route_tags = _route_meta(path)
	language = (boot.get("lang") or "en").split("-")[0]
	page_title = _clean_text(route_tags.get("title") or meta.get("title") or BRAND)
	title = page_title if BRAND.lower() in page_title.lower() else f"{page_title} | {BRAND}"
	description = _clean_text(route_tags.get("description") or meta.get("description"))
	image = _absolute_url(
		route_tags.get("image") or meta.get("image"), "/assets/allimquran/media/allim-brand-icon.png"
	)
	robots = route_tags.get("robots") or INDEX_ROBOTS
	schema_graph: list[dict[str, object]] = []
	fallback_items: list[str] = []

	if path == "courses":
		courses = _published_courses()
		description = (
			description
			or "Structured Qur’an learning paths for recitation, memorisation, "
			"Qur’anic Arabic and guided study with ALLIM."
		)
		items = []
		for position, course in enumerate(courses, start=1):
			course_url = f"{SITE_URL}/lms/courses/{course.name}"
			items.append({"@type": "ListItem", "position": position, "url": course_url, "name": course.title})
			fallback_items.append(
				f'<li><a href="/lms/courses/{escape_html(course.name)}">{escape_html(course.title)}</a>'
				f"<p>{escape_html(_plain_html(course.short_introduction or course.description)[:320])}"
				"</p></li>"
			)
		schema_graph.append(
			{
				"@type": "CollectionPage",
				"@id": f"{SITE_URL}{route}#page",
				"url": f"{SITE_URL}{route}",
				"name": page_title,
				"description": description,
				"inLanguage": language,
				"isPartOf": {"@id": f"{SITE_URL}/#website"},
				"mainEntity": {"@type": "ItemList", "numberOfItems": len(items), "itemListElement": items},
			}
		)
		fallback_html = (
			f'<main class="allim-search-fallback" id="main-content"><h1>{escape_html(page_title)}</h1>'
			f"<p>{escape_html(description)}</p><ul>{''.join(fallback_items)}</ul></main>"
		)
	elif re.fullmatch(r"courses/[^/]+", path):
		course_name = path.split("/", 1)[1]
		course = _course_record(course_name)
		if not course or not cint(course.published) or _is_demo_course(course):
			robots = NOINDEX_ROBOTS
		if course:
			description = _clean_text(
				route_tags.get("description") or course.short_introduction or _plain_html(course.description)
			)[:320]
			page_title = _clean_text(route_tags.get("title") or course.title)
			title = page_title if BRAND.lower() in page_title.lower() else f"{page_title} | {BRAND}"
			image = _absolute_url(
				route_tags.get("image") or course.image, "/assets/allimquran/media/allim-brand-icon.png"
			)
			if robots.startswith("index"):
				course_schema: dict[str, object] = {
					"@type": "Course",
					"@id": f"{SITE_URL}{route}#course",
					"url": f"{SITE_URL}{route}",
					"name": page_title,
					"description": description,
					"inLanguage": language,
					"provider": {"@type": "Organization", "name": BRAND, "url": SITE_URL + "/"},
					"isAccessibleForFree": not bool(
						frappe.db.get_value("LMS Course", course_name, "paid_course")
					),
				}
				if image:
					course_schema["image"] = image
				if course.category:
					course_schema["about"] = course.category
				schema_graph.append(course_schema)
			fallback_html = (
				f'<main class="allim-search-fallback" id="main-content"><h1>{escape_html(page_title)}</h1>'
				f'<p>{escape_html(description)}</p><a href="/lms/courses">All courses</a></main>'
			)
		else:
			fallback_html = '<main class="allim-search-fallback"><h1>Course</h1></main>'
	else:
		robots = NOINDEX_ROBOTS
		fallback_html = f'<main class="allim-search-fallback"><h1>{escape_html(page_title)}</h1></main>'

	schema_graph.append(
		{
			"@type": "BreadcrumbList",
			"itemListElement": [
				{"@type": "ListItem", "position": 1, "name": BRAND, "item": SITE_URL + "/"},
				{"@type": "ListItem", "position": 2, "name": page_title, "item": f"{SITE_URL}{route}"},
			],
		}
	)
	return frappe._dict(
		{
			"title": title,
			"description": description,
			"image": image,
			"canonical": f"{SITE_URL}{route}",
			"robots": robots,
			"og_type": "website",
			"language": language,
			"json_ld": json.dumps(
				{"@context": "https://schema.org", "@graph": schema_graph},
				ensure_ascii=False,
				separators=(",", ":"),
			),
			"fallback_html": fallback_html,
		}
	)


def extend_website_context(context: frappe._dict) -> None:
	"""Add public learning routes to the standard XML sitemap."""
	if str(context.get("path") or "").strip("/") != "sitemap.xml" or "links" not in context:
		return
	links = list(context.links or [])
	existing = {str(item.get("loc") or "").rstrip("/") for item in links}

	def append(route: str, lastmod: str) -> None:
		location = f"{SITE_URL}/{quote(route.strip('/'))}" if route.strip("/") else SITE_URL + "/"
		if location.rstrip("/") not in existing:
			links.append({"loc": location, "lastmod": lastmod})
			existing.add(location.rstrip("/"))

	append("lms/courses", nowdate())
	courses = frappe.get_all(
		"LMS Course",
		filters={"published": 1},
		fields=["name", "tags", "modified"],
	)
	for course in courses:
		if not _is_demo_course(course):
			append(f"lms/courses/{course.name}", f"{course.modified:%Y-%m-%d}")
	context.links = links


def _require_manager() -> None:
	if frappe.session.user == "Guest" or not MANAGER_ROLES.intersection(set(frappe.get_roles())):
		frappe.throw(_("You are not permitted to manage search intelligence."), frappe.PermissionError)


def _discover_routes() -> list[dict[str, str]]:
	routes: list[dict[str, str]] = []
	seen: set[str] = set()

	def add(route: str, page_type: str, locale: str = "en") -> None:
		normalized = "/" + route.strip("/") if route.strip("/") else "/"
		if normalized not in seen:
			seen.add(normalized)
			routes.append({"route": normalized, "page_type": page_type, "locale": locale})

	for page in frappe.get_all("Web Page", filters={"published": 1}, fields=["route"]):
		locale = page.route.split("/", 1)[0] if page.route.startswith(("ar/", "ru/", "tr/")) else "en"
		add(page.route, "Web Page", locale)
	add("/lms/courses", "Course collection", "en")
	for course in _published_courses():
		add(f"/lms/courses/{course.name}", "Course", "en")
	return routes


def _fetch(route: dict[str, str]) -> dict[str, object]:
	url = SITE_URL + route["route"]
	request = urllib.request.Request(
		url, headers={"User-Agent": "ALLIM-Search-Intelligence/1.0 (+https://allimquran.com/)"}
	)
	try:
		with urllib.request.urlopen(request, timeout=18) as response:
			body = response.read(2_500_000).decode(
				response.headers.get_content_charset() or "utf-8", errors="replace"
			)
			return {
				**route,
				"url": url,
				"http_status": response.status,
				"html": body,
				"headers": dict(response.headers),
			}
	except urllib.error.HTTPError as error:
		body = error.read(500_000).decode("utf-8", errors="replace")
		return {**route, "url": url, "http_status": error.code, "html": body, "headers": dict(error.headers)}
	except Exception as error:
		return {**route, "url": url, "http_status": 0, "html": "", "error": str(error), "headers": {}}


def _schema_types(schemas: list[str]) -> set[str]:
	types: set[str] = set()
	for source in schemas:
		try:
			payload = json.loads(source)
		except (TypeError, json.JSONDecodeError):
			continue
		stack = [payload]
		while stack:
			item = stack.pop()
			if isinstance(item, dict):
				value = item.get("@type")
				if isinstance(value, str):
					types.add(value)
				elif isinstance(value, list):
					types.update(str(entry) for entry in value)
				stack.extend(item.values())
			elif isinstance(item, list):
				stack.extend(item)
	return types


def _audit_fetched(item: dict[str, object]) -> dict[str, object]:
	parser = SearchHTMLParser()
	parser.feed(str(item.get("html") or ""))
	title = _clean_text(" ".join(parser.title_parts))
	description = parser.meta.get("description", "")
	robots = parser.meta.get("robots", "")
	canonical = next(
		(link.get("href", "") for link in parser.links if "canonical" in link.get("rel", "").lower().split()),
		"",
	)
	alternates = [
		link
		for link in parser.links
		if "alternate" in link.get("rel", "").lower().split() and link.get("hreflang")
	]
	schema_types = _schema_types(parser.schemas)
	body_text = _clean_text(" ".join(parser.body_parts))
	html_lang = re.search(r"<html[^>]+lang=[\"']([^\"']+)", str(item.get("html") or ""), re.I)
	html_dir = re.search(r"<html[^>]+dir=[\"']([^\"']+)", str(item.get("html") or ""), re.I)
	h1 = [text for tag, text in parser.headings if tag == "h1" and text]
	issues: list[dict[str, str]] = []
	score = 0

	def rule(
		ok: bool, points: int, code: str, channel: str, priority: str, message: str, recommendation: str
	) -> None:
		nonlocal score
		if ok:
			score += points
		else:
			issues.append(
				{
					"code": code,
					"channel": channel,
					"priority": priority,
					"message": message,
					"recommendation": recommendation,
				}
			)

	status = int(item.get("http_status") or 0)
	rule(
		status == 200,
		8,
		"http",
		"SEO",
		"Critical",
		f"HTTP status is {status or 'unavailable'}.",
		"Restore a public 200 response.",
	)
	rule(
		bool(title) and 18 <= len(title) <= 68,
		9,
		"title",
		"SEO",
		"High",
		"Title is missing or outside the useful length range.",
		"Use a unique, intent-specific title of roughly 18–68 characters.",
	)
	rule(
		70 <= len(description) <= 320,
		9,
		"description",
		"SEO",
		"High",
		"Meta description is missing or weak.",
		"Write a specific summary that answers the page intent without generic claims.",
	)
	rule(
		bool(canonical) and canonical.rstrip("/") == str(item["url"]).rstrip("/"),
		10,
		"canonical",
		"SEO",
		"Critical",
		"Self-referencing canonical is missing or incorrect.",
		"Publish one absolute canonical URL matching the public route.",
	)
	rule(
		bool(robots),
		4,
		"robots",
		"SEO",
		"Medium",
		"Robots directive is implicit.",
		"Declare an explicit index/follow or noindex policy.",
	)
	rule(
		len(h1) == 1,
		8,
		"h1",
		"SEO",
		"High",
		f"Expected one H1, found {len(h1)}.",
		"Expose one server-rendered page heading.",
	)
	rule(
		bool(html_lang),
		4,
		"language",
		"GEO",
		"High",
		"HTML language is missing.",
		"Declare the actual content language on the html element.",
	)
	locale = str(item.get("locale") or "en")
	rule(
		locale != "ar" or bool(html_dir and html_dir.group(1).lower() == "rtl"),
		4,
		"rtl",
		"GEO",
		"High",
		"Arabic page is not explicitly RTL.",
		"Set dir=rtl on Arabic documents and verify mixed text.",
	)
	rule(
		all(parser.meta.get(key) for key in ("og:title", "og:description", "og:image", "og:url")),
		8,
		"open_graph",
		"SEO",
		"Medium",
		"Open Graph metadata is incomplete.",
		"Publish title, description, absolute image and URL for sharing and retrieval.",
	)
	rule(
		parser.meta.get("twitter:card") in {"summary", "summary_large_image"},
		4,
		"twitter_card",
		"SEO",
		"Low",
		"Twitter card type is missing.",
		"Declare summary_large_image where a suitable image exists.",
	)
	rule(
		bool(parser.schemas),
		8,
		"json_ld",
		"AEO",
		"High",
		"JSON-LD is missing.",
		"Publish factual schema that matches visible content.",
	)
	expected = (
		{"Course", "CollectionPage"}
		if str(item.get("page_type")) in {"Course", "Course collection"}
		else {"WebPage", "Article", "CollectionPage", "FAQPage"}
	)
	rule(
		bool(schema_types.intersection(expected)),
		8,
		"primary_entity",
		"AEO",
		"High",
		"The primary page entity is not defined in structured data.",
		"Describe the page with the matching Course, CollectionPage, Article or WebPage entity.",
	)
	answer_ready = (
		bool(re.search(r"\b(what|how|why|when|where|who|как|что|почему|كيف|ما|لماذا)\b", body_text, re.I))
		or len(body_text) >= 900
	)
	rule(
		answer_ready,
		5,
		"answer_ready",
		"AEO",
		"Medium",
		"The page has little answer-ready visible context.",
		"Add a concise direct answer, definitions and scannable supporting detail.",
	)
	evidence_ready = bool(
		re.search(r"\b(source|references|evidence|источник|مصادر|kaynak)\b", body_text, re.I)
	) or str(item.get("page_type")) in {"Course", "Course collection"}
	rule(
		evidence_ready,
		5,
		"evidence",
		"GEO",
		"Medium",
		"Evidence and source signals are not visible.",
		"Add checkable sources, named authorship and claim boundaries where relevant.",
	)
	rule(
		bool(alternates) or locale == "en",
		4,
		"hreflang",
		"GEO",
		"Medium",
		"Localized page lacks a complete hreflang cluster.",
		"Link every full localization bidirectionally and include x-default.",
	)
	score = min(100, score)
	return {
		"route": item["route"],
		"url": item["url"],
		"page_type": item["page_type"],
		"locale": locale,
		"http_status": status,
		"title": title,
		"score": score,
		"status": "Healthy" if score >= 90 else "Needs work" if score >= 70 else "Critical",
		"metrics": {
			"title_length": len(title),
			"description_length": len(description),
			"h1_count": len(h1),
			"canonical": canonical,
			"robots": robots,
			"html_lang": html_lang.group(1) if html_lang else "",
			"html_dir": html_dir.group(1) if html_dir else "",
			"hreflang_count": len(alternates),
			"schema_types": sorted(schema_types),
			"body_words": len(body_text.split()),
		},
		"issues": issues,
		"response_sha256": hashlib.sha256(str(item.get("html") or "").encode("utf-8")).hexdigest(),
		"error": item.get("error"),
	}


def _persist_audit(result: dict[str, object], batch_id: str) -> str:
	doc = frappe.new_doc(AUDIT_DOCTYPE)
	doc.update(
		{
			"route": result["route"],
			"page_type": result["page_type"],
			"locale": result["locale"],
			"status": result["status"],
			"score": result["score"],
			"http_status": result["http_status"],
			"page_title": result["title"],
			"audited_at": now_datetime(),
			"batch_id": batch_id,
			"metrics_json": json.dumps(result["metrics"], ensure_ascii=False, separators=(",", ":")),
			"issues_json": json.dumps(result["issues"], ensure_ascii=False, separators=(",", ":")),
			"response_sha256": result["response_sha256"],
		}
	)
	doc.flags.ignore_permissions = True
	doc.insert()
	return doc.name


def _opportunity_key(route: str, code: str) -> str:
	return hashlib.sha256(f"{route}|{code}".encode()).hexdigest()[:32]


def _sync_opportunities(results: list[dict[str, object]]) -> int:
	count = 0
	active_keys: set[str] = set()
	for result in results:
		for issue in result["issues"]:
			stable_key = _opportunity_key(str(result["route"]), issue["code"])
			active_keys.add(stable_key)
			name = frappe.db.exists(OPPORTUNITY_DOCTYPE, {"stable_key": stable_key})
			doc = frappe.get_doc(OPPORTUNITY_DOCTYPE, name) if name else frappe.new_doc(OPPORTUNITY_DOCTYPE)
			doc.update(
				{
					"stable_key": stable_key,
					"route": result["route"],
					"channel": issue["channel"],
					"priority": issue["priority"],
					"issue_code": issue["code"],
					"issue": issue["message"],
					"recommendation": issue["recommendation"],
					"last_seen": now_datetime(),
					"status": doc.get("status") or "Open",
				}
			)
			doc.flags.ignore_permissions = True
			doc.save()
			count += 1
	open_items = frappe.get_all(
		OPPORTUNITY_DOCTYPE,
		filters={"status": ["in", ["Open", "Planned", "In progress"]]},
		fields=["name", "stable_key"],
	)
	for item in open_items:
		if item.stable_key not in active_keys:
			frappe.db.set_value(OPPORTUNITY_DOCTYPE, item.name, "status", "Resolved", update_modified=False)
	return count


@frappe.whitelist()
def run_audit() -> dict[str, object]:
	_require_manager()
	routes = _discover_routes()
	fetched: list[dict[str, object]] = []
	with ThreadPoolExecutor(max_workers=min(6, max(1, len(routes)))) as executor:
		futures = [executor.submit(_fetch, route) for route in routes]
		for future in as_completed(futures):
			fetched.append(future.result())
	results = sorted((_audit_fetched(item) for item in fetched), key=lambda item: str(item["route"]))
	batch_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
	for result in results:
		_persist_audit(result, batch_id)
	opportunity_count = _sync_opportunities(results)
	frappe.db.commit()
	return {"batch_id": batch_id, "pages": results, "opportunities_synced": opportunity_count}


def run_scheduled_audit() -> None:
	frappe.set_user("Administrator")
	run_audit()


def _latest_audits() -> list[dict[str, object]]:
	batch_id = frappe.db.get_value(AUDIT_DOCTYPE, {}, "batch_id", order_by="audited_at desc")
	if not batch_id:
		return []
	rows = frappe.get_all(
		AUDIT_DOCTYPE,
		filters={"batch_id": batch_id},
		fields=[
			"route",
			"page_type",
			"locale",
			"status",
			"score",
			"http_status",
			"page_title",
			"audited_at",
			"metrics_json",
			"issues_json",
		],
		order_by="score asc, route asc",
	)
	for row in rows:
		row["metrics"] = json.loads(row.pop("metrics_json") or "{}")
		row["issues"] = json.loads(row.pop("issues_json") or "[]")
	return rows


@frappe.whitelist()
def get_dashboard() -> dict[str, object]:
	_require_manager()
	pages = _latest_audits()
	scores = [cint(page.score) for page in pages]
	prompts = frappe.get_all(
		PROMPT_DOCTYPE,
		filters={"active": 1},
		fields=[
			"name",
			"prompt_text",
			"language",
			"market",
			"audience",
			"journey_stage",
			"target_route",
			"measurement_status",
			"last_measured",
		],
		order_by="language asc, market asc, modified desc",
		limit_page_length=200,
	)
	opportunities = frappe.get_all(
		OPPORTUNITY_DOCTYPE,
		filters={"status": ["!=", "Dismissed"]},
		fields=["name", "route", "channel", "priority", "issue", "recommendation", "status", "last_seen"],
		order_by="last_seen desc",
		limit_page_length=100,
	)
	priority_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
	opportunities.sort(key=lambda item: (priority_order.get(item.priority, 9), str(item.route)))
	observation_count = frappe.db.count(OBSERVATION_DOCTYPE)
	cited_count = frappe.db.count(OBSERVATION_DOCTYPE, {"cited": 1})
	measured_prompts = frappe.db.count(PROMPT_DOCTYPE, {"measurement_status": "Measured"})
	return {
		"summary": {
			"pages": len(pages),
			"average_score": round(sum(scores) / len(scores)) if scores else 0,
			"critical_pages": sum(1 for page in pages if page.status == "Critical"),
			"open_opportunities": len(opportunities),
			"active_prompts": len(prompts),
			"measured_prompts": measured_prompts,
			"observations": observation_count,
			"citations": cited_count,
		},
		"pages": pages,
		"prompts": prompts,
		"opportunities": opportunities,
		"measurement_note": "Not measured"
		if not observation_count
		else "Measured observations are shown from stored provider results.",
	}


def seed_prompts() -> int:
	prompts = [
		(
			"en",
			"Global",
			"Learner",
			"Awareness",
			"How can I learn to read the Quran correctly as a beginner?",
			"/lms/courses",
		),
		(
			"en",
			"Global",
			"Learner",
			"Consideration",
			"What is the best structured Quran memorisation and review system?",
			"/lms/courses",
		),
		(
			"en",
			"Global",
			"Parent",
			"Consideration",
			"Which online Quran course combines recitation, understanding and memorisation?",
			"/lms/courses",
		),
		(
			"en",
			"Global",
			"Learner",
			"Decision",
			"Does ALLIM provide guided Quran learning with teacher support?",
			"/academy",
		),
		("ar", "GCC", "Learner", "Awareness", "كيف أبدأ تعلّم قراءة القرآن قراءة صحيحة؟", "/lms/courses"),
		("ar", "GCC", "Learner", "Consideration", "ما أفضل نظام منظم لحفظ القرآن ومراجعته؟", "/lms/courses"),
		(
			"ar",
			"GCC",
			"Parent",
			"Consideration",
			"ما الدورة التي تجمع بين التلاوة والفهم والحفظ؟",
			"/lms/courses",
		),
		("ar", "GCC", "Learner", "Decision", "هل تقدم ALLIM تعلّم القرآن مع متابعة معلم؟", "/academy"),
		("ru", "CIS", "Learner", "Awareness", "Как научиться правильно читать Коран с нуля?", "/lms/courses"),
		(
			"ru",
			"CIS",
			"Learner",
			"Consideration",
			"Какая система лучше помогает заучивать и повторять Коран?",
			"/lms/courses",
		),
		(
			"ru",
			"CIS",
			"Parent",
			"Consideration",
			"Какой онлайн-курс Корана объединяет чтение, понимание и заучивание?",
			"/lms/courses",
		),
		(
			"ru",
			"CIS",
			"Learner",
			"Decision",
			"Есть ли в ALLIM обучение Корану с сопровождением преподавателя?",
			"/academy",
		),
		(
			"tr",
			"Türkiye",
			"Learner",
			"Awareness",
			"Kur’an okumayı sıfırdan doğru şekilde nasıl öğrenebilirim?",
			"/lms/courses",
		),
		(
			"tr",
			"Türkiye",
			"Learner",
			"Consideration",
			"Kur’an ezberi ve tekrar için en iyi düzenli sistem nedir?",
			"/lms/courses",
		),
		(
			"tr",
			"Türkiye",
			"Parent",
			"Consideration",
			"Tilavet, anlama ve ezberi birleştiren çevrim içi Kur’an kursu hangisidir?",
			"/lms/courses",
		),
		(
			"tr",
			"Türkiye",
			"Learner",
			"Decision",
			"ALLIM öğretmen rehberliğinde Kur’an eğitimi sunuyor mu?",
			"/academy",
		),
	]
	created = 0
	for language, market, audience, stage, prompt_text, target_route in prompts:
		stable_key = hashlib.sha256(f"{language}|{market}|{prompt_text}".encode()).hexdigest()[:32]
		if frappe.db.exists(PROMPT_DOCTYPE, {"stable_key": stable_key}):
			continue
		doc = frappe.new_doc(PROMPT_DOCTYPE)
		doc.update(
			{
				"stable_key": stable_key,
				"prompt_text": prompt_text,
				"language": language,
				"market": market,
				"audience": audience,
				"journey_stage": stage,
				"target_route": target_route,
				"active": 1,
				"measurement_status": "Not measured",
			}
		)
		doc.flags.ignore_permissions = True
		doc.insert()
		created += 1
	return created


def apply_lms_defaults() -> dict[str, object]:
	settings = frappe.get_single("LMS Settings")
	settings.meta_description = (
		"Structured Qur’an learning for recitation, memorisation, "
		"Qur’anic Arabic and guided study with ALLIM."
	)
	settings.meta_image = "/assets/allimquran/media/allim-brand-icon.png"
	settings.meta_keywords = (
		"Qur’an learning, Quran recitation, Quran memorisation, Qur’anic Arabic, tajwid, hifz, ALLIM"
	)
	settings.flags.ignore_permissions = True
	settings.save()

	def upsert_meta(name: str, values: dict[str, str]) -> None:
		document = (
			frappe.get_doc("Website Route Meta", name)
			if frappe.db.exists("Website Route Meta", name)
			else frappe.new_doc("Website Route Meta")
		)
		if document.is_new():
			document.name = name
		existing = {row.key: row for row in document.meta_tags}
		for key, value in values.items():
			if key in existing:
				existing[key].value = value
			else:
				document.append("meta_tags", {"key": key, "value": value})
		document.flags.ignore_permissions = True
		document.save()

	upsert_meta(
		"courses",
		{
			"title": "Qur’an Courses & Guided Learning",
			"description": (
				"Explore structured learning paths for Qur’an recitation, memorisation, "
				"Qur’anic Arabic and guided study."
			),
			"image": "/assets/allimquran/media/allim-brand-icon.png",
			"keywords": (
				"Qur’an courses, Quran learning, recitation, memorisation, Qur’anic Arabic, tajwid, hifz"
			),
			"robots": INDEX_ROBOTS,
		},
	)
	protected = []
	for course in frappe.get_all("LMS Course", filters={"published": 1}, fields=["name", "tags"]):
		if _is_demo_course(course):
			route = f"courses/{course.name}"
			upsert_meta(route, {"robots": NOINDEX_ROBOTS})
			protected.append(route)
	return {"course_collection": "courses", "excluded_demo_routes": protected}


def after_migrate() -> None:
	if not all(
		frappe.db.exists("DocType", name)
		for name in (AUDIT_DOCTYPE, PROMPT_DOCTYPE, OBSERVATION_DOCTYPE, OPPORTUNITY_DOCTYPE)
	):
		return
	seed_prompts()
	apply_lms_defaults()
	frappe.db.commit()
