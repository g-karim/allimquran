from __future__ import annotations

import json
import re
from pathlib import Path

from content import COURSE


ROOT = Path(__file__).resolve().parent


def plain_editor_text(markdown: str) -> str:
    text = re.sub(
        r'<div[^>]*dir="rtl"[^>]*>(.*?)</div>',
        lambda match: f"\n{match.group(1).strip()}\n",
        markdown,
        flags=re.DOTALL,
    )
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("**", "").replace("`", "")
    lines: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            if lines and lines[-1] != "":
                lines.append("")
            continue
        if line.startswith("## "):
            lines.append(line[3:].upper())
            lines.append("")
            continue
        if line.startswith("|"):
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            if cells and all(re.fullmatch(r"[-:]+", cell) for cell in cells):
                continue
            lines.append("  ·  ".join(cells))
            continue
        if line.startswith("*") and line.endswith("*"):
            lines.append(f"— {line.strip('*')}")
            continue
        lines.append(line)
    return "\n".join(lines).strip()


payload = {
    "chapters": [
        {
            "title": chapter["title"],
            "lessons": [
                {
                    "title": item["title"],
                    "body": plain_editor_text(item["body"]),
                    "notes": plain_editor_text(item["instructor_notes"]),
                    "preview": bool(item["include_in_preview"]),
                }
                for item in chapter["lessons"]
            ],
        }
        for chapter in COURSE["chapters"]
    ]
}

(ROOT / "browser_payload.json").write_text(
    json.dumps(payload, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print(f"Exported {sum(len(chapter['lessons']) for chapter in payload['chapters'])} lessons")
