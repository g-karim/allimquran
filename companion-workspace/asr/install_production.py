from __future__ import annotations

import os
import pwd
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


SERVICE_USER = "allim-asr"
APP_ROOT = Path("/opt/allim-asr")
UNIT_TARGET = Path("/etc/systemd/system/allim-quran-asr.service")
NGINX_CONFIG = Path("/etc/nginx/conf.d/frappe-bench.conf")
BACKUP_ROOT = Path("/root/deploy-backups")
MARKER_START = "\t# ALLIM_QURAN_ASR_BEGIN"
MARKER_END = "\t# ALLIM_QURAN_ASR_END"


def ensure_user() -> tuple[int, int]:
    try:
        account = pwd.getpwnam(SERVICE_USER)
    except KeyError:
        subprocess.run(
            [
                "useradd",
                "--system",
                "--home-dir",
                str(APP_ROOT),
                "--shell",
                "/usr/sbin/nologin",
                SERVICE_USER,
            ],
            check=True,
        )
        account = pwd.getpwnam(SERVICE_USER)
    return account.pw_uid, account.pw_gid


def server_block(text: str, domain: str) -> tuple[int, int]:
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


def install_nginx_route(snippet: str) -> None:
    text = NGINX_CONFIG.read_text(encoding="utf-8")
    start, end = server_block(text, "allimquran.com")
    block = text[start:end]
    marked = MARKER_START + "\n" + snippet.strip() + "\n" + MARKER_END
    if MARKER_START in block:
        before, remainder = block.split(MARKER_START, 1)
        _, after = remainder.split(MARKER_END, 1)
        updated_block = before + marked + after
    else:
        location_at = block.find("\tlocation / {")
        if location_at < 0:
            raise RuntimeError("Could not find root location in allimquran.com server block")
        updated_block = block[:location_at] + marked + "\n\n" + block[location_at:]
    updated = text[:start] + updated_block + text[end:]
    temporary = NGINX_CONFIG.with_suffix(".conf.allim-new")
    temporary.write_text(updated, encoding="utf-8")
    os.chmod(temporary, NGINX_CONFIG.stat().st_mode)
    os.replace(temporary, NGINX_CONFIG)


def main() -> None:
    if os.geteuid() != 0:
        raise RuntimeError("Run as root")
    release = Path(sys.argv[1]).resolve()
    source = release / "asr"
    required = [
        source / "server.py",
        source / "requirements.txt",
        source / "allim-quran-asr.service",
        source / "nginx-allim-asr.conf",
    ]
    if not all(path.is_file() for path in required):
        raise RuntimeError("Incomplete ALLIM ASR release")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = BACKUP_ROOT / f"{timestamp}-allim-asr"
    backup.mkdir(parents=True, exist_ok=False)
    shutil.copy2(NGINX_CONFIG, backup / NGINX_CONFIG.name)
    if UNIT_TARGET.exists():
        shutil.copy2(UNIT_TARGET, backup / UNIT_TARGET.name)
    if (APP_ROOT / "asr").exists():
        shutil.copytree(APP_ROOT / "asr", backup / "asr")

    uid, gid = ensure_user()
    (APP_ROOT / "asr").mkdir(parents=True, exist_ok=True)
    (APP_ROOT / "cache").mkdir(parents=True, exist_ok=True)
    shutil.copy2(source / "server.py", APP_ROOT / "asr" / "server.py")
    shutil.copy2(source / "requirements.txt", APP_ROOT / "requirements.txt")
    shutil.copy2(source / "allim-quran-asr.service", UNIT_TARGET)
    install_nginx_route((source / "nginx-allim-asr.conf").read_text(encoding="utf-8"))

    for path in (APP_ROOT, APP_ROOT / "asr", APP_ROOT / "cache", APP_ROOT / "asr" / "server.py"):
        os.chown(path, uid, gid)
    os.chmod(APP_ROOT / "asr" / "server.py", 0o640)
    os.chmod(APP_ROOT / "requirements.txt", 0o644)
    os.chmod(UNIT_TARGET, 0o644)
    subprocess.run(["nginx", "-t"], check=True)
    print(f"backup={backup}")
    print(f"app_root={APP_ROOT}")
    print(f"unit={UNIT_TARGET}")


if __name__ == "__main__":
    main()
