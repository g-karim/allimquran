# ALLIM Quran

[Русский](README.ru.md) · [Website](https://allimquran.com) · [Contributing](CONTRIBUTING.md)

ALLIM Quran is a non-commercial, community-built project for learning and
memorizing the Quran. Its goal is to bring recitation practice, memorization,
review, Quranic Arabic and source-attributed explanations into one learning path.
The project is independent of Tarteel AI.

## Current stage

This repository contains the initial **Frappe application foundation**, version
`0.0.1`. It provides package metadata, the `ALLIM Quran` module, directories for
future features, contributor documentation and a GitHub Actions workflow template.

The existing website prototype stores its pages in the site's Frappe database
and uses a separate speech-recognition service. Those implementations have not
been migrated into this repository yet. Installing this release registers the
application; it does not create the Companion UI, import courses, change the
homepage or install an ASR model.

## Installation

Use an existing Frappe **version-16** development bench with **Python 3.14**.
Frappe and its database/Redis services are managed by Bench, not by this package.
Run these commands from the bench directory, replacing `your-site.localhost`
with your development site's name:

```sh
bench get-app --branch main --skip-assets https://github.com/g-karim/allimquran.git
bench --site your-site.localhost install-app allimquran
bench --site your-site.localhost list-apps
```

This initial release has no compiled frontend assets. LMS, payments and speech
recognition are not required to install the foundation.

## Structure

```text
allimquran/
  hooks.py          Application metadata and future Frappe hooks
  modules.txt       Module registration
  allim_quran/      Future DocTypes, Desk pages and workspaces
  config/           Application configuration
  patches/          Future data migrations
  patches.txt       Ordered migration registry
  public/           Future browser assets
  templates/        Shared Jinja templates
  www/              Future website routes
docs/
  architecture.md   Current boundaries and migration direction
```

## Development checks

From the repository root, with Python 3.14:

```sh
python -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/ruff check .
.venv/bin/ruff format --check .
.venv/bin/python -m build
```

The template at [`.github/checks.yml.example`](.github/checks.yml.example) performs
these checks and imports the built package in a clean directory. To enable CI,
publish it as `.github/workflows/checks.yml` using credentials allowed to create
workflows. CI is not active in this foundation release because the bootstrap
authorization did not include that permission.

The workflow does not deploy to production or claim to validate Quran recitation
accuracy. Behavioral tests will accompany the features they verify.

## Roadmap

- Move the existing website and Companion into versioned app modules and assets.
- Introduce account-backed learning progress and explicit device-data migration.
- Version the ASR integration and evaluate it on reviewed recitation samples.
- Expand attributed translations, word analysis and tafsir with human review.
- Connect real learning programs and teacher workflows.

Contributions in English or Russian are welcome through issues and pull requests.
See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change.

## License

The code in this repository is licensed under the [MIT License](LICENSE).
Quran editions, translations, tafsir, audio, fonts and model weights have their
own attribution and licensing requirements; the code license does not relicense
those materials.
