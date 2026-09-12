(function () {
  "use strict";

  var languages = {
    ru: {
      filmName: "КОРАН В СЕРДЦЕ", introUnit: "ПОВТОРЕНИЙ", alt: "Интерфейс ALLIM",
      flow: [["Повторять", "100 + 100 + 100"], ["Проверять", "Страница наизусть"], ["Осмыслить", "Личная запись"], ["Действовать", "Один ясный шаг"]],
      scenes: [
        { eyebrow: "ОДИН ЦЕЛЬНЫЙ ПУТЬ", title: "Заучить. Проверить себя. Воплотить в жизнь.", description: "ALLIM связывает память, самостоятельную проверку и личное действие вокруг одного выбранного аята.", features: ["Коран в сердце", "Проверка наизусть", "Аят в жизни"], metric: ["1", "аят за раз"], kind: "intro" },
        { eyebrow: "КОРАН В СЕРДЦЕ", title: "300 повторений — прогресс виден сразу.", description: "Каждое принятое полное чтение увеличивает счётчик. Путь разделён на три понятных этапа по сто повторений.", features: ["100 + 100 + 100", "Живой счётчик", "Серия без перезапуска"], metric: ["0 / 300", "текущий аят"], image: "heart-300.png", kind: "screen" },
        { eyebrow: "ПРОВЕРКА ПАМЯТИ", title: "Проверьте страницу. Затем свяжите аяты.", description: "Проверка наизусть доступна как тренировка. Связное чтение откроется, когда каждый аят страницы достигнет 300 повторений.", features: ["Вся страница", "Слова по порядку", "Связное чтение после 300"], metric: ["0 / 7", "аятов проверено"], image: "page-recall.png", kind: "screen recall" },
        { eyebrow: "АЯТ В ЖИЗНИ", title: "От понимания — к одному искреннему действию.", description: "Запишите личное размышление, выберите небольшой выполнимый шаг и назначьте время возвращения к записи.", features: ["Личный дневник", "Поддержка AI-наставника", "Возвращение к записи"], metric: ["5–15", "минут на действие"], image: "ayat-in-life.png", kind: "screen journal" },
        { eyebrow: "ЕЖЕДНЕВНАЯ ПРИВЫЧКА", title: "Память становится связанной с жизнью.", description: "Повторение укрепляет аят, проверка показывает реальную прочность, а дневник возвращает смысл в сегодняшний день.", features: ["Что укреплено", "Что повторить", "К чему вернуться"], metric: ["4", "связанных шага"], kind: "flow" },
        { eyebrow: "ALLIM QUR’AN COMPANION", title: "Коран в сердце. Аят в жизни.", description: "Начните с одного аята — внимательно, последовательно и с намерением жить по его наставлению.", features: ["Повторяйте", "Проверяйте себя", "Размышляйте", "Воплощайте"], metric: ["ALLIM", "начните сегодня"], kind: "final" }
      ]
    },
    en: {
      filmName: "QUR’AN IN THE HEART", introUnit: "READINGS", alt: "ALLIM interface",
      flow: [["Repeat", "100 + 100 + 100"], ["Recall", "Page from memory"], ["Reflect", "Personal journal"], ["Act", "One clear step"]],
      scenes: [
        { eyebrow: "ONE COHERENT PATH", title: "Memorize. Test yourself. Bring it into life.", description: "ALLIM connects memory, self-checking and personal action around one selected ayah.", features: ["Qur’an in the Heart", "Page recall", "Ayah in Life"], metric: ["1", "ayah at a time"], kind: "intro" },
        { eyebrow: "QUR’AN IN THE HEART", title: "300 readings — progress stays visible.", description: "Every accepted complete recitation increases the counter. The path is divided into three clear stages of one hundred readings.", features: ["100 + 100 + 100", "Live counter", "Continuous session"], metric: ["0 / 300", "selected ayah"], image: "heart-300.png", kind: "screen" },
        { eyebrow: "MEMORY CHECK", title: "Recall the page. Then connect the ayat.", description: "Page recall is a separate practice. Connected reading unlocks when every ayah on the page reaches 300 readings.", features: ["Whole page", "Words in sequence", "Connected after 300"], metric: ["0 / 7", "ayat recalled"], image: "page-recall.png", kind: "screen recall" },
        { eyebrow: "AYAH IN LIFE", title: "From understanding to one sincere action.", description: "Write a personal reflection, choose one small practical step and set a time to return to your note.", features: ["Personal journal", "AI mentor support", "Return at the right time"], metric: ["5–15", "minutes to act"], image: "ayat-in-life.png", kind: "screen journal" },
        { eyebrow: "DAILY HABIT", title: "Memory becomes connected to life.", description: "Repetition strengthens the ayah, recall reveals what is firm, and the journal brings its meaning back into today.", features: ["What is firm", "What to repeat", "What to revisit"], metric: ["4", "connected steps"], kind: "flow" },
        { eyebrow: "ALLIM QUR’AN COMPANION", title: "Qur’an in the heart. Ayah in life.", description: "Begin with one ayah — carefully, consistently, and with the intention to live by its guidance.", features: ["Repeat", "Test yourself", "Reflect", "Act"], metric: ["ALLIM", "begin today"], kind: "final" }
      ]
    },
    ar: {
      filmName: "القرآن في القلب", introUnit: "قراءة", alt: "واجهة أليم",
      flow: [["كرّر", "١٠٠ + ١٠٠ + ١٠٠"], ["اختبر", "صفحة عن ظهر قلب"], ["تدبّر", "دفتر شخصي"], ["اعمل", "خطوة واضحة واحدة"]],
      scenes: [
        { eyebrow: "مسار واحد مترابط", title: "احفظ. اختبر نفسك. واعمل بالآية.", description: "تربط منصة ALLIM الحفظ والاختبار الذاتي والعمل الشخصي حول آية واحدة مختارة.", features: ["القرآن في القلب", "اختبار الصفحة", "آية في الحياة"], metric: ["١", "آية في كل مرة"], kind: "intro" },
        { eyebrow: "القرآن في القلب", title: "٣٠٠ قراءة — والتقدم ظاهر أمامك.", description: "كل تلاوة كاملة مقبولة ترفع العداد. وينقسم المسار إلى ثلاث مراحل واضحة، في كل مرحلة مائة قراءة.", features: ["١٠٠ + ١٠٠ + ١٠٠", "عداد مباشر", "جلسة متصلة"], metric: ["٠ / ٣٠٠", "الآية المختارة"], image: "heart-300.png", kind: "screen" },
        { eyebrow: "اختبار الحفظ", title: "اختبر الصفحة، ثم اربط آياتها.", description: "اختبار الصفحة تدريب مستقل. وتُفتح التلاوة المتصلة عندما تبلغ كل آية في الصفحة ثلاثمائة قراءة.", features: ["الصفحة كاملة", "الكلمات بالترتيب", "الربط بعد ٣٠٠"], metric: ["٠ / ٧", "آيات مختبرة"], image: "page-recall.png", kind: "screen recall" },
        { eyebrow: "آية في الحياة", title: "من الفهم إلى عمل صادق واحد.", description: "اكتب تدبرك الشخصي، واختر خطوة صغيرة قابلة للتنفيذ، وحدد وقتًا للعودة إلى ملاحظتك.", features: ["دفتر شخصي", "دعم المرشد الذكي", "عودة في الوقت المناسب"], metric: ["٥–١٥", "دقيقة للعمل"], image: "ayat-in-life.png", kind: "screen journal" },
        { eyebrow: "عادة يومية", title: "يصبح الحفظ مرتبطًا بالحياة.", description: "يقوّي التكرار الآية، ويكشف الاختبار ما ثبت، ويعيد الدفتر معناها إلى يومك.", features: ["ما ثبت", "ما يحتاج إلى تكرار", "ما حان الرجوع إليه"], metric: ["٤", "خطوات مترابطة"], kind: "flow" },
        { eyebrow: "ALLIM QUR’AN COMPANION", title: "القرآن في القلب. والآية في الحياة.", description: "ابدأ بآية واحدة — بتأنّ وانتظام، وبنية أن تعمل بهديها.", features: ["كرّر", "اختبر نفسك", "تدبّر", "اعمل"], metric: ["ALLIM", "ابدأ اليوم"], kind: "final" }
      ]
    },
    tr: {
      filmName: "KUR’AN KALPTE", introUnit: "OKUYUŞ", alt: "ALLIM arayüzü",
      flow: [["Tekrar", "100 + 100 + 100"], ["Sınama", "Sayfayı ezberden"], ["Tefekkür", "Kişisel günlük"], ["Uygulama", "Tek ve açık adım"]],
      scenes: [
        { eyebrow: "TEK BÜTÜNLÜKLÜ YOL", title: "Ezberleyin. Kendinizi sınayın. Hayata taşıyın.", description: "ALLIM, seçilen tek bir ayet etrafında hafızayı, öz denetimi ve kişisel davranışı birbirine bağlar.", features: ["Kur’an Kalpte", "Sayfa kontrolü", "Hayatta Ayet"], metric: ["1", "her seferinde bir ayet"], kind: "intro" },
        { eyebrow: "KUR’AN KALPTE", title: "300 okuyuş — ilerleme anında görünür.", description: "Kabul edilen her eksiksiz okuyuş sayacı artırır. Yol, her biri yüz okuyuş olan üç açık aşamaya ayrılır.", features: ["100 + 100 + 100", "Canlı sayaç", "Kesintisiz oturum"], metric: ["0 / 300", "seçilen ayet"], image: "heart-300.png", kind: "screen" },
        { eyebrow: "HAFIZA KONTROLÜ", title: "Sayfayı hatırlayın. Sonra ayetleri bağlayın.", description: "Sayfa kontrolü ayrı bir çalışmadır. Her ayet 300 okuyuşa ulaştığında bağlantılı okuyuş açılır.", features: ["Bütün sayfa", "Kelimeler sırayla", "300’den sonra bağlantı"], metric: ["0 / 7", "kontrol edilen ayet"], image: "page-recall.png", kind: "screen recall" },
        { eyebrow: "HAYATTA AYET", title: "Anlamaktan tek bir samimi davranışa.", description: "Kişisel düşüncenizi yazın, uygulanabilir küçük bir adım seçin ve notunuza döneceğiniz zamanı belirleyin.", features: ["Kişisel günlük", "AI rehberi desteği", "Zamanında geri dönüş"], metric: ["5–15", "dakikalık davranış"], image: "ayat-in-life.png", kind: "screen journal" },
        { eyebrow: "GÜNLÜK ALIŞKANLIK", title: "Hafıza hayatla bağ kurar.", description: "Tekrar ayeti güçlendirir, kontrol gerçek sağlamlığı gösterir, günlük ise anlamı bugüne taşır.", features: ["Sağlamlaşanlar", "Tekrar edilecekler", "Geri dönülecekler"], metric: ["4", "bağlantılı adım"], kind: "flow" },
        { eyebrow: "ALLIM QUR’AN COMPANION", title: "Kur’an kalpte. Ayet hayatta.", description: "Tek bir ayetle başlayın — dikkatle, düzenle ve onun rehberliğini yaşama niyetiyle.", features: ["Tekrar edin", "Kendinizi sınayın", "Düşünün", "Hayata taşıyın"], metric: ["ALLIM", "bugün başlayın"], kind: "final" }
      ]
    }
  };

  var params = new URLSearchParams(window.location.search);
  var language = languages[params.get("lang")] ? params.get("lang") : "ru";
  var locale = languages[language];
  var index = Math.max(0, Math.min(locale.scenes.length - 1, Number(params.get("scene") || 1) - 1));
  var data = locale.scenes[index];
  var stage = document.getElementById("stage");
  var features = document.getElementById("features");
  var metric = document.getElementById("metric");

  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = "ALLIM — " + locale.filmName;
  document.getElementById("film-name").textContent = locale.filmName;
  document.getElementById("intro-unit").textContent = locale.introUnit;
  document.getElementById("screen").alt = locale.alt;
  document.querySelectorAll("[data-flow-title]").forEach(function (element) {
    var position = Number(element.getAttribute("data-flow-title"));
    element.textContent = locale.flow[position][0];
  });
  document.querySelectorAll("[data-flow-text]").forEach(function (element) {
    var position = Number(element.getAttribute("data-flow-text"));
    element.textContent = locale.flow[position][1];
  });
  document.getElementById("chapter").textContent = String(index + 1).padStart(2, "0") + " / 06";
  document.getElementById("eyebrow").textContent = data.eyebrow;
  document.getElementById("title").textContent = data.title;
  document.getElementById("description").textContent = data.description;
  document.getElementById("progress").style.width = ((index + 1) / locale.scenes.length * 100) + "%";

  data.features.forEach(function (item) {
    var feature = document.createElement("span");
    feature.textContent = item;
    features.appendChild(feature);
  });

  metric.querySelector("strong").textContent = data.metric[0];
  metric.querySelector("span").textContent = data.metric[1];
  if (data.image) document.getElementById("screen").src = language === "ru" ? "assets/" + data.image : "assets/" + language + "/" + data.image;
  stage.className = "stage is-" + data.kind.split(" ").join(" is-");
}());
