from __future__ import annotations

import json
import os
import pwd
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


BENCH = Path("/home/frappe/frappe-bench")
APP = BENCH / "apps" / "allimquran"
LMS_APP = BENCH / "apps" / "lms"
RELEASE = Path("/tmp/allim-search-visibility-release")
BACKUP_ROOT = BENCH / "sites" / "deploy-backups"
HOOKS_MARKER = "# ALLIM SEARCH INTELLIGENCE START"
PY_CONTEXT_MARKER = "# ALLIM SEARCH CONTEXT"
HTML_HEAD_MARKER = "<!-- ALLIM SEARCH HEAD START -->"


def require_clean_tree() -> None:
    result = subprocess.run(
        ["sudo", "-u", "frappe", "git", "status", "--short"],
        cwd=APP,
        text=True,
        capture_output=True,
        check=True,
    )
    changes = [line[3:].strip() for line in result.stdout.splitlines() if line.strip()]
    if not changes:
        return
    allowed_prefixes = {
        "allimquran/hooks.py",
        "allimquran/search_intelligence.py",
        "allimquran/allim_quran/page/",
        "allimquran/allim_quran/doctype/allim_search_",
    }
    unexpected = [path for path in changes if not any(path == prefix or path.startswith(prefix) for prefix in allowed_prefixes)]
    hooks = (APP / "allimquran" / "hooks.py").read_text(encoding="utf-8")
    if unexpected or HOOKS_MARKER not in hooks:
        raise RuntimeError("The allimquran app working tree contains unrelated changes; deployment stopped to protect them.")


