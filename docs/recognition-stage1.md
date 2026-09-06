# Recognition stage 1: reliability and honest word matching

Scope: repair the existing engine, not add user modes or replace/train a model.
This is not an acoustic pronunciation or tajwid assessor.

## Implemented boundaries

- The recognizer's top hypothesis is preserved; the expected Quran text no longer
  chooses which alternative was supposedly spoken.
- Only final hypotheses can commit recognized words, progression or success.
  `onend`, canceled requests, stale responses and old verse keys cannot grant credit.
- Exact word spelling (with limited orthographic equivalences) replaces fuzzy
  acceptance. Edit distance can indicate uncertainty, never a successful match.
  Different consonants are retained. Conflicting supplied vowels are uncertain;
  absent vowels do not prove correct pronunciation.
- Missing, reordered or unexplained extra words prevent completion. Immediate
  exact word/phrase repetitions and nearby self-corrections are tracked separately.
  Their interpretation is a text heuristic, not acoustically validated intent.
- A correction retries the unresolved tail or the whole verse; unmatched prefixes
  are not discarded. Extra words require a full retry. Interim corrections never
  mutate confirmed correction state.
- Grey means uncertain matching, red means a text mismatch, and green means word
  spelling matched. Russian, English and Arabic disclosures explicitly exclude
  pronunciation/harakat/tajwid verification.
- Auto mode can switch to server ASR after browser network/compatibility/start
  errors even when the browser exposes SpeechRecognition. Permission denial and
  silence do not trigger that fallback. Pending fallback can be canceled.
- Audio decoding, silence, weak/unrecognized audio, overload and model failures
  have distinct outcomes. A client audio-meter threshold alone cannot declare silence.
- Audio up to 60 seconds is retained, segmented at quiet pauses and transcribed.
  Longer input is explicitly rejected. Temporary uploads and WAVs are cleaned.

See the [API contract](../services/asr/README.md) for result fields and error codes.
The browser loads `public/js/recitation-core.js`; Frappe still materializes the
Companion page from `website_content/pages/learn/`.

## Important remaining limitations

Whisper Tiny and the browser recognizer may still infer canonical Quran wording
instead of an actual reading error. These patches do not solve that model problem.
Missing vowel marks, makhraj, madd, ghunnah and valid recitation variants require
later acoustic work and qualified teacher review. Conservative matching may ask
for a retry on valid reading; it must not claim a pronunciation mistake.

In particular, the installed Whisper checkpoint cannot safely merge all long,
uninterrupted audio. If a span exceeds 20 seconds without a detected safe pause,
its overlapping-window output is **uncertain preview text**, never a success.
Silence segmentation is a conservative energy heuristic, not a learned VAD.
Background noise can hide pauses. This is a deliberate fail-closed limitation,
not a claim that long-form recognition has reached the final quality target.

## Reproducible checks

Install development dependencies from `requirements-dev.txt`, plus ffmpeg and
Node.js 20+. No model download is required for the regression tests:

```sh
.venv/bin/ruff check .
.venv/bin/ruff format --check .
.venv/bin/python -m unittest discover -s tests -v
node --test tests/recitation.test.cjs
.venv/bin/python scripts/check_javascript.py
.venv/bin/python -m build
```

`tests/test_audio.py` uses generated waveforms and real ffmpeg decoding with a
mock recognizer. It checks boundaries, repeat preservation, failures, limits and
cleanup, not model accuracy. Audio tests explicitly skip if ffmpeg is absent.
Historical migration parity is opt-in via `ALLIM_MIGRATION_SNAPSHOT`; old private
migration exports are not assertions that the app must never change again.

With Playwright and Chrome installed:

```sh
node scripts/recognition_browser_smoke.mjs
```

This serves the local Companion on loopback, uses fake microphone/browser-ASR
input and mocked recognition POSTs, and checks desktop/mobile Russian, English
and Arabic feedback, fallback, correction and progression. Public content/assets
may be fetched with GET; recognition audio is never posted to production.
This does not substitute for a real learner/device quality evaluation.

## Real-model smoke, 2026-09-06

An isolated CPU process used the production cached Tiny checkpoint, without
changing/restarting the production service. Public reference input:
[Al-Husary, 1:1](https://everyayah.com/data/Husary_128kbps/001001.mp3).
Audio was not added to Git.

- One 5.12-second basmala was transcribed correctly.
- Six directly concatenated copies (30.72 seconds) produced unreliable merged
  text. The new contract correctly returned `uncertain / unsafe_audio_boundary`.
- Six copies with explicit 0.6-second pauses (34.32 seconds) retained all six
  basmalas in order under pause segmentation.
- Digital silence returned `no_speech`; no model verdict was fabricated.

This is a functional safety smoke, not a learner benchmark or a latency SLA.

## Release reconciliation, 2026-09-06

The reviewed live Home, Academy and Companion sources and the Russian translation
endpoint were adopted first. The normal synchronization guard reported 63 records,
no document changes and no updated documents. No drift fingerprints were bypassed.
The recognition patch was then merged on top, preserving translations, teacher
assessment UI, access behavior and the mobile microphone button. User Stop cancels
recording/submission, including late results; utterance-end detection submits audio.

The four-language Quran-in-heart film, posters and captions now belong to the app's
public assets. Existing site files remain available for old pages and recovery.
Unrelated API functions were verified unchanged by comparing their Python ASTs.

Release checks: 61 passing Python tests (one historical migration-parity check is
opt-in), 36 JavaScript regression tests, 11 mocked browser scenarios, 29 script
syntax checks, lint and package build. These counts do not measure learner accuracy.

Deploy the **page, asset and API together**, after a fresh full site backup and
guarded preflight. No shared Frappe/nginx restart is required; only the ASR process
needs a scoped restart. Verify the live API, website and idempotent sync afterward.

## Production verification, 2026-09-06

Application code `82a8bc8` was deployed after verified database and public/private
file backups. Only Home and Companion required native document updates; the second
sync returned `updated: []`. The ASR service alone was restarted. The model remains
`tarteel-ai/whisper-tiny-ar-quran` on CPU, with no dependency/model upgrade.

- 68 HTTP checks passed, including published/draft pages, forms, assets, protected
  endpoints, Quran APIs, LMS and the two other checked sites on the shared bench.
- 16 desktop/mobile page checks had no JavaScript errors, broken images or
  horizontal overflow. Additional reading-page checks confirmed the new matching
  core, mobile microphone control and the preserved Kuliev translation.
- Live HTTPS ASR returned `422 / invalid_audio` for corrupt input and `no_speech`
  for digital silence. The short reference basmala matched in about 1–1.3 seconds.
  Unbroken 30.72-second repetitions were explicitly uncertain; 34.32 seconds with
  pauses preserved all six basmalas (about 5 seconds processing). These are smoke
  timings, not performance guarantees or a reading-accuracy benchmark.
- The inquiry count and permissions were unchanged; shared Frappe/Redis processes
  were not restarted by this deployment. Original public files remain intact.

Reload an already-open Companion tab to load the new matching logic.
