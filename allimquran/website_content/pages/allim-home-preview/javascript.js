(function () {
  "use strict";

  var copies = {
    en: {},
    ru: {
      navJourney: "Путь", navIntelligence: "Коранический интеллект", navMethod: "Метод", navAcademy: "Академия", navTrust: "Доверие", openPrototype: "Начать обучение", joinJourney: "Присоединиться",
      previewLabel: "Ранний просмотр продукта · коранический ИИ в разработке", heroEyebrow: "Заучивать · Понимать · Жить", heroTitle: "Пусть Коран станет тем, что вы помните, понимаете и воплощаете.", heroLead: "ALLIM создаётся как единый путь от чтения к смыслу — и от смысла к ежедневному действию. Сфокусированный помощник для хифза, коранического арабского, тафсира с проверяемыми источниками и размышления.", exploreJourney: "Увидеть весь путь", seePrototype: "Перейти к обучению", principlePrivate: "Приватность по замыслу", principleSources: "Проверяемые источники", principleTeacher: "В поддержку преподавателя",
      demoMode: "ЗАУЧИВАНИЕ", demoSurah: "Аль-Бакара", demoCorrection: "Остановка. Исправьте слово.", demoCorrectionText: "Следующий аят закрыт, пока слово не исправлено.", reviewDue: "Пора повторить", reviewDueText: "3 аята · до ‘иша", meaningReady: "Смысл связан", meaningReadyText: "Слово · корень · тафсир",
      duaTranslation: "О Аллах, научи его Писанию.", duaSource: "Дуа Пророка ﷺ за Ибн ‘Аббаса رضي الله عنهما · Сахих аль-Бухари 75",
      journeyEyebrow: "Один аят. Один полный путь.", journeyTitle: "Больше, чем обнаружить ошибку. Больше, чем показать страницу.", journeyLead: "Цель ALLIM — соединить дисциплины, которые обычно разбросаны по разным приложениям: слушание, чтение, хифз, язык, тафсир, размышление и повторение.", listenTitle: "Слушать внимательно", listenText: "Следовать проверенному чтению, повторять выбранный отрывок и впитывать ритм до воспроизведения по памяти.", reciteTitle: "Читать и исправлять", reciteText: "Планируемый коранический речевой движок следует слово за словом, останавливает при ошибке и продолжает после исправления.", understandTitle: "Понимать аят", understandText: "Видеть лексику, корни, структуру, перевод и тафсир с источниками, не выпадая из чтения.", liveTitle: "Воплощать в жизни", liveText: "Превращать смысл в личное размышление, малое действие и повторение в нужный момент.",
      intelligenceEyebrow: "Коранический интеллект с границами", intelligenceTitle: "ИИ-помощник, который знает, когда слушать — и когда не выдумывать.", intelligenceLead: "ALLIM проектируется вокруг проверенного текста Корана, ясного указания источников и честного признания неопределённости. Он должен помогать двигаться по надёжному знанию, а не выдавать догадку за тафсир или машинную оценку за иджазу преподавателя.", aiRecitationTitle: "Интеллект чтения", aiRecitationText: "Порядок слов, пропуски и остановка для исправления — с настраиваемыми сигналами и строгим режимом.", aiMemoryTitle: "Интеллект памяти", aiMemoryText: "Очередь повторения на основе запинок, ошибок, прочности и времени после последнего воспроизведения.", aiKnowledgeTitle: "Интеллект знания", aiKnowledgeText: "Ответы только из подключённых источников: арабский текст, перевод и авторство рядом.", mapGuidance: "руководство", mapRoot: "Корень", mapTafsir: "Тафсир", mapTafsirText: "Коран посредством Корана", mapAction: "Сегодня", mapActionText: "Одно осмысленное действие",
      methodEyebrow: "Метод для прочного сохранения", methodTitle: "Малые отрывки. Глубокое внимание. Своевременное возвращение.", methodLead: "Платформа не должна торопить ученика по страницам. Она должна делать каждое возвращение осмысленнее, а каждый выученный аят — прочнее.", tabMemorize: "Заучивать", tabMemorizeText: "Активное воспроизведение и исправление", tabUnderstand: "Понимать", tabUnderstandText: "Язык и надёжный тафсир", tabLive: "Жить", tabLiveText: "Размышление и действие",
      stageBadgeMemorize: "СЕССИЯ ХИФЗА", stageMemorizeTitle: "Сначала вспомнить — потом открыть.", stageMemorizeText: "Слова скрыты. Правильное чтение открывает путь; ошибка удерживает ученика именно там, где требуется исправление.", stageM1: "Настраиваемая строгая проверка", stageM2: "Автопереход к следующему аяту", stageM3: "Интервальная очередь повторения", stageBadgeUnderstand: "КОРАИНЧЕСКИЙ АРАБСКИЙ", stageUnderstandTitle: "Смысл — не покидая аят.", stageUnderstandText: "От слова к корню, от фразы к синтаксису и от перевода к карточке тафсира с ясным авторством.", stageU1: "Пословный смысл и морфология", stageU2: "Арабский тафсир и перевод", stageU3: "Связи между аятами", rootLabel: "КОРЕНЬ", meaningLabel: "ЗНАЧЕНИЕ", bookMeaning: "Писание", sourceMini: "Карточка источника · Адва аль-Баян", stageBadgeLive: "РАЗМЫШЛЕНИЕ", stageLiveTitle: "От понимания — к одному искреннему действию.", stageLiveText: "Личная подсказка помогает назвать, что аят меняет сегодня, а затем возвращает к нему для укрепления памяти и практики.", stageL1: "Личный дневник размышлений", stageL2: "Одно малое направленное действие", stageL3: "Повторение, связанное с жизненным контекстом", actionPrompt: "Что этот аят изменит сегодня в моей речи?", writeReflection: "Записать личное размышление",
      academyEyebrow: "ALLIM QUR’AN ACADEMY", academyTitle: "Открытое знание для каждого. Живое наставничество квалифицированных преподавателей.", academyLead: "Все цифровые инструменты для самостоятельного обучения в ALLIM должны оставаться бесплатными во всём мире. Academy добавляет человеческий слой: живые занятия, личное исправление, системное обучение и ответственные программы с квалифицированными преподавателями.", academyPrincipleTitle: "Бесплатное обучение — основа", academyPrincipleText: "Оплата может относиться только ко времени преподавателя, программам с проверкой и связанным живым услугам — не к базовому доступу к Корану.", openLabel: "ОТКРЫТЫЙ ALLIM", openTitle: "Учиться самостоятельно. Бесплатно во всём мире.", openText: "Личное пространство для практики чтения, заучивания, коранического арабского, тафсира с источниками, размышления и прогресса.", openItem1: "План хифза и интервальное повторение", openItem2: "Практика чтения и слушание", openItem3: "Язык, смысл и размышление", openItem4: "Личная история обучения", openDigital: "Открыть цифровое обучение", guidedLabel: "ACADEMY С ПРЕПОДАВАТЕЛЕМ", guidedTitle: "Учиться вместе с преподавателем.", guidedText: "Индивидуальные или групповые занятия вживую, задания, обратная связь, история прогресса и ясная связь между учеником, преподавателем и программой.", guidedItem1: "Программы Корана и арабского с преподавателем", guidedItem2: "Живое исправление и личная обратная связь", guidedItem3: "Кабинеты ученика, преподавателя и родителя", guidedItem4: "Оценивание и подтверждённая история обучения", joinAcademy: "Оставить интерес к Academy", ijazahTitle: "Иджаза остаётся живым аманатом.", ijazahText: "Платформа никогда не выдаёт иджазу автоматически. Путь может завершаться только с квалифицированным уполномоченным преподавателем после необходимого чтения, обучения и оценки.",
      trustEyebrow: "Сначала доверие — потом масштаб", trustTitle: "Технология должна служить передаче Корана, а не размывать его источники.", verifiedTextTitle: "Сначала проверенный текст", verifiedTextText: "Текст Корана и учебные материалы связаны с определяемыми источниками и проверенными корпусами.", traceTitle: "Видимое авторство", traceText: "Арабский источник, перевод и авторство остаются на экране. Если карточка не проверена, ALLIM должен сказать об этом.", privacyTitle: "Приватность с выбором", privacyText: "Прогресс по умолчанию остаётся личным, а обработка голоса и синхронизация имеют ясные настройки.", teacherTitle: "Преподаватель остаётся центральным", teacherText: "ALLIM поддерживает практику между занятиями, но не заменяет квалифицированного преподавателя, живое исправление или иджазу.",
      earlyEyebrow: "Путь начинается", earlyTitle: "Помогите сформировать кораническую платформу для глубины, а не отвлечения.", earlyText: "ALLIM активно разрабатывается. Мы готовим корпус Корана, речевой движок и систему обучения к ответственной проверке.", exploreAcademy: "Посмотреть модель Academy", footerProduct: "Продукт", footerPrinciples: "Принципы", developmentStatus: "Продукт активно разрабатывается", footerDisclaimer: "ИИ-проверка чтения — учебный инструмент, который нельзя представлять заменой квалифицированного преподавателя Корана.", footerMission: "Заучивать · Понимать · Жить"
    },
    ar: {
      navJourney: "الرحلة", navIntelligence: "الذكاء القرآني", navMethod: "المنهج", navAcademy: "الأكاديمية", navTrust: "الثقة", openPrototype: "ابدأ التعلّم", joinJourney: "انضم إلى الرحلة",
      previewLabel: "معاينة مبكرة · الذكاء القرآني قيد التطوير", heroEyebrow: "احفظ · افهم · اعمل", heroTitle: "ليكن القرآن ما تحفظه وتفهمه وتعيش به.", heroLead: "يُبنى ALLIM ليكون رحلة واحدة من التلاوة إلى المعنى، ومن المعنى إلى العمل اليومي؛ رفيقًا مركزًا للحفظ والعربية القرآنية والتفسير الموثق والتدبر.", exploreJourney: "اكتشف الرحلة", seePrototype: "انتقل إلى التعلّم", principlePrivate: "الخصوصية أصل", principleSources: "مصادر قابلة للتحقق", principleTeacher: "في خدمة المعلّم",
      demoMode: "الحفظ", demoSurah: "البقرة", demoCorrection: "توقّف. صحّح الكلمة.", demoCorrectionText: "تبقى الآية التالية مغلقة حتى تصحيح الكلمة.", reviewDue: "حان وقت المراجعة", reviewDueText: "٣ آيات · قبل العشاء", meaningReady: "اكتمل ربط المعنى", meaningReadyText: "كلمة · جذر · تفسير",
      duaTranslation: "اللهم علّمه الكتاب.", duaSource: "دعاء النبي ﷺ لابن عباس رضي الله عنهما · صحيح البخاري ٧٥",
      journeyEyebrow: "آية واحدة. رحلة متكاملة.", journeyTitle: "أكثر من اكتشاف الخطأ. وأكثر من عرض الصفحة.", journeyLead: "غاية ALLIM جمع ما يتفرق عادةً بين تطبيقات متعددة: الاستماع والتلاوة والحفظ واللغة والتفسير والتدبر والمراجعة.", listenTitle: "استمع بانتباه", listenText: "تابع تلاوة موثوقة، وكرّر المقطع المختار، واستوعب إيقاعه قبل الاستظهار.", reciteTitle: "اتلُ وصحّح", reciteText: "يتابع محرك التعرّف القرآني المخطط له كلمةً كلمة، ويتوقف عند الخطأ ولا يستأنف إلا بعد التصحيح.", understandTitle: "افهم الآية", understandText: "شاهد المفردات والجذور والتركيب والترجمة والتفسير الموثق دون مغادرة سياق التلاوة.", liveTitle: "اعمل بالآية", liveText: "حوّل المعنى إلى تدبر شخصي وعمل صغير ومراجعة تعود في الوقت المناسب.",
      intelligenceEyebrow: "ذكاء قرآني منضبط", intelligenceTitle: "رفيق ذكي يعرف متى يستمع — ومتى لا يخمّن.", intelligenceLead: "يُصمَّم ALLIM على النص القرآني الموثق، ونسبة العلم إلى مصادره، والتصريح الصادق بحدود المعرفة. يساعد المتعلم على الوصول إلى العلم الموثوق، ولا يعرض التخمين تفسيرًا ولا التقييم الآلي إجازةً من معلّم.", aiRecitationTitle: "ذكاء التلاوة", aiRecitationText: "ترتيب الكلمات والسقط وبوابات التصحيح، مع إشارات صوتية ووضع صارم قابلين للضبط.", aiMemoryTitle: "ذكاء الحفظ", aiMemoryText: "جدول مراجعة يتكيّف مع التردد والأخطاء وقوة الحفظ والمدة منذ آخر استظهار.", aiKnowledgeTitle: "ذكاء المعرفة", aiKnowledgeText: "إجابات مقيدة بالمصادر المرتبطة، مع إظهار النص العربي والترجمة والنسبة معًا.", mapGuidance: "هداية", mapRoot: "الجذر", mapTafsir: "التفسير", mapTafsirText: "تفسير القرآن بالقرآن", mapAction: "اليوم", mapActionText: "عمل واحد موجّه",
      methodEyebrow: "منهج يثبّت الحفظ", methodTitle: "مقاطع صغيرة. انتباه عميق. عودة في وقتها.", methodLead: "لا تُصمّم المنصة لدفع المتعلم سريعًا بين الصفحات، بل لتجعل كل عودة أعمق وكل آية محفوظة أثبت.", tabMemorize: "احفظ", tabMemorizeText: "استرجاع نشط وتصحيح", tabUnderstand: "افهم", tabUnderstandText: "لغة وتفسير موثوق", tabLive: "اعمل", tabLiveText: "تدبر وتطبيق",
      stageBadgeMemorize: "جلسة حفظ", stageMemorizeTitle: "استحضر أولًا، ثم اكشف.", stageMemorizeText: "تبقى الكلمات مخفية. تفتح التلاوة الصحيحة الطريق، ويثبت الخطأ موضع الإصلاح تحديدًا.", stageM1: "تصحيح صارم قابل للضبط", stageM2: "انتقال تلقائي إلى الآية التالية", stageM3: "مراجعة متباعدة", stageBadgeUnderstand: "العربية القرآنية", stageUnderstandTitle: "المعنى دون مغادرة الآية.", stageUnderstandText: "من الكلمة إلى الجذر، ومن العبارة إلى التركيب، ومن الترجمة إلى بطاقة تفسير واضحة النسبة.", stageU1: "معنى كلمةً كلمة وصرف", stageU2: "تفسير عربي مع ترجمة", stageU3: "روابط بين الآيات", rootLabel: "الجذر", meaningLabel: "المعنى", bookMeaning: "الكتاب", sourceMini: "بطاقة المصدر · أضواء البيان", stageBadgeLive: "التدبر", stageLiveTitle: "من الفهم إلى عمل صادق.", stageLiveText: "يساعد سؤال خاص المتعلم على تحديد ما تغيّره الآية اليوم، ثم يعيده إليها لتثبيت الحفظ والعمل.", stageL1: "دفتر تدبر خاص", stageL2: "عمل صغير موجّه", stageL3: "مراجعة مرتبطة بسياق الحياة", actionPrompt: "ما الذي ستغيّره هذه الآية في كلامي اليوم؟", writeReflection: "اكتب تدبرًا خاصًا",
      academyEyebrow: "أكاديمية ALLIM للقرآن", academyTitle: "معرفة مفتوحة للجميع، وتوجيه حي على أيدي معلّمين مؤهلين.", academyLead: "نعتزم أن تبقى جميع أدوات التعلم الذاتي الرقمية في ALLIM مجانية للعالم كله. وتضيف الأكاديمية البعد الإنساني: دروسًا مباشرة وتصحيحًا شخصيًا ودراسة منظمة ومسارات منضبطة مع معلّمين مؤهلين.", academyPrincipleTitle: "التعلم المجاني هو الأصل", academyPrincipleText: "قد تكون الأجرة مقابل وقت المعلّم والبرامج المقوّمة والخدمات المباشرة المرتبطة بها، لا مقابل الوصول الأساسي إلى القرآن.", openLabel: "ALLIM المفتوح", openTitle: "تعلّم بنفسك، مجانًا في كل العالم.", openText: "مساحة شخصية للتدرّب على التلاوة والحفظ والعربية القرآنية والتفسير الموثق والتدبر ومتابعة التقدم.", openItem1: "خطة حفظ ومراجعة متباعدة", openItem2: "تدريب على التلاوة والاستماع", openItem3: "لغة ومعنى وتدبر", openItem4: "سجل تعلم خاص", openDigital: "افتح التعلم الرقمي", guidedLabel: "الأكاديمية الموجّهة", guidedTitle: "تعلّم مع معلّم.", guidedText: "تعلم فردي أو جماعي مباشر، مع واجبات وتغذية راجعة وسجل تقدم وعلاقة واضحة بين المتعلم والمعلّم والمنهج.", guidedItem1: "برامج القرآن والعربية بقيادة معلّم", guidedItem2: "تصحيح مباشر وملاحظات شخصية", guidedItem3: "لوحات للمتعلم والمعلّم وولي الأمر", guidedItem4: "تقييم وسجل دراسة موثق", joinAcademy: "سجّل اهتمامك بالأكاديمية", ijazahTitle: "الإجازة أمانة بشرية.", ijazahText: "لا تمنح المنصة الإجازة آليًا أبدًا. ولا يكتمل المسار إلا مع معلّم مؤهل مأذون له وبعد القراءة والدراسة والتقييم المطلوب.",
      trustEyebrow: "الثقة قبل التوسع", trustTitle: "ينبغي للتقنية أن تخدم نقل القرآن، لا أن تطمس مصادره.", verifiedTextTitle: "النص الموثق أولًا", verifiedTextText: "يرتبط النص القرآني والمواد التعليمية بمصادر معروفة ومتون مراجعة.", traceTitle: "نسبة ظاهرة", traceText: "يبقى المصدر العربي والترجمة والمؤلف ظاهرين، وإذا لم تُراجع البطاقة صرّح ALLIM بذلك.", privacyTitle: "خصوصية مع الاختيار", privacyText: "يبقى التقدم خاصًا افتراضيًا، مع ضوابط واضحة لمعالجة الصوت والمزامنة.", teacherTitle: "المعلّم في المركز", teacherText: "يدعم ALLIM التدريب بين الدروس، ولا يستبدل المعلّم المؤهل أو التصحيح الحي أو الإجازة.",
      earlyEyebrow: "الرحلة تبدأ", earlyTitle: "شارك في تشكيل منصة قرآنية للعمق لا للتشتيت.", earlyText: "ALLIM قيد التطوير النشط. نُعِدّ المتن القرآني ومحرك التلاوة ونظام التعلم للاختبار المسؤول.", exploreAcademy: "اكتشف نموذج الأكاديمية", footerProduct: "المنتج", footerPrinciples: "المبادئ", developmentStatus: "المنتج قيد التطوير", footerDisclaimer: "التغذية الراجعة الآلية على التلاوة أداة تعليمية وليست بديلًا عن معلّم قرآن مؤهل.", footerMission: "احفظ · افهم · اعمل"
    }
  };

  var languageOrder = ["en", "ar", "ru"];
  var languageIndex = 0;

  function applyLanguage(language) {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.getElementById("language-switch").textContent = language.toUpperCase();
    document.querySelectorAll("[data-copy]").forEach(function (element) {
      var key = element.getAttribute("data-copy");
      if (!element.dataset.copyDefault) element.dataset.copyDefault = element.textContent;
      var value = language === "en" ? element.dataset.copyDefault : copies[language] && copies[language][key];
      if (value) element.textContent = value;
    });
  }

  document.getElementById("language-switch").addEventListener("click", function () {
    languageIndex = (languageIndex + 1) % languageOrder.length;
    applyLanguage(languageOrder[languageIndex]);
  });

  var menuButton = document.getElementById("menu-button");
  var mobileMenu = document.getElementById("mobile-menu");
  menuButton.addEventListener("click", function () {
    var open = mobileMenu.hidden;
    mobileMenu.hidden = !open;
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.querySelector("use").setAttribute("href", open ? "#i-close" : "#i-menu");
  });
  mobileMenu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      mobileMenu.hidden = true;
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.querySelector("use").setAttribute("href", "#i-menu");
    });
  });

  document.querySelectorAll(".method-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var panel = tab.getAttribute("data-panel");
      document.querySelectorAll(".method-tab").forEach(function (item) {
        var active = item === tab;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll(".method-panel").forEach(function (item) {
        var active = item.id === "panel-" + panel;
        item.hidden = !active;
        item.classList.toggle("is-active", active);
      });
    });
  });

  var header = document.querySelector(".site-header");
  window.addEventListener("scroll", function () {
    header.style.boxShadow = window.scrollY > 18 ? "0 18px 46px rgba(0,0,0,.18)" : "0 1px 0 rgba(255,255,255,.03)";
  }, { passive: true });

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var heroProduct = document.querySelector(".hero-product");
  var demo = document.querySelector(".recitation-demo");
  if (!reduceMotion && heroProduct && demo && window.matchMedia("(pointer:fine)").matches) {
    heroProduct.addEventListener("pointermove", function (event) {
      var bounds = heroProduct.getBoundingClientRect();
      var x = (event.clientX - bounds.left) / bounds.width - .5;
      var y = (event.clientY - bounds.top) / bounds.height - .5;
      demo.style.setProperty("--tilt-x", (x * 5).toFixed(2) + "deg");
      demo.style.setProperty("--tilt-y", (y * -4).toFixed(2) + "deg");
    });
    heroProduct.addEventListener("pointerleave", function () {
      demo.style.removeProperty("--tilt-x");
      demo.style.removeProperty("--tilt-y");
    });
  }

  if (!reduceMotion && "IntersectionObserver" in window) {
    var revealTargets = document.querySelectorAll(".section-intro,.journey-card,.intelligence-copy,.knowledge-map,.method-layout,.academy-intro,.academy-card,.ijazah-note,.trust-heading,.trust-grid,.early-copy");
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12, rootMargin: "0px 0px -5%" });
    revealTargets.forEach(function (element, index) {
      element.classList.add("reveal-ready");
      element.style.transitionDelay = Math.min(index % 4, 3) * 70 + "ms";
      observer.observe(element);
    });
  }

  applyLanguage("en");
}());
