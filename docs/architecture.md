# Architecture — migrated prototype 0.1.0

| Component | Source of truth | Runtime |
| --- | --- | --- |
| 19 pages (18 public, one draft) | website_content/pages | Native Frappe Web Page |
| Three trial forms | website_content/forms | Native Frappe Web Form |
| Inquiry schema | allim_quran/doctype | Existing table, standard app DocType |
| SEO, redirects, public defaults | website_content/*.json | Frappe settings/meta |
| Public media | public/media | /assets/allimquran/media/ |
| Speech and Quran APIs | asr/server.py | Separate FastAPI service |
| Users, requests, courses, enrollments | Site database | Frappe and LMS |
| Companion progress / personal plan | Browser storage | Existing JS |

## Deliberately preserved

This migration moves ownership, not product behavior. Large embedded prototype
data structures and inline scripts are preserved. Only project media URLs change
from /files/allim-* to app assets. HTML, CSS and JavaScript fields are separate
editable files. Document names, routes, publication flags, translations, form
permissions and storage keys (`quran-companion-prototype-v4`,
`allim-academy-plan-v1`) remain unchanged.

There is no custom router or renderer. Frappe owns rendering, authentication, CSRF
and form submission. setup.sync materializes source into native runtime documents.

## Synchronization

The preflight compares managed fields against the export baseline, the previously
installed fingerprint and desired source. Audit timestamps and random child IDs
are ignored. Unreconciled Desk edits abort before writes. A Redis lock serializes
ALLIM sync operations; records are checked again before each save. Normal Frappe
timestamp checks remain enabled.

The `allimquran_source_state` value lives in the site's DefaultValue table, not Git.
An unchanged deployment does not save documents. Site DML commits after successful
synchronization. Schema imports can execute DDL and commit, so backups are still
required. before_migrate guards before framework schema sync; after_migrate syncs
website source; after_install installs public defaults. No app hook calls systemd,
downloads a model, restarts workers or edits nginx.

The trial-request table is adopted with the same fields and record names.
System Manager permissions are preserved. Frappe supports anonymous submission;
anonymous listing and editing of stored requests remain disabled.

## Boundaries

LMS is required for Academy integration. Frappe/LMS are not vendored. Private apps
and production site configuration are not bundled. Optional ASR keeps a separate
virtual environment and model cache. Nginx exposes the existing same-origin
/api/quran-asr, /api/mushaf/* and /api/quran/words/* endpoints.

This migration does not imply a progress database, model upgrade, curriculum,
offline/PWA guarantee or theological/content audit.
