# SEO + GEO + AEO publication pack

This is a release specification for the four article drafts. It does not mean the pages have been published.

## 1. Search intent and entity model

Primary intent: informational / educational. The reader wants to understand what a digital Mushaf is, why page layout matters, how interactive learning can coexist with textual fidelity, and what responsible AI may and may not do.

Primary entity: **digital Mushaf / цифровой мусхаф / dijital mushaf / المصحف الرقمي**.

Related entities that should appear naturally, not as a keyword list: Qur’an, Mushaf edition, Uthmani script, page layout, Arabic typography, Qur’anic annotation marks, memorisation or hifz, tajwid, qira’at, tafsir, RTL, accessibility, ALLIM QURAN.

The article must not claim that a product feature is released merely because it is part of the design vision.

## 2. Localised metadata

### English

- URL: `https://allimquran.com/blog/digital-mushaf-reading-understanding-remembering`
- SEO title: `Digital Mushaf for Learning | ALLIM QURAN`
- H1: `Beyond a page on a screen: a digital Mushaf for reading, understanding and remembering`
- Meta description: `How a digital Mushaf can preserve Qur’anic text and page memory while supporting reading, word understanding, memorisation and timely review.`
- Primary query: `digital Mushaf`
- Supporting queries: `digital Quran page layout`, `Quran app for memorisation`, `interactive Quran words`, `how digital Quran text is verified`
- OG title: `Beyond a Page on a Screen — ALLIM QURAN`
- OG description: `A product framework for a digital Mushaf that preserves textual trust and page memory while supporting understanding and recall.`
- Image alt: `A calm digital Mushaf page with optional reading, understanding and memorisation layers in ALLIM QURAN`

### Arabic

- URL: `https://allimquran.com/ar/blog/al-mushaf-al-raqami-qiraa-fahm-hifz`
- SEO title: `المصحف الرقمي للتعلّم | ALLIM QURAN`
- H1: `أبعد من صفحة على شاشة: مصحف رقمي للقراءة والفهم والحفظ`
- Meta description: `كيف يحفظ المصحف الرقمي دقة النص وذاكرة الصفحة، ويدعم القراءة وفهم الكلمات وحفظ الآيات والمراجعة في وقتها؟`
- Primary query: `المصحف الرقمي`
- Supporting queries: `تطبيق لحفظ القرآن`, `عرض صفحات المصحف`, `فهم كلمات القرآن`, `الذكاء الاصطناعي لتصحيح التلاوة`
- OG title: `أبعد من صفحة على شاشة — ALLIM QURAN`
- OG description: `رؤية لمصحف رقمي يحفظ أمانة النص وذاكرة الصفحة، ويعين على الفهم والحفظ بلا تشتيت.`
- Image alt: `صفحة مصحف رقمي هادئة مع طبقات اختيارية للقراءة والفهم والحفظ في ALLIM QURAN`

Publish the page with `<html lang="ar" dir="rtl">`. Keep Qur’anic text, translation, tafsir and UI labels in separate semantic containers. Use `dir="ltr"` locally for URLs or long Latin identifiers when needed.

### Russian

- URL: `https://allimquran.com/ru/blog/cifrovoj-mushaf-chtenie-ponimanie-zapominanie`
- SEO title: `Цифровой мусхаф для обучения | ALLIM QURAN`
- H1: `Не просто Коран на экране: цифровой мусхаф для чтения, понимания и запоминания`
- Meta description: `Как цифровой мусхаф сохраняет точность текста и память страницы, помогая читать, понимать слова, запоминать аяты и возвращаться к повторению.`
- Primary query: `цифровой мусхаф`
- Supporting queries: `Коран онлайн с переводом слов`, `приложение для заучивания Корана`, `страницы мусхафа на телефоне`, `ИИ для чтения Корана`
- OG title: `Не просто Коран на экране — ALLIM QURAN`
- OG description: `Как сохранить точность текста и память страницы, добавив понимание слов, запоминание и бережную помощь при чтении.`
- Image alt: `Спокойная страница цифрового мусхафа со слоями чтения, понимания и запоминания в ALLIM QURAN`

