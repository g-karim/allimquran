# ALLIM Quran

[Русский](README.ru.md) · [Website](https://allimquran.com) · [Contributing](CONTRIBUTING.md)

A non-commercial, community-built Quran learning and memorization project,
independent of Tarteel AI. This is an early prototype, not a certified tajwid assessor.

## What is included — 0.1.0

- Landing page, Quran Companion, Academy and English/Russian/Arabic/Turkish blog:
  23 published pages plus one unpublished design draft.
- Three localized trial-lesson forms and the standard ALLIM Trial Lesson Request DocType.
- HTML, CSS, JavaScript, SEO metadata, redirects and public website defaults.
- Project logos, Literata font, Companion demos and the four-language
  Quran-in-heart film, with posters and subtitles.
- Standalone FastAPI speech-recognition and Quran-content API source,
  nginx/systemd configuration, migration guards and tests.
- Search Intelligence: four app-owned DocTypes, an administrative Desk page,
  public-route audits, LMS SEO helpers and the existing daily audit hook.

Existing behavior and browser storage keys are preserved. Progress remains
browser-local. Users, inquiries, courses and enrollments stay in the site database;
they are not in this repository. Credentials, private files, recordings and model
weights are excluded.

## Installation

Use a Frappe v16 / Python 3.14 development bench with the open-source `lms` app
installed on the target site. Back up any existing site first: installation creates
ALLIM pages and sets the public homepage and website defaults.

```sh
bench get-app --branch main https://github.com/g-karim/allimquran.git
bench --site your-site.localhost install-app allimquran
bench build --app allimquran
```

ASR is optional and runs in a separate environment, not in Frappe workers.
See [deployment](docs/deployment.md) and [ASR](services/asr/README.md).
The app does not install a model, demo courses or demo users.

Recognition quality work: [stage 1](docs/recognition-stage1.md) and the
[private evaluation/annotation workflow](docs/recognition-stage2.md) (Russian).
Engineering audio controls are not a learner benchmark; private recordings never
belong in this public repository.

## Source layout

```text
allimquran/
  website_content/pages/<route>/   page.json + HTML/CSS/JS source
  website_content/forms/<route>/   localized form source
  website_content/settings.json   public defaults only
  website_content/route_meta.json  SEO metadata
  allim_quran/doctype/             standard schemas/controllers
  public/media/                   public project assets
  asr/server.py                   speech and Quran-content APIs
  search_intelligence.py          existing search audits and SEO integration
  lms_renderer.py, lms_template.py app-owned LMS search presentation
  source.py, setup.py              guarded source synchronization
deploy/                           nginx/systemd configuration
scripts/                          export, migration and browser checks
tests/                            source, API and configuration tests
```

Frappe still serves native Web Page and Web Form records; Git is now their source
of truth. Installation and migration synchronize source files into these records.
Direct Desk edits are detected and must be reconciled before the next deployment.

```sh
bench --site your-site.localhost execute allimquran.setup.preflight
bench --site your-site.localhost execute allimquran.setup.sync
```

## Checks

From the repository root, with Python 3.14 and Node.js:

```sh
python -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/ruff check .
.venv/bin/ruff format --check .
.venv/bin/python -m unittest discover -s tests -v
node --test tests/recitation.test.cjs
.venv/bin/python scripts/check_javascript.py
.venv/bin/python -m build
```

API tests mock the model and upstream service; they do not assess recognition
quality. Audio boundary/cleanup tests also require ffmpeg. The browser smoke
scripts require Playwright and Chrome. See the [stage-one recognition checks and
limitations](docs/recognition-stage1.md), including the isolated fake-microphone
script `node scripts/recognition_browser_smoke.mjs`.

GitHub Actions is not active. A template is at
[.github/checks.yml.example](.github/checks.yml.example); activation requires
GitHub workflow permission. The template never deploys to production.

## Next steps

Account-backed progress with explicit local-storage import, real Academy programs,
teacher workflows, reviewed recitation evaluations and attributed content.
Feature development should now happen in this repository.

## License

Code: [MIT](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md).
Code licensing does not relicense Quran editions, translations, tafsir, audio,
branding, fonts or model weights.
