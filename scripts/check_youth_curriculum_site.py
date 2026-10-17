"""Exercise the draft importer on a dedicated, disposable full LMS site.

Requires a fresh allim-youth.localhost with the three synthetic fixture users.
Creates the three drafts and a separate published two-lesson test copy. Never
publishes the imported curriculum. Run with the fixture bench's Python/runtime.
"""

import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
from unittest.mock import patch

TEACHER = "allim-youth-teacher@example.invalid"
STUDENT = "allim-youth-student@example.invalid"
OTHER = "allim-youth-other@example.invalid"


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--sites", type=Path, required=True)
	parser.add_argument("--site", default="allim-youth.localhost")
	parser.add_argument("--output", type=Path, required=True)
	args = parser.parse_args()
	if args.site != "allim-youth.localhost":
		parser.error("Only the dedicated allim-youth.localhost fixture site is accepted")
	os.chdir(args.sites)
	import frappe
	from frappe.model.document import Document

	from allimquran.youth_curriculum import _insert_records, execute, matches, records

	frappe.init(site=args.site, sites_path=str(args.sites.resolve()))
	frappe.connect()
	try:
		assert all(frappe.db.exists("User", name) for name in (TEACHER, STUDENT, OTHER))
		assert "lms" in frappe.get_installed_apps()
		frappe.set_user(TEACHER)
		courses = json.loads(
			(Path(__file__).resolve().parents[1] / "allimquran/youth_curriculum/courses.json").read_text()
		)
		specs = records(courses, TEACHER)
		course_specs = [spec for spec in specs if spec["doctype"] == "LMS Course"]
		lesson_specs = [spec for spec in specs if spec["doctype"] == "Course Lesson"]
		checks = []

		def passed(message):
			checks.append(message)
			print("PASS " + message, flush=True)

		def saved_graph():
			return [
				frappe.get_doc(spec["doctype"], spec["name"]).as_dict()
				for spec in specs
				if frappe.db.exists(spec["doctype"], spec["name"])
			]

		def checksum():
			return hashlib.sha256(json.dumps(saved_graph(), sort_keys=True, default=str).encode()).hexdigest()

		def refuses(text):
			try:
				execute(TEACHER, apply=True)
			except frappe.ValidationError as exc:
				assert text in str(exc), str(exc)
			else:
				raise AssertionError("Importer accepted " + text)

		assert not saved_graph(), "Use a fresh fixture site; existing curriculum is protected"
		before = execute(TEACHER)
		assert before["dry_run"] and before["create"] == 164 and not saved_graph()
		passed("dry-run plans 164 records without creating courses, lessons or quizzes")

		# A real native insert is interrupted after courses/questions/quizzes exist.
		original_insert = Document.insert

		def fail_at_lesson(doc, *values, **kwargs):
			if doc.doctype == "Course Lesson":
				raise RuntimeError("fixture interruption")
			return original_insert(doc, *values, **kwargs)

		try:
			with patch.object(Document, "insert", fail_at_lesson):
				execute(TEACHER, apply=True)
		except RuntimeError as exc:
			assert str(exc) == "fixture interruption"
		else:
			raise AssertionError("The simulated failure was not reached")
		assert not saved_graph()
		passed("interrupted native import rolls back every managed record")

		frappe.db.savepoint("fixture_collision")
		collision = {key: value for key, value in course_specs[0].items() if key != "chapters"}
		collision["name"] = "allim-youth-collision"
		frappe.get_doc(collision).insert(set_name=collision["name"])
		refuses("existing course has this title")
		assert not saved_graph()
		frappe.db.rollback(save_point="fixture_collision")
		passed("an existing course with the same title is protected")

		frappe.db.savepoint("fixture_partial")
		partial = {key: value for key, value in course_specs[0].items() if key != "chapters"}
		frappe.get_doc(partial).insert(set_name=partial["name"])
		refuses("Existing content differs")
		frappe.db.rollback(save_point="fixture_partial")
		assert not saved_graph()
		passed("partial seed state is refused without repair or overwrite")

		result = execute(TEACHER, apply=True)
		assert result["create"] == 164
		frappe.db.commit()
		assert len(saved_graph()) == 164
		for spec in specs:
			assert matches(frappe.get_doc(spec["doctype"], spec["name"]).as_dict(), spec), spec["name"]
		from lms.lms.doctype.course_lesson.course_lesson import get_quiz_progress

		assert all(not get_quiz_progress(spec["name"]) for spec in lesson_specs)
		passed("native LMS treats all 43 unanswered lesson quizzes as incomplete")
		baseline = checksum()
		repeat = execute(TEACHER, apply=True)
		assert repeat["existing"] == 164 and repeat["create"] == 0 and checksum() == baseline
		passed("164 native records installed as Course Creator; repeating leaves them unchanged")

		frappe.db.savepoint("fixture_teacher_edit")
		doc = frappe.get_doc("Course Lesson", lesson_specs[0]["name"])
		doc.body += "\n\nTeacher review note."
		doc.save()
		refuses("Existing content differs")
		assert "Teacher review note." in frappe.get_doc("Course Lesson", doc.name).body
		frappe.db.rollback(save_point="fixture_teacher_edit")
		assert checksum() == baseline
		passed("teacher edits are preserved; the importer refuses to overwrite them")

		frappe.db.savepoint("fixture_published")
		frappe.db.set_value("LMS Course", course_specs[0]["name"], "published", 1)
		refuses("Published course is protected")
		frappe.db.rollback(save_point="fixture_published")
		assert checksum() == baseline
		passed("a published record is protected; all three actual courses remain drafts")

		# Native student access needs a published course. Use separate IDs and a
		# separate title, keeping every original course unpublished throughout HTTP QA.
		fixture = copy.deepcopy(courses[0])
		fixture.update(
			id="allim-youth-fixture", marker="ALLIM-YOUTH-FIXTURE", title="[Fixture] Youth quiz integration"
		)
		fixture["chapters"] = fixture["chapters"][:1]
		fixture["chapters"][0]["lessons"] = fixture["chapters"][0]["lessons"][:2]
		for lesson in fixture["chapters"][0]["lessons"]:
			lesson["id"] = "fixture-" + lesson["id"]
		fixture_specs = records([fixture], TEACHER)
		expected_fixture_specs = copy.deepcopy(fixture_specs)
		_insert_records(fixture_specs)
		assert fixture_specs == expected_fixture_specs, "Native inserts must not mutate the expected graph"
		fixture_course = next(spec for spec in fixture_specs if spec["doctype"] == "LMS Course")
		public_copy = frappe.get_doc("LMS Course", fixture_course["name"])
		public_copy.published = 1
		public_copy.save()
		frappe.set_user("Administrator")
		frappe.get_doc({"doctype": "LMS Enrollment", "course": public_copy.name, "member": STUDENT}).insert()
		frappe.db.commit()
		assert checksum() == baseline
		assert all(not frappe.db.get_value("LMS Course", spec["name"], "published") for spec in course_specs)
		passed("separate published test copy and ordinary student enrollment leave the draft graph unchanged")

		output = {
			"checks": checks,
			"imported": result,
			"repeat": repeat,
			"draft_courses": [spec["name"] for spec in course_specs],
			"draft_graph_sha256": baseline,
			"fixture_course": public_copy.name,
			"fixture_lessons": [spec["name"] for spec in fixture_specs if spec["doctype"] == "Course Lesson"],
			"fixture_quizzes": [spec["name"] for spec in fixture_specs if spec["doctype"] == "LMS Quiz"],
		}
		args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
	finally:
		frappe.destroy()


if __name__ == "__main__":
	main()
