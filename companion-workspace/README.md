# Reading journal preview

This source preview contains page and khatm tracking, manual paper-mushaf entries, illustrative letter estimates, and account-sync integration. It does not replace the deployed `learn` route.

Run from the repository root:

```sh
python3 -m venv .venv-preview
.venv-preview/bin/pip install -r companion-workspace/requirements-preview.txt
QURAN_ASR_ENABLED=0 QURAN_COMPANION_PREVIEW=1 QURAN_MUSHAF_CACHE=/tmp/allim-mushaf-cache QURAN_ASR_ALLOWED_ORIGIN=http://127.0.0.1:4187 .venv-preview/bin/python -m uvicorn allimquran.asr.server:app --host 127.0.0.1 --port 4187
```

Open `http://127.0.0.1:4187/?view=read&lang=en` (also `ar` and `ru`). Use Python 3.10 or newer. This preview serves real Quran pages and manual page logging without loading the speech model. Browser speech recognition depends on browser support. Account sync requires installation of the new schema and methods. A plain `http.server` cannot serve Quran API routes and causes the “page unavailable” error. Stop any existing server on port 4187 before starting this one.

See [account sync](../docs/reading-account-sync.md) for installation, privacy, tests, conflict handling and limits. No learner records or audio recordings are included.
