# Reading journal preview

This source preview contains page and khatm tracking, manual paper-mushaf entries, illustrative letter estimates, and account-sync integration. It does not replace the deployed `learn` route.

Run from the repository root:

```sh
python3 -m http.server 4187 --bind 127.0.0.1 --directory companion-workspace
```

Open `http://127.0.0.1:4187/?view=read&lang=en` (also `ar` and `ru`). The static preview supports manual page logging. Quran page and microphone services require the existing backend; account sync requires installation of the new schema and methods.

See [account sync](../docs/reading-account-sync.md) for installation, privacy, tests, conflict handling and limits. No learner records or audio recordings are included.
