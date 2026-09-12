from __future__ import annotations

import asyncio
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
VOICE_CONFIG = {
    "ru": {"voice": "ru-RU-DmitryNeural", "rate": "-3%", "pitch": "-1Hz"},
    "en": {"voice": "en-GB-RyanNeural", "rate": "-4%", "pitch": "-1Hz"},
    "ar": {"voice": "ar-SA-HamedNeural", "rate": "-6%", "pitch": "-1Hz"},
    "tr": {"voice": "tr-TR-AhmetNeural", "rate": "-4%", "pitch": "-1Hz"},
}

# Russian speech strings deliberately use phonetic spelling for "аят". Visible
# captions keep standard orthography below.
NARRATION = {
    "ru": {
        "01": "Аллим помогает не просто повторять. Он выстраивает цельный путь: выучить один айат, проверить память и связать его смысл с поступком.",
        "02": "В разделе «Коран в сердце» действует правило: прочитать выбранный айат триста раз. Каждое полное и правильно принятое чтение сразу увеличивает живой счётчик. Путь разделён на три ясных этапа — по сто чтений в каждом.",
        "03": "Проверка страницы наизусть — это отдельная тренировка. Геометрия мусхафа и обозначения айатов остаются на своих местах, а текст скрывается. Правильно прочитанные слова проявляются по порядку. Когда каждый айат на странице будет прочитан триста раз, откроется связное чтение. Микрофон проведёт по всей странице без повторного запуска. После полного чтения страница закрепится.",
        "04": "Дневник «Айат в жизни» помогает сделать следующий шаг. Запишите, что выбранный айат меняет сегодня. Выберите одно небольшое действие и назначьте время, когда вернётесь к записи. И-И-наставник поможет сформулировать мысль, но не будет придумывать толкование.",
        "05": "Так чтение, проверка памяти и действие становятся одной привычкой. Система показывает, что уже укреплено, что нужно прочитать ещё раз и к какому размышлению пора вернуться.",
        "06": "Начните с одного айата. Читайте внимательно, проверяйте себя и размышляйте над смыслом. Сохраняйте Коран в сердце. И с добрым намерением воплощайте его наставление в жизни.",
    },
    "en": {
        "01": "ALLIM helps you do more than repeat. It creates one coherent path: learn one ayah, test your memory, and connect its meaning to an action.",
        "02": "In Qur’an in the Heart, the rule is simple: read the selected ayah three hundred times. Every complete recitation that is accepted increases the live counter at once. The path has three clear stages, with one hundred readings in each.",
        "03": "The page-from-memory check is a separate practice. The Mushaf layout and ayah markers remain in place while the text is hidden. Correctly recited words appear in sequence. When every ayah on the page has been read three hundred times, connected reading unlocks. The microphone follows the whole page without restarting. After a complete recitation, the page is secured.",
        "04": "The Ayah in Life journal helps you take the next step. Write what the selected ayah changes today. Choose one small action and set a time to return to your note. The AI mentor can help you express the thought, but it will not invent tafsir.",
        "05": "Reading, memory checks, and action become one habit. The system shows what has grown firm, what needs another reading, and which reflection is ready to revisit.",
        "06": "Begin with one ayah. Read carefully, test yourself, and reflect on the meaning. Keep the Qur’an in your heart, and with sincere intention bring its guidance into your life.",
    },
    "ar": {
        "01": "لا تساعدك منصة عَلِّم على التكرار فحسب، بل تبني مسارًا مترابطًا: تحفظ آيةً واحدة، وتختبر حفظك، وتربط معناها بعمل.",
        "02": "في قسم القرآن في القلب قاعدة واضحة: اقرأ الآية المختارة ثلاثمائة مرة. كل تلاوة كاملة مقبولة ترفع العداد مباشرة. وينقسم المسار إلى ثلاث مراحل واضحة، في كل مرحلة مائة قراءة.",
        "03": "اختبار الصفحة عن ظهر قلب تدريب مستقل. تبقى هيئة المصحف وعلامات الآيات في مواضعها، بينما يُخفى النص. وتظهر الكلمات الصحيحة بالترتيب. وعندما تُقرأ كل آية في الصفحة ثلاثمائة مرة، تُفتح التلاوة المتصلة. يتابعك الميكروفون في الصفحة كلها دون إعادة تشغيل. وبعد تلاوة كاملة تُثبّت الصفحة.",
        "04": "يساعدك دفتر آية في الحياة على الانتقال إلى الخطوة التالية. اكتب ما الذي تغيّره الآية المختارة اليوم. اختر عملًا صغيرًا وحدد وقتًا للعودة إلى ملاحظتك. يساعدك المرشد الذكي على صياغة الفكرة، لكنه لا يختلق تفسيرًا.",
        "05": "وهكذا تصبح القراءة واختبار الحفظ والعمل عادةً واحدة. يبيّن لك النظام ما ثبت، وما يحتاج إلى قراءة أخرى، والتدبر الذي حان وقت العودة إليه.",
        "06": "ابدأ بآية واحدة. اقرأ بتأنّ، واختبر نفسك، وتدبر المعنى. احفظ القرآن في قلبك، واعمل بهديه في حياتك بنية صادقة.",
    },
    "tr": {
        "01": "ALLIM yalnızca tekrar etmenize yardımcı olmaz. Tek ve bütünlüklü bir yol kurar: bir ayeti ezberleyin, hafızanızı sınayın ve anlamını bir davranışla ilişkilendirin.",
        "02": "Kur’an Kalpte bölümünde kural açıktır: seçilen ayeti üç yüz kez okuyun. Eksiksiz ve doğru kabul edilen her okuyuş, canlı sayacı anında artırır. Yol, her biri yüz okuyuş olan üç açık aşamaya ayrılır.",
        "03": "Sayfayı ezberden kontrol etmek ayrı bir çalışmadır. Mushafın düzeni ve ayet işaretleri yerinde kalırken metin gizlenir. Doğru okunan kelimeler sırayla görünür. Sayfadaki her ayet üç yüz kez okunduğunda bağlantılı okuyuş açılır. Mikrofon, yeniden başlatılmadan bütün sayfa boyunca sizi takip eder. Eksiksiz okuyuşun ardından sayfa sağlamlaştırılır.",
        "04": "Hayatta Ayet günlüğü, bir sonraki adımı atmanıza yardımcı olur. Seçilen ayetin bugün neyi değiştirdiğini yazın. Küçük bir davranış seçin ve notunuza döneceğiniz zamanı belirleyin. Yapay zekâ rehberi düşüncenizi ifade etmenize yardımcı olur; fakat tefsir uydurmaz.",
        "05": "Böylece okuyuş, hafıza kontrolü ve davranış tek bir alışkanlığa dönüşür. Sistem neyin sağlamlaştığını, neyin yeniden okunması gerektiğini ve hangi düşünceye dönme zamanının geldiğini gösterir.",
        "06": "Tek bir ayetle başlayın. Dikkatle okuyun, kendinizi sınayın ve anlam üzerinde düşünün. Kur’an’ı kalbinizde koruyun ve samimi bir niyetle rehberliğini hayatınıza taşıyın.",
    },
}

