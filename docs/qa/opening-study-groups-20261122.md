# Opening study groups — 22 November 2026

Foundation 300 and progressive 33 now study standalone opening-letter ayahs together with the following full ayah. Adjacent letter-only ayahs form one group (for example 42:1–3). Canonical verse keys, text and boundaries are unchanged. A full ayah beginning with a letter, such as 50:1, is not treated as a letter-only ayah.

The existing continuous reading pipeline advances through the group, restarts from its first ayah, and stops/advances at the method target. Completion is buffered until the last ayah: partial sequences do not create foundation credit or 33-method credit. Completed cycles emit the ordinary per-ayah facts for the actual ayahs read. Existing baselines and unequal counts are retained; a finished 33 counter stays capped while the other ayah catches up. No replacement baseline, migration, or synthetic historical credit is produced. Pausing retains the active in-memory sequence; leaving/reloading discards an unfinished cycle, preserving committed history.

Letter-name recognition accepts the full ordered spelling only for an isolated letter opening. Missing, reordered or extra names are not accepted. This is transcript matching, not acoustic tajwid assessment.

Validation:
- 24 opening/progress regression tests passed; 48 opening/recitation tests passed (overlapping suites).
- Browser: actual application with deterministic speech and page fixtures. Both 300 and 33: first ayah produces no partial credit; complete 2:1–2:2 cycle emits both facts; automatically restarts; reload retains committed events.
- Existing 18 reading layouts, pause/restart, automatic advance, skip without credit and keyboard/touch checks passed in the same browser run.
- No live microphone, server recognizer, production account, or physical device test performed. Opening group resolution requires the adjacent ayahs in the loaded page; the supported canonical isolated openings and their following ayahs use that page context. Turkish-wall and handwriting method schedules are unchanged.

Run `node --test tests/opening-study-group.test.cjs tests/recitation.test.cjs tests/account-progress.test.cjs tests/learning-progress.test.cjs` and `node scripts/check_opening_group_browser.cjs` (Playwright + Chrome).
