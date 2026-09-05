# Contributing to ALLIM Quran

Issues and pull requests in English or Russian are welcome. The application is
at its migrated prototype stage; see the README for what is currently implemented.

## Workflow

1. For substantial changes, describe the problem in an issue before implementing it.
2. Fork the repository and create a focused branch.
3. Develop in a local Frappe version-16 bench using a disposable test site.
4. Edit website source under `allimquran/website_content/`, not in production Desk.
   Run the lint, unit tests, JavaScript syntax and package checks from the README.
5. Open a pull request describing the change and how you verified it. Include
   screenshots for UI changes and reproduction steps for bug fixes.

Keep each pull request focused. Add behavioral tests for new logic, permissions
and migrations. A migration should be safe to retry and preserve existing user
data. Changes to Arabic UI should be checked in RTL as well as LTR layouts.

Use `bench --site your-site.localhost execute allimquran.setup.sync --kwargs '{"dry_run": true}'`
before syncing sources. If it reports drift, reconcile the existing edits into Git first.
Do not bypass the check or export real trial-lesson requests as fixtures.

## Quran content and recitation

State the source, edition, attribution and redistribution terms for proposed
text, translations, tafsir, fonts or audio. Explanations and recitation rules
need review by a suitably qualified person. Distinguish automated word matching
from verified pronunciation or tajwid assessment.

Use public or explicitly consented samples when evaluating speech recognition.
Document the expected result, actual result and limitations of an evaluation.

## Repository data

Commit source code and reviewed public assets. Keep site configuration, tokens,
database dumps, personal learning records, private audio and model caches out of
the repository. The production site is not a contributor test environment.

## License

Contributed code is distributed under this repository's MIT License. Identify
any third-party material and its license in the pull request.
