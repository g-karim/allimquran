from __future__ import annotations

import json

import frappe


COURSE_TITLE = "Буквы Корана: первый шаг"
COURSE_MARKER = "ALLIM-C01"


def main() -> None:
    course_name = frappe.db.exists("LMS Course", {"title": COURSE_TITLE})
    if not course_name:
        raise RuntimeError("Course does not exist")
    course = frappe.get_doc("LMS Course", course_name)
    if COURSE_MARKER not in (course.tags or ""):
        raise RuntimeError("Course marker is missing")

    chapters = [frappe.get_doc("Course Chapter", row.chapter) for row in course.chapters]
    lesson_names = [row.lesson for chapter in chapters for row in chapter.lessons]
    lessons = [frappe.get_doc("Course Lesson", name) for name in lesson_names]
    previews = [item.name for item in lessons if item.include_in_preview]
    missing_bodies = [item.name for item in lessons if not (item.body or "").strip()]
    result = {
        "course": course.name,
        "title": course.title,
        "published": int(course.published or 0),
        "category": course.category,
        "chapters": len(chapters),
        "lessons": len(lessons),
        "preview_lessons": previews,
        "missing_bodies": missing_bodies,
        "chapter_order": [item.title for item in chapters],
    }
    if len(chapters) != 8 or len(lessons) != 25 or len(previews) != 1 or missing_bodies:
        raise RuntimeError(json.dumps(result, ensure_ascii=False))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

