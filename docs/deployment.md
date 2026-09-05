# Deployment and recovery

These commands change the selected site. Use a development site first, check Git
status and site identity, and take a database + public/private file backup.
Do not use an unrelated site's data or change a shared bench's other apps.

## Frappe source deployment

From the bench directory, as its owner:

```sh
bench --site SITE backup --with-files --compress
git -C apps/allimquran status --short --branch
git -C apps/allimquran pull --ff-only
./env/bin/pip install --no-deps -e apps/allimquran
bench --site SITE execute allimquran.setup.preflight
bench build --app allimquran
bench --site SITE execute allimquran.setup.sync
```

Replace SITE explicitly. The scoped sync adopts the inquiry schema and imports
app-owned website source. Normal future `bench --site SITE migrate` also uses the
before/after-migrate hooks. Do not use a shared `bench update` just for this app.
The app needs the usual `sites/assets/allimquran -> apps/allimquran/allimquran/public`
asset link created by Bench; there is no compiled JS/CSS build in this release.

Preflight deliberately fails if managed records were edited since the source
snapshot/last deployment. Reconcile those changes into Git, back up again and
rerun. Never override the guard simply to make a deployment finish.

If Desk edits also reintroduced legacy `/files/allim-*` URLs, reconcile in two
steps: import the reviewed export with `scripts/import_snapshot.py SNAPSHOT
--keep-media-paths` and verify that preflight reports no document changes before
syncing that exact source. Then import the same snapshot normally and deploy the
asset URL changes through the usual guard. This adopts the reviewed live content
without overwriting it or resetting drift fingerprints. Keep the snapshot private
and stop if live source changes again between these steps.

The first migration preserves the `ALLIM Trial Lesson Request` table, record names,
all existing inquiries and permissions. It changes schema ownership from a custom
LMS DocType to a standard ALLIM DocType. It never imports personal inquiries.

## Optional ASR / nginx

The provided systemd unit targets a conventional `/home/frappe/frappe-bench`
checkout and existing `/opt/allim-asr` environment. Review those paths for your
host. Keep model files and secrets outside the repository. A non-versioned
`/etc/allimquran/asr.env` may override deployment environment variables.

Back up the existing unit, nginx runtime config, Bench config, ASR source and
requirements before replacing them. As root, from the app checkout:

```sh
install -m 0644 deploy/allim-quran-asr.service /etc/systemd/system/allim-quran-asr.service
install -d -m 0755 /etc/nginx/snippets
install -m 0644 deploy/nginx-api.conf /etc/nginx/snippets/allimquran-api.conf
/home/frappe/frappe-bench/env/bin/python deploy/configure_nginx.py \
  /etc/nginx/conf.d/frappe-bench.conf --site SITE \
  --snippet /etc/nginx/snippets/allimquran-api.conf
/home/frappe/frappe-bench/env/bin/python deploy/configure_nginx.py \
  /home/frappe/frappe-bench/config/nginx.conf --site SITE \
  --snippet /etc/nginx/snippets/allimquran-api.conf
systemd-analyze verify /etc/systemd/system/allim-quran-asr.service
nginx -t
systemctl daemon-reload
systemctl restart allim-quran-asr
systemctl reload nginx
```

`configure_nginx.py` makes timestamped backups and edits only the named HTTPS
server. Run it again after `bench setup nginx`, which regenerates the config.
Do not reload if validation fails. Keep port 4175 loopback-only. The read-only bind
mount runs source from this repository without moving caches or weakening access
to site private files. No shared Frappe worker restart is needed for source sync.

## Verify

Check `/`, `/learn`, `/academy`, all blog languages, the three trial-form routes,
`/home` redirect, the unpublished draft (404), app media, sitemap and robots.
Verify ASR ready and Quran API responses. Perform read-only browser checks at
desktop/mobile widths, compare against pre-deployment results, and verify other
sites/processes on the shared bench. Do not submit fake production inquiries.

Run sync a second time: its `updated` array should be empty. Inspect the trial
request count and role permissions without printing private record contents.

Also check `/lms/courses`: one canonical URL, title and JSON-LD graph, unchanged
LMS compiled assets and working client navigation. The app's site-local renderer
adds search presentation without modifying LMS. For a legacy deployment with
manual ALLIM edits in `lms/www/_lms.py` and the ignored built `_lms.html`, first
back up both files and verify output parity with the app renderer, then remove
only those exact migrated edits. Never discard unrelated LMS changes or rebuild
a shared frontend merely to remove them.

## Recovery

Retain the pre-migration Git revision and source-only export outside Git, alongside
the complete site backup. If a schema import fails, a DDL commit may already have
occurred even though source DML rolls back. Inspect state; do not assume rollback
of DDL. Restore the exact previous unit and nginx configs from backup if needed,
validate, daemon-reload and restart only the ASR service.

For page-only rollback, reapply the pre-change source-only export through Frappe
after checking for subsequent edits; this preserves new inquiries and users.
Do not restore the whole database over new production data without explicit
approval. Use a previous source release or a forward-fix commit rather than a
destructive Git reset. The migration leaves original site public files and the
legacy `/opt/allim-asr/asr` source in place for recovery; they are no longer the
authoritative editable source after activation.
