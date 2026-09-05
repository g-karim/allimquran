# Architecture and migration direction

## Foundation release: 0.0.1

`allimquran` is a Frappe version-16 application. Its initial module is
`ALLIM Quran`, located in `allimquran/allim_quran/`.

The foundation registers application metadata and the module. It has no custom
DocTypes, request handlers, scheduled jobs, installation callbacks or fixtures.
It does not override another app or claim existing website routes.

## Existing prototype

The live prototype currently has these boundaries:

| Component | Current owner |
| --- | --- |
| Landing page, Companion, student cabinet and articles | Frappe `Web Page` records in the site's database |
| Authentication, courses and course enrollment | Frappe and LMS |
| Companion progress and personal plan | Browser storage |
| Quran page and word data | Separate HTTP service proxying Quran Foundation data |
| Server speech recognition | Separate FastAPI service using a Quran Whisper model |
| Public media | Site files and external recitation/font providers |

The initial repository contains the foundation only. A fresh installation does
not reproduce the live prototype.

## Where new code belongs

- Put website routes in `allimquran/www/`, shared markup in `templates/`, and
  browser assets in `public/`.
- Put app-owned DocTypes and Desk pages in `allimquran/allim_quran/`.
- Add versioned data migrations to `patches/` and register them in `patches.txt`.
- Add optional integrations with explicit requirements when their features land.
  The base app should remain installable without private apps or production data.

## Planned migration

First export and review the existing page source, split shared code into modules,
and establish reproducible builds and checks. Transfer route ownership with a
documented rollback and preserve the current URLs and learning state.

Next define account-backed progress, permissions and a versioned import from
browser storage. The speech-recognition service can then be versioned with
documented requests, resource limits and a reviewed evaluation set.

Operational configuration must be reproducible without embedding deployment
hosts, credentials or site data in this public repository. Production-specific
backups and rollback records stay outside Git.
