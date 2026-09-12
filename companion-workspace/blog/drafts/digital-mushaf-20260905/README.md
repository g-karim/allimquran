# ALLIM QURAN — digital mushaf article package

Status: editorial draft; not published.

This package contains a new, independently structured ALLIM QURAN article inspired by the problem space discussed in Tarteel's “From Page to Screen”, not a translation or rewrite of that article.

## Editorial distinction

The source article explains a rendering-engine problem: how to combine textual fidelity, familiar page geometry and fine-grained interaction. The ALLIM QURAN article takes a different position: a digital mushaf should become a calm learning surface that supports the sequence **read → understand → remember → review**, without destabilising the page a learner already knows.

The article therefore adds five ALLIM-specific ideas:

1. Two complementary views: a spatially stable page mode and an accessible ayah mode.
2. Three reversible learning layers: reading, understanding and remembering.
3. Progressive disclosure: translation, word meaning, tafsir and recitation feedback appear only when requested.
4. Honest AI language: “not verified” is never presented as “read incorrectly”.
5. A release trust protocol: source pinning, automated checks, page captures, visual diffs, expert proofreading and accessibility QA.

## Files

- `article-ru.md` — Russian master editorial version.
- `article-en.md` — global English localisation.
- `article-tr.md` — natural Turkish localisation.
- `article-ar.md` — natural Arabic localisation; publish with `lang="ar" dir="rtl"`.
- `seo-geo-aeo.md` — slugs, titles, descriptions, keyword intent, hreflang, schema and publication QA.
- `schema-*.json` — valid localised Article, BreadcrumbList and FAQPage JSON-LD payloads; add a real crawlable `image` only after the hero asset exists.

## Claim boundary

The article describes the product principles and intended direction of ALLIM QURAN. It does not claim that every described rendering, recitation-recognition or teacher-review capability is already released. Before publication, the final copy should be checked against the current public build and reviewed by a qualified Qur'an specialist for terminology related to recitation, tajwid and qira'at.

## Core sources

- [Tarteel: From Page to Screen](https://tarteel.ai/blog/from-page-to-screen-rethinking-quran-rendering-for-the-digital-age/)
- [QUL Mushaf Layout documentation](https://qul.tarteel.ai/docs/mushaf-layout)
- [Quran Foundation Page Layout API guide](https://api-docs.quran.com/docs/tutorials/fonts/page-layout/)
- [W3C Arabic and Persian Layout Requirements](https://www.w3.org/TR/alreq/)
- [Unicode Arabic Mark Rendering](https://www.unicode.org/standard/reports/tr53/)
- [W3C WCAG: Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow)
