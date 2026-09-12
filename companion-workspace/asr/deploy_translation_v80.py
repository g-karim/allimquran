from __future__ import annotations

import os
import py_compile
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


SOURCE_ROOT = Path("/tmp/allim-v80-quran-translation-backend")
SERVER_SOURCE = SOURCE_ROOT / "server.py"
NGINX_SNIPPET_SOURCE = SOURCE_ROOT / "nginx-allim-asr.conf"
SERVER_TARGET = Path(
    "/home/frappe/frappe-bench/apps/allimquran/allimquran/asr/server.py"
)
NGINX_TARGET = Path("/etc/nginx/conf.d/frappe-bench.conf")
BACKUP_ROOT = Path("/root/deploy-backups")
MARKER_START = "\t# ALLIM_QURAN_ASR_BEGIN"
MARKER_END = "\t# ALLIM_QURAN_ASR_END"


def find_server_block(text: str, domain: str) -> tuple[int, int]:
    domain_at = text.index(domain)
    start = text.rfind("server {", 0, domain_at)
    if start < 0:
        raise RuntimeError(f"Could not find server block for {domain}")
    depth = 0
    for index in range(start, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return start, index + 1
    raise RuntimeError(f"Unclosed server block for {domain}")


def nginx_with_updated_routes(current: str, snippet: str) -> str:
    start, end = find_server_block(current, "allimquran.com")
    block = current[start:end]
    if MARKER_START not in block or MARKER_END not in block:
        raise RuntimeError("ALLIM Nginx route markers are missing")
    before, remainder = block.split(MARKER_START, 1)
    _, after = remainder.split(MARKER_END, 1)
    marked = f"{MARKER_START}\n{snippet.strip()}\n{MARKER_END}"
    return current[:start] + before + marked + after + current[end:]


def atomic_replace(source: Path, target: Path) -> None:
    stat = target.stat()
    temporary = target.with_name(f".{target.name}.allim-v80-new")
    shutil.copy2(source, temporary)
    os.utime(temporary, None)
    os.chown(temporary, stat.st_uid, stat.st_gid)
    os.chmod(temporary, stat.st_mode)
    os.replace(temporary, target)


def main() -> None:
    if os.geteuid() != 0:
        raise RuntimeError("Run as root")
    for path in (SERVER_SOURCE, NGINX_SNIPPET_SOURCE, SERVER_TARGET, NGINX_TARGET):
        if not path.is_file():
            raise RuntimeError(f"Required file is missing: {path}")
    if "/api/quran/translation/" not in NGINX_SNIPPET_SOURCE.read_text(encoding="utf-8"):
        raise RuntimeError("Translation route is missing from release snippet")
    py_compile.compile(str(SERVER_SOURCE), doraise=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = BACKUP_ROOT / f"{timestamp}-allim-v80-translation"
    backup.mkdir(parents=True, exist_ok=False)
    shutil.copy2(SERVER_TARGET, backup / "server.py")
    shutil.copy2(NGINX_TARGET, backup / "frappe-bench.conf")

    new_nginx = nginx_with_updated_routes(
        NGINX_TARGET.read_text(encoding="utf-8"),
        NGINX_SNIPPET_SOURCE.read_text(encoding="utf-8"),
    )
    nginx_candidate = SOURCE_ROOT / "frappe-bench.conf.candidate"
    nginx_candidate.write_text(new_nginx, encoding="utf-8")

    try:
        atomic_replace(SERVER_SOURCE, SERVER_TARGET)
        atomic_replace(nginx_candidate, NGINX_TARGET)
        subprocess.run(["nginx", "-t"], check=True)
    except Exception:
        atomic_replace(backup / "server.py", SERVER_TARGET)
        atomic_replace(backup / "frappe-bench.conf", NGINX_TARGET)
        subprocess.run(["nginx", "-t"], check=True)
        raise

    print(f"backup={backup}")
    print(f"server={SERVER_TARGET}")
    print(f"nginx={NGINX_TARGET}")


if __name__ == "__main__":
    main()