CAPTIONS = {
    "ru": {
        "01": "ALLIM помогает не просто повторять. Он выстраивает цельный путь: выучить один аят, проверить память и связать его смысл с поступком.",
        "02": "В разделе «Коран в сердце» действует правило: прочитать выбранный аят 300 раз. Каждое полное и правильно принятое чтение сразу увеличивает живой счётчик. Путь разделён на три ясных этапа — по 100 чтений в каждом.",
        "03": "Проверка страницы наизусть — это отдельная тренировка. Геометрия мусхафа и обозначения аятов остаются на своих местах, а текст скрывается. Правильно прочитанные слова проявляются по порядку. Когда каждый аят на странице будет прочитан 300 раз, откроется связное чтение. Микрофон проведёт по всей странице без повторного запуска. После полного чтения страница закрепится.",
        "04": "Дневник «Аят в жизни» помогает сделать следующий шаг. Запишите, что выбранный аят меняет сегодня. Выберите одно небольшое действие и назначьте время, когда вернётесь к записи. ИИ-наставник поможет сформулировать мысль, но не будет придумывать толкование.",
        "05": "Так чтение, проверка памяти и действие становятся одной привычкой. Система показывает, что уже укреплено, что нужно прочитать ещё раз и к какому размышлению пора вернуться.",
        "06": "Начните с одного аята. Читайте внимательно, проверяйте себя и размышляйте над смыслом. Сохраняйте Коран в сердце. И с добрым намерением воплощайте его наставление в жизни.",
    },
    "en": NARRATION["en"],
    "ar": NARRATION["ar"],
    "tr": NARRATION["tr"],
}

SEGMENTS = NARRATION["ru"]


async def main() -> None:
    import edge_tts

    language = (sys.argv[1] if len(sys.argv) > 1 else "ru").lower()
    if language not in VOICE_CONFIG:
        raise SystemExit(f"Unsupported language: {language}")
    selected = set(sys.argv[2:])
    config = VOICE_CONFIG[language]
    target = ROOT / "narration" / language
    target.mkdir(parents=True, exist_ok=True)
    for key, text in NARRATION[language].items():
        if selected and key not in selected:
            continue
        communicator = edge_tts.Communicate(text, config["voice"], rate=config["rate"], pitch=config["pitch"])
        await communicator.save(str(target / f"{key}.mp3"))


if __name__ == "__main__":
    asyncio.run(main())