### Turkish

- URL: `https://allimquran.com/tr/blog/dijital-mushaf-okuma-anlama-hatirlama`
- SEO title: `Öğrenme İçin Dijital Mushaf | ALLIM QURAN`
- H1: `Ekrandaki bir sayfadan fazlası: Okumak, anlamak ve hatırlamak için dijital mushaf`
- Meta description: `Dijital mushafın Kur’an metnini ve sayfa hafızasını korurken okuma, kelime anlama, ezber ve zamanında tekrarı nasıl destekleyebileceği.`
- Primary query: `dijital mushaf`
- Supporting queries: `Kur'an ezber uygulaması`, `dijital Kur'an sayfa düzeni`, `kelime kelime Kur'an`, `yapay zekâ ile tilavet takibi`
- OG title: `Ekrandaki Bir Sayfadan Fazlası — ALLIM QURAN`
- OG description: `Metin doğruluğunu ve sayfa hafızasını korurken anlama ve hatırlamayı destekleyen dijital mushaf yaklaşımı.`
- Image alt: `ALLIM QURAN’da okuma, anlama ve hatırlama katmanları bulunan sakin bir dijital mushaf sayfası`

## 3. Canonical and hreflang

Each page has a self-referencing canonical. Every language page must include the same complete, bidirectional alternate set in the server-rendered `<head>`:

```html
<link rel="alternate" hreflang="en" href="https://allimquran.com/blog/digital-mushaf-reading-understanding-remembering">
<link rel="alternate" hreflang="ar" href="https://allimquran.com/ar/blog/al-mushaf-al-raqami-qiraa-fahm-hifz">
<link rel="alternate" hreflang="ru" href="https://allimquran.com/ru/blog/cifrovoj-mushaf-chtenie-ponimanie-zapominanie">
<link rel="alternate" hreflang="tr" href="https://allimquran.com/tr/blog/dijital-mushaf-okuma-anlama-hatirlama">
<link rel="alternate" hreflang="x-default" href="https://allimquran.com/blog/digital-mushaf-reading-understanding-remembering">
```

Do not canonicalise Arabic, Russian or Turkish to English; each is a full localisation. Add all four URLs to the XML sitemap with the same alternate cluster.

The current local blog publisher only defines EN/AR/RU in its language switch and SEO injection. Turkish must be added to the locale configuration, route groups, Open Graph locale mapping, rendered switch and sitemap before this article is published.

## 4. Answer-engine structure

The first paragraph in every version is a 45–65 word direct answer. Preserve it immediately below the H1. The rest of the page answers these questions with visible headings:

1. What is a digital Mushaf?
2. Why are scans not enough?
3. Why does stable page layout matter for memorisation?
4. How can a digital Mushaf support word understanding?
5. Can AI make a final tajwid assessment?
6. How is a digital Mushaf verified?

For each answer:

- give the conclusion in the first sentence;
- use one term consistently per language;
- keep factual claims close to their source;
- distinguish a published standard, an external implementation and the ALLIM design position;
- avoid anonymous claims such as “experts say” or unsupported superlatives.

## 5. GEO / citation readiness

There is no universal “GEO schema”. Make the page easy for search and answer systems to retrieve and cite through ordinary, verifiable web publishing:

- server-render the full article, headings, source links and authorship;
- keep the short answer, definitions, numbered verification process and FAQ in the visible HTML;
- use descriptive source anchors instead of bare URLs;
- expose `datePublished`, `dateModified`, `inLanguage`, author and publisher consistently in HTML and JSON-LD;
- add a visible “How this article was prepared” note and a reviewed-by field after a real specialist approves it;
- update `dateModified` only after a substantive editorial change;
- keep the page indexable and do not hide the main text behind login, canvas-only rendering or client-only API calls;
- provide a stable canonical URL and preserve old URLs with redirects if a slug changes;
- keep citations local to the statements they support;
- maintain content parity: each locale needs the full body, FAQ, sources and claim boundary.

Suggested robots meta:

```html
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
```

This improves crawl freedom but does not guarantee ranking, an AI citation or a rich result.

