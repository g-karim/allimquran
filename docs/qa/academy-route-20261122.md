# Academy route and account contact — 22 November 2026

The owner's 18:54:23 recording shows an authenticated Academy dashboard dominated by an initial diagnostic funnel, followed by a blank name/email trial form. Registration and optional teacher onboarding were conflated.

The dashboard now starts with the daily plan. A secondary “Level and route” action opens the existing diagnostic and saved recommendation in a separate accessible dialog. Diagnostic answers are preserved; teacher booking remains optional. The greeting is reduced to avoid dominating laptop screens. RU/EN/AR copies are included.

The three app-owned trial forms fetch only the current session's name and email. Populated fields are summarized with an edit action. Already entered values are preserved; guests, missing profiles and network errors retain editable fields. The document hook fills missing values from the current session as a server-side fallback. Consent is not preselected and no request is submitted automatically. Shared LMS code is unchanged.

Validation: three Python session-contact tests; Chromium checks in RU/EN/AR at 1440 and 390 pixels for dashboard, route dialog, diagnostic save/retake/cancel; contact prefill/edit, existing input, guest and offline fallbacks in all three languages. Visual screenshots reviewed for desktop dashboard and mobile route result. No real trial request submitted. Full site permissions, document insert and notification integration require deployment smoke testing by the reviewer.

Deploy the Python module/controller and all three form scripts together with the Academy HTML/CSS/JS using the existing content sync process. No data migration or reset is required. Keep the new endpoint authenticated; it accepts no user identifier. Confirm with two different test accounts that each sees only its own contact information.

The 18:54:23 recording was also transcribed locally (Russian commentary; no audio uploaded). Around 03:03–03:35 the owner asks to show initial diagnostics only when needed; 03:35–04:43 identifies duplicate contact entry. Earlier commentary asks to remove the persistent data banner. The banner is now opened from the existing header status, with a compact mobile data button and visible conflict/error indicator. Keyboard activation/Escape and panel access were added to the RU/EN/AR desktop/mobile browser checks. Data resolution and deletion behavior are unchanged. Raw recording/transcript are not included in the repository.
