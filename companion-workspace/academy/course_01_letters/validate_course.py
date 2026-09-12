from __future__ import annotations

from collections import Counter

from content import ALL_LETTERS, COURSE, COURSE_MARKER, LETTER_FORMS, NON_CONNECTING


def main() -> None:
    assert len(ALL_LETTERS) == 28
    assert len(set(ALL_LETTERS)) == 28
    assert set(LETTER_FORMS) == set(ALL_LETTERS)
    assert set(NON_CONNECTING) == set("ا د ذ ر ز و".split())
    assert COURSE_MARKER in COURSE["tags"]
    assert COURSE["published"] == 0

    chapters = COURSE["chapters"]
    lessons = [item for chapter in chapters for item in chapter["lessons"]]
    assert len(chapters) == 8
    assert len(lessons) == 25
    assert len({chapter["title"] for chapter in chapters}) == len(chapters)
    assert len({item["title"] for item in lessons}) == len(lessons)
    assert sum(item["include_in_preview"] for item in lessons) == 1

    public_copy = "\n".join(
        [COURSE["title"], COURSE["short_introduction"], COURSE["description"], COURSE["tags"]]
        + [chapter["title"] for chapter in chapters]
        + [item["title"] + "\n" + item["body"] for item in lessons]
    )
    for forbidden in ("ERPNext", "Frappe", "frappe"):
        assert forbidden not in public_copy
    for reference in ("Аль-Фатиха, 1:2", "Аль-Бакара, 2:2", "Ан-Наба, 78:8", "Аль-Ихляс, 112:1"):
        assert reference in public_copy
    for letter in ALL_LETTERS:
        assert letter in public_copy

    prefix_counts = Counter(item["title"].split()[0].split(".")[0] for item in lessons)
    assert prefix_counts == Counter({"1": 4, "2": 3, "3": 3, "4": 3, "5": 3, "6": 3, "7": 3, "8": 3})
    print(f"OK: {len(chapters)} chapters, {len(lessons)} lessons, 28 letters, one preview lesson")


if __name__ == "__main__":
    main()

