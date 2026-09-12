(function () {
  "use strict";

  var scenesByLanguage = {
    ru: [
      { eyebrow: "ЕДИНЫЙ ПУТЬ", title: "Коран становится тем, что вы помните, понимаете и чем живёте.", description: "Чтение, запоминание, смысл и обучение собраны в одном спокойном пространстве.", features: ["Без регистрации для чтения", "Русский · العربية · English"], metric: ["1", "аят за раз"] },
      { eyebrow: "ИНТЕЛЛЕКТ ЧТЕНИЯ", title: "Слушает слово за словом.", description: "Верное чтение открывает продолжение. Ошибка останавливает поток до исправления — затем система сама ведёт к следующему аяту.", features: ["Мгновенная подсветка", "Остановка на ошибке", "Автопереход"], metric: ["LIVE", "проверка чтения"] },
      { eyebrow: "КОРАН В СЕРДЦЕ", title: "300 повторений. Видимый прогресс.", description: "Счётчик меняется после каждого правильного чтения. Серия продолжается без повторного нажатия — остановить её можно в любой момент.", features: ["Живой счётчик", "3 этапа по 100", "Связное чтение страницы"], metric: ["0 / 300", "сейчас на экране"] },
      { eyebrow: "МУСХАФ", title: "Знакомая страница сохраняет зрительную память.", description: "Полная страница Корана, классический набор, оттенки бумаги и букв, аудио известных чтецов Корана и подстрочный смысл.", features: ["604 страницы", "Выбор оформления", "Слушать и читать"], metric: ["593", "страница мусхафа"] },
      { eyebrow: "КОРАН РАЗЪЯСНЯЕТ КОРАН", title: "Тафсир и перевод — рядом с источником.", description: "Арабский текст и русский перевод показаны вместе. Источники остаются видимыми, а наставник не заменяет учителя.", features: ["Арабский оригинал", "Русский перевод", "Проверяемые источники"], metric: ["آية", "один аят объясняет другой"] },
      { eyebrow: "ALLIM QUR’AN ACADEMY", title: "Личный путь — от первого урока до системы.", description: "Личный план, онлайн-курсы и путь с преподавателем — от первого урока до устойчивой ежедневной практики.", features: ["Базовый кабинет", "Курсы", "Преподаватель"], metric: ["15", "минут внимания"] },
      { eyebrow: "اللَّهُمَّ عَلِّمْهُ الْكِتَابَ", title: "Учите Писание. Размышляйте. Сохраняйте в сердце и воплощайте в жизнь.", description: "ALLIM объединяет чтение, память, смысл и обучение в одном бережном пути.", features: ["Читать", "Запоминать", "Размышлять", "Жить"], metric: ["ALLIM", "Qur’an Companion"], final: true }
    ],
    en: [
      { eyebrow: "ONE GUIDED JOURNEY", title: "Let the Qur’an become what you remember, understand and live by.", description: "Recitation, memorization, meaning and learning come together in one calm space.", features: ["Read without registration", "English · العربية · Русский"], metric: ["1", "ayah at a time"] },
      { eyebrow: "RECITATION INTELLIGENCE", title: "Listening word by word.", description: "Correct recitation reveals what follows. A mistake pauses the flow until it is corrected, then the next ayah opens automatically.", features: ["Instant highlighting", "Pause on mistakes", "Automatic advance"], metric: ["LIVE", "recitation feedback"] },
      { eyebrow: "QUR’AN IN THE HEART", title: "300 repetitions. Visible progress.", description: "The counter updates after every accepted recitation. A continuous series keeps listening until you choose to stop.", features: ["Live counter", "3 stages of 100", "Connected page recitation"], metric: ["0 / 300", "visible in real time"] },
      { eyebrow: "MADINAH MUSHAF", title: "A familiar page supports visual memory.", description: "The complete Qur’an page, classic script, paper and ink themes, renowned Qur’an reciters and interlinear meaning.", features: ["604 pages", "Display choices", "Listen and recite"], metric: ["593", "mushaf page"] },
      { eyebrow: "THE QUR’AN EXPLAINS THE QUR’AN", title: "Tafsir and translation stay beside the source.", description: "Arabic text and translation appear together. Sources remain visible, and the assistant never replaces a qualified teacher.", features: ["Arabic source", "Translation", "Traceable references"], metric: ["آية", "one ayah explains another"] },
      { eyebrow: "ALLIM QUR’AN ACADEMY", title: "A personal path from the first lesson to a complete system.", description: "A personal plan, online courses and teacher-led study build a sustainable daily practice.", features: ["Basic cabinet", "Courses", "Teacher guidance"], metric: ["15", "focused minutes"] },
      { eyebrow: "اللَّهُمَّ عَلِّمْهُ الْكِتَابَ", title: "Learn the Book. Reflect. Keep it in your heart and live by it.", description: "ALLIM brings recitation, memory, meaning and learning into one careful journey.", features: ["Recite", "Memorize", "Reflect", "Live"], metric: ["ALLIM", "Qur’an Companion"], final: true }
    ],
    ar: [
      { eyebrow: "مسار واحد متكامل", title: "ليصبح القرآن ما تحفظه وتفهمه وتعيش به.", description: "تجتمع التلاوة والحفظ والمعنى والتعلّم في مساحة واحدة هادئة.", features: ["القراءة دون تسجيل", "العربية · English · Русский"], metric: ["١", "آية في كل مرة"] },
      { eyebrow: "ذكاء التلاوة", title: "يستمع كلمةً كلمة.", description: "تفتح التلاوة الصحيحة ما بعدها، ويوقف الخطأ المسار حتى يُصحّح، ثم تنتقل المنصة تلقائيًا إلى الآية التالية.", features: ["إضاءة فورية", "توقف عند الخطأ", "انتقال تلقائي"], metric: ["مباشر", "متابعة التلاوة"] },
      { eyebrow: "القرآن في القلب", title: "٣٠٠ تكرار. تقدّم تراه لحظةً بلحظة.", description: "يتغير العدّاد بعد كل تلاوة مقبولة، ويستمر الاستماع دون ضغط الزر من جديد حتى تختار التوقف.", features: ["عداد مباشر", "٣ مراحل من ١٠٠", "تلاوة الصفحة متصلة"], metric: ["٠ / ٣٠٠", "ظاهر في الوقت الحقيقي"] },
      { eyebrow: "مصحف المدينة", title: "صفحة مألوفة تحفظ الذاكرة البصرية.", description: "صفحة المصحف كاملة بخطها الكلاسيكي، مع ألوان للورق والحبر وتلاوات لقراء القرآن المعروفين ومعنى كلمةً كلمة.", features: ["٦٠٤ صفحات", "خيارات العرض", "استمع واقرأ"], metric: ["٥٩٣", "صفحة المصحف"] },
      { eyebrow: "القرآن يفسّر بعضه بعضًا", title: "التفسير والترجمة بجوار المصدر.", description: "يظهر النص العربي والترجمة معًا، وتبقى المصادر واضحة، ولا يحل المساعد محل المعلّم المؤهل.", features: ["النص العربي", "الترجمة", "مصادر موثقة"], metric: ["آية", "آية تفسّر آية"] },
      { eyebrow: "أكاديمية ALLIM للقرآن", title: "مسار شخصي من الدرس الأول إلى منهج متكامل.", description: "خطة شخصية ودورات عبر الإنترنت وتعلّم مع معلّم لبناء ممارسة يومية ثابتة.", features: ["اللوحة الأساسية", "الدورات", "المعلّم"], metric: ["١٥", "دقيقة من التركيز"] },
      { eyebrow: "اللَّهُمَّ عَلِّمْهُ الْكِتَابَ", title: "تعلّم كتاب الله. تدبّر. احفظه في قلبك واعمل به.", description: "يجمع ALLIM التلاوة والحفظ والمعنى والتعلّم في مسار واحد رفيق.", features: ["اقرأ", "احفظ", "تدبّر", "اعمل"], metric: ["ALLIM", "رفيق القرآن"], final: true }
    ]
  };

  var params = new URLSearchParams(window.location.search);
  var language = ["ru", "en", "ar"].indexOf(params.get("lang")) >= 0 ? params.get("lang") : "ru";
  var scenes = scenesByLanguage[language];
  var index = Math.max(0, Math.min(scenes.length - 1, Number(params.get("scene") || 1) - 1));
  var data = scenes[index];
  var stage = document.getElementById("stage");
  var imageNames = ["01-home", "02-reading", "03-memory", "04-mushaf", "05-tafsir", "06-academy", "06-academy"];

  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  stage.setAttribute("aria-label", language === "ar" ? "مشهد من عرض ALLIM" : (language === "en" ? "ALLIM presentation scene" : "Кадр презентации ALLIM"));
  document.getElementById("chapter").textContent = String(index + 1).padStart(2, "0") + " / 07";
  document.getElementById("eyebrow").textContent = data.eyebrow;
  document.getElementById("title").textContent = data.title;
  document.getElementById("description").textContent = data.description;
  document.getElementById("screen").src = "assets/" + language + "/" + imageNames[index] + ".jpg";
  document.getElementById("screen").alt = language === "ar" ? "واجهة ALLIM" : (language === "en" ? "ALLIM interface" : "Интерфейс ALLIM");

  var features = document.getElementById("features");
  data.features.forEach(function (item) {
    var feature = document.createElement("span");
    feature.className = "feature";
    feature.textContent = item;
    features.appendChild(feature);
  });
  var metric = document.getElementById("metric");
  var metricValue = document.createElement("strong");
  var metricLabel = document.createElement("span");
  metricValue.textContent = data.metric[0];
  metricLabel.textContent = data.metric[1];
  metric.replaceChildren(metricValue, metricLabel);

  document.getElementById("timeline").style.width = ((index + 1) / scenes.length * 100) + "%";
  stage.classList.toggle("is-memory", index === 2);
  stage.classList.toggle("is-tafsir", index === 4);
  stage.classList.toggle("is-final", Boolean(data.final));
})();
