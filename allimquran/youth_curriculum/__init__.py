"""Explicit create-only import of the reviewed ALLIM youth curriculum as LMS drafts."""

import json
from copy import deepcopy
from html import escape
from pathlib import Path


def records(courses, instructor):
	result = []
	for c in courses:
		course = "allim-y1-" + c["id"].removeprefix("allim-")
		chapters = []
		for ch in c["chapters"]:
			chapter = course + "-" + ch["id"]
			lessons = []
			for lesson in ch["lessons"]:
				name = "allim-y1-" + lesson["id"]
				quiz = name + "-quiz"
				questions = []
				for i, q in enumerate(lesson["questions"]):
					qname = name + "-q" + str(i + 1)
					fields = dict(type="Choices", question="<p>" + escape(q["prompt"]) + "</p>", multiple=0)
					for n, option in enumerate(q["options"], 1):
						fields["option_" + str(n)] = escape(option)
						fields["is_correct_" + str(n)] = int(n - 1 == q["answer"])
						fields["explanation_" + str(n)] = escape(q["explanation"])
					result.append(dict(doctype="LMS Question", name=qname, **fields))
					questions.append(
						dict(question=qname, marks=1, type="Choices", question_detail=q["prompt"])
					)
				result.append(
					dict(
						doctype="LMS Quiz",
						name=quiz,
						title=lesson["title"] + " · проверка",
						course=course,
						lesson=name,
						questions=questions,
						passing_percentage=100,
						total_marks=len(questions),
						show_answers=1,
						show_submission_history=1,
						max_attempts=0,
						enable_proctoring=0,
					)
				)
				body = (
					lesson["body"]
					+ "\n\n## Короткая практика\n"
					+ lesson["kids"]
					+ "\n\n## Дополнительный шаг для подростков\n"
					+ lesson["teens"]
				)
				if lesson.get("reference"):
					ref = lesson["reference"]
					body += (
						"\n\n[Открыть практику в ALLIM](/learn?view=read&amp;lang=ru&amp;surah="
						+ str(ref["surah"])
						+ "&amp;ayah="
						+ str(ref["ayah"])
						+ ")"
					)
				body += '\n\n{{ Quiz("' + quiz + '") }}'
				result.append(
					dict(
						doctype="Course Lesson",
						name=name,
						title=lesson["title"],
						course=course,
						chapter=chapter,
						body=body,
						content=None,
						instructor_notes=lesson["instructor_notes"],
						quiz_id=None,
						include_in_preview=0,
					)
				)
				lessons.append(dict(lesson=name))
			result.append(
				dict(
					doctype="Course Chapter", name=chapter, title=ch["title"], course=course, lessons=lessons
				)
			)
			chapters.append(dict(chapter=chapter))
		result.append(
			dict(
				doctype="LMS Course",
				name=course,
				title=c["title"],
				short_introduction=c["short_introduction"],
				description=c["description"],
				tags=c["marker"] + ", ALLIM-YOUTH-V1, ru",
				instructors=[dict(instructor=instructor)],
				chapters=chapters,
				published=0,
				paid_course=0,
				enable_certification=0,
				enforce_lesson_completion=1,
			)
		)
	return result


def matches(actual, expected):
	"""Compare managed fields, including child order; ignore system/computed fields."""
	if isinstance(expected, dict):
		return isinstance(actual, dict) and all(matches(actual.get(k), v) for k, v in expected.items())
	if isinstance(expected, list):
		return (
			isinstance(actual, list)
			and len(actual) == len(expected)
			and all(matches(a, b) for a, b in zip(actual, expected, strict=True))
		)
	if expected in (None, "") and actual in (None, ""):
		return True
	if expected == 0 and actual in (None, ""):
		return True
	return actual == expected


