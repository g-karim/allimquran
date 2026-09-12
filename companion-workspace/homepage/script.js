(function () {
  "use strict";

  function setBrandFavicon() {
    var iconUrl = window.location.protocol === "file:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "allim-brand-icon.png"
      : "/files/allim-brand-icon.png?v=65";
    document.querySelectorAll('head link[rel~="icon"],head link[rel="apple-touch-icon"]').forEach(function (node) { node.remove(); });
    ["icon", "apple-touch-icon"].forEach(function (relation) {
      var link = document.createElement("link");
      link.rel = relation;
      link.href = iconUrl;
      if (relation === "icon") link.type = "image/png";
      document.head.appendChild(link);
    });
  }

  setBrandFavicon();

  function mediaUrl(remotePath, localPath) {
    var localPreview = window.location.protocol === "file:" ||
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!localPreview) return remotePath;
    try {
      return new URL(localPath, window.location.href).href;
    } catch (error) {
      return localPath;
    }
  }

  function setupSystemIntro(options) {
    var intro = document.getElementById("allim-system-intro");
    if (!intro) return;

    options = options || {};
    var storageName = "allim-system-intro-seen-v1";
    var params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (error) {
      params = { get: function () { return null; } };
    }

    var forceIntro = params.get("intro") === "1";
    var skipIntro = params.get("intro") === "0";
    var seen = false;
    try {
      seen = window.localStorage.getItem(storageName) === "1";
    } catch (error) {
      seen = false;
    }

    function warmSystem() {
      var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      var targets = (connection && connection.saveData) ? (options.warm || []).slice(0, 1) : (options.warm || []);
      var requests = targets.map(function (target) {
        return window.fetch(target, {
          method: "GET",
          credentials: "same-origin",
          cache: "force-cache"
        }).then(function (response) {
          return response.ok;
        }).catch(function () {
          return false;
        });
      });
      return Promise.all(requests);
    }

    if (skipIntro || (seen && !forceIntro)) {
      intro.remove();
      warmSystem();
      return;
    }

    var language = document.documentElement.lang || "en";
    var labels = language.indexOf("ar") === 0 ? {
      sound: "استمع إلى الدعاء", playing: "يُتلى الدعاء", skip: "تخطّ", mission: "دعاء صار رسالتنا", loading: "نهيّئ مساحة التلاوة"
    } : (language.indexOf("ru") === 0 ? {
      sound: "Слушать дуа", playing: "Звучит дуа", skip: "Пропустить", mission: "Дуа, ставшая нашей миссией", loading: "Готовим пространство для чтения"
    } : (language.indexOf("tr") === 0 ? {
      sound: "Duayı dinle", playing: "Dua okunuyor", skip: "Geç", mission: "Bir dua misyonumuz oldu", loading: "Okuma alanınız hazırlanıyor"
    } : {
      sound: "Listen to the du‘a", playing: "Playing the du‘a", skip: "Skip", mission: "A prayer became our mission", loading: "Preparing your reading space"
    }));
    var introCopy = copies[language] || {};
    labels.sound = introCopy.introSound || labels.sound;
    labels.playing = introCopy.introPlaying || labels.playing;
    labels.skip = introCopy.introSkip || labels.skip;
    labels.mission = introCopy.introMission || labels.mission;
    labels.loading = introCopy.introLoading || labels.loading;

    var soundButton = document.getElementById("system-intro-sound");
    var skipButton = document.getElementById("system-intro-skip");
    var audio = document.getElementById("system-intro-audio");
    if (audio && mediaUrl(audio.getAttribute("src"), "../assets/audio/allim-dua-ar-v2.m4a") !== audio.getAttribute("src")) {
      audio.src = mediaUrl(audio.getAttribute("src"), "../assets/audio/allim-dua-ar-v2.m4a");
      audio.load();
    }
    var mission = intro.querySelector(".system-intro-mission");
    var loading = intro.querySelector(".system-intro-load small");
    var timers = [];
    var exiting = false;
    var exitRequested = false;
    var finishRequested = false;
    var audioPlaying = false;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (soundButton) soundButton.querySelector("span").textContent = labels.sound;
    if (skipButton) skipButton.textContent = labels.skip;
    if (mission) mission.textContent = labels.mission;
    if (loading) loading.textContent = labels.loading;

    function setUnderlyingInert(value) {
      Array.prototype.forEach.call(intro.parentElement.children, function (element) {
        if (element === intro) return;
        if (value) {
          element.dataset.allimIntroAriaHidden = element.hasAttribute("aria-hidden") ? element.getAttribute("aria-hidden") : "__none__";
          element.setAttribute("aria-hidden", "true");
        } else if (element.dataset.allimIntroAriaHidden) {
          if (element.dataset.allimIntroAriaHidden === "__none__") element.removeAttribute("aria-hidden");
          else element.setAttribute("aria-hidden", element.dataset.allimIntroAriaHidden);
          delete element.dataset.allimIntroAriaHidden;
        }
        if ("inert" in element) element.inert = value;
      });
    }

    function rememberIntro() {
      try {
        window.localStorage.setItem(storageName, "1");
      } catch (error) {
        /* A private browsing mode may reject persistent storage. */
      }
    }

    function clearTimers() {
      timers.forEach(function (timer) { window.clearTimeout(timer); });
      timers = [];
    }

    function exitIntro() {
      if (exiting) return;
      if (audioPlaying) {
        exitRequested = true;
        return;
      }
      exiting = true;
      clearTimers();
      rememberIntro();
      intro.classList.add("is-exiting");
      document.body.classList.remove("allim-intro-active");
      document.body.removeAttribute("aria-busy");
      setUnderlyingInert(false);
      window.setTimeout(function () {
        if (intro.parentNode) intro.parentNode.removeChild(intro);
      }, reduceMotion ? 20 : 680);
    }

    function requestFinish() {
      if (exiting || finishRequested) return;
      finishRequested = true;
      intro.setAttribute("data-stage", "ready");
      timers.push(window.setTimeout(exitIntro, reduceMotion ? 180 : 860));
    }

    document.body.classList.add("allim-intro-active");
    document.body.setAttribute("aria-busy", "true");
    setUnderlyingInert(true);

    if (soundButton && audio) {
      soundButton.addEventListener("click", function () {
        if (audioPlaying) return;
        audio.currentTime = 0;
        var playback = audio.play();
        if (!playback || typeof playback.then !== "function") return;
        playback.then(function () {
          audioPlaying = true;
          soundButton.classList.add("is-playing");
          soundButton.querySelector("span").textContent = labels.playing;
        }).catch(function () {
          soundButton.querySelector("span").textContent = labels.sound;
        });
      });
      audio.addEventListener("ended", function () {
        audioPlaying = false;
        soundButton.classList.remove("is-playing");
        soundButton.querySelector("span").textContent = labels.sound;
        if (exitRequested) exitIntro();
      });
      audio.addEventListener("error", function () {
        audioPlaying = false;
        if (exitRequested) exitIntro();
      });
    }
    if (skipButton) {
      skipButton.addEventListener("click", function () {
        if (audio && !audio.paused) {
          audio.pause();
          audioPlaying = false;
        }
        exitIntro();
      });
    }

    timers.push(window.setTimeout(function () {
      intro.setAttribute("data-stage", "dua");
    }, reduceMotion ? 30 : 560));
    timers.push(window.setTimeout(function () {
      intro.setAttribute("data-stage", "brand");
    }, reduceMotion ? 70 : 1450));

    var pageReady = new Promise(function (resolve) {
      if (document.readyState === "complete") {
        resolve();
      } else {
        window.addEventListener("load", resolve, { once: true });
      }
    });
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready.catch(function () {}) : Promise.resolve();
    var warmReady = warmSystem();
    var readiness = Promise.all([pageReady, fontsReady, warmReady]);
    var maximumWait = new Promise(function (resolve) {
      timers.push(window.setTimeout(resolve, reduceMotion ? 100 : 2500));
    });
    var minimumReveal = new Promise(function (resolve) {
      timers.push(window.setTimeout(resolve, reduceMotion ? 100 : 1900));
    });

    Promise.all([minimumReveal, Promise.race([readiness, maximumWait])]).then(requestFinish).catch(requestFinish);
    timers.push(window.setTimeout(requestFinish, reduceMotion ? 260 : 4200));
    timers.push(window.setTimeout(function () {
      if (!exiting) {
        audioPlaying = false;
        exitIntro();
      }
    }, reduceMotion ? 520 : 7200));
  }


  var copies = {
    en: {},
    ru: {
      navJourney: "Путь", navIntelligence: "Коранический интеллект", navMethod: "Метод", navAcademy: "Академия", navGuides: "Материалы", navTrust: "Доверие", openPrototype: "Начать обучение", joinJourney: "Присоединиться", studentCabinetAction: "Кабинет ученика", openStudentCabinet: "Открыть кабинет ученика", openGuidedCabinet: "Открыть кабинет с преподавателем",
      previewLabel: "Ранний просмотр продукта · коранический ИИ в разработке", heroEyebrow: "Заучивать · Понимать · Воплощать", heroTitle: "Коран — в памяти, понимании и жизни.", heroLead: "АЛЛИМ соединяет чтение, понимание слов, заучивание и повторение в одном спокойном пути — с проверяемыми источниками и поддержкой преподавателя.", exploreJourney: "Увидеть весь путь", seePrototype: "Перейти к обучению", principlePrivate: "Приватность по замыслу", principleSources: "Проверяемые источники", principleTeacher: "В поддержку преподавателя",
      demoMode: "ЗАУЧИВАНИЕ", demoSurah: "Аль-Бакара", demoCorrection: "Остановка. Исправьте слово.", demoCorrectionText: "Следующий аят закрыт, пока слово не исправлено.", reviewDue: "Пора повторить", reviewDueText: "3 аята · до ‘иша", meaningReady: "Смысл связан", meaningReadyText: "Слово · корень · тафсир",
      duaTranslation: "О Аллах, научи его Писанию.", duaSource: "Дуа Пророка ﷺ за Ибн ‘Аббаса رضي الله عنهما · Сахих аль-Бухари 75", filmEyebrow: "Увидеть весь путь", filmTitle: "Как АЛЛИМ превращает один аят в целостный путь обучения.", filmLead: "Премиальный обзор: пословное чтение, непрерывная проверка, 300 повторений, мусхаф, тафсир и Академия.", filmBadge: "Полная презентация · русская озвучка", filmFallback: "Ваш браузер не может воспроизвести это видео.",
      journeyEyebrow: "Один аят. Один полный путь.", journeyTitle: "Не просто найти ошибку. Пройти путь от чтения к пониманию.", journeyLead: "АЛЛИМ объединяет то, что обычно разделено между разными приложениями: слушание, чтение, хифз, язык, тафсир, размышление и повторение.", listenTitle: "Слушать внимательно", listenText: "Следовать проверенному чтению, повторять выбранный отрывок и впитывать ритм до воспроизведения по памяти.", reciteTitle: "Читать и исправлять", reciteText: "Планируемый коранический речевой движок следует слово за словом, останавливает при ошибке и продолжает после исправления.", understandTitle: "Понимать аят", understandText: "Видеть лексику, корни, структуру, перевод и тафсир с источниками, не выпадая из чтения.", liveTitle: "Воплощать в жизни", liveText: "Превращать смысл в личное размышление, малое действие и повторение в нужный момент.",
      heartFeatureEyebrow: "НОВОЕ · КОРАН В СЕРДЦЕ", heartFeatureTitle: "Собирайте Коран в сердце — целыми, связанными страницами.", heartFeatureLead: "Каждое принятое чтение укрепляет аят. Когда собраны все аяты страницы, АЛЛИМ предлагает прочитать её непрерывно, чтобы память стала связной, а не фрагментарной.", heartStepOneTitle: "Повторяйте с видимым счётчиком", heartStepOneText: "Видно каждое принятое повторение и точный путь до 300.", heartStepTwoTitle: "Соберите каждый аят", heartStepTwoText: "Полная страница показывает, что уже прочно, а что ещё требует работы.", heartStepThreeTitle: "Свяжите всю страницу", heartStepThreeText: "На 100% прочитайте от первого аята до последнего без разрыва.", heartStepFourTitle: "Закрепите собранное", heartStepFourText: "Связанная страница сохраняется на этом устройстве и не исчезает из-за пропущенной недели.", heartFeatureAction: "Открыть сбор страницы", heartPageLabel: "СТРАНИЦА МУСХАФА", heartAyatCollected: "аята собрано", heartGateTitle: "Связное чтение страницы", heartGateText: "Откроется, когда все 7 аятов достигнут 300 / 300", heartSealNote: "После одного успешного связного чтения страница становится постоянной.", heartFilmEyebrow: "МЕТОДИКА В ДЕЙСТВИИ", heartFilmTitle: "Посмотрите, как 300 повторений становятся памятью, проверкой и одним действием.", heartFilmLead: "Короткое объяснение живого счётчика, проверки страницы наизусть, связного чтения и дневника «Аят в жизни».", heartFilmBadge: "Тематический ролик · русская озвучка", heartFilmFallback: "Ваш браузер не может воспроизвести это видео.",
      intelligenceEyebrow: "Коранический интеллект с ясными границами", intelligenceTitle: "ИИ-помощник для чтения, повторения и ответов по проверенным источникам.", intelligenceLead: "АЛЛИМ опирается на проверенный текст Корана и показывает источники рядом с ответом. Если надёжного основания недостаточно, помощник прямо сообщает об этом и предлагает обратиться к преподавателю — без догадок, выдаваемых за тафсир, и без подмены иджазы автоматической оценкой.", aiRecitationTitle: "Интеллект чтения", aiRecitationText: "Порядок слов, пропуски и остановка для исправления — с настраиваемыми сигналами и строгим режимом.", aiMemoryTitle: "Интеллект памяти", aiMemoryText: "Очередь повторения на основе запинок, ошибок, прочности и времени после последнего воспроизведения.", aiKnowledgeTitle: "Интеллект знания", aiKnowledgeText: "Ответы только из подключённых источников: арабский текст, перевод и авторство рядом.", mapGuidance: "руководство", mapRoot: "Корень", mapTafsir: "Тафсир", mapTafsirText: "Коран посредством Корана", mapAction: "Сегодня", mapActionText: "Одно осмысленное действие", mapListen: "Чтение", mapListenText: "Порядок слов сопоставлен", mapMemory: "Повторение", mapMemoryText: "Вернуться в нужный момент", mapStageRecitation: "Слушаю и сопоставляю аят", mapStageMemory: "Формирую очередь повторения", mapStageKnowledge: "Проверяю связанные источники",
      methodEyebrow: "Метод для прочного сохранения", methodTitle: "Малые отрывки. Глубокое внимание. Возвращение вовремя.", methodLead: "Платформа не должна торопить ученика по страницам. Она должна делать каждое возвращение осмысленнее, а каждый выученный аят — прочнее.", tabMemorize: "Заучивать", tabMemorizeText: "Активное воспроизведение и исправление", tabUnderstand: "Понимать", tabUnderstandText: "Язык и надёжный тафсир", tabLive: "Воплощать", tabLiveText: "Размышление и действие",
      stageBadgeMemorize: "СЕССИЯ ХИФЗА", stageMemorizeTitle: "Сначала вспомнить — потом открыть.", stageMemorizeText: "Слова скрыты. Правильное чтение открывает путь; ошибка удерживает ученика именно там, где требуется исправление.", stageM1: "Настраиваемая строгая проверка", stageM2: "Автопереход к следующему аяту", stageM3: "Интервальная очередь повторения", stageBadgeUnderstand: "КОРАНИЧЕСКИЙ АРАБСКИЙ", stageUnderstandTitle: "Смысл — не покидая аят.", stageUnderstandText: "От слова к корню, от фразы к синтаксису и от перевода к карточке тафсира с ясным авторством.", stageU1: "Пословный смысл и морфология", stageU2: "Арабский тафсир и перевод", stageU3: "Связи между аятами", rootLabel: "КОРЕНЬ", meaningLabel: "ЗНАЧЕНИЕ", bookMeaning: "Писание", sourceMini: "Карточка источника · Адва аль-Баян", stageBadgeLive: "РАЗМЫШЛЕНИЕ", stageLiveTitle: "От понимания — к одному искреннему действию.", stageLiveText: "Личная подсказка помогает назвать, что аят меняет сегодня, а затем возвращает к нему для укрепления памяти и практики.", stageL1: "Личный дневник размышлений", stageL2: "Одно малое направленное действие", stageL3: "Повторение, связанное с жизненным контекстом", actionPrompt: "Что этот аят изменит сегодня в моей речи?", writeReflection: "Записать личное размышление",
      academyEyebrow: "АКАДЕМИЯ АЛЛИМ", academyTitle: "Самостоятельное обучение — для каждого. Живое наставничество — когда оно нужно.", academyLead: "Все цифровые инструменты для самостоятельного обучения в АЛЛИМ должны оставаться бесплатными во всём мире. Академия добавляет человеческое сопровождение: живые занятия, личное исправление, системное обучение и ответственные программы с квалифицированными преподавателями.", academyPrincipleTitle: "Бесплатное обучение — основа", academyPrincipleText: "Оплата может относиться только ко времени преподавателя, программам с проверкой и связанным живым услугам — не к базовому доступу к Корану.", openLabel: "ОТКРЫТЫЙ АЛЛИМ", openTitle: "Учиться самостоятельно. Бесплатно во всём мире.", openText: "Личное пространство для практики чтения, заучивания, коранического арабского, тафсира с источниками, размышления и прогресса.", openItem1: "План хифза и интервальное повторение", openItem2: "Практика чтения и слушание", openItem3: "Язык, смысл и размышление", openItem4: "Личная история обучения", openDigital: "Открыть цифровое обучение", guidedLabel: "АКАДЕМИЯ С ПРЕПОДАВАТЕЛЕМ", guidedTitle: "Учиться вместе с преподавателем.", guidedText: "Индивидуальные или групповые занятия вживую, задания, обратная связь, история прогресса и ясная связь между учеником, преподавателем и программой.", guidedItem1: "Программы Корана и арабского с преподавателем", guidedItem2: "Живое исправление и личная обратная связь", guidedItem3: "Кабинеты ученика, преподавателя и родителя", guidedItem4: "Оценивание и подтверждённая история обучения", joinAcademy: "Оставить заявку в Академию", ijazahTitle: "Иджаза остаётся живым аманатом.", ijazahText: "Платформа никогда не выдаёт иджазу автоматически. Путь может завершаться только с квалифицированным уполномоченным преподавателем после необходимого чтения, обучения и оценки.",
      referralLabel: "ПЛАНИРУЕМОЕ ОДНОУРОВНЕВОЕ ПРИГЛАШЕНИЕ", referralTitle: "Приглашение в Академию и автоматическая скидка 10% — в разработке.", referralText: "Планируем, что в подходящих платных программах Академии пригласивший и новый ученик получат по 10% на один период оплаты после окончательного подтверждения первой оплаты нового ученика. Функция приглашения в Академию и автоматическое начисление пока не подключены. Пригласить друга в АЛЛИМ можно через обычную кнопку «Поделиться АЛЛИМ» ниже. Без денежных выплат, второго уровня, команд и дохода от дальнейших приглашений.", referralAction: "Пригласить в Академию",
      blogEyebrow: "БИБЛИОТЕКА АЛЛИМ", blogTitle: "Материалы, которые превращают вопрос в ясный следующий шаг.", blogLead: "Практические руководства для учеников, семей и преподавателей — с методикой, источниками и честной границей между технологией и квалифицированным наставничеством.", blogMethodLabel: "МЕТОД ЗАУЧИВАНИЯ", blogMethodTitle: "300 принятых повторений: как аят становится частью связной страницы.", blogMethodText: "Подробно о правиле АЛЛИМ, трёх этапах повторения и о том, почему собранную страницу важно прочитать единым потоком.", blogAiLabel: "ТЕХНОЛОГИЯ ЧТЕНИЯ", blogAiTitle: "Как ИИ должен помогать при чтении — и чего он не должен обещать.", blogAiText: "Непрерывное чтение, мгновенная обратная связь, тщательная проверка и граница роли преподавателя.", blogStartLabel: "НАЧАЛО ПУТИ", blogStartTitle: "От алифа до Аль-Фатихи: первый успех без недель ожидания.", blogStartText: "Узнавать, произносить, соединять и вспоминать буквы внутри осмысленных коранических фрагментов.", blogRead: "Читать материал", blogAll: "Открыть все материалы",
      trustEyebrow: "Сначала доверие — потом масштаб", trustTitle: "Технология должна служить передаче Корана, а не размывать его источники.", verifiedTextTitle: "Сначала проверенный текст", verifiedTextText: "Текст Корана и учебные материалы связаны с определяемыми источниками и проверенными корпусами.", traceTitle: "Видимое авторство", traceText: "Арабский источник, перевод и авторство остаются на экране. Если карточка не проверена, АЛЛИМ прямо сообщает об этом.", privacyTitle: "Приватность с выбором", privacyText: "Прогресс по умолчанию остаётся личным, а обработка голоса и синхронизация имеют ясные настройки.", teacherTitle: "Преподаватель остаётся центральным", teacherText: "АЛЛИМ поддерживает практику между занятиями, но не заменяет квалифицированного преподавателя, живое исправление или иджазу.",
      shareEyebrow: "ПОДЕЛИТЬСЯ ПОЛЬЗОЙ", shareTitle: "Полезный путь становится сильнее, когда достигает того, кому он нужен.", shareText: "Пригласите друга или близкого человека учиться читать и понимать Коран вместе с АЛЛИМ.", shareFaith: "Мы надеемся на награду от Аллаха за указание на полезное. АЛЛИМ не обещает и не подсчитывает награду в вечной жизни.", shareAction: "Поделиться АЛЛИМ", shareOpenTitle: "Делиться можно свободно", shareOpenText: "Для приглашения другого ученика не нужны покупка, взнос или платное участие.", shareLevelTitle: "Одно приглашение. Один уровень.", shareLevelText: "Планируемая скидка Академии будет связана только с реальной оплатой нового ученика — не с цепочкой последующих приглашений.", shareMessage: "АЛЛИМ — пространство для чтения, заучивания и понимания Корана.", shareCopied: "Ссылка скопирована", shareComplete: "Приглашение готово к отправке", shareFailed: "Не удалось открыть меню. Скопируйте ссылку вручную.", footerShare: "Поделиться пользой",
      earlyEyebrow: "Выберите свой формат", earlyTitle: "Один путь обучения. Выберите, как начать.", earlyText: "Начните с самостоятельного обучения в АЛЛИМ или выберите Академию АЛЛИМ, когда нужна прямая помощь преподавателя. Оба формата связаны: ежедневная практика и обучение с преподавателем укрепляют единый прогресс.", exploreAcademy: "Посмотреть модель Академии", footerProduct: "Продукт", footerPrinciples: "Принципы", developmentStatus: "Продукт активно разрабатывается", footerDisclaimer: "ИИ-проверка чтения — учебный инструмент, который нельзя представлять заменой квалифицированного преподавателя Корана.", footerMission: "Заучивать · Понимать · Воплощать",
      languageLabel: "Язык", languagePrimary: "Основные языки", languageMore: "Другие языки"
    },
    tr: {
      languageLabel: "Dil", languagePrimary: "Ana diller", languageMore: "Diğer diller",
      navJourney: "Yolculuk", navIntelligence: "Kur’an zekâsı", navMethod: "Yöntem", navAcademy: "Akademi", navGuides: "Rehberler", navTrust: "Güven", openPrototype: "Öğrenmeye başla", joinJourney: "Yolculuğa katıl", studentCabinetAction: "Öğrenci paneli", openStudentCabinet: "Öğrenci panelini aç", openGuidedCabinet: "Öğretmenli öğrenme panelini aç",
      previewLabel: "Erken ürün ön izlemesi · Kur’an yapay zekâsı geliştiriliyor", heroEyebrow: "Ezberle · Anla · Yaşa", heroTitle: "Kur’an ezberinizde, anlayışınızda ve hayatınızda yer etsin.", heroLead: "ALLIM; tilavetten manaya, manadan günlük amele uzanan tek bir rehberli yolculuk olarak geliştiriliyor. Hıfz, Kur’an Arapçası, kaynağa bağlı tefsir ve tedebbür için odaklı bir yol arkadaşı.", exploreJourney: "Yolculuğu keşfet", seePrototype: "Öğrenme alanını aç", principlePrivate: "Tasarımdan itibaren gizlilik", principleSources: "İzlenebilir kaynaklar", principleTeacher: "Öğretmeni desteklemek için",
      demoMode: "EZBER", demoSurah: "Bakara", demoCorrection: "Durun. Bu kelimeyi düzeltin.", demoCorrectionText: "Kelime düzeltilene kadar sonraki ayet kilitli kalır.", reviewDue: "Tekrar zamanı", reviewDueText: "3 ayet · yatsıdan önce", meaningReady: "Mana bağlandı", meaningReadyText: "Kelime · kök · tefsir",
      duaTranslation: "Allah’ım, ona Kitab’ı öğret.", duaSource: "Peygamberimizin ﷺ İbn Abbas رضي الله عنهما için duası · Sahih-i Buhari 75", filmEyebrow: "Bütün yolculuğu görün", filmTitle: "ALLIM bir ayeti nasıl bütünlüklü bir öğrenme yoluna dönüştürür?", filmLead: "Kelime kelime okuma, kesintisiz takip, 300 tekrar, mushaf, tefsir ve Akademi boyunca rehberli bir tanıtım.", filmBadge: "Tam sunum · İngilizce anlatım", filmFallback: "Tarayıcınız bu videoyu oynatamıyor.",
      journeyEyebrow: "Bir ayet. Bütün bir yolculuk.", journeyTitle: "Bir hatayı bulmaktan fazlası. Bir sayfayı göstermekten fazlası.", journeyLead: "ALLIM’in amacı, çoğu zaman farklı uygulamalara dağılan alanları bir araya getirmektir: dinleme, tilavet, hıfz, dil, tefsir, tedebbür ve tekrar.", listenTitle: "Dikkatle dinleyin", listenText: "Güvenilir bir tilaveti takip edin, seçilen bölümü tekrarlayın ve ezberden okumadan önce ritmini kavrayın.", reciteTitle: "Okuyun ve düzeltin", reciteText: "Planlanan Kur’an konuşma motoru kelime kelime takip eder, hatada durur ve ancak düzeltmeden sonra devam eder.", understandTitle: "Ayeti anlayın", understandText: "Okuma akışını kaybetmeden kelimeleri, kökleri, yapıyı, meali ve kaynağa bağlı tefsiri görün.", liveTitle: "Hayata taşıyın", liveText: "Manayı kişisel bir tedebbüre, küçük bir amele ve doğru zamanda dönen bir tekrara dönüştürün.",
      heartFeatureEyebrow: "YENİ · KALPTEKİ KUR’AN", heartFeatureTitle: "Kur’an’ı kalbinizde, bağlantılı tam sayfalar hâlinde inşa edin.", heartFeatureLead: "Kabul edilen her okuyuş bir ayeti güçlendirir. Sayfadaki bütün ayetler tamamlandığında ALLIM, ezberin parçalı değil bağlantılı olması için sayfayı kesintisiz okumanızı ister.", heartStepOneTitle: "Görünür sayaçla tekrarlayın", heartStepOneText: "Kabul edilen her tekrarı ve 300’e giden tam yolu görün.", heartStepTwoTitle: "Her ayeti toplayın", heartStepTwoText: "Tam sayfa görünümü neyin sağlamlaştığını ve neyin çalışılması gerektiğini gösterir.", heartStepThreeTitle: "Bütün sayfayı bağlayın", heartStepThreeText: "%100’e ulaştığınızda ilk ayetten son ayete kadar akışı bozmadan okuyun.", heartStepFourTitle: "İnşa ettiğinizi mühürleyin", heartStepFourText: "Bağlantılı sayfa bu cihazda korunur ve kaçırılan bir hafta yüzünden kaybolmaz.", heartFeatureAction: "Sayfa oluşturucuyu aç", heartPageLabel: "MUSHAF SAYFASI", heartAyatCollected: "ayet tamamlandı", heartGateTitle: "Sayfayı bağlantılı okuma", heartGateText: "Yedi ayetin tamamı 300 / 300 olduğunda açılır", heartSealNote: "Bir başarılı bağlantılı okuyuşun ardından sayfa kalıcı olur.", heartFilmEyebrow: "YÖNTEMİ İŞ BAŞINDA GÖRÜN", heartFilmTitle: "300 okuyuşun hafızaya, sınamaya ve tek bir davranışa nasıl dönüştüğünü izleyin.", heartFilmLead: "Canlı sayaç, sayfayı ezberden kontrol, bağlantılı okuyuş ve Hayatta Ayet günlüğünün kısa anlatımı.", heartFilmBadge: "Tematik video · Türkçe anlatım", heartFilmFallback: "Tarayıcınız bu videoyu oynatamıyor.",
      intelligenceEyebrow: "Sınırları olan Kur’an zekâsı", intelligenceTitle: "Ne zaman dinleyeceğini ve ne zaman tahmin etmeyeceğini bilen bir yardımcı.", intelligenceLead: "ALLIM; doğrulanmış Kur’an metni, açık kaynak atfı ve belirsizliği dürüstçe ifade etme üzerine tasarlanır. Öğrenciyi güvenilir bilgiye yönlendirir; tahmini tefsir, makine puanını da öğretmen icazeti gibi sunmaz.", aiRecitationTitle: "Tilavet zekâsı", aiRecitationText: "Kelime sırası, atlamalar ve düzeltme kapıları; ayarlanabilir ses işaretleri ve sıkı modla birlikte.", aiMemoryTitle: "Hafıza zekâsı", aiMemoryText: "Tereddüt, hata, sağlamlık ve son hatırlamadan geçen süreye göre şekillenen tekrar kuyruğu.", aiKnowledgeTitle: "Bilgi zekâsı", aiKnowledgeText: "Yalnızca bağlı kaynaklardan gelen cevaplar; Arapça metin, tercüme ve atıf birlikte gösterilir.", mapGuidance: "hidayet", mapRoot: "Kök", mapTafsir: "Tefsir", mapTafsirText: "Kur’an’ın Kur’an’la tefsiri", mapAction: "Bugün", mapActionText: "Anlamlı tek bir amel", mapListen: "Tilavet", mapListenText: "Kelime sırası eşleşti", mapMemory: "Tekrar", mapMemoryText: "Doğru zamanda geri dön", mapStageRecitation: "Ayeti dinliyor ve eşleştiriyor", mapStageMemory: "Tekrar sırasını oluşturuyor", mapStageKnowledge: "Bağlı kaynakları kontrol ediyor",
      methodEyebrow: "Kalıcı hıfz için yöntem", methodTitle: "Küçük bölümler. Derin dikkat. Doğru zamanda dönüş.", methodLead: "Platform öğrenciyi sayfalar arasında acele ettirmek için değil, her dönüşü daha anlamlı ve her ezberi daha sağlam kılmak için tasarlanır.", tabMemorize: "Ezberle", tabMemorizeText: "Aktif hatırlama ve düzeltme", tabUnderstand: "Anla", tabUnderstandText: "Dil ve güvenilir tefsir", tabLive: "Yaşa", tabLiveText: "Tedebbür ve amel",
      stageBadgeMemorize: "HIFZ OTURUMU", stageMemorizeTitle: "Önce hatırlayın, sonra açın.", stageMemorizeText: "Kelimeler gizli kalır. Doğru okuyuş yolu açar; hata ise öğrenciyi tam düzeltilmesi gereken yerde tutar.", stageM1: "Ayarlanabilir sıkı kontrol", stageM2: "Sonraki ayete otomatik geçiş", stageM3: "Aralıklı tekrar kuyruğu", stageBadgeUnderstand: "KUR’AN ARAPÇASI", stageUnderstandTitle: "Ayetten ayrılmadan mana.", stageUnderstandText: "Kelimeden köke, ifadeden yapıya, mealden açıkça kaynaklandırılmış bir tefsir kartına ilerleyin.", stageU1: "Kelime kelime mana ve sarf", stageU2: "Arapça tefsir ve tercüme", stageU3: "Ayetler arası bağlar", rootLabel: "KÖK", meaningLabel: "MANA", bookMeaning: "Kitap", sourceMini: "Kaynak kartı · Edvâü’l-Beyân", stageBadgeLive: "TEDEBBÜR", stageLiveTitle: "Anlayıştan samimi bir amele.", stageLiveText: "Özel bir soru, öğrencinin ayetin bugün neyi değiştirdiğini belirlemesine yardım eder; sonra hafızayı ve ameli güçlendirmek için onu ayete geri getirir.", stageL1: "Özel tedebbür günlüğü", stageL2: "Yönlendirilmiş küçük bir amel", stageL3: "Hayat bağlamına bağlı tekrar", actionPrompt: "Bu ayet bugün konuşmamda neyi değiştirecek?", writeReflection: "Özel bir tedebbür yaz",
      academyEyebrow: "ALLIM KUR’AN AKADEMİSİ", academyTitle: "Herkese açık bilgi, nitelikli öğretmenlerden canlı rehberlik.", academyLead: "ALLIM’deki bütün bireysel dijital öğrenme araçlarının dünya çapında ücretsiz kalmasını hedefliyoruz. Akademi insan boyutunu ekler: canlı dersler, kişisel düzeltme, düzenli eğitim ve nitelikli öğretmenlerle sorumlu programlar.", academyPrincipleTitle: "Ücretsiz öğrenme esastır", academyPrincipleText: "Ücret yalnızca öğretmenin zamanı, değerlendirilen programlar ve bunlarla bağlantılı canlı hizmetler için olabilir; Kur’an’a temel erişim için değil.", openLabel: "AÇIK ALLIM", openTitle: "Kendi başınıza öğrenin. Dünyanın her yerinde ücretsiz.", openText: "Tilavet, hıfz, Kur’an Arapçası, kaynağa bağlı tefsir, tedebbür ve ilerleme takibi için kişisel alan.", openItem1: "Hıfz planı ve aralıklı tekrar", openItem2: "Tilavet ve dinleme çalışması", openItem3: "Dil, mana ve tedebbür", openItem4: "Özel öğrenme geçmişi", openDigital: "Dijital öğrenmeyi aç", guidedLabel: "ÖĞRETMENLİ AKADEMİ", guidedTitle: "Bir öğretmenle öğrenin.", guidedText: "Ödevler, geri bildirim, ilerleme geçmişi ve öğrenci, öğretmen ve program arasında açık bir bağ içeren canlı bireysel veya grup eğitimi.", guidedItem1: "Öğretmen eşliğinde Kur’an ve Arapça programları", guidedItem2: "Canlı düzeltme ve kişisel geri bildirim", guidedItem3: "Öğrenci, öğretmen ve veli panelleri", guidedItem4: "Değerlendirme ve doğrulanmış öğrenme geçmişi", joinAcademy: "Akademi için ilgi bildir", ijazahTitle: "İcazet canlı bir emanettir.", ijazahText: "Platform hiçbir zaman otomatik icazet vermez. Yol ancak gerekli okuyuş, eğitim ve değerlendirmeden sonra nitelikli ve yetkili bir öğretmenle tamamlanabilir.",
      referralLabel: "PLANLANAN TEK KADEMELİ AKADEMİ DAVETİ", referralTitle: "Akademi daveti ve otomatik %10 indirim geliştirme aşamasında.", referralText: "Planımız, uygun ücretli Akademi programlarında davet eden kişinin ve yeni öğrencinin, yeni öğrencinin ilk ödemesi kesinleştikten sonra bir ödeme dönemi için ayrı ayrı %10 indirim almasıdır. Akademi daveti ve otomatik indirim henüz etkin değildir. Şimdilik aşağıdaki genel «ALLIM’i paylaş» düğmesiyle bir arkadaşınızı davet edebilirsiniz. Nakit ödeme, ikinci kademe, ekip veya sonraki davetlerden kazanç yoktur.", referralAction: "Akademiye davet et",
      trustEyebrow: "Önce güven, sonra ölçek", trustTitle: "Teknoloji Kur’an’ın aktarımına hizmet etmeli, kaynaklarını belirsizleştirmemelidir.", verifiedTextTitle: "Önce doğrulanmış metin", verifiedTextText: "Kur’an metni ve öğrenme materyalleri belirlenebilir kaynaklara ve gözden geçirilmiş külliyatlara bağlanır.", traceTitle: "Görünür atıf", traceText: "Arapça kaynak, tercüme ve müellif ekranda kalır. Bir kart doğrulanmadıysa ALLIM bunu açıkça söyler.", privacyTitle: "Seçimli gizlilik", privacyText: "İlerleme varsayılan olarak özel kalır; ses işleme ve eşitleme için açık ayarlar sunulur.", teacherTitle: "Öğretmen merkezde kalır", teacherText: "ALLIM dersler arasındaki çalışmayı destekler; nitelikli öğretmenin, canlı düzeltmenin veya icazetin yerini almaz.",
      shareEyebrow: "FAYDAYI PAYLAŞ", shareTitle: "Faydalı bir yol, ona ihtiyaç duyan kişiye ulaştığında güçlenir.", shareText: "Bir arkadaşınızı veya yakınınızı ALLIM ile Kur’an okumaya, öğrenmeye ve anlamaya davet edin.", shareFaith: "Başkalarını faydalı olana yönlendirmek için Allah’tan ecir umarız. ALLIM ahiret ecri vaat etmez ve onu saymaz.", shareAction: "ALLIM’i paylaş", shareOpenTitle: "Paylaşmak herkese açık", shareOpenText: "ALLIM’i başka bir öğrenciyle paylaşmak için satın alma, ücret veya ücretli üyelik gerekmez.", shareLevelTitle: "Bir davet. Bir kademe.", shareLevelText: "Planlanan Akademi indirimi yalnızca yeni öğrencinin gerçek ücretli kaydına bağlı olacaktır; sonraki davetlerden oluşan bir zincire değil.", shareMessage: "ALLIM, Kur’an okumak, ezberlemek ve anlamak için bir öğrenme alanıdır.", shareCopied: "Bağlantı kopyalandı", shareComplete: "Davet gönderilmeye hazır", shareFailed: "Paylaşım menüsü açılamadı. Bağlantıyı elle kopyalayın.", footerShare: "Faydayı paylaş",
      earlyEyebrow: "Nasıl başlayacağınızı seçin", earlyTitle: "Tek bir öğrenme yolculuğu. Başlangıç biçiminizi siz seçin.", earlyText: "ALLIM’de bağımsız çalışarak başlayın; bir öğretmenin doğrudan rehberliğine ihtiyaç duyduğunuzda ALLIM QUR’AN ACADEMY’yi seçin. İki yol birbiriyle bağlantılıdır: günlük pratik ve öğretmen eşliğinde öğrenme aynı ilerlemeyi güçlendirir.", exploreAcademy: "Akademi modelini incele", footerProduct: "Ürün", footerPrinciples: "İlkeler", developmentStatus: "Ürün aktif olarak geliştiriliyor", footerDisclaimer: "Yapay zekâ destekli tilavet geri bildirimi bir öğrenme aracıdır; nitelikli bir Kur’an öğretmeninin yerine geçmez.", footerMission: "Ezberle · Anla · Yaşa"
    },
    ar: {
      navJourney: "الرحلة", navIntelligence: "الذكاء القرآني", navMethod: "المنهج", navAcademy: "الأكاديمية", navGuides: "الأدلة", navTrust: "الثقة", openPrototype: "ابدأ التعلّم", joinJourney: "انضم إلى الرحلة", studentCabinetAction: "لوحة الطالب", openStudentCabinet: "افتح لوحة الطالب", openGuidedCabinet: "افتح لوحة التعلم مع المعلّم",
      previewLabel: "معاينة مبكرة · الذكاء القرآني قيد التطوير", heroEyebrow: "احفظ · افهم · اعمل", heroTitle: "ليكن القرآن ما تحفظه وتفهمه وتعيش به.", heroLead: "يُبنى ALLIM ليكون رحلة واحدة من التلاوة إلى المعنى، ومن المعنى إلى العمل اليومي؛ رفيقًا مركزًا للحفظ والعربية القرآنية والتفسير الموثق والتدبر.", exploreJourney: "اكتشف الرحلة", seePrototype: "انتقل إلى التعلّم", principlePrivate: "الخصوصية أصل", principleSources: "مصادر قابلة للتحقق", principleTeacher: "في خدمة المعلّم",
      demoMode: "الحفظ", demoSurah: "البقرة", demoCorrection: "توقّف. صحّح الكلمة.", demoCorrectionText: "تبقى الآية التالية مغلقة حتى تصحيح الكلمة.", reviewDue: "حان وقت المراجعة", reviewDueText: "٣ آيات · قبل العشاء", meaningReady: "اكتمل ربط المعنى", meaningReadyText: "كلمة · جذر · تفسير",
      duaTranslation: "اللهم علّمه الكتاب.", duaSource: "دعاء النبي ﷺ لابن عباس رضي الله عنهما · صحيح البخاري ٧٥", filmEyebrow: "شاهد الرحلة كاملة", filmTitle: "كيف يحوّل ALLIM آيةً واحدة إلى مسار تعلّم متكامل.", filmLead: "جولة موجزة: تلاوة كلمةً كلمة، ومتابعة مستمرة، و٣٠٠ تكرار، ومصحف المدينة، والتفسير، والأكاديمية.", filmBadge: "عرض كامل · تعليق صوتي بالعربية", filmFallback: "لا يستطيع متصفحك تشغيل هذا الفيديو.",
      journeyEyebrow: "آية واحدة. رحلة متكاملة.", journeyTitle: "أكثر من اكتشاف الخطأ. وأكثر من عرض الصفحة.", journeyLead: "غاية ALLIM جمع ما يتفرق عادةً بين تطبيقات متعددة: الاستماع والتلاوة والحفظ واللغة والتفسير والتدبر والمراجعة.", listenTitle: "استمع بانتباه", listenText: "تابع تلاوة موثوقة، وكرّر المقطع المختار، واستوعب إيقاعه قبل الاستظهار.", reciteTitle: "اتلُ وصحّح", reciteText: "يتابع محرك التعرّف القرآني المخطط له كلمةً كلمة، ويتوقف عند الخطأ ولا يستأنف إلا بعد التصحيح.", understandTitle: "افهم الآية", understandText: "شاهد المفردات والجذور والتركيب والترجمة والتفسير الموثق دون مغادرة سياق التلاوة.", liveTitle: "اعمل بالآية", liveText: "حوّل المعنى إلى تدبر شخصي وعمل صغير ومراجعة تعود في الوقت المناسب.",
      heartFeatureEyebrow: "جديد · القرآن في القلب", heartFeatureTitle: "اجمع القرآن في قلبك، صفحةً مترابطة بعد صفحة.", heartFeatureLead: "تُثبّت كل تلاوة مقبولة آيةً في الحفظ. وعندما تكتمل آيات الصفحة كلها، يدعوك ALLIM إلى تلاوتها متصلة حتى يصبح الحفظ مترابطًا لا مجزّأً.", heartStepOneTitle: "كرّر مع عدّاد واضح", heartStepOneText: "شاهد كل تكرار مقبول والطريق الدقيق إلى ٣٠٠.", heartStepTwoTitle: "اجمع كل آية", heartStepTwoText: "تعرض الصفحة الكاملة ما ثبت وما لا يزال يحتاج إلى عمل.", heartStepThreeTitle: "اربط الصفحة كلها", heartStepThreeText: "عند اكتمالها، اقرأ من أول آية إلى آخر آية دون قطع السياق.", heartStepFourTitle: "ثبّت ما بنيت", heartStepFourText: "تبقى الصفحة المترابطة محفوظة على هذا الجهاز ولا تزول بسبب فوات أسبوع.", heartFeatureAction: "افتح بناء الصفحة", heartPageLabel: "صفحة المصحف", heartAyatCollected: "آيات مكتملة", heartGateTitle: "تلاوة الصفحة متصلة", heartGateText: "تُفتح عندما تبلغ الآيات السبع ٣٠٠ / ٣٠٠", heartSealNote: "بعد تلاوة مترابطة ناجحة واحدة تصبح الصفحة دائمة.", heartFilmEyebrow: "شاهد المنهج عمليًا", heartFilmTitle: "شاهد كيف تتحول ٣٠٠ قراءة إلى حفظ واختبار وعمل واحد.", heartFilmLead: "شرح مركز للعداد المباشر، واختبار الصفحة، والتلاوة المتصلة، ودفتر آية في الحياة.", heartFilmBadge: "فيلم تعريفي · تعليق صوتي بالعربية", heartFilmFallback: "لا يستطيع متصفحك تشغيل هذا الفيديو.",
      intelligenceEyebrow: "ذكاء قرآني منضبط", intelligenceTitle: "رفيق ذكي يعرف متى يستمع — ومتى لا يخمّن.", intelligenceLead: "يُصمَّم ALLIM على النص القرآني الموثق، ونسبة العلم إلى مصادره، والتصريح الصادق بحدود المعرفة. يساعد المتعلم على الوصول إلى العلم الموثوق، ولا يعرض التخمين تفسيرًا ولا التقييم الآلي إجازةً من معلّم.", aiRecitationTitle: "ذكاء التلاوة", aiRecitationText: "ترتيب الكلمات والسقط وبوابات التصحيح، مع إشارات صوتية ووضع صارم قابلين للضبط.", aiMemoryTitle: "ذكاء الحفظ", aiMemoryText: "جدول مراجعة يتكيّف مع التردد والأخطاء وقوة الحفظ والمدة منذ آخر استظهار.", aiKnowledgeTitle: "ذكاء المعرفة", aiKnowledgeText: "إجابات مقيدة بالمصادر المرتبطة، مع إظهار النص العربي والترجمة والنسبة معًا.", mapGuidance: "هداية", mapRoot: "الجذر", mapTafsir: "التفسير", mapTafsirText: "تفسير القرآن بالقرآن", mapAction: "اليوم", mapActionText: "عمل واحد موجّه", mapListen: "التلاوة", mapListenText: "طوبق ترتيب الكلمات", mapMemory: "المراجعة", mapMemoryText: "عودة في الوقت المناسب", mapStageRecitation: "الاستماع إلى الآية ومطابقتها", mapStageMemory: "بناء جدول المراجعة", mapStageKnowledge: "التحقق من المصادر المرتبطة",
      methodEyebrow: "منهج يثبّت الحفظ", methodTitle: "مقاطع صغيرة. انتباه عميق. عودة في وقتها.", methodLead: "لا تُصمّم المنصة لدفع المتعلم سريعًا بين الصفحات، بل لتجعل كل عودة أعمق وكل آية محفوظة أثبت.", tabMemorize: "احفظ", tabMemorizeText: "استرجاع نشط وتصحيح", tabUnderstand: "افهم", tabUnderstandText: "لغة وتفسير موثوق", tabLive: "اعمل", tabLiveText: "تدبر وتطبيق",
      stageBadgeMemorize: "جلسة حفظ", stageMemorizeTitle: "استحضر أولًا، ثم اكشف.", stageMemorizeText: "تبقى الكلمات مخفية. تفتح التلاوة الصحيحة الطريق، ويثبت الخطأ موضع الإصلاح تحديدًا.", stageM1: "تصحيح صارم قابل للضبط", stageM2: "انتقال تلقائي إلى الآية التالية", stageM3: "مراجعة متباعدة", stageBadgeUnderstand: "العربية القرآنية", stageUnderstandTitle: "المعنى دون مغادرة الآية.", stageUnderstandText: "من الكلمة إلى الجذر، ومن العبارة إلى التركيب، ومن الترجمة إلى بطاقة تفسير واضحة النسبة.", stageU1: "معنى كلمةً كلمة وصرف", stageU2: "تفسير عربي مع ترجمة", stageU3: "روابط بين الآيات", rootLabel: "الجذر", meaningLabel: "المعنى", bookMeaning: "الكتاب", sourceMini: "بطاقة المصدر · أضواء البيان", stageBadgeLive: "التدبر", stageLiveTitle: "من الفهم إلى عمل صادق.", stageLiveText: "يساعد سؤال خاص المتعلم على تحديد ما تغيّره الآية اليوم، ثم يعيده إليها لتثبيت الحفظ والعمل.", stageL1: "دفتر تدبر خاص", stageL2: "عمل صغير موجّه", stageL3: "مراجعة مرتبطة بسياق الحياة", actionPrompt: "ما الذي ستغيّره هذه الآية في كلامي اليوم؟", writeReflection: "اكتب تدبرًا خاصًا",
      academyEyebrow: "أكاديمية ALLIM للقرآن", academyTitle: "معرفة مفتوحة للجميع، وتوجيه حي على أيدي معلّمين مؤهلين.", academyLead: "نعتزم أن تبقى جميع أدوات التعلم الذاتي الرقمية في ALLIM مجانية للعالم كله. وتضيف الأكاديمية البعد الإنساني: دروسًا مباشرة وتصحيحًا شخصيًا ودراسة منظمة ومسارات منضبطة مع معلّمين مؤهلين.", academyPrincipleTitle: "التعلم المجاني هو الأصل", academyPrincipleText: "قد تكون الأجرة مقابل وقت المعلّم والبرامج المقوّمة والخدمات المباشرة المرتبطة بها، لا مقابل الوصول الأساسي إلى القرآن.", openLabel: "ALLIM المفتوح", openTitle: "تعلّم بنفسك، مجانًا في كل العالم.", openText: "مساحة شخصية للتدرّب على التلاوة والحفظ والعربية القرآنية والتفسير الموثق والتدبر ومتابعة التقدم.", openItem1: "خطة حفظ ومراجعة متباعدة", openItem2: "تدريب على التلاوة والاستماع", openItem3: "لغة ومعنى وتدبر", openItem4: "سجل تعلم خاص", openDigital: "افتح التعلم الرقمي", guidedLabel: "الأكاديمية الموجّهة", guidedTitle: "تعلّم مع معلّم.", guidedText: "تعلم فردي أو جماعي مباشر، مع واجبات وتغذية راجعة وسجل تقدم وعلاقة واضحة بين المتعلم والمعلّم والمنهج.", guidedItem1: "برامج القرآن والعربية بقيادة معلّم", guidedItem2: "تصحيح مباشر وملاحظات شخصية", guidedItem3: "لوحات للمتعلم والمعلّم وولي الأمر", guidedItem4: "تقييم وسجل دراسة موثق", joinAcademy: "سجّل اهتمامك بالأكاديمية", ijazahTitle: "الإجازة أمانة بشرية.", ijazahText: "لا تمنح المنصة الإجازة آليًا أبدًا. ولا يكتمل المسار إلا مع معلّم مؤهل مأذون له وبعد القراءة والدراسة والتقييم المطلوب.",
      referralLabel: "إحالة أكاديمية مباشرة مخطط لها", referralTitle: "دعوة الأكاديمية والخصم التلقائي بنسبة ١٠٪ قيد التطوير.", referralText: "نخطط لأن يحصل الداعي والمتعلم الجديد في برامج الأكاديمية المدفوعة المؤهلة على خصم ١٠٪ لكل منهما لفترة دفع واحدة بعد تأكيد الدفعة الأولى للمتعلم الجديد نهائيًا. لم تُفعّل دعوة الأكاديمية ولا آلية احتساب الخصم تلقائيًا بعد. ويمكن الآن دعوة صديق إلى ALLIM عبر زر «شارك ALLIM» أدناه. لا مبالغ نقدية، ولا مستويات لاحقة، ولا فرق، ولا أرباح من دعوات الآخرين.", referralAction: "ادعُ إلى الأكاديمية",
      blogEyebrow: "مكتبة ALLIM التعليمية", blogTitle: "أدلة تحوّل السؤال إلى خطوة تالية واضحة.", blogLead: "مواد عملية للمتعلمين والأسر والمعلّمين، تعرض المنهج والمصادر وتبيّن بصدق الحد الفاصل بين التقنية والتوجيه المؤهل.", blogMethodLabel: "منهج الحفظ", blogMethodTitle: "٣٠٠ تكرار مقبول: كيف تصبح الآية جزءًا من صفحة مترابطة.", blogMethodText: "شرح قاعدة ALLIM ومراحل التكرار الثلاث، ولماذا تُقرأ الصفحة كاملة في تدفق واحد بعد جمع آياتها.", blogAiLabel: "تقنية التلاوة", blogAiTitle: "كيف يساعد الذكاء في التلاوة، وما الذي لا يجوز أن يدّعيه.", blogAiText: "تلاوة مستمرة، واستجابة فورية، وفحص أدق، وحدود واضحة لدور المعلّم.", blogStartLabel: "بداية الطريق", blogStartTitle: "من الألف إلى الفاتحة: نجاح أول من غير انتظار طويل.", blogStartText: "تعرّف الحروف ونطقها ووصلها واستحضارها داخل مقاطع قرآنية ذات معنى.", blogRead: "اقرأ الدليل", blogAll: "افتح جميع الأدلة",
      trustEyebrow: "الثقة قبل التوسع", trustTitle: "ينبغي للتقنية أن تخدم نقل القرآن، لا أن تطمس مصادره.", verifiedTextTitle: "النص الموثق أولًا", verifiedTextText: "يرتبط النص القرآني والمواد التعليمية بمصادر معروفة ومتون مراجعة.", traceTitle: "نسبة ظاهرة", traceText: "يبقى المصدر العربي والترجمة والمؤلف ظاهرين، وإذا لم تُراجع البطاقة صرّح ALLIM بذلك.", privacyTitle: "خصوصية مع الاختيار", privacyText: "يبقى التقدم خاصًا افتراضيًا، مع ضوابط واضحة لمعالجة الصوت والمزامنة.", teacherTitle: "المعلّم في المركز", teacherText: "يدعم ALLIM التدريب بين الدروس، ولا يستبدل المعلّم المؤهل أو التصحيح الحي أو الإجازة.",
      shareEyebrow: "انشر المنفعة", shareTitle: "يزداد أثر الطريق النافع حين يصل إلى من يحتاج إليه.", shareText: "ادعُ صديقًا أو قريبًا إلى تعلّم القرآن وقراءته وفهمه مع ALLIM.", shareFaith: "نرجو الأجر من الله على الدلالة على ما ينفع. ولا يَعِد ALLIM بأجر أخروي ولا يحسبه.", shareAction: "شارك ALLIM", shareOpenTitle: "المشاركة متاحة للجميع", shareOpenText: "لا يلزم شراء أو رسم أو عضوية مدفوعة لمشاركة ALLIM مع متعلم آخر.", shareLevelTitle: "دعوة واحدة. مستوى واحد.", shareLevelText: "سيبقى خصم الأكاديمية المخطط له مرتبطًا فقط باشتراك مدفوع حقيقي للمتعلم الجديد، لا بسلسلة من الدعوات اللاحقة.", shareMessage: "ALLIM مساحة لتعلّم القرآن وقراءته وحفظه وفهمه.", shareCopied: "تم نسخ الرابط", shareComplete: "الدعوة جاهزة للإرسال", shareFailed: "تعذر فتح قائمة المشاركة. انسخ الرابط يدويًا.", footerShare: "انشر المنفعة",
      earlyEyebrow: "اختر طريقة البداية", earlyTitle: "مسار تعلّم واحد، وطريقتان واضحتان للتقدّم.", earlyText: "ابدأ بالتعلّم الذاتي في ALLIM، أو اختر ALLIM QUR’AN ACADEMY حين تحتاج إلى توجيه مباشر من معلّم. المساران متكاملان: الممارسة اليومية والتعلّم مع المعلّم يدعمان تقدّمًا واحدًا مترابطًا.", exploreAcademy: "اكتشف نموذج الأكاديمية", footerProduct: "المنتج", footerPrinciples: "المبادئ", developmentStatus: "المنتج قيد التطوير", footerDisclaimer: "التغذية الراجعة الآلية على التلاوة أداة تعليمية وليست بديلًا عن معلّم قرآن مؤهل.", footerMission: "احفظ · افهم · اعمل",
      languageLabel: "اللغة", languagePrimary: "اللغات الأساسية", languageMore: "لغات أخرى"
    }
  };

  var extraCopies = window.ALLIM_EXTRA_COPIES || {};
  Object.keys(extraCopies).forEach(function (language) {
    copies[language] = extraCopies[language];
  });

  var supportedLanguages = ["ar", "en", "ru", "tr", "tg", "uz", "tt", "bs", "fr", "zh", "ja", "es", "de", "ms", "id", "ur", "hi", "pt", "sw"];
  var languagePreferenceKey = "allim-language-preference-v1";
  var selectedLanguageMode = "detected";

  function normalizeSupportedLanguage(value) {
    var code = String(value || "").toLowerCase().split(/[-_]/)[0];
    if (supportedLanguages.indexOf(code) >= 0) return code;
    if (["uk", "be", "kk", "ky"].indexOf(code) >= 0) return "ru";
    if (["hr", "sr", "me"].indexOf(code) >= 0) return "bs";
    if (["fa", "ps"].indexOf(code) >= 0) return "ar";
    return "";
  }

  function languageFromTimeZone() {
    var zone = "";
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (error) {
      zone = "";
    }
    if (/^(Asia\/(Riyadh|Dubai|Kuwait|Qatar|Bahrain|Baghdad|Amman|Beirut|Damascus|Aden|Muscat)|Africa\/(Cairo|Tripoli|Khartoum|Tunis|Algiers|Casablanca))$/.test(zone)) return "ar";
    if (/^(Europe\/(Moscow|Kaliningrad|Samara|Volgograd|Kirov|Saratov|Ulyanovsk|Astrakhan)|Asia\/(Yekaterinburg|Omsk|Novosibirsk|Barnaul|Tomsk|Novokuznetsk|Krasnoyarsk|Irkutsk|Chita|Yakutsk|Vladivostok|Magadan|Sakhalin|Kamchatka|Anadyr))$/.test(zone)) return "ru";
    if (zone === "Europe/Istanbul") return "tr";
    if (zone === "Asia/Dushanbe") return "tg";
    if (/^Asia\/(Tashkent|Samarkand)$/.test(zone)) return "uz";
    if (/^Europe\/(Sarajevo|Belgrade|Podgorica|Zagreb)$/.test(zone)) return "bs";
    if (/^Europe\/(Paris|Monaco|Brussels)$/.test(zone)) return "fr";
    if (/^Asia\/(Shanghai|Chongqing|Urumqi|Hong_Kong|Macau)$/.test(zone)) return "zh";
    if (zone === "Asia/Tokyo") return "ja";
    if (/^Europe\/(Madrid|Andorra)$/.test(zone)) return "es";
    if (/^Europe\/(Berlin|Vienna|Zurich)$/.test(zone)) return "de";
    if (/^Asia\/(Kuala_Lumpur|Kuching)$/.test(zone)) return "ms";
    if (/^Asia\/(Jakarta|Makassar|Jayapura)$/.test(zone)) return "id";
    if (zone === "Asia/Karachi") return "ur";
    if (zone === "Asia/Kolkata") return "hi";
    if (/^(Europe\/Lisbon|Atlantic\/Azores|America\/(Sao_Paulo|Fortaleza|Recife))$/.test(zone)) return "pt";
    if (/^Africa\/(Nairobi|Dar_es_Salaam|Kampala)$/.test(zone)) return "sw";
    return "en";
  }

  function detectAutomaticLanguage() {
    var browserLanguages = [];
    try {
      browserLanguages = (navigator.languages || [navigator.language || navigator.userLanguage]).filter(Boolean);
    } catch (error) {
      browserLanguages = [];
    }
    for (var index = 0; index < browserLanguages.length; index += 1) {
      var detected = normalizeSupportedLanguage(browserLanguages[index]);
      if (detected) return detected;
    }
    return languageFromTimeZone();
  }

  function readLanguagePreference() {
    var params;
    try {
      params = new URLSearchParams(window.location.search);
      var queryLanguage = normalizeSupportedLanguage(params.get("lang"));
      if (queryLanguage) return queryLanguage;
    } catch (error) {
      params = null;
    }
    try {
      var saved = normalizeSupportedLanguage(window.localStorage.getItem(languagePreferenceKey));
      if (saved) return saved;
    } catch (error) {
      return "";
    }
    return "";
  }

  function persistLanguagePreference(value) {
    try {
      window.localStorage.setItem(languagePreferenceKey, value);
    } catch (error) {
      return;
    }
  }

  var heartFilmMedia = {
    en: {
      src: mediaUrl("/files/allim-quran-in-heart-300-en.mp4?v=83", "../video/hifz-300-film/output/ALLIM-Quran-in-heart-300-EN-Web-720p.mp4"),
      poster: mediaUrl("/files/allim-quran-in-heart-300-en-poster.jpg?v=83", "../video/hifz-300-film/output/ALLIM-Quran-in-heart-300-EN-poster.jpg"),
      captions: mediaUrl("/files/allim-quran-in-heart-300-en.vtt?v=83", "../video/hifz-300-film/output/ALLIM-Quran-in-heart-300-EN.vtt"),
      label: "English captions"
    },
    ar: {
      src: mediaUrl("/files/allim-quran-in-heart-300-ar.mp4?v=83", "../video/hifz-300-film/output/ALLIM-Quran-in-heart-300-AR-Web-720p.mp4"),
      poster: mediaUrl("/files/allim-quran-in-heart-300-ar-poster.jpg?v=83", "../video/hifz-300-film/output/ALLIM-Quran-in-heart-300-AR-poster.jpg"),
      captions: mediaUrl("/files/allim-quran-in-heart-300-ar.vtt?v=83", "../video/hifz-300-film/output/ALLIM-Quran-in-heart-300-AR.vtt"),
      label: "ترجمة عربية"
    },
    ru: {
      src: mediaUrl("/files/allim-quran-in-heart-300-ru.mp4?v=83", "../video/hifz-300-film/output/ALLIM-Quran-in-heart-300-RU-Web-720p.mp4"),
      poster: mediaUrl("/files/allim-quran-in-heart-300-ru-poster.jpg?v=83", "../video/hifz-300-film/output/ALLIM-Quran-in-heart-300-RU-poster.jpg"),
      captions: mediaUrl("/files/allim-quran-in-heart-300-ru.vtt?v=83", "../video/hifz-300-film/output/ALLIM-Quran-in-heart-300-RU.vtt"),
      label: "Русские субтитры"
    },
    tr: {
      src: mediaUrl("/files/allim-quran-in-heart-300-tr.mp4?v=83", "../video/hifz-300-film/output/ALLIM-Quran-in-heart-300-TR-Web-720p.mp4"),
      poster: mediaUrl("/files/allim-quran-in-heart-300-tr-poster.jpg?v=83", "../video/hifz-300-film/output/ALLIM-Quran-in-heart-300-TR-poster.jpg"),
      captions: mediaUrl("/files/allim-quran-in-heart-300-tr.vtt?v=83", "../video/hifz-300-film/output/ALLIM-Quran-in-heart-300-TR.vtt"),
      label: "Türkçe altyazı"
    }
  };

  function applyHeartFilmLanguage(language) {
    var video = document.getElementById("heart-film-video");
    var source = document.getElementById("heart-film-source");
    var track = document.getElementById("heart-film-track");
    var filmLanguage = heartFilmMedia[language] ? language : "en";
    var media = heartFilmMedia[filmLanguage];
    if (!video || !source || !track || !media) return;
    if (video.dataset.heartFilmLanguage === filmLanguage && source.getAttribute("src") === media.src) return;
    video.pause();
    video.poster = media.poster;
    source.src = media.src;
    track.src = media.captions;
    track.srclang = filmLanguage;
    track.label = media.label;
    video.dataset.heartFilmLanguage = filmLanguage;
    video.load();
  }

  function configureProductLinks() {
    var isFilePreview = window.location.protocol === "file:";
    var isLocalServer = window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    var appTarget = isFilePreview ? "https://allimquran.com/learn" : (isLocalServer ? "../?v=57" : "/learn");
    document.querySelectorAll("[data-app-link]").forEach(function (link) {
      var view = link.getAttribute("data-app-view");
      link.setAttribute("href", view ? appTarget + (appTarget.indexOf("?") === -1 ? "?" : "&") + "view=" + encodeURIComponent(view) : appTarget);
    });
    var academyTarget = isFilePreview ? "https://allimquran.com/academy" : (isLocalServer ? "../academy/" : "/academy");
    document.querySelectorAll("[data-academy-link]").forEach(function (link) {
      var panel = link.getAttribute("data-academy-panel");
      link.setAttribute("href", academyTarget + (panel ? "?panel=" + encodeURIComponent(panel) : ""));
    });
  }

  function setupShareActions() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-share-trigger]"));
    var statusNodes = Array.prototype.slice.call(document.querySelectorAll("[data-share-status]"));
    if (!buttons.length) return;

    var fallbackCopy = {
      shareMessage: "ALLIM is a learning space for reading, memorizing and understanding the Qur’an.",
      shareCopied: "Link copied",
      shareComplete: "Invitation ready to send",
      shareFailed: "The share menu could not open. Copy the link manually."
    };
    var statusTimer = 0;

    function translated(key) {
      var language = normalizeSupportedLanguage(document.documentElement.lang) || "en";
      return (copies[language] && copies[language][key]) || fallbackCopy[key] || "";
    }

    function updateStatus(key) {
      window.clearTimeout(statusTimer);
      statusNodes.forEach(function (node) {
        node.textContent = translated(key);
      });
      if (!key) return;
      statusTimer = window.setTimeout(function () {
        statusNodes.forEach(function (node) { node.textContent = ""; });
      }, 5200);
    }

    function copyShareUrl(url) {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(url);
      }
      return new Promise(function (resolve, reject) {
        var field = document.createElement("textarea");
        field.value = url;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.inset = "-9999px auto auto -9999px";
        document.body.appendChild(field);
        field.select();
        try {
          if (!document.execCommand("copy")) throw new Error("Copy command was rejected");
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          field.remove();
        }
      });
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var academyInvitation = button.getAttribute("data-share-context") === "academy";
        var url = academyInvitation ? "https://allimquran.com/academy" : "https://allimquran.com/";
        var payload = {
          title: "ALLIM QUR’AN",
          text: translated("shareMessage"),
          url: url
        };

        if (navigator.share) {
          updateStatus("shareComplete");
          Promise.resolve(navigator.share(payload)).then(function () {
            updateStatus("shareComplete");
          }).catch(function (error) {
            if (error && error.name === "AbortError") {
              updateStatus("");
              return;
            }
            copyShareUrl(url).then(function () {
              updateStatus("shareCopied");
            }).catch(function () {
              updateStatus("shareFailed");
            });
          });
          return;
        }

        copyShareUrl(url).then(function () {
          updateStatus("shareCopied");
        }).catch(function () {
          updateStatus("shareFailed");
        });
      });
    });

    document.addEventListener("allim:languagechange", function () { updateStatus(""); });
  }

  function applyLanguage(language, options) {
    options = options || {};
    language = normalizeSupportedLanguage(language) || "en";
    selectedLanguageMode = options.mode === "detected" ? "detected" : "manual";
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" || language === "ur" ? "rtl" : "ltr";
    document.documentElement.dataset.languageMode = selectedLanguageMode;
    var languageSwitch = document.getElementById("language-switch");
    languageSwitch.value = language;
    var languageCurrentCode = document.getElementById("language-current-code");
    if (languageCurrentCode) languageCurrentCode.textContent = language.toUpperCase();
    document.querySelectorAll("[data-copy]").forEach(function (element) {
      var key = element.getAttribute("data-copy");
      if (!element.dataset.copyDefault) element.dataset.copyDefault = element.textContent;
      var value = language === "en" ? element.dataset.copyDefault : copies[language] && copies[language][key];
      element.textContent = value || element.dataset.copyDefault;
    });
    var languageCopy = copies[language] || copies.en;
    document.getElementById("language-primary-group").label = languageCopy.languagePrimary || "Languages";
    document.getElementById("language-more-group").label = languageCopy.languageMore || "More languages";
    languageSwitch.setAttribute("aria-label", languageCopy.languageLabel || "Language");
    applyHeartFilmLanguage(language);
    var isFilePreview = window.location.protocol === "file:";
    var isLocalServer = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    var blogRoute = language === "ar" ? "/ar/blog" : (language === "ru" ? "/ru/blog" : "/blog");
    document.querySelectorAll("[data-blog-link]").forEach(function (link) {
      link.setAttribute("href", isFilePreview ? "https://allimquran.com" + blogRoute : (isLocalServer ? "../blog/" : blogRoute));
    });
    document.querySelectorAll("[data-blog-article]").forEach(function (link) {
      var routeLanguage = ["ar", "ru", "en"].indexOf(language) >= 0 ? language : "en";
      var route = link.getAttribute("data-route-" + routeLanguage) || link.getAttribute("data-route-en");
      link.setAttribute("href", isFilePreview ? "https://allimquran.com" + route : route);
    });
    if (options.persist) persistLanguagePreference(language);
    document.dispatchEvent(new CustomEvent("allim:languagechange", { detail: { language: language, mode: selectedLanguageMode } }));
  }

  function setupHeroRecitationDemo() {
    var demo = document.querySelector(".recitation-demo");
    var playButton = document.getElementById("hero-demo-play");
    var micButton = document.getElementById("hero-demo-mic");
    if (!demo || !playButton || !micButton) return;

    var words = Array.prototype.slice.call(demo.querySelectorAll("[data-demo-word]"));
    var statusTitle = playButton.querySelector("strong");
    var statusText = playButton.querySelector("small");
    var progress = demo.querySelector(".demo-progress span");
    var recitationAudio = document.getElementById("hero-demo-recitation-audio");
    if (recitationAudio && mediaUrl(recitationAudio.getAttribute("src"), "./allim-hero-neutral-demo-v1.mp3") !== recitationAudio.getAttribute("src")) {
      recitationAudio.src = mediaUrl(recitationAudio.getAttribute("src"), "./allim-hero-neutral-demo-v1.mp3");
      recitationAudio.load();
    }
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var storageName = "allim-hero-recitation-demo-seen-v2";
    var timers = [];
    var runToken = 0;
    var audioContext;
    var firstRunHandled = false;
    var messages = {
      en: {
        idle: ["Hear how ALLIM responds", "A neutral learning voice demonstrates the pause and correction."],
        listening: ["Listening word by word…", "Correct words open in sequence."],
        error: ["Pause. Correct this word.", "The next ayah stays locked until the word is corrected."],
        corrected: ["Corrected. Continue.", "The reading opens again from this word."],
        complete: ["Ayah completed", "Replay the demonstration at any time."],
        button: "Play the recitation demonstration"
      },
      ru: {
        idle: ["Послушайте, как отвечает АЛЛИМ", "Нейтральный учебный голос показывает остановку и исправление."],
        listening: ["Слушаю слово за словом…", "Правильные слова открываются по порядку."],
        error: ["Остановка. Исправьте слово.", "Следующий аят закрыт, пока слово не исправлено."],
        corrected: ["Исправлено. Продолжайте.", "Чтение снова открыто с этого слова."],
        complete: ["Аят завершён", "Демонстрацию можно включить ещё раз."],
        button: "Включить демонстрацию чтения"
      },
      tr: {
        idle: ["ALLIM’in nasıl karşılık verdiğini dinleyin", "Tarafsız bir öğrenme sesi durmayı ve düzeltmeyi gösterir."],
        listening: ["Kelime kelime dinliyorum…", "Doğru kelimeler sırayla açılır."],
        error: ["Durun. Bu kelimeyi düzeltin.", "Kelime düzeltilene kadar sonraki ayet kilitli kalır."],
        corrected: ["Düzeltildi. Devam edin.", "Okuma bu kelimeden yeniden açıldı."],
        complete: ["Ayet tamamlandı", "Gösterimi istediğiniz zaman yeniden oynatabilirsiniz."],
        button: "Tilavet gösterimini oynat"
      },
      ar: {
        idle: ["استمع كيف يستجيب ALLIM", "صوت تعليمي محايد يوضّح التوقف والتصحيح."],
        listening: ["أستمع كلمةً كلمة…", "تظهر الكلمات الصحيحة بالترتيب."],
        error: ["توقّف. صحّح الكلمة.", "تبقى الآية التالية مغلقة حتى تصحيح الكلمة."],
        corrected: ["صُحّحت. واصل.", "انفتح مسار التلاوة من هذه الكلمة."],
        complete: ["اكتملت الآية", "يمكنك إعادة العرض في أي وقت."],
        button: "شغّل عرض التلاوة"
      }
    };

    function currentMessages() {
      var language = document.documentElement.lang || "en";
      if (messages[language]) return messages[language];
      var translated = copies[language] || {};
      if (!translated.demoIdleTitle) return messages.en;
      return {
        idle: [translated.demoIdleTitle, translated.demoIdleText],
        listening: [translated.demoListeningTitle, translated.demoListeningText],
        error: [translated.demoErrorTitle, translated.demoErrorText],
        corrected: [translated.demoCorrectedTitle, translated.demoCorrectedText],
        complete: [translated.demoCompleteTitle, translated.demoCompleteText],
        button: translated.demoButton
      };
    }

    function setStatus(state) {
      var copy = currentMessages();
      var value = copy[state] || copy.idle;
      demo.setAttribute("data-demo-state", state);
      playButton.className = "correction-state is-" + state;
      playButton.setAttribute("aria-label", copy.button);
      micButton.setAttribute("aria-label", copy.button);
      statusTitle.textContent = value[0];
      statusText.textContent = value[1];
    }

    function clearDemoTimers() {
      timers.forEach(function (timer) { window.clearTimeout(timer); });
      timers = [];
    }

    function stopDemoAudio() {
      if (!recitationAudio) return;
      recitationAudio.pause();
      recitationAudio.currentTime = 0;
    }

    function queue(token, delay, callback) {
      timers.push(window.setTimeout(function () {
        if (token === runToken) callback();
      }, reduceMotion ? Math.min(delay, 120) : delay));
    }

    function setProgress(value) {
      progress.style.width = value + "%";
    }

    function resetWords() {
      words.forEach(function (word, index) {
        word.className = "word pending";
        if (index === 3) word.textContent = word.getAttribute("data-correct");
      });
      setProgress(0);
      micButton.classList.remove("is-active");
    }

    function markWord(index, state, displayedText) {
      var word = words[index];
      if (!word) return;
      word.className = "word " + state;
      if (displayedText) word.textContent = displayedText;
    }

    function prepareAudioContext() {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContext) audioContext = new AudioContextClass();
      if (audioContext.state === "suspended") audioContext.resume().catch(function () {});
    }

    function playErrorSignal() {
      if (!audioContext || audioContext.state !== "running") return;
      var now = audioContext.currentTime;
      [440, 349].forEach(function (frequency, index) {
        var oscillator = audioContext.createOscillator();
        var gain = audioContext.createGain();
        var start = now + index * .13;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(.045, start + .018);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .18);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(start);
        oscillator.stop(start + .2);
      });
    }

    function rememberDemo() {
      try {
        window.localStorage.setItem(storageName, "1");
      } catch (error) {
        /* Persistent storage can be unavailable in private mode. */
      }
    }

    function startDemo(withSound) {
      firstRunHandled = true;
      runToken += 1;
      var token = runToken;
      clearDemoTimers();
      stopDemoAudio();
      resetWords();
      setStatus("listening");
      micButton.classList.add("is-active");

      if (withSound) {
        prepareAudioContext();
        if (recitationAudio) {
          recitationAudio.volume = .9;
          var playback = recitationAudio.play();
          if (playback && typeof playback.catch === "function") {
            playback.catch(function () {
              setStatus("idle");
            });
          }
        }
      }

      queue(token, 550, function () { markWord(0, "correct"); setProgress(14); });
      queue(token, 1350, function () { markWord(1, "correct"); setProgress(28); });
      queue(token, 2050, function () { markWord(2, "correct"); setProgress(42); });
      queue(token, 2780, function () {
        markWord(3, "current is-error", words[3].getAttribute("data-error"));
        setProgress(43);
        setStatus("error");
      });
      queue(token, 3050, function () { if (withSound) playErrorSignal(); });
      queue(token, 4050, function () {
        markWord(3, "correct is-corrected", words[3].getAttribute("data-correct"));
        setProgress(57);
        setStatus("corrected");
      });
      queue(token, 4900, function () { markWord(4, "correct"); setProgress(71); });
      queue(token, 5800, function () { markWord(5, "correct"); setProgress(85); });
      queue(token, 6900, function () { markWord(6, "correct"); setProgress(100); });
      queue(token, 7850, function () {
        setStatus("complete");
        micButton.classList.remove("is-active");
        rememberDemo();
      });
    }

    playButton.addEventListener("click", function () { startDemo(true); });
    micButton.addEventListener("click", function () { startDemo(true); });
    document.addEventListener("allim:languagechange", function () {
      setStatus(demo.getAttribute("data-demo-state") || "idle");
    });
    setStatus("idle");
    resetWords();

    if (reduceMotion) return;
    var alreadySeen = false;
    try {
      alreadySeen = window.localStorage.getItem(storageName) === "1";
    } catch (error) {
      alreadySeen = false;
    }
    if (alreadySeen) return;

    function beginFirstVisualDemo() {
      if (firstRunHandled) return;
      if (document.getElementById("allim-system-intro")) {
        timers.push(window.setTimeout(beginFirstVisualDemo, 420));
        return;
      }
      timers.push(window.setTimeout(function () {
        if (!firstRunHandled) startDemo(false);
      }, 520));
    }
    beginFirstVisualDemo();
  }

  function setupIntelligenceMap() {
    var map = document.getElementById("ai-knowledge-map");
    var points = Array.prototype.slice.call(document.querySelectorAll(".intelligence-point[data-ai-flow]"));
    var stageLabel = map && map.querySelector(".map-stage-label");
    if (!map || !stageLabel || !points.length) return;

    var flows = ["recitation", "memory", "knowledge"];
    var stageKeys = {
      recitation: "mapStageRecitation",
      memory: "mapStageMemory",
      knowledge: "mapStageKnowledge"
    };
    var titleKeys = {
      recitation: "aiRecitationTitle",
      memory: "aiMemoryTitle",
      knowledge: "aiKnowledgeTitle"
    };
    var stageDefaults = {
      recitation: "Listening and matching the ayah",
      memory: "Building the review queue",
      knowledge: "Checking connected sources"
    };
    var activeFlow = map.getAttribute("data-active-flow") || flows[0];
    var holdUntil = 0;
    var mapIsVisible = true;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function stageText(flow) {
      var language = document.documentElement.lang || "en";
      var languageCopy = copies[language] || {};
      return languageCopy[stageKeys[flow]] || languageCopy[titleKeys[flow]] || stageDefaults[flow];
    }

    function activateFlow(flow, userInitiated) {
      if (flows.indexOf(flow) < 0) return;
      activeFlow = flow;
      map.setAttribute("data-active-flow", flow);
      points.forEach(function (point) {
        var active = point.getAttribute("data-ai-flow") === flow;
        point.classList.toggle("is-active", active);
        point.setAttribute("aria-pressed", String(active));
      });
      stageLabel.classList.remove("is-switching");
      window.requestAnimationFrame(function () {
        stageLabel.textContent = stageText(flow);
        stageLabel.classList.add("is-switching");
      });
      if (userInitiated) holdUntil = Date.now() + 6200;
    }

    points.forEach(function (point, pointIndex) {
      var flow = point.getAttribute("data-ai-flow");
      point.addEventListener("pointerenter", function () { activateFlow(flow, true); });
      point.addEventListener("focus", function () { activateFlow(flow, true); });
      point.addEventListener("click", function () { activateFlow(flow, true); });
      point.addEventListener("keydown", function (event) {
        if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].indexOf(event.key) < 0) return;
        event.preventDefault();
        var direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        var nextPoint = points[(pointIndex + direction + points.length) % points.length];
        nextPoint.focus();
      });
    });

    document.addEventListener("allim:languagechange", function () {
      stageLabel.textContent = stageText(activeFlow);
    });

    if ("IntersectionObserver" in window) {
      var sectionObserver = new IntersectionObserver(function (entries) {
        mapIsVisible = entries.some(function (entry) { return entry.isIntersecting; });
      }, { threshold: .18 });
      sectionObserver.observe(map);
    }

    activateFlow(activeFlow, false);
    if (reduceMotion) return;
    window.setInterval(function () {
      if (!mapIsVisible || Date.now() < holdUntil || document.hidden) return;
      var nextIndex = (flows.indexOf(activeFlow) + 1) % flows.length;
      activateFlow(flows[nextIndex], false);
    }, 3400);
  }

  function setupJourneyExperience() {
    var visual = document.getElementById("journey-visual");
    var cards = Array.prototype.slice.call(document.querySelectorAll(".journey-card[data-journey-step]"));
    var visualWord = document.getElementById("journey-visual-word");
    var visualIcon = document.getElementById("journey-visual-icon");
    var visualIndex = document.getElementById("journey-visual-index");
    var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-journey-node]"));
    if (!visual || !visualWord || !visualIcon || !visualIndex || !cards.length) return;

    var activeIndex = 0;
    var holdUntil = 0;
    var visualIsVisible = true;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function activateJourney(index, userInitiated) {
      if (index < 0 || index >= cards.length) return;
      activeIndex = index;
      var activeCard = cards[index];
      var step = activeCard.getAttribute("data-journey-step");
      cards.forEach(function (card, cardIndex) {
        var active = cardIndex === index;
        card.classList.toggle("is-active", active);
        card.setAttribute("aria-pressed", String(active));
      });
      nodes.forEach(function (node) {
        node.classList.toggle("is-active", node.getAttribute("data-journey-node") === step);
      });
      visual.setAttribute("data-active-step", step);
      visualIndex.textContent = activeCard.getAttribute("data-step") || String(index + 1).padStart(2, "0");
      visualWord.textContent = activeCard.getAttribute("data-journey-word") || "";
      visualIcon.setAttribute("href", activeCard.getAttribute("data-journey-icon") || "#i-book");
      if (userInitiated) holdUntil = Date.now() + 6500;
    }

    cards.forEach(function (card, cardIndex) {
      card.addEventListener("pointerenter", function () { activateJourney(cardIndex, true); });
      card.addEventListener("focus", function () { activateJourney(cardIndex, true); });
      card.addEventListener("click", function () { activateJourney(cardIndex, true); });
      card.addEventListener("keydown", function (event) {
        if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].indexOf(event.key) < 0) return;
        event.preventDefault();
        var direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        cards[(cardIndex + direction + cards.length) % cards.length].focus();
      });
    });

    if ("IntersectionObserver" in window) {
      var journeyObserver = new IntersectionObserver(function (entries) {
        visualIsVisible = entries.some(function (entry) { return entry.isIntersecting; });
      }, { threshold: .2 });
      journeyObserver.observe(visual);
    }

    activateJourney(0, false);
    if (reduceMotion) return;
    window.setInterval(function () {
      if (!visualIsVisible || Date.now() < holdUntil || document.hidden) return;
      activateJourney((activeIndex + 1) % cards.length, false);
    }, 3600);
  }

  document.getElementById("language-switch").addEventListener("change", function (event) {
    var selected = event.target.value;
    applyLanguage(selected, { mode: "manual", persist: true });
  });

  var menuButton = document.getElementById("menu-button");
  var mobileMenu = document.getElementById("mobile-menu");
  menuButton.addEventListener("click", function () {
    var open = mobileMenu.hidden;
    mobileMenu.hidden = !open;
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.querySelector("use").setAttribute("href", open ? "#i-close" : "#i-menu");
    if (open) document.querySelector(".site-header").classList.remove("is-header-hidden");
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
  var headerLastScroll = Math.max(window.scrollY, 0);
  var headerScrollTicking = false;

  function updateHeaderPosition() {
    var currentScroll = Math.max(window.scrollY, 0);
    var delta = currentScroll - headerLastScroll;
    var menuIsOpen = menuButton.getAttribute("aria-expanded") === "true";
    var activeHeaderElement = header.contains(document.activeElement) ? document.activeElement : null;
    var headerHasFocus = activeHeaderElement && activeHeaderElement.matches(":focus-visible");

    header.classList.toggle("is-scrolled", currentScroll > 18);

    if (currentScroll <= 24 || menuIsOpen || headerHasFocus) {
      header.classList.remove("is-header-hidden");
    } else if (delta > 5 && currentScroll > 118) {
      header.classList.add("is-header-hidden");
    } else if (delta < -5) {
      header.classList.remove("is-header-hidden");
    }

    if (Math.abs(delta) > 2 || currentScroll <= 24) headerLastScroll = currentScroll;
    headerScrollTicking = false;
  }

  window.addEventListener("scroll", function () {
    if (headerScrollTicking) return;
    headerScrollTicking = true;
    window.requestAnimationFrame(updateHeaderPosition);
  }, { passive: true });
  updateHeaderPosition();

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
    var revealTargets = document.querySelectorAll(".section-intro,.journey-visual,.journey-card,.heart-feature-copy,.heart-page-preview,.heart-film-copy,.heart-film-player,.intelligence-copy,.knowledge-map,.method-layout,.academy-intro,.academy-card,.ijazah-note,.academy-referral,.trust-heading,.trust-grid,.share-benefit-copy,.share-benefit-rule,.early-copy");
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

  var localHomepage = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  configureProductLinks();
  var initialLanguagePreference = readLanguagePreference();
  applyLanguage(
    initialLanguagePreference || detectAutomaticLanguage(),
    { mode: initialLanguagePreference ? "manual" : "detected", persist: false }
  );
  setupShareActions();
  setupJourneyExperience();
  setupIntelligenceMap();
  setupSystemIntro({ warm: localHomepage ? ["../?v=57", "../academy/"] : ["/learn", "/academy"] });
  setupHeroRecitationDemo();
}());
