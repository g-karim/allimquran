# Continuous Mushaf reading regression — 22 November 2026

Owner report: 91:1 stays highlighted and 91:2 is not accepted while reading continuously.

## Reproduced causes

- `align(['وَٱلشَّمۡسِ','وَضُحَىٰهَا'], 'والشمس وضحاها', true)` returned uncertain. The small alif above alif maqsura was removed or expanded incorrectly; likewise `تَلَىٰهَا` versus `تلاها`.
- A finalized utterance containing 91:1 and 91:2 was evaluated against 91:1 alone, making the following ayah extra words.

## Changes

Normalize the explicit `ىٰ` spelling to alif in the expanded spelling comparison. Bare maqsura and different consonants remain distinct. Split a finalized utterance only when the complete current ayah matches and the following text starts with the exact first word of the next loaded Mushaf ayah. Carry the actual remaining transcript to that ayah; incomplete text cannot earn completion credit. Intermediate hypotheses cannot advance. Delayed continuation checks the selected ayah, session and request identity. No stored progress migration or reset.

Bump recitation-core asset query version to v3 alongside the page JS update.

## Validation

- 66 Node tests: recognition, opening-letter groups, account progress and journal.
- Actual page browser harness (`scripts/check_reading_fixes.cjs`), synthetic Arabic page fixture and mocked SpeechRecognition: desktop 1440 and mobile 390; 91:1 -> 91:2 -> 91:3, pause within 91:2, resumed microphone, two ayahs in one final utterance, interim guard, partial continuation and exactly one journal event per completed ayah.
- Existing harness: 18 RU/EN/AR layouts, directional navigation, dock controls, pause handling and explicit skip without credit.

## Deployment and limits

PR #7 remains the handoff to g-karim. No production deployment performed. Changes are client logic only; no database migration. Publish the page JS and versioned core asset together, then verify the deployed revision.

These tests do not establish microphone/ASR accuracy, tajwid assessment or superiority to another app. Karim should check real speech on desktop Chrome and physical iOS/Android, including 91:1–3, 112:1, silence, stop/manual navigation, and account persistence. The continuation split is limited to the next ayah already loaded on the current Mushaf page; a single ASR utterance spanning an unloaded page boundary remains a separate limitation.
