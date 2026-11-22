# Reading reliability and printed-page layout — 22 November 2026

## Reproduced defects and changes

- Hidden-memory capture restarts discarded recognized words. Preserve confirmed positions across silence and capture restarts; only a new repetition resets the attempt.
- Accept final-word stopping spelling (including `أَحَدْ`) without accepting changed consonants, incomplete words or interim results as completion. This is word recognition, not pronunciation/tajwid certification.
- Refresh the hidden exercise after a remote verse selection, invalidate older requests even when the newer selection is local, and prevent starting the previously loaded verse while selection is pending.
- Starting the selected exercise opens its panel and focuses the verse reference. The selected 93:2 and both answer words are covered in the browser check.
- Use edition-specific glyph, page and line metadata. Page 595 previously mixed V1 verse selection with V2 positions: parts of Al-Layl could precede Ash-Shams. Normalize by edition and filter only displayed words; retain the complete verse for recognition.
- Default to a fitted printed page on desktop and mobile. Zoom scales the page without changing line breaks. Existing saved adaptive preference is respected. Panning while zoomed does not turn pages.
- Keep a compact reading toolbar and microphone dock; secondary selectors, journal and storage controls move into the settings menu and return to their original locations on exit.

## Evidence and validation

Visual frames reviewed from owner recordings 18:37:24 and 18:49:19. The latter visibly keeps 93:2 selected; a surah switch was not proved by those frames. A stale-selection race was found separately in code. Audio narration was not transcribed for these two recordings.

- 79 Node tests passed (recitation and Mushaf comfort).
- 3 Python endpoint-body tests passed: edition-specific 595/596 metadata, cross-page verse preservation, locate validation. These isolate shipped functions with mocked transport; they are not a full ASR HTTP service test.
- Chromium browser checks passed: 18 RU/EN/AR viewport combinations (320–1440px, including landscape), no document overflow, physical RTL page navigation, control restoration, four silence restarts, skip without credit, consecutive Ash-Shams ayahs, combined final utterance and interim guards.
- Hidden memory tested at desktop/mobile sizes with prefix → capture end → `أَحَدْ`, and selected 93:2. Browser speech events are simulated, not real microphone recordings.
- Real V1 page 595 fixture and page font visually checked at 1440 and 390px. Zoom preserves every line. Screenshots: `/tmp/allim-book-1440.png`, `/tmp/allim-book-390.png` on the QA machine.
- `git diff --check` passed.

Source: https://api-docs.quran.foundation/docs/tutorials/fonts/font-rendering/ and https://api-docs.quran.foundation/docs/tutorials/fonts/page-layout/ . V1 uses mushaf 2; V2 uses mushaf 1. Legacy by-page verse selection was checked against public page 595 responses. V2 reads adjacent source pages and filters explicit edition metadata; all 604 pages have not been exhaustively verified.

## History and release boundary

The faulty memory-reset behavior already exists in the earliest imported website source (`50a0942`). Available Git history therefore does not establish when the owner-observed regression first entered the live application. It must not be attributed to a specific later change without the earlier deployed source/audio comparison.

Upstream now contains `24a9b74`, a separate integration of quiet recall and compact Mushaf work. This task remains on the owner-approved base; no automatic rebase or production overwrite was performed. Reviewer must reconcile overlapping reader changes, preserving upstream retry limits, dialog shortcuts and live settings drawer behavior.

Deploy the page CSS/JS and ASR page/locate endpoint changes together. New edition cache names avoid reusing stale page metadata. No account schema migration or progress reset is included. Follow the existing application page sync/deployment workflow, then verify the deployed revision.

Before release acceptance, test real microphone capture on desktop Chrome/Safari and physical iPhone/Android: hidden 112:1 with a pause before the last word, 93:2, 91:1–3 continuously, page boundary, microphone permission denial/retry, existing saved progress and all three languages. Also compare actual audio against the previous working deployment if available. Do not infer ASR accuracy or production readiness from simulated transcripts.

After deepening Git history, `82a8bc8` was identified as the change from approximate text matching (threshold 0.72 for browser results, 0.8 for server results) to strict word-sequence comparison. That is a plausible contributor to perceived recognition regression: ASR output can be rejected despite matching the intended word under legitimate stopping/orthographic variants. This is a code-history finding, not proof of the exact live regression date. Restore documented equivalences and capture continuity; do not restore fuzzy acceptance of changed consonants.
