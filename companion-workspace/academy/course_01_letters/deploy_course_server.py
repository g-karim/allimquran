from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import frappe


SITE = "allimquran.com"
BACKUP_ROOT = Path("/home/frappe/frappe-bench/sites/deploy-backups")


def load_course(source_root: Path) -> dict:
    namespace: dict[str, object] = {}
    path = source_root / "content.py"
    exec(compile(path.read_text(encoding="utf-8"), str(path), "exec"), namespace, namespace)
    return namespace["COURSE"]


def snapshot_records(course_name: str | None) -> dict:
    if not course_name:
        return {"course": None, "chapters": [], "lessons": []}
    chapters = frappe.get_all("Course Chapter", filters={"course": course_name}, pluck="name")
    lessons = frappe.get_all("Course Lesson", filters={"course": course_name}, pluck="name")
    return {
        "course": frappe.get_doc("LMS Course", course_name).as_dict(),
        "chapters": [frappe.get_doc("Course Chapter", name).as_dict() for name in chapters],
        "lessons": [frappe.get_doc("Course Lesson", name).as_dict() for name in lessons],
    }


def ensure_category(category: str) -> None:
    if frappe.db.exists("LMS Category", category):
        return
    document = frappe.new_doc("LMS Category")
    document.category = category
    document.flags.ignore_permissions = True
    document.insert()


def source_instructors() -> list[str]:
    sample_name = frappe.db.exists("LMS Course", {"title": "A guide to Frappe Learning"})
    if not sample_name:
        sample_name = frappe.db.get_value("LMS Course", {}, "name", order_by="creation asc")
    if not sample_name:
        raise RuntimeError("No existing LMS course is available to supply the approved instructor")
    sample = frappe.get_doc("LMS Course", sample_name)
    instructors = [row.instructor for row in (sample.instructors or []) if row.instructor]
    if not instructors:
        raise RuntimeError("The reference course has no instructor")
    return instructors


def set_if_present(document, fieldname: str, value) -> None:
    if document.meta.has_field(fieldname):
        document.set(fieldname, value)


def upsert_course(data: dict, *, publish: bool):
    existing_name = frappe.db.exists("LMS Course", {"title": data["title"]})
    if existing_name:
        document = frappe.get_doc("LMS Course", existing_name)
        if data["marker"] not in (document.tags or ""):
            raise RuntimeError("A course with the same title exists without the ALLIM course marker")
    else:
        document = frappe.new_doc("LMS Course")
        document.set("instructors", [])
        for instructor in source_instructors():
            document.append("instructors", {"instructor": instructor})

    for fieldname in (
        "title",
        "short_introduction",
        "description",
        "category",
        "tags",
        "card_gradient",
        "upcoming",
        "featured",
        "disable_self_learning",
        "enforce_lesson_completion",
    ):
        set_if_present(document, fieldname, data[fieldname])
    set_if_present(document, "published", 1 if publish else 0)
    set_if_present(document, "paid_course", 0)
    set_if_present(document, "paid_certificate", 0)
    set_if_present(document, "enable_certification", 0)
    document.flags.ignore_permissions = True
    document.save()
    return document


def upsert_chapter(course_name: str, title: str):
    name = frappe.db.exists("Course Chapter", {"course": course_name, "title": title})
    document = frappe.get_doc("Course Chapter", name) if name else frappe.new_doc("Course Chapter")
    document.course = course_name
    document.title = title
    document.flags.ignore_permissions = True
    document.save()
    return document


def upsert_lesson(course_name: str, chapter_name: str, values: dict):
    name = frappe.db.exists(
        "Course Lesson",
        {"course": course_name, "chapter": chapter_name, "title": values["title"]},
    )
    document = frappe.get_doc("Course Lesson", name) if name else frappe.new_doc("Course Lesson")
    document.title = values["title"]
    document.chapter = chapter_name
    set_if_present(document, "course", course_name)
    document.body = values["body"]
    set_if_present(document, "content", None)
    set_if_present(document, "instructor_notes", values["instructor_notes"])
    set_if_present(document, "include_in_preview", values["include_in_preview"])
    document.flags.ignore_permissions = True
    document.save()
    return document


def main(release_path: str = "/tmp/allim-course-01", *, publish: bool = False) -> None:
    source_root = Path(release_path)
    data = load_course(source_root)
    existing_name = frappe.db.exists("LMS Course", {"title": data["title"]})

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = BACKUP_ROOT / f"{timestamp}-allim-course-01"
    backup_dir.mkdir(parents=True, exist_ok=False)
    (backup_dir / "records.json").write_text(
        frappe.as_json(snapshot_records(existing_name), indent=2), encoding="utf-8"
    )

    ensure_category(data["category"])
    course = upsert_course(data, publish=publish)
    chapter_names = []
    lesson_names = []

    for chapter_values in data["chapters"]:
        chapter = upsert_chapter(course.name, chapter_values["title"])
        chapter_lesson_names = []
        for lesson_values in chapter_values["lessons"]:
            lesson_doc = upsert_lesson(course.name, chapter.name, lesson_values)
            chapter_lesson_names.append(lesson_doc.name)
            lesson_names.append(lesson_doc.name)
        chapter.set("lessons", [])
        for lesson_name in chapter_lesson_names:
            chapter.append("lessons", {"lesson": lesson_name})
        chapter.flags.ignore_permissions = True
        chapter.save()
        chapter_names.append(chapter.name)

    course.set("chapters", [])
    for chapter_name in chapter_names:
        course.append("chapters", {"chapter": chapter_name})
    set_if_present(course, "lessons", len(lesson_names))
    course.flags.ignore_permissions = True
    course.save()
    frappe.db.commit()
    frappe.clear_cache()

    stored = frappe.get_doc("LMS Course", course.name)
    stored_chapters = [row.chapter for row in stored.chapters]
    if stored_chapters != chapter_names:
        raise RuntimeError("Course chapter order did not persist")
    if len(lesson_names) != 25:
        raise RuntimeError(f"Expected 25 lessons, stored {len(lesson_names)}")
    print(json.dumps({
        "backup": str(backup_dir),
        "course": stored.name,
        "title": stored.title,
        "published": int(stored.published or 0),
        "chapters": len(chapter_names),
        "lessons": len(lesson_names),
    }, ensure_ascii=False, indent=2))

