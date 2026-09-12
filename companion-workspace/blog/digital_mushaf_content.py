from __future__ import annotations

import html
import re
from pathlib import Path


LANGUAGE_ORDER = ("en", "ar", "ru", "tr")
ARTICLE_KEY = "digital_mushaf"
SOURCE_DIR = Path("drafts/digital-mushaf-20260905")


TURKISH_LOCALE = {
    "lang": "tr", "dir": "ltr", "prefix": "/tr", "hub": "/tr/blog",
    "skip": "İçeriğe geç", "nav_label": "Ana menü", "nav_home": "Ana Sayfa", "nav_companion": "Companion", "nav_academy": "Akademi", "nav_insights": "Rehberler", "language_label": "Dil seçin", "menu_label": "Menüyü aç",
    "hub_meta_title": "Kur’an Öğrenme Rehberleri — ALLIM QURAN",
    "hub_meta_description": "Kur’an okuma, ezber, tekrar, Kur’an Arapçası ve sorumlu tilavet teknolojisi için kaynaklı ve uygulanabilir rehberler.",
    "eyebrow": "ALLIM ÖĞRENME KÜTÜPHANESİ", "title": "Kur’an öğrenmek için açık ve sakin yollar.", "lead": "Her rehber gerçek bir soruya doğrudan cevap verir, uygulanabilir bir yöntem sunar ve teknolojinin nerede durup yetkin öğretmenin rolünün nerede başladığını açıkça belirtir.",
    "featured_kind": "DİJİTAL MUSHAF · 9 DAKİKA", "featured_title": "Ekrandaki bir sayfadan fazlası", "featured_excerpt": "Dijital mushaf; metin doğruluğunu ve sayfa hafızasını korurken anlamayı, ezberi ve zamanında tekrarı nasıl destekleyebilir?", "read_guide": "Rehberi oku", "featured_visual_label": "Okuma, anlama ve hatırlama katmanlarına sahip dijital mushaf", "featured_visual_text": "Oku · Anla · Hatırla · Dön",
    "library_eyebrow": "UYGULANABİLİR VE KAYNAKLI", "library_title": "Bir soru. Gerçekten yararlı bir cevap.",
    "trust_eyebrow": "YAYIN İLKEMİZ", "trust_title": "Uygulanabilir olacak kadar açık, güvenilecek kadar dürüst.", "trust_one": "Öğrenme tasarımı, teknik destek ve dinî rehberlik birbirinden ayrılır.", "trust_two": "Kaynaklar açıkça belirtilir; belirsiz bir iddia kesin bilgi gibi sunulmaz.", "trust_three": "Yapay zekâ yardımcıdır. Tecvid, kıraat ve dinî değerlendirme yetkin kişilere aittir.",
    "cta_title": "Rehberi bugünün dersine dönüştürün.", "cta_text": "Öğrenci panelini açın, küçük bir hedef belirleyin ve Companion’da devam edin.", "cta_action": "Öğrenci panelini aç", "back_home": "Ana sayfaya dön", "read_more": "Oku",
    "article": {"breadcrumb_label":"İçerik yolu", "author":"ALLIM Eğitim Ekibi", "date_label":"5 Eylül 2026", "date_iso":"2026-09-05", "in_this_guide":"Bu rehberde", "method_note":"Bu, bir öğrenme ve ürün tasarımı yazısıdır; fetva veya yetkin Kur’an öğretmeninin yerine geçen bir hüküm değildir.", "short_answer_label":"Kısa cevap", "faq_label":"DOĞRUDAN CEVAPLAR", "faq_title":"Okuyucuların sorduğu sorular", "sources_title":"Yazının dayanağı", "authorship_title":"ALLIM yaklaşımı", "authorship_text":"Öğrenme çerçevesi ve ALLIM’a ait sonuçlar bağımsız olarak oluşturulmuştur.", "next_eyebrow":"ÖĞRENMEYE DEVAM ET", "next_action":"Tüm rehberler", "back_blog":"Tüm rehberler"},
}


