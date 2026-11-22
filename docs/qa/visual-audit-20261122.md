# Companion visual audit — 22 November 2026

Scope: Today, Read, Memorize, Learn, Tafsir, Progress, Settings; six main dialogs. EN/AR/RU, widths 320/390/768/1440. Local guest fixtures; external requests blocked. 84 section states and 72 dialog states checked for horizontal overflow, plus visible control/text intrinsic overflow and runtime errors. Final report: no detected overflow/errors. Dialog checks use direct opening for geometry, not full feature acceptance.

Fixed mobile toggle flex sizing, truncated daily-action title, current-page launcher overflow, tablet heart-page workspace width, numeric typography. Existing recall improvements retained.

Mushaf: 18 layout checks including 1440×900 and 1280×720. Physical arrows, touch/adaptive swipes, page boundaries, full-sheet bounds above dock, pause/restart and completed-recitation automatic advance/listening resume passed. Page mode scales a complete sheet to available viewport; adaptive mode remains scrollable. Manual paging is fallback. Screenshots inspected for desktop Mushaf, mobile settings/progress/memorize/today, desktop Learn and Arabic recall.

Run `scripts/check_visual_audit.cjs`, `scripts/check_reading_fixes.cjs`, and `scripts/check_quiet_recall_browser.cjs` with Node and Playwright/Chrome. ALLIM_PLAYWRIGHT may specify the installed package; ALLIM_TEST_ARTIFACTS controls screenshot destination for visual/recall suites.

Limits: not a live authenticated account audit, real microphone accuracy test, physical iOS/Safari/Android test, installation/migration rehearsal or comparative Tarteel benchmark. Blog/LMS unchanged. No schema changes. Reviewer should validate Safari page scaling and real continuous recitation across a page boundary before deployment.

Final Hifz composition: the book is first; plan and method selection moved into a keyboard-accessible settings dialog. Practice expands on demand and on starting a session. The short recall check is separately collapsed. Settings open/close, plan disclosure and method selection checked across all 12 locale/width combinations. Final visual matrix rerun passed.
