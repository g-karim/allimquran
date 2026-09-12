# Closed teacher review queue

`/teacher` is a website page, not Desk. Explicit role `ALLIM Recitation Reviewer`
(no Desk access), plus the Administrator account, can use it. Ordinary LMS
instructors, students and guests cannot read recordings. Grant roles deliberately;
do not change an existing account's user type just to make it a reviewer.

## Workflow

1. New consented clips appear as **pending**. Audio is normalized mono WAV, at
   most 60 seconds. Professional reference recordings remain a separate private
   baseline; they are not silently imported as learner contributions.
2. The teacher listens and writes verbatim speech, the expected audible fragment,
   riwayah, verdict, optional quality tags and errors. Model predictions are not
   shown, to reduce anchoring. Word numbers in the UI start at one; stored
   `word_index` starts at zero. Only insertion may point after the last word.
   Error times are relative to the clip and stored as integer milliseconds.
3. Drafts are not ground truth. Final incorrect verdicts require an error;
   unscorable clips require an explanation, never invented speech. Self-correction
   is a tag; annotate remaining errors, preserving repeats in the transcript.
4. **Disputed** requires a comment and a different reviewer to become
   **adjudicated**. A draft cannot bypass that requirement. Optimistic revisions
   reject competing writes (409); they never overwrite silently. Up to 200
   revisions per recording bound history growth.
5. Use independently reviewed material later to measure WER/CER, false positives,
   missed errors and false accepts. No public export or training is enabled here.
   The private evaluation manifest adapter and a sufficiently varied, independently
   reviewed test set are separate next steps. Do not report Tarteel parity from
   queue size, professional audio, synthetic tests or matching word percentages.

## Privacy boundary

- SQLite `reviews` and `review_history` reference `clips` with `ON DELETE CASCADE`.
  Consent withdrawal removes audio and annotations in the same transaction;
  existing expiry maintenance also removes both. Schema additions are additive.
- Every list/detail/audio/write checks active, unexpired, current-version consent.
  Every Frappe request checks the enabled user and current role in the database.
  ASR sees an HMAC reviewer pseudonym, not their email. Contributor/account/IP
  data are not added. A browser consent key is not proof of distinct human identity.
- Private WAV bytes cross only the loopback bridge and the authorized HTTPS
  response; no Frappe File, disk copy, localStorage, IndexedDB or export is created.
  Responses use `private, no-store`. Browser blob URLs are revoked on selection
  change, completion and page exit. An open clip revalidates every 20 seconds and
  on returning to the tab. An outage fails closed and may discard unsaved work.
- A voice is potentially identifying. No web UI can prevent an authorized listener
  from copying or recording it, or revoke what they already heard. Teach reviewers
  to avoid names in annotations and to never send clips to external services.
- No durable audio backup/export was added: an independent backup would need its
  own expiry/withdrawal handling. Do not include the corpus in public backups.

## Deployment

1. Back up the site's database/configuration and verify `allimquran.setup.preflight`.
   Deploy the app's source and plain assets, then run `allimquran.setup.sync`.
2. Run `allimquran.review_portal.ensure_role` from the site bench. Install/migrate
   also creates the role but never assigns it to users.
3. Generate one random 256-bit secret **on the server**. Set the site's private
   `allim_review_secret` to its 64-character hexadecimal value. Put the same value
   as `QURAN_REVIEW_SECRET` in `/etc/allimquran/review.env`, root-owned mode 0600.
   Never put it in git, browser boot, shell arguments or logs.
4. Install `deploy/asr-review.conf` as the ASR systemd review drop-in, daemon-reload
   and restart **only** `allim-quran-asr.service`. The existing service is bound to
   loopback. The internal `/internal/review` endpoint additionally requires the
   shared secret. Do **not** proxy `/internal/` in nginx.
5. Clear only the ALLIM site's caches; assign the new reviewer role to the agreed
   account. A Website User can review without Desk or broad LMS admin roles.
6. Verify guest denial, authenticated role denial, CSRF denial, permitted review,
   conflict rejection, withdrawal cascade, no-store headers and ASR health. Use
   generated silence, not a real contributor's recording, for deployment tests.

Rollback: restore the previous app source and source-managed page snapshots;
disable/remove the review secret/drop-in and reviewer role assignments as needed.
The two additive private tables can remain for recoverability; do not restore an
old corpus backup that could resurrect withdrawn audio. If restoring site DB,
account for legitimate newer user/learning changes first.

## Verification

```sh
python -m unittest discover -s tests -v
node --test tests/recitation.test.cjs
node scripts/teacher_browser_smoke.mjs
node scripts/contribution_browser_smoke.mjs
node scripts/recognition_browser_smoke.mjs
```

Browser tests use isolated mocked APIs and synthetic audio. Local tests do not
prove production permissions, account onboarding or recognition accuracy; those
must be reported separately.