FEATURED_OVERRIDES = {
    "en": {
        "featured_kind": "DIGITAL MUSHAF · 9 MIN READ",
        "featured_title": "Beyond a page on a screen",
        "featured_excerpt": "How can a digital Mushaf preserve textual trust and page memory while supporting understanding, memorisation and timely review?",
        "featured_visual_label": "A digital Mushaf with reading, understanding and remembering layers",
        "featured_visual_text": "Read · Understand · Remember · Return",
    },
    "ru": {
        "featured_kind": "ЦИФРОВОЙ МУСХАФ · 9 МИНУТ",
        "featured_title": "Не просто Коран на экране",
        "featured_excerpt": "Как цифровой мусхаф сохраняет точность текста и память страницы, помогая понимать слова, запоминать аяты и вовремя возвращаться к повторению?",
        "featured_visual_label": "Цифровой мусхаф со слоями чтения, понимания и запоминания",
        "featured_visual_text": "Читайте · Понимайте · Запоминайте · Возвращайтесь",
    },
    "ar": {
        "featured_kind": "المصحف الرقمي · ٩ دقائق",
        "featured_title": "أبعد من صفحة على شاشة",
        "featured_excerpt": "كيف يحفظ المصحف الرقمي أمانة النص وذاكرة الصفحة، ويعين على الفهم والحفظ والمراجعة في وقتها؟",
        "featured_visual_label": "مصحف رقمي بطبقات للقراءة والفهم والحفظ",
        "featured_visual_text": "اقرأ · افهم · احفظ · عُد",
    },
}


DECKS = {
    "en": "A calm product framework that preserves the familiar page while opening optional paths into word meaning, memorisation and responsible recitation support.",
    "ru": "Спокойная продуктовая концепция: сохранить знакомую страницу и по запросу открывать значение слов, запоминание и бережную помощь при чтении.",
    "tr": "Tanıdık sayfayı korurken kelime anlamı, ezber ve sorumlu tilavet desteğini yalnızca ihtiyaç olduğunda açan sakin bir ürün yaklaşımı.",
    "ar": "رؤية هادئة تحفظ الصفحة المألوفة، وتفتح عند الحاجة مسارات لمعنى الكلمة والحفظ والمتابعة المسؤولة للتلاوة.",
}


DATE_LABELS = {
    "en": "5 September 2026",
    "ru": "5 сентября 2026",
    "tr": "5 Eylül 2026",
    "ar": "٥ سبتمبر ٢٠٢٦",
}


AUTHORS = {
    "en": "ALLIM Learning Team",
    "ru": "Команда обучения ALLIM",
    "tr": "ALLIM Eğitim Ekibi",
    "ar": "فريق التعلّم في ALLIM",
}


SOURCE_LABELS = {
    "en": (("Tarteel engineering article", "https://tarteel.ai/blog/from-page-to-screen-rethinking-quran-rendering-for-the-digital-age/"), ("QUL Mushaf layout data", "https://qul.tarteel.ai/docs/mushaf-layout"), ("W3C Arabic layout requirements", "https://www.w3.org/TR/alreq/")),
    "ru": (("Инженерная статья Tarteel", "https://tarteel.ai/blog/from-page-to-screen-rethinking-quran-rendering-for-the-digital-age/"), ("Данные о макетах мусхафа QUL", "https://qul.tarteel.ai/docs/mushaf-layout"), ("Рекомендации W3C по арабской письменности", "https://www.w3.org/TR/alreq/")),
    "tr": (("Tarteel mühendislik makalesi", "https://tarteel.ai/blog/from-page-to-screen-rethinking-quran-rendering-for-the-digital-age/"), ("QUL mushaf düzeni verileri", "https://qul.tarteel.ai/docs/mushaf-layout"), ("W3C Arapça yazı düzeni gereksinimleri", "https://www.w3.org/TR/alreq/")),
    "ar": (("مقالة Tarteel الهندسية", "https://tarteel.ai/blog/from-page-to-screen-rethinking-quran-rendering-for-the-digital-age/"), ("بيانات QUL لتخطيطات المصحف", "https://qul.tarteel.ai/docs/mushaf-layout"), ("متطلبات W3C لتخطيط النص العربي", "https://www.w3.org/TR/alreq/")),
}


