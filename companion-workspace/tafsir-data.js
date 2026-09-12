(function () {
  "use strict";

  function text(ru, en, ar) {
    return Object.freeze({ ru: ru, en: en, ar: ar });
  }

  window.QuranCompanionTafsir = Object.freeze({
    source: Object.freeze({
      titleAr: "أضواء البيان في إيضاح القرآن بالقرآن",
      title: text(
        "«Адва аль-Баян»: разъяснение Корана Кораном",
        "Adwa al-Bayan: Clarifying the Qur’an by the Qur’an",
        "أضواء البيان في إيضاح القرآن بالقرآن"
      ),
      author: text(
        "Мухаммад аль-Амин аш-Шанкыти",
        "Muhammad al-Amin al-Shinqiti",
        "محمد الأمين الشنقيطي"
      ),
      completer: text(
        "‘Атыйя Мухаммад Салим — продолжение труда",
        "Atiyyah Muhammad Salim — continuation of the work",
        "عطية محمد سالم — تتمة الكتاب"
      ),
      bookUrl: "https://quranpedia.net/book/308",
      islamHouseUrl: "https://islamhouse.com/ar/books/2827013/",
      waqfeyaUrl: "https://waqfeya.net/books/%D8%A3%D8%B6%D9%88%D8%A7%D8%A1-%D8%A7%D9%84%D8%A8%D9%8A%D8%A7%D9%86-%D9%81%D9%8A-%D8%A5%D9%8A%D8%B6%D8%A7%D8%AD-%D8%A7%D9%84%D9%82%D8%B1%D8%A2%D9%86-%D8%A8%D8%A7%D9%84%D9%82%D8%B1%D8%A2%D9%86-%D8%B7-%D9%85%D8%AC%D9%85%D8%B9-%D8%A7%D9%84%D9%81%D9%82%D9%87/ff2087e54da94ee885ac48a5f46ae4d0"
    }),
    entries: Object.freeze({
      "2:2": Object.freeze({
        attribution: "original",
        summary: text(
          "В выражении «руководство для богобоязненных» речь идёт об особом руководстве — содействии Аллаха принять истину и следовать ей. Оно отличается от общего разъяснения пути, которое обращено ко всем людям.",
          "In “guidance for the God-conscious,” guidance is the special enabling from Allah to accept and follow the truth. It differs from the general clarification of the path addressed to all people.",
          "المراد بالهدى للمتقين هنا الهدى الخاص، وهو التوفيق إلى قبول الحق واتباعه، بخلاف الهدى العام الذي هو بيان الطريق للناس جميعًا."
        ),
        method: text(
          "Автор собирает аяты, где одно и то же слово «руководство» имеет разные следствия: Коран становится исцелением и прибавляет верующим веру, но неверующим не приносит принятия истины. Так значение 2:2 уточняется другими аятами.",
          "The author gathers verses where the same guidance produces different outcomes: the Qur’an is healing and increases believers in faith, while it does not lead rejecters to accept the truth. Other verses therefore clarify 2:2.",
          "يجمع المؤلف الآيات التي تبين اختلاف أثر الهداية: فالقرآن شفاء للمؤمنين ويزيدهم إيمانًا، ولا يزيد الظالمين إلا خسارًا؛ وبذلك تُفسَّر دلالة الآية بآيات أخرى."
        ),
        keyTerms: Object.freeze([
          Object.freeze({ ar: "هُدًى", root: "ه د ي", meaning: text("руководство и содействие следовать истине", "guidance and enabling to follow the truth", "الدلالة والتوفيق إلى اتباع الحق") }),
          Object.freeze({ ar: "الْمُتَّقِينَ", root: "و ق ي", meaning: text("те, кто ограждает себя богобоязненностью и повиновением", "those who protect themselves through God-conscious obedience", "الذين يتقون الله بالطاعة ويجعلون بينهم وبين سخطه وقاية") })
        ]),
        connections: Object.freeze([
          Object.freeze({ ref: "41:44", url: "https://quran.com/41/44", label: text("Руководство и исцеление для верующих", "Guidance and healing for believers", "هدى وشفاء للذين آمنوا") }),
          Object.freeze({ ref: "17:82", url: "https://quran.com/17/82", label: text("Коран — исцеление и милость для верующих", "The Qur’an is healing and mercy for believers", "القرآن شفاء ورحمة للمؤمنين") }),
          Object.freeze({ ref: "9:124–125", url: "https://quran.com/9/124-125", label: text("Откровение увеличивает веру одних и нечистоту других", "Revelation increases faith in some and defilement in others", "الوحي يزيد المؤمنين إيمانًا ويزيد أهل المرض رجسًا") }),
          Object.freeze({ ref: "5:68", url: "https://quran.com/5/68", label: text("Откровение не ведёт к принятию истины того, кто отвергает её", "Revelation does not bring acceptance to one who rejects it", "الوحي لا يحمل المعرض على قبول الحق") })
        ]),
        sourceUrl: "https://quranpedia.net/surah/1/2/book/308"
      }),
      "1:4": Object.freeze({
        attribution: "original",
        summary: text(
          "«День воздаяния» — день, когда власть над итоговым расчётом очевидно принадлежит одному Аллаху. Слово «дин» здесь раскрывается как воздаяние и расчёт за совершённое.",
          "The Day of Recompense is the day when authority over final judgment is manifestly Allah’s alone. Here, din is clarified as recompense and reckoning for what was done.",
          "يوم الدين هو يوم الجزاء والحساب، حيث يظهر انفراد الله تعالى بالملك والحكم، والدين هنا بمعنى المجازاة على العمل."
        ),
        method: text(
          "Смысл термина поясняется параллельным аятом, где День воздаяния описан как день, в который ни одна душа не властна помочь другой и всё повеление принадлежит Аллаху.",
          "The term is clarified by a parallel passage describing the Day of Recompense as the day when no soul can help another and all command belongs to Allah.",
          "يُبيَّن معنى اللفظ بالآيات التي تصف يوم الدين بأنه يوم لا تملك فيه نفس لنفس شيئًا والأمر يومئذ لله."
        ),
        keyTerms: Object.freeze([
          Object.freeze({ ar: "مَـٰلِكِ", root: "م ل ك", meaning: text("Владыка и Обладатель власти", "Master and Owner of authority", "المالك المتصرف ذو السلطان") }),
          Object.freeze({ ar: "الدِّينِ", root: "د ي ن", meaning: text("воздаяние и расчёт", "recompense and reckoning", "الجزاء والحساب") })
        ]),
        connections: Object.freeze([
          Object.freeze({ ref: "82:17–19", url: "https://quran.com/82/17-19", label: text("Что даст тебе знать, что такое День воздаяния?", "What will make you know what the Day of Recompense is?", "وما أدراك ما يوم الدين") })
        ]),
        sourceUrl: "https://quranpedia.net/surah/1/1/book/308"
      }),
      "1:5": Object.freeze({
        attribution: "original",
        summary: text(
          "Поклонение в аяте обращено исключительно к Аллаху. Метод таухида строится на двух частях: отвергнуть поклонение всему помимо Него и утвердить поклонение только Ему; просьба о помощи следует той же исключительности.",
          "Worship in this verse is directed exclusively to Allah. The method of tawhid has two parts: rejecting worship of everything besides Him and affirming worship for Him alone; seeking help follows the same exclusivity.",
          "العبادة في الآية خالصة لله وحده، وطريقة التوحيد تقوم على النفي والإثبات: نفي العبادة عما سواه وإثباتها له وحده، وكذلك الاستعانة."
        ),
        method: text(
          "Аят связывается с призывом всех посланников: поклоняться Аллаху и сторониться тагута. Другие аяты повторяют, что каждому пророку было внушено: нет достойного поклонения, кроме Аллаха.",
          "The verse is connected to the message of every messenger: worship Allah and avoid false objects of worship. Other verses repeat that every prophet received the revelation that none deserves worship but Allah.",
          "تُربط الآية بدعوة جميع الرسل: اعبدوا الله واجتنبوا الطاغوت، وبالوحي إلى كل نبي أنه لا معبود بحق إلا الله."
        ),
        keyTerms: Object.freeze([
          Object.freeze({ ar: "نَعْبُدُ", root: "ع ب د", meaning: text("поклоняемся с любовью, смирением и повиновением", "worship with love, humility, and obedience", "نعبد بالمحبة والخضوع والطاعة") }),
          Object.freeze({ ar: "نَسْتَعِينُ", root: "ع و ن", meaning: text("просим помощи только у Аллаха в том, что подвластно лишь Ему", "seek Allah’s help in what only He can grant", "نطلب العون من الله فيما لا يقدر عليه إلا هو") })
        ]),
        connections: Object.freeze([
          Object.freeze({ ref: "16:36", url: "https://quran.com/16/36", label: text("Поклоняйтесь Аллаху и сторонитесь тагута", "Worship Allah and avoid false gods", "اعبدوا الله واجتنبوا الطاغوت") }),
          Object.freeze({ ref: "21:25", url: "https://quran.com/21/25", label: text("Нет божества, достойного поклонения, кроме Меня", "None has the right to be worshipped but Me", "لا إله إلا أنا فاعبدون") }),
          Object.freeze({ ref: "43:26–27", url: "https://quran.com/43/26-27", label: text("Отречение от поклоняемого, кроме Создателя", "Disavowal of all worshipped besides the Creator", "البراءة مما يُعبد إلا الذي فطرني") })
        ]),
        sourceUrl: "https://quranpedia.net/surah/1/1/book/308"
      }),
      "78:1": Object.freeze({
        attribution: "completion",
        summary: text(
          "В продолжении труда рассматриваются толкования «великой вести»: Коран, воскресение и связанная с ним Последняя жизнь. Контекст следующих аятов особенно направляет к вести о воскресении, относительно которой люди разошлись.",
          "The continuation of the work reviews interpretations of the “great news”: the Qur’an, resurrection, and the Hereafter tied to it. The following context especially points to the news of resurrection over which people differed.",
          "تعرض تتمة الكتاب أقوال المفسرين في النبإ العظيم: القرآن، والبعث، وما يتصل به من أمر الآخرة، وسياق الآيات التالية يوجّه خصوصًا إلى خبر البعث الذي اختلف فيه الناس."
        ),
        method: text(
          "Тема сопоставляется с сурой Сад, где «великая весть» упомянута рядом с предупреждением об отворачивающихся. Затем ближайший контекст — различие людей и последующее знание — используется для уточнения смысла.",
          "The theme is compared with Surah Sad, where the “great news” appears beside a warning about those who turn away. The immediate context—people’s disagreement and the knowledge to come—then narrows the meaning.",
          "تُقارن الآية بسورة ص حيث ورد النبأ العظيم مع وصف المعرضين، ثم يُستفاد من السياق القريب: اختلاف الناس ثم علمهم الآتي، في ترجيح المعنى."
        ),
        keyTerms: Object.freeze([
          Object.freeze({ ar: "النَّبَإِ", root: "ن ب أ", meaning: text("важная весть, имеющая последствия", "momentous news with consequences", "الخبر العظيم ذو الشأن والعاقبة") }),
          Object.freeze({ ar: "الْعَظِيمِ", root: "ع ظ م", meaning: text("великий по значению и последствиям", "great in meaning and consequence", "العظيم قدرًا وأثرًا") })
        ]),
        connections: Object.freeze([
          Object.freeze({ ref: "38:67–68", url: "https://quran.com/38/67-68", label: text("Это — великая весть, от которой вы отворачиваетесь", "This is tremendous news from which you turn away", "هو نبأ عظيم أنتم عنه معرضون") }),
          Object.freeze({ ref: "78:2–5", url: "https://quran.com/78/2-5", label: text("Люди разошлись о вести, но узнают её истину", "People differed over the news, but will come to know", "اختلفوا في النبإ ثم سيعلمون حقيقته") })
        ]),
        sourceUrl: "https://quranpedia.net/surah/1/78/book/308"
      })
    })
  });
}());