def copy_release_file(relative: str, backup_dir: Path) -> None:
    source = RELEASE / relative
    target = APP / relative
    if not source.is_file():
        raise RuntimeError(f"Missing release file: {source}")
    if target.exists():
        backup = backup_dir / "app" / relative
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, backup)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def backup_file(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def patch_hooks(backup_dir: Path) -> None:
    path = APP / "allimquran" / "hooks.py"
    source = path.read_text(encoding="utf-8")
    backup_file(path, backup_dir / "vendor-and-hooks" / "allimquran-hooks.py")
    if HOOKS_MARKER in source:
        return
    old = 'after_migrate = "allimquran.setup.sync"'
    new = '''after_migrate = [
    "allimquran.setup.sync",
    "allimquran.search_intelligence.after_migrate",
]

# ALLIM SEARCH INTELLIGENCE START
scheduler_events = {
    "daily_long": ["allimquran.search_intelligence.run_scheduled_audit"],
}
update_website_context = ["allimquran.search_intelligence.extend_website_context"]
# ALLIM SEARCH INTELLIGENCE END'''
    if old not in source:
        raise RuntimeError("Expected after_migrate hook was not found; deployment stopped.")
    path.write_text(source.replace(old, new, 1), encoding="utf-8")


def patch_lms_context(backup_dir: Path) -> None:
    path = LMS_APP / "lms" / "www" / "_lms.py"
    source = path.read_text(encoding="utf-8")
    backup_file(path, backup_dir / "vendor-and-hooks" / "lms-_lms.py")
    if PY_CONTEXT_MARKER in source:
        return
    old = '\tcontext.meta = get_meta(app_path, title, favicon)\n\tcontext.title = title'
    new = '''\tcontext.meta = get_meta(app_path, title, favicon)
\t# ALLIM SEARCH CONTEXT
\tfrom allimquran.search_intelligence import build_lms_seo_context
\tcontext.seo = build_lms_seo_context(app_path, context.meta, context.boot)
\tcontext.title = title'''
    if old not in source:
        raise RuntimeError("Expected LMS context block was not found; deployment stopped.")
    path.write_text(source.replace(old, new, 1), encoding="utf-8")


def patch_lms_template(backup_dir: Path) -> None:
    path = LMS_APP / "lms" / "www" / "_lms.html"
    source = path.read_text(encoding="utf-8")
    backup_file(path, backup_dir / "vendor-and-hooks" / "lms-_lms.html")
    if HTML_HEAD_MARKER not in source:
        old_head = '''\t\t<title>{{ title | e }}</title>
\t\t<meta name="title" content="{{ meta.title | e }}" />
\t\t<meta name="image" content="{{ meta.image | e }}" />
\t\t<meta name="description" content="{{ meta.description | e }}" />
\t\t<meta name="keywords" content="{{ meta.keywords | e }}" />
\t\t<meta property="og:title" content="{{ meta.title | e }}" />
\t\t<meta property="og:image" content="{{ meta.image | e }}" />
\t\t<meta property="og:description" content="{{ meta.description | e }}" />
\t\t<meta name="twitter:title" content="{{ meta.title | e }}" />
\t\t<meta name="twitter:image" content="{{ meta.image | e }}" />
\t\t<meta name="twitter:description" content="{{ meta.description | e }}" />'''
        new_head = '''\t\t<!-- ALLIM SEARCH HEAD START -->
\t\t<title>{{ seo.title | e }}</title>
\t\t<meta name="description" content="{{ seo.description | e }}" />
\t\t<meta name="robots" content="{{ seo.robots | e }}" />
\t\t<link rel="canonical" href="{{ seo.canonical | e }}" />
\t\t<meta property="og:site_name" content="ALLIM Qur’an" />
\t\t<meta property="og:type" content="{{ seo.og_type | e }}" />
\t\t<meta property="og:title" content="{{ seo.title | e }}" />
\t\t<meta property="og:description" content="{{ seo.description | e }}" />
\t\t<meta property="og:image" content="{{ seo.image | e }}" />
\t\t<meta property="og:url" content="{{ seo.canonical | e }}" />
\t\t<meta name="twitter:card" content="summary_large_image" />
\t\t<meta name="twitter:title" content="{{ seo.title | e }}" />
\t\t<meta name="twitter:description" content="{{ seo.description | e }}" />
\t\t<meta name="twitter:image" content="{{ seo.image | e }}" />
\t\t<script type="application/ld+json">{{ seo.json_ld | safe }}</script>
\t\t<style>
\t\t\t#seo-content .allim-search-fallback{max-width:1120px;margin:0 auto;padding:clamp(32px,7vw,88px) 24px;color:#17352e;font-family:system-ui,sans-serif}
\t\t\t#seo-content .allim-search-fallback h1{font-family:Georgia,serif;font-size:clamp(2rem,5vw,4rem);line-height:1.04}
\t\t\t#seo-content .allim-search-fallback p{max-width:760px;line-height:1.65}
\t\t\t#seo-content .allim-search-fallback ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;padding:24px 0;list-style:none}
\t\t\t#seo-content .allim-search-fallback li{border:1px solid #d8e4de;border-radius:18px;padding:18px;background:#fff}
\t\t</style>
\t\t<!-- ALLIM SEARCH HEAD END -->'''
        if old_head not in source:
            raise RuntimeError("Expected LMS metadata block was not found; deployment stopped.")
        source = source.replace(old_head, new_head, 1)

    old_body = '''\t\t\t<div id="seo-content">
\t\t\t\t<h1>{{ meta.title | e }}</h1>
\t\t\t\t<p>
\t\t\t\t\t{{ meta.description | e }}
\t\t\t\t</p>
\t\t\t\t<a href="{{ meta.link | e }}">Know More</a>
\t\t\t</div>
\t\t</div>
\t\t<script>
\t\t\tdocument.getElementById('seo-content').style.display = 'none';
\t\t</script>'''
    new_body = '''\t\t\t<div id="seo-content">{{ seo.fallback_html | safe }}</div>
\t\t</div>'''
    if old_body in source:
        source = source.replace(old_body, new_body, 1)
    elif "seo.fallback_html" not in source:
        raise RuntimeError("Expected LMS fallback block was not found; deployment stopped.")
    path.write_text(source, encoding="utf-8")


def main() -> None:
    required = [
        "allimquran/search_intelligence.py",
        "allimquran/allim_quran/page/__init__.py",
        "allimquran/allim_quran/page/allim_search_center/__init__.py",
        "allimquran/allim_quran/page/allim_search_center/allim_search_center.json",
        "allimquran/allim_quran/page/allim_search_center/allim_search_center.js",
    ]
    required.extend(
        f"allimquran/allim_quran/doctype/{name}/{file_name}"
        for name in ("allim_search_audit", "allim_search_prompt", "allim_search_observation", "allim_search_opportunity")
        for file_name in ("__init__.py", f"{name}.py", f"{name}.json")
    )
    for relative in required:
        if not (RELEASE / relative).is_file():
            raise RuntimeError(f"Incomplete release: {relative}")

    require_clean_tree()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = BACKUP_ROOT / f"{timestamp}-allim-search-intelligence"
    backup_dir.mkdir(parents=True, exist_ok=False)
    for relative in required:
        copy_release_file(relative, backup_dir)
    patch_hooks(backup_dir)
    patch_lms_context(backup_dir)
    patch_lms_template(backup_dir)

    account = pwd.getpwnam("frappe")
    ownership_targets = [APP / relative for relative in required]
    ownership_targets.extend([
        APP / "allimquran" / "hooks.py",
        LMS_APP / "lms" / "www" / "_lms.py",
        LMS_APP / "lms" / "www" / "_lms.html",
    ])
    for path in ownership_targets:
        os.chown(path, account.pw_uid, account.pw_gid)
        parent = path.parent
        while parent != APP.parent and parent not in {APP, LMS_APP}:
            os.chown(parent, account.pw_uid, account.pw_gid)
            parent = parent.parent

    manifest = {
        "created_at": timestamp,
        "backup": str(backup_dir),
        "release": str(RELEASE),
        "files": required,
        "patched": [str(APP / "allimquran" / "hooks.py"), str(LMS_APP / "lms" / "www" / "_lms.py"), str(LMS_APP / "lms" / "www" / "_lms.html")],
    }
    (backup_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