SOURCE_TITLES = {"en": "What this article is based on", "ru": "Основа материала", "tr": "Bu yazının dayanağı", "ar": "ما الذي يستند إليه هذا المقال؟"}
AUTHORSHIP_TITLES = {"en": "The ALLIM perspective", "ru": "Подход ALLIM", "tr": "ALLIM yaklaşımı", "ar": "رؤية ALLIM"}
AUTHORSHIP_TEXTS = {
    "en": "The learning framework and ALLIM conclusions are independently developed. The article describes product principles, not a promise that every capability is already released.",
    "ru": "Учебная концепция и выводы ALLIM сформулированы самостоятельно. Статья описывает продуктовые принципы, а не обещает, что все функции уже выпущены.",
    "tr": "Öğrenme çerçevesi ve ALLIM sonuçları bağımsız olarak oluşturulmuştur. Yazı, her özelliğin bugün yayımlandığı vaadini değil, ürün ilkelerini anlatır.",
    "ar": "صيغ إطار التعلّم ونتائج ALLIM بصورة مستقلة. وتعرض المقالة مبادئ المنتج، ولا تعد بأن كل وظيفة مذكورة قد أُطلقت بالفعل.",
}


ANCHORS = ("problem", "responsibilities", "layers", "views", "interaction", "ai-boundary", "daily-reading", "return")
FAQ_TITLES = ("Frequently asked questions", "Частые вопросы", "Sık sorulan sorular", "أسئلة شائعة")
BASIS_TITLES = ("What this article is based on", "Основа материала", "Bu yazının dayanağı", "ما الذي يستند إليه هذا المقال؟")


def _frontmatter(document: str) -> tuple[dict[str, str], str]:
    match = re.match(r"\A---\n(.*?)\n---\n(.*)\Z", document, flags=re.S)
    if not match:
        raise RuntimeError("Article frontmatter was not found")
    values: dict[str, str] = {}
    for line in match.group(1).splitlines():
        key, value = line.split(":", 1)
        values[key.strip()] = value.strip().strip('"')
    return values, match.group(2).strip()