def execute(instructor, apply=False):
	import frappe
	from frappe.utils import cint

	apply = bool(cint(apply))
	if not instructor or not frappe.db.exists("User", instructor):
		frappe.throw("Specify an existing enabled instructor.")
	user = frappe.get_doc("User", instructor)
	if not user.enabled or not set(frappe.get_roles(instructor)) & {"Course Creator", "Moderator"}:
		frappe.throw("Instructor must be enabled and have an authoring role.")
	courses = json.loads((Path(__file__).parent / "courses.json").read_text())
	specs = records(courses, instructor)
	# Catch legacy course drafts rather than silently creating a second alphabet course.
	names = {r["name"] for r in specs if r["doctype"] == "LMS Course"}
	for c in courses:
		collisions = frappe.get_all("LMS Course", filters={"title": c["title"]}, pluck="name")
		if any(name not in names for name in collisions):
			frappe.throw(
				"An existing course has this title. Review its migration before seeding: " + c["title"]
			)
	legacy = frappe.get_all("LMS Course", filters={"tags": ["like", "%ALLIM-C01%"]}, pluck="name")
	if any(name not in names for name in legacy):
		frappe.throw("Legacy ALLIM-C01 draft found; resolve migration explicitly.")
	existing = []
	missing = []
	for spec in specs:
		meta = frappe.get_meta(spec["doctype"])
		for field in spec:
			if field not in ("name", "doctype") and not meta.has_field(field):
				frappe.throw("Installed schema differs: " + spec["doctype"] + "." + field)
		if frappe.db.exists(spec["doctype"], spec["name"]):
			doc = frappe.get_doc(spec["doctype"], spec["name"])
			doc.check_permission("read")
			if spec["doctype"] == "LMS Course" and doc.published:
				frappe.throw("Published course is protected: " + doc.name)
			if not matches(doc.as_dict(), spec):
				frappe.throw("Existing content differs; no overwrite allowed: " + doc.name)
			existing.append(spec["name"])
		else:
			if not frappe.has_permission(spec["doctype"], "create"):
				frappe.throw("Missing create permission: " + spec["doctype"])
			missing.append(spec)
	# Incomplete seed state is not repaired automatically: it may contain teacher edits.
	if existing and missing:
		frappe.throw("Partial seed detected. Review before creating additional records.")
	report = dict(dry_run=not apply, existing=len(existing), create=len(missing), courses=3, published=False)
	if not apply or not missing:
		return report
	frappe.db.savepoint("allim_youth_seed")
	try:
		_insert_records(missing)
	except Exception:
		frappe.db.rollback(save_point="allim_youth_seed")
		raise
	# Commit is owned by the invoking command/transaction, not this helper.
	return report


def _insert_records(specs):
	"""Insert a new graph with valid forward and reverse LMS links; caller owns rollback."""
	import frappe

	def insert(spec, omitted=()):
		data = {k: deepcopy(v) for k, v in spec.items() if k not in omitted}
		return frappe.get_doc(data).insert(set_name=spec["name"])

	for dt, omitted in [
		("LMS Course", ("chapters",)),
		("Course Chapter", ("lessons",)),
		("LMS Question", ()),
		("LMS Quiz", ("lesson",)),
		("Course Lesson", ()),
	]:
		for spec in specs:
			if spec["doctype"] == dt:
				insert(spec, omitted)
	# Quizzes must exist before lessons can embed them; attach the reverse
	# link only after all lessons exist so native submission credits the lesson.
	for spec in specs:
		if spec["doctype"] == "LMS Quiz":
			doc = frappe.get_doc("LMS Quiz", spec["name"])
			doc.lesson = spec["lesson"]
			doc.save()
	for dt, field in [("Course Chapter", "lessons"), ("LMS Course", "chapters")]:
		for spec in specs:
			if spec["doctype"] == dt:
				doc = frappe.get_doc(dt, spec["name"])
				doc.set(field, deepcopy(spec[field]))
				doc.save()
	for spec in specs:
		if not matches(frappe.get_doc(spec["doctype"], spec["name"]).as_dict(), spec):
			frappe.throw("Read-back differs; rolled back: " + spec["name"])
