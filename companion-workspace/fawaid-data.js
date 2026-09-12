(function () {
  "use strict";

  function text(ru, en, ar) {
    return Object.freeze({ ru: ru, en: en, ar: ar });
  }

  function finding(id, benefit, action, alternativeAction) {
    return Object.freeze({ id: id, benefit: benefit, actions: Object.freeze([action, alternativeAction || action]) });
  }

  window.QuranCompanionFawaid = Object.freeze({
    entries: Object.freeze({
      "92:1": Object.freeze({
        sources: Object.freeze([
          Object.freeze({
            id: "ibn-uthaymeen-92-1-4",
            scholar: text("Шейх Мухаммад ибн Салих аль-Усаймин", "Shaykh Muhammad ibn Salih al-Uthaymeen", "الشيخ محمد بن صالح العثيمين"),
            work: text("Тафсир суры «Аль-Лейль»", "Tafsir of Surah al-Layl", "تفسير سورة الليل"),
            scope: "92:1–4",
            url: "https://quranpedia.net/surah/1/92/book/27804",
            findings: Object.freeze([
              finding(
                "contrast-and-striving",
                text(
                  "Противопоставление ночи и дня, мужчины и женщины соответствует различию человеческих дел: среди них есть праведные, дурные и смешанные. Шейх называет это соответствие частью красноречия Корана.",
                  "The contrast between night and day, male and female corresponds to the divergence of human deeds: righteous, corrupt and mixed. The Shaykh identifies this correspondence as part of the Qur’an’s eloquence.",
                  "تقابل الليل والنهار والذكر والأنثى يناسب اختلاف أعمال العباد؛ فمنها الصالح والفاسد والمختلط، وذكر الشيخ أن هذا التناسب من بلاغة القرآن."
                ),
                text(
                  "проверю один сегодняшний поступок и назову, к какому виду стремления он относится",
                  "review one action from today and identify what kind of striving it belongs to",
                  "أراجع عملًا واحدًا من أعمال اليوم وأحدد إلى أي نوع من السعي ينتمي"
                ),
                text(
                  "выберу одно завтрашнее дело, относящееся к праведному стремлению, и запишу его первым пунктом",
                  "choose one action for tomorrow that belongs to righteous striving and put it first on my list",
                  "أختار عملًا واحدًا للغد من السعي الصالح وأجعله أول ما أبدأ به"
                )
              ),
              finding(
                "read-oath-with-answer",
                text(
                  "Смысл клятв в 92:1–3 раскрывается вместе с ответом клятвы в 92:4: как явно различаются ночь и день, так различаются и дела людей. Поэтому первый аят не следует толковать изолированно.",
                  "The oaths in 92:1–3 are clarified by their answer in 92:4: just as night and day visibly differ, human deeds also differ. The first verse should therefore not be interpreted in isolation.",
                  "يتضح معنى الأقسام في الآيات ١–٣ مع جواب القسم في الآية ٤؛ فكما يظهر اختلاف الليل والنهار تختلف أعمال الناس، فلا تُفهم الآية الأولى بمعزل عن السياق."
                ),
                text(
                  "прочитаю аяты 92:1–4 как единый отрывок и исправлю свой вывод по ответу клятвы",
                  "read 92:1–4 as one passage and correct my conclusion in light of the oath’s answer",
                  "أقرأ الآيات ٩٢:١–٤ مقطعًا واحدًا وأصحح استنتاجي على ضوء جواب القسم"
                ),
                text(
                  "перед следующим выводом об аяте найду в отрывке ответ клятвы и запишу связь одной фразой",
                  "find the oath’s answer in the passage before forming my next conclusion, and record the link in one sentence",
                  "أبحث قبل استنتاجي القادم عن جواب القسم في المقطع وأسجل الصلة في جملة واحدة"
                )
              )
            ])
          }),
          Object.freeze({
            id: "al-saadi-92-1-4",
            scholar: text("Шейх Абдуррахман ас-Са‘ди", "Shaykh Abd al-Rahman al-Sa‘di", "الشيخ عبد الرحمن السعدي"),
            work: text("«Тайсир аль-Карим ар-Рахман»", "Taysir al-Karim al-Rahman", "تيسير الكريم الرحمن"),
            scope: "92:1–4",
            url: "https://quranpedia.net/surah/1/92/book/3",
            findings: Object.freeze([
              finding(
                "night-rest-and-deeds",
                text(
                  "Ночь охватывает творения тьмой: люди возвращаются в жилища и отдыхают от труда. Ночь и день — время, в котором совершаются различающиеся поступки людей.",
                  "Night covers creation in darkness: people return to their dwellings and rest from labour. Night and day are the time in which people perform their differing deeds.",
                  "يغشى الليل الخلق بظلامه، فيأوون إلى مساكنهم ويستريحون من الكد، والليل والنهار زمن تقع فيه أعمال الناس على اختلافها."
                ),
                text(
                  "дам себе своевременный отдых и назову дело, ради которого хочу восстановить силы",
                  "take timely rest and name the duty for which I want to restore my strength",
                  "أستريح في الوقت المناسب وأحدد العمل الذي أستعيد قوتي لأجله"
                ),
                text(
                  "отложу телефон на десять минут и дам себе отдохнуть от сегодняшнего труда",
                  "put my phone aside for ten minutes and allow myself to rest from today’s labour",
                  "أضع هاتفي جانبًا عشر دقائق وأستريح من كد اليوم"
                )
              )
            ])
          }),
          Object.freeze({
            id: "al-jazairi-92-1-11",
            scholar: text("Шейх Абу Бакр аль-Джазаири", "Shaykh Abu Bakr al-Jaza’iri", "الشيخ أبو بكر الجزائري"),
            work: text("«Айсар ат-тафасир» · «Наставления аятов»", "Aysar al-Tafasir · Guidance of the verses", "أيسر التفاسير · هداية الآيات"),
            scope: "92:1–11",
            url: "https://quranpedia.net/surah/1/92/book/201",
            findings: Object.freeze([
              finding(
                "signs-require-worship",
                text(
                  "Ночь и день указывают на величие, могущество и знание Аллаха; признание Его господства требует поклонения Ему одному.",
                  "Night and day point to Allah’s greatness, power and knowledge; affirming His lordship requires worshipping Him alone.",
                  "يدل الليل والنهار على عظمة الله وقدرته وعلمه، وربوبيته سبحانه تقتضي عبادته وحده دون سواه."
                ),
                text(
                  "назову одно знамение могущества Аллаха и обновлю намерение поклоняться Ему одному",
                  "name one sign of Allah’s power and renew my intention to worship Him alone",
                  "أذكر آية من آيات قدرة الله وأجدد نية عبادته وحده"
                ),
                text(
                  "вспомню о смене ночи и дня как о знамении могущества Аллаха перед одним поклонением",
                  "remember the alternation of night and day as a sign of Allah’s power during one act of worship",
                  "أستحضر تعاقب الليل والنهار آيةً على قدرة الله في عبادة واحدة"
                )
              ),
              finding(
                "seek-obedience",
                text(
                  "По установленному Аллахом порядку содействие в благом связано с тем, что человек желает послушания, ищет его, выбирает его и направляет к нему себя и свои способности.",
                  "In Allah’s established order, being enabled to do good is connected to a person desiring obedience, seeking and choosing it, and directing the self and one’s abilities toward it.",
                  "بحسب سنة الله يرتبط التوفيق للطاعة برغبة العبد فيها وطلبها والحرص عليها واختيارها وتسخير النفس والجوارح لها."
                ),
                text(
                  "выберу одно посильное благое дело и начну его в обозначенный момент, не ограничиваясь намерением",
                  "choose one manageable good deed and begin it at the chosen cue instead of stopping at intention",
                  "أختار طاعة يسيرة وأبدأها عند الإشارة المحددة ولا أقف عند مجرد النية"
                ),
                text(
                  "уберу одно конкретное препятствие, которое откладывает выбранное благое дело",
                  "remove one concrete obstacle that has been delaying the good deed I chose",
                  "أزيل عائقًا محددًا يؤخر الطاعة التي اخترتها"
                )
              )
            ])
          })
        ])
      })
    })
  });
}());