def _inline(value: str) -> str:
    escaped = html.escape(value, quote=False)
    escaped = re.sub(r"\[([^\]]+)\]\((https://[^)]+)\)", r'<a href="\2" target="_blank" rel="noopener noreferrer">\1</a>', escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", escaped)
    return escaped


def _markdown_to_html(document: str) -> tuple[str, list[tuple[str, str]]]:
    lines = document.splitlines()
    rendered: list[str] = []
    toc: list[tuple[str, str]] = []
    paragraph: list[str] = []
    list_type: str | None = None
    anchor_index = 0

    def flush_paragraph() -> None:
        nonlocal paragraph
        if paragraph:
            rendered.append("<p>" + _inline(" ".join(paragraph)) + "</p>")
            paragraph = []

    def close_list() -> None:
        nonlocal list_type
        if list_type:
            rendered.append(f"</{list_type}>")
            list_type = None

    for raw in lines:
        line = raw.strip()
        if not line:
            flush_paragraph()
            close_list()
            continue
        if line.startswith("## "):
            flush_paragraph()
            close_list()
            heading = line[3:].strip()
            anchor = ANCHORS[anchor_index] if anchor_index < len(ANCHORS) else f"section-{anchor_index + 1}"
            anchor_index += 1
            toc.append((anchor, heading))
            rendered.append(f'<h2 id="{anchor}">{_inline(heading)}</h2>')
            continue
        if line.startswith("### "):
            flush_paragraph()
            close_list()
            rendered.append("<h3>" + _inline(line[4:].strip()) + "</h3>")
            continue
        if line.startswith("> "):
            flush_paragraph()
            close_list()
            rendered.append('<div class="callout claim-boundary"><p>' + _inline(line[2:].strip()) + "</p></div>")
            continue
        unordered = re.match(r"^- (.+)$", line)
        ordered = re.match(r"^\d+\. (.+)$", line)
        if unordered or ordered:
            flush_paragraph()
            wanted = "ul" if unordered else "ol"
            if list_type != wanted:
                close_list()
                list_type = wanted
                rendered.append(f"<{wanted}>")
            rendered.append("<li>" + _inline((unordered or ordered).group(1)) + "</li>")
            continue
        paragraph.append(line)

    flush_paragraph()
    close_list()
    return "".join(rendered), toc


def _parse_article(path: Path, code: str) -> dict[str, object]:
    meta, document = _frontmatter(path.read_text(encoding="utf-8"))
    lines = document.splitlines()
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
    document = "\n".join(lines).strip()

    short_match = re.search(r"\A\*\*[^*]+\*\*\s*(.+?)(?:\n\n|\Z)", document, flags=re.S)
    if not short_match:
        raise RuntimeError(f"Short answer not found in {path}")
    short_answer = re.sub(r"\s+", " ", short_match.group(1)).strip()
    document = document[short_match.end():].strip()

    faq_pattern = r"^## (?:" + "|".join(re.escape(value) for value in FAQ_TITLES) + r")\s*$"
    basis_pattern = r"^### (?:" + "|".join(re.escape(value) for value in BASIS_TITLES) + r")\s*$"
    faq_match = re.search(faq_pattern, document, flags=re.M)
    if not faq_match:
        raise RuntimeError(f"FAQ section not found in {path}")
    main_markdown = document[:faq_match.start()].strip()
    faq_and_basis = document[faq_match.end():].strip()
    basis_match = re.search(basis_pattern, faq_and_basis, flags=re.M)
    faq_markdown = faq_and_basis[:basis_match.start()].strip() if basis_match else faq_and_basis

    faq: list[tuple[str, str]] = []
    for match in re.finditer(r"^### (.+?)\n\n(.+?)(?=\n\n### |\Z)", faq_markdown, flags=re.M | re.S):
        faq.append((match.group(1).strip(), re.sub(r"\s+", " ", match.group(2)).strip()))
    if len(faq) != 6:
        raise RuntimeError(f"Expected 6 FAQ entries in {path}, found {len(faq)}")

    body, toc = _markdown_to_html(main_markdown)
    return {
        "category": meta["category"],
        "title": meta["title"],
        "seo_title": meta["seo_title"],
        "deck": DECKS[code],
        "meta_description": meta["meta_description"],
        "read_time": meta["read_time"],
        "date_iso": meta["date"],
        "date_label": DATE_LABELS[code],
        "author": AUTHORS[code],
        "short_answer": short_answer,
        "toc": toc,
        "body": body,
        "faq": faq,
        "sources": list(SOURCE_LABELS[code]),
        "sources_title": SOURCE_TITLES[code],
        "authorship_title": AUTHORSHIP_TITLES[code],
        "authorship_text": AUTHORSHIP_TEXTS[code],
    }


def build_addon(source_root: Path) -> tuple[dict[str, object], dict[str, object]]:
    article_root = source_root / SOURCE_DIR
    routes: dict[str, str] = {}
    content: dict[str, object] = {}
    for code in LANGUAGE_ORDER:
        copy = _parse_article(article_root / f"article-{code}.md", code)
        routes[code] = str(_frontmatter((article_root / f"article-{code}.md").read_text(encoding="utf-8"))[0]["slug"])
        content[code] = copy
    return TURKISH_LOCALE, {"routes": routes, "content": content}


CARD_VISUALS = {
    "alphabet": '''<div class="article-card__visual" data-card-visual="alphabet" aria-hidden="true"><svg viewBox="0 0 180 108"><path class="av-frame" d="M15 18h150v72H15z"/><path class="av-path" d="M43 54h31m31 0h31"/><g class="av-glyphs"><circle cx="36" cy="54" r="18"/><circle cx="90" cy="54" r="18"/><circle cx="144" cy="54" r="18"/><path d="M36 44v20M84 59c8-1 13-6 13-13m-11 10h14M137 58c8 0 13-5 14-13"/></g></svg></div>''',
    "memory": '''<div class="article-card__visual" data-card-visual="memory" aria-hidden="true"><svg viewBox="0 0 180 108"><path class="av-frame" d="M43 14h94v80H43z"/><path class="av-page-line line-one" d="M58 36h64"/><path class="av-page-line line-two" d="M58 52h52"/><path class="av-page-line line-three" d="M58 68h59"/><path class="av-recall" d="M90 83c-11-7-19-14-19-23 0-8 10-12 19-3 9-9 19-5 19 3 0 9-8 16-19 23z"/></svg></div>''',
    "three_hundred": '''<div class="article-card__visual" data-card-visual="three_hundred" aria-hidden="true"><svg viewBox="0 0 180 108"><circle class="av-ring ring-one" cx="90" cy="54" r="36"/><circle class="av-ring ring-two" cx="90" cy="54" r="27"/><circle class="av-ring ring-three" cx="90" cy="54" r="18"/><path class="av-marker" d="M90 12v11M132 54h-11M90 96V85"/><circle class="av-core" cx="90" cy="54" r="5"/></svg></div>''',
    "ai": '''<div class="article-card__visual" data-card-visual="ai" aria-hidden="true"><svg viewBox="0 0 180 108"><path class="av-frame" d="M18 21h144v66H18z"/><path class="av-wave" d="M28 56h17l7-20 12 39 12-29 12 18 10-35 12 46 9-19h33"/><g class="av-nodes"><circle cx="45" cy="56" r="3"/><circle cx="98" cy="29" r="3"/><circle cx="119" cy="56" r="3"/></g></svg></div>''',
    "digital_mushaf": '''<div class="article-card__visual" data-card-visual="digital_mushaf" aria-hidden="true"><svg viewBox="0 0 180 108"><path class="av-book" d="M20 25c26-8 48-5 70 7v58c-22-12-44-15-70-7zM160 25c-26-8-48-5-70 7v58c22-12 44-15 70-7z"/><path class="av-spine" d="M90 32v58"/><path class="av-page-line line-one" d="M33 45c18-4 32-2 44 3M147 45c-18-4-32-2-44 3"/><path class="av-page-line line-two" d="M32 59c18-4 32-2 45 3M148 59c-18-4-32-2-45 3"/><path class="av-page-line line-three" d="M34 73c16-3 29-1 41 3M146 73c-16-3-29-1-41 3"/><rect class="av-focus" x="106" y="53" width="23" height="10" rx="5"/><path class="av-layer" d="M112 23h42v19"/></svg></div>''',
}


FEATURED_VISUAL = '''<div class="mushaf-stage" aria-hidden="true"><div class="mushaf-halo halo-one"></div><div class="mushaf-halo halo-two"></div><div class="mushaf-book"><div class="mushaf-leaf leaf-left"><i></i><i></i><i></i><i></i><i></i></div><div class="mushaf-leaf leaf-right"><i></i><i></i><i></i><i></i><i></i><b></b></div><span class="mushaf-spine"></span></div><div class="learning-layer layer-read"><span></span></div><div class="learning-layer layer-meaning"><span></span><span></span></div><div class="learning-layer layer-memory"><span></span><span></span><span></span></div></div>'''


def render_card_visual(key: str) -> str:
    return CARD_VISUALS.get(key, CARD_VISUALS["digital_mushaf"])