## 6. Structured data

Use an `@graph` containing `Article`, `BreadcrumbList` and, optionally, `FAQPage`. The FAQ questions and answers must exactly match visible page content. Use the localised headline, description, URL and `inLanguage` on each page.

Minimum `Article` properties for this package:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "LOCALISED H1",
  "description": "LOCALISED META DESCRIPTION",
  "datePublished": "2026-09-05",
  "dateModified": "2026-09-05",
  "inLanguage": "en | ar | ru | tr",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "LOCALISED CANONICAL URL"
  },
  "author": {
    "@type": "Organization",
    "name": "ALLIM Learning Team",
    "url": "https://allimquran.com/"
  },
  "publisher": {
    "@type": "Organization",
    "name": "ALLIM QURAN",
    "url": "https://allimquran.com/"
  }
}
```

Add `image` only after the real, crawlable hero asset exists. Provide at least a wide social image and, if the publishing system supports them, 1:1, 4:3 and 16:9 crops derived from the same approved artwork. Do not publish a placeholder image URL in structured data.

`FAQPage` may remain as accurate semantic markup, but do not promise a Google FAQ rich result: Google currently limits regular FAQ rich results mainly to authoritative government and health sites.

## 7. Hero image brief

Create one original, text-free master visual rather than borrowing imagery from the source article.

- Scene: a calm, ivory digital Mushaf page whose stable geometry remains visible while three very subtle translucent layers suggest reading, word understanding and memorisation.
- Brand direction: restrained turquoise-to-jade accents, deep ink, warm ivory; no bright blue UI glow.
- Avoid: invented Arabic or Qur’anic text, pseudo-calligraphy, floating AI brains, chat bubbles, neon gradients, copied Tarteel layouts, device-brand logos.
- Social crop: 1200 × 630 px.
- Article master: at least 1600 × 900 px.
- Safe area: keep the central page and interaction markers within the middle 70% so 1:1 and 4:3 crops remain usable.

## 8. Internal linking

Add only links that exist in the same locale:

- from the “AI must not perform certainty” section to the existing recitation-AI guide;
- from the understanding layer to a Qur’anic Arabic or word-understanding guide when published;
- from the remembering layer to the memorisation/review article;
- final CTA to the Companion or Academy, phrased as an invitation to explore current capabilities, not as proof that every vision item is released.

If a Turkish destination does not exist, do not silently send the Turkish reader to an English page. Label the destination language or omit the link until localisation is ready.

## 9. Pre-publication QA

- [ ] Product owner confirms the title, positioning and CTA.
- [ ] Current product build is checked against every present-tense feature statement.
- [ ] Qualified Qur’an specialist reviews tajwid, qira’at, Mushaf and proofreading terminology.
- [ ] All four bodies are complete; no English fallback appears in AR/RU/TR.
- [ ] Arabic has `lang="ar" dir="rtl"` and mixed numbers/Latin strings are visually tested.
- [ ] Turkish dotted/dotless I, apostrophes and `Kur’an` spelling are preserved.
- [ ] Canonical and complete hreflang cluster are present in rendered `<head>`.
- [ ] Article/Breadcrumb/FAQ JSON-LD validates and matches visible text.
- [ ] Hero image is original, crawlable, compressed and has localised alt text.
- [ ] Page renders at 390 × 844 and 1440 × 900 with no horizontal overflow.
- [ ] Text remains usable at 200% zoom; no Qur’anic marks or controls are clipped.
- [ ] Keyboard focus, contrast, reduced motion and RTL navigation pass.
- [ ] Every external source returns successfully and opens the cited material.
- [ ] Sitemap and article feed contain all four public URLs.
- [ ] Public HTML, metadata and schema are verified after cache clear.

## 10. Standards behind this pack

- [Google: people-first content and clear authorship](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google: Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google: localised pages and hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google: current FAQ rich-result limits](https://developers.google.com/search/blog/2023/08/howto-faq-changes)
- [W3C: Arabic and Persian Layout Requirements](https://www.w3.org/TR/alreq/)
- [W3C WCAG: Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow)
