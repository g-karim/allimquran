"""The packaged curriculum graph and native quiz placement, without a Frappe dependency."""

import copy
import json
import re
import unittest
from collections import Counter
from pathlib import Path

from allimquran.youth_curriculum import matches, records

CONTENT = Path(__file__).resolve().parents[1] / "allimquran" / "youth_curriculum" / "courses.json"


class YouthCurriculumTests(unittest.TestCase):
	def setUp(self):
		self.courses = json.loads(CONTENT.read_text())
		self.specs = records(self.courses, "teacher@example.invalid")
		self.by_name = {spec["name"]: spec for spec in self.specs}

	def test_complete_graph_and_questions(self):
		self.assertEqual(len(self.by_name), 164)
		self.assertEqual(
			Counter(spec["doctype"] for spec in self.specs),
			{"LMS Course": 3, "Course Chapter": 14, "Course Lesson": 43, "LMS Quiz": 43, "LMS Question": 61},
		)
		for spec in self.specs:
			for field in ("course", "chapter", "lesson"):
				if field in spec:
					self.assertIn(spec[field], self.by_name)
			for field, childkey in (
				("chapters", "chapter"),
				("lessons", "lesson"),
				("questions", "question"),
			):
				for child in spec.get(field, []):
					self.assertIn(child[childkey], self.by_name)

	def test_every_lesson_embeds_one_quiz_with_matching_reverse_link(self):
		for lesson in self.specs:
			if lesson["doctype"] != "Course Lesson":
				continue
			with self.subTest(lesson=lesson["name"]):
				quizzes = re.findall(r'\{\{ Quiz\("([^"]+)"\) \}\}', lesson["body"])
				self.assertEqual(len(quizzes), 1)
				quiz = self.by_name[quizzes[0]]
				self.assertEqual(quiz["doctype"], "LMS Quiz")
				self.assertEqual(quiz["lesson"], lesson["name"])
				self.assertEqual(quiz["course"], lesson["course"])
				# Native legacy rendering also appends quiz_id; leave it empty to avoid two tests.
				self.assertIsNone(lesson["quiz_id"])
				self.assertIsNone(lesson["content"])
				self.assertEqual(lesson["include_in_preview"], 0)

	def test_draft_paid_and_certificate_flags_cannot_be_enabled_by_source_metadata(self):
		courses = copy.deepcopy(self.courses)
		for course in courses:
			course.update(published=1, paid_course=1, enable_certification=1)
		for spec in records(courses, "teacher@example.invalid"):
			if spec["doctype"] == "LMS Course":
				for field in ("published", "paid_course", "enable_certification"):
					self.assertEqual(spec[field], 0)
				self.assertEqual(spec["enforce_lesson_completion"], 1)
				self.assertEqual(spec["instructors"], [{"instructor": "teacher@example.invalid"}])

	def test_answers_are_valid_and_quizzes_require_all_answers(self):
		for question in (spec for spec in self.specs if spec["doctype"] == "LMS Question"):
			options = [value for key, value in question.items() if key.startswith("option_")]
			self.assertGreaterEqual(len(options), 2)
			self.assertLessEqual(len(options), 4)
			self.assertEqual(len(options), len(set(options)))
			self.assertEqual(
				sum(value for key, value in question.items() if key.startswith("is_correct_")), 1
			)
		for quiz in (spec for spec in self.specs if spec["doctype"] == "LMS Quiz"):
			self.assertEqual(quiz["passing_percentage"], 100)
			self.assertEqual(quiz["total_marks"], len(quiz["questions"]))

	def test_teacher_changes_and_child_order_are_protected(self):
		lesson = next(spec for spec in self.specs if spec["doctype"] == "Course Lesson")
		self.assertTrue(matches(dict(lesson, modified="today", content=""), lesson))
		self.assertFalse(matches(dict(lesson, body="teacher edit"), lesson))
		self.assertFalse(matches(dict(lesson, content='{"blocks":[{"type":"paragraph"}]}'), lesson))
		course = next(spec for spec in self.specs if spec["doctype"] == "LMS Course")
		self.assertFalse(matches(dict(course, chapters=list(reversed(course["chapters"]))), course))

	def test_age_guidance_teacher_notes_and_local_practice_links_are_retained(self):
		for lesson in (spec for spec in self.specs if spec["doctype"] == "Course Lesson"):
			self.assertIn("## Короткая практика", lesson["body"])
			self.assertIn("## Дополнительный шаг для подростков", lesson["body"])
			self.assertTrue(lesson["instructor_notes"])
			self.assertNotIn("https://allimquran.com/learn?", lesson["body"])


if __name__ == "__main__":
	unittest.main()
