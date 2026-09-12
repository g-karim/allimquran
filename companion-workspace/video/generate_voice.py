from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LANGUAGES = {
    "ru": {"voice": "ru-RU-DmitryNeural", "rate": "-7%", "pitch": "-4Hz"},
    "en": {"voice": "en-GB-RyanNeural", "rate": "-6%", "pitch": "-3Hz"},
    "ar": {"voice": "ar-SA-HamedNeural", "rate": "-8%", "pitch": "-4Hz"},
}

SEGMENTS = {
    "ru": {
        "01": "А́ллим — единое пространство для чтения, понимания и сохранения Корана в сердце. Здесь путь начинается с одного ая́та: спокойно, ясно и без лишнего.",
        "02": "В режиме чтения система слушает аят слово за словом. Правильные слова открываются по порядку. При ошибке чтение останавливается и продолжается только после исправления.",
        "03": "Коран в сердце — это понятная система трёхсот повторений. Каждое правильное чтение сразу добавляется в живой счётчик. Сто повторений укрепляют первый этап, ещё сто — второй, последние сто — закрепляют аят.",
        "04": "Му́схаф. Он сохраняет привычный образ страницы. Можно выбрать оттенок бумаги и букв, слушать известных чтецов Корана и включать подстрочный перевод.",
        "05": "Тафсир. Арабский текст и перевод показаны рядом с источником. Это помогает видеть, как один аят разъясняет другой, и сохранять опору на проверенный труд.",
        "06": "Академия объединяет личный план, онлайн-курсы и работу с преподавателем. Базовый кабинет помогает начать, полный доступ — учиться системно.",
        "07": "А́ллим. Учи́те Писание. Размышляйте. Сохраняйте в сердце и воплощайте в жизнь.",
    },
    "en": {
        "01": "ALLIM is one calm space for recitation, understanding, and keeping the Qur’an in the heart. The journey begins with a single ayah: clearly, attentively, and without distraction.",
        "02": "In recitation mode, the system listens word by word. Correct words open in sequence. A mistake pauses the reading, and the next ayah opens only after the word is corrected.",
        "03": "Qur’an in the Heart is a clear system of three hundred repetitions. Every accepted recitation updates the live counter. One hundred builds the first stage, another hundred strengthens it, and the final hundred secures the ayah.",
        "04": "The Madinah Mushaf preserves the familiar visual pattern of the page. Choose the paper and ink, listen to renowned Qur’an reciters, and reveal interlinear meaning when you need it.",
        "05": "Tafsir. Arabic text and translation remain beside the source. This helps you see how one ayah explains another while staying grounded in verified scholarship.",
        "06": "The Academy brings together a personal plan, online courses, and guided study with a teacher. The basic cabinet helps you begin; full access supports systematic learning.",
        "07": "ALLIM. Learn the Book. Reflect. Keep it in your heart, and live by it.",
    },
    "ar": {
        "01": "أَلِّم مساحة واحدة هادئة للتلاوة والفهم وحفظ القرآن في القلب. تبدأ الرحلة بآية واحدة، بوضوح وانتباه ومن غير تشتيت.",
        "02": "في وضع التلاوة تستمع المنصة كلمة كلمة. تظهر الكلمات الصحيحة بالترتيب. وعند الخطأ تتوقف القراءة، ولا تظهر الآية التالية حتى تُصحَّح الكلمة.",
        "03": "القرآن في القلب نظام واضح لثلاثمائة تكرار. تُضاف كل تلاوة مقبولة مباشرة إلى العدّاد. مائة تكرار تبني المرحلة الأولى، ومائة تقوّيها، والمائة الأخيرة تثبّت الآية.",
        "04": "مصحف المدينة يحفظ الصورة المألوفة للصفحة. يمكنك اختيار لون الورق والحبر، والاستماع إلى قرّاء القرآن المعروفين، وإظهار المعنى كلمة كلمة عند الحاجة.",
        "05": "التفسير. يظهر النص العربي والترجمة بجوار المصدر. وهكذا ترى كيف تفسّر آية آيةً أخرى، مع البقاء على صلة بالعلم الموثّق.",
        "06": "تجمع الأكاديمية الخطة الشخصية والدورات عبر الإنترنت والتعلّم مع معلّم. تساعدك اللوحة الأساسية على البداية، ويفتح الوصول الكامل مسارًا منظمًا للتعلّم.",
        "07": "أَلِّم. تعلّم كتاب الله. تدبّر. احفظه في قلبك واعمل به.",
    },
}

async def main() -> None:
    import edge_tts

    language = sys.argv[1] if len(sys.argv) > 1 else "ru"
    if language not in LANGUAGES:
        raise SystemExit(f"Unknown language: {language}")
    selected = sys.argv[2:] or list(SEGMENTS[language])
    target = ROOT / "narration" / language
    target.mkdir(parents=True, exist_ok=True)
    settings = LANGUAGES[language]
    for key in selected:
        communicator = edge_tts.Communicate(
            SEGMENTS[language][key],
            settings["voice"],
            rate=settings["rate"],
            pitch=settings["pitch"],
        )
        await communicator.save(str(target / f"{key}.mp3"))


if __name__ == "__main__":
    asyncio.run(main())
