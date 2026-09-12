(function () {
  "use strict";

  function setBrandFavicon() {
    var iconUrl = window.location.protocol === "file:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "allim-brand-icon.png"
      : "/files/allim-brand-icon.png?v=77";
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

  var platformLanguages = ["en", "ar", "ru"];
  var languagePreferenceKey = "allim-language-preference-v1";

  function normalizePlatformLanguage(value) {
    var language = String(value || "").toLowerCase().split(/[-_]/)[0];
    return platformLanguages.indexOf(language) >= 0 ? language : "";
  }

  function readLanguagePreference() {
    try {
      return normalizePlatformLanguage(window.localStorage.getItem(languagePreferenceKey));
    } catch (error) {
      return "";
    }
  }

  function persistLanguagePreference(language) {
    try {
      window.localStorage.setItem(languagePreferenceKey, language);
    } catch (error) {
      /* A private browsing mode may reject persistent storage. */
    }
  }

  var initialLanguagePreference = readLanguagePreference();
  if (initialLanguagePreference) {
    document.documentElement.lang = initialLanguagePreference;
    document.documentElement.dir = initialLanguagePreference === "ar" ? "rtl" : "ltr";
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
    } : {
      sound: "Listen to the du‘a", playing: "Playing the du‘a", skip: "Skip", mission: "A prayer became our mission", loading: "Preparing your reading space"
    });

    var soundButton = document.getElementById("system-intro-sound");
    var skipButton = document.getElementById("system-intro-skip");
    var audio = document.getElementById("system-intro-audio");
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


  setupSystemIntro({ warm: ["/academy"] });

  var storageKey = "quran-companion-prototype-v4";
  var defaultState = {
    language: "ru",
    arabicSize: 48,
    showMeaning: true,
    sessions: 0,
    wordsReviewed: 0,
    hints: 0,
    selectedSurah: 2,
    selectedAyah: 2,
    recognitionMode: "auto",
    recognitionModeExplicit: false,
    selectedReciter: "husary",
    audioRepeat: false,
    showInterlinear: false,
    mushafFont: "classic",
    mushafPaper: "ivory",
    mushafInk: "charcoal",
    recitationFlow: "continuous",
    recitationFlowExplicit: false,
    autoAdvance: true,
    soundCues: true,
    strictCorrection: true,
    dailyGoal: 1,
    savedVerses: [],
    reviewQueue: [],
    activity: {},
    memorizationMethod: "foundation300",
    hifzCoach: { selectionMode: "manual", signals: [] },
    heartMushaf: { units: {}, pages: {}, linked33Pages: {}, turkishWallPages: {}, lawhPages: {} },
    lifePractice: { entries: [] }
  };

  var translations = {
    ru: {
      skip: "К содержанию", prototype: "Companion · прототип", workingPrototype: "Рабочий прототип",
      mainNav: "Основная навигация", mobileNav: "Мобильная навигация", changeLanguage: "Сменить язык", lessonSteps: "Этапы занятия", toggleTranslation: "Показать или скрыть перевод", audioDemo: "Озвучить выбранный аят системным арабским голосом", displayMode: "Режим отображения", ayahLabel: "Сура Аль-Бакара, аят 2", ayahNumberLabel: "Аят 2", close: "Закрыть", openGuide: "Как работает приложение", todayReality: "Реальные показатели на сегодня", verseActions: "Быстрые действия с аятом", activityLabel: "Активность за последние пять недель", assistantTabs: "Помощник чтения",
      navToday: "Сегодня", navRead: "Читать", navMemorize: "Хифз", navLearn: "Изучать", navProgress: "Прогресс", navAcademy: "Академия", navSettings: "Настройки",
      todayTitle: "Сегодня", readTitle: "Читайте в своём темпе", memorizeTitle: "Читайте наизусть — слово за словом", learnTitle: "Поймите строение аята", progressTitle: "Прогресс начинается с первой сессии", settingsTitle: "Настройки обучения",
      localMode: "На устройстве", greeting: "Ас-саляму ‘аляйкум", foundationTag: "Дуа, ставшая нашей миссией", duaTranslation: "О Аллах, научи его Писанию.", heroTitle: "Учиться Писанию. Понимать. Сохранять в сердце.", heroText: "В основе платформы — дуа Посланника Аллаха ﷺ за ‘Абдуллаха ибн ‘Аббаса رضي الله عنهما.", duaAttribution: "Дуа Пророка ﷺ за Ибн ‘Аббаса رضي الله عنهما", bukhariReference: "Сахих аль-Бухари · 75",
      continueLesson: "Продолжить занятие", quickTest: "Быстрая проверка", todayPlan: "План на сегодня", oneFocusedSession: "Одно сфокусированное занятие", minutesShort: "мин",
      dailyGoal: "Цель на сегодня", sessionsShort: "сесс.", currentStreak: "Текущая серия", daysShort: "дн.", savedAndReview: "Сохранено · повторить",
      readAloud: "Прочитать вслух", readAloudText: "Аль-Бакара · 2:2", recall: "Вспомнить без текста", recallText: "Скрытые слова · 3 минуты", understandWords: "Разобрать слова", understandWordsText: "Корни · форма · синтаксис",
      privacyFirst: "Приватность по умолчанию", privacyText: "Прогресс хранится на устройстве. Quran AI использует временный аудиофрагмент только для распознавания и удаляет его после обработки.",
      secureContextRequired: "Микрофон заблокирован режимом открытия файла", secureContextText: "Не открывайте index.html двойным нажатием. Запустите приложение через локальный адрес — тогда заработают микрофон, распознавание и офлайн-режим.", openServerVersion: "Открыть рабочую версию", secureMicStatus: "Нужен безопасный запуск приложения", secureMicStatusSub: "Откройте рабочую версию через http://localhost:4174 — локальные файлы не дают приложению полный доступ к микрофону.",
      cancelMicRequest: "Отменить запрос", micRequestCancelled: "Запрос микрофона отменён", micRequestCancelledSub: "Нажмите микрофон, когда будете готовы читать.", micRequestTimeout: "Браузер не ответил на запрос микрофона", micRequestTimeoutSub: "Проверьте разрешение микрофона для allimquran.com и нажмите ещё раз.",
      recitationMode: "Режим чтения", readIntro: "Нажмите на слово, чтобы увидеть его значение и грамматику.", verifiedSource: "Проверенный источник", baqarah: "Аль-Бакара",
      modeRead: "Чтение", modeListen: "Аудио", modeFocus: "Фокус", verseMeaning: "Это Писание, в котором нет сомнения, — руководство для богобоязненных.",
      micReady: "Микрофон готов", micDisclosure: "Проверяем последовательность слов, не таджвид. Аудио не сохраняется постоянно.", startListening: "Начать чтение", stopListening: "Остановить", selectedPassage: "Выбранный отрывок", matchedWords: "совпало", wordAnalysis: "Разбор слова",
      selectSurah: "Выберите суру", selectAyah: "Выберите аят", nextAyah: "Следующий аят", nextSurah: "Следующая сура", corpusEnd: "Конец Корана", recognizedText: "Распознанный текст", browserRecognition: "Системное распознавание браузера", enhancedRecognition: "Совместимый режим · до 5 вариантов", waitingSpeech: "Начните читать выбранный аят…", comparisonDisclaimer: "Сопоставление выполняется без огласовок и не заменяет проверку преподавателем.",
      openQuranSearch: "Открыть все суры и поиск по Корану", quranCatalogShort: "114 сур", completeQuran: "ПОЛНЫЙ КОРАН", findSurahAyah: "Найдите суру или аят", quranSearchPlaceholder: "Название суры, 2:255 или страница 42", searchExamples: "Примеры поиска", allSurahs: "Все 114 сур", searchLoading: "Загружаю каталог Корана…", searchNoResults: "Ничего не найдено. Введите название, номер суры или ссылку вида 2:255.", searchDirectVerse: "Перейти к аяту", searchMushafPage: "Открыть страницу мусхафа", surahVerses: "аятов", pagesLabel: "стр.", verseLoading: "Открываю выбранный аят…", verseUnavailable: "Не удалось загрузить аят. Проверьте соединение и повторите.", glossPending: "Словарный перевод проверяется",
      readingSummary: "Итог чтения", summaryIdle: "Появится после начала чтения.", summaryLive: "Обновляется по мере распознавания.", summaryFinal: "Проверьте отмеченные слова и повторите аят при необходимости.", summaryComplete: "Все слова аята сопоставлены по порядку.", summaryMatched: "совпало", summaryReview: "повторить", summaryExtra: "не сопоставлено",
      saveVerse: "Сохранить аят", saveVerseText: "Вернуться к нему позже", removeSaved: "Убрать из сохранённых", addToReview: "Добавить к повторению", addToReviewText: "Включить в очередь хифза", removeFromReview: "Убрать из повторения", focusStudio: "Студия фокуса", focusStudioText: "Только мусхаф и чтение", leaveFocus: "Выйти из фокуса",
      requestingMic: "Запрашиваю доступ к микрофону…", requestingMicSub: "Подтвердите доступ в окне браузера. Запись не сохраняется.", listeningNow: "Слушаю чтение…", listeningSub: "Говорите естественно. Нажмите «Остановить», когда закончите.", recognitionStopped: "Распознавание остановлено", recognitionStoppedSub: "Можно выбрать другой аят или начать ещё раз.", recognitionUnsupported: "В этом браузере распознавание речи недоступно.", recognitionUnsupportedSub: "Откройте приложение в Chrome или Safari с поддержкой распознавания речи.", permissionDenied: "Доступ к микрофону не разрешён.", permissionDeniedSub: "Разрешите микрофон для этого сайта в настройках браузера и повторите.", noSpeech: "Речь не обнаружена.", noSpeechSub: "Проверьте микрофон и начните чтение ещё раз.", recognitionNetwork: "Служба распознавания недоступна.", recognitionNetworkSub: "Проверьте интернет-соединение или повторите позже.", audioCaptureError: "Браузер не получил звук с микрофона.", audioCaptureErrorSub: "Проверьте выбранный микрофон в настройках сайта и повторите.", recognitionCompatibility: "Несовместимые подсказки браузера отключены.", recognitionCompatibilitySub: "Запустите чтение ещё раз — теперь используется базовый совместимый режим.", recognitionError: "Не удалось распознать чтение.", recognitionErrorSub: "Повторите попытку или используйте другой поддерживаемый браузер.", recognitionComplete: "Аят распознан полностью", recognitionCompleteSub: "Все слова выбранного аята сопоставлены по последовательности.", detailedAnalysisPending: "Подробная проверенная морфология для этого слова ещё не добавлена.",
      quranRecording: "Quran AI слушает чтение…", quranRecordingSub: "Читайте свободно: после естественной паузы проверка начнётся автоматически. Аудио удаляется после обработки.", quranProcessing: "Quran AI обрабатывает чтение…", quranProcessingSub: "Сверяем расшифровку с выбранным аятом.", quranRecognition: "Quran AI · кораническая речь", quranRecognitionError: "Quran AI-сервис временно недоступен.", quranRecognitionErrorSub: "Повторите через несколько секунд или выберите распознавание браузера.", systemAudioTitle: "Озвучивание аята", systemAudioDisclosure: "Системный арабский голос для прослушивания текста; это не профессиональная рецитация чтеца.", playAudio: "Слушать", pauseAudio: "Пауза", resumeAudio: "Продолжить", stopAudio: "Остановить", audioPlaying: "Озвучивание началось.", audioStopped: "Озвучивание остановлено.",
      meaning: "Значение", root: "Корень", grammar: "Грамматика", openFullAnalysis: "Открыть полный разбор", wordTab: "Слово", aiMentor: "AI-наставник", aiReady: "Готов помочь с этим аятом", onDevice: "На устройстве", aiIntro: "Выберите задачу — я свяжу чтение, запоминание и разбор выбранного аята.", aiMemory: "Как запомнить?", aiWord: "Объяснить слово", aiReview: "Что повторить?", aiDisclosure: "Контекстные подсказки формируются локально и не заменяют преподавателя или тафсир.", aiVerseReady: "Выбран {reference}. Начните чтение — я сопоставлю слова и предложу следующий шаг.", aiMemoryAdvice: "В {reference} — {words} слов. Разделите аят на {parts} смысловых блока, прослушайте каждый и повторите без текста.", aiWordAdvice: "{word} — {meaning}. Корень: {root}. {grammar}", aiReviewIdle: "Сначала прочитайте {reference} один раз. После распознавания я покажу, какие слова повторить.", aiReviewAdvice: "По текущей попытке: совпало {matched}, повторить {review}, не сопоставлено {extra}.", aiCompleteAdvice: "Все слова {reference} сопоставлены. Повторите аят без текста и затем переходите к следующему.",
      memoryMode: "Тренировка памяти", memorizeIntro: "Правильно произнесённое слово откроется. Если слово не совпало, карточка останется закрытой.", promptLabel: "Начало аята",
      reviewQueue: "Очередь повторения", reviewQueueText: "Аяты, добавленные вами или отмеченные после чтения", savedVerses: "Сохранённые аяты", savedVersesText: "Личная локальная коллекция без аккаунта", emptyReview: "Пока пусто. Добавьте аят после чтения.", emptySaved: "Пока нет сохранённых аятов.",
      revealOne: "Открыть одно слово", recalled: "Я вспомнил", startAgain: "Начать заново", memoryStart: "Начать читать наизусть", memoryStop: "Остановить проверку", memoryHint: "Нужна подсказка", memoryHeard: "Распознано", memoryWaiting: "Здесь появятся услышанные слова…", memoryMicReady: "Микрофон готов к проверке", memoryMicReadySub: "Читайте с начала аята или продолжите с первой закрытой карточки.", memoryRequesting: "Разрешите доступ к микрофону…", memoryRequestingSub: "Подтвердите доступ в браузере. Аудио не сохраняется.", memoryListening: "Слушаю ваше чтение…", memoryListeningSub: "Правильные слова открываются строго по порядку.", memoryWordCorrect: "Правильно — слово открыто", memoryWordCorrectSub: "Продолжайте читать следующую закрытую карточку.", memoryWordRetry: "Слово не совпало", memoryWordRetrySub: "Карточка остаётся закрытой. Повторите слово ещё раз.", memoryPaused: "Проверка остановлена", memoryPausedSub: "Нажмите кнопку и продолжите с первой закрытой карточки.", memoryComplete: "Аят прочитан правильно", memoryCompleteSub: "Все закрытые слова распознаны по порядку.", memoryCompleteWithHint: "Аят завершён с подсказкой", memoryCompleteWithHintSub: "Повторите ещё раз без подсказок, чтобы закрепить результат.", memoryUnsupported: "Проверка голосом недоступна в этом браузере", memoryUnsupportedSub: "Используйте Quran AI или поддерживаемое распознавание браузера.", memoryNoSpeech: "Слова не распознаны", memoryNoSpeechSub: "Проверьте микрофон и повторите с первой закрытой карточки.", memoryPermissionDenied: "Нет доступа к микрофону", memoryPermissionDeniedSub: "Разрешите микрофон для allimquran.com в настройках браузера.", memoryProcessing: "Проверяю чтение…", memoryProcessingSub: "Сопоставляю услышанные слова с продолжением аята.", memoryHintOpened: "Подсказка открыта. Для закрепления повторите аят без подсказок.",
      quranicArabic: "Коранический арабский", learnIntro: "Фусха, кораническая грамматика и разговорная практика показаны раздельно.", verseMap: "Карта аята", tapWord: "Нажмите на слово",
      threeTracks: "Три учебных трека", trackQuran: "Язык Корана", trackQuranText: "Лексика, корни, морфология и синтаксис.", trackFusha: "Фусха", trackFushaText: "Современная литературная речь и письмо.", trackHijazi: "Хиджазский", trackHijaziText: "Повседневная речь Мекки, Медины и других городов Саудовской Аравии.",
      yourJourney: "Ваш путь", progressIntro: "Здесь появятся только реальные результаты ваших действий в приложении.", sessions: "Сессии", storedLocally: "Хранятся локально",
      wordsReviewed: "Слова повторены", fromYourActions: "По вашим действиям", hintsUsed: "Подсказки", notAScore: "Не оценка, а ориентир",
      noInventedStats: "Без выдуманной статистики", noInventedStatsText: "Завершите чтение или тренировку памяти — и этот экран обновится.", beginSession: "Начать сессию",
      realActivity: "Реальная активность", lastFiveWeeks: "Последние пять недель", localOnly: "Только на устройстве", lessActivity: "Меньше", moreActivity: "Больше",
      personalization: "Персонализация", settingsIntro: "Интерфейс адаптируется к вашему языку и способу чтения.", interfaceLanguage: "Язык интерфейса", interfaceLanguageText: "English, العربية или Русский", recognitionEngineSetting: "Распознавание чтения", browserEngine: "Браузер · live", quranEngine: "Quran AI · кораническая речь", quranServiceReady: "Quran AI готов; временное аудио удаляется после обработки.", quranServiceUnavailable: "Quran AI временно недоступен; используется распознавание браузера.",
      dailyGoalSetting: "Дневная цель", dailyGoalSettingText: "Считаются только завершённые чтения и тренировки",
      autoAdvanceSetting: "Автопереход к следующему аяту", autoAdvanceSettingText: "После полностью правильного чтения приложение продолжит автоматически", autoAdvanceTitle: "Автопереход включён", autoAdvanceReadCountdown: "Следующий аят откроется через {seconds} сек.", autoAdvanceMemoryCountdown: "Хифз продолжится со следующего аята через {seconds} сек.", autoAdvanceCancel: "Отменить", autoAdvanceEnabled: "Автопереход включён.", autoAdvanceDisabled: "Автопереход выключен.", autoAdvanceCancelled: "Автопереход к следующему аяту отменён.",
      arabicSize: "Размер арабского текста", arabicSizeText: "Изменяется сразу на экране чтения", showMeaning: "Показывать смысловой перевод", showMeaningText: "Можно скрыть для режима запоминания",
      localPrivacy: "Локальная приватность", localPrivacyText: "Прогресс остаётся на устройстве; режим Quran AI использует только выбранный локальный сервер", enabled: "Включено", clearProgress: "Очистить локальный прогресс",
      dataSources: "Источники данных", verifiedDemo: "Проверенный корпус", sourceText: "Все 114 сур и 604 страницы мусхафа загружаются по запросу из Quran Foundation Content API. Подробная локальная морфология пока доступна для выбранных аятов и дополняется проверенными словарными данными.", understood: "Понятно",
      smartSession: "Умная сессия", guideTitle: "Один путь вместо множества экранов", guideText: "Читайте выбранный аят, получите прозрачное сопоставление слов, повторите сложное и разберите смысл — всё в одном контексте.", guideRead: "Читайте", guideReadText: "Микрофон показывает распознанные и требующие повтора слова.", guideReview: "Закрепляйте", guideReviewText: "Сложный аят попадает в вашу локальную очередь повторения.", guideUnderstand: "Понимайте", guideUnderstandText: "Разбор слова остаётся рядом с текстом, а не в отдельном приложении.",
      audioUnavailable: "Системное озвучивание недоступно в этом браузере.", wordRevealed: "Открыто следующее слово.", allWordsVisible: "Все слова уже открыты.", memorySaved: "Попытка сохранена на этом устройстве.",
      memoryReset: "Тренировка начата заново.", progressCleared: "Локальный прогресс очищен.", focusMode: "Перевод скрыт для концентрации.", listenMode: "Аудиорежим включён.",
      dataPresentTitle: "Локальный прогресс обновлён", dataPresentText: "Показатели выше отражают только действия в этом прототипе.", confirmClear: "Очистить локальный прогресс прототипа?", verseSaved: "Аят сохранён на устройстве.", verseUnsaved: "Аят удалён из сохранённых.", reviewAdded: "Аят добавлен в очередь повторения.", reviewRemoved: "Аят убран из очереди повторения."
    },
    en: {
      skip: "Skip to content", prototype: "Companion · prototype", workingPrototype: "Working prototype",
      mainNav: "Main navigation", mobileNav: "Mobile navigation", changeLanguage: "Change language", lessonSteps: "Lesson steps", toggleTranslation: "Show or hide translation", audioDemo: "Voice the selected verse with the system Arabic voice", displayMode: "Display mode", ayahLabel: "Surah Al-Baqarah, verse 2", ayahNumberLabel: "Verse 2", close: "Close", openGuide: "How the app works", todayReality: "Real metrics for today", verseActions: "Quick verse actions", activityLabel: "Activity over the last five weeks", assistantTabs: "Reading assistant",
      navToday: "Today", navRead: "Read", navMemorize: "Hifz", navLearn: "Learn", navProgress: "Progress", navAcademy: "Academy", navSettings: "Settings",
      todayTitle: "Today", readTitle: "Recite at your own pace", memorizeTitle: "Recite from memory — word by word", learnTitle: "Understand the verse structure", progressTitle: "Progress starts with your first session", settingsTitle: "Learning settings",
      localMode: "On-device", greeting: "As-salāmu ʿalaykum", foundationTag: "A du‘a that became our mission", duaTranslation: "O Allah, teach him the Book.", heroTitle: "Learn the Book. Understand it. Carry it in the heart.", heroText: "The platform is founded on the Messenger of Allah’s ﷺ supplication for ‘Abdullah ibn ‘Abbas رضي الله عنهما.", duaAttribution: "The Prophet’s ﷺ du‘a for Ibn ‘Abbas رضي الله عنهما", bukhariReference: "Sahih al-Bukhari · 75",
      continueLesson: "Continue lesson", quickTest: "Quick test", todayPlan: "Today’s plan", oneFocusedSession: "One focused session", minutesShort: "min",
      dailyGoal: "Today’s goal", sessionsShort: "sessions", currentStreak: "Current streak", daysShort: "days", savedAndReview: "Saved · review",
      readAloud: "Recite aloud", readAloudText: "Al-Baqarah · 2:2", recall: "Recall without text", recallText: "Hidden words · 3 minutes", understandWords: "Study the words", understandWordsText: "Roots · form · syntax",
      privacyFirst: "Privacy by default", privacyText: "Progress stays on this device. Quran AI uses a temporary audio clip only for recognition and deletes it after processing.",
      secureContextRequired: "Microphone blocked by file mode", secureContextText: "Do not open index.html by double-clicking it. Launch the app through the local address to enable the microphone, recognition and offline mode.", openServerVersion: "Open working version", secureMicStatus: "The app needs a secure launch", secureMicStatusSub: "Open the working version at http://localhost:4174 — local files do not give the app full microphone access.",
      cancelMicRequest: "Cancel request", micRequestCancelled: "Microphone request cancelled", micRequestCancelledSub: "Tap the microphone when you are ready to recite.", micRequestTimeout: "The browser did not answer the microphone request", micRequestTimeoutSub: "Check microphone permission for allimquran.com and tap again.",
      recitationMode: "Recitation mode", readIntro: "Tap a word to see its meaning and grammar.", verifiedSource: "Verified source", baqarah: "Al-Baqarah",
      modeRead: "Read", modeListen: "Audio", modeFocus: "Focus", verseMeaning: "This is the Book about which there is no doubt, a guidance for those conscious of Allah.",
      micReady: "Microphone ready", micDisclosure: "We check word sequence, not tajweed. Audio is not stored permanently.", startListening: "Start reciting", stopListening: "Stop", selectedPassage: "Selected passage", matchedWords: "matched", wordAnalysis: "Word analysis",
      selectSurah: "Select surah", selectAyah: "Select verse", nextAyah: "Next verse", nextSurah: "Next surah", corpusEnd: "End of the Qur’an", recognizedText: "Recognized text", browserRecognition: "Browser speech recognition", enhancedRecognition: "Compatible mode · up to 5 alternatives", waitingSpeech: "Begin reciting the selected verse…", comparisonDisclaimer: "Matching ignores diacritics and does not replace review by a qualified teacher.",
      openQuranSearch: "Open all surahs and search the Qur’an", quranCatalogShort: "114 surahs", completeQuran: "THE COMPLETE QUR’AN", findSurahAyah: "Find a surah or verse", quranSearchPlaceholder: "Surah name, 2:255 or page 42", searchExamples: "Search examples", allSurahs: "All 114 surahs", searchLoading: "Loading the Qur’an catalogue…", searchNoResults: "No results. Enter a name, surah number or a reference such as 2:255.", searchDirectVerse: "Go to verse", searchMushafPage: "Open mushaf page", surahVerses: "verses", pagesLabel: "pp.", verseLoading: "Opening the selected verse…", verseUnavailable: "The verse could not be loaded. Check your connection and try again.", glossPending: "Word gloss under review",
      readingSummary: "Reading summary", summaryIdle: "It will appear after recitation begins.", summaryLive: "Updates as speech is recognized.", summaryFinal: "Review the marked words and repeat the verse if needed.", summaryComplete: "Every word in the verse was matched in order.", summaryMatched: "matched", summaryReview: "review", summaryExtra: "unmatched",
      saveVerse: "Save verse", saveVerseText: "Return to it later", removeSaved: "Remove from saved", addToReview: "Add to review", addToReviewText: "Include in the hifz queue", removeFromReview: "Remove from review", focusStudio: "Focus studio", focusStudioText: "Mushaf and recitation only", leaveFocus: "Leave focus",
      requestingMic: "Requesting microphone access…", requestingMicSub: "Confirm access in the browser prompt. Audio is not saved.", listeningNow: "Listening to your recitation…", listeningSub: "Recite naturally. Press Stop when you are finished.", recognitionStopped: "Recognition stopped", recognitionStoppedSub: "Choose another verse or start again.", recognitionUnsupported: "Speech recognition is unavailable in this browser.", recognitionUnsupportedSub: "Open the app in a supported version of Chrome or Safari.", permissionDenied: "Microphone access was not allowed.", permissionDeniedSub: "Allow microphone access for this site in browser settings and try again.", noSpeech: "No speech was detected.", noSpeechSub: "Check your microphone and start reciting again.", recognitionNetwork: "The recognition service is unavailable.", recognitionNetworkSub: "Check your internet connection or try again later.", audioCaptureError: "The browser did not receive sound from the microphone.", audioCaptureErrorSub: "Check the selected microphone in site settings and try again.", recognitionCompatibility: "Incompatible browser hints were disabled.", recognitionCompatibilitySub: "Start again — the compatible baseline mode is now active.", recognitionError: "The recitation could not be recognized.", recognitionErrorSub: "Try again or use another supported browser.", recognitionComplete: "Verse fully recognized", recognitionCompleteSub: "Every word in the selected verse was matched in sequence.", detailedAnalysisPending: "Verified detailed morphology for this word has not been added yet.",
      quranRecording: "Quran AI is listening…", quranRecordingSub: "Recite naturally: checking starts automatically after a natural pause. Audio is deleted after processing.", quranProcessing: "Quran AI is processing…", quranProcessingSub: "Comparing the transcript with the selected verse.", quranRecognition: "Quran AI · Qur’anic speech", quranRecognitionError: "The Quran AI service is temporarily unavailable.", quranRecognitionErrorSub: "Try again in a few seconds or select browser recognition.", systemAudioTitle: "Verse voice playback", systemAudioDisclosure: "System Arabic voice for listening to the text; this is not a professional reciter recording.", playAudio: "Listen", pauseAudio: "Pause", resumeAudio: "Resume", stopAudio: "Stop", audioPlaying: "Voice playback started.", audioStopped: "Voice playback stopped.",
      meaning: "Meaning", root: "Root", grammar: "Grammar", openFullAnalysis: "Open full analysis", wordTab: "Word", aiMentor: "AI mentor", aiReady: "Ready to help with this verse", onDevice: "On device", aiIntro: "Choose a task and I will connect recitation, memorization and word analysis for the selected verse.", aiMemory: "How can I memorize it?", aiWord: "Explain the word", aiReview: "What should I review?", aiDisclosure: "Contextual guidance is generated locally and does not replace a teacher or tafsir.", aiVerseReady: "{reference} is selected. Start reciting and I will match the words and suggest the next step.", aiMemoryAdvice: "{reference} has {words} words. Split it into {parts} meaning blocks, listen to each one and repeat without the text.", aiWordAdvice: "{word} — {meaning}. Root: {root}. {grammar}", aiReviewIdle: "Recite {reference} once first. After recognition, I will show which words to review.", aiReviewAdvice: "Current attempt: {matched} matched, {review} to review, {extra} unmatched.", aiCompleteAdvice: "All words in {reference} were matched. Repeat the verse without the text, then move on.",
      memoryMode: "Memory practice", memorizeIntro: "A correctly recited word opens. If it does not match, its card stays closed.", promptLabel: "Verse opening",
      reviewQueue: "Review queue", reviewQueueText: "Verses you add or that are flagged after recitation", savedVerses: "Saved verses", savedVersesText: "Your local collection without an account", emptyReview: "Empty for now. Add a verse after recitation.", emptySaved: "No saved verses yet.",
      revealOne: "Reveal one word", recalled: "I recalled it", startAgain: "Start again", memoryStart: "Start reciting from memory", memoryStop: "Stop check", memoryHint: "I need a hint", memoryHeard: "Recognized", memoryWaiting: "Recognized words will appear here…", memoryMicReady: "Microphone ready to check", memoryMicReadySub: "Recite from the beginning or continue at the first closed card.", memoryRequesting: "Requesting microphone access…", memoryRequestingSub: "Confirm access in the browser. Audio is not stored.", memoryListening: "Listening to your recitation…", memoryListeningSub: "Correct words open strictly in sequence.", memoryWordCorrect: "Correct — the word is open", memoryWordCorrectSub: "Continue with the next closed card.", memoryWordRetry: "The word did not match", memoryWordRetrySub: "The card stays closed. Repeat the word.", memoryPaused: "Check stopped", memoryPausedSub: "Press the button and continue at the first closed card.", memoryComplete: "Verse recited correctly", memoryCompleteSub: "All hidden words were recognized in sequence.", memoryCompleteWithHint: "Verse completed with a hint", memoryCompleteWithHintSub: "Repeat without hints to reinforce it.", memoryUnsupported: "Voice checking is unavailable in this browser", memoryUnsupportedSub: "Use Quran AI or supported browser recognition.", memoryNoSpeech: "No words were recognized", memoryNoSpeechSub: "Check the microphone and repeat from the first closed card.", memoryPermissionDenied: "Microphone access is blocked", memoryPermissionDeniedSub: "Allow microphone access for allimquran.com in browser settings.", memoryProcessing: "Checking recitation…", memoryProcessingSub: "Matching the recognized words to the verse continuation.", memoryHintOpened: "Hint opened. Repeat the verse without hints to reinforce it.",
      quranicArabic: "Quranic Arabic", learnIntro: "Quranic grammar, Modern Standard Arabic and spoken practice stay clearly separated.", verseMap: "Verse map", tapWord: "Tap a word",
      threeTracks: "Three learning tracks", trackQuran: "Quranic language", trackQuranText: "Vocabulary, roots, morphology and syntax.", trackFusha: "Fus’ha", trackFushaText: "Modern Standard Arabic speech and writing.", trackHijazi: "Hijazi", trackHijaziText: "Everyday speech of Madinah, Makkah and Jeddah.",
      yourJourney: "Your journey", progressIntro: "Only real results from your actions in the app will appear here.", sessions: "Sessions", storedLocally: "Stored locally",
      wordsReviewed: "Words reviewed", fromYourActions: "From your actions", hintsUsed: "Hints", notAScore: "A guide, not a score",
      noInventedStats: "No invented statistics", noInventedStatsText: "Complete a recitation or memory practice and this screen will update.", beginSession: "Begin session",
      realActivity: "Real activity", lastFiveWeeks: "Last five weeks", localOnly: "On this device", lessActivity: "Less", moreActivity: "More",
      personalization: "Personalization", settingsIntro: "The interface adapts to your language and reading style.", interfaceLanguage: "Interface language", interfaceLanguageText: "English, العربية or Русский", recognitionEngineSetting: "Recitation recognition", browserEngine: "Browser · live", quranEngine: "Quran AI · Qur’anic speech", quranServiceReady: "Quran AI is ready; temporary audio is deleted after processing.", quranServiceUnavailable: "Quran AI is temporarily unavailable; browser recognition is being used.",
      dailyGoalSetting: "Daily goal", dailyGoalSettingText: "Only completed recitations and practices count",
      autoAdvanceSetting: "Advance to the next verse automatically", autoAdvanceSettingText: "After a fully correct recitation, the app continues automatically", autoAdvanceTitle: "Auto-advance is on", autoAdvanceReadCountdown: "The next verse opens in {seconds} sec.", autoAdvanceMemoryCountdown: "Hifz continues with the next verse in {seconds} sec.", autoAdvanceCancel: "Cancel", autoAdvanceEnabled: "Auto-advance enabled.", autoAdvanceDisabled: "Auto-advance disabled.", autoAdvanceCancelled: "Auto-advance to the next verse was cancelled.",
      arabicSize: "Arabic text size", arabicSizeText: "Updates instantly on the reading screen", showMeaning: "Show meaning translation", showMeaningText: "Hide it for memorization practice",
      localPrivacy: "Local privacy", localPrivacyText: "Progress stays on the device; Quran AI uses only the selected local server", enabled: "Enabled", clearProgress: "Clear local progress",
      dataSources: "Data sources", verifiedDemo: "Verified corpus", sourceText: "All 114 surahs and 604 mushaf pages are loaded on demand from the Quran Foundation Content API. Detailed local morphology is currently available for selected verses and is expanded with reviewed lexical data.", understood: "Understood",
      smartSession: "Smart session", guideTitle: "One path instead of many screens", guideText: "Recite the selected verse, get transparent word matching, review what was difficult and understand the meaning — all in one context.", guideRead: "Recite", guideReadText: "The microphone marks recognized words and words to repeat.", guideReview: "Reinforce", guideReviewText: "A difficult verse enters your local review queue.", guideUnderstand: "Understand", guideUnderstandText: "Word analysis stays beside the text instead of in another app.",
      audioUnavailable: "System voice playback is unavailable in this browser.", wordRevealed: "The next word was revealed.", allWordsVisible: "All words are already visible.", memorySaved: "Attempt saved on this device.",
      memoryReset: "Memory practice restarted.", progressCleared: "Local progress cleared.", focusMode: "Translation hidden for focus.", listenMode: "Audio mode enabled.",
      dataPresentTitle: "Local progress updated", dataPresentText: "The figures above reflect actions in this prototype only.", confirmClear: "Clear the prototype’s local progress?", verseSaved: "Verse saved on this device.", verseUnsaved: "Verse removed from saved.", reviewAdded: "Verse added to the review queue.", reviewRemoved: "Verse removed from the review queue."
    },
    ar: {
      skip: "الانتقال إلى المحتوى", prototype: "رفيق · نموذج أولي", workingPrototype: "نموذج أولي عملي",
      mainNav: "التنقل الرئيسي", mobileNav: "التنقل على الهاتف", changeLanguage: "تغيير اللغة", lessonSteps: "مراحل الدرس", toggleTranslation: "إظهار الترجمة أو إخفاؤها", audioDemo: "تشغيل نص الآية المختارة بالصوت العربي للنظام", displayMode: "وضع العرض", ayahLabel: "سورة البقرة، الآية ٢", ayahNumberLabel: "الآية ٢", close: "إغلاق", openGuide: "كيفية عمل التطبيق", todayReality: "المؤشرات الفعلية لليوم", verseActions: "إجراءات سريعة للآية", activityLabel: "النشاط خلال الأسابيع الخمسة الأخيرة", assistantTabs: "مساعد التلاوة",
      navToday: "اليوم", navRead: "التلاوة", navMemorize: "الحفظ", navLearn: "التعلّم", navProgress: "التقدّم", navAcademy: "الأكاديمية", navSettings: "الإعدادات",
      todayTitle: "اليوم", readTitle: "اقرأ بالسرعة المناسبة لك", memorizeTitle: "سمّع غيبًا كلمةً كلمة", learnTitle: "افهم بناء الآية", progressTitle: "يبدأ التقدّم مع جلستك الأولى", settingsTitle: "إعدادات التعلّم",
      localMode: "على الجهاز", greeting: "السلام عليكم", foundationTag: "دعاءٌ صار رسالتنا", duaTranslation: "دعاءٌ بالعلم بالكتاب وفهمه.", heroTitle: "تعلّم الكتاب. افهمه. واحمله في قلبك.", heroText: "يقوم أساس المنصة على دعاء رسول الله ﷺ لعبد الله بن عباس رضي الله عنهما.", duaAttribution: "دعاء النبي ﷺ لابن عباس رضي الله عنهما", bukhariReference: "صحيح البخاري · ٧٥",
      continueLesson: "متابعة الدرس", quickTest: "اختبار سريع", todayPlan: "خطة اليوم", oneFocusedSession: "جلسة واحدة مركّزة", minutesShort: "دقيقة",
      dailyGoal: "هدف اليوم", sessionsShort: "جلسة", currentStreak: "السلسلة الحالية", daysShort: "يوم", savedAndReview: "محفوظ · للمراجعة",
      readAloud: "اقرأ بصوت مسموع", readAloudText: "البقرة · ٢:٢", recall: "استرجع من دون نص", recallText: "كلمات مخفية · ٣ دقائق", understandWords: "حلّل الكلمات", understandWordsText: "الجذور · الصيغة · النحو",
      privacyFirst: "الخصوصية افتراضيًا", privacyText: "يبقى التقدّم على الجهاز. يستخدم Quran AI مقطعًا صوتيًا مؤقتًا للتعرّف فقط ثم يحذفه بعد المعالجة.",
      secureContextRequired: "حُجب الميكروفون بسبب فتح الملف مباشرة", secureContextText: "لا تفتح index.html بالنقر المزدوج. شغّل التطبيق عبر العنوان المحلي لتفعيل الميكروفون والتعرّف والعمل دون اتصال.", openServerVersion: "فتح النسخة العاملة", secureMicStatus: "يحتاج التطبيق إلى تشغيل آمن", secureMicStatusSub: "افتح النسخة العاملة عبر http://localhost:4174 لأن فتح الملفات مباشرة لا يمنح التطبيق وصولًا كاملًا إلى الميكروفون.",
      cancelMicRequest: "إلغاء الطلب", micRequestCancelled: "أُلغي طلب الميكروفون", micRequestCancelledSub: "اضغط الميكروفون عندما تكون مستعدًا للتلاوة.", micRequestTimeout: "لم يستجب المتصفح لطلب الميكروفون", micRequestTimeoutSub: "تحقق من إذن الميكروفون لموقع allimquran.com ثم اضغط مرة أخرى.",
      recitationMode: "وضع التلاوة", readIntro: "اضغط على كلمة لعرض معناها وتحليلها.", verifiedSource: "مصدر موثّق", baqarah: "سورة البقرة",
      modeRead: "قراءة", modeListen: "الصوت", modeFocus: "تركيز", verseMeaning: "ذلك الكتاب لا ريب فيه هدى للمتقين.",
      micReady: "الميكروفون جاهز", micDisclosure: "نقارن تسلسل الكلمات ولا نفحص التجويد. لا يُحفظ الصوت بصورة دائمة.", startListening: "ابدأ التلاوة", stopListening: "إيقاف", selectedPassage: "المقطع المختار", matchedWords: "مطابق", wordAnalysis: "تحليل الكلمة",
      selectSurah: "اختر السورة", selectAyah: "اختر الآية", nextAyah: "الآية التالية", nextSurah: "السورة التالية", corpusEnd: "نهاية القرآن", recognizedText: "النص المتعرّف عليه", browserRecognition: "تعرّف المتصفح على الكلام", enhancedRecognition: "وضع متوافق · حتى ٥ بدائل", waitingSpeech: "ابدأ تلاوة الآية المختارة…", comparisonDisclaimer: "تُجرى المطابقة من دون الحركات ولا تغني عن المراجعة مع معلّم مؤهل.",
      openQuranSearch: "فتح جميع السور والبحث في القرآن", quranCatalogShort: "١١٤ سورة", completeQuran: "القرآن كاملًا", findSurahAyah: "ابحث عن سورة أو آية", quranSearchPlaceholder: "اسم السورة أو ٢:٢٥٥ أو الصفحة ٤٢", searchExamples: "أمثلة البحث", allSurahs: "جميع السور الـ١١٤", searchLoading: "جارٍ تحميل فهرس القرآن…", searchNoResults: "لم نعثر على نتيجة. اكتب اسم السورة أو رقمها أو مرجعًا مثل ٢:٢٥٥.", searchDirectVerse: "الانتقال إلى الآية", searchMushafPage: "فتح صفحة المصحف", surahVerses: "آية", pagesLabel: "ص", verseLoading: "جارٍ فتح الآية المختارة…", verseUnavailable: "تعذّر تحميل الآية. تحقق من الاتصال وحاول مرة أخرى.", glossPending: "المعنى اللفظي قيد المراجعة",
      readingSummary: "ملخص التلاوة", summaryIdle: "سيظهر بعد بدء التلاوة.", summaryLive: "يتحدّث مع التعرّف على الكلام.", summaryFinal: "راجع الكلمات المعلّمة وكرر الآية عند الحاجة.", summaryComplete: "تمت مطابقة جميع كلمات الآية بالترتيب.", summaryMatched: "مطابق", summaryReview: "للمراجعة", summaryExtra: "غير مطابق",
      saveVerse: "حفظ الآية", saveVerseText: "العودة إليها لاحقًا", removeSaved: "إزالة من المحفوظات", addToReview: "إضافة إلى المراجعة", addToReviewText: "إدراجها في قائمة الحفظ", removeFromReview: "إزالة من المراجعة", focusStudio: "استوديو التركيز", focusStudioText: "المصحف والتلاوة فقط", leaveFocus: "الخروج من التركيز",
      requestingMic: "جارٍ طلب الوصول إلى الميكروفون…", requestingMicSub: "أكّد الإذن في نافذة المتصفح. لا يُحفظ الصوت.", listeningNow: "أستمع إلى تلاوتك…", listeningSub: "اقرأ بصورة طبيعية واضغط على «إيقاف» عند الانتهاء.", recognitionStopped: "توقّف التعرّف", recognitionStoppedSub: "يمكنك اختيار آية أخرى أو البدء من جديد.", recognitionUnsupported: "التعرّف على الكلام غير متاح في هذا المتصفح.", recognitionUnsupportedSub: "افتح التطبيق في إصدار مدعوم من Chrome أو Safari.", permissionDenied: "لم يُسمح بالوصول إلى الميكروفون.", permissionDeniedSub: "اسمح للميكروفون من إعدادات المتصفح ثم حاول مرة أخرى.", noSpeech: "لم يُكتشف كلام.", noSpeechSub: "تحقق من الميكروفون وابدأ التلاوة مرة أخرى.", recognitionNetwork: "خدمة التعرّف غير متاحة.", recognitionNetworkSub: "تحقق من الاتصال بالإنترنت أو حاول لاحقًا.", audioCaptureError: "لم يستقبل المتصفح صوتًا من الميكروفون.", audioCaptureErrorSub: "تحقق من الميكروفون المحدد في إعدادات الموقع ثم حاول مرة أخرى.", recognitionCompatibility: "عُطّلت تلميحات المتصفح غير المتوافقة.", recognitionCompatibilitySub: "ابدأ من جديد، وسيُستخدم الآن الوضع الأساسي المتوافق.", recognitionError: "تعذّر التعرّف على التلاوة.", recognitionErrorSub: "حاول مرة أخرى أو استخدم متصفحًا مدعومًا.", recognitionComplete: "تم التعرّف على الآية كاملة", recognitionCompleteSub: "تمت مطابقة جميع كلمات الآية المختارة بالترتيب.", detailedAnalysisPending: "لم يُضف بعد التحليل الصرفي التفصيلي الموثّق لهذه الكلمة.",
      quranRecording: "يستمع Quran AI إلى التلاوة…", quranRecordingSub: "اقرأ بطبيعتك؛ يبدأ التدقيق تلقائيًا بعد الوقفة الطبيعية، ويُحذف الصوت بعد المعالجة.", quranProcessing: "يعالج Quran AI التلاوة…", quranProcessingSub: "نقارن النص المتعرّف عليه بالآية المختارة.", quranRecognition: "Quran AI · الكلام القرآني", quranRecognitionError: "خدمة Quran AI غير متاحة مؤقتًا.", quranRecognitionErrorSub: "حاول بعد ثوانٍ أو اختر تعرّف المتصفح.", systemAudioTitle: "تشغيل صوت الآية", systemAudioDisclosure: "صوت عربي من النظام للاستماع إلى النص، وليس تسجيلًا احترافيًا لقارئ.", playAudio: "استمع", pauseAudio: "إيقاف مؤقت", resumeAudio: "متابعة", stopAudio: "إيقاف", audioPlaying: "بدأ تشغيل الصوت.", audioStopped: "توقّف تشغيل الصوت.",
      meaning: "المعنى", root: "الجذر", grammar: "التحليل", openFullAnalysis: "افتح التحليل الكامل", wordTab: "الكلمة", aiMentor: "المرشد الذكي", aiReady: "جاهز لمساعدتك في هذه الآية", onDevice: "على الجهاز", aiIntro: "اختر مهمة لأربط بين التلاوة والحفظ وتحليل كلمات الآية المختارة.", aiMemory: "كيف أحفظها؟", aiWord: "اشرح الكلمة", aiReview: "ماذا أراجع؟", aiDisclosure: "تُنشأ الإرشادات السياقية محليًا ولا تغني عن المعلّم أو التفسير.", aiVerseReady: "اخترت {reference}. ابدأ التلاوة لأطابق الكلمات وأقترح الخطوة التالية.", aiMemoryAdvice: "تتكون {reference} من {words} كلمات. قسّم الآية إلى {parts} مقاطع معنوية، واستمع إلى كل مقطع ثم كرره دون نص.", aiWordAdvice: "{word} — {meaning}. الجذر: {root}. {grammar}", aiReviewIdle: "اقرأ {reference} مرة أولًا، وبعد التعرّف سأبيّن الكلمات التي تحتاج إلى مراجعة.", aiReviewAdvice: "المحاولة الحالية: {matched} مطابق، و{review} للمراجعة، و{extra} غير مطابق.", aiCompleteAdvice: "تمت مطابقة جميع كلمات {reference}. كرر الآية دون نص ثم انتقل إلى التالية.",
      memoryMode: "تدريب الحفظ", memorizeIntro: "تُفتح الكلمة عند نطقها صحيحة، وإذا لم تتطابق تبقى البطاقة مغلقة.", promptLabel: "بداية الآية",
      reviewQueue: "قائمة المراجعة", reviewQueueText: "آيات أضفتها أو تم تعليمها بعد التلاوة", savedVerses: "الآيات المحفوظة", savedVersesText: "مجموعتك المحلية من دون حساب", emptyReview: "القائمة فارغة. أضف آية بعد التلاوة.", emptySaved: "لا توجد آيات محفوظة بعد.",
      revealOne: "اكشف كلمة", recalled: "تذكّرت", startAgain: "ابدأ من جديد", memoryStart: "ابدأ التسميع غيبًا", memoryStop: "أوقف التحقق", memoryHint: "أحتاج إلى تلميح", memoryHeard: "النص المتعرّف عليه", memoryWaiting: "ستظهر الكلمات المسموعة هنا…", memoryMicReady: "الميكروفون جاهز للتحقق", memoryMicReadySub: "ابدأ من أول الآية أو تابع من أول بطاقة مغلقة.", memoryRequesting: "جارٍ طلب إذن الميكروفون…", memoryRequestingSub: "أكّد الإذن في المتصفح. لا يُحفظ الصوت.", memoryListening: "أستمع إلى تسميعك…", memoryListeningSub: "تُفتح الكلمات الصحيحة بالترتيب فقط.", memoryWordCorrect: "صحيح — فُتحت الكلمة", memoryWordCorrectSub: "تابع القراءة من البطاقة المغلقة التالية.", memoryWordRetry: "لم تتطابق الكلمة", memoryWordRetrySub: "تبقى البطاقة مغلقة. كرر الكلمة مرة أخرى.", memoryPaused: "توقّف التحقق", memoryPausedSub: "اضغط الزر وتابع من أول بطاقة مغلقة.", memoryComplete: "سُمّعت الآية صحيحة", memoryCompleteSub: "تم التعرّف على جميع الكلمات المخفية بالترتيب.", memoryCompleteWithHint: "اكتملت الآية مع تلميح", memoryCompleteWithHintSub: "كررها من دون تلميحات لتثبيت الحفظ.", memoryUnsupported: "التحقق الصوتي غير متاح في هذا المتصفح", memoryUnsupportedSub: "استخدم Quran AI أو تعرّفًا مدعومًا في المتصفح.", memoryNoSpeech: "لم تُعرف الكلمات", memoryNoSpeechSub: "تحقق من الميكروفون وكرر من أول بطاقة مغلقة.", memoryPermissionDenied: "الوصول إلى الميكروفون محظور", memoryPermissionDeniedSub: "اسمح بالميكروفون لموقع allimquran.com من إعدادات المتصفح.", memoryProcessing: "أتحقق من التلاوة…", memoryProcessingSub: "أطابق الكلمات المسموعة مع تتمة الآية.", memoryHintOpened: "فُتح التلميح. كرر الآية من دون تلميحات لتثبيت الحفظ.",
      quranicArabic: "العربية القرآنية", learnIntro: "يُعرض النحو القرآني والفصحى والتدرّب على المحادثة في مسارات منفصلة.", verseMap: "خريطة الآية", tapWord: "اضغط على كلمة",
      threeTracks: "ثلاثة مسارات للتعلّم", trackQuran: "لغة القرآن", trackQuranText: "المفردات والجذور والصرف والنحو.", trackFusha: "الفصحى", trackFushaText: "الحديث والكتابة بالعربية الفصحى المعاصرة.", trackHijazi: "اللهجة الحجازية", trackHijaziText: "الحديث اليومي في المدينة ومكة وجدة.",
      yourJourney: "رحلتك", progressIntro: "لن تظهر هنا إلا النتائج الفعلية لأعمالك داخل التطبيق.", sessions: "الجلسات", storedLocally: "محفوظة محليًا",
      wordsReviewed: "الكلمات المراجعة", fromYourActions: "من أعمالك", hintsUsed: "التلميحات", notAScore: "مؤشر وليس درجة",
      noInventedStats: "لا إحصاءات مختلقة", noInventedStatsText: "أكمل التلاوة أو تدريب الحفظ لتحديث هذه الشاشة.", beginSession: "ابدأ جلسة",
      realActivity: "النشاط الفعلي", lastFiveWeeks: "الأسابيع الخمسة الأخيرة", localOnly: "على هذا الجهاز", lessActivity: "أقل", moreActivity: "أكثر",
      personalization: "التخصيص", settingsIntro: "تتكيّف الواجهة مع لغتك وطريقتك في القراءة.", interfaceLanguage: "لغة الواجهة", interfaceLanguageText: "English أو العربية أو Русский", recognitionEngineSetting: "التعرّف على التلاوة", browserEngine: "المتصفح · مباشر", quranEngine: "Quran AI · الكلام القرآني", quranServiceReady: "Quran AI جاهز، ويُحذف الصوت المؤقت بعد المعالجة.", quranServiceUnavailable: "خدمة Quran AI غير متاحة مؤقتًا، ويُستخدم تعرّف المتصفح.",
      dailyGoalSetting: "الهدف اليومي", dailyGoalSettingText: "تُحتسب التلاوات والتدريبات المكتملة فقط",
      autoAdvanceSetting: "الانتقال تلقائيًا إلى الآية التالية", autoAdvanceSettingText: "بعد تلاوة الآية كاملةً بصورة صحيحة، ينتقل التطبيق تلقائيًا", autoAdvanceTitle: "الانتقال التلقائي مفعّل", autoAdvanceReadCountdown: "ستُفتح الآية التالية خلال {seconds} ث.", autoAdvanceMemoryCountdown: "سيستمر الحفظ بالآية التالية خلال {seconds} ث.", autoAdvanceCancel: "إلغاء", autoAdvanceEnabled: "فُعّل الانتقال التلقائي.", autoAdvanceDisabled: "أُوقف الانتقال التلقائي.", autoAdvanceCancelled: "أُلغي الانتقال التلقائي إلى الآية التالية.",
      arabicSize: "حجم النص العربي", arabicSizeText: "يتغيّر مباشرة في شاشة التلاوة", showMeaning: "إظهار الترجمة التوضيحية", showMeaningText: "يمكن إخفاؤها أثناء الحفظ",
      localPrivacy: "خصوصية محلية", localPrivacyText: "يبقى التقدّم على الجهاز، ويستخدم Quran AI الخادم المحلي المختار فقط", enabled: "مفعّلة", clearProgress: "مسح التقدّم المحلي",
      dataSources: "مصادر البيانات", verifiedDemo: "متن موثّق", sourceText: "تُحمّل سور القرآن الـ١١٤ وصفحات المصحف الـ٦٠٤ عند الطلب من Quran Foundation Content API. والتحليل الصرفي المحلي المفصل متاح حاليًا لآيات مختارة ويُستكمل ببيانات لغوية مراجعة.", understood: "فهمت",
      smartSession: "جلسة ذكية", guideTitle: "مسار واحد بدلًا من شاشات كثيرة", guideText: "اتل الآية المختارة، واحصل على مطابقة واضحة للكلمات، وراجع الصعب وافهم المعنى ضمن سياق واحد.", guideRead: "اتل", guideReadText: "يبيّن الميكروفون الكلمات المتعرّف عليها والكلمات التي تحتاج إلى تكرار.", guideReview: "ثبّت", guideReviewText: "تنتقل الآية الصعبة إلى قائمة المراجعة المحلية.", guideUnderstand: "افهم", guideUnderstandText: "يبقى تحليل الكلمة بجانب النص بدلًا من تطبيق آخر.",
      audioUnavailable: "تشغيل الصوت بالنظام غير متاح في هذا المتصفح.", wordRevealed: "كُشفت الكلمة التالية.", allWordsVisible: "كل الكلمات ظاهرة بالفعل.", memorySaved: "حُفظت المحاولة على هذا الجهاز.",
      memoryReset: "بدأ تدريب الحفظ من جديد.", progressCleared: "مُسح التقدّم المحلي.", focusMode: "أُخفيت الترجمة لتعزيز التركيز.", listenMode: "فُعّل وضع الصوت.",
      dataPresentTitle: "تحدّث التقدّم المحلي", dataPresentText: "تعكس الأرقام أعلاه الأعمال المنفّذة في هذا النموذج فقط.", confirmClear: "هل تريد مسح التقدّم المحلي للنموذج؟", verseSaved: "حُفظت الآية على هذا الجهاز.", verseUnsaved: "أُزيلت الآية من المحفوظات.", reviewAdded: "أُضيفت الآية إلى قائمة المراجعة.", reviewRemoved: "أُزيلت الآية من قائمة المراجعة."
    }
  };

  Object.assign(translations.ru, {
    teacherAssessmentEyebrow: "УРОВЕНЬ 3 · С ПРЕПОДАВАТЕЛЕМ", teacherAssessmentTitle: "Строгая диагностика чтения", teacherAssessmentLead: "Система строит предварительную карту, а таджвид и интонацию подтверждает преподаватель.", teacherAssessmentBack: "К преподавателю", teacherAssessmentMap: "КАРТА ДЛЯ РАЗБОРА", teacherAssessmentPreliminary: "Предварительный результат", teacherAssessmentNotFinal: "Не итоговая оценка", teacherAssessmentWordOrder: "Порядок слов", teacherAssessmentAutomatic: "Автоматически", teacherAssessmentPronunciation: "Произношение", teacherAssessmentCalibration: "Калибровка", teacherAssessmentTajwid: "Таджвид", teacherAssessmentIntonation: "Интонация и паузы", teacherAssessmentTeacherReview: "Проверка учителя", teacherAssessmentBoundary: "Васл, идгам и реальную манеру чтения нельзя оценивать только по текстовой расшифровке. Итог появится после проверки преподавателем."
  });

  Object.assign(translations.ru, {
    translationLoading: "Загружаю проверенный смысловой перевод…",
    translationUnavailable: "Проверенный смысловой перевод временно недоступен.",
    translationBy: "Смысловой перевод · {author}",
    quranFoundationAttribution: "Данные Корана предоставлены Quran Foundation."
  });
  Object.assign(translations.en, {
    translationLoading: "Loading the reviewed meaning translation…",
    translationUnavailable: "The reviewed meaning translation is temporarily unavailable.",
    translationBy: "Meaning translation · {author}",
    quranFoundationAttribution: "Quran data provided by Quran Foundation."
  });
  Object.assign(translations.ar, {
    translationLoading: "جارٍ تحميل ترجمة المعاني المراجعة…",
    translationUnavailable: "ترجمة المعاني المراجعة غير متاحة مؤقتًا.",
    translationBy: "ترجمة المعاني · {author}",
    quranFoundationAttribution: "بيانات القرآن مقدمة من Quran Foundation."
  });
  Object.assign(translations.en, {
    teacherAssessmentEyebrow: "LEVEL 3 · WITH A TEACHER", teacherAssessmentTitle: "Strict recitation diagnostic", teacherAssessmentLead: "The system prepares a preliminary map; tajwid and intonation are confirmed by the teacher.", teacherAssessmentBack: "Back to the teacher", teacherAssessmentMap: "REVIEW MAP", teacherAssessmentPreliminary: "Preliminary result", teacherAssessmentNotFinal: "Not a final grade", teacherAssessmentWordOrder: "Word order", teacherAssessmentAutomatic: "Automatic", teacherAssessmentPronunciation: "Pronunciation", teacherAssessmentCalibration: "Calibration", teacherAssessmentTajwid: "Tajwid", teacherAssessmentIntonation: "Intonation and pauses", teacherAssessmentTeacherReview: "Teacher review", teacherAssessmentBoundary: "Wasl, idgham and real recitation style cannot be judged from a text transcript alone. The final result appears after teacher review."
  });
  Object.assign(translations.ar, {
    teacherAssessmentEyebrow: "المستوى الثالث · مع معلّم", teacherAssessmentTitle: "تشخيص دقيق للتلاوة", teacherAssessmentLead: "يعدّ النظام خريطة أولية، ويعتمد المعلّم التجويد والنغم.", teacherAssessmentBack: "العودة إلى المعلّم", teacherAssessmentMap: "خريطة للمراجعة", teacherAssessmentPreliminary: "نتيجة أولية", teacherAssessmentNotFinal: "ليست درجة نهائية", teacherAssessmentWordOrder: "ترتيب الكلمات", teacherAssessmentAutomatic: "آلي", teacherAssessmentPronunciation: "النطق", teacherAssessmentCalibration: "قيد المعايرة", teacherAssessmentTajwid: "التجويد", teacherAssessmentIntonation: "النغم والوقفات", teacherAssessmentTeacherReview: "مراجعة المعلّم", teacherAssessmentBoundary: "لا يمكن تقييم الوصل والإدغام وأداء التلاوة من النص المفرّغ وحده. تظهر النتيجة النهائية بعد مراجعة المعلّم."
  });

  Object.assign(translations.ru, {
    navTafsir: "Тафсир", tafsirTitle: "Увидьте связи между аятами", connectAyat: "Связать аят с аятами", connectAyatText: "Адва аль-Баян · проверенный источник",
    quranByQuran: "Коран разъясняет Коран", tafsirIntro: "Краткие редакционные карточки по «Адва аль-Баян» ведут к полному арабскому источнику.", openBook: "Открыть книгу", sourceEdition: "Источник толкования",
    insideApp: "Сразу в приложении", arabicAndTranslation: "Тафсир на арабском и перевод", editorialSummary: "Проверенное резюме", arabicExplanation: "البيان بالعربية", translationLabel: "Перевод на русский",
    tafsirBookDescription: "Метод шейха Мухаммада аль-Амина аш-Шанкыти: сначала искать разъяснение аята в самом Коране.", tafsirPickerLabel: "Выбор аята для тафсира", selectedForTafsir: "Выбранный аят", tafsirOfAyah: "Тафсир аята",
    conciseMeaning: "Краткое разъяснение", methodInThisAyah: "Как работает метод", quranConnections: "Связи внутри Корана", versesExplainVerse: "Аяты, разъясняющие выбранный аят", keyTerms: "Ключевые слова", meaningInContext: "Значение в контексте",
    traceableSource: "Проверяемый источник", summaryDisclosure: "Это редакционное резюме, а не замена полного текста тафсира.", readOriginalArabic: "Читать арабский оригинал", sourceBoundAi: "ИИ, ограниченный источником", tafsirResearcher: "Исследователь тафсира",
    tafsirAiIntro: "Задайте вопрос о выбранном аяте. Помощник использует только проверенную карточку и прямо скажет, если данных недостаточно.", showConnections: "Покажи связи", explainMethod: "Объясни метод", explainTerms: "Разбери термины", askAboutAyah: "Спросите об аяте",
    tafsirQuestionPlaceholder: "Например: какие аяты раскрывают слово «руководство»?", sendQuestion: "Отправить вопрос", tafsirAiDisclosure: "Не фетва и не самостоятельное толкование. Ответы формируются только из подключённой карточки источника.", authorshipMatters: "Авторство имеет значение",
    authorshipNote: "Шейх аш-Шанкыти довёл труд до суры Аль-Муджадиля. Разделы от Аль-Хашр до Ан-Нас завершил его ученик ‘Атыйя Мухаммад Салим; приложение показывает это у каждого аята.", verifiedCard: "Проверенная карточка", sourceNotIndexed: "Источник открыт · карточка готовится",
    originalAuthorLabel: "Мухаммад аль-Амин аш-Шанкыти · авторский раздел", completionAuthorLabel: "‘Атыйя Мухаммад Салим · продолжение труда", noIndexedSummary: "Для этого аята локальная проверенная карточка ещё не подготовлена. Откройте полный арабский источник — приложение не будет придумывать толкование.",
    noIndexedMethod: "Сохраняется основной принцип труда: разъяснять Коран прежде всего Кораном. Конкретные связи появятся только после редакционной проверки источника.", noConnections: "Проверенные связи для этого аята ещё не внесены.", noTerms: "Проверенный разбор терминов для этого аята ещё не внесён.",
    tafsirAiReady: "Я готов работать с {reference}. Выберите одну из задач или задайте вопрос.", tafsirAnswerConnections: "Связи для {reference}:\n{content}", tafsirAnswerMethod: "Метод для {reference}:\n{content}", tafsirAnswerTerms: "Ключевые термины {reference}:\n{content}", tafsirAnswerSummary: "Краткое разъяснение {reference}:\n{content}",
    tafsirAnswerNoBasis: "В проверенной карточке {reference} нет достаточных данных для этого ответа. Я не стану дополнять тафсир догадкой — уточните вопрос или откройте арабский источник.", tafsirAnswerNoEntry: "Карточка {reference} ещё не проиндексирована. Я могу открыть первоисточник, но не буду выдавать неподтверждённый ответ.", rootShort: "корень"
  });

  Object.assign(translations.en, {
    navTafsir: "Tafsir", tafsirTitle: "See how verses illuminate one another", connectAyat: "Connect verse to verse", connectAyatText: "Adwa al-Bayan · verified source",
    quranByQuran: "The Qur’an explains the Qur’an", tafsirIntro: "Concise editorial cards based on Adwa al-Bayan lead back to the complete Arabic source.", openBook: "Open the book", sourceEdition: "Tafsir source",
    insideApp: "Inside the app", arabicAndTranslation: "Arabic tafsir with translation", editorialSummary: "Verified summary", arabicExplanation: "البيان بالعربية", translationLabel: "English translation",
    tafsirBookDescription: "Shaykh Muhammad al-Amin al-Shinqiti’s method: first seek a verse’s clarification within the Qur’an itself.", tafsirPickerLabel: "Choose a verse for tafsir", selectedForTafsir: "Selected verse", tafsirOfAyah: "Tafsir of the verse",
    conciseMeaning: "Concise explanation", methodInThisAyah: "How the method works", quranConnections: "Connections within the Qur’an", versesExplainVerse: "Verses that clarify the selected verse", keyTerms: "Key terms", meaningInContext: "Meaning in context",
    traceableSource: "Traceable source", summaryDisclosure: "This is an editorial summary, not a replacement for the complete tafsir.", readOriginalArabic: "Read the Arabic original", sourceBoundAi: "Source-bound AI", tafsirResearcher: "Tafsir researcher",
    tafsirAiIntro: "Ask about the selected verse. The assistant uses only the verified card and says plainly when evidence is insufficient.", showConnections: "Show connections", explainMethod: "Explain the method", explainTerms: "Explain terms", askAboutAyah: "Ask about the verse",
    tafsirQuestionPlaceholder: "For example: which verses clarify ‘guidance’?", sendQuestion: "Send question", tafsirAiDisclosure: "Not a fatwa or independent interpretation. Answers come only from the connected source card.", authorshipMatters: "Authorship matters",
    authorshipNote: "Shaykh al-Shinqiti completed the work through Surah al-Mujadilah. From al-Hashr through an-Nas, his student Atiyyah Muhammad Salim completed it; the app labels this for every verse.", verifiedCard: "Verified card", sourceNotIndexed: "Source available · card in preparation",
    originalAuthorLabel: "Muhammad al-Amin al-Shinqiti · original section", completionAuthorLabel: "Atiyyah Muhammad Salim · continuation", noIndexedSummary: "A verified local card for this verse has not yet been prepared. Open the complete Arabic source—the app will not invent an interpretation.",
    noIndexedMethod: "The work’s core principle remains: explain the Qur’an first through the Qur’an. Specific links appear only after editorial source checking.", noConnections: "Verified connections for this verse have not yet been indexed.", noTerms: "A verified term analysis for this verse has not yet been indexed.",
    tafsirAiReady: "I am ready to work with {reference}. Choose a task or ask a question.", tafsirAnswerConnections: "Connections for {reference}:\n{content}", tafsirAnswerMethod: "Method for {reference}:\n{content}", tafsirAnswerTerms: "Key terms in {reference}:\n{content}", tafsirAnswerSummary: "Concise explanation of {reference}:\n{content}",
    tafsirAnswerNoBasis: "The verified card for {reference} does not contain enough evidence for that answer. I will not add a guess to the tafsir—refine the question or open the Arabic source.", tafsirAnswerNoEntry: "The card for {reference} has not been indexed yet. I can point to the primary source, but will not present an unverified answer.", rootShort: "root"
  });

  Object.assign(translations.ar, {
    navTafsir: "التفسير", tafsirTitle: "اكتشف كيف تفسّر الآيات بعضها بعضًا", connectAyat: "اربط الآية بالآيات", connectAyatText: "أضواء البيان · مصدر موثّق",
    quranByQuran: "تفسير القرآن بالقرآن", tafsirIntro: "بطاقات تحريرية موجزة مبنية على أضواء البيان، مع الرجوع إلى المصدر العربي الكامل.", openBook: "فتح الكتاب", sourceEdition: "مصدر التفسير",
    insideApp: "مباشرة داخل التطبيق", arabicAndTranslation: "البيان العربي مع الترجمة", editorialSummary: "ملخص موثّق", arabicExplanation: "البيان بالعربية", translationLabel: "الترجمة الروسية",
    tafsirBookDescription: "منهج الشيخ محمد الأمين الشنقيطي: البحث أولًا عن بيان الآية في القرآن نفسه.", tafsirPickerLabel: "اختيار آية للتفسير", selectedForTafsir: "الآية المختارة", tafsirOfAyah: "تفسير الآية",
    conciseMeaning: "بيان موجز", methodInThisAyah: "كيف يعمل المنهج", quranConnections: "الروابط داخل القرآن", versesExplainVerse: "آيات تبيّن الآية المختارة", keyTerms: "الألفاظ المفتاحية", meaningInContext: "المعنى في السياق",
    traceableSource: "مصدر قابل للتحقق", summaryDisclosure: "هذا ملخص تحريري وليس بديلًا عن نص التفسير كاملًا.", readOriginalArabic: "قراءة النص العربي", sourceBoundAi: "ذكاء مقيد بالمصدر", tafsirResearcher: "باحث التفسير",
    tafsirAiIntro: "اسأل عن الآية المختارة. لا يستخدم المساعد إلا البطاقة الموثقة، ويصرّح إذا لم تكفِ المادة.", showConnections: "أظهر الروابط", explainMethod: "اشرح المنهج", explainTerms: "اشرح الألفاظ", askAboutAyah: "اسأل عن الآية",
    tafsirQuestionPlaceholder: "مثال: ما الآيات التي تبيّن معنى الهدى؟", sendQuestion: "إرسال السؤال", tafsirAiDisclosure: "ليس فتوى ولا تفسيرًا مستقلًا. تُنشأ الإجابات من بطاقة المصدر المرتبطة فقط.", authorshipMatters: "نسبة الكلام إلى قائله مهمة",
    authorshipNote: "أتم الشيخ الشنقيطي الكتاب إلى سورة المجادلة، وأكمل تلميذه عطية محمد سالم التفسير من سورة الحشر إلى سورة الناس؛ ويُظهر التطبيق ذلك عند كل آية.", verifiedCard: "بطاقة موثقة", sourceNotIndexed: "المصدر متاح · البطاقة قيد الإعداد",
    originalAuthorLabel: "محمد الأمين الشنقيطي · قسم المؤلف", completionAuthorLabel: "عطية محمد سالم · تتمة الكتاب", noIndexedSummary: "لم تُعَدّ بعد بطاقة محلية موثقة لهذه الآية. افتح المصدر العربي الكامل؛ لن يخترع التطبيق تفسيرًا.",
    noIndexedMethod: "يبقى أصل المنهج: تفسير القرآن أولًا بالقرآن. ولا تظهر الروابط التفصيلية إلا بعد مراجعتها في المصدر.", noConnections: "لم تُفهرس بعد روابط موثقة لهذه الآية.", noTerms: "لم يُفهرس بعد تحليل موثّق لألفاظ هذه الآية.",
    tafsirAiReady: "أنا مستعد للعمل على {reference}. اختر مهمة أو اكتب سؤالك.", tafsirAnswerConnections: "روابط الآية {reference}:\n{content}", tafsirAnswerMethod: "منهج البيان في {reference}:\n{content}", tafsirAnswerTerms: "الألفاظ المفتاحية في {reference}:\n{content}", tafsirAnswerSummary: "البيان الموجز للآية {reference}:\n{content}",
    tafsirAnswerNoBasis: "لا تحتوي البطاقة الموثقة للآية {reference} مادة كافية لهذا الجواب. لن أضيف إلى التفسير تخمينًا؛ خصّص السؤال أو افتح المصدر العربي.", tafsirAnswerNoEntry: "لم تُفهرس بعد بطاقة الآية {reference}. يمكنني إحالتك إلى المصدر، ولن أقدّم جوابًا غير موثّق.", rootShort: "الجذر"
  });

  Object.assign(translations.ru, {
    soundCuesSetting: "Звуковые сигналы чтения", soundCuesSettingText: "Мягкий сигнал при старте и двойной сигнал при ошибке", soundCuesEnabled: "Звуковые сигналы включены.", soundCuesDisabled: "Звуковые сигналы выключены.",
    strictCorrectionSetting: "Строгая остановка на ошибке", strictCorrectionSettingText: "Следующий аят не откроется, пока отмеченное слово не произнесено правильно", strictCorrectionEnabled: "Строгая проверка включена.", strictCorrectionDisabled: "Строгая проверка выключена.",
    correctionRequired: "Остановились на слове", correctionRequiredSub: "Повторите: {word}. После правильного произнесения чтение продолжится.", correctionResolved: "Слово исправлено", correctionResolvedSub: "Можно продолжать чтение со следующего отмеченного слова.", correctionBlocked: "Сначала исправьте отмеченное слово.",
    correctionStatus: "Нужно исправить слово", correctionStatusSub: "Произнесите отмеченное слово ещё раз. Переход к следующему аяту временно остановлен.",
    recognitionChoiceTitle: "Как проверять чтение", recognitionModeGroup: "Режим проверки чтения", recognitionAuto: "Авто", recognitionAutoText: "Мгновенно, сервер при необходимости", recognitionInstant: "Мгновенно", recognitionInstantText: "Слова открываются во время чтения", recognitionCareful: "Тщательно", recognitionCarefulText: "Строгая проверка Quran AI после остановки", recognitionAutoSummary: "Слова открываются сразу; при сбое браузера Quran AI включится автоматически.", recognitionInstantSummary: "Самый быстрый режим: каждое распознанное слово открывается во время чтения.", recognitionCarefulSummary: "Quran AI проверяет запись целиком и строже сопоставляет каждое слово после нажатия «Остановить».", recognitionAutoEngine: "Авто · мгновенно", recognitionAutoQuranEngine: "Авто · Quran AI", recognitionQuranOnline: "Quran AI готов", recognitionQuranOffline: "Только браузер", recognitionModeChanged: "Режим проверки изменён.", recognitionAutoFallback: "Переключаюсь на Quran AI…", recognitionAutoFallbackSub: "Живое распознавание браузера недоступно; продолжите чтение в тщательном режиме."
  });

  Object.assign(translations.en, {
    soundCuesSetting: "Recitation sound cues", soundCuesSettingText: "A gentle start chime and a double tone for an error", soundCuesEnabled: "Recitation sound cues are on.", soundCuesDisabled: "Recitation sound cues are off.",
    strictCorrectionSetting: "Stop on an error", strictCorrectionSettingText: "The next verse stays locked until the marked word is pronounced correctly", strictCorrectionEnabled: "Strict correction is on.", strictCorrectionDisabled: "Strict correction is off.",
    correctionRequired: "Paused at this word", correctionRequiredSub: "Repeat: {word}. Reading will continue once it is pronounced correctly.", correctionResolved: "Word corrected", correctionResolvedSub: "Continue from the next marked word.", correctionBlocked: "Correct the marked word first.",
    correctionStatus: "A word needs correction", correctionStatusSub: "Say the marked word again. Moving to the next verse is temporarily paused.",
    recognitionChoiceTitle: "How should reading be checked?", recognitionModeGroup: "Recitation checking mode", recognitionAuto: "Auto", recognitionAutoText: "Instant, with server fallback", recognitionInstant: "Instant", recognitionInstantText: "Words open while you recite", recognitionCareful: "Careful", recognitionCarefulText: "Strict Quran AI check after you stop", recognitionAutoSummary: "Words open instantly; Quran AI takes over automatically if browser recognition fails.", recognitionInstantSummary: "Fastest mode: each recognized word opens during recitation.", recognitionCarefulSummary: "Quran AI checks the full recording and matches every word more strictly after you press Stop.", recognitionAutoEngine: "Auto · instant", recognitionAutoQuranEngine: "Auto · Quran AI", recognitionQuranOnline: "Quran AI ready", recognitionQuranOffline: "Browser only", recognitionModeChanged: "Checking mode changed.", recognitionAutoFallback: "Switching to Quran AI…", recognitionAutoFallbackSub: "Live browser recognition is unavailable; continue in careful mode."
  });

  Object.assign(translations.ar, {
    soundCuesSetting: "إشارات صوتية للتلاوة", soundCuesSettingText: "نغمة لطيفة عند البدء ونغمتان قصيرتان عند الخطأ", soundCuesEnabled: "فُعّلت الإشارات الصوتية.", soundCuesDisabled: "أُوقفت الإشارات الصوتية.",
    strictCorrectionSetting: "التوقف الصارم عند الخطأ", strictCorrectionSettingText: "لا تُفتح الآية التالية حتى يُنطق اللفظ المحدد نطقًا صحيحًا", strictCorrectionEnabled: "فُعّل التصحيح الصارم.", strictCorrectionDisabled: "أُوقف التصحيح الصارم.",
    correctionRequired: "توقفت التلاوة عند هذه الكلمة", correctionRequiredSub: "أعِد: {word}. ستستمر التلاوة بعد نطقها بصورة صحيحة.", correctionResolved: "صُححت الكلمة", correctionResolvedSub: "تابع التلاوة من الكلمة التالية المحددة.", correctionBlocked: "صحّح الكلمة المحددة أولًا.",
    correctionStatus: "تحتاج كلمة إلى تصحيح", correctionStatusSub: "أعِد نطق الكلمة المحددة. أُوقف الانتقال إلى الآية التالية مؤقتًا.",
    recognitionChoiceTitle: "كيف تُراجع التلاوة؟", recognitionModeGroup: "وضع مراجعة التلاوة", recognitionAuto: "تلقائي", recognitionAutoText: "فوري مع الرجوع إلى الخادم", recognitionInstant: "فوري", recognitionInstantText: "تظهر الكلمات أثناء التلاوة", recognitionCareful: "تدقيق", recognitionCarefulText: "تدقيق صارم عبر Quran AI بعد الإيقاف", recognitionAutoSummary: "تظهر الكلمات فورًا، وينتقل التطبيق إلى Quran AI تلقائيًا إذا تعذّر تعرف المتصفح.", recognitionInstantSummary: "أسرع وضع: تظهر كل كلمة معروفة أثناء التلاوة.", recognitionCarefulSummary: "يفحص Quran AI التسجيل كاملًا ويطابق كل كلمة بدقة أشد بعد الضغط على إيقاف.", recognitionAutoEngine: "تلقائي · فوري", recognitionAutoQuranEngine: "تلقائي · Quran AI", recognitionQuranOnline: "Quran AI جاهز", recognitionQuranOffline: "المتصفح فقط", recognitionModeChanged: "تغيّر وضع المراجعة.", recognitionAutoFallback: "جارٍ الانتقال إلى Quran AI…", recognitionAutoFallbackSub: "التعرف المباشر في المتصفح غير متاح؛ تابع التلاوة في وضع التدقيق."
  });

  Object.assign(translations.ru, {
    heartEyebrow: "КНИГА ХИФЗА", heartTitle: "Коран в сердце", heartIntro: "Белая страница проявляется правильными повторениями и сохраняется регулярным возвращением.", heartMethod: "МЕТОДИКА",
    heartWeekOne: "Первые 100", heartWeekTwo: "Вторые 100", heartWeekThree: "Финальные 100", heartFoundation: "Сбор аята", heartToday: "Сегодня", heartCurrentStage: "Текущий этап", heartNextReview: "Следующее повторение", heartStrength: "Прочность",
    heartRuleTitle: "Правило 300", heartRule: "Аят считается собранным после 300 полных правильных чтений без подсказки. Темп и дневной план выбирает ученик.", heartStart: "Начать повторение", heartNotStarted: "Начните первое чтение", heartBuilding: "Страница проявляется", heartProtected: "Закреплено на месяц", heartNeedsReview: "Пора вернуться к аяту", heartNotScheduled: "После 300 повторений", heartTodayDone: "Цель на сегодня выполнена", heartPracticeOnly: "Чтение принято как дополнительная практика.", heartCreditRecorded: "Повторение засчитано: {count} из 300.", heartHintNotCounted: "Аят завершён с подсказкой. Для укрепления повторите его без подсказок.", heartFullVerseNeededTitle: "Прочитайте аят с самого начала", heartFullVerseNeededSub: "Продолжение открыто правильно, но для укрепления нужно произнести весь аят целиком.", heartFullVerseRequired: "Продолжение открыто, но повторение не засчитано: прочитайте весь аят с начала.", heartMaintenanceRecorded: "Восстановительное повторение: {count} из 20.", heartMaintenanceComplete: "Страница восстановлена. Следующее возвращение запланировано.", heartDaysLeft: "через {days} дн.", heartDueToday: "сегодня", heartOverdueDays: "просрочено на {days} дн.", heartFoundationComplete: "Основа собрана", heartPracticeScroll: "Тренировка готова — читайте с начала аята."
  });

  Object.assign(translations.en, {
    heartEyebrow: "HIFZ BOOK", heartTitle: "Qur’an in the heart", heartIntro: "A blank page is revealed by accurate repetitions and kept alive by returning regularly.", heartMethod: "METHOD",
    heartWeekOne: "First 100", heartWeekTwo: "Second 100", heartWeekThree: "Final 100", heartFoundation: "Verse collection", heartToday: "Today", heartCurrentStage: "Current stage", heartNextReview: "Next review", heartStrength: "Strength",
    heartRuleTitle: "The 300 rule", heartRule: "A verse is collected after 300 complete accurate recitations without hints. The learner chooses the pace and daily plan.", heartStart: "Start repetition", heartNotStarted: "Begin the first recitation", heartBuilding: "The page is appearing", heartProtected: "Protected for one month", heartNeedsReview: "Time to return to the verse", heartNotScheduled: "After 300 repetitions", heartTodayDone: "Today’s target is complete", heartPracticeOnly: "Recitation logged as additional practice.", heartCreditRecorded: "Repetition counted: {count} of 300.", heartHintNotCounted: "The verse was completed with a hint. Repeat without hints to strengthen it.", heartFullVerseNeededTitle: "Recite from the very beginning", heartFullVerseNeededSub: "The continuation was correct, but strengthening requires the complete verse.", heartFullVerseRequired: "The continuation opened, but the repetition was not counted: recite the full verse from the beginning.", heartMaintenanceRecorded: "Restorative repetition: {count} of 20.", heartMaintenanceComplete: "The page is restored. The next return is scheduled.", heartDaysLeft: "in {days} days", heartDueToday: "today", heartOverdueDays: "overdue by {days} days", heartFoundationComplete: "Foundation complete", heartPracticeScroll: "Practice is ready — recite from the beginning."
  });

  Object.assign(translations.ar, {
    heartEyebrow: "كِتَابُ الحِفْظ", heartTitle: "القرآن في القلب", heartIntro: "تظهر الصفحة البيضاء بالتكرار الصحيح وتبقى حيّة بالمراجعة المنتظمة.", heartMethod: "المنهج",
    heartWeekOne: "المئة الأولى", heartWeekTwo: "المئة الثانية", heartWeekThree: "المئة الأخيرة", heartFoundation: "جمع الآية", heartToday: "اليوم", heartCurrentStage: "المرحلة الحالية", heartNextReview: "المراجعة القادمة", heartStrength: "الثبات",
    heartRuleTitle: "قاعدة ٣٠٠", heartRule: "تُعدّ الآية مكتملة بعد ٣٠٠ تلاوة صحيحة كاملة بلا تلميح، ويختار المتعلّم سرعته وخطته اليومية.", heartStart: "بدء التكرار", heartNotStarted: "ابدأ التلاوة الأولى", heartBuilding: "الصفحة تتجلّى", heartProtected: "مثبّتة لشهر", heartNeedsReview: "حان وقت الرجوع إلى الآية", heartNotScheduled: "بعد ٣٠٠ تكرار", heartTodayDone: "اكتمل هدف اليوم", heartPracticeOnly: "سُجلت التلاوة كتدريب إضافي.", heartCreditRecorded: "احتُسب التكرار: {count} من ٣٠٠.", heartHintNotCounted: "اكتملت الآية مع تلميح. أعدها بلا تلميح لتثبيتها.", heartFullVerseNeededTitle: "اقرأ الآية من أولها", heartFullVerseNeededSub: "صحت بقية الآية، لكن التثبيت يحتاج إلى تلاوتها كاملة.", heartFullVerseRequired: "ظهرت بقية الآية، لكن لم يُحتسب التكرار: اقرأ الآية كاملة من أولها.", heartMaintenanceRecorded: "تكرار الاستعادة: {count} من ٢٠.", heartMaintenanceComplete: "استعادت الصفحة ثباتها، وحُدد موعد المراجعة القادمة.", heartDaysLeft: "بعد {days} يومًا", heartDueToday: "اليوم", heartOverdueDays: "متأخرة {days} يومًا", heartFoundationComplete: "اكتمل التأسيس", heartPracticeScroll: "التدريب جاهز — اقرأ من أول الآية."
  });

  Object.assign(translations.ru, {
    memoryMode: "ХИФЗ · СОБИРАНИЕ КОРАНА", memorizeTitle: "Коран в сердце", memorizeIntro: "Собирайте текущую страницу аят за аятом: 300 правильных повторений проявляют каждый аят, а связное чтение закрепляет всю страницу.",
    heartCurrentPage: "ТЕКУЩАЯ СТРАНИЦА", heartPageLoadingShort: "Определяем страницу…", heartOpenProgress: "Откройте всю страницу и её прогресс", heartOpenPageAction: "Открыть страницу", heartPageLaunchProgress: "Собрано {collected} из {total} аятов · {percent}% повторений", heartPracticeEyebrow: "ТРЕНИРОВКА АЯТА", heartPracticeTitle: "Читайте выбранный аят наизусть", heartPracticeIntro: "Слова открываются только по порядку. Полное правильное чтение без подсказки добавляет одно повторение к правилу 300.", heartVerseCounter: "ПОВТОРЕНИЯ ВЫБРАННОГО АЯТА", heartCountOnlyCorrect: "Засчитывается только полное правильное чтение без подсказки", memoryStopVisible: "Остановить чтение", memoryStoppedSaved: "Чтение остановлено. Текущий прогресс сохранён."
  });

  Object.assign(translations.en, {
    memoryMode: "HIFZ · BUILDING THE QUR’AN", memorizeTitle: "Qur’an in the heart", memorizeIntro: "Build the current page verse by verse: 300 accurate repetitions reveal each verse, then connected recitation secures the whole page.",
    heartCurrentPage: "CURRENT PAGE", heartPageLoadingShort: "Finding the page…", heartOpenProgress: "Open the full page and its progress", heartOpenPageAction: "Open page", heartPageLaunchProgress: "{collected} of {total} verses collected · {percent}% repetitions", heartPracticeEyebrow: "VERSE PRACTICE", heartPracticeTitle: "Recite the selected verse from memory", heartPracticeIntro: "Words reveal only in order. One full correct recitation without hints adds one repetition toward the rule of 300.", heartVerseCounter: "SELECTED VERSE REPETITIONS", heartCountOnlyCorrect: "Only a complete accurate recitation without hints is counted", memoryStopVisible: "Stop recitation", memoryStoppedSaved: "Recitation stopped. Current progress was kept."
  });

  Object.assign(translations.ar, {
    memoryMode: "الحفظ · جَمْعُ القرآن", memorizeTitle: "القرآن في القلب", memorizeIntro: "اجمع الصفحة الحالية آيةً آية: تظهر كل آية بعد ٣٠٠ تلاوة صحيحة، ثم تثبت الصفحة بالتلاوة المتصلة.",
    heartCurrentPage: "الصفحة الحالية", heartPageLoadingShort: "جارٍ تحديد الصفحة…", heartOpenProgress: "افتح الصفحة كاملة وتقدّمها", heartOpenPageAction: "افتح الصفحة", heartPageLaunchProgress: "اكتملت {collected} من {total} آية · {percent}٪ من التكرار", heartPracticeEyebrow: "تدريب الآية", heartPracticeTitle: "سمّع الآية المختارة غيبًا", heartPracticeIntro: "تظهر الكلمات بالترتيب فقط. وتضيف التلاوة الكاملة الصحيحة بلا تلميح تكرارًا واحدًا إلى قاعدة ٣٠٠.", heartVerseCounter: "تكرارات الآية المختارة", heartCountOnlyCorrect: "لا تُحتسب إلا التلاوة الكاملة الصحيحة بلا تلميح", memoryStopVisible: "إيقاف التلاوة", memoryStoppedSaved: "توقفت التلاوة وحُفظ التقدم الحالي."
  });

  Object.assign(translations.ru, {
    audioDemo: "Слушать выбранный аят в исполнении чтеца", recitationLibrary: "Библиотека чтецов", recitationSource: "Профессиональная поаятная запись · EveryAyah", chooseReciter: "Чтец", audioSeekLabel: "Позиция воспроизведения", repeatAyah: "Повтор", nextAyahShort: "Далее", audioOpenSource: "Открытое аудио:", audioLoading: "Загружаю запись аята…", audioUnavailable: "Запись этого аята недоступна. Выберите другого чтеца.", audioPlaying: "Чтение аята началось.", audioStopped: "Воспроизведение остановлено.", reciterChanged: "Выбран чтец: {name}.", repeatAudioOn: "Повтор аята включён.", repeatAudioOff: "Повтор аята выключен.",
    interlinearMode: "Подстрочно", interlinearAria: "Показать подстрочный смысл", interlinearVerified: "Буквальный подстрочник", interlinearLimited: "Арабское слово, произношение и краткий смысл показаны вместе прямо в ALLIM.", interlinearIdle: "Нажмите «Подстрочно»", interlinearLoading: "Загружаю слова…", interlinearReady: "Русский подстрочник готов", interlinearEnglishReady: "Доступен английский глосс", interlinearPartial: "Часть русского слоя ещё проверяется", interlinearUnavailable: "Источник временно недоступен", interlinearOn: "Подстрочный смысл включён.", interlinearOff: "Подстрочный смысл скрыт.",
    modeMushaf: "Мусхаф", mushafMadinah: "Мединский мусхаф", mushafHafs: "Риваят Хафс ‘ан ‘Асим · шрифт Османа Таха", mushafModeOn: "Открыт режим мединского мусхафа.", mushafNavigation: "Навигация мусхафа", mushafBack: "Назад к чтению", mushafHome: "На главную АЛЛИМ",
    mushafPage: "Страница", previousMushafPage: "Предыдущая страница", nextMushafPage: "Следующая страница", mushafLoading: "Загружаю точную страницу мусхафа…", mushafLoadError: "Страница временно недоступна. Проверьте соединение и повторите.", mushafPageReady: "Открыта страница {page} из 604.", mushafFont: "Почерк", mushafFontAria: "Выберите почерк мусхафа", mushafClassic: "Мединский классический", mushafModern: "Мединский современный", mushafReadable: "Крупный усманийский", mushafFontChanged: "Почерк мусхафа изменён.",
    recitationFlowTitle: "Как вы хотите читать?", recitationFlowText: "Один аят вручную или непрерывно по суре.", recitationFlowGroup: "Сценарий чтения", singleVerseFlow: "Один аят", singleVerseFlowText: "Переход вручную", continuousFlow: "Непрерывно", continuousFlowText: "Микрофон остаётся активным", singleFlowEnabled: "Включено чтение одного аята.", continuousFlowEnabled: "Включено непрерывное чтение: правильный аят сменится автоматически.", continuousNeedsBrowser: "Для непрерывного чтения нужен Live-режим браузера.",
    offlineSurah: "Сура без интернета", offlineSurahText: "Загрузите все аяты выбранной суры в фоне.", downloadSurah: "Скачать суру", cancelDownload: "Отменить", audioDownloadProgress: "Загружено {done} из {total} аятов", audioDownloadReady: "Сура загружена и готова без интернета.", audioDownloadError: "Не удалось завершить загрузку. Уже полученные аяты сохранены.", audioDownloadUnavailable: "Офлайн-загрузка не поддерживается этим браузером."
  });

  Object.assign(translations.en, {
    audioDemo: "Listen to the selected verse by a reciter", recitationLibrary: "Reciter library", recitationSource: "Professional verse-by-verse recitation · EveryAyah", chooseReciter: "Reciter", audioSeekLabel: "Playback position", repeatAyah: "Repeat", nextAyahShort: "Next", audioOpenSource: "Open audio:", audioLoading: "Loading the verse recitation…", audioUnavailable: "This verse recording is unavailable. Choose another reciter.", audioPlaying: "Verse recitation started.", audioStopped: "Playback stopped.", reciterChanged: "Reciter selected: {name}.", repeatAudioOn: "Verse repeat is on.", repeatAudioOff: "Verse repeat is off.",
    interlinearMode: "Interlinear", interlinearAria: "Show interlinear meaning", interlinearVerified: "Word-by-word meaning", interlinearLimited: "Arabic, transliteration and a concise word meaning stay together inside ALLIM.", interlinearIdle: "Select Interlinear", interlinearLoading: "Loading words…", interlinearReady: "Word meanings are ready", interlinearEnglishReady: "English gloss is ready", interlinearPartial: "Some meanings are still under review", interlinearUnavailable: "Source is temporarily unavailable", interlinearOn: "Interlinear meaning is on.", interlinearOff: "Interlinear meaning is hidden.",
    modeMushaf: "Mushaf", mushafMadinah: "Madinah Mushaf", mushafHafs: "Hafs ‘an ‘Asim · Uthman Taha script", mushafModeOn: "Madinah Mushaf mode opened.", mushafNavigation: "Mushaf navigation", mushafBack: "Back to reading", mushafHome: "Go to the ALLIM home page",
    mushafPage: "Page", previousMushafPage: "Previous page", nextMushafPage: "Next page", mushafLoading: "Loading the exact Mushaf page…", mushafLoadError: "This page is temporarily unavailable. Check your connection and try again.", mushafPageReady: "Page {page} of 604 opened.", mushafFont: "Script", mushafFontAria: "Choose the Mushaf script", mushafClassic: "Classic Madani", mushafModern: "Modern Madani", mushafReadable: "Large Uthmanic", mushafFontChanged: "The Mushaf script has changed.",
    recitationFlowTitle: "How would you like to recite?", recitationFlowText: "One verse manually or continuously through the surah.", recitationFlowGroup: "Recitation flow", singleVerseFlow: "One verse", singleVerseFlowText: "Advance manually", continuousFlow: "Continuous", continuousFlowText: "Microphone stays active", singleFlowEnabled: "Single-verse recitation is on.", continuousFlowEnabled: "Continuous recitation is on: a correct verse advances automatically.", continuousNeedsBrowser: "Continuous recitation requires Browser Live mode.",
    offlineSurah: "Surah offline", offlineSurahText: "Download every verse of the selected surah in the background.", downloadSurah: "Download surah", cancelDownload: "Cancel", audioDownloadProgress: "Downloaded {done} of {total} verses", audioDownloadReady: "The surah is downloaded and ready offline.", audioDownloadError: "The download could not finish. Completed verses were kept.", audioDownloadUnavailable: "Offline downloads are not supported by this browser."
  });

  Object.assign(translations.ar, {
    audioDemo: "الاستماع إلى الآية المختارة بصوت قارئ", recitationLibrary: "مكتبة القرّاء", recitationSource: "تلاوة احترافية آيةً آية · EveryAyah", chooseReciter: "القارئ", audioSeekLabel: "موضع التشغيل", repeatAyah: "تكرار", nextAyahShort: "التالي", audioOpenSource: "مصدر الصوت المفتوح:", audioLoading: "جارٍ تحميل تلاوة الآية…", audioUnavailable: "تسجيل هذه الآية غير متاح. اختر قارئًا آخر.", audioPlaying: "بدأت تلاوة الآية.", audioStopped: "توقف التشغيل.", reciterChanged: "اختير القارئ: {name}.", repeatAudioOn: "فُعّل تكرار الآية.", repeatAudioOff: "أُوقف تكرار الآية.",
    interlinearMode: "بين السطور", interlinearAria: "إظهار المعنى تحت كل كلمة", interlinearVerified: "المعنى كلمةً كلمة", interlinearLimited: "تظهر الكلمة العربية ولفظها ومعناها المختصر معًا داخل ALLIM.", interlinearIdle: "اختر بين السطور", interlinearLoading: "جارٍ تحميل الكلمات…", interlinearReady: "المعاني جاهزة", interlinearEnglishReady: "الشرح الإنجليزي جاهز", interlinearPartial: "بعض المعاني قيد المراجعة", interlinearUnavailable: "المصدر غير متاح مؤقتًا", interlinearOn: "فُعّل المعنى بين السطور.", interlinearOff: "أُخفي المعنى بين السطور.",
    modeMushaf: "المصحف", mushafMadinah: "مصحف المدينة", mushafHafs: "رواية حفص عن عاصم · خط عثمان طه", mushafModeOn: "فُتح وضع مصحف المدينة.", mushafNavigation: "التنقل في المصحف", mushafBack: "العودة إلى القراءة", mushafHome: "الانتقال إلى صفحة أليم الرئيسية",
    mushafPage: "الصفحة", previousMushafPage: "الصفحة السابقة", nextMushafPage: "الصفحة التالية", mushafLoading: "جارٍ تحميل صفحة المصحف الدقيقة…", mushafLoadError: "الصفحة غير متاحة مؤقتًا. تحقق من الاتصال وأعد المحاولة.", mushafPageReady: "فُتحت الصفحة {page} من ٦٠٤.", mushafFont: "الرسم", mushafFontAria: "اختر رسم المصحف", mushafClassic: "المدني الكلاسيكي", mushafModern: "المدني الحديث", mushafReadable: "العثماني الكبير", mushafFontChanged: "تم تغيير رسم المصحف.",
    recitationFlowTitle: "كيف تريد أن تقرأ؟", recitationFlowText: "آية واحدة يدويًا أو تلاوة متصلة في السورة.", recitationFlowGroup: "مسار التلاوة", singleVerseFlow: "آية واحدة", singleVerseFlowText: "الانتقال يدوي", continuousFlow: "متصلة", continuousFlowText: "يبقى الميكروفون فعالًا", singleFlowEnabled: "فُعّلت تلاوة آية واحدة.", continuousFlowEnabled: "فُعّلت التلاوة المتصلة: تُفتح الآية التالية تلقائيًا بعد صحة القراءة.", continuousNeedsBrowser: "تحتاج التلاوة المتصلة إلى وضع المتصفح المباشر.",
    offlineSurah: "السورة دون اتصال", offlineSurahText: "نزّل جميع آيات السورة المختارة في الخلفية.", downloadSurah: "تنزيل السورة", cancelDownload: "إلغاء", audioDownloadProgress: "تم تنزيل {done} من {total} آية", audioDownloadReady: "نُزّلت السورة وأصبحت جاهزة دون اتصال.", audioDownloadError: "تعذر إكمال التنزيل. حُفظت الآيات التي اكتمل تنزيلها.", audioDownloadUnavailable: "التنزيل دون اتصال غير مدعوم في هذا المتصفح."
  });

  Object.assign(translations.ru, {
    openHeartPage: "Открыть страницу сердца", heartRepeats: "Повторения", heartPageEyebrow: "СТРАНИЦА В СЕРДЦЕ", heartPageTitle: "Соберите страницу целиком", heartAyatCollected: "Аятов собрано", heartPageBuilding: "Собирается", heartPageReady: "Готова к связному чтению", heartPagePermanent: "Сохранена навсегда", heartPageGuidance: "Каждый аят проявляется после 300 правильных чтений. Затем прочитайте всю страницу без разрыва, чтобы связать аяты.", heartConnectedTitle: "Связное чтение страницы", heartConnectedLocked: "Откроется, когда каждый аят достигнет 300 повторений.", heartConnectedReady: "Все аяты собраны. Прочитайте страницу по порядку без подсказок.", heartConnectedActive: "Читайте по порядку: следующий аят откроется автоматически.", heartConnectedPermanent: "Страница прочитана связно и больше не исчезнет.", heartContinueAyat: "Продолжить собирать аяты", heartStartConnected: "Начать связное чтение", heartOpenPermanent: "Открыть сохранённую страницу", heartPageLoading: "Загружаю состав страницы…", heartPageLoadError: "Не удалось загрузить состав страницы. Повторите ещё раз.", heartReadCredit: "Правильное чтение засчитано: {count} из 300.", heartLinkedStarted: "Связное чтение началось. Читайте страницу по порядку.", heartLinkedProgress: "Связано {done} из {total} аятов.", heartLinkedRestarted: "Порядок изменился. Связное чтение начато заново с этого аята.", heartPageSealed: "Страница собрана и сохранена навсегда.", heartPermanent: "Сохранён навсегда", heartVersePermanent: "Аят собран", heartVerseBuilding: "повторений"
  });

  Object.assign(translations.en, {
    openHeartPage: "Open the page in your heart", heartRepeats: "Repetitions", heartPageEyebrow: "A PAGE IN THE HEART", heartPageTitle: "Build the whole page", heartAyatCollected: "Verses collected", heartPageBuilding: "In progress", heartPageReady: "Ready for connected recitation", heartPagePermanent: "Saved permanently", heartPageGuidance: "Each verse is revealed after 300 correct recitations. Then recite the whole page without a break to connect its verses.", heartConnectedTitle: "Connected page recitation", heartConnectedLocked: "Unlocks when every verse reaches 300 repetitions.", heartConnectedReady: "Every verse is collected. Recite the page in order without hints.", heartConnectedActive: "Recite in order: the next verse opens automatically.", heartConnectedPermanent: "The page was recited continuously and will never fade.", heartContinueAyat: "Continue collecting verses", heartStartConnected: "Start connected recitation", heartOpenPermanent: "Open saved page", heartPageLoading: "Loading the page structure…", heartPageLoadError: "The page structure could not be loaded. Please try again.", heartReadCredit: "Correct recitation counted: {count} of 300.", heartLinkedStarted: "Connected recitation started. Recite the page in order.", heartLinkedProgress: "Connected {done} of {total} verses.", heartLinkedRestarted: "The order changed. Connected recitation restarted from this verse.", heartPageSealed: "The page is complete and saved permanently.", heartPermanent: "Saved permanently", heartVersePermanent: "Verse collected", heartVerseBuilding: "repetitions"
  });

  Object.assign(translations.ar, {
    openHeartPage: "افتح صفحة القلب", heartRepeats: "التكرار", heartPageEyebrow: "صَفْحَةٌ فِي القَلْب", heartPageTitle: "اجمع الصفحة كاملة", heartAyatCollected: "الآيات المكتملة", heartPageBuilding: "قيد الجمع", heartPageReady: "جاهزة للتلاوة المتصلة", heartPagePermanent: "محفوظة دائمًا", heartPageGuidance: "تظهر كل آية بعد ٣٠٠ تلاوة صحيحة، ثم تُقرأ الصفحة كاملة بلا انقطاع لربط آياتها.", heartConnectedTitle: "تلاوة الصفحة متصلة", heartConnectedLocked: "تُفتح بعد بلوغ كل آية ٣٠٠ تكرار.", heartConnectedReady: "اكتملت الآيات كلها. اقرأ الصفحة بالترتيب دون تلميح.", heartConnectedActive: "اقرأ بالترتيب، وستفتح الآية التالية تلقائيًا.", heartConnectedPermanent: "قُرئت الصفحة متصلة ولن تختفي بعد اليوم.", heartContinueAyat: "تابع جمع الآيات", heartStartConnected: "ابدأ التلاوة المتصلة", heartOpenPermanent: "افتح الصفحة المحفوظة", heartPageLoading: "جارٍ تحميل بنية الصفحة…", heartPageLoadError: "تعذر تحميل بنية الصفحة. حاول مرة أخرى.", heartReadCredit: "احتُسبت التلاوة الصحيحة: {count} من ٣٠٠.", heartLinkedStarted: "بدأت التلاوة المتصلة. اقرأ الصفحة بالترتيب.", heartLinkedProgress: "رُبطت {done} من {total} آية.", heartLinkedRestarted: "تغيّر الترتيب، فبدأت التلاوة المتصلة من هذه الآية.", heartPageSealed: "اكتملت الصفحة وحُفظت دائمًا.", heartPermanent: "محفوظة دائمًا", heartVersePermanent: "اكتملت الآية", heartVerseBuilding: "تكرار"
  });

  Object.assign(translations.ru, {
    heartContinueConnected: "Продолжить связное чтение", heartNextActions: "Следующие действия", heartNextStep: "СЛЕДУЮЩИЙ ШАГ", heartNextCollect: "Соберите оставшиеся аяты", heartNextConnect: "Свяжите всю страницу одним чтением", heartNextSaved: "Страница сохранена — её можно повторить", heartLinkedUnavailable: "Недоступно до завершения первого этапа", heartCollectProgress: "Текущий этап · собрано {collected} из {total}", heartLinkedLockedProgress: "Недоступно · собрано {collected} из {total}", heartLinkedReadyProgress: "Доступно · все {total} аятов собраны", heartLinkedActiveProgress: "Идёт чтение · связано {done} из {total}", heartLinkedSavedProgress: "Страница сохранена навсегда"
  });

  Object.assign(translations.en, {
    heartContinueConnected: "Continue connected recitation", heartNextActions: "Next actions", heartNextStep: "NEXT STEP", heartNextCollect: "Collect the remaining verses", heartNextConnect: "Connect the whole page in one recitation", heartNextSaved: "The page is saved — you can review it", heartLinkedUnavailable: "Unavailable until the first stage is complete", heartCollectProgress: "Current stage · {collected} of {total} collected", heartLinkedLockedProgress: "Unavailable · {collected} of {total} collected", heartLinkedReadyProgress: "Available · all {total} verses collected", heartLinkedActiveProgress: "In progress · {done} of {total} connected", heartLinkedSavedProgress: "Page saved permanently"
  });

  Object.assign(translations.ar, {
    heartContinueConnected: "واصل التلاوة المتصلة", heartNextActions: "الإجراءات التالية", heartNextStep: "الخطوة التالية", heartNextCollect: "أكمل جمع الآيات المتبقية", heartNextConnect: "اربط الصفحة كاملة في تلاوة واحدة", heartNextSaved: "الصفحة محفوظة ويمكنك مراجعتها", heartLinkedUnavailable: "غير متاح حتى اكتمال المرحلة الأولى", heartCollectProgress: "المرحلة الحالية · جُمعت {collected} من {total}", heartLinkedLockedProgress: "غير متاح · جُمعت {collected} من {total}", heartLinkedReadyProgress: "متاح · جُمعت الآيات الـ {total} كلها", heartLinkedActiveProgress: "التلاوة جارية · رُبطت {done} من {total}", heartLinkedSavedProgress: "الصفحة محفوظة دائمًا"
  });

  Object.assign(translations.ru, {
    heartPageTitle: "Собирайте настоящую страницу мусхафа", heartPageGuidance: "Строки и положение каждого слова остаются такими же, как в режиме чтения. Аят постепенно проявляется до 300 правильных чтений, не сдвигая страницу.", heartSelectedAyah: "Выбранный аят", heartRevealTitle: "Страница проявляется без смещения строк", heartRevealGhost: "Ещё не закреплено", heartRevealBuilding: "Проявляется с повторениями", heartRevealComplete: "300 повторений",
    mushafAppearance: "Вид страницы", mushafPaper: "Бумага", mushafInk: "Чернила", mushafPaperIvory: "Тёплая слоновая кость", mushafPaperWhite: "Белая", mushafPaperSage: "Светло-зелёная", mushafPaperMist: "Светло-серая", mushafPaperSky: "Светло-голубая", mushafInkCharcoal: "Классические чёрные", mushafInkEmerald: "Глубокие зелёные", mushafInkNavy: "Тёмно-синие", mushafInkSepia: "Сепия", mushafAppearanceChanged: "Оформление мусхафа сохранено для чтения и заучивания."
  });

  Object.assign(translations.en, {
    heartPageTitle: "Build the real Mushaf page", heartPageGuidance: "Every line and word remains in the same position as reading mode. A verse gradually gains ink across 300 accurate recitations without shifting the page.", heartSelectedAyah: "Selected verse", heartRevealTitle: "The page appears without moving its lines", heartRevealGhost: "Not yet secured", heartRevealBuilding: "Appears with repetition", heartRevealComplete: "300 repetitions",
    mushafAppearance: "Page style", mushafPaper: "Paper", mushafInk: "Ink", mushafPaperIvory: "Warm ivory", mushafPaperWhite: "White", mushafPaperSage: "Soft green", mushafPaperMist: "Light grey", mushafPaperSky: "Soft blue", mushafInkCharcoal: "Classic black", mushafInkEmerald: "Deep green", mushafInkNavy: "Deep blue", mushafInkSepia: "Sepia", mushafAppearanceChanged: "Mushaf styling was saved for reading and memorisation."
  });

  Object.assign(translations.ar, {
    heartPageTitle: "اجمع صفحة المصحف الحقيقية", heartPageGuidance: "تبقى الأسطر وكل كلمة في موضعها نفسه كما في وضع القراءة، ويظهر حبر الآية تدريجيًا خلال ٣٠٠ تلاوة صحيحة من غير أن تتحرك الصفحة.", heartSelectedAyah: "الآية المختارة", heartRevealTitle: "تظهر الصفحة من غير تغيّر مواضع الأسطر", heartRevealGhost: "لم تُثبّت بعد", heartRevealBuilding: "تظهر مع التكرار", heartRevealComplete: "٣٠٠ تكرار",
    mushafAppearance: "مظهر الصفحة", mushafPaper: "الورق", mushafInk: "الحبر", mushafPaperIvory: "عاجي دافئ", mushafPaperWhite: "أبيض", mushafPaperSage: "أخضر هادئ", mushafPaperMist: "رمادي فاتح", mushafPaperSky: "أزرق هادئ", mushafInkCharcoal: "أسود كلاسيكي", mushafInkEmerald: "أخضر داكن", mushafInkNavy: "أزرق داكن", mushafInkSepia: "بني معتّق", mushafAppearanceChanged: "حُفظ مظهر المصحف للقراءة والحفظ."
  });

  Object.assign(translations.ru, {
    memorySeriesStart: "Начать серию чтений", memorySeriesActive: "Серия чтений активна", memoryLiveCounter: "ПРАВИЛЬНЫЕ ЧТЕНИЯ ЭТОГО АЯТА", memorySeriesReady: "Готов к серии", memorySeriesReadySub: "Нажмите один раз — повторения будут идти без перезапуска кнопки.", memorySeriesRequesting: "Подключаю микрофон", memorySeriesRequestingSub: "Кнопка остановки уже работает — ожидание можно отменить.", memorySeriesListening: "Слушаю текущее повторение", memorySeriesListeningSub: "Читайте аят полностью. После принятия счётчик увеличится сразу.", memorySeriesProcessing: "Проверяю чтение", memorySeriesProcessingSub: "Можно остановить проверку в любой момент.", memorySeriesAccepted: "Повторение засчитано", memorySeriesAcceptedSub: "Готовлю тот же аят к следующему чтению…", memorySeriesPaused: "Серия остановлена", memorySeriesPausedSub: "Счётчик сохранён. Продолжить можно одной кнопкой.", memorySeriesError: "Исправьте и прочитайте снова", memorySeriesErrorSub: "Счётчик не изменился; тот же аят остаётся активным.", memorySeriesTimeout: "Микрофон не ответил", memorySeriesTimeoutSub: "Ожидание отменено. Проверьте разрешение браузера и попробуйте снова.", chapterRecitationSource: "Полная сура · MP3Quran", chapterAudioStarted: "Запущено чтение всей суры.", chapterAudioScope: "Этот чтец доступен записью всей суры; поаятный переход отключён."
  });

  Object.assign(translations.en, {
    memorySeriesStart: "Start a recitation series", memorySeriesActive: "Recitation series active", memoryLiveCounter: "ACCURATE RECITATIONS OF THIS VERSE", memorySeriesReady: "Ready for a series", memorySeriesReadySub: "Tap once — repetitions continue without restarting the button.", memorySeriesRequesting: "Connecting the microphone", memorySeriesRequestingSub: "Stop is already available, so you can cancel the wait.", memorySeriesListening: "Listening to this repetition", memorySeriesListeningSub: "Recite the complete verse. The counter updates immediately after acceptance.", memorySeriesProcessing: "Checking the recitation", memorySeriesProcessingSub: "You can stop the check at any time.", memorySeriesAccepted: "Repetition counted", memorySeriesAcceptedSub: "Preparing the same verse for the next recitation…", memorySeriesPaused: "Series stopped", memorySeriesPausedSub: "Your count is saved. Continue with one tap.", memorySeriesError: "Correct it and recite again", memorySeriesErrorSub: "The count did not change; the same verse remains active.", memorySeriesTimeout: "The microphone did not respond", memorySeriesTimeoutSub: "The wait was cancelled. Check browser permission and try again.", chapterRecitationSource: "Complete surah · MP3Quran", chapterAudioStarted: "Complete-surah recitation started.", chapterAudioScope: "This reciter is available as a complete-surah recording; verse-by-verse advance is disabled."
  });

  Object.assign(translations.ar, {
    memorySeriesStart: "ابدأ سلسلة التلاوات", memorySeriesActive: "سلسلة التلاوات نشطة", memoryLiveCounter: "التلاوات الصحيحة لهذه الآية", memorySeriesReady: "جاهز لسلسلة التلاوات", memorySeriesReadySub: "اضغط مرة واحدة، ثم تتابع التكرارات بلا إعادة تشغيل الزر.", memorySeriesRequesting: "جارٍ توصيل الميكروفون", memorySeriesRequestingSub: "زر الإيقاف يعمل الآن ويمكنك إلغاء الانتظار.", memorySeriesListening: "أستمع إلى هذه التلاوة", memorySeriesListeningSub: "اقرأ الآية كاملة، ويزداد العداد فور قبولها.", memorySeriesProcessing: "جارٍ التحقق من التلاوة", memorySeriesProcessingSub: "يمكن إيقاف التحقق في أي وقت.", memorySeriesAccepted: "احتُسبت التلاوة", memorySeriesAcceptedSub: "أُهيّئ الآية نفسها للتكرار التالي…", memorySeriesPaused: "توقفت السلسلة", memorySeriesPausedSub: "حُفظ العداد، ويمكنك المتابعة بضغطة واحدة.", memorySeriesError: "صحّح ثم أعد التلاوة", memorySeriesErrorSub: "لم يتغيّر العداد، وتبقى الآية نفسها نشطة.", memorySeriesTimeout: "لم يستجب الميكروفون", memorySeriesTimeoutSub: "أُلغي الانتظار. تحقق من إذن المتصفح ثم حاول ثانية.", chapterRecitationSource: "السورة كاملة · MP3Quran", chapterAudioStarted: "بدأت تلاوة السورة كاملة.", chapterAudioScope: "هذا القارئ متاح بتسجيل السورة كاملة؛ الانتقال آيةً آية غير مفعّل."
  });

  Object.assign(translations.ru, {
    lifeEyebrow: "АЯТ В ЖИЗНИ", lifeTodayTitle: "От понимания — к одному искреннему действию", lifeTodayEmpty: "Выберите аят, запишите размышление и один выполнимый шаг.", lifeStreakDays: "дней практики", lifeApplyToday: "Применить сегодня", lifeApplyTodayText: "Размышление и одно действие", lifeAiOpen: "Как воплотить сегодня?", lifeDialogTitle: "Одно искреннее действие", lifeSelectedAyah: "Выбранный аят", lifeAiTitle: "AI-наставник помогает сформулировать", lifeAiBoundary: "Он работает только с выбранным аятом и вашими словами: не придумывает толкование и не заменяет тафсир или учителя.", lifeReflectionTitle: "Что этот аят меняет во мне сегодня?", lifeReflectionPlaceholder: "Запишите одной-двумя фразами без стремления к красивому тексту.", lifePromptLegend: "Если трудно начать, выберите направление", lifePromptBenefit: "Принести пользу", lifePromptRestraint: "От чего удержаться", lifePromptContinue: "Что продолжить", lifeActionTitle: "Одно малое направленное действие", lifeActionPlaceholder: "Конкретно: что, когда и для кого — так, чтобы выполнить за 5–15 минут.", lifeAiSuggest: "Помоги сформулировать", lifeAiSuggestionIdle: "Помощник предложит форму действия, не объясняя аят от себя.", lifeReturnTitle: "Когда вернуться к записи?", lifeReturnText: "Возвращение связывает смысл, память и поступок.", lifeReturnEvening: "Сегодня вечером", lifeReturnTomorrow: "Завтра", lifeReturnThree: "Через 3 дня", lifeReturnSeven: "Через 7 дней", lifeComplete: "Отметить выполненным", lifeReturned: "Я вернулся к аяту", lifeReturnedDone: "Возвращение отмечено", lifeSave: "Сохранить и вернуться", lifeHistoryEyebrow: "ЛИЧНЫЙ ДНЕВНИК", lifeHistoryTitle: "Последние размышления и действия", lifeHistoryEmpty: "Первая запись появится здесь после сохранения.", lifeSaved: "Размышление и действие сохранены.", lifeCompleted: "Действие отмечено выполненным.", lifeReviewCompleted: "Возвращение к аяту отмечено.", lifeNeedWords: "Запишите размышление или одно конкретное действие.", lifeNeedAction: "Сначала запишите одно конкретное действие.", lifeDueNow: "Пора вернуться к записи", lifePlannedFor: "Вернуться: {date}", lifeDoneStatus: "Действие выполнено · возвращение {date}", lifeReviewDoneStatus: "Возвращение к аяту выполнено", lifeDraftStatus: "Действие ещё не отмечено", lifeAiBenefit: "Сегодня я принесу конкретную пользу одному человеку — небольшой шаг, который можно завершить за 5–15 минут.", lifeAiRestraint: "Сегодня перед одним привычным действием я сделаю паузу и сознательно откажусь от того, что противоречит понятому.", lifeAiContinue: "Сегодня после ближайшего удобного времени я выделю 10 минут, чтобы продолжить поступок, связанный с тем, что понял.", lifeAiFromReflection: "Сегодня я сделаю один конкретный шаг по этому размышлению: {reflection}", lifeAiReady: "Формулировка готова. Измените её так, чтобы она была вашей и выполнимой.", lifeJournalLabel: "Личное размышление", lifeActionLabel: "Действие"
  });

  Object.assign(translations.en, {
    lifeEyebrow: "VERSE IN LIFE", lifeTodayTitle: "From understanding to one sincere action", lifeTodayEmpty: "Choose a verse, record a reflection and one achievable step.", lifeStreakDays: "practice days", lifeApplyToday: "Apply today", lifeApplyTodayText: "Reflection and one action", lifeAiOpen: "How can I live it today?", lifeDialogTitle: "One sincere action", lifeSelectedAyah: "Selected verse", lifeAiTitle: "AI mentor helps you phrase it", lifeAiBoundary: "It works only with the selected verse and your own words. It does not invent interpretation or replace tafsir or a teacher.", lifeReflectionTitle: "What does this verse change in me today?", lifeReflectionPlaceholder: "Write one or two honest sentences; it does not need to sound polished.", lifePromptLegend: "If starting is difficult, choose a direction", lifePromptBenefit: "Bring benefit", lifePromptRestraint: "What to refrain from", lifePromptContinue: "What to continue", lifeActionTitle: "One small directed action", lifeActionPlaceholder: "Be concrete: what, when and for whom — achievable in 5–15 minutes.", lifeAiSuggest: "Help me phrase it", lifeAiSuggestionIdle: "The mentor will suggest an action format without interpreting the verse itself.", lifeReturnTitle: "When should you return?", lifeReturnText: "Returning connects meaning, memory and action.", lifeReturnEvening: "This evening", lifeReturnTomorrow: "Tomorrow", lifeReturnThree: "In 3 days", lifeReturnSeven: "In 7 days", lifeComplete: "Mark as completed", lifeReturned: "I returned to the verse", lifeReturnedDone: "Return recorded", lifeSave: "Save and return", lifeHistoryEyebrow: "PRIVATE JOURNAL", lifeHistoryTitle: "Recent reflections and actions", lifeHistoryEmpty: "Your first entry will appear here after saving.", lifeSaved: "Reflection and action saved.", lifeCompleted: "Action marked as completed.", lifeReviewCompleted: "Return to the verse recorded.", lifeNeedWords: "Write a reflection or one concrete action.", lifeNeedAction: "Write one concrete action first.", lifeDueNow: "Time to return to the entry", lifePlannedFor: "Return: {date}", lifeDoneStatus: "Action complete · return {date}", lifeReviewDoneStatus: "Return to the verse complete", lifeDraftStatus: "Action not completed yet", lifeAiBenefit: "Today I will bring a specific benefit to one person through a small step I can finish in 5–15 minutes.", lifeAiRestraint: "Today I will pause before one habitual action and consciously avoid what conflicts with what I understood.", lifeAiContinue: "At the next suitable time today, I will spend 10 minutes continuing an action connected to what I understood.", lifeAiFromReflection: "Today I will take one concrete step from this reflection: {reflection}", lifeAiReady: "The wording is ready. Edit it until it is truly yours and achievable.", lifeJournalLabel: "Personal reflection", lifeActionLabel: "Action"
  });

  Object.assign(translations.ar, {
    lifeEyebrow: "الآية في الحياة", lifeTodayTitle: "من الفهم إلى عملٍ صادقٍ واحد", lifeTodayEmpty: "اختر آية، وسجّل تدبرًا وخطوة واحدة قابلة للتنفيذ.", lifeStreakDays: "أيام الممارسة", lifeApplyToday: "طبّقها اليوم", lifeApplyTodayText: "تدبر وعمل واحد", lifeAiOpen: "كيف أعمل بها اليوم؟", lifeDialogTitle: "عملٌ صادقٌ واحد", lifeSelectedAyah: "الآية المختارة", lifeAiTitle: "يساعدك المرشد الذكي على الصياغة", lifeAiBoundary: "يعمل مع الآية المختارة وكلماتك أنت فقط، ولا يبتكر تفسيرًا ولا يغني عن التفسير أو المعلّم.", lifeReflectionTitle: "ماذا تغيّر هذه الآية في نفسي اليوم؟", lifeReflectionPlaceholder: "اكتب جملة أو جملتين بصدق من غير تكلّف.", lifePromptLegend: "إن صعبت البداية فاختر اتجاهًا", lifePromptBenefit: "نفع الآخرين", lifePromptRestraint: "ممّ أمتنع", lifePromptContinue: "ما الذي أستمر عليه", lifeActionTitle: "عمل صغير موجّه", lifeActionPlaceholder: "حدّد ماذا ومتى ولمن، بحيث تنجزه في ٥–١٥ دقيقة.", lifeAiSuggest: "ساعدني في الصياغة", lifeAiSuggestionIdle: "سيقترح المرشد صيغة للعمل من غير أن يفسّر الآية من عنده.", lifeReturnTitle: "متى تعود إلى هذه الملاحظة؟", lifeReturnText: "العودة تربط المعنى بالحفظ والعمل.", lifeReturnEvening: "هذا المساء", lifeReturnTomorrow: "غدًا", lifeReturnThree: "بعد ٣ أيام", lifeReturnSeven: "بعد ٧ أيام", lifeComplete: "تحديد العمل منجزًا", lifeReturned: "عدت إلى الآية", lifeReturnedDone: "سُجّلت العودة", lifeSave: "حفظ وعودة", lifeHistoryEyebrow: "دفتر خاص", lifeHistoryTitle: "آخر التدبرات والأعمال", lifeHistoryEmpty: "ستظهر أول ملاحظة هنا بعد الحفظ.", lifeSaved: "حُفظ التدبر والعمل.", lifeCompleted: "سُجّل إنجاز العمل.", lifeReviewCompleted: "سُجّلت العودة إلى الآية.", lifeNeedWords: "اكتب تدبرًا أو عملًا محددًا.", lifeNeedAction: "اكتب عملًا محددًا أولًا.", lifeDueNow: "حان وقت العودة إلى الملاحظة", lifePlannedFor: "العودة: {date}", lifeDoneStatus: "اكتمل العمل · العودة {date}", lifeReviewDoneStatus: "تمت العودة إلى الآية", lifeDraftStatus: "لم يُنجز العمل بعد", lifeAiBenefit: "سأقدّم اليوم نفعًا محددًا لشخص واحد بخطوة صغيرة أنجزها خلال ٥–١٥ دقيقة.", lifeAiRestraint: "سأتوقف اليوم قبل تصرف معتاد، وأترك بوعي ما يخالف ما فهمته.", lifeAiContinue: "سأخصص اليوم عشر دقائق في أقرب وقت مناسب لأواصل عملًا مرتبطًا بما فهمته.", lifeAiFromReflection: "سأتخذ اليوم خطوة محددة من هذا التدبر: {reflection}", lifeAiReady: "الصياغة جاهزة. عدّلها حتى تكون من كلماتك وقابلة للتنفيذ.", lifeJournalLabel: "تدبر شخصي", lifeActionLabel: "العمل"
  });

  Object.assign(translations.ru, {
    lifeFawaidEyebrow: "ФАВАЙД АЯТА", lifeFawaidTitle: "Выводы учёных о пользе аята", lifeFawaidSource: "Источник",
    lifeFawaidAvailableText: "Ниже — краткие редакционные формулировки по указанным источникам, не дословные цитаты. Выберите один вывод как основу: AI не смешивает слова разных учёных.",
    lifeFawaidUnavailableText: "Для этого аята проверенные выводы учёных пока не подключены. AI не будет составлять их из одного перевода.",
    lifeFawaidScope: "Относится к аятам {scope}", lifeFawaidUse: "Взять за основу", lifeFawaidSelected: "Основа выбрана",
    lifeFawaidChooseFirst: "Сначала выберите один вывод учёного выше. После этого помощник предложит действие именно на его основе.",
    lifeAiTitle: "AI-наставник проверяет замысел, а не повторяет его",
    lifeAiBoundary: "Сначала вы выбираете конкретный вывод учёного. Затем помощник проверяет личную связь и конкретность действия — не придумывая смысл аята и не повторяя вашу заметку.",
    lifePromptLegend: "02 · Выберите направление действия",
    lifeScopeLabel: "Где это проявится?", lifeScopeSelf: "В моих привычках", lifeScopeFamily: "В семье", lifeScopeWork: "В работе или учёбе", lifeScopeCommunity: "В отношении к людям",
    lifeTriggerLabel: "02 · Когда начать?", lifeTriggerPrayer: "После ближайшей молитвы", lifeTriggerConversation: "При следующем разговоре", lifeTriggerDifficult: "В трудный момент", lifeTriggerEvening: "До конца дня",
    lifeAiReviewTitle: "Разбор замысла", lifeAiReviewText: "Помощник покажет, чего не хватает, и даст три разных варианта.", lifeAiSuggest: "Разобрать и предложить",
    lifeAiSuggestionIdle: "Сначала будет проверена личная связь, затем — конкретный шаг, момент начала и реальный объём.", lifeAiChecksLabel: "Проверка плана",
    lifeAiCheckPersonal: "Личная связь", lifeAiCheckDistinct: "Не дублирует заметку", lifeAiCheckConcrete: "Конкретный поступок", lifeAiCheckCue: "Есть момент начала",
    lifeAiNeedReflection: "Я не буду придумывать вывод вместо вас. Сначала запишите, что лично вас касается в этом аяте.",
    lifeAiObservation: "Пока это наблюдение об аяте, а не личный вывод. Поэтому помощник предлагает сначала проверить контекст, а не выдумывать искусственное действие.",
    lifeAiDuplicate: "План повторяет заметку, но не отвечает на вопрос «что именно сделать?». Ниже — три разных способа превратить намерение в поступок.",
    lifeAiImprove: "Основа уже есть. Проверьте три варианта: короткий шаг, план по сигналу и безопасное уточнение смысла.",
    lifeAiReady: "План уже достаточно конкретный. Варианты ниже помогут сделать его легче для начала или проверить понимание.",
    lifeAiChoicesTitle: "Выберите один план — только после выбора он попадёт в поле действия.", lifeAiUsePlan: "Выбрать этот план", lifeAiPlanApplied: "План выбран. Проверьте, что он действительно ваш, и при необходимости измените слова.",
    lifeAiVerifiedTitle: "Шаг на основе выбранного вывода", lifeAiVerifiedReason: "Действие — отдельная редакционная подсказка: оно опирается на выбранный вывод, но не приписывается учёному.",
    lifeAiVerifiedSecondTitle: "Другое применение той же пользы", lifeAiVerifiedSecondReason: "Даёт второй путь без добавления нового смысла к аяту.",
    lifeActionTitle: "Ваш план «когда → тогда»", lifeActionPlaceholder: "Например: после ближайшей молитвы я напишу одному человеку и предложу конкретную помощь.",
    lifeReturnTitle: "Когда проверить результат?", lifeReturnText: "Возвращение показывает, состоялся ли поступок, а не только намерение.", lifeSave: "Сохранить план", lifeComplete: "Действие выполнено"
  });

  Object.assign(translations.en, {
    lifeFawaidEyebrow: "VERSE BENEFITS", lifeFawaidTitle: "Scholars’ conclusions about the verse’s benefits", lifeFawaidSource: "Source",
    lifeFawaidAvailableText: "These are concise editorial formulations based on the linked sources, not verbatim quotations. Choose one conclusion as the basis; the AI does not blend different scholars’ words.",
    lifeFawaidUnavailableText: "Verified scholarly conclusions are not yet available for this verse. The AI will not construct them from a translation alone.",
    lifeFawaidScope: "Covers verses {scope}", lifeFawaidUse: "Use as basis", lifeFawaidSelected: "Basis selected",
    lifeFawaidChooseFirst: "First choose one scholarly conclusion above. The mentor will then suggest an action based specifically on it.",
    lifeAiTitle: "The AI mentor tests the intention instead of repeating it",
    lifeAiBoundary: "First choose one specific scholarly conclusion. The mentor then checks the personal link and whether the action is concrete—without inventing the verse’s meaning or repeating your note.",
    lifePromptLegend: "02 · Choose the direction of action",
    lifeScopeLabel: "Where will this show up?", lifeScopeSelf: "In my habits", lifeScopeFamily: "In my family", lifeScopeWork: "At work or study", lifeScopeCommunity: "In how I treat people",
    lifeTriggerLabel: "02 · When will I begin?", lifeTriggerPrayer: "After the next prayer", lifeTriggerConversation: "In the next conversation", lifeTriggerDifficult: "At a difficult moment", lifeTriggerEvening: "Before the end of today",
    lifeAiReviewTitle: "Intention review", lifeAiReviewText: "The mentor shows what is missing and offers three genuinely different options.", lifeAiSuggest: "Review and suggest",
    lifeAiSuggestionIdle: "It will first check the personal link, then the concrete step, starting cue and realistic scope.", lifeAiChecksLabel: "Plan review",
    lifeAiCheckPersonal: "Personal link", lifeAiCheckDistinct: "Does not copy the note", lifeAiCheckConcrete: "Concrete behaviour", lifeAiCheckCue: "Has a starting cue",
    lifeAiNeedReflection: "I will not invent a conclusion for you. First write what touches you personally in this verse.",
    lifeAiObservation: "This is currently an observation about the verse, not yet a personal conclusion. The mentor therefore suggests checking the context instead of inventing an artificial action.",
    lifeAiDuplicate: "The plan repeats the note but does not answer “what exactly will I do?”. Below are three different ways to turn the intention into behaviour.",
    lifeAiImprove: "The foundation is there. Compare a short step, a cue-based plan and a safe way to verify the meaning.",
    lifeAiReady: "The plan is already concrete. The options below can make it easier to start or help verify your understanding.",
    lifeAiChoicesTitle: "Choose one plan. It enters the action field only after you select it.", lifeAiUsePlan: "Use this plan", lifeAiPlanApplied: "Plan selected. Make sure it is truly yours and edit the wording if needed.",
    lifeAiVerifiedTitle: "A step based on the selected conclusion", lifeAiVerifiedReason: "The action is a separate editorial prompt: it is grounded in the selected conclusion but is not attributed to the scholar.",
    lifeAiVerifiedSecondTitle: "Another application of the benefit", lifeAiVerifiedSecondReason: "Offers a second path without adding a new meaning to the verse.",
    lifeActionTitle: "Your “when → then” plan", lifeActionPlaceholder: "For example: after the next prayer, I will message one person and offer one specific kind of help.",
    lifeReturnTitle: "When will you check the result?", lifeReturnText: "Returning reveals whether the behaviour happened, not only the intention.", lifeSave: "Save plan", lifeComplete: "Action completed"
  });

  Object.assign(translations.ar, {
    lifeFawaidEyebrow: "فَوَائِدُ الآيَةِ", lifeFawaidTitle: "استنباطات العلماء من فوائد الآية", lifeFawaidSource: "المصدر",
    lifeFawaidAvailableText: "هذه صياغات تحريرية موجزة مبنية على المصادر المرتبطة وليست اقتباسات حرفية. اختر استنباطًا واحدًا أصلًا للعمل؛ ولا يخلط المرشد بين كلام العلماء.",
    lifeFawaidUnavailableText: "لم تُربط بهذه الآية استنباطات موثقة للعلماء بعد، ولن ينشئها المرشد من ترجمة واحدة.",
    lifeFawaidScope: "يشمل الآيات {scope}", lifeFawaidUse: "اجعله أصلًا", lifeFawaidSelected: "تم اختيار الأصل",
    lifeFawaidChooseFirst: "اختر أولًا استنباطًا واحدًا من كلام العلماء أعلاه، ثم يقترح المرشد عملًا مبنيًا عليه بعينه.",
    lifeAiTitle: "يراجع المرشد الذكي القصد ولا يكرّر كلماتك",
    lifeAiBoundary: "تختار أولًا استنباطًا محددًا لعالم، ثم يراجع المرشد الصلة الشخصية ووضوح العمل من غير اختراع معنى للآية أو تكرار ملاحظتك.",
    lifePromptLegend: "٠٢ · اختر اتجاه العمل",
    lifeScopeLabel: "أين سيظهر هذا؟", lifeScopeSelf: "في عاداتي", lifeScopeFamily: "في أسرتي", lifeScopeWork: "في العمل أو الدراسة", lifeScopeCommunity: "في تعاملي مع الناس",
    lifeTriggerLabel: "٠٢ · متى أبدأ؟", lifeTriggerPrayer: "بعد الصلاة القادمة", lifeTriggerConversation: "في الحديث القادم", lifeTriggerDifficult: "عند موقف صعب", lifeTriggerEvening: "قبل نهاية اليوم",
    lifeAiReviewTitle: "مراجعة القصد", lifeAiReviewText: "يوضح المرشد ما ينقص ويعرض ثلاثة خيارات مختلفة حقًا.", lifeAiSuggest: "راجع واقترح",
    lifeAiSuggestionIdle: "سيتحقق أولًا من الصلة الشخصية، ثم من العمل المحدد ووقت البدء وحجمه الواقعي.", lifeAiChecksLabel: "مراجعة الخطة",
    lifeAiCheckPersonal: "صلة شخصية", lifeAiCheckDistinct: "لا يكرّر الملاحظة", lifeAiCheckConcrete: "عمل محدد", lifeAiCheckCue: "له وقت بدء",
    lifeAiNeedReflection: "لن أضع نتيجة من عندي. اكتب أولًا ما الذي يمسّك شخصيًا في هذه الآية.",
    lifeAiObservation: "هذه الآن ملاحظة عن الآية وليست بعدُ نتيجة شخصية؛ لذلك يقترح المرشد التحقق من السياق بدل اختراع عمل مصطنع.",
    lifeAiDuplicate: "الخطة تكرّر الملاحظة ولا تجيب: ما العمل المحدد؟ ستجد أدناه ثلاث طرق مختلفة لتحويل القصد إلى عمل.",
    lifeAiImprove: "الأصل موجود. قارن بين خطوة قصيرة، وخطة مرتبطة بإشارة، وطريقة آمنة للتحقق من الفهم.",
    lifeAiReady: "الخطة محددة بالفعل. تساعدك الخيارات أدناه على تسهيل البداية أو التحقق من الفهم.",
    lifeAiChoicesTitle: "اختر خطة واحدة؛ لن تنتقل إلى خانة العمل إلا بعد اختيارك.", lifeAiUsePlan: "اختر هذه الخطة", lifeAiPlanApplied: "تم اختيار الخطة. تأكد أنها تعبّر عنك وعدّل كلماتها عند الحاجة.",
    lifeAiVerifiedTitle: "خطوة مبنية على الاستنباط المختار", lifeAiVerifiedReason: "العمل مقترح تحريري مستقل، مبني على الاستنباط المختار ولا يُنسب إلى العالم.",
    lifeAiVerifiedSecondTitle: "تطبيق آخر للفائدة نفسها", lifeAiVerifiedSecondReason: "يعرض مسارًا ثانيًا من غير إضافة معنى جديد إلى الآية.",
    lifeActionTitle: "خطتك «متى ← أفعل»", lifeActionPlaceholder: "مثال: بعد الصلاة القادمة سأرسل إلى شخص واحد وأعرض مساعدة محددة.",
    lifeReturnTitle: "متى تتحقق من النتيجة؟", lifeReturnText: "تكشف العودة هل وقع العمل فعلًا، لا مجرد النية.", lifeSave: "احفظ الخطة", lifeComplete: "تم إنجاز العمل"
  });

  Object.assign(translations.ru, {
    pageRecallEyebrow: "ПРОВЕРКА СТРАНИЦЫ", pageRecallTitle: "Следующий уровень: прочитайте страницу наизусть", pageRecallIntro: "Сохраняем расположение строк и номера аятов, но скрываем текст. Правильные слова проявляются по порядку; ошибка останавливает продвижение до исправления.", pageRecallSteps: "Этапы проверки страницы", pageRecallStepHide: "Текст скрыт, геометрия страницы сохранена", pageRecallStepCheck: "Микрофон ведёт по аятам без повторного запуска", pageRecallStepCorrect: "Ошибка блокирует переход до исправления", pageRecallSelected: "ВЫБРАНО ДЛЯ ПРОВЕРКИ", pageRecallStart: "Начать проверку страницы", pageRecallReady: "Читайте страницу наизусть", pageRecallStatus: "Страница {page} · проверено {done} из {total} аятов", pageRecallShowText: "Показать текст", pageRecallHideText: "Скрыть текст", pageRecallFinish: "Завершить", pageRecallStarted: "Страница скрыта. Нажмите микрофон и читайте с первого аята.", pageRecallComplete: "Страница прочитана полностью по памяти.", pageRecallStopped: "Проверка страницы завершена. Результат сессии сохранён.", pageRecallLoading: "Готовлю страницу для проверки…", pageRecallWrongOrder: "Продолжите с активного аята — порядок страницы сохранён.", lifeJournalVisible: "Дневник аята всегда доступен здесь", recognitionInstant: "Базовый", recognitionInstantText: "Порядок слов и явные ошибки", recognitionCareful: "Тщательно", recognitionCarefulText: "Более строгая проверка слов после остановки", recognitionScopeNote: "Сейчас проверяются порядок и совпадение слов. Таджвид и интонация этим режимом не оцениваются."
  });

  Object.assign(translations.en, {
    pageRecallEyebrow: "PAGE RECALL", pageRecallTitle: "Next level: recite a complete page from memory", pageRecallIntro: "The line layout and verse markers remain while the text is hidden. Correct words appear in order; an error pauses progress until corrected.", pageRecallSteps: "Page recall steps", pageRecallStepHide: "Text is hidden while page geometry stays intact", pageRecallStepCheck: "The microphone follows verses without a restart", pageRecallStepCorrect: "An error blocks progress until corrected", pageRecallSelected: "SELECTED FOR RECALL", pageRecallStart: "Start page recall", pageRecallReady: "Recite the page from memory", pageRecallStatus: "Page {page} · {done} of {total} verses checked", pageRecallShowText: "Show text", pageRecallHideText: "Hide text", pageRecallFinish: "Finish", pageRecallStarted: "The page is hidden. Tap the microphone and begin with the first verse.", pageRecallComplete: "The complete page was recited from memory.", pageRecallStopped: "Page recall finished. Session progress was saved.", pageRecallLoading: "Preparing the page for recall…", pageRecallWrongOrder: "Continue from the active verse to preserve page order.", lifeJournalVisible: "Your verse journal is always available here", recognitionInstant: "Basic", recognitionInstantText: "Word order and clear mistakes", recognitionCareful: "Careful", recognitionCarefulText: "Stricter word check after stopping", recognitionScopeNote: "This mode checks word order and word matching. It does not assess tajwid or intonation."
  });

  Object.assign(translations.ar, {
    pageRecallEyebrow: "اختبار الصفحة", pageRecallTitle: "المستوى التالي: اقرأ صفحة كاملة غيبًا", pageRecallIntro: "يبقى ترتيب السطور وعلامات الآيات كما هو ويُخفى النص. تظهر الكلمات الصحيحة بالترتيب، ويتوقف التقدّم عند الخطأ حتى تصحيحه.", pageRecallSteps: "مراحل اختبار الصفحة", pageRecallStepHide: "يُخفى النص مع بقاء هيئة الصفحة", pageRecallStepCheck: "يتابع الميكروفون الآيات بلا إعادة تشغيل", pageRecallStepCorrect: "يمنع الخطأ الانتقال حتى التصحيح", pageRecallSelected: "المختار للاختبار", pageRecallStart: "ابدأ اختبار الصفحة", pageRecallReady: "اقرأ الصفحة غيبًا", pageRecallStatus: "الصفحة {page} · تم فحص {done} من {total} آيات", pageRecallShowText: "إظهار النص", pageRecallHideText: "إخفاء النص", pageRecallFinish: "إنهاء", pageRecallStarted: "أُخفي نص الصفحة. اضغط الميكروفون وابدأ من أول آية.", pageRecallComplete: "قُرئت الصفحة كاملة غيبًا.", pageRecallStopped: "انتهى اختبار الصفحة وحُفظ تقدّم الجلسة.", pageRecallLoading: "جارٍ إعداد الصفحة للاختبار…", pageRecallWrongOrder: "تابع من الآية النشطة للمحافظة على ترتيب الصفحة.", lifeJournalVisible: "دفتر الآية متاح دائمًا هنا", recognitionInstant: "أساسي", recognitionInstantText: "ترتيب الكلمات والأخطاء الواضحة", recognitionCareful: "تدقيق", recognitionCarefulText: "مطابقة أشد للكلمات بعد الإيقاف", recognitionScopeNote: "يفحص هذا الوضع ترتيب الكلمات ومطابقتها، ولا يقيّم أحكام التجويد أو التنغيم."
  });

  Object.assign(translations.ru, {
    pageRecallAccessTier: "УРОВЕНЬ 2 · БАЗОВЫЙ КАБИНЕТ", pageRecallCheckingAccess: "Проверяем доступ…", pageRecallAccessActive: "ВТОРОЙ ДОСТУП АКТИВЕН", pageRecallAccountRequired: "ТРЕБУЕТСЯ ВХОД В КАБИНЕТ", pageRecallOpenAcademy: "Войти в базовый кабинет", pageRecallAccessError: "Открыть ALLIM Academy"
  });

  Object.assign(translations.en, {
    pageRecallAccessTier: "LEVEL 2 · BASIC CABINET", pageRecallCheckingAccess: "Checking access…", pageRecallAccessActive: "LEVEL TWO ACTIVE", pageRecallAccountRequired: "SIGN-IN REQUIRED", pageRecallOpenAcademy: "Open the basic cabinet", pageRecallAccessError: "Open ALLIM Academy"
  });

  Object.assign(translations.ar, {
    pageRecallAccessTier: "المستوى الثاني · لوحة الطالب الأساسية", pageRecallCheckingAccess: "جارٍ التحقق من الوصول…", pageRecallAccessActive: "المستوى الثاني مفعّل", pageRecallAccountRequired: "يلزم تسجيل الدخول", pageRecallOpenAcademy: "افتح لوحة الطالب الأساسية", pageRecallAccessError: "افتح أكاديمية ALLIM"
  });

  Object.assign(translations.ru, {
    hifzMethodLabel: "Выбор методики заучивания", hifzMethodOption: "МЕТОДИКА", hifzMethodOptionOne: "МЕТОДИКА 01", hifzMethodOptionTwo: "МЕТОДИКА 02", hifzMethod300Title: "300 повторений", hifzMethod300Text: "100 + 100 + 100 для каждого аята", hifzMethod33Title: "33× с последовательным соединением", hifzMethod33Text: "Аят ×33 → связка ×33 → вся страница ×33", hifzMethodChanged300: "Выбрана методика 300 повторений.", hifzMethodChanged33: "Выбрана методика 33× с последовательным соединением.",
    memorizeIntro300: "Собирайте текущую страницу аят за аятом: 300 правильных повторений проявляют каждый аят, а связное чтение закрепляет всю страницу.", memorizeIntro33: "Читайте каждый аят 33 раза. Затем 33 раза соединяйте его со всеми предыдущими аятами; после последнего аята прочитайте всю страницу ровно 33 раза.",
    linked33StagesLabel: "Этапы методики 33 раза", linked33VerseStage: "Каждый аят", linked33JoinStage: "Последовательная связка", linked33PageStage: "Вся страница", linked33ProgressLabel: "Текущий шаг", linked33CurrentVerse: "Аят {reference} · {count} из 33", linked33CurrentJoin: "Связка от {start} до {end} · {count} из 33", linked33CurrentPage: "Вся страница · {count} из 33", linked33AllComplete: "Страница закреплена по методике 33×.",
    heartRule33Title: "Правило 33×", heartRule33: "Засчитывается полное правильное чтение без подсказки. Порядок фиксирован: аят ×33, затем связка с предыдущими аятами ×33.", heartPracticeTitle33: "Выполняйте текущий шаг методики 33×", heartPracticeIntro33: "Одиночный аят проверяется здесь. На шаге связки откроется мусхаф, и микрофон проведёт вас по аятам без разрыва.", memoryLiveCounter33: "ПРАВИЛЬНЫЕ ЧТЕНИЯ ТЕКУЩЕГО АЯТА", heartNextStep33: "Текущая задача", heartPageProgress33: "Готовность страницы", heartPagePending33: "Загружаем шаг страницы…", heartPageGuidance33: "Сначала каждый аят читается 33 раза. После каждого нового аята весь накопленный отрывок читается связно 33 раза. Финальная связка — вся страница ×33.", heartConnectedTitle33: "Текущий шаг 33×", heartRevealComplete33: "Аят ×33", linked33CreditRecorded: "Правильное чтение засчитано: {count} из 33.", linked33StepComplete: "Этап 33× завершён. Переходим к следующему шагу.", linked33WrongVerse: "Сейчас нужен другой аят. Откройте текущий шаг методики.", linked33JoinStarted: "Связное чтение 33× начато. Читайте отрывок по порядку.", linked33JoinProgress: "В текущей связке прочитано {done} из {total} аятов.", linked33JoinCounted: "Связное чтение засчитано: {count} из 33.", linked33PageComplete: "Вся страница прочитана связно 33 раза. Методика завершена.", linked33OpenStep: "Начать текущий шаг", linked33ContinueStep: "Продолжить текущий шаг", linked33MethodComplete: "Методика 33× завершена"
  });

  Object.assign(translations.en, {
    hifzMethodLabel: "Choose a memorisation method", hifzMethodOption: "METHOD", hifzMethodOptionOne: "METHOD 01", hifzMethodOptionTwo: "METHOD 02", hifzMethod300Title: "300 repetitions", hifzMethod300Text: "100 + 100 + 100 for each verse", hifzMethod33Title: "33× with progressive linking", hifzMethod33Text: "Verse ×33 → linked passage ×33 → full page ×33", hifzMethodChanged300: "The 300-repetition method is selected.", hifzMethodChanged33: "The 33× progressive-linking method is selected.",
    memorizeIntro300: "Build the current page verse by verse: 300 accurate repetitions reveal each verse, and connected recitation secures the whole page.", memorizeIntro33: "Recite each verse 33 times. Then recite it 33 times together with every preceding verse; after the last verse, recite the complete page exactly 33 times.", linked33StagesLabel: "Steps in the 33-times method", linked33VerseStage: "Each verse", linked33JoinStage: "Progressive linked passage", linked33PageStage: "Complete page", linked33ProgressLabel: "Current step", linked33CurrentVerse: "Verse {reference} · {count} of 33", linked33CurrentJoin: "Linked from {start} to {end} · {count} of 33", linked33CurrentPage: "Complete page · {count} of 33", linked33AllComplete: "The page is secured with the 33× method.", heartRule33Title: "33× rule", heartRule33: "A complete accurate recitation without a hint is counted. The order is fixed: verse ×33, then that verse linked with every preceding verse ×33.", heartPracticeTitle33: "Complete the current 33× step", heartPracticeIntro33: "A single verse is checked here. For a linked step, the Mushaf opens and the microphone follows the verses continuously.", memoryLiveCounter33: "ACCURATE RECITATIONS OF THE CURRENT VERSE", heartNextStep33: "Current task", heartPageProgress33: "Page progress", heartPagePending33: "Loading the page step…", heartPageGuidance33: "First recite each verse 33 times. After every new verse, recite the entire accumulated passage continuously 33 times. The final linked passage is the complete page ×33.", heartConnectedTitle33: "Current 33× step", heartRevealComplete33: "Verse ×33", linked33CreditRecorded: "Accurate recitation counted: {count} of 33.", linked33StepComplete: "This 33× step is complete. Moving to the next step.", linked33WrongVerse: "A different verse is required now. Open the current method step.", linked33JoinStarted: "The linked 33× reading has started. Recite the passage in order.", linked33JoinProgress: "Read {done} of {total} verses in this linked passage.", linked33JoinCounted: "Linked recitation counted: {count} of 33.", linked33PageComplete: "The complete page was recited continuously 33 times. The method is complete.", linked33OpenStep: "Start the current step", linked33ContinueStep: "Continue the current step", linked33MethodComplete: "33× method complete"
  });

  Object.assign(translations.ar, {
    hifzMethodLabel: "اختر طريقة الحفظ", hifzMethodOption: "الطريقة", hifzMethodOptionOne: "الطريقة ٠١", hifzMethodOptionTwo: "الطريقة ٠٢", hifzMethod300Title: "٣٠٠ تكرار", hifzMethod300Text: "١٠٠ + ١٠٠ + ١٠٠ لكل آية", hifzMethod33Title: "٣٣ مرة مع الربط المتدرج", hifzMethod33Text: "الآية ×٣٣ ← الربط ×٣٣ ← الصفحة كاملة ×٣٣", hifzMethodChanged300: "اختيرت طريقة ٣٠٠ تكرار.", hifzMethodChanged33: "اختيرت طريقة ٣٣ مرة مع الربط المتدرج.",
    memorizeIntro300: "اجمع الصفحة الحالية آيةً آية: تظهر كل آية بعد ٣٠٠ تلاوة صحيحة، ثم تثبت الصفحة بالتلاوة المتصلة.", memorizeIntro33: "اقرأ كل آية ٣٣ مرة، ثم اقرأها مع جميع الآيات السابقة ٣٣ مرة؛ وبعد الآية الأخيرة اقرأ الصفحة كاملة ٣٣ مرة بالضبط.", linked33StagesLabel: "مراحل طريقة الثلاث والثلاثين", linked33VerseStage: "كل آية", linked33JoinStage: "الربط المتدرج", linked33PageStage: "الصفحة كاملة", linked33ProgressLabel: "الخطوة الحالية", linked33CurrentVerse: "الآية {reference} · {count} من ٣٣", linked33CurrentJoin: "الربط من {start} إلى {end} · {count} من ٣٣", linked33CurrentPage: "الصفحة كاملة · {count} من ٣٣", linked33AllComplete: "ثُبّتت الصفحة بطريقة ٣٣ مرة.", heartRule33Title: "قاعدة ٣٣", heartRule33: "تُحتسب التلاوة الكاملة الصحيحة بلا تلميح. والترتيب ثابت: الآية ٣٣ مرة، ثم ربطها بجميع ما قبلها ٣٣ مرة.", heartPracticeTitle33: "أكمل الخطوة الحالية من طريقة ٣٣ مرة", heartPracticeIntro33: "تُفحص الآية المفردة هنا. وعند خطوة الربط يُفتح المصحف ويتابع الميكروفون الآيات بلا انقطاع.", memoryLiveCounter33: "التلاوات الصحيحة للآية الحالية", heartNextStep33: "المهمة الحالية", heartPageProgress33: "تقدم الصفحة", heartPagePending33: "جارٍ تحميل خطوة الصفحة…", heartPageGuidance33: "تُقرأ كل آية أولًا ٣٣ مرة، ثم يُقرأ المقطع المتراكم كله متصلًا ٣٣ مرة بعد كل آية جديدة. ويكون الربط الأخير للصفحة كاملة ٣٣ مرة.", heartConnectedTitle33: "الخطوة الحالية من طريقة ٣٣", heartRevealComplete33: "الآية ×٣٣", linked33CreditRecorded: "احتُسبت التلاوة الصحيحة: {count} من ٣٣.", linked33StepComplete: "اكتملت هذه الخطوة من طريقة ٣٣، وننتقل إلى الخطوة التالية.", linked33WrongVerse: "المطلوب الآن آية أخرى. افتح الخطوة الحالية من الطريقة.", linked33JoinStarted: "بدأت التلاوة المتصلة بطريقة ٣٣. اقرأ المقطع بالترتيب.", linked33JoinProgress: "قُرئت {done} من {total} آيات في هذا المقطع المتصل.", linked33JoinCounted: "احتُسبت التلاوة المتصلة: {count} من ٣٣.", linked33PageComplete: "قُرئت الصفحة كاملة متصلة ٣٣ مرة، واكتملت الطريقة.", linked33OpenStep: "ابدأ الخطوة الحالية", linked33ContinueStep: "تابع الخطوة الحالية", linked33MethodComplete: "اكتملت طريقة ٣٣"
  });

  Object.assign(translations.ru, {
    hifzChoiceEyebrow: "СПОСОБ ОБУЧЕНИЯ", hifzChoiceTitle: "Как вы хотите выбирать методику?", hifzChoiceIntro: "Выбирайте сами или разрешите АЛЛИМ изучать ваши реальные занятия и предлагать персональный план.", hifzChoiceModeLabel: "Способ выбора методики", hifzManualMode: "Выбираю сам", hifzManualModeText: "Правила и темп определяете вы", hifzAdaptiveMode: "Персональный план", hifzAdaptiveModeText: "АЛЛИМ учится на ваших занятиях", hifzCoachEyebrow: "ПЕРСОНАЛЬНЫЙ НАСТАВНИК", hifzCoachSignalsLabel: "Сигналы персонального обучения", hifzCoachAttempts: "Учебных попыток", hifzCoachClean: "Без подсказок", hifzCoachCollecting: "Собираю учебный профиль", hifzCoachCollectingReason: "Первые рекомендации появятся после пяти реальных попыток.", hifzCoachRecommendation: "Рекомендуемый старт: {method}", hifzCoachFoundationReason: "Подсказки пока нужны часто — предлагаю укрепить точность большим числом повторений.", hifzCoachLinkedReason: "Чтение устойчиво без подсказок — можно усиливать последовательные связки.", hifzCoachTurkishReason: "Чтение устойчиво, а текущая страница подходит для пространственной сборки снизу вверх.", hifzAiRecommended: "Рекомендует АЛЛИМ", hifzChoiceChangedManual: "Ручной выбор методики включён.", hifzChoiceChangedAdaptive: "Персональный план включён. АЛЛИМ объяснит рекомендации, но не сменит методику без вас.",
    hifzMethodOptionThree: "МЕТОДИКА 03", hifzMethodTurkishTitle: "Турецкая кладка · снизу вверх", hifzMethodTurkishText: "Фундамент ×33 → пропуск → заполнение → стена ×33", hifzMethodChangedTurkish: "Выбрана турецкая кладка снизу вверх.", memorizeIntroTurkish: "Стройте страницу снизу вверх: нижний аят становится фундаментом, затем добавляйте верхний кирпич через один, восполняйте пробел и читайте всю собранную стену 33 раза.", turkishStagesLabel: "Этапы турецкой кладки", turkishFoundationStage: "Фундамент снизу", turkishGapStage: "Заполнить пробел", turkishWallStage: "Соединить стену", turkishProgressLabel: "Текущий кирпич", turkishCurrentFoundation: "Фундамент: аят {reference} · {count} из 33", turkishCurrentJump: "Верхний кирпич: аят {reference} · {count} из 33", turkishCurrentGap: "Заполнить пробел: аят {reference} · {count} из 33", turkishCurrentWall: "Соединить стену от {start} до {end} · {count} из 33", turkishCurrentPage: "Вся страница собрана · {count} из 33", turkishAllComplete: "Страница построена и закреплена 33 связными чтениями.", heartRuleTurkishTitle: "Правило кладки 33×", heartRuleTurkish: "Каждый кирпич и каждая связка засчитываются только после полного правильного чтения без подсказки. Порядок страницы идёт снизу вверх.", heartPracticeTitleTurkish: "Постройте текущий ряд страницы", heartPracticeIntroTurkish: "Одиночный аят проверяется здесь. Для соединения стены откроется мусхаф и микрофон проведёт по собранному отрывку.", memoryLiveCounterTurkish: "ПРАВИЛЬНЫЕ ЧТЕНИЯ ТЕКУЩЕГО КИРПИЧА", heartNextStepTurkish: "Следующий кирпич", heartPageProgressTurkish: "Готовность стены", heartPagePendingTurkish: "Загружаем схему страницы…", heartPageGuidanceTurkish: "Фундамент — нижний аят. Затем берём аят через один, восполняем пропущенный аят и соединяем всю стену до низа ×33. На вершине вся страница читается связно ×33.", heartConnectedTitleTurkish: "Собранная стена 33×", heartRevealCompleteTurkish: "Кирпич ×33", turkishCreditRecorded: "Кирпич закреплён: {count} из 33.", turkishStepComplete: "Кирпич закреплён. Переходим к следующему элементу стены.", turkishWrongVerse: "Сейчас нужен другой аят — откройте текущий кирпич.", turkishJoinStarted: "Связное чтение стены начато. Читайте отмеченный отрывок сверху вниз.", turkishJoinProgress: "В стене прочитано {done} из {total} аятов.", turkishJoinCounted: "Связное чтение стены засчитано: {count} из 33.", turkishPageComplete: "Страница собрана снизу вверх и прочитана связно 33 раза.", turkishOpenStep: "Начать текущий кирпич", turkishContinueStep: "Продолжить кладку", turkishMethodComplete: "Турецкая кладка страницы завершена"
  });

  Object.assign(translations.en, {
    hifzChoiceEyebrow: "LEARNING MODE", hifzChoiceTitle: "How would you like to choose a method?", hifzChoiceIntro: "Choose manually, or let ALLIM learn from real sessions and suggest a personal plan.", hifzChoiceModeLabel: "Method selection mode", hifzManualMode: "I choose", hifzManualModeText: "You control the rules and pace", hifzAdaptiveMode: "Personal plan", hifzAdaptiveModeText: "ALLIM learns from your sessions", hifzCoachEyebrow: "PERSONAL COACH", hifzCoachSignalsLabel: "Personal learning signals", hifzCoachAttempts: "Learning attempts", hifzCoachClean: "Without hints", hifzCoachCollecting: "Building your learning profile", hifzCoachCollectingReason: "The first recommendation appears after five real attempts.", hifzCoachRecommendation: "Suggested start: {method}", hifzCoachFoundationReason: "Hints are still frequent, so a higher-repetition accuracy phase is recommended.", hifzCoachLinkedReason: "Recitation is steady without hints, so progressive linking is a suitable next step.", hifzCoachTurkishReason: "Recitation is steady and the current page suits spatial bottom-up construction.", hifzAiRecommended: "Suggested by ALLIM", hifzChoiceChangedManual: "Manual method selection is on.", hifzChoiceChangedAdaptive: "Personal planning is on. ALLIM will explain recommendations but will not switch methods without you.",
    hifzMethodOptionThree: "METHOD 03", hifzMethodTurkishTitle: "Turkish wall · bottom-up", hifzMethodTurkishText: "Foundation ×33 → skip → fill → wall ×33", hifzMethodChangedTurkish: "The bottom-up Turkish wall method is selected.", memorizeIntroTurkish: "Build the page from the bottom: the final verse is the foundation, then add an upper brick across a gap, fill the missing verse, and recite the assembled wall 33 times.", turkishStagesLabel: "Turkish wall stages", turkishFoundationStage: "Bottom foundation", turkishGapStage: "Fill the gap", turkishWallStage: "Connect the wall", turkishProgressLabel: "Current brick", turkishCurrentFoundation: "Foundation: verse {reference} · {count} of 33", turkishCurrentJump: "Upper brick: verse {reference} · {count} of 33", turkishCurrentGap: "Fill the gap: verse {reference} · {count} of 33", turkishCurrentWall: "Connect the wall from {start} to {end} · {count} of 33", turkishCurrentPage: "Complete bottom-up page · {count} of 33", turkishAllComplete: "The page is built and secured with 33 connected recitations.", heartRuleTurkishTitle: "33× wall rule", heartRuleTurkish: "Each brick and linked passage counts only after a complete accurate recitation without a hint. The page is built from bottom to top.", heartPracticeTitleTurkish: "Build the current row", heartPracticeIntroTurkish: "A single verse is checked here. For a wall connection, the Mushaf opens and the microphone follows the assembled passage.", memoryLiveCounterTurkish: "ACCURATE RECITATIONS OF THE CURRENT BRICK", heartNextStepTurkish: "Next brick", heartPageProgressTurkish: "Wall progress", heartPagePendingTurkish: "Loading the page plan…", heartPageGuidanceTurkish: "The bottom verse is the foundation. Then take a verse across a gap, fill the skipped verse, and connect the whole wall to the bottom ×33. At the top, recite the complete page continuously ×33.", heartConnectedTitleTurkish: "Assembled wall 33×", heartRevealCompleteTurkish: "Brick ×33", turkishCreditRecorded: "Brick secured: {count} of 33.", turkishStepComplete: "Brick secured. Moving to the next wall element.", turkishWrongVerse: "A different verse is required now. Open the current brick.", turkishJoinStarted: "Connected wall recitation started. Read the selected passage from top to bottom.", turkishJoinProgress: "Read {done} of {total} verses in the wall.", turkishJoinCounted: "Connected wall recitation counted: {count} of 33.", turkishPageComplete: "The page was built bottom-up and recited continuously 33 times.", turkishOpenStep: "Start the current brick", turkishContinueStep: "Continue building", turkishMethodComplete: "Turkish page wall complete"
  });

  Object.assign(translations.ar, {
    hifzChoiceEyebrow: "نمط التعلّم", hifzChoiceTitle: "كيف تريد اختيار طريقة الحفظ؟", hifzChoiceIntro: "اختر بنفسك، أو دع ALLIM يتعلّم من جلساتك الفعلية ويقترح خطة شخصية.", hifzChoiceModeLabel: "نمط اختيار الطريقة", hifzManualMode: "أختار بنفسي", hifzManualModeText: "أنت تحدد القواعد والوتيرة", hifzAdaptiveMode: "خطة شخصية", hifzAdaptiveModeText: "يتعلّم ALLIM من جلساتك", hifzCoachEyebrow: "المرشد الشخصي", hifzCoachSignalsLabel: "مؤشرات التعلّم الشخصي", hifzCoachAttempts: "محاولات التعلّم", hifzCoachClean: "بلا تلميح", hifzCoachCollecting: "أبني ملف تعلّمك", hifzCoachCollectingReason: "يظهر الاقتراح الأول بعد خمس محاولات فعلية.", hifzCoachRecommendation: "البداية المقترحة: {method}", hifzCoachFoundationReason: "ما زالت التلميحات كثيرة؛ لذا يُقترح طور دقة بتكرار أكبر.", hifzCoachLinkedReason: "التلاوة مستقرة بلا تلميحات؛ فالربط المتدرج خطوة مناسبة.", hifzCoachTurkishReason: "التلاوة مستقرة والصفحة الحالية مناسبة للبناء المكاني من أسفل إلى أعلى.", hifzAiRecommended: "اقتراح ALLIM", hifzChoiceChangedManual: "تم تفعيل الاختيار اليدوي.", hifzChoiceChangedAdaptive: "تم تفعيل الخطة الشخصية. سيشرح ALLIM اقتراحه ولن يغيّر الطريقة دون موافقتك.",
    hifzMethodOptionThree: "الطريقة ٠٣", hifzMethodTurkishTitle: "البناء التركي · من أسفل إلى أعلى", hifzMethodTurkishText: "الأساس ×٣٣ ← تخطٍّ ← ملء ← بناء ×٣٣", hifzMethodChangedTurkish: "اختيرت طريقة البناء التركي من أسفل إلى أعلى.", memorizeIntroTurkish: "ابن الصفحة من أسفلها: تكون الآية الأخيرة أساسًا، ثم ضع لبنة علوية مع ترك فراغ، واملأ الآية الناقصة، واقرأ البناء المتصل ٣٣ مرة.", turkishStagesLabel: "مراحل البناء التركي", turkishFoundationStage: "الأساس من أسفل", turkishGapStage: "ملء الفراغ", turkishWallStage: "ربط البناء", turkishProgressLabel: "اللبنة الحالية", turkishCurrentFoundation: "الأساس: الآية {reference} · {count} من ٣٣", turkishCurrentJump: "اللبنة العليا: الآية {reference} · {count} من ٣٣", turkishCurrentGap: "ملء الفراغ: الآية {reference} · {count} من ٣٣", turkishCurrentWall: "ربط البناء من {start} إلى {end} · {count} من ٣٣", turkishCurrentPage: "الصفحة كاملة من أسفل إلى أعلى · {count} من ٣٣", turkishAllComplete: "اكتمل بناء الصفحة وثُبّتت بثلاث وثلاثين تلاوة متصلة.", heartRuleTurkishTitle: "قاعدة البناء ٣٣", heartRuleTurkish: "لا تُحتسب اللبنة ولا الوصلة إلا بعد تلاوة كاملة صحيحة بلا تلميح. ويبدأ بناء الصفحة من أسفل إلى أعلى.", heartPracticeTitleTurkish: "ابن الصف الحالي", heartPracticeIntroTurkish: "تُفحص الآية المفردة هنا. وعند ربط البناء يُفتح المصحف ويتابع الميكروفون المقطع المجمع.", memoryLiveCounterTurkish: "التلاوات الصحيحة للبنة الحالية", heartNextStepTurkish: "اللبنة التالية", heartPageProgressTurkish: "تقدم البناء", heartPagePendingTurkish: "جارٍ تحميل مخطط الصفحة…", heartPageGuidanceTurkish: "الآية السفلى هي الأساس. ثم تؤخذ آية مع ترك فراغ، وتُملأ الآية المتروكة، ويُربط البناء كله إلى الأسفل ٣٣ مرة. وعند القمة تُقرأ الصفحة كاملة متصلة ٣٣ مرة.", heartConnectedTitleTurkish: "البناء المتصل ×٣٣", heartRevealCompleteTurkish: "اللبنة ×٣٣", turkishCreditRecorded: "ثُبّتت اللبنة: {count} من ٣٣.", turkishStepComplete: "ثُبّتت اللبنة، وننتقل إلى العنصر التالي.", turkishWrongVerse: "المطلوب الآن آية أخرى. افتح اللبنة الحالية.", turkishJoinStarted: "بدأت تلاوة البناء المتصل. اقرأ المقطع المحدد من أعلى إلى أسفل.", turkishJoinProgress: "قُرئت {done} من {total} آيات في البناء.", turkishJoinCounted: "احتُسبت تلاوة البناء المتصل: {count} من ٣٣.", turkishPageComplete: "بُنيت الصفحة من أسفل إلى أعلى وقُرئت متصلة ٣٣ مرة.", turkishOpenStep: "ابدأ اللبنة الحالية", turkishContinueStep: "تابع البناء", turkishMethodComplete: "اكتمل بناء الصفحة بالطريقة التركية"
  });

  Object.assign(translations.ru, {
    hifzMethodOptionFour: "МЕТОДИКА 04", hifzMethodLawhTitle: "Ляух · рукописная страница", hifzMethodLawhText: "Написать → сверить → читать вслух → воспроизвести", hifzMethodChangedLawh: "Выбрана мавританская методика Ляух.", memorizeIntroLawh: "Перепишите выбранный отрывок своей рукой, проговаривая слова вслух; затем сфотографируйте, точно сверьте и заучивайте по личной рукописной странице.", lawhEyebrow: "МАВРИТАНСКАЯ ТРАДИЦИЯ · ЦИФРОВОЙ ЛЯУХ", lawhTitle: "Ваш личный Коран, написанный вашей рукой", lawhIntro: "Перепишите выбранный отрывок на разлинованную бумагу, произнося слова вслух. Затем сфотографируйте лист: АЛЛИМ сохранит личную страницу и подготовит её к построчной проверке.", lawhStepsLabel: "Этапы метода Ляух", lawhStepWrite: "Напишите рукой", lawhStepWriteText: "Сверяйтесь с мусхафом и произносите вслух", lawhStepCapture: "Сфотографируйте", lawhStepCaptureText: "Снимок сверху, без теней и обрезанных строк", lawhStepVerify: "Сверьте текст", lawhStepVerifyText: "Ни одна буква не принимается без подтверждения", lawhStepRecall: "Читайте и пишите по памяти", lawhStepRecallText: "АЛЛИМ планирует возвраты к личной странице", lawhUploadTitle: "Загрузить или снять рукописную страницу", lawhUploadText: "JPG, PNG или HEIC · фотография пока обрабатывается только на устройстве", lawhPreviewAlt: "Рукописная страница Ляух", lawhPhotoChecking: "Проверяем качество снимка…", lawhPhotoReady: "Снимок подходит для следующего этапа", lawhPhotoLowQuality: "Лучше переснять страницу", lawhPhotoReadyDetail: "{width} × {height} px · следующий этап — безопасная построчная сверка с эталонным мусхафом.", lawhPhotoLowDetail: "{width} × {height} px · нужен более чёткий снимок не меньше 1200 px по длинной стороне.", lawhPhotoUnreadable: "Этот формат не удалось открыть на устройстве.", lawhSafetyTitle: "Сначала точность, затем заучивание", lawhSafetyText: "Автораспознавание арабского почерка не должно незаметно исправлять или подменять текст Корана. Ученик или преподаватель подтверждает каждую строку по эталонному мусхафу."
  });
  Object.assign(translations.en, {
    hifzMethodOptionFour: "METHOD 04", hifzMethodLawhTitle: "Lawh · handwritten page", hifzMethodLawhText: "Write → verify → recite aloud → recall", hifzMethodChangedLawh: "The Mauritanian Lawh method is selected.", memorizeIntroLawh: "Copy the selected passage by hand while voicing the words, then photograph it, verify every line, and memorise from your personal handwritten page.", lawhEyebrow: "MAURITANIAN TRADITION · DIGITAL LAWH", lawhTitle: "Your personal Qur’an, written by your hand", lawhIntro: "Copy the selected passage onto lined paper while reciting aloud. Then photograph the sheet: ALLIM will prepare the personal page for line-by-line verification.", lawhStepsLabel: "Lawh method stages", lawhStepWrite: "Write by hand", lawhStepWriteText: "Check against the Mushaf and recite aloud", lawhStepCapture: "Photograph it", lawhStepCaptureText: "Shoot from above, without shadows or cropped lines", lawhStepVerify: "Verify the text", lawhStepVerifyText: "No letter is accepted without confirmation", lawhStepRecall: "Recite and rewrite from memory", lawhStepRecallText: "ALLIM schedules returns to your personal page", lawhUploadTitle: "Upload or photograph a handwritten page", lawhUploadText: "JPG, PNG or HEIC · the photo is currently processed only on this device", lawhPreviewAlt: "Handwritten Lawh page", lawhPhotoChecking: "Checking photo quality…", lawhPhotoReady: "The photo is suitable for the next stage", lawhPhotoLowQuality: "Please retake the page", lawhPhotoReadyDetail: "{width} × {height} px · the next stage is safe line-by-line verification against the reference Mushaf.", lawhPhotoLowDetail: "{width} × {height} px · use a sharper image with at least 1200 px on the long edge.", lawhPhotoUnreadable: "This image format could not be opened on the device.", lawhSafetyTitle: "Accuracy before memorisation", lawhSafetyText: "Arabic handwriting recognition must never silently correct or replace Qur’anic text. The learner or teacher confirms every line against the reference Mushaf."
  });
  Object.assign(translations.ar, {
    hifzMethodOptionFour: "الطريقة ٠٤", hifzMethodLawhTitle: "اللوح · الصفحة بخط اليد", hifzMethodLawhText: "اكتب ← صحح ← اقرأ جهرًا ← استظهر", hifzMethodChangedLawh: "اختيرت طريقة اللوح الموريتانية.", memorizeIntroLawh: "اكتب المقطع المختار بيدك مع نطق الكلمات، ثم صوّره وصحّح كل سطر واحفظ من صفحتك الشخصية المكتوبة بخطك.", lawhEyebrow: "الطريقة الموريتانية · اللوح الرقمي", lawhTitle: "مصحفك الشخصي المكتوب بيدك", lawhIntro: "اكتب المقطع المختار على ورق مسطّر مع القراءة جهرًا، ثم صوّر الورقة ليهيئ ALLIM الصفحة الشخصية للمراجعة سطرًا سطرًا.", lawhStepsLabel: "مراحل طريقة اللوح", lawhStepWrite: "اكتب بيدك", lawhStepWriteText: "قابل بالمصحف واقرأ جهرًا", lawhStepCapture: "صوّر الصفحة", lawhStepCaptureText: "من أعلى بلا ظلال ولا سطور مقطوعة", lawhStepVerify: "صحح النص", lawhStepVerifyText: "لا يُعتمد حرف بلا تأكيد", lawhStepRecall: "اقرأ واكتب غيبًا", lawhStepRecallText: "يخطط ALLIM للعودة إلى صفحتك", lawhUploadTitle: "حمّل أو صوّر الصفحة المكتوبة", lawhUploadText: "JPG أو PNG أو HEIC · تعالج الصورة الآن على هذا الجهاز فقط", lawhPreviewAlt: "صفحة لوح مكتوبة باليد", lawhPhotoChecking: "جارٍ فحص جودة الصورة…", lawhPhotoReady: "الصورة مناسبة للمرحلة التالية", lawhPhotoLowQuality: "الأفضل إعادة تصوير الصفحة", lawhPhotoReadyDetail: "{width} × {height} بكسل · المرحلة التالية مقابلة آمنة سطرًا سطرًا بالمصحف المرجع.", lawhPhotoLowDetail: "{width} × {height} بكسل · التقط صورة أوضح لا يقل ضلعها الطويل عن ١٢٠٠ بكسل.", lawhPhotoUnreadable: "تعذر فتح صيغة الصورة على هذا الجهاز.", lawhSafetyTitle: "الدقة قبل الحفظ", lawhSafetyText: "يجب ألا يصحح التعرف الآلي على الخط العربي نص القرآن أو يستبدله خفية. يؤكد الطالب أو المعلم كل سطر بمقابلته بالمصحف المرجع."
  });

  Object.assign(translations.ru, {
    lawhTitle: "Ваша рукописная страница для заучивания", lawhIntro: "Перепишите выбранный отрывок на разлинованную бумагу, произнося слова вслух. Снимок остаётся на этом устройстве; сейчас АЛЛИМ помогает проверить качество фото и пройти ручную сверку.", lawhStepRecallText: "Отмечайте чтение вслух и воспроизведение без подсказки", lawhVerifyTitle: "Сверьте рукописную страницу", lawhVerifyIntro: "АЛЛИМ не изменяет текст автоматически: подтвердите каждый шаг.", lawhCheckFrame: "Все строки видны, теней и обрезанных краёв нет", lawhCheckText: "Каждая строка сверена с эталонным мусхафом", lawhCheckRead: "Исправления внесены, страница ещё раз прочитана вслух", lawhVerifyAction: "Подтвердить сверку", lawhVerified: "Сверка подтверждена. Можно перейти к заучиванию.", lawhPracticeTitle: "Закрепляйте по своей странице", lawhPracticeIntro: "Отмечайте только фактически выполненные повторы.", lawhPracticeMetricsLabel: "Прогресс метода Ляух", lawhReadCount: "Чтений вслух", lawhRecallCount: "Без подсказки", lawhMarkRead: "Отметить чтение вслух", lawhMarkRecall: "Отметить воспроизведение по памяти", lawhReadRecorded: "Чтение вслух отмечено.", lawhRecallRecorded: "Воспроизведение без подсказки отмечено.", lawhManualNote: "Сейчас это честный самоотчёт. Автопроверка арабского почерка ещё не подключена."
  });
  Object.assign(translations.en, {
    lawhTitle: "Your handwritten memorisation page", lawhIntro: "Copy the selected passage onto lined paper while reciting aloud. The photo stays on this device; ALLIM currently checks image quality and guides a manual verification.", lawhStepRecallText: "Track aloud reading and recall without a hint", lawhVerifyTitle: "Verify the handwritten page", lawhVerifyIntro: "ALLIM does not alter the text automatically. Confirm every step.", lawhCheckFrame: "Every line is visible, without shadows or cropped edges", lawhCheckText: "Every line was compared with the reference Mushaf", lawhCheckRead: "Corrections were made and the page was read aloud again", lawhVerifyAction: "Confirm verification", lawhVerified: "Verification confirmed. You can begin memorising.", lawhPracticeTitle: "Reinforce from your own page", lawhPracticeIntro: "Record only repetitions you actually completed.", lawhPracticeMetricsLabel: "Lawh method progress", lawhReadCount: "Read aloud", lawhRecallCount: "Without hints", lawhMarkRead: "Record an aloud reading", lawhMarkRecall: "Record recall from memory", lawhReadRecorded: "Aloud reading recorded.", lawhRecallRecorded: "Recall without a hint recorded.", lawhManualNote: "This is currently an honest self-report. Automatic Arabic-handwriting checking is not connected yet."
  });
  Object.assign(translations.ar, {
    lawhTitle: "صفحتك المكتوبة بيدك للحفظ", lawhIntro: "اكتب المقطع المختار على ورق مسطّر مع القراءة جهرًا. تبقى الصورة على هذا الجهاز؛ ويفحص ALLIM حاليًا جودة الصورة ويرشدك إلى المراجعة اليدوية.", lawhStepRecallText: "سجّل القراءة جهرًا والاستظهار بلا تلميح", lawhVerifyTitle: "راجع الصفحة المكتوبة بخط اليد", lawhVerifyIntro: "لا يغيّر ALLIM النص آليًا. أكّد كل خطوة.", lawhCheckFrame: "جميع السطور ظاهرة بلا ظلال أو حواف مقطوعة", lawhCheckText: "قوبل كل سطر بالمصحف المرجع", lawhCheckRead: "صُححت الأخطاء وقُرئت الصفحة جهرًا مرة أخرى", lawhVerifyAction: "تأكيد المراجعة", lawhVerified: "تم تأكيد المراجعة. يمكنك البدء بالحفظ.", lawhPracticeTitle: "ثبّت من صفحتك", lawhPracticeIntro: "سجّل فقط التكرارات التي أنجزتها فعلًا.", lawhPracticeMetricsLabel: "تقدم طريقة اللوح", lawhReadCount: "قراءة جهرية", lawhRecallCount: "بلا تلميح", lawhMarkRead: "تسجيل قراءة جهرية", lawhMarkRecall: "تسجيل الاستظهار من الذاكرة", lawhReadRecorded: "سُجلت القراءة الجهرية.", lawhRecallRecorded: "سُجل الاستظهار بلا تلميح.", lawhManualNote: "هذا حاليًا تقرير ذاتي صريح. لم يُربط بعد التحقق الآلي من الخط العربي."
  });

  Object.assign(translations.ru, {
    lawhStorageTitle: "Личная локальная библиотека", lawhStorageIdle: "Загрузите чёткий снимок. Сохранение вы подтвердите отдельно.", lawhStorageReady: "Снимок готов к локальному сохранению.", lawhStorageSaving: "Сохраняем только на этом устройстве…", lawhStorageSaved: "Снимок сохранён в личной библиотеке этого устройства.", lawhStorageRestored: "Страница восстановлена из локальной библиотеки.", lawhStorageError: "Не удалось сохранить снимок. Проверьте свободное место и разрешения браузера.", lawhStorageUnavailable: "Локальная библиотека недоступна в этом режиме браузера.", lawhSaveLocal: "Сохранить на этом устройстве", lawhSavedLocal: "Сохранено на устройстве", lawhLibraryEyebrow: "ЛИЧНЫЕ СТРАНИЦЫ", lawhLibraryTitle: "Ваш рукописный Коран на этом устройстве", lawhLibraryIntro: "Снимки не отправляются на сервер. Откройте страницу и продолжите с того же места.", lawhLibraryEmpty: "Пока нет сохранённых рукописных страниц.", lawhLibraryLoading: "Загружаем личную библиотеку…", lawhLibraryReference: "Отрывок {reference}", lawhLibraryProgress: "Вслух: {read} · без подсказки: {recall}", lawhLibraryVerified: "Сверено с мусхафом", lawhLibraryUnverified: "Ожидает сверки", lawhLibraryOpen: "Открыть", lawhLibraryDelete: "Удалить фото", lawhDeleteConfirm: "Удалить это фото из локальной библиотеки? Счётчики упражнений сохранятся.", lawhDeleted: "Фото удалено с этого устройства."
  });
  Object.assign(translations.en, {
    lawhStorageTitle: "Private local library", lawhStorageIdle: "Upload a clear photo. You confirm local storage separately.", lawhStorageReady: "The photo is ready to be saved locally.", lawhStorageSaving: "Saving only on this device…", lawhStorageSaved: "The photo is saved in this device's private library.", lawhStorageRestored: "The page was restored from the local library.", lawhStorageError: "The photo could not be saved. Check free space and browser permissions.", lawhStorageUnavailable: "The local library is unavailable in this browser mode.", lawhSaveLocal: "Save on this device", lawhSavedLocal: "Saved on device", lawhLibraryEyebrow: "PERSONAL PAGES", lawhLibraryTitle: "Your handwritten Qur’an on this device", lawhLibraryIntro: "Photos are not sent to a server. Open a page and continue where you stopped.", lawhLibraryEmpty: "No handwritten pages have been saved yet.", lawhLibraryLoading: "Loading your private library…", lawhLibraryReference: "Passage {reference}", lawhLibraryProgress: "Aloud: {read} · without hints: {recall}", lawhLibraryVerified: "Verified against the Mushaf", lawhLibraryUnverified: "Awaiting verification", lawhLibraryOpen: "Open", lawhLibraryDelete: "Delete photo", lawhDeleteConfirm: "Delete this photo from the local library? Practice counters will remain.", lawhDeleted: "The photo was removed from this device."
  });
  Object.assign(translations.ar, {
    lawhStorageTitle: "مكتبة محلية خاصة", lawhStorageIdle: "حمّل صورة واضحة، ثم أكّد الحفظ المحلي بشكل منفصل.", lawhStorageReady: "الصورة جاهزة للحفظ المحلي.", lawhStorageSaving: "جارٍ الحفظ على هذا الجهاز فقط…", lawhStorageSaved: "حُفظت الصورة في مكتبة هذا الجهاز الخاصة.", lawhStorageRestored: "استُعيدت الصفحة من المكتبة المحلية.", lawhStorageError: "تعذر حفظ الصورة. تحقق من المساحة وأذونات المتصفح.", lawhStorageUnavailable: "المكتبة المحلية غير متاحة في وضع المتصفح هذا.", lawhSaveLocal: "احفظ على هذا الجهاز", lawhSavedLocal: "محفوظ على الجهاز", lawhLibraryEyebrow: "الصفحات الشخصية", lawhLibraryTitle: "مصحفك المكتوب بيدك على هذا الجهاز", lawhLibraryIntro: "لا تُرسل الصور إلى الخادم. افتح صفحة وتابع من موضع توقفك.", lawhLibraryEmpty: "لا توجد صفحات مكتوبة محفوظة بعد.", lawhLibraryLoading: "جارٍ تحميل مكتبتك الخاصة…", lawhLibraryReference: "المقطع {reference}", lawhLibraryProgress: "جهرًا: {read} · بلا تلميح: {recall}", lawhLibraryVerified: "روجع بالمصحف", lawhLibraryUnverified: "ينتظر المراجعة", lawhLibraryOpen: "افتح", lawhLibraryDelete: "احذف الصورة", lawhDeleteConfirm: "أتريد حذف هذه الصورة من المكتبة المحلية؟ ستبقى عدادات التدريب.", lawhDeleted: "حُذفت الصورة من هذا الجهاز."
  });

  var reciters = [
    { id: "husary", path: "Husary_128kbps", names: { ru: "Махмуд Халиль аль-Хусари", en: "Mahmoud Khalil Al-Husary", ar: "محمود خليل الحصري" } },
    { id: "alafasy", path: "Alafasy_128kbps", names: { ru: "Мишари Рашид аль-Афаси", en: "Mishari Rashid al-Afasy", ar: "مشاري راشد العفاسي" } },
    { id: "minshawi", path: "Minshawy_Murattal_128kbps", names: { ru: "Мухаммад Сиддик аль-Миншави", en: "Muhammad Siddiq al-Minshawi", ar: "محمد صديق المنشاوي" } },
    { id: "abdulbasit", path: "Abdul_Basit_Murattal_192kbps", names: { ru: "Абдуль-Басит Абдус-Самад", en: "Abdul Basit Abdus-Samad", ar: "عبد الباسط عبد الصمد" } },
    { id: "muaiqly", path: "MaherAlMuaiqly128kbps", names: { ru: "Махер аль-Муайкли", en: "Maher al-Muaiqly", ar: "ماهر المعيقلي" } },
    { id: "sudais", path: "Abdurrahmaan_As-Sudais_192kbps", names: { ru: "Абдуррахман ас-Судайс", en: "Abdur-Rahman as-Sudais", ar: "عبد الرحمن السديس" } },
    { id: "basfar", path: "Abdullah_Basfar_192kbps", names: { ru: "Абдуллах Басфар", en: "Abdullah Basfar", ar: "عبد الله بصفر" } },
    { id: "luhaidan", provider: "chapter", chapterBase: "https://server8.mp3quran.net/lhdan/", names: { ru: "Мухаммад аль-Люхайдан · сура целиком", en: "Muhammad al-Luhaidan · complete surah", ar: "محمد اللحيدان · السورة كاملة" } },
    { id: "salman-utaybi", provider: "chapter", chapterBase: "https://server11.mp3quran.net/salman/", availableSurahs: [1,2,3,10,11,14,16,19,23,25,32,36,38,39,40,46,48,50,52,55,56,58,59,61,62,63,64,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114], names: { ru: "Салман аль-Утайби · сура целиком", en: "Salman al-Utaybi · complete surah", ar: "سلمان العتيبي · السورة كاملة" } },
    { id: "shatri", path: "Abu_Bakr_Ash-Shaatree_128kbps", names: { ru: "Абу Бакр аш-Шатри", en: "Abu Bakr al-Shatri", ar: "أبو بكر الشاطري" } },
    { id: "dussary", path: "Yasser_Ad-Dussary_128kbps", names: { ru: "Ясир ад-Дусари", en: "Yasser ad-Dosari", ar: "ياسر الدوسري" } }
  ];

  var analysisWords = [
    {
      ar: "ذَٰلِكَ", translit: "dhālika", root: "—",
      meaning: { ru: "это / то", en: "that", ar: "ذلك" },
      grammar: { ru: "указательное местоимение, м. р., ед. ч.", en: "masculine singular demonstrative pronoun", ar: "اسم إشارة للمفرد المذكر" }
    },
    {
      ar: "ٱلْكِتَـٰبُ", translit: "al-kitābu", root: "ك ت ب",
      meaning: { ru: "Писание / Книга", en: "the Book", ar: "الكتاب" },
      grammar: { ru: "определённое существительное, м. р., именительный падеж", en: "definite masculine noun, nominative", ar: "اسم مذكر معرفة مرفوع" }
    },
    {
      ar: "لَا", translit: "lā", root: "—",
      meaning: { ru: "нет / не", en: "no", ar: "لا" },
      grammar: { ru: "отрицательная частица", en: "negative particle", ar: "حرف نفي" }
    },
    {
      ar: "رَيْبَ", translit: "rayba", root: "ر ي ب",
      meaning: { ru: "сомнение", en: "doubt", ar: "شكّ" },
      grammar: { ru: "существительное, м. р., винительный падеж", en: "masculine noun, accusative", ar: "اسم مذكر منصوب" }
    },
    {
      ar: "فِيهِ", translit: "fīhi", root: "—",
      meaning: { ru: "в нём", en: "in it", ar: "فيه" },
      grammar: { ru: "предлог + местоимение 3-го лица, м. р., ед. ч.", en: "preposition + 3rd person masculine singular pronoun", ar: "جار ومجرور؛ في + ضمير الغائب المفرد المذكر" }
    },
    {
      ar: "هُدًى", translit: "hudan", root: "ه د ي",
      meaning: { ru: "руководство", en: "guidance", ar: "هداية" },
      grammar: { ru: "неопределённое существительное, м. р., именительный падеж", en: "indefinite masculine noun, nominative", ar: "اسم مذكر نكرة مرفوع" }
    },
    {
      ar: "لِّلْمُتَّقِينَ", translit: "lil-muttaqīna", root: "و ق ي",
      meaning: { ru: "для богобоязненных", en: "for the God-conscious", ar: "للمتقين" },
      grammar: { ru: "предлог لِ + активное причастие VIII породы, м. р., мн. ч., родительный падеж", en: "preposition li + form VIII active participle, masculine plural, genitive", ar: "اللام حرف جر + اسم فاعل من الباب الثامن، جمع مذكر مجرور" }
    }
  ];

  var reviewedRussianInterlinear = {
    "91:7": [
      { translit: "wanafsin", ru: "и душой", en: "and the soul" },
      { translit: "wamā", ru: "и Тем, Кто", en: "and He Who" },
      { translit: "sawwāhā", ru: "соразмерил её", en: "proportioned it" }
    ]
  };

  var russianSurahNames = [
    "", "Аль-Фатиха", "Аль-Бакара", "Али Имран", "Ан-Ниса", "Аль-Маида", "Аль-Анам", "Аль-Араф", "Аль-Анфаль", "Ат-Тауба", "Юнус", "Худ", "Юсуф", "Ар-Рад", "Ибрахим", "Аль-Хиджр", "Ан-Нахль", "Аль-Исра", "Аль-Кахф", "Марьям", "Та Ха", "Аль-Анбия", "Аль-Хадж", "Аль-Муминун", "Ан-Нур", "Аль-Фуркан", "Аш-Шуара", "Ан-Намль", "Аль-Касас", "Аль-Анкабут", "Ар-Рум", "Лукман", "Ас-Саджда", "Аль-Ахзаб", "Саба", "Фатыр", "Ясин", "Ас-Саффат", "Сад", "Аз-Зумар", "Гафир", "Фуссилат", "Аш-Шура", "Аз-Зухруф", "Ад-Духан", "Аль-Джасия", "Аль-Ахкаф", "Мухаммад", "Аль-Фатх", "Аль-Худжурат", "Каф", "Аз-Зарият", "Ат-Тур", "Ан-Наджм", "Аль-Камар", "Ар-Рахман", "Аль-Вакиа", "Аль-Хадид", "Аль-Муджадиля", "Аль-Хашр", "Аль-Мумтахана", "Ас-Сафф", "Аль-Джумуа", "Аль-Мунафикун", "Ат-Тагабун", "Ат-Талак", "Ат-Тахрим", "Аль-Мульк", "Аль-Калам", "Аль-Хакка", "Аль-Мааридж", "Нух", "Аль-Джинн", "Аль-Муззаммиль", "Аль-Муддассир", "Аль-Кияма", "Аль-Инсан", "Аль-Мурсалят", "Ан-Наба", "Ан-Назиат", "Абаса", "Ат-Таквир", "Аль-Инфитар", "Аль-Мутаффифин", "Аль-Иншикак", "Аль-Бурудж", "Ат-Тарик", "Аль-Аля", "Аль-Гашия", "Аль-Фаджр", "Аль-Балад", "Аш-Шамс", "Аль-Лейль", "Ад-Духа", "Аш-Шарх", "Ат-Тин", "Аль-Алак", "Аль-Кадр", "Аль-Баййина", "Аз-Зальзаля", "Аль-Адият", "Аль-Кариа", "Ат-Такасур", "Аль-Аср", "Аль-Хумаза", "Аль-Филь", "Курайш", "Аль-Маун", "Аль-Каусар", "Аль-Кафирун", "Ан-Наср", "Аль-Масад", "Аль-Ихляс", "Аль-Фаляк", "Ан-Нас"
  ];

  var corpus = window.QuranCompanionData && window.QuranCompanionData.surahs ? window.QuranCompanionData.surahs : [];
  var tafsirData = window.QuranCompanionTafsir || { source: {}, entries: {} };
  var fawaidData = window.QuranCompanionFawaid || { entries: {} };
  var state = loadState();
  var launchParams = new URLSearchParams(window.location.search);
  var teacherAssessmentRequested = launchParams.get("assessment") === "teacher";
  var teacherAssessmentMode = false;
  if (!Array.isArray(state.savedVerses)) state.savedVerses = [];
  if (!Array.isArray(state.reviewQueue)) state.reviewQueue = [];
  if (!state.activity || typeof state.activity !== "object" || Array.isArray(state.activity)) state.activity = {};
  if (!state.heartMushaf || typeof state.heartMushaf !== "object" || Array.isArray(state.heartMushaf)) state.heartMushaf = { units: {}, pages: {}, linked33Pages: {}, turkishWallPages: {} };
  if (!state.heartMushaf.units || typeof state.heartMushaf.units !== "object" || Array.isArray(state.heartMushaf.units)) state.heartMushaf.units = {};
  if (!state.heartMushaf.pages || typeof state.heartMushaf.pages !== "object" || Array.isArray(state.heartMushaf.pages)) state.heartMushaf.pages = {};
  if (!state.heartMushaf.linked33Pages || typeof state.heartMushaf.linked33Pages !== "object" || Array.isArray(state.heartMushaf.linked33Pages)) state.heartMushaf.linked33Pages = {};
  if (!state.heartMushaf.turkishWallPages || typeof state.heartMushaf.turkishWallPages !== "object" || Array.isArray(state.heartMushaf.turkishWallPages)) state.heartMushaf.turkishWallPages = {};
  if (!state.heartMushaf.lawhPages || typeof state.heartMushaf.lawhPages !== "object" || Array.isArray(state.heartMushaf.lawhPages)) state.heartMushaf.lawhPages = {};
  if (["foundation300", "linked33", "turkishWall33", "mauritanianLawh"].indexOf(state.memorizationMethod) < 0) state.memorizationMethod = "foundation300";
  state.hifzCoach = normalizeHifzCoach(state.hifzCoach);
  if (!state.lifePractice || typeof state.lifePractice !== "object" || Array.isArray(state.lifePractice)) state.lifePractice = { entries: [] };
  if (!Array.isArray(state.lifePractice.entries)) state.lifePractice.entries = [];
  state.autoAdvance = state.autoAdvance !== false;
  state.soundCues = state.soundCues !== false;
  state.strictCorrection = state.strictCorrection !== false;
  if (["auto", "browser", "quran"].indexOf(state.recognitionMode) < 0) state.recognitionMode = "auto";
  if (!state.recognitionModeExplicit) state.recognitionMode = "auto";
  if (!reciters.some(function (reciter) { return reciter.id === state.selectedReciter; })) state.selectedReciter = "husary";
  state.audioRepeat = state.audioRepeat === true;
  state.showInterlinear = state.showInterlinear === true;
  if (["classic", "modern", "readable"].indexOf(state.mushafFont) < 0) state.mushafFont = "classic";
  if (["ivory", "white", "sage", "mist", "sky"].indexOf(state.mushafPaper) < 0) state.mushafPaper = "ivory";
  if (["charcoal", "emerald", "navy", "sepia"].indexOf(state.mushafInk) < 0) state.mushafInk = "charcoal";
  state.recitationFlow = state.recitationFlowExplicit ? (state.recitationFlow === "continuous" ? "continuous" : "single") : "continuous";
  state.dailyGoal = [1, 2, 3, 5].indexOf(Number(state.dailyGoal)) >= 0 ? Number(state.dailyGoal) : 1;
  var toastTimer = null;
  var currentSurah = null;
  var currentVerse = null;
  var currentWords = [];
  var interlinearWordCache = Object.create(null);
  var interlinearPending = Object.create(null);
  var interlinearRequestId = 0;
  var verseTranslationCache = Object.create(null);
  var verseTranslationPending = Object.create(null);
  var verseTranslationRequestId = 0;
  var recognition = null;
  var isListening = false;
  var userStoppedRecognition = false;
  var recognitionHadError = false;
  var lastTranscript = "";
  var lastMatchedCount = 0;
  var recognitionSessionCounted = false;
  var readingVerseCounted = false;
  var recognitionTitleKey = "micReady";
  var recognitionSubtitleKey = "micDisclosure";
  var recognitionStatusHasError = false;
  var lastAlignment = null;
  var lastAlignmentFinal = false;
  var micStream = null;
  var micAudioContext = null;
  var micAnalyser = null;
  var micMeterFrame = null;
  var recognitionStartPending = false;
  var recognitionStartTimer = null;
  var recognitionRequestId = 0;
  var quranAsrAvailable = false;
  var autoServerFallback = false;
  var quranRecorder = null;
  var continuousResumePending = false;
  var continuousSessionActive = false;
  var continuousRestartTimer = null;
  var continuousFailureCount = 0;
  var quranVadFrame = null;
  var quranVadStartedAt = 0;
  var quranVadLastVoiceAt = 0;
  var quranVadSpeechDetected = false;
  var quranSubmitting = false;
  var quranSubmitController = null;
  var mushafPageNumber = 1;
  var mushafPageRequest = 0;
  var mushafChapterNames = {};
  var quranCatalogReady = false;
  var quranSearchRequest = 0;
  var loadedMushafFonts = {};
  var mushafPageVerses = [];
  var mushafSelectedVerseKey = "";
  var mushafFitFrame = null;
  var heartPageCache = {};
  var heartVersePageCache = {};
  var heartCurrentPageData = null;
  var heartPageRequest = 0;
  var heartMushafFitFrame = null;
  var heartMushafRenderRequest = 0;
  var linkedPageSession = null;
  var linked33Session = null;
  var LAWH_DATABASE_NAME = "allim-lawh-library-v1";
  var LAWH_DATABASE_STORE = "pages";
  var lawhPhotoUrl = "";
  var lawhDraftBlob = null;
  var lawhDraftMeta = null;
  var lawhDraftReady = false;
  var lawhDraftVerified = false;
  var lawhDraftKey = "";
  var lawhDraftStored = false;
  var lawhStorageState = "idle";
  var lawhDatabasePromise = null;
  var lawhRestoreRequest = 0;
  var lawhLibraryRenderRequest = 0;
  var lawhLibraryUrls = [];
  var memoryPracticeContext = null;
  var pageRecallSession = null;
  var pageRecallShowText = false;
  var pageRecallAccessLevel = "checking";
  var pageRecallAccessPromise = null;
  var selectedFawaidId = "";
  var activeLifeEntryId = "";
  var audioDownloadController = null;
  var memorySessionCounted = false;
  var memoryPromptCount = 0;
  var memoryRevealedCount = 0;
  var memoryHintsThisAttempt = 0;
  var memoryRecognition = null;
  var memoryRecorder = null;
  var memoryMicStream = null;
  var memoryIsListening = false;
  var memoryStartPending = false;
  var memorySeriesActive = false;
  var memorySubmitPending = false;
  var memoryRequestId = 0;
  var memoryStartTimer = null;
  var memorySubmitController = null;
  var memorySubmitTimer = null;
  var memoryRestartTimer = null;
  var memoryAudioContext = null;
  var memoryAnalyser = null;
  var memoryVadFrame = null;
  var memoryVadStartedAt = 0;
  var memoryVadLastVoiceAt = 0;
  var memoryVadSpeechDetected = false;
  var memoryHadError = false;
  var memoryLastTranscript = "";
  var memoryFullVerseMatched = false;
  var autoAdvanceTimer = null;
  var autoAdvanceInterval = null;
  var autoAdvanceContext = null;
  var autoAdvanceSeconds = 0;
  var cueAudioContext = null;
  var lastErrorCueAt = 0;
  var mushafSwipeStart = null;
  var recitationFlowBeforeMushaf = null;
  var HEART_FOUNDATION_TOTAL = 300;
  var LINKED_33_TARGET = 33;
  var HIFZ_METHODS = [
    { id: "foundation300", version: 1, order: 1 },
    { id: "linked33", version: 1, order: 2 },
    { id: "turkishWall33", version: 1, order: 3 },
    { id: "mauritanianLawh", version: 1, order: 4 }
  ];
  var HEART_STAGE_TARGET = 100;
  var HEART_MAINTENANCE_TARGET = 20;
  var HEART_REVIEW_INTERVALS = [30, 60, 90, 180, 365];
  var correctionLocked = false;
  var MIC_REQUEST_TIMEOUT = 15000;
  var correctionIndex = -1;
  var correctionStatuses = [];
  var verseAudioPlaying = false;
  var verseAudioPaused = false;
  var activeAudioObjectUrl = "";
  var audioSourceRequest = 0;
  var audioCacheName = "allim-quran-audio-v1";
  var selectedWordIndex = 0;

  var viewTitles = {
    today: "todayTitle",
    read: "readTitle",
    memorize: "memorizeTitle",
    learn: "learnTitle",
    tafsir: "tafsirTitle",
    progress: "progressTitle",
    settings: "settingsTitle"
  };

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return Object.assign({}, defaultState, saved);
    } catch (error) {
      return Object.assign({}, defaultState);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      return true;
    } catch (error) {
      return false;
    }
  }

  function t(key) {
    var current = translations[state.language] || translations.ru;
    return current[key] || translations.en[key] || key;
  }

  function formatText(key, values) {
    return String(t(key)).replace(/\{([a-z]+)\}/gi, function (_, name) {
      return Object.prototype.hasOwnProperty.call(values || {}, name) ? String(values[name]) : "";
    });
  }

  function getCueAudioContext() {
    if (!state.soundCues) return null;
    var AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    if (!cueAudioContext || cueAudioContext.state === "closed") cueAudioContext = new AudioContextConstructor();
    return cueAudioContext;
  }

  function primeCueAudio() {
    var context = getCueAudioContext();
    if (!context || context.state !== "suspended") return Promise.resolve(context);
    return context.resume().then(function () { return context; }).catch(function () { return null; });
  }

  function scheduleCueTone(context, frequency, offset, duration, volume, type) {
    if (!context) return;
    var oscillator = context.createOscillator();
    var gain = context.createGain();
    var startAt = context.currentTime + offset;
    var endAt = startAt + duration;
    oscillator.type = type || "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, endAt);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt + .02);
  }

  function playStartCue() {
    if (!state.soundCues) return;
    if (navigator.vibrate) navigator.vibrate(18);
    primeCueAudio().then(function (context) {
      scheduleCueTone(context, 784, .01, .18, .075, "sine");
      scheduleCueTone(context, 1176, .035, .2, .025, "sine");
    });
  }

  function playErrorCue() {
    if (!state.soundCues) return;
    var now = Date.now();
    if (now - lastErrorCueAt < 650) return;
    lastErrorCueAt = now;
    if (navigator.vibrate) navigator.vibrate([46, 54, 82]);
    primeCueAudio().then(function (context) {
      scheduleCueTone(context, 330, .01, .14, .07, "triangle");
      scheduleCueTone(context, 247, .19, .18, .075, "triangle");
    });
  }

  function playSuccessCue() {
    if (!state.soundCues) return;
    if (navigator.vibrate) navigator.vibrate(22);
    primeCueAudio().then(function (context) {
      scheduleCueTone(context, 659, .01, .12, .045, "sine");
      scheduleCueTone(context, 988, .1, .18, .035, "sine");
    });
  }

  function browserRecognitionSupported() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function quranRecognitionSupported() {
    return quranAsrAvailable && Boolean(window.MediaRecorder) && Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function getEffectiveRecognitionMode() {
    if (state.recognitionMode === "quran") return "quran";
    if (state.recognitionMode === "browser") return "browser";
    if (autoServerFallback && quranRecognitionSupported()) return "quran";
    if (browserRecognitionSupported()) return "browser";
    if (quranRecognitionSupported()) return "quran";
    return "browser";
  }

  function updateRecognitionEngineLabel() {
    var label = document.getElementById("recognition-engine");
    if (!label) return;
    var effectiveMode = getEffectiveRecognitionMode();
    if (state.recognitionMode === "auto") {
      label.textContent = t(effectiveMode === "quran" ? "recognitionAutoQuranEngine" : "recognitionAutoEngine");
    } else {
      label.textContent = effectiveMode === "quran" ? t("quranRecognition") : t("browserRecognition");
    }
  }

  function updateRecognitionModeUi() {
    var quranSupported = quranRecognitionSupported();
    document.querySelectorAll("[data-recognition-choice]").forEach(function (button) {
      var mode = button.getAttribute("data-recognition-choice");
      var selected = mode === state.recognitionMode;
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = mode === "quran" && !quranSupported;
    });
    var summaryKey = state.recognitionMode === "quran" ? "recognitionCarefulSummary" : state.recognitionMode === "browser" ? "recognitionInstantSummary" : "recognitionAutoSummary";
    document.querySelectorAll("[data-recognition-summary]").forEach(function (summary) { summary.textContent = t(summaryKey); });
    document.querySelectorAll("[data-recognition-service]").forEach(function (status) {
      status.textContent = t(quranSupported ? "recognitionQuranOnline" : "recognitionQuranOffline");
      status.classList.toggle("is-offline", !quranSupported);
    });
    updateRecognitionEngineLabel();
  }

  function hasSecureAudioContext() {
    var host = window.location.hostname;
    return window.location.protocol === "https:" ||
      (window.location.protocol === "http:" && (host === "127.0.0.1" || host === "localhost" || host === "[::1]"));
  }

  function updateRuntimeContextUi() {
    var available = hasSecureAudioContext();
    var warning = document.getElementById("runtime-warning");
    if (warning) warning.hidden = available;
    return available;
  }

  function checkQuranAsrService() {
    if (!window.fetch || !hasSecureAudioContext()) {
      quranAsrAvailable = false;
      updateRecognitionModeUi();
      return;
    }
    window.fetch("/api/quran-asr/health", { cache: "no-store", headers: { "X-Requested-With": "QuranCompanion" } }).then(function (response) {
      if (!response.ok) throw new Error("unavailable");
      return response.json();
    }).then(function (data) {
      quranAsrAvailable = Boolean(data && data.ready);
      if (!state.recognitionModeExplicit) {
        state.recognitionMode = "auto";
        saveState();
      }
      updateRecognitionModeUi();
      checkRecognitionSupport();
      checkMemoryRecognitionSupport();
    }).catch(function () {
      quranAsrAvailable = false;
      updateRecognitionModeUi();
      checkRecognitionSupport();
      checkMemoryRecognitionSupport();
    });
  }

  function setLanguage(language) {
    if (!translations[language]) return;
    clearAutoAdvance();
    state.language = language;
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach(function (element) {
      var key = element.getAttribute("data-i18n");
      if (translations[language][key]) element.textContent = translations[language][key];
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (element) {
      var key = element.getAttribute("data-i18n-aria");
      if (translations[language][key]) element.setAttribute("aria-label", translations[language][key]);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (element) {
      var key = element.getAttribute("data-i18n-placeholder");
      if (translations[language][key]) element.setAttribute("placeholder", translations[language][key]);
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (element) {
      var key = element.getAttribute("data-i18n-title");
      if (translations[language][key]) element.setAttribute("title", translations[language][key]);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach(function (element) {
      var key = element.getAttribute("data-i18n-alt");
      if (translations[language][key]) element.setAttribute("alt", translations[language][key]);
    });
    var lawhPreview = document.getElementById("lawh-preview");
    if (lawhPreview && !lawhPreview.hidden && lawhPreview.dataset.width) renderLawhPhotoQuality(Number(lawhPreview.dataset.width), Number(lawhPreview.dataset.height), lawhPreview.dataset.readable === "true");
    renderLawhWorkflow();
    if (state.memorizationMethod === "mauritanianLawh") renderLawhLibrary();
    document.getElementById("language-current-code").textContent = language.toUpperCase();
    document.getElementById("language-switch").value = language;
    document.getElementById("language-select").value = language;
    updateRecognitionModeUi();
    populateReciterSelect();
    updateAudioControls();
    updateInterlinearUi();
    updateMushafFontUi();
    var activeView = document.querySelector(".view.is-active");
    if (activeView) {
      var name = activeView.getAttribute("data-view-panel");
      document.getElementById("view-title").textContent = t(viewTitles[name]);
    }
    populateVerseSelectors();
    renderSelectedVerse(false);
    if (correctionLocked) renderCorrectionGate(false);
    buildWordMap();
    setRecognitionStatus(recognitionTitleKey, recognitionSubtitleKey, recognitionStatusHasError);
    setRecognitionButton(isListening);
    checkRecognitionSupport();
    checkMemoryRecognitionSupport();
    updateProgress();
    renderMemoryVerse();
    updateVerseActions();
    var openHeartDialog = document.getElementById("heart-page-dialog");
    if (openHeartDialog && openHeartDialog.open && heartCurrentPageData) renderHeartPageDialog(heartCurrentPageData);
    var openLifeDialog = document.getElementById("life-practice-dialog");
    if (openLifeDialog && openLifeDialog.open && currentSurah && currentVerse) {
      document.getElementById("life-verse-reference").textContent = currentSurah.names[state.language] + " · " + getVerseKey(currentSurah, currentVerse);
      document.getElementById("life-verse-meaning").textContent = localized(currentVerse.meaning);
      renderLifeFawaid();
      renderLifeHistory();
      resetLifeAiReview();
    }
    updatePageRecallAccessUi();
    saveState();
    persistLanguagePreference(language);
  }

  function navigate(view) {
    var panel = document.querySelector('[data-view-panel="' + view + '"]');
    if (!panel) return;
    if (view !== "read" && pageRecallSession) clearPageRecallMode();
    if (view !== "read" && linked33Session) {
      linked33Session = null;
      stopContinuousSession();
    }
    clearAutoAdvance();
    if (view !== "memorize") stopMemoryRecognition(true);
    if (view !== "read") document.body.classList.remove("audio-view");
    document.querySelectorAll(".view").forEach(function (item) { item.classList.remove("is-active"); });
    panel.classList.add("is-active");
    document.body.classList.toggle("read-view-active", view === "read");
    document.querySelectorAll("[data-view]").forEach(function (item) {
      var active = item.getAttribute("data-view") === view;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    document.getElementById("view-title").textContent = t(viewTitles[view]);
    if (view !== "read") setStudioMode(false);
    if (view === "memorize") {
      renderMemoryVerse();
      loadHeartPageContextForCurrentVerse().catch(function () { return null; });
    }
    if (view === "tafsir") renderTafsir();
    if (view === "today" || view === "progress") updateProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getSurah(id) {
    return corpus.find(function (surah) { return surah.id === Number(id); }) || corpus[0] || null;
  }

  function getVerse(surah, ayah) {
    if (!surah) return null;
    return surah.verses.find(function (verse) { return verse.ayah === Number(ayah); }) || surah.verses[0] || null;
  }

  function getVerseKey(surah, verse) {
    return surah && verse ? surah.id + ":" + verse.ayah : "";
  }

  function localized(value) {
    if (!value || typeof value !== "object") return String(value || "");
    return value[state.language] || value.en || value.ru || value.ar || "";
  }

  function createSvgIcon(name) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#" + name);
    svg.appendChild(use);
    return svg;
  }

  function getTafsirEntry(surah, verse) {
    return tafsirData.entries && tafsirData.entries[getVerseKey(surah, verse)] || null;
  }

  function getTafsirSourceUrl(surah) {
    if (!surah) return tafsirData.source.bookUrl || "https://quranpedia.net/book/308";
    return "https://quranpedia.net/surah/1/" + surah.id + "/book/308";
  }

  function getTafsirAttribution(surah, entry) {
    var type = entry && entry.attribution ? entry.attribution : (surah && surah.id >= 59 ? "completion" : "original");
    return {
      type: type,
      label: t(type === "completion" ? "completionAuthorLabel" : "originalAuthorLabel")
    };
  }

  function populateTafsirSelectors() {
    var surahSelect = document.getElementById("tafsir-surah-select");
    var ayahSelect = document.getElementById("tafsir-ayah-select");
    if (!surahSelect || !ayahSelect || !currentSurah || !currentVerse) return;
    var chapters = getCatalogChapters();
    surahSelect.textContent = "";
    (quranCatalogReady ? chapters : corpus).forEach(function (item) {
      var names = quranCatalogReady ? getChapterNames(item, getLocalSurahExact(item.id)) : item.names;
      var option = document.createElement("option");
      option.value = String(item.id);
      option.textContent = item.id + ". " + (names[state.language] || names.en);
      surahSelect.appendChild(option);
    });
    surahSelect.value = String(currentSurah.id);
    ayahSelect.textContent = "";
    var chapter = mushafChapterNames[currentSurah.id];
    var ayahCount = chapter ? Number(chapter.verses_count) : currentSurah.verses.length;
    for (var ayahNumber = 1; ayahNumber <= ayahCount; ayahNumber += 1) {
      var option = document.createElement("option");
      option.value = String(ayahNumber);
      option.textContent = state.language === "ar" ? "الآية " + arabicNumber(ayahNumber) : (state.language === "en" ? "Verse " + ayahNumber : "Аят " + ayahNumber);
      ayahSelect.appendChild(option);
    }
    ayahSelect.value = String(currentVerse.ayah);
  }

  function renderTafsirConnections(entry) {
    var container = document.getElementById("tafsir-links");
    if (!container) return;
    container.textContent = "";
    if (!entry || !entry.connections || !entry.connections.length) {
      var empty = document.createElement("div");
      empty.className = "tafsir-empty";
      empty.textContent = t("noConnections");
      container.appendChild(empty);
      return;
    }
    entry.connections.forEach(function (connection) {
      var link = document.createElement("a");
      link.className = "tafsir-connection";
      link.href = connection.url;
      link.target = "_blank";
      link.rel = "noopener";
      var icon = document.createElement("span");
      icon.className = "tafsir-connection-icon";
      icon.appendChild(createSvgIcon("i-link"));
      var copy = document.createElement("span");
      var reference = document.createElement("strong");
      reference.textContent = connection.ref;
      var label = document.createElement("small");
      label.textContent = localized(connection.label);
      copy.appendChild(reference);
      copy.appendChild(label);
      link.appendChild(icon);
      link.appendChild(copy);
      link.appendChild(createSvgIcon("i-arrow"));
      container.appendChild(link);
    });
  }

  function renderTafsirTerms(entry) {
    var container = document.getElementById("tafsir-terms");
    if (!container) return;
    container.textContent = "";
    if (!entry || !entry.keyTerms || !entry.keyTerms.length) {
      var empty = document.createElement("div");
      empty.className = "tafsir-empty";
      empty.textContent = t("noTerms");
      container.appendChild(empty);
      return;
    }
    entry.keyTerms.forEach(function (term) {
      var card = document.createElement("article");
      card.className = "tafsir-term";
      var arabic = document.createElement("span");
      arabic.className = "tafsir-term-ar";
      arabic.lang = "ar";
      arabic.dir = "rtl";
      arabic.textContent = term.ar;
      var copy = document.createElement("span");
      var root = document.createElement("strong");
      root.textContent = t("rootShort") + " · " + term.root;
      var meaning = document.createElement("small");
      meaning.textContent = localized(term.meaning);
      copy.appendChild(root);
      copy.appendChild(meaning);
      card.appendChild(arabic);
      card.appendChild(copy);
      container.appendChild(card);
    });
  }

  function renderTafsir() {
    if (!document.getElementById("tafsir-reference") || !currentSurah || !currentVerse) return;
    populateTafsirSelectors();
    var reference = getVerseKey(currentSurah, currentVerse);
    var entry = getTafsirEntry(currentSurah, currentVerse);
    var attribution = getTafsirAttribution(currentSurah, entry);
    document.getElementById("tafsir-reference").textContent = reference;
    document.getElementById("tafsir-surah-name").textContent = currentSurah.names[state.language] + " · " + reference;
    document.getElementById("tafsir-ayah-text").textContent = currentVerse.text;
    var translationLanguage = state.language === "en" ? "en" : "ru";
    document.getElementById("tafsir-arabic-summary").textContent = entry ? entry.summary.ar : translations.ar.noIndexedSummary;
    document.getElementById("tafsir-translation-label").textContent = t("translationLabel");
    document.getElementById("tafsir-summary").textContent = entry ? entry.summary[translationLanguage] : translations[translationLanguage].noIndexedSummary;
    document.getElementById("tafsir-method-note").textContent = entry ? localized(entry.method) : t("noIndexedMethod");
    var author = document.getElementById("tafsir-author");
    author.textContent = attribution.label;
    author.classList.toggle("is-completion", attribution.type === "completion");
    var status = document.getElementById("tafsir-source-status");
    status.textContent = t(entry ? "verifiedCard" : "sourceNotIndexed");
    status.classList.toggle("is-unindexed", !entry);
    var sourceLink = document.getElementById("tafsir-source-link");
    sourceLink.href = entry && entry.sourceUrl ? entry.sourceUrl : getTafsirSourceUrl(currentSurah);
    renderTafsirConnections(entry);
    renderTafsirTerms(entry);
    document.getElementById("tafsir-ai-answer").textContent = formatText("tafsirAiReady", { reference: reference });
  }

  function renderTafsirAnswer(mode, question) {
    if (!currentSurah || !currentVerse) return;
    var reference = getVerseKey(currentSurah, currentVerse);
    var entry = getTafsirEntry(currentSurah, currentVerse);
    var answer = document.getElementById("tafsir-ai-answer");
    if (!entry) {
      answer.textContent = formatText("tafsirAnswerNoEntry", { reference: reference });
      return;
    }
    var requestedMode = mode || "";
    if (!requestedMode && question) {
      var normalized = String(question).toLowerCase();
      if (/(связ|какие аяты|друг(?:ие|ой) аят|connection|which verses|ربط|ما الآيات|أي آيات)/.test(normalized)) requestedMode = "connections";
      else if (/(метод|как объяс|method|how does|منهج|كيف يفس)/.test(normalized)) requestedMode = "method";
      else if (/(слов|термин|корен|word|term|root|لفظ|كلم|جذر)/.test(normalized)) requestedMode = "terms";
      else if (/(смысл|резюме|знач|meaning|summary|explain|معنى|خلاص|بيان)/.test(normalized)) requestedMode = "summary";
    }
    var content = "";
    if (requestedMode === "connections") {
      content = entry.connections.map(function (item) { return "• " + item.ref + " — " + localized(item.label); }).join("\n");
      answer.textContent = formatText("tafsirAnswerConnections", { reference: reference, content: content });
    } else if (requestedMode === "method") {
      answer.textContent = formatText("tafsirAnswerMethod", { reference: reference, content: localized(entry.method) });
    } else if (requestedMode === "terms") {
      content = entry.keyTerms.map(function (item) { return "• " + item.ar + " (" + t("rootShort") + ": " + item.root + ") — " + localized(item.meaning); }).join("\n");
      answer.textContent = formatText("tafsirAnswerTerms", { reference: reference, content: content });
    } else if (requestedMode === "summary") {
      answer.textContent = formatText("tafsirAnswerSummary", { reference: reference, content: localized(entry.summary) });
    } else {
      answer.textContent = formatText("tafsirAnswerNoBasis", { reference: reference });
    }
  }

  function getVerseByKey(key) {
    var parts = String(key || "").split(":");
    var surah = getSurah(Number(parts[0]));
    var verse = getVerse(surah, Number(parts[1]));
    return surah && verse && getVerseKey(surah, verse) === key ? { surah: surah, verse: verse } : null;
  }

  function hasVerse(list, key) {
    return Array.isArray(list) && list.indexOf(key) >= 0;
  }

  function updateVerseActions() {
    if (!currentSurah || !currentVerse) return;
    var key = getVerseKey(currentSurah, currentVerse);
    var isSaved = hasVerse(state.savedVerses, key);
    var isQueued = hasVerse(state.reviewQueue, key);
    var bookmark = document.getElementById("bookmark-verse");
    var saveButton = document.getElementById("save-verse");
    var reviewButton = document.getElementById("queue-review");
    bookmark.classList.toggle("is-active", isSaved);
    bookmark.setAttribute("aria-pressed", String(isSaved));
    bookmark.setAttribute("aria-label", t(isSaved ? "removeSaved" : "saveVerse"));
    saveButton.classList.toggle("is-active", isSaved);
    saveButton.querySelector("strong").textContent = t(isSaved ? "removeSaved" : "saveVerse");
    reviewButton.classList.toggle("is-active", isQueued);
    reviewButton.querySelector("strong").textContent = t(isQueued ? "removeFromReview" : "addToReview");
  }

  function toggleSavedVerse() {
    var key = getVerseKey(currentSurah, currentVerse);
    if (!key) return;
    var index = state.savedVerses.indexOf(key);
    if (index >= 0) {
      state.savedVerses.splice(index, 1);
      showToast(t("verseUnsaved"));
    } else {
      state.savedVerses.unshift(key);
      showToast(t("verseSaved"));
    }
    saveState();
    updateVerseActions();
    updateProgress();
  }

  function toggleReviewVerse() {
    var key = getVerseKey(currentSurah, currentVerse);
    if (!key) return;
    var index = state.reviewQueue.indexOf(key);
    if (index >= 0) {
      state.reviewQueue.splice(index, 1);
      showToast(t("reviewRemoved"));
    } else {
      state.reviewQueue.unshift(key);
      showToast(t("reviewAdded"));
    }
    saveState();
    updateVerseActions();
    updateProgress();
  }

  function ensureCurrentVerseInReview() {
    var key = getVerseKey(currentSurah, currentVerse);
    if (key && !hasVerse(state.reviewQueue, key)) state.reviewQueue.unshift(key);
  }

  function loadVerseKey(key, destination) {
    var location = getVerseByKey(key);
    if (!location) return;
    state.selectedSurah = location.surah.id;
    state.selectedAyah = location.verse.ayah;
    populateVerseSelectors();
    renderSelectedVerse(true);
    navigate(destination || "read");
  }

  function renderVerseList(containerId, keys, emptyKey, destination) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.textContent = "";
    var validKeys = keys.filter(function (key) { return Boolean(getVerseByKey(key)); });
    if (!validKeys.length) {
      var empty = document.createElement("div");
      empty.className = "verse-list-empty";
      empty.textContent = t(emptyKey);
      container.appendChild(empty);
      return;
    }
    validKeys.slice(0, 8).forEach(function (key) {
      var location = getVerseByKey(key);
      var button = document.createElement("button");
      button.type = "button";
      button.className = "verse-list-button";
      var copy = document.createElement("span");
      var title = document.createElement("strong");
      var excerpt = document.createElement("small");
      var arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      title.textContent = location.surah.names[state.language] + " · " + key;
      excerpt.textContent = location.verse.text;
      use.setAttribute("href", "#i-chevron");
      arrow.appendChild(use);
      copy.appendChild(title);
      copy.appendChild(excerpt);
      button.appendChild(copy);
      button.appendChild(arrow);
      button.addEventListener("click", function () { loadVerseKey(key, destination); });
      container.appendChild(button);
    });
  }

  function renderLibraries() {
    renderVerseList("review-queue-list", state.reviewQueue, "emptyReview", "memorize");
    renderVerseList("saved-verses-list", state.savedVerses, "emptySaved", "read");
  }

  function dateKey(date) {
    var local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function normalizeHifzCoach(raw) {
    var coach = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    coach.selectionMode = coach.selectionMode === "adaptive" ? "adaptive" : "manual";
    if (!Array.isArray(coach.signals)) coach.signals = [];
    coach.signals = coach.signals.slice(-240).filter(function (signal) {
      return signal && typeof signal === "object" && ["foundation300", "linked33", "turkishWall33", "mauritanianLawh"].indexOf(signal.method) >= 0;
    }).map(function (signal) {
      return {
        method: signal.method,
        outcome: ["clean", "assisted", "incomplete"].indexOf(signal.outcome) >= 0 ? signal.outcome : "incomplete",
        hints: Math.max(0, Number(signal.hints) || 0),
        source: signal.source === "connected" ? "connected" : "verse",
        at: typeof signal.at === "string" ? signal.at : new Date().toISOString()
      };
    });
    return coach;
  }

  function getHifzMethodTitleKey(method) {
    if (method === "linked33") return "hifzMethod33Title";
    if (method === "turkishWall33") return "hifzMethodTurkishTitle";
    if (method === "mauritanianLawh") return "hifzMethodLawhTitle";
    return "hifzMethod300Title";
  }

  function getHifzLearnerSummary() {
    var signals = state.hifzCoach.signals;
    var attempts = signals.length;
    var clean = signals.filter(function (signal) { return signal.outcome === "clean"; }).length;
    var assisted = signals.filter(function (signal) { return signal.outcome === "assisted"; }).length;
    return {
      attempts: attempts,
      clean: clean,
      assisted: assisted,
      cleanRate: attempts ? clean / attempts : 0,
      assistedRate: attempts ? assisted / attempts : 0
    };
  }

  function getHifzRecommendation() {
    var profile = getHifzLearnerSummary();
    if (profile.attempts < 5) return { ready: false, method: "", reasonKey: "hifzCoachCollectingReason", profile: profile };
    if (profile.cleanRate < .72 || profile.assistedRate > .2) return { ready: true, method: "foundation300", reasonKey: "hifzCoachFoundationReason", profile: profile };
    var pageSize = heartCurrentPageData ? getHeartPageVerseKeys(heartCurrentPageData).length : 0;
    if (profile.attempts >= 10 && profile.cleanRate >= .85 && pageSize >= 4) return { ready: true, method: "turkishWall33", reasonKey: "hifzCoachTurkishReason", profile: profile };
    return { ready: true, method: "linked33", reasonKey: "hifzCoachLinkedReason", profile: profile };
  }

  function recordHifzLearningSignal(outcome, source, hints) {
    state.hifzCoach.signals.push({
      method: state.memorizationMethod,
      outcome: outcome,
      source: source === "connected" ? "connected" : "verse",
      hints: Math.max(0, Number(hints) || 0),
      at: new Date().toISOString()
    });
    state.hifzCoach.signals = state.hifzCoach.signals.slice(-240);
    renderHifzChoiceUi();
  }

  function renderHifzChoiceUi() {
    if (!state.hifzCoach) return;
    var adaptive = state.hifzCoach.selectionMode === "adaptive";
    document.querySelectorAll("[data-hifz-choice-mode]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-hifz-choice-mode") === state.hifzCoach.selectionMode));
    });
    var panel = document.getElementById("hifz-coach-panel");
    if (panel) panel.hidden = !adaptive;
    var recommendation = getHifzRecommendation();
    var attempts = document.getElementById("hifz-coach-attempts");
    var clean = document.getElementById("hifz-coach-clean");
    var status = document.getElementById("hifz-coach-status");
    var reason = document.getElementById("hifz-coach-reason");
    if (attempts) attempts.textContent = formatMetric(recommendation.profile.attempts);
    if (clean) clean.textContent = formatMetric(Math.round(recommendation.profile.cleanRate * 100)) + "%";
    if (status) status.textContent = recommendation.ready ? formatText("hifzCoachRecommendation", { method: t(getHifzMethodTitleKey(recommendation.method)) }) : t("hifzCoachCollecting");
    if (reason) reason.textContent = t(recommendation.reasonKey);
    document.querySelectorAll("[data-hifz-recommendation]").forEach(function (badge) {
      var button = badge.closest("[data-hifz-method]");
      badge.hidden = !adaptive || !recommendation.ready || !button || button.getAttribute("data-hifz-method") !== recommendation.method;
    });
  }

  function setHifzChoiceMode(mode, announce) {
    state.hifzCoach.selectionMode = mode === "adaptive" ? "adaptive" : "manual";
    saveState();
    renderHifzChoiceUi();
    if (announce) showToast(t(state.hifzCoach.selectionMode === "adaptive" ? "hifzChoiceChangedAdaptive" : "hifzChoiceChangedManual"));
  }

  function openLawhDatabase() {
    if (!window.indexedDB) return Promise.reject(new Error("lawh-storage-unavailable"));
    if (lawhDatabasePromise) return lawhDatabasePromise;
    lawhDatabasePromise = new Promise(function (resolve, reject) {
      var request = window.indexedDB.open(LAWH_DATABASE_NAME, 1);
      request.onupgradeneeded = function () {
        var database = request.result;
        if (!database.objectStoreNames.contains(LAWH_DATABASE_STORE)) database.createObjectStore(LAWH_DATABASE_STORE, { keyPath: "id" });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("lawh-storage-open-failed")); };
      request.onblocked = function () { reject(new Error("lawh-storage-blocked")); };
    }).catch(function (error) {
      lawhDatabasePromise = null;
      throw error;
    });
    return lawhDatabasePromise;
  }

  function getLawhRecord(id) {
    return openLawhDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var request = database.transaction(LAWH_DATABASE_STORE, "readonly").objectStore(LAWH_DATABASE_STORE).get(id);
        request.onsuccess = function () { resolve(request.result || null); };
        request.onerror = function () { reject(request.error || new Error("lawh-storage-read-failed")); };
      });
    });
  }

  function getAllLawhRecords() {
    return openLawhDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var request = database.transaction(LAWH_DATABASE_STORE, "readonly").objectStore(LAWH_DATABASE_STORE).getAll();
        request.onsuccess = function () { resolve(Array.isArray(request.result) ? request.result : []); };
        request.onerror = function () { reject(request.error || new Error("lawh-storage-list-failed")); };
      });
    });
  }

  function putLawhRecord(record) {
    return openLawhDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction = database.transaction(LAWH_DATABASE_STORE, "readwrite");
        transaction.objectStore(LAWH_DATABASE_STORE).put(record);
        transaction.oncomplete = function () { resolve(record); };
        transaction.onerror = function () { reject(transaction.error || new Error("lawh-storage-write-failed")); };
        transaction.onabort = function () { reject(transaction.error || new Error("lawh-storage-write-aborted")); };
      });
    });
  }

  function removeLawhRecord(id) {
    return openLawhDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction = database.transaction(LAWH_DATABASE_STORE, "readwrite");
        transaction.objectStore(LAWH_DATABASE_STORE).delete(id);
        transaction.oncomplete = function () { resolve(true); };
        transaction.onerror = function () { reject(transaction.error || new Error("lawh-storage-delete-failed")); };
        transaction.onabort = function () { reject(transaction.error || new Error("lawh-storage-delete-aborted")); };
      });
    });
  }

  function getCurrentLawhKey() {
    if (currentSurah && currentVerse) return getVerseKey(currentSurah, currentVerse);
    return String(Number(state.selectedSurah) || 1) + ":" + String(Number(state.selectedAyah) || 1);
  }

  function getLawhUnit(key) {
    var resolvedKey = key || getCurrentLawhKey();
    var unit = state.heartMushaf.lawhPages[resolvedKey];
    if (!unit || typeof unit !== "object" || Array.isArray(unit)) unit = {};
    unit.verifiedAt = typeof unit.verifiedAt === "string" ? unit.verifiedAt : "";
    unit.readCount = Math.max(0, Number(unit.readCount) || 0);
    unit.recallCount = Math.max(0, Number(unit.recallCount) || 0);
    unit.updatedAt = typeof unit.updatedAt === "string" ? unit.updatedAt : "";
    state.heartMushaf.lawhPages[resolvedKey] = unit;
    return unit;
  }

  function releaseLawhPhotoUrl() {
    if (!lawhPhotoUrl) return;
    URL.revokeObjectURL(lawhPhotoUrl);
    lawhPhotoUrl = "";
  }

  function renderLawhStorageControls() {
    var status = document.getElementById("lawh-storage-status");
    var button = document.getElementById("lawh-save-local");
    var messageKey = "lawhStorageIdle";
    if (lawhStorageState === "saving") messageKey = "lawhStorageSaving";
    else if (lawhStorageState === "error") messageKey = "lawhStorageError";
    else if (lawhStorageState === "unavailable") messageKey = "lawhStorageUnavailable";
    else if (lawhStorageState === "restored") messageKey = "lawhStorageRestored";
    else if (lawhDraftStored) messageKey = "lawhStorageSaved";
    else if (lawhDraftReady && lawhDraftBlob) messageKey = "lawhStorageReady";
    if (status) status.textContent = t(messageKey);
    if (button) {
      button.textContent = t(lawhDraftStored ? "lawhSavedLocal" : "lawhSaveLocal");
      button.disabled = !lawhDraftReady || !lawhDraftBlob || lawhDraftStored || lawhStorageState === "saving" || lawhStorageState === "unavailable";
      button.setAttribute("aria-disabled", String(button.disabled));
    }
  }

  function makeLawhRecord(key) {
    var unit = getLawhUnit(key);
    var reference = String(key || getCurrentLawhKey());
    var parts = reference.split(":");
    var meta = lawhDraftMeta || {};
    return {
      id: reference,
      surahId: Math.max(1, Number(parts[0]) || Number(state.selectedSurah) || 1),
      ayahNumber: Math.max(1, Number(parts[1]) || Number(state.selectedAyah) || 1),
      pageNumber: heartCurrentPageData ? Math.max(0, Number(heartCurrentPageData.page) || 0) : Math.max(0, Number(meta.pageNumber) || 0),
      blob: lawhDraftBlob,
      fileName: typeof meta.fileName === "string" ? meta.fileName : "lawh-page",
      fileType: typeof meta.fileType === "string" ? meta.fileType : "image/jpeg",
      width: Math.max(0, Number(meta.width) || 0),
      height: Math.max(0, Number(meta.height) || 0),
      verifiedAt: unit.verifiedAt,
      readCount: unit.readCount,
      recallCount: unit.recallCount,
      updatedAt: new Date().toISOString()
    };
  }

  function saveCurrentLawhPage() {
    if (!lawhDraftReady || !lawhDraftBlob || !lawhDraftKey || lawhDraftStored) return;
    lawhStorageState = "saving";
    renderLawhStorageControls();
    putLawhRecord(makeLawhRecord(lawhDraftKey)).then(function () {
      lawhDraftStored = true;
      lawhStorageState = "saved";
      renderLawhStorageControls();
      renderLawhLibrary();
      showToast(t("lawhStorageSaved"));
    }).catch(function () {
      lawhStorageState = window.indexedDB ? "error" : "unavailable";
      renderLawhStorageControls();
      showToast(t(lawhStorageState === "unavailable" ? "lawhStorageUnavailable" : "lawhStorageError"));
    });
  }

  function syncLawhStoredMetadata(key) {
    if (!key) return Promise.resolve(false);
    return getLawhRecord(key).then(function (record) {
      if (!record) return false;
      var unit = getLawhUnit(key);
      record.verifiedAt = unit.verifiedAt;
      record.readCount = unit.readCount;
      record.recallCount = unit.recallCount;
      record.updatedAt = unit.updatedAt || new Date().toISOString();
      return putLawhRecord(record).then(function () {
        renderLawhLibrary();
        return true;
      });
    }).catch(function () { return false; });
  }

  function clearLawhDraft() {
    releaseLawhPhotoUrl();
    lawhDraftBlob = null;
    lawhDraftMeta = null;
    lawhDraftReady = false;
    lawhDraftVerified = false;
    lawhDraftStored = false;
    lawhStorageState = "idle";
    var preview = document.getElementById("lawh-preview");
    var image = document.getElementById("lawh-preview-image");
    if (preview) {
      preview.hidden = true;
      delete preview.dataset.width;
      delete preview.dataset.height;
      delete preview.dataset.readable;
    }
    if (image) image.removeAttribute("src");
    resetLawhDraftChecks();
    renderLawhWorkflow();
  }

  function restoreLawhDraftForCurrentKey(force) {
    var key = getCurrentLawhKey();
    if (!force && lawhDraftKey === key) return Promise.resolve(Boolean(lawhDraftBlob));
    var requestId = ++lawhRestoreRequest;
    if (force || lawhDraftKey !== key) clearLawhDraft();
    lawhDraftKey = key;
    return getLawhRecord(key).then(function (record) {
      if (requestId !== lawhRestoreRequest || getCurrentLawhKey() !== key) return false;
      if (!record || !record.blob) {
        lawhStorageState = "idle";
        renderLawhStorageControls();
        return false;
      }
      var unit = getLawhUnit(key);
      unit.verifiedAt = record.verifiedAt || unit.verifiedAt;
      unit.readCount = Math.max(unit.readCount, Number(record.readCount) || 0);
      unit.recallCount = Math.max(unit.recallCount, Number(record.recallCount) || 0);
      unit.updatedAt = record.updatedAt || unit.updatedAt;
      saveState();
      releaseLawhPhotoUrl();
      lawhDraftBlob = record.blob;
      lawhDraftMeta = {
        fileName: record.fileName || "lawh-page",
        fileType: record.fileType || record.blob.type || "image/jpeg",
        width: Math.max(0, Number(record.width) || 0),
        height: Math.max(0, Number(record.height) || 0),
        pageNumber: Math.max(0, Number(record.pageNumber) || 0)
      };
      lawhDraftReady = Math.max(lawhDraftMeta.width, lawhDraftMeta.height) >= 1200;
      lawhDraftVerified = Boolean(unit.verifiedAt);
      lawhDraftStored = true;
      lawhStorageState = "restored";
      lawhPhotoUrl = URL.createObjectURL(record.blob);
      var preview = document.getElementById("lawh-preview");
      var image = document.getElementById("lawh-preview-image");
      if (preview) preview.hidden = false;
      if (image) image.src = lawhPhotoUrl;
      renderLawhPhotoQuality(lawhDraftMeta.width, lawhDraftMeta.height, true);
      renderLawhStorageControls();
      return true;
    }).catch(function () {
      if (requestId !== lawhRestoreRequest) return false;
      lawhStorageState = window.indexedDB ? "error" : "unavailable";
      renderLawhStorageControls();
      return false;
    });
  }

  function openStoredLawhPage(record) {
    if (!record) return;
    var surahId = Math.max(1, Number(record.surahId) || Number(String(record.id).split(":")[0]) || 1);
    var ayahNumber = Math.max(1, Number(record.ayahNumber) || Number(String(record.id).split(":")[1]) || 1);
    if (state.memorizationMethod !== "mauritanianLawh") selectMemorizationMethod("mauritanianLawh", false);
    selectVerseByReference(surahId, ayahNumber, { navigate: false }).then(function () {
      return restoreLawhDraftForCurrentKey(true);
    }).then(function () {
      var workspace = document.getElementById("lawh-workspace");
      if (workspace) workspace.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function deleteStoredLawhPage(id) {
    if (!id || !window.confirm(t("lawhDeleteConfirm"))) return;
    removeLawhRecord(id).then(function () {
      if (lawhDraftKey === id) {
        clearLawhDraft();
        lawhDraftKey = getCurrentLawhKey();
      }
      renderLawhLibrary();
      showToast(t("lawhDeleted"));
    }).catch(function () { showToast(t("lawhStorageError")); });
  }

  function renderLawhLibrary() {
    var list = document.getElementById("lawh-library-list");
    var empty = document.getElementById("lawh-library-empty");
    var count = document.getElementById("lawh-library-count");
    if (!list || !empty || !count) return Promise.resolve([]);
    var requestId = ++lawhLibraryRenderRequest;
    empty.hidden = false;
    empty.textContent = t("lawhLibraryLoading");
    return getAllLawhRecords().then(function (records) {
      if (requestId !== lawhLibraryRenderRequest) return records;
      lawhLibraryUrls.forEach(function (url) { URL.revokeObjectURL(url); });
      lawhLibraryUrls = [];
      list.textContent = "";
      records.sort(function (a, b) { return String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")); });
      count.textContent = formatMetric(records.length);
      empty.hidden = records.length > 0;
      empty.textContent = t("lawhLibraryEmpty");
      records.forEach(function (record) {
        var unit = getLawhUnit(record.id);
        var card = document.createElement("article");
        card.className = "lawh-library-card";
        var thumbnail = document.createElement("img");
        var thumbnailUrl = URL.createObjectURL(record.blob);
        lawhLibraryUrls.push(thumbnailUrl);
        thumbnail.src = thumbnailUrl;
        thumbnail.alt = formatText("lawhLibraryReference", { reference: record.id });
        var copy = document.createElement("div");
        copy.className = "lawh-library-card-copy";
        var status = document.createElement("small");
        status.textContent = t(record.verifiedAt || unit.verifiedAt ? "lawhLibraryVerified" : "lawhLibraryUnverified");
        var title = document.createElement("strong");
        title.textContent = formatText("lawhLibraryReference", { reference: record.id });
        var progress = document.createElement("p");
        progress.textContent = formatText("lawhLibraryProgress", { read: formatMetric(Math.max(unit.readCount, Number(record.readCount) || 0)), recall: formatMetric(Math.max(unit.recallCount, Number(record.recallCount) || 0)) });
        var actions = document.createElement("div");
        actions.className = "lawh-library-card-actions";
        var openButton = document.createElement("button");
        openButton.type = "button";
        openButton.textContent = t("lawhLibraryOpen");
        openButton.addEventListener("click", function () { openStoredLawhPage(record); });
        var deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "lawh-delete";
        deleteButton.textContent = t("lawhLibraryDelete");
        deleteButton.addEventListener("click", function () { deleteStoredLawhPage(record.id); });
        actions.appendChild(openButton);
        actions.appendChild(deleteButton);
        copy.appendChild(status);
        copy.appendChild(title);
        copy.appendChild(progress);
        copy.appendChild(actions);
        card.appendChild(thumbnail);
        card.appendChild(copy);
        list.appendChild(card);
      });
      return records;
    }).catch(function () {
      if (requestId !== lawhLibraryRenderRequest) return [];
      list.textContent = "";
      count.textContent = "0";
      empty.hidden = false;
      empty.textContent = t("lawhStorageUnavailable");
      lawhStorageState = window.indexedDB ? "error" : "unavailable";
      renderLawhStorageControls();
      return [];
    });
  }

  function resetLawhStoredProgress() {
    getAllLawhRecords().then(function (records) {
      return Promise.all(records.map(function (record) {
        record.verifiedAt = "";
        record.readCount = 0;
        record.recallCount = 0;
        record.updatedAt = new Date().toISOString();
        return putLawhRecord(record);
      }));
    }).then(function () { renderLawhLibrary(); }).catch(function () { return null; });
  }

  function updateLawhVerificationButton() {
    var button = document.getElementById("lawh-verify-page");
    if (!button) return;
    var checks = Array.prototype.slice.call(document.querySelectorAll("[data-lawh-check]"));
    var complete = checks.length > 0 && checks.every(function (checkbox) { return checkbox.checked; });
    button.disabled = !lawhDraftReady || !complete;
    button.setAttribute("aria-disabled", String(button.disabled));
  }

  function renderLawhWorkflow() {
    var verification = document.getElementById("lawh-verification");
    var practice = document.getElementById("lawh-practice");
    var readCount = document.getElementById("lawh-read-count");
    var recallCount = document.getElementById("lawh-recall-count");
    var activeDraft = lawhDraftReady && lawhDraftKey === getCurrentLawhKey();
    if (verification) verification.hidden = !activeDraft || lawhDraftVerified;
    if (practice) practice.hidden = !activeDraft || !lawhDraftVerified;
    var unit = getLawhUnit(lawhDraftKey || getCurrentLawhKey());
    if (readCount) readCount.textContent = formatMetric(unit.readCount);
    if (recallCount) recallCount.textContent = formatMetric(unit.recallCount);
    var status = document.getElementById("lawh-practice-status");
    if (status) status.textContent = t(lawhDraftVerified ? "lawhVerified" : "lawhPracticeIntro");
    updateLawhVerificationButton();
    renderLawhStorageControls();
  }

  function resetLawhDraftChecks() {
    document.querySelectorAll("[data-lawh-check]").forEach(function (checkbox) { checkbox.checked = false; });
    updateLawhVerificationButton();
  }

  function confirmLawhVerification() {
    if (!lawhDraftReady || !lawhDraftKey) return;
    var button = document.getElementById("lawh-verify-page");
    if (!button || button.disabled) return;
    var unit = getLawhUnit(lawhDraftKey);
    unit.verifiedAt = new Date().toISOString();
    unit.updatedAt = unit.verifiedAt;
    lawhDraftVerified = true;
    saveState();
    renderLawhWorkflow();
    syncLawhStoredMetadata(lawhDraftKey);
    showToast(t("lawhVerified"));
  }

  function recordLawhPractice(kind) {
    if (!lawhDraftReady || !lawhDraftVerified || !lawhDraftKey) return;
    var unit = getLawhUnit(lawhDraftKey);
    if (kind === "recall") {
      unit.recallCount += 1;
      recordHifzLearningSignal("clean", "verse", 0);
    } else {
      unit.readCount += 1;
    }
    unit.updatedAt = new Date().toISOString();
    saveState();
    renderLawhWorkflow();
    syncLawhStoredMetadata(lawhDraftKey);
    showToast(t(kind === "recall" ? "lawhRecallRecorded" : "lawhReadRecorded"));
  }

  function renderLawhPhotoQuality(width, height, readable) {
    var status = document.getElementById("lawh-photo-quality");
    var detail = document.getElementById("lawh-photo-detail");
    var preview = document.getElementById("lawh-preview");
    if (!status || !detail) return;
    if (preview) {
      preview.dataset.width = String(Math.max(0, Number(width) || 0));
      preview.dataset.height = String(Math.max(0, Number(height) || 0));
      preview.dataset.readable = String(Boolean(readable));
    }
    if (!readable) {
      lawhDraftReady = false;
      lawhDraftVerified = false;
      status.textContent = t("lawhPhotoUnreadable");
      detail.textContent = "";
      renderLawhWorkflow();
      return;
    }
    var ready = Math.max(width, height) >= 1200;
    if (!lawhDraftMeta) lawhDraftMeta = {};
    lawhDraftMeta.width = Math.max(0, Number(width) || 0);
    lawhDraftMeta.height = Math.max(0, Number(height) || 0);
    lawhDraftReady = ready;
    if (!ready) lawhDraftVerified = false;
    if (!lawhDraftStored) lawhStorageState = ready ? "ready" : "idle";
    status.textContent = t(ready ? "lawhPhotoReady" : "lawhPhotoLowQuality");
    detail.textContent = formatText(ready ? "lawhPhotoReadyDetail" : "lawhPhotoLowDetail", { width: formatMetric(width), height: formatMetric(height) });
    renderLawhWorkflow();
  }

  function handleLawhPhoto(event) {
    var input = event && event.target;
    var file = input && input.files && input.files[0];
    if (!file) return;
    var preview = document.getElementById("lawh-preview");
    var image = document.getElementById("lawh-preview-image");
    var status = document.getElementById("lawh-photo-quality");
    var detail = document.getElementById("lawh-photo-detail");
    if (!preview || !image) return;
    releaseLawhPhotoUrl();
    lawhPhotoUrl = URL.createObjectURL(file);
    lawhDraftBlob = file;
    lawhDraftMeta = { fileName: file.name || "lawh-page", fileType: file.type || "image/jpeg", width: 0, height: 0, pageNumber: heartCurrentPageData ? Number(heartCurrentPageData.page) || 0 : 0 };
    lawhDraftReady = false;
    lawhDraftVerified = false;
    lawhDraftKey = getCurrentLawhKey();
    lawhDraftStored = false;
    lawhStorageState = "idle";
    resetLawhDraftChecks();
    preview.hidden = false;
    if (status) status.textContent = t("lawhPhotoChecking");
    if (detail) detail.textContent = file.name;
    image.onload = function () { renderLawhPhotoQuality(image.naturalWidth, image.naturalHeight, true); };
    image.onerror = function () { renderLawhPhotoQuality(0, 0, false); };
    image.src = lawhPhotoUrl;
  }

  function normalizeHeartUnit(raw) {
    var unit = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    var legacyTotal = Math.max(0, Math.min(HEART_FOUNDATION_TOTAL, Number(unit.accepted) || 0));
    if (!Array.isArray(unit.weekCounts)) {
      unit.weekCounts = [
        Math.min(HEART_STAGE_TARGET, legacyTotal),
        Math.min(HEART_STAGE_TARGET, Math.max(0, legacyTotal - HEART_STAGE_TARGET)),
        Math.min(HEART_STAGE_TARGET, Math.max(0, legacyTotal - HEART_STAGE_TARGET * 2))
      ];
    }
    unit.weekCounts = [0, 1, 2].map(function (index) {
      return Math.max(0, Math.min(HEART_STAGE_TARGET, Number(unit.weekCounts[index]) || 0));
    });
    if (!unit.daily || typeof unit.daily !== "object" || Array.isArray(unit.daily)) unit.daily = {};
    unit.maintenanceCount = Math.max(0, Math.min(HEART_MAINTENANCE_TARGET, Number(unit.maintenanceCount) || 0));
    unit.maintenanceLevel = Math.max(0, Number(unit.maintenanceLevel) || 0);
    unit.startedAt = typeof unit.startedAt === "string" ? unit.startedAt : "";
    unit.lastAcceptedAt = typeof unit.lastAcceptedAt === "string" ? unit.lastAcceptedAt : "";
    unit.completedAt = typeof unit.completedAt === "string" ? unit.completedAt : "";
    unit.nextReviewAt = typeof unit.nextReviewAt === "string" ? unit.nextReviewAt : "";
    unit.permanent = unit.permanent === true || getHeartFoundationTotal(unit) >= HEART_FOUNDATION_TOTAL || Boolean(unit.completedAt);
    return unit;
  }

  function getHeartUnit(key) {
    var verseKey = String(key || "");
    if (!verseKey) return normalizeHeartUnit({});
    state.heartMushaf.units[verseKey] = normalizeHeartUnit(state.heartMushaf.units[verseKey]);
    return state.heartMushaf.units[verseKey];
  }

  function getHeartFoundationTotal(unit) {
    return unit.weekCounts.reduce(function (sum, count) { return sum + Number(count || 0); }, 0);
  }

  function normalizeHeartPage(raw, pageNumber) {
    var page = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    page.pageNumber = Math.max(1, Math.min(604, Number(page.pageNumber || pageNumber) || 1));
    page.connectedAttempts = Math.max(0, Number(page.connectedAttempts) || 0);
    page.connectedReviews = Math.max(0, Number(page.connectedReviews) || 0);
    page.lastConnectedAt = typeof page.lastConnectedAt === "string" ? page.lastConnectedAt : "";
    page.sealedAt = typeof page.sealedAt === "string" ? page.sealedAt : "";
    page.permanent = page.permanent === true || Boolean(page.sealedAt);
    return page;
  }

  function getHeartPageUnit(pageNumber) {
    var key = String(Math.max(1, Math.min(604, Number(pageNumber) || 1)));
    state.heartMushaf.pages[key] = normalizeHeartPage(state.heartMushaf.pages[key], Number(key));
    return state.heartMushaf.pages[key];
  }

  function getHeartPageVerseKeys(pageData) {
    var keys = pageData && Array.isArray(pageData.verses) ? pageData.verses.map(function (verse) { return String(verse.verse_key || ""); }).filter(Boolean) : [];
    return keys.filter(function (key, index) { return keys.indexOf(key) === index; });
  }

  function getHeartPageSummary(pageData) {
    var keys = getHeartPageVerseKeys(pageData);
    var collected = keys.filter(function (key) { return getHeartFoundationTotal(getHeartUnit(key)) >= HEART_FOUNDATION_TOTAL; }).length;
    var repetitions = keys.reduce(function (sum, key) { return sum + getHeartFoundationTotal(getHeartUnit(key)); }, 0);
    var possible = keys.length * HEART_FOUNDATION_TOTAL;
    var page = getHeartPageUnit(pageData && pageData.page);
    return {
      keys: keys,
      collected: collected,
      total: keys.length,
      repetitions: repetitions,
      possible: possible,
      percent: possible ? Math.round(repetitions / possible * 100) : 0,
      ready: keys.length > 0 && collected === keys.length,
      permanent: page.permanent,
      page: page
    };
  }

  function normalizeLinked33Page(raw, pageNumber) {
    var page = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    page.pageNumber = Math.max(1, Math.min(604, Number(page.pageNumber || pageNumber) || 1));
    if (!page.verseCounts || typeof page.verseCounts !== "object" || Array.isArray(page.verseCounts)) page.verseCounts = {};
    if (!page.segmentCounts || typeof page.segmentCounts !== "object" || Array.isArray(page.segmentCounts)) page.segmentCounts = {};
    if (!page.daily || typeof page.daily !== "object" || Array.isArray(page.daily)) page.daily = {};
    Object.keys(page.verseCounts).forEach(function (key) {
      page.verseCounts[key] = Math.max(0, Math.min(LINKED_33_TARGET, Number(page.verseCounts[key]) || 0));
    });
    Object.keys(page.segmentCounts).forEach(function (key) {
      page.segmentCounts[key] = Math.max(0, Math.min(LINKED_33_TARGET, Number(page.segmentCounts[key]) || 0));
    });
    page.startedAt = typeof page.startedAt === "string" ? page.startedAt : "";
    page.lastAcceptedAt = typeof page.lastAcceptedAt === "string" ? page.lastAcceptedAt : "";
    page.completedAt = typeof page.completedAt === "string" ? page.completedAt : "";
    return page;
  }

  function getLinked33PageUnit(pageNumber) {
    var key = String(Math.max(1, Math.min(604, Number(pageNumber) || 1)));
    state.heartMushaf.linked33Pages[key] = normalizeLinked33Page(state.heartMushaf.linked33Pages[key], Number(key));
    return state.heartMushaf.linked33Pages[key];
  }

  function getLinked33PageSummary(pageData) {
    var keys = getHeartPageVerseKeys(pageData);
    var page = getLinked33PageUnit(pageData && pageData.page);
    var currentTask = null;
    var verseTotal = 0;
    var segmentTotal = 0;
    var collected = 0;
    for (var index = 0; index < keys.length; index += 1) {
      var key = keys[index];
      var verseCount = Math.max(0, Math.min(LINKED_33_TARGET, Number(page.verseCounts[key]) || 0));
      page.verseCounts[key] = verseCount;
      verseTotal += verseCount;
      if (verseCount >= LINKED_33_TARGET) collected += 1;
      if (!currentTask && verseCount < LINKED_33_TARGET) {
        currentTask = { type: "verse", index: index, key: key, keys: [key], count: verseCount };
      }
      if (index > 0 || (keys.length === 1 && index === 0)) {
        var segmentKey = keys.length === 1 ? "__page__" : key;
        var segmentCount = Math.max(0, Math.min(LINKED_33_TARGET, Number(page.segmentCounts[segmentKey]) || 0));
        page.segmentCounts[segmentKey] = segmentCount;
        segmentTotal += segmentCount;
        if (!currentTask && segmentCount < LINKED_33_TARGET) {
          currentTask = { type: "segment", index: index, key: segmentKey, keys: keys.slice(0, index + 1), count: segmentCount, isPage: index === keys.length - 1 };
        }
      }
    }
    var linkedPassages = keys.length ? Math.max(1, keys.length - 1) : 0;
    var possible = (keys.length + linkedPassages) * LINKED_33_TARGET;
    var total = verseTotal + segmentTotal;
    var complete = keys.length > 0 && !currentTask;
    if (complete && !page.completedAt) page.completedAt = new Date().toISOString();
    return {
      keys: keys,
      collected: collected,
      total: keys.length,
      repetitions: total,
      possible: possible,
      percent: possible ? Math.round(total / possible * 100) : 0,
      ready: Boolean(currentTask),
      permanent: complete,
      complete: complete,
      currentTask: currentTask,
      page: page
    };
  }

  function normalizeTurkishWallPage(raw, pageNumber) {
    var page = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    page.pageNumber = Math.max(1, Math.min(604, Number(page.pageNumber || pageNumber) || 1));
    if (!page.verseCounts || typeof page.verseCounts !== "object" || Array.isArray(page.verseCounts)) page.verseCounts = {};
    if (!page.wallCounts || typeof page.wallCounts !== "object" || Array.isArray(page.wallCounts)) page.wallCounts = {};
    if (!page.daily || typeof page.daily !== "object" || Array.isArray(page.daily)) page.daily = {};
    Object.keys(page.verseCounts).forEach(function (key) { page.verseCounts[key] = Math.max(0, Math.min(LINKED_33_TARGET, Number(page.verseCounts[key]) || 0)); });
    Object.keys(page.wallCounts).forEach(function (key) { page.wallCounts[key] = Math.max(0, Math.min(LINKED_33_TARGET, Number(page.wallCounts[key]) || 0)); });
    page.startedAt = typeof page.startedAt === "string" ? page.startedAt : "";
    page.lastAcceptedAt = typeof page.lastAcceptedAt === "string" ? page.lastAcceptedAt : "";
    page.completedAt = typeof page.completedAt === "string" ? page.completedAt : "";
    return page;
  }

  function getTurkishWallPageUnit(pageNumber) {
    var key = String(Math.max(1, Math.min(604, Number(pageNumber) || 1)));
    state.heartMushaf.turkishWallPages[key] = normalizeTurkishWallPage(state.heartMushaf.turkishWallPages[key], Number(key));
    return state.heartMushaf.turkishWallPages[key];
  }

  function buildTurkishWallTasks(keys, page) {
    var tasks = [];
    if (!keys.length) return tasks;
    var bottomIndex = keys.length - 1;
    tasks.push({ type: "verse", role: "foundation", key: keys[bottomIndex], keys: [keys[bottomIndex]], count: Number(page.verseCounts[keys[bottomIndex]]) || 0 });
    if (keys.length === 1) {
      tasks.push({ type: "segment", role: "wall", key: "__page__", keys: keys.slice(), count: Number(page.wallCounts.__page__) || 0, isPage: true });
      return tasks;
    }
    var highestIndex = bottomIndex;
    while (highestIndex > 0) {
      var jumpIndex = Math.max(0, highestIndex - 2);
      var jumpKey = keys[jumpIndex];
      tasks.push({ type: "verse", role: jumpIndex === 0 && highestIndex === 1 ? "foundation" : "jump", key: jumpKey, keys: [jumpKey], count: Number(page.verseCounts[jumpKey]) || 0 });
      var gapIndex = jumpIndex + 1;
      if (gapIndex < highestIndex) {
        var gapKey = keys[gapIndex];
        tasks.push({ type: "verse", role: "gap", key: gapKey, keys: [gapKey], count: Number(page.verseCounts[gapKey]) || 0 });
      }
      highestIndex = jumpIndex;
      var wallKey = keys[highestIndex];
      tasks.push({ type: "segment", role: "wall", key: wallKey, keys: keys.slice(highestIndex), count: Number(page.wallCounts[wallKey]) || 0, isPage: highestIndex === 0 });
    }
    return tasks;
  }

  function getTurkishWallPageSummary(pageData) {
    var keys = getHeartPageVerseKeys(pageData);
    var page = getTurkishWallPageUnit(pageData && pageData.page);
    var tasks = buildTurkishWallTasks(keys, page);
    tasks.forEach(function (task) { task.count = Math.max(0, Math.min(LINKED_33_TARGET, Number(task.count) || 0)); });
    var currentTask = tasks.find(function (task) { return task.count < LINKED_33_TARGET; }) || null;
    var repetitions = tasks.reduce(function (sum, task) { return sum + task.count; }, 0);
    var possible = tasks.length * LINKED_33_TARGET;
    var collected = keys.filter(function (key) { return Math.max(0, Number(page.verseCounts[key]) || 0) >= LINKED_33_TARGET; }).length;
    var complete = keys.length > 0 && !currentTask;
    if (complete && !page.completedAt) page.completedAt = new Date().toISOString();
    return { keys: keys, tasks: tasks, collected: collected, total: keys.length, repetitions: repetitions, possible: possible, percent: possible ? Math.round(repetitions / possible * 100) : 0, ready: Boolean(currentTask), permanent: complete, complete: complete, currentTask: currentTask, page: page };
  }

  function getTurkishWallTaskText(summary) {
    var task = summary && summary.currentTask;
    if (!task) return t("turkishAllComplete");
    if (task.type === "segment") {
      if (task.isPage) return formatText("turkishCurrentPage", { count: formatMetric(task.count) });
      return formatText("turkishCurrentWall", { start: task.keys[0], end: task.keys[task.keys.length - 1], count: formatMetric(task.count) });
    }
    var key = task.role === "gap" ? "turkishCurrentGap" : (task.role === "jump" ? "turkishCurrentJump" : "turkishCurrentFoundation");
    return formatText(key, { reference: task.key, count: formatMetric(task.count) });
  }

  function getLinked33TaskText(summary) {
    var task = summary && summary.currentTask;
    if (!task) return t("linked33AllComplete");
    if (task.type === "verse") {
      return formatText("linked33CurrentVerse", { reference: task.key, count: formatMetric(task.count) });
    }
    if (task.isPage) return formatText("linked33CurrentPage", { count: formatMetric(task.count) });
    return formatText("linked33CurrentJoin", {
      start: task.keys[0],
      end: task.keys[task.keys.length - 1],
      count: formatMetric(task.count)
    });
  }

  function getLinked33TodayCount(summary) {
    if (!summary || !summary.page) return 0;
    return Math.max(0, Number(summary.page.daily[dateKey(new Date())]) || 0);
  }

  function heartDaysBetween(fromValue, toValue) {
    var from = new Date(fromValue);
    var to = new Date(toValue);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return 0;
    var fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
    var toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 12);
    return Math.round((toDay.getTime() - fromDay.getTime()) / 86400000);
  }

  function addHeartReviewDays(date, days) {
    var next = new Date(date);
    next.setHours(12, 0, 0, 0);
    next.setDate(next.getDate() + Number(days || 0));
    return next.toISOString();
  }

  function heartStageIndex(unit) {
    for (var index = 0; index < unit.weekCounts.length; index += 1) {
      if (unit.weekCounts[index] < HEART_STAGE_TARGET) return index;
    }
    return 2;
  }

  function formatHeartReviewDate(value) {
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return t("heartNotScheduled");
    var days = heartDaysBetween(new Date(), date);
    if (days > 0) return formatText("heartDaysLeft", { days: formatMetric(days) });
    if (days === 0) return t("heartDueToday");
    return formatText("heartOverdueDays", { days: formatMetric(Math.abs(days)) });
  }

  function getHeartPresentation(unit) {
    var total = getHeartFoundationTotal(unit);
    var now = new Date();
    var lastAccepted = unit.lastAcceptedAt ? new Date(unit.lastAcceptedAt) : null;
    var inactiveDays = lastAccepted && Number.isFinite(lastAccepted.getTime()) ? heartDaysBetween(lastAccepted, now) : 0;
    var dueDate = unit.nextReviewAt ? new Date(unit.nextReviewAt) : null;
    var overdueDays = dueDate && Number.isFinite(dueDate.getTime()) ? Math.max(0, heartDaysBetween(dueDate, now)) : 0;
    var reveal = Math.round(total / HEART_FOUNDATION_TOTAL * 100);
    var statusKey = total ? "heartBuilding" : "heartNotStarted";
    var dormant = total > 0 && total < HEART_FOUNDATION_TOTAL && inactiveDays >= 7;
    var protectedPage = unit.permanent || total >= HEART_FOUNDATION_TOTAL;
    if (protectedPage) {
      unit.permanent = true;
      reveal = 100;
      dormant = false;
      statusKey = "heartPermanent";
    } else if (dormant || overdueDays > 0) statusKey = "heartNeedsReview";
    if (!protectedPage && dormant) reveal = Math.max(12, Math.round(reveal * 0.45));
    return { total: total, reveal: reveal, statusKey: statusKey, dormant: dormant, protectedPage: protectedPage, overdueDays: overdueDays };
  }

  function populateHeartSelectors() {
    var surahSelect = document.getElementById("heart-surah-select");
    var ayahSelect = document.getElementById("heart-ayah-select");
    if (!surahSelect || !ayahSelect || !currentSurah || !currentVerse) return;
    surahSelect.textContent = "";
    var chapters = getCatalogChapters();
    (quranCatalogReady ? chapters : corpus).forEach(function (item) {
      var names = quranCatalogReady ? getChapterNames(item, getLocalSurahExact(item.id)) : item.names;
      var option = document.createElement("option");
      option.value = String(item.id);
      option.textContent = item.id + ". " + (names[state.language] || names.en);
      surahSelect.appendChild(option);
    });
    surahSelect.value = String(currentSurah.id);
    ayahSelect.textContent = "";
    var chapter = mushafChapterNames[currentSurah.id];
    var ayahCount = chapter ? Number(chapter.verses_count) : currentSurah.verses.length;
    for (var ayahNumber = 1; ayahNumber <= ayahCount; ayahNumber += 1) {
      var option = document.createElement("option");
      option.value = String(ayahNumber);
      option.textContent = state.language === "ar" ? "الآية " + arabicNumber(ayahNumber) : (state.language === "en" ? "Verse " + ayahNumber : "Аят " + ayahNumber);
      ayahSelect.appendChild(option);
    }
    ayahSelect.value = String(currentVerse.ayah);
  }

  function setTranslatedText(element, key) {
    if (!element) return;
    element.setAttribute("data-i18n", key);
    element.textContent = t(key);
  }

  function isStructured33Method(method) {
    return method === "linked33" || method === "turkishWall33";
  }

  function getStructuredPageSummary(pageData, method) {
    return method === "turkishWall33" ? getTurkishWallPageSummary(pageData) : getLinked33PageSummary(pageData);
  }

  function getStructuredTaskText(summary, method) {
    return method === "turkishWall33" ? getTurkishWallTaskText(summary) : getLinked33TaskText(summary);
  }

  function updateMemorizationMethodUi() {
    var linked33 = state.memorizationMethod === "linked33";
    var turkish = state.memorizationMethod === "turkishWall33";
    var lawh = state.memorizationMethod === "mauritanianLawh";
    var structured = linked33 || turkish;
    var memorizeView = document.getElementById("view-memorize");
    if (memorizeView) memorizeView.setAttribute("data-memorization-method", state.memorizationMethod);
    document.querySelectorAll("[data-hifz-method]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-hifz-method") === state.memorizationMethod));
    });
    var stages300 = document.getElementById("heart-stages-300");
    var stages33 = document.getElementById("heart-stages-33");
    var stagesTurkish = document.getElementById("heart-stages-turkish");
    var lawhWorkspace = document.getElementById("lawh-workspace");
    if (stages300) stages300.hidden = structured;
    if (stages33) stages33.hidden = !linked33;
    if (stagesTurkish) stagesTurkish.hidden = !turkish;
    if (lawhWorkspace) lawhWorkspace.hidden = !lawh;
    if (lawh) {
      renderLawhWorkflow();
      renderLawhLibrary();
      restoreLawhDraftForCurrentKey(false);
    }
    setTranslatedText(document.getElementById("memorize-intro"), lawh ? "memorizeIntroLawh" : (turkish ? "memorizeIntroTurkish" : (linked33 ? "memorizeIntro33" : "memorizeIntro300")));
    setTranslatedText(document.getElementById("heart-rule-text"), turkish ? "heartRuleTurkish" : (linked33 ? "heartRule33" : "heartRule"));
    setTranslatedText(document.getElementById("heart-rule-title"), turkish ? "heartRuleTurkishTitle" : (linked33 ? "heartRule33Title" : "heartRuleTitle"));
    setTranslatedText(document.getElementById("heart-next-review-label"), turkish ? "heartNextStepTurkish" : (linked33 ? "heartNextStep33" : "heartNextReview"));
    setTranslatedText(document.getElementById("heart-strength-label"), turkish ? "heartPageProgressTurkish" : (linked33 ? "heartPageProgress33" : "heartStrength"));
    setTranslatedText(document.getElementById("heart-practice-title"), turkish ? "heartPracticeTitleTurkish" : (linked33 ? "heartPracticeTitle33" : "heartPracticeTitle"));
    setTranslatedText(document.getElementById("heart-practice-intro"), turkish ? "heartPracticeIntroTurkish" : (linked33 ? "heartPracticeIntro33" : "heartPracticeIntro"));
    setTranslatedText(document.getElementById("memory-live-label"), turkish ? "memoryLiveCounterTurkish" : (linked33 ? "memoryLiveCounter33" : "memoryLiveCounter"));
    setTranslatedText(document.getElementById("heart-progress-label"), turkish ? "turkishProgressLabel" : (linked33 ? "linked33ProgressLabel" : "heartFoundation"));
    var methodTitle = document.getElementById("heart-method-title");
    if (methodTitle) methodTitle.textContent = structured ? formatMetric(LINKED_33_TARGET) + " × " + formatMetric(LINKED_33_TARGET) : "100 + 100 + 100";
    document.querySelectorAll("[data-linked33-target]").forEach(function (target) { target.textContent = formatMetric(LINKED_33_TARGET); });
    document.querySelectorAll("[data-turkish-target]").forEach(function (target) { target.textContent = formatMetric(LINKED_33_TARGET); });
    var totalTarget = document.getElementById("heart-total-target");
    var memoryTarget = document.getElementById("memory-heart-target");
    if (totalTarget) totalTarget.textContent = formatMetric(structured ? LINKED_33_TARGET : HEART_FOUNDATION_TOTAL);
    if (memoryTarget) memoryTarget.textContent = formatMetric(structured ? LINKED_33_TARGET : HEART_FOUNDATION_TOTAL);
    renderHifzChoiceUi();
  }

  function getLinked33PageForCurrentVerse() {
    if (!currentSurah || !currentVerse || !heartCurrentPageData) return null;
    var key = getVerseKey(currentSurah, currentVerse);
    return getHeartPageVerseKeys(heartCurrentPageData).indexOf(key) >= 0 ? heartCurrentPageData : null;
  }

  function renderLinked33HeartMushaf(book, pageData) {
    var key = getVerseKey(currentSurah, currentVerse);
    var method = state.memorizationMethod;
    var turkish = method === "turkishWall33";
    var summary = pageData ? getStructuredPageSummary(pageData, method) : null;
    var pageUnit = summary ? summary.page : null;
    var verseCount = pageUnit ? Math.max(0, Number(pageUnit.verseCounts[key]) || 0) : 0;
    var reveal = Math.round(verseCount / LINKED_33_TARGET * 100);
    var task = summary && summary.currentTask;
    var todayCount = getLinked33TodayCount(summary);
    document.getElementById("heart-ayah-reference").textContent = currentSurah.names[state.language] + " · " + key;
    document.getElementById("heart-ayah-text").textContent = currentVerse.text;
    document.getElementById("heart-total-count").textContent = formatMetric(verseCount);
    document.getElementById("heart-today-count").textContent = formatMetric(todayCount);
    var taskStage = turkish ? (task && task.type === "segment" ? 3 : (task && task.role === "gap" ? 2 : 1)) : (task && task.type === "segment" ? (task.isPage ? 3 : 2) : 1);
    document.getElementById("heart-current-stage").textContent = formatMetric(summary && summary.complete ? 3 : taskStage) + " / " + formatMetric(3);
    document.getElementById("heart-next-review").textContent = summary ? getStructuredTaskText(summary, method) : t(turkish ? "heartPagePendingTurkish" : "heartPagePending33");
    document.getElementById("heart-strength").textContent = formatMetric(summary ? summary.percent : 0) + "%";
    var status = document.getElementById("heart-status");
    if (status) {
      status.textContent = summary ? getStructuredTaskText(summary, method) : t("heartPageLoading");
      status.classList.toggle("is-protected", Boolean(summary && summary.complete));
      status.classList.remove("is-due");
    }
    var memoryCount = document.getElementById("memory-heart-count");
    var memoryProgress = document.getElementById("memory-heart-progress-bar");
    if (memoryCount) memoryCount.textContent = formatMetric(verseCount);
    if (memoryProgress) memoryProgress.style.width = Math.min(100, Math.round(verseCount / LINKED_33_TARGET * 100)) + "%";
    var finalTask = summary && turkish && summary.tasks.length ? summary.tasks[summary.tasks.length - 1] : null;
    var finalKey = summary && summary.keys.length === 1 ? "__page__" : (summary && summary.keys.length ? summary.keys[summary.keys.length - 1] : "");
    var finalCount = turkish ? (finalTask ? finalTask.count : 0) : (pageUnit && finalKey ? Math.max(0, Number(pageUnit.segmentCounts[finalKey]) || 0) : 0);
    var verseStageCount = task && task.type === "verse" ? task.count : (summary && summary.complete ? LINKED_33_TARGET : 0);
    var segmentStageCount = task && task.type === "segment" && !task.isPage ? task.count : (summary && summary.complete ? LINKED_33_TARGET : 0);
    document.getElementById("linked33-verse-count").textContent = formatMetric(verseStageCount);
    document.getElementById("linked33-segment-count").textContent = formatMetric(segmentStageCount);
    document.getElementById("linked33-page-count").textContent = formatMetric(finalCount);
    document.querySelectorAll("[data-linked33-stage]").forEach(function (stage) {
      var name = stage.getAttribute("data-linked33-stage");
      var current = task && ((name === "verse" && task.type === "verse") || (name === "segment" && task.type === "segment" && !task.isPage) || (name === "page" && task.type === "segment" && task.isPage));
      stage.classList.toggle("is-current", Boolean(current));
      stage.classList.toggle("is-complete", Boolean(summary && summary.complete && name === "page"));
    });
    if (turkish) {
      var foundationCount = task && task.type === "verse" && task.role !== "gap" ? task.count : (summary && summary.complete ? LINKED_33_TARGET : 0);
      var gapCount = task && task.type === "verse" && task.role === "gap" ? task.count : (summary && summary.complete ? LINKED_33_TARGET : 0);
      var wallCount = task && task.type === "segment" ? task.count : (summary && summary.complete ? LINKED_33_TARGET : 0);
      document.getElementById("turkish-foundation-count").textContent = formatMetric(foundationCount);
      document.getElementById("turkish-gap-count").textContent = formatMetric(gapCount);
      document.getElementById("turkish-wall-count").textContent = formatMetric(wallCount);
      document.querySelectorAll("[data-turkish-stage]").forEach(function (stage) {
        var name = stage.getAttribute("data-turkish-stage");
        var current = task && ((name === "foundation" && task.type === "verse" && task.role !== "gap") || (name === "gap" && task.type === "verse" && task.role === "gap") || (name === "wall" && task.type === "segment"));
        stage.classList.toggle("is-current", Boolean(current));
        stage.classList.toggle("is-complete", Boolean(summary && summary.complete && name === "wall"));
      });
    }
    var startLabel = document.querySelector("#heart-start-practice span");
    if (startLabel) startLabel.textContent = t(turkish ? (summary && summary.complete ? "turkishMethodComplete" : "turkishOpenStep") : (summary && summary.complete ? "linked33MethodComplete" : "linked33OpenStep"));
    var startButton = document.getElementById("heart-start-practice");
    if (startButton) startButton.disabled = Boolean(summary && summary.complete);
    book.style.setProperty("--heart-reveal", reveal + "%");
    book.classList.remove("is-dormant");
    book.classList.toggle("is-complete", verseCount >= LINKED_33_TARGET);
    if (summary) renderHeartPageLaunch(pageData);
  }

  function renderHeartMushaf() {
    var book = document.getElementById("heart-book");
    if (!book || !currentSurah || !currentVerse) return;
    updateMemorizationMethodUi();
    if (state.memorizationMethod === "mauritanianLawh") return;
    populateHeartSelectors();
    if (isStructured33Method(state.memorizationMethod)) {
      renderLinked33HeartMushaf(book, getLinked33PageForCurrentVerse());
      return;
    }
    var key = getVerseKey(currentSurah, currentVerse);
    var unit = getHeartUnit(key);
    var presentation = getHeartPresentation(unit);
    var todayCount = Math.max(0, Number(unit.daily[dateKey(new Date())]) || 0);
    var stageIndex = heartStageIndex(unit);
    document.getElementById("heart-ayah-reference").textContent = currentSurah.names[state.language] + " · " + key;
    document.getElementById("heart-ayah-text").textContent = currentVerse.text;
    document.getElementById("heart-total-count").textContent = formatMetric(presentation.total);
    var memoryHeartCount = document.getElementById("memory-heart-count");
    if (memoryHeartCount) memoryHeartCount.textContent = formatMetric(presentation.total);
    var memoryHeartProgress = document.getElementById("memory-heart-progress-bar");
    if (memoryHeartProgress) memoryHeartProgress.style.width = Math.min(100, Math.round((presentation.total / HEART_FOUNDATION_TOTAL) * 100)) + "%";
    document.getElementById("heart-today-count").textContent = formatMetric(todayCount);
    document.getElementById("heart-current-stage").textContent = formatMetric(presentation.total >= HEART_FOUNDATION_TOTAL ? 3 : stageIndex + 1) + " / " + formatMetric(3);
    document.getElementById("heart-strength").textContent = formatMetric(presentation.reveal) + "%";
    document.getElementById("heart-next-review").textContent = presentation.total >= HEART_FOUNDATION_TOTAL ? formatHeartReviewDate(unit.nextReviewAt) : t("heartNotScheduled");
    document.getElementById("heart-status").textContent = t(presentation.statusKey);
    document.getElementById("heart-status").classList.toggle("is-protected", presentation.protectedPage);
    document.getElementById("heart-status").classList.toggle("is-due", presentation.dormant || presentation.overdueDays > 0);
    unit.weekCounts.forEach(function (count, index) {
      var value = document.getElementById("heart-stage-" + ["one", "two", "three"][index]);
      var stage = document.querySelector('[data-heart-stage="' + (index + 1) + '"]');
      if (value) value.textContent = formatMetric(count);
      if (stage) {
        stage.classList.toggle("is-complete", count >= HEART_STAGE_TARGET);
        stage.classList.toggle("is-current", presentation.total < HEART_FOUNDATION_TOTAL && index === stageIndex);
      }
    });
    book.style.setProperty("--heart-reveal", presentation.reveal + "%");
    book.classList.toggle("is-dormant", !presentation.protectedPage && (presentation.dormant || presentation.overdueDays > 0));
    book.classList.toggle("is-complete", presentation.total >= HEART_FOUNDATION_TOTAL);
    var startButton = document.getElementById("heart-start-practice");
    var startLabel = startButton && startButton.querySelector("span");
    if (startButton) startButton.disabled = false;
    if (startLabel) startLabel.textContent = t("heartStart");
    if (heartCurrentPageData && getHeartPageVerseKeys(heartCurrentPageData).indexOf(key) >= 0) renderHeartPageLaunch(heartCurrentPageData);
  }

  function renderHeartPageLaunch(pageData) {
    var launch = document.getElementById("heart-page-launch");
    var title = document.getElementById("heart-page-launch-title");
    var progress = document.getElementById("heart-page-launch-progress");
    if (!launch || !title || !progress || !pageData) return;
    var structured = isStructured33Method(state.memorizationMethod);
    var summary = structured ? getStructuredPageSummary(pageData, state.memorizationMethod) : getHeartPageSummary(pageData);
    title.textContent = t("mushafPage") + " " + formatMetric(pageData.page);
    progress.textContent = structured ? getStructuredTaskText(summary, state.memorizationMethod) : formatText("heartPageLaunchProgress", { collected: formatMetric(summary.collected), total: formatMetric(summary.total), percent: formatMetric(summary.percent) });
    launch.classList.toggle("is-ready", summary.ready && !summary.permanent);
    launch.classList.toggle("is-permanent", summary.permanent);
    launch.setAttribute("aria-label", t("openHeartPage") + ": " + title.textContent + ", " + progress.textContent);
    updatePageRecallUi();
  }

  function recordHeartRecitation(key) {
    var unit = getHeartUnit(key);
    var now = new Date();
    var today = dateKey(now);
    var todayCount = Math.max(0, Number(unit.daily[today]) || 0);
    var presentation = getHeartPresentation(unit);
    if (!unit.startedAt) unit.startedAt = now.toISOString();
    unit.daily[today] = todayCount + 1;
    unit.lastAcceptedAt = now.toISOString();
    if (presentation.total < HEART_FOUNDATION_TOTAL) {
      var stageIndex = heartStageIndex(unit);
      unit.weekCounts[stageIndex] = Math.min(HEART_STAGE_TARGET, unit.weekCounts[stageIndex] + 1);
      var total = getHeartFoundationTotal(unit);
      if (total >= HEART_FOUNDATION_TOTAL) {
        unit.completedAt = now.toISOString();
        unit.permanent = true;
        unit.nextReviewAt = addHeartReviewDays(now, HEART_REVIEW_INTERVALS[0]);
        unit.maintenanceCount = 0;
      }
      return { messageKey: "heartCreditRecorded", values: { count: formatMetric(total) } };
    }
    var dueDate = new Date(unit.nextReviewAt);
    if (!Number.isFinite(dueDate.getTime()) || now.getTime() < dueDate.getTime()) return { messageKey: "heartPracticeOnly", values: {} };
    unit.maintenanceCount = Math.min(HEART_MAINTENANCE_TARGET, unit.maintenanceCount + 1);
    if (unit.maintenanceCount >= HEART_MAINTENANCE_TARGET) {
      unit.maintenanceLevel += 1;
      unit.maintenanceCount = 0;
      var intervalIndex = Math.min(unit.maintenanceLevel, HEART_REVIEW_INTERVALS.length - 1);
      unit.nextReviewAt = addHeartReviewDays(now, HEART_REVIEW_INTERVALS[intervalIndex]);
      return { messageKey: "heartMaintenanceComplete", values: {} };
    }
    return { messageKey: "heartMaintenanceRecorded", values: { count: formatMetric(unit.maintenanceCount) } };
  }

  function recordLinked33VerseRecitation(key, pageData) {
    if (!pageData) return { counted: false, messageKey: "linked33WrongVerse", values: {} };
    var summary = getLinked33PageSummary(pageData);
    var task = summary.currentTask;
    if (!task || task.type !== "verse" || task.key !== String(key || "")) return { counted: false, messageKey: summary.complete ? "linked33MethodComplete" : "linked33WrongVerse", values: {} };
    var now = new Date();
    var page = summary.page;
    var today = dateKey(now);
    if (!page.startedAt) page.startedAt = now.toISOString();
    page.lastAcceptedAt = now.toISOString();
    page.daily[today] = Math.max(0, Number(page.daily[today]) || 0) + 1;
    page.verseCounts[task.key] = Math.min(LINKED_33_TARGET, task.count + 1);
    var count = page.verseCounts[task.key];
    var nextSummary = getLinked33PageSummary(pageData);
    return {
      counted: true,
      total: count,
      stepComplete: count >= LINKED_33_TARGET,
      methodComplete: nextSummary.complete,
      messageKey: nextSummary.complete ? "linked33MethodComplete" : (count >= LINKED_33_TARGET ? "linked33StepComplete" : "linked33CreditRecorded"),
      values: { count: formatMetric(count) }
    };
  }

  function recordTurkishWallVerseRecitation(key, pageData) {
    if (!pageData) return { counted: false, messageKey: "turkishWrongVerse", values: {} };
    var summary = getTurkishWallPageSummary(pageData);
    var task = summary.currentTask;
    if (!task || task.type !== "verse" || task.key !== String(key || "")) return { counted: false, messageKey: summary.complete ? "turkishMethodComplete" : "turkishWrongVerse", values: {} };
    var now = new Date();
    var page = summary.page;
    var today = dateKey(now);
    if (!page.startedAt) page.startedAt = now.toISOString();
    page.lastAcceptedAt = now.toISOString();
    page.daily[today] = Math.max(0, Number(page.daily[today]) || 0) + 1;
    page.verseCounts[task.key] = Math.min(LINKED_33_TARGET, task.count + 1);
    var count = page.verseCounts[task.key];
    var nextSummary = getTurkishWallPageSummary(pageData);
    return { counted: true, total: count, stepComplete: count >= LINKED_33_TARGET, methodComplete: nextSummary.complete, messageKey: nextSummary.complete ? "turkishMethodComplete" : (count >= LINKED_33_TARGET ? "turkishStepComplete" : "turkishCreditRecorded"), values: { count: formatMetric(count) } };
  }

  function findHeartPageVerse(pageData, key) {
    return pageData && Array.isArray(pageData.verses) ? pageData.verses.find(function (verse) { return String(verse.verse_key || "") === String(key || ""); }) : null;
  }

  function openLinked33VerseTask(pageData, task, startNow) {
    var verse = findHeartPageVerse(pageData, task && task.key);
    if (!verse) {
      showToast(t("heartPageLoadError"));
      return false;
    }
    linked33Session = null;
    memoryPracticeContext = { method: state.memorizationMethod, pageNumber: Number(pageData.page), key: task.key };
    var dialog = document.getElementById("heart-page-dialog");
    if (dialog && dialog.open) dialog.close();
    setMushafMode(false);
    activateMushafVerse(verse, true);
    renderMemoryVerse();
    navigate("memorize");
    var stage = document.querySelector(".memory-stage");
    if (stage) stage.scrollIntoView({ behavior: "smooth", block: "start" });
    if (startNow) window.setTimeout(function () { startMemoryRecognition(false); }, 180);
    return true;
  }

  function startLinked33Segment(pageData, task) {
    if (!pageData || !task || task.type !== "segment" || !task.keys.length) return;
    var pageNumber = Number(pageData.page);
    var sameSession = linked33Session && linked33Session.method === state.memorizationMethod && linked33Session.pageNumber === pageNumber && linked33Session.key === task.key;
    if (!sameSession) linked33Session = { method: state.memorizationMethod, pageNumber: pageNumber, key: task.key, keys: task.keys.slice(), nextIndex: 0, isPage: Boolean(task.isPage) };
    memoryPracticeContext = null;
    state.recitationFlow = "continuous";
    state.recitationFlowExplicit = true;
    state.autoAdvance = true;
    state.strictCorrection = true;
    updateRecitationFlowUi();
    saveState();
    var dialog = document.getElementById("heart-page-dialog");
    if (dialog && dialog.open) dialog.close();
    navigate("read");
    setMushafMode(true, true);
    selectReaderMode("mushaf");
    showToast(t(state.memorizationMethod === "turkishWall33" ? "turkishJoinStarted" : "linked33JoinStarted"));
    loadMushafPage(pageNumber, false).then(function () {
      if (!linked33Session || linked33Session.pageNumber !== pageNumber) return;
      var expectedKey = linked33Session.keys[linked33Session.nextIndex] || linked33Session.keys[0];
      var verse = mushafPageVerses.find(function (item) { return String(item.verse_key || "") === expectedKey; });
      if (!verse) {
        linked33Session = null;
        stopContinuousSession();
        showToast(t("heartPageLoadError"));
        return;
      }
      activateMushafVerse(verse, true);
      window.setTimeout(function () { startRecognition(true); }, 180);
    });
  }

  function startLinked33CurrentStep(pageData) {
    var method = state.memorizationMethod;
    var turkish = method === "turkishWall33";
    var summary = getStructuredPageSummary(pageData, method);
    if (summary.complete || !summary.currentTask) {
      showToast(t(turkish ? "turkishMethodComplete" : "linked33MethodComplete"));
      return;
    }
    if (summary.currentTask.type === "verse") openLinked33VerseTask(pageData, summary.currentTask, true);
    else startLinked33Segment(pageData, summary.currentTask);
  }

  function startActiveMemorizationStep() {
    if (!isStructured33Method(state.memorizationMethod)) {
      var stage = document.querySelector(".memory-stage");
      if (stage) stage.scrollIntoView({ behavior: "smooth", block: "start" });
      showToast(t("heartPracticeScroll"));
      startMemoryRecognition(false);
      return;
    }
    loadHeartPageContextForCurrentVerse().then(startLinked33CurrentStep).catch(function () { showToast(t("heartPageLoadError")); });
  }

  function selectMemorizationMethod(method, announce) {
    var next = HIFZ_METHODS.some(function (item) { return item.id === method; }) ? method : "foundation300";
    if (state.memorizationMethod === next) return;
    memorySeriesActive = false;
    stopMemoryRecognition(true);
    stopContinuousSession();
    linkedPageSession = null;
    linked33Session = null;
    memoryPracticeContext = null;
    state.memorizationMethod = next;
    saveState();
    updateMemorizationMethodUi();
    renderHeartMushaf();
    renderHeartReadCounter();
    updateMemoryCounterDisplay();
    if (heartCurrentPageData) renderHeartPageLaunch(heartCurrentPageData);
    if (announce) showToast(t(next === "mauritanianLawh" ? "hifzMethodChangedLawh" : (next === "turkishWall33" ? "hifzMethodChangedTurkish" : (next === "linked33" ? "hifzMethodChanged33" : "hifzMethodChanged300"))));
  }

  function registerLinked33SegmentVerse(verseKey) {
    if (!linked33Session || !linked33Session.keys.length) return { active: false };
    var key = String(verseKey || "");
    var expected = linked33Session.keys[linked33Session.nextIndex];
    if (key !== expected) {
      linked33Session.nextIndex = key === linked33Session.keys[0] ? 1 : 0;
      showToast(t("heartLinkedRestarted"));
      return { active: true, cycleComplete: false };
    }
    linked33Session.nextIndex += 1;
    if (linked33Session.nextIndex < linked33Session.keys.length) {
      showToast(formatText(linked33Session.method === "turkishWall33" ? "turkishJoinProgress" : "linked33JoinProgress", { done: formatMetric(linked33Session.nextIndex), total: formatMetric(linked33Session.keys.length) }));
      return { active: true, cycleComplete: false };
    }
    var pageData = heartPageCache[linked33Session.pageNumber] || heartCurrentPageData;
    var turkish = linked33Session.method === "turkishWall33";
    var page = turkish ? getTurkishWallPageUnit(linked33Session.pageNumber) : getLinked33PageUnit(linked33Session.pageNumber);
    var now = new Date();
    var today = dateKey(now);
    page.daily[today] = Math.max(0, Number(page.daily[today]) || 0) + 1;
    page.lastAcceptedAt = now.toISOString();
    var counts = turkish ? page.wallCounts : page.segmentCounts;
    counts[linked33Session.key] = Math.min(LINKED_33_TARGET, Math.max(0, Number(counts[linked33Session.key]) || 0) + 1);
    var count = counts[linked33Session.key];
    var nextSummary = turkish ? getTurkishWallPageSummary(pageData) : getLinked33PageSummary(pageData);
    var methodComplete = nextSummary.complete;
    var shouldRestart = count < LINKED_33_TARGET;
    linked33Session.nextIndex = 0;
    recordHifzLearningSignal("clean", "connected", 0);
    saveState();
    renderHeartMushaf();
    renderHeartReadCounter();
    if (methodComplete) {
      linked33Session = null;
      showToast(t(turkish ? "turkishPageComplete" : "linked33PageComplete"));
    } else {
      showToast(formatText(turkish ? "turkishJoinCounted" : "linked33JoinCounted", { count: formatMetric(count) }));
      if (!shouldRestart) linked33Session = null;
    }
    return { active: true, cycleComplete: true, restart: shouldRestart, stepComplete: !shouldRestart, methodComplete: methodComplete };
  }

  function restartLinked33SegmentCycle() {
    clearAutoAdvance();
    continuousResumePending = false;
    window.setTimeout(function () {
      if (!linked33Session || !heartCurrentPageData) return;
      var first = mushafPageVerses.find(function (verse) { return String(verse.verse_key || "") === linked33Session.keys[0]; });
      if (!first) return;
      activateMushafVerse(first, true);
      window.setTimeout(function () { if (linked33Session) startRecognition(true); }, 180);
    }, 760);
  }

  function getMushafVerseText(verse) {
    return (verse && Array.isArray(verse.words) ? verse.words : []).filter(function (word) {
      return word.char_type_name !== "end";
    }).map(function (word) {
      return String(word.text_qpc_hafs || "");
    }).filter(Boolean).join(" ");
  }

  function updateMushafHeartClasses() {
    var structured = isStructured33Method(state.memorizationMethod);
    var page = heartCurrentPageData ? (structured ? (state.memorizationMethod === "turkishWall33" ? getTurkishWallPageUnit(heartCurrentPageData.page) : getLinked33PageUnit(heartCurrentPageData.page)) : getHeartPageUnit(heartCurrentPageData.page)) : null;
    var linkedSummary = structured && heartCurrentPageData ? getStructuredPageSummary(heartCurrentPageData, state.memorizationMethod) : null;
    document.querySelectorAll(".mushaf-glyph[data-verse-key]").forEach(function (glyph) {
      var key = glyph.getAttribute("data-verse-key");
      var collected = structured ? Boolean(page && Number(page.verseCounts[key]) >= LINKED_33_TARGET) : getHeartFoundationTotal(getHeartUnit(key)) >= HEART_FOUNDATION_TOTAL;
      glyph.classList.toggle("is-heart-collected", collected);
      glyph.classList.toggle("is-heart-sealed", structured ? Boolean(linkedSummary && linkedSummary.complete) : Boolean(page && page.permanent));
    });
  }

  function renderHeartReadCounter() {
    var button = document.getElementById("open-heart-page");
    var count = document.getElementById("heart-read-count");
    if (!button || !count || !currentSurah || !currentVerse) return;
    var structured = isStructured33Method(state.memorizationMethod);
    var target = structured ? LINKED_33_TARGET : HEART_FOUNDATION_TOTAL;
    var key = getVerseKey(currentSurah, currentVerse);
    var linkedPage = getLinked33PageForCurrentVerse();
    var structuredPage = linkedPage ? (state.memorizationMethod === "turkishWall33" ? getTurkishWallPageUnit(linkedPage.page) : getLinked33PageUnit(linkedPage.page)) : null;
    var total = structured ? (structuredPage ? Math.max(0, Number(structuredPage.verseCounts[key]) || 0) : 0) : getHeartFoundationTotal(getHeartUnit(key));
    count.textContent = formatMetric(total);
    button.classList.toggle("is-complete", total >= target);
    button.setAttribute("aria-label", t("openHeartPage") + ": " + formatMetric(total) + " / " + formatMetric(target));
    updateMushafHeartClasses();
  }

  function fetchHeartPageData(pageNumber) {
    var page = Math.max(1, Math.min(604, Number(pageNumber) || 1));
    if (heartPageCache[page]) return Promise.resolve(heartPageCache[page]);
    var mushafId = state.mushafFont === "classic" ? 2 : 1;
    return window.fetch("/api/mushaf/page/" + page + "?mushaf=" + mushafId, { headers: { "X-Requested-With": "QuranCompanion" } }).then(function (response) {
      if (!response.ok) throw new Error("heart-page-unavailable");
      return response.json();
    }).then(function (data) {
      heartPageCache[page] = data;
      return data;
    });
  }

  function fetchHeartPageForVerse(surahId, ayahNumber) {
    var verseKey = Number(surahId) + ":" + Number(ayahNumber);
    if (heartCurrentPageData && getHeartPageVerseKeys(heartCurrentPageData).indexOf(verseKey) >= 0) return Promise.resolve(heartCurrentPageData);
    if (heartVersePageCache[verseKey]) return fetchHeartPageData(heartVersePageCache[verseKey]);
    return window.fetch("/api/mushaf/locate/" + Number(surahId) + "/" + Number(ayahNumber), { headers: { "X-Requested-With": "QuranCompanion" } }).then(function (response) {
      if (!response.ok) throw new Error("heart-page-location-unavailable");
      return response.json();
    }).then(function (location) {
      heartVersePageCache[verseKey] = Number(location.page);
      return fetchHeartPageData(location.page);
    });
  }

  function loadHeartPageContextForCurrentVerse() {
    if (!currentSurah || !currentVerse) return Promise.reject(new Error("verse-unavailable"));
    var verseKey = getVerseKey(currentSurah, currentVerse);
    var requestId = ++heartPageRequest;
    renderHeartReadCounter();
    return fetchHeartPageForVerse(currentSurah.id, currentVerse.ayah).then(function (pageData) {
      if (requestId !== heartPageRequest || !currentSurah || !currentVerse || getVerseKey(currentSurah, currentVerse) !== verseKey) return pageData;
      heartCurrentPageData = pageData;
      renderHeartReadCounter();
      renderHeartPageLaunch(pageData);
      renderHeartMushaf();
      updateMemoryCounterDisplay();
      var dialog = document.getElementById("heart-page-dialog");
      if (dialog && dialog.open) renderHeartPageDialog(pageData);
      return pageData;
    });
  }

  function activateHeartPageVerse(verseData, destination) {
    if (!verseData) return;
    setMushafMode(false);
    activateMushafVerse(verseData, true);
    navigate(destination === "memorize" ? "memorize" : "read");
    renderHeartReadCounter();
  }

  function applyMushafAppearance() {
    document.body.setAttribute("data-mushaf-paper", state.mushafPaper);
    document.body.setAttribute("data-mushaf-ink", state.mushafInk);
    document.querySelectorAll("[data-mushaf-paper-choice]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-mushaf-paper-choice") === state.mushafPaper));
    });
    document.querySelectorAll("[data-mushaf-ink-choice]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-mushaf-ink-choice") === state.mushafInk));
    });
  }

  function updateHeartPageSelection(verseKey, total, sheet) {
    var reference = document.getElementById("heart-page-selected-reference");
    var count = document.getElementById("heart-page-selected-count");
    if (reference) reference.textContent = String(verseKey || "—");
    var target = isStructured33Method(state.memorizationMethod) ? LINKED_33_TARGET : HEART_FOUNDATION_TOTAL;
    if (count) count.textContent = formatMetric(total || 0) + " / " + formatMetric(target);
    if (!sheet) return;
    sheet.querySelectorAll(".heart-mushaf-glyph.is-inspected").forEach(function (glyph) { glyph.classList.remove("is-inspected"); });
    if (!verseKey) return;
    sheet.querySelectorAll('[data-verse-key="' + verseKey + '"]').forEach(function (glyph) { glyph.classList.add("is-inspected"); });
  }

  function fitHeartMushafLines(container) {
    if (!container) return;
    if (heartMushafFitFrame) window.cancelAnimationFrame(heartMushafFitFrame);
    var lines = Array.prototype.slice.call(container.querySelectorAll(".heart-mushaf-line"));
    if (!lines.length) return;
    var compact = container.clientWidth <= 390;
    var minimumSize = compact ? 9 : 12;
    var headerAllowance = container.querySelectorAll(".mushaf-surah-banner,.mushaf-basmala").length * (compact ? 22 : 28) + 24;
    var availableHeight = Math.max(180, container.clientHeight - headerAllowance);
    var baseSize = Math.max(minimumSize, Math.min(compact ? 25 : 34, Math.floor(availableHeight / lines.length * .82)));
    lines.forEach(function (line) { line.style.setProperty("--heart-mushaf-line-font-size", baseSize + "px"); });
    heartMushafFitFrame = window.requestAnimationFrame(function () {
      lines.forEach(function (line) {
        var available = Math.max(1, line.clientWidth - 6);
        var glyphWidth = Array.prototype.slice.call(line.children).reduce(function (total, glyph) {
          return total + Math.max(glyph.offsetWidth, glyph.scrollWidth);
        }, 0);
        var safetyScale = state.mushafFont === "classic" ? 1.08 : 1.03;
        var needed = Math.max(1, line.scrollWidth, (glyphWidth + 4) * safetyScale);
        if (needed > available) {
          line.style.setProperty("--heart-mushaf-line-font-size", Math.max(minimumSize, Math.floor(baseSize * available / needed)) + "px");
        }
      });
      heartMushafFitFrame = null;
    });
  }

  function renderHeartMushafPage(pageData, summary) {
    var sheet = document.getElementById("heart-page-sheet");
    if (!sheet || !pageData || !Array.isArray(pageData.verses)) return;
    var requestId = ++heartMushafRenderRequest;
    sheet.innerHTML = '<div class="heart-page-sheet-loading">' + t("heartPageLoading") + "</div>";
    Promise.all([loadMushafFont(pageData.page), loadMushafChapterNames()]).then(function (results) {
      if (requestId !== heartMushafRenderRequest || !sheet) return;
      var fontInfo = results[0] || {};
      var resolvedFont = fontInfo.name || "Uthmanic Hafs";
      var resolvedVersion = fontInfo.loaded ? fontInfo.version : "readable";
      var lines = new Map();
      sheet.textContent = "";
      pageData.verses.forEach(function (verse) {
        (Array.isArray(verse.words) ? verse.words : []).forEach(function (word, index) {
          var lineNumber = Number(word.line_number) || 1;
          if (!lines.has(lineNumber)) lines.set(lineNumber, { words: [], headers: [] });
          var line = lines.get(lineNumber);
          if (verse.verse_number === 1 && index === 0) line.headers.push(Number(String(verse.verse_key).split(":")[0]));
          line.words.push({ word: word, verse: verse });
        });
      });
      Array.from(lines.keys()).sort(function (a, b) { return a - b; }).forEach(function (lineNumber) {
        var lineData = lines.get(lineNumber);
        lineData.headers.forEach(function (chapterId) { sheet.appendChild(makeMushafHeader(chapterId)); });
        var line = document.createElement("div");
        line.className = "mushaf-line heart-mushaf-line";
        line.setAttribute("data-line", String(lineNumber));
        lineData.words.forEach(function (item) {
          var word = item.word;
          var key = String(item.verse.verse_key || "");
          var structured = isStructured33Method(state.memorizationMethod);
          var target = structured ? LINKED_33_TARGET : HEART_FOUNDATION_TOTAL;
          var total = structured ? Math.max(0, Number(summary.page.verseCounts[key]) || 0) : getHeartFoundationTotal(getHeartUnit(key));
          var reveal = summary.permanent ? 1 : Math.min(1, .065 + .935 * total / target);
          var glyphButton = document.createElement("button");
          glyphButton.type = "button";
          glyphButton.className = "mushaf-glyph heart-mushaf-glyph" + (word.char_type_name === "end" ? " is-ayah-end" : "") + (total >= target ? " is-heart-collected" : "") + (summary.permanent ? " is-heart-sealed" : "");
          glyphButton.style.fontFamily = resolvedFont;
          glyphButton.style.setProperty("--heart-verse-opacity", reveal.toFixed(3));
          glyphButton.setAttribute("data-verse-key", key);
          glyphButton.setAttribute("aria-label", key + ": " + formatMetric(total) + " / " + formatMetric(target));
          var glyph = resolvedVersion === "v1" ? String(word.code_v1 || word.code_v2 || "") : (resolvedVersion === "v2" ? String(word.code_v2 || "") : String(word.text_qpc_hafs || ""));
          if (glyph.indexOf("<") === -1 && glyph.indexOf(">") === -1) glyphButton.textContent = glyph;
          else glyphButton.textContent = word.text_qpc_hafs || "";
          glyphButton.addEventListener("mouseenter", function () { updateHeartPageSelection(key, total, sheet); });
          glyphButton.addEventListener("focus", function () { updateHeartPageSelection(key, total, sheet); });
          glyphButton.addEventListener("click", function () {
            document.getElementById("heart-page-dialog").close();
            activateHeartPageVerse(item.verse, "read");
          });
          line.appendChild(glyphButton);
        });
        sheet.appendChild(line);
      });
      var footer = document.createElement("div");
      footer.className = "mushaf-page-footer";
      footer.textContent = state.language === "ar" ? arabicNumber(pageData.page) : String(pageData.page);
      sheet.appendChild(footer);
      var selectedKey = currentSurah && currentVerse ? getVerseKey(currentSurah, currentVerse) : (pageData.verses[0] && pageData.verses[0].verse_key);
      var selectedTotal = selectedKey ? (isStructured33Method(state.memorizationMethod) ? Math.max(0, Number(summary.page.verseCounts[selectedKey]) || 0) : getHeartFoundationTotal(getHeartUnit(selectedKey))) : 0;
      updateHeartPageSelection(selectedKey, selectedTotal, sheet);
      fitHeartMushafLines(sheet);
    }).catch(function () {
      if (requestId === heartMushafRenderRequest) sheet.innerHTML = '<div class="heart-page-sheet-loading">' + t("heartPageLoadError") + "</div>";
    });
  }

  function renderHeartPageDialog(pageData) {
    var sheet = document.getElementById("heart-page-sheet");
    if (!sheet || !pageData) return;
    heartCurrentPageData = pageData;
    heartPageCache[pageData.page] = pageData;
    getHeartPageVerseKeys(pageData).forEach(function (key) { heartVersePageCache[key] = Number(pageData.page); });
    var structured = isStructured33Method(state.memorizationMethod);
    var turkish = state.memorizationMethod === "turkishWall33";
    var summary = structured ? getStructuredPageSummary(pageData, state.memorizationMethod) : getHeartPageSummary(pageData);
    renderHeartPageLaunch(pageData);
    var pageNumber = document.getElementById("heart-page-number");
    var collected = document.getElementById("heart-page-collected");
    var meter = document.getElementById("heart-page-meter-fill");
    var lock = document.getElementById("heart-page-lock");
    var lockText = lock.querySelector("span");
    var connected = document.getElementById("heart-page-connected");
    var connectedStatus = document.getElementById("heart-connected-status");
    var connectedCount = document.getElementById("heart-connected-count");
    var startButton = document.getElementById("start-linked-page");
    var continueButton = document.getElementById("continue-heart-page");
    var startLabel = document.getElementById("start-linked-page-label");
    var startState = document.getElementById("start-linked-page-state");
    var continueState = document.getElementById("continue-heart-page-state");
    var nextStep = document.getElementById("heart-page-next-step");
    var activeLinked = structured ? Boolean(linked33Session && linked33Session.pageNumber === Number(pageData.page)) : Boolean(linkedPageSession && linkedPageSession.pageNumber === Number(pageData.page));
    pageNumber.textContent = formatMetric(pageData.page);
    collected.textContent = formatMetric(summary.collected) + " / " + formatMetric(summary.total);
    meter.style.width = summary.percent + "%";
    lock.classList.toggle("is-ready", summary.ready && !summary.permanent);
    lock.classList.toggle("is-permanent", summary.permanent);
    lockText.textContent = structured ? (summary.complete ? t(turkish ? "turkishMethodComplete" : "linked33MethodComplete") : getStructuredTaskText(summary, state.memorizationMethod)) : t(summary.permanent ? "heartPagePermanent" : (summary.ready ? "heartPageReady" : "heartPageBuilding"));
    var guidance = document.getElementById("heart-page-guidance");
    setTranslatedText(guidance, turkish ? "heartPageGuidanceTurkish" : (structured ? "heartPageGuidance33" : "heartPageGuidance"));
    var connectedTitle = connected.querySelector("strong");
    setTranslatedText(connectedTitle, turkish ? "heartConnectedTitleTurkish" : (structured ? "heartConnectedTitle33" : "heartConnectedTitle"));
    var completeLegend = document.querySelector(".heart-page-legend .is-complete + small");
    setTranslatedText(completeLegend, turkish ? "heartRevealCompleteTurkish" : (structured ? "heartRevealComplete33" : "heartRevealComplete"));
    connected.classList.toggle("is-active", activeLinked);
    connected.classList.toggle("is-complete", summary.permanent);
    var linkedDone = structured ? (activeLinked ? linked33Session.nextIndex : (summary.currentTask ? summary.currentTask.count : LINKED_33_TARGET)) : (activeLinked ? linkedPageSession.nextIndex : 0);
    if (structured) {
      connectedStatus.textContent = activeLinked ? formatText(turkish ? "turkishJoinProgress" : "linked33JoinProgress", { done: formatMetric(linked33Session.nextIndex), total: formatMetric(linked33Session.keys.length) }) : getStructuredTaskText(summary, state.memorizationMethod);
      connectedCount.textContent = formatMetric(summary.complete ? LINKED_33_TARGET : (summary.currentTask ? summary.currentTask.count : 0)) + " / " + formatMetric(LINKED_33_TARGET);
      startButton.disabled = summary.complete;
      startButton.setAttribute("aria-disabled", String(summary.complete));
      startButton.setAttribute("data-state", summary.complete ? "saved" : (activeLinked ? "active" : "ready"));
      startButton.classList.toggle("primary-button", !summary.complete);
      startButton.classList.toggle("secondary-button", summary.complete);
      startLabel.textContent = t(turkish ? (summary.complete ? "turkishMethodComplete" : (activeLinked ? "turkishContinueStep" : "turkishOpenStep")) : (summary.complete ? "linked33MethodComplete" : (activeLinked ? "linked33ContinueStep" : "linked33OpenStep")));
      startState.textContent = getStructuredTaskText(summary, state.memorizationMethod);
    } else {
      connectedStatus.textContent = t(summary.permanent ? "heartConnectedPermanent" : (activeLinked ? "heartConnectedActive" : (summary.ready ? "heartConnectedReady" : "heartConnectedLocked")));
      connectedCount.textContent = formatMetric(summary.permanent ? summary.total : linkedDone) + " / " + formatMetric(summary.total);
      startButton.disabled = !summary.ready;
      startButton.setAttribute("aria-disabled", String(!summary.ready));
      startButton.setAttribute("data-state", summary.permanent ? "saved" : (activeLinked ? "active" : (summary.ready ? "ready" : "locked")));
      startButton.classList.toggle("primary-button", summary.ready);
      startButton.classList.toggle("secondary-button", !summary.ready);
      startLabel.textContent = t(summary.permanent ? "heartOpenPermanent" : (activeLinked ? "heartContinueConnected" : "heartStartConnected"));
      startState.textContent = formatText(summary.permanent ? "heartLinkedSavedProgress" : (activeLinked ? "heartLinkedActiveProgress" : (summary.ready ? "heartLinkedReadyProgress" : "heartLinkedLockedProgress")), { collected: formatMetric(summary.collected), total: formatMetric(summary.total), done: formatMetric(linkedDone) });
    }
    continueState.textContent = formatText("heartCollectProgress", { collected: formatMetric(summary.collected), total: formatMetric(summary.total) });
    nextStep.textContent = structured ? getStructuredTaskText(summary, state.memorizationMethod) : t(summary.permanent ? "heartNextSaved" : (summary.ready ? "heartNextConnect" : "heartNextCollect"));
    continueButton.hidden = structured || summary.ready || summary.permanent;
    var linkedIcon = startButton.querySelector("use");
    if (linkedIcon) linkedIcon.setAttribute("href", structured && summary.currentTask && summary.currentTask.type === "verse" ? (turkish ? "#i-layers" : "#i-heart") : (summary.ready ? "#i-mic" : "#i-link"));
    renderHeartMushafPage(pageData, summary);
  }

  function openHeartPageDialog() {
    var dialog = document.getElementById("heart-page-dialog");
    var sheet = document.getElementById("heart-page-sheet");
    if (!dialog || !sheet) return;
    if (!dialog.open) dialog.showModal();
    sheet.innerHTML = '<div class="heart-page-sheet-loading">' + t("heartPageLoading") + "</div>";
    loadHeartPageContextForCurrentVerse().then(function (pageData) {
      renderHeartPageDialog(pageData);
    }).catch(function () {
      sheet.innerHTML = '<div class="heart-page-sheet-loading">' + t("heartPageLoadError") + "</div>";
    });
  }

  function continueHeartPage() {
    if (!heartCurrentPageData) return;
    if (isStructured33Method(state.memorizationMethod)) {
      startLinked33CurrentStep(heartCurrentPageData);
      return;
    }
    var verse = heartCurrentPageData.verses.find(function (item) {
      return getHeartFoundationTotal(getHeartUnit(item.verse_key)) < HEART_FOUNDATION_TOTAL;
    }) || heartCurrentPageData.verses[0];
    document.getElementById("heart-page-dialog").close();
    activateHeartPageVerse(verse, "read");
  }

  function startLinkedPageReading() {
    if (!heartCurrentPageData) return;
    if (isStructured33Method(state.memorizationMethod)) {
      startLinked33CurrentStep(heartCurrentPageData);
      return;
    }
    var summary = getHeartPageSummary(heartCurrentPageData);
    if (!summary.ready || !summary.keys.length) return;
    var pageNumber = Number(heartCurrentPageData.page);
    if (linkedPageSession && linkedPageSession.pageNumber === pageNumber) {
      document.getElementById("heart-page-dialog").close();
      navigate("read");
      setMushafMode(true, true);
      selectReaderMode("mushaf");
      loadMushafPage(pageNumber, false);
      return;
    }
    var page = getHeartPageUnit(pageNumber);
    page.connectedAttempts += 1;
    linkedPageSession = { pageNumber: pageNumber, keys: summary.keys.slice(), nextIndex: 0, reviewing: page.permanent };
    state.recitationFlow = "continuous";
    state.recitationFlowExplicit = true;
    state.autoAdvance = true;
    updateRecitationFlowUi();
    saveState();
    document.getElementById("heart-page-dialog").close();
    navigate("read");
    setMushafMode(true, true);
    selectReaderMode("mushaf");
    showToast(t("heartLinkedStarted"));
    loadMushafPage(pageNumber, false).then(function () {
      if (!linkedPageSession || linkedPageSession.pageNumber !== pageNumber) return;
      var first = mushafPageVerses.find(function (verse) {
        return String(verse.verse_key || "") === linkedPageSession.keys[0];
      });
      if (!first) {
        linkedPageSession = null;
        continuousSessionActive = false;
        showToast(t("heartPageLoadError"));
        return;
      }
      activateMushafVerse(first, true);
      window.setTimeout(function () { startRecognition(true); }, 160);
    });
  }

  function getPageRecallKeys(pageData) {
    return (pageData && Array.isArray(pageData.verses) ? pageData.verses : []).map(function (verse) {
      return String(verse.verse_key || "");
    }).filter(Boolean);
  }

  function pageRecallAcademyUrl() {
    var params = new URLSearchParams({ panel: "overview", feature: "page-recall", lang: state.language });
    return "/academy?" + params.toString();
  }

  function updatePageRecallAccessUi() {
    var card = document.getElementById("page-recall-card");
    var access = document.getElementById("page-recall-access");
    var label = document.getElementById("page-recall-access-label");
    var button = document.getElementById("start-page-recall");
    if (!card || !button) return;
    card.setAttribute("data-access-level", pageRecallAccessLevel);
    card.classList.toggle("is-access-checking", pageRecallAccessLevel === "checking");
    var hasAccess = pageRecallAccessLevel === "basic" || pageRecallAccessLevel === "guided";
    card.classList.toggle("is-access-active", hasAccess);
    card.classList.toggle("is-access-locked", pageRecallAccessLevel !== "checking" && !hasAccess);
    button.disabled = pageRecallAccessLevel === "checking";
    var buttonLabel = button.querySelector("span");
    if (hasAccess) {
      if (label) label.textContent = t("pageRecallAccessActive");
      if (buttonLabel) buttonLabel.textContent = t("pageRecallStart");
      if (access) access.setAttribute("aria-label", t("pageRecallAccessActive"));
      return;
    }
    if (pageRecallAccessLevel === "checking") {
      if (label) label.textContent = t("pageRecallAccessTier");
      if (buttonLabel) buttonLabel.textContent = t("pageRecallCheckingAccess");
      if (access) access.setAttribute("aria-label", t("pageRecallCheckingAccess"));
      return;
    }
    if (label) label.textContent = t("pageRecallAccountRequired");
    if (buttonLabel) buttonLabel.textContent = t(pageRecallAccessLevel === "error" ? "pageRecallAccessError" : "pageRecallOpenAcademy");
    if (access) access.setAttribute("aria-label", t("pageRecallAccountRequired"));
  }

  function getPageRecallAcademyAccess(force) {
    if (!force && pageRecallAccessPromise) return pageRecallAccessPromise;
    pageRecallAccessLevel = "checking";
    updatePageRecallAccessUi();
    if (window.location.protocol === "file:") {
      pageRecallAccessLevel = "basic";
      updatePageRecallAccessUi();
      return Promise.resolve(pageRecallAccessLevel);
    }
    pageRecallAccessPromise = window.fetch("/api/method/frappe.auth.get_logged_user", {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
    }).then(function (response) {
      if (!response.ok) throw new Error("academy-user-" + response.status);
      return response.json();
    }).then(function (payload) {
      var user = payload && payload.message ? String(payload.message) : "Guest";
      return user === "Guest" ? "open" : "basic";
    }).catch(function () {
      return "error";
    }).then(function (level) {
      pageRecallAccessLevel = level;
      updatePageRecallAccessUi();
      return level;
    });
    return pageRecallAccessPromise;
  }

  function enterPageRecall() {
    if (pageRecallAccessLevel === "basic" || pageRecallAccessLevel === "guided") {
      startPageRecall();
      return;
    }
    if (pageRecallAccessLevel === "checking") return;
    window.location.href = pageRecallAcademyUrl();
  }

  function updatePageRecallUi() {
    var page = pageRecallSession ? pageRecallSession.pageNumber : (heartCurrentPageData && heartCurrentPageData.page);
    var total = pageRecallSession ? pageRecallSession.keys.length : (heartCurrentPageData ? getPageRecallKeys(heartCurrentPageData).length : 0);
    var done = pageRecallSession ? pageRecallSession.nextIndex : 0;
    var cardPage = document.getElementById("page-recall-card-page");
    var dockTitle = document.getElementById("page-recall-dock-title");
    var dockStatus = document.getElementById("page-recall-dock-status");
    if (cardPage) cardPage.textContent = page ? t("mushafPage") + " " + formatMetric(page) : t("heartPageLoadingShort");
    if (dockTitle) dockTitle.textContent = t(pageRecallSession && pageRecallSession.complete ? "pageRecallComplete" : "pageRecallReady");
    if (dockStatus) dockStatus.textContent = page ? formatText("pageRecallStatus", {
      page: formatMetric(page), done: formatMetric(done), total: formatMetric(total)
    }) : t("pageRecallLoading");
    var toggle = document.getElementById("toggle-page-recall-text");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(pageRecallShowText));
      toggle.setAttribute("aria-label", t(pageRecallShowText ? "pageRecallHideText" : "pageRecallShowText"));
      var toggleLabel = toggle.querySelector("span");
      if (toggleLabel) toggleLabel.textContent = t(pageRecallShowText ? "pageRecallHideText" : "pageRecallShowText");
    }
    updatePageRecallAccessUi();
  }

  function preparePageRecall(pageData) {
    if (!pageData) return false;
    var keys = getPageRecallKeys(pageData);
    if (!keys.length) return false;
    pageRecallSession = { pageNumber: Number(pageData.page), keys: keys, nextIndex: 0, complete: false };
    pageRecallShowText = false;
    document.body.classList.add("page-recall-mode");
    document.body.classList.remove("page-recall-show-text");
    document.querySelectorAll("#mushaf-page .mushaf-glyph").forEach(function (glyph) {
      glyph.classList.remove("is-recognized", "is-warning", "is-error");
    });
    updatePageRecallUi();
    return true;
  }

  function clearPageRecallMode() {
    if (!pageRecallSession && !document.body.classList.contains("page-recall-mode")) return;
    pageRecallSession = null;
    pageRecallShowText = false;
    document.body.classList.remove("page-recall-mode", "page-recall-show-text");
    stopContinuousSession();
    updatePageRecallUi();
  }

  function finishPageRecall() {
    var completed = Boolean(pageRecallSession && pageRecallSession.complete);
    clearPageRecallMode();
    setMushafMode(false);
    selectReaderMode("read");
    navigate("memorize");
    showToast(t(completed ? "pageRecallComplete" : "pageRecallStopped"));
  }

  function startPageRecall() {
    if (pageRecallAccessLevel !== "basic" && pageRecallAccessLevel !== "guided") {
      window.location.href = pageRecallAcademyUrl();
      return;
    }
    stopMemoryRecognition(true);
    navigate("read");
    setStudioMode(false);
    state.recitationFlow = "continuous";
    state.recitationFlowExplicit = true;
    state.autoAdvance = true;
    state.strictCorrection = true;
    updateRecitationFlowUi();
    saveState();
    setMushafMode(true, true);
    selectReaderMode("mushaf");
    showToast(t("pageRecallLoading"));
    loadHeartPageContextForCurrentVerse().then(function (pageData) {
      return loadMushafPage(pageData.page, false).then(function () {
        if (!preparePageRecall(pageData)) return;
        var first = mushafPageVerses.find(function (verse) { return String(verse.verse_key || "") === pageRecallSession.keys[0]; }) || mushafPageVerses[0];
        if (first) activateMushafVerse(first, true);
        updatePageRecallUi();
        showToast(t("pageRecallStarted"));
      });
    }).catch(function () {
      clearPageRecallMode();
      setMushafMode(false);
      navigate("memorize");
      showToast(t("heartPageLoadError"));
    });
  }

  function registerPageRecallVerse(verseKey) {
    if (!pageRecallSession || pageRecallSession.complete) return { complete: false };
    var key = String(verseKey || "");
    var expected = pageRecallSession.keys[pageRecallSession.nextIndex];
    if (key !== expected) {
      showToast(t("pageRecallWrongOrder"));
      return { complete: false };
    }
    pageRecallSession.nextIndex += 1;
    pageRecallSession.complete = pageRecallSession.nextIndex >= pageRecallSession.keys.length;
    updatePageRecallUi();
    if (pageRecallSession.complete) {
      stopContinuousSession();
      showToast(t("pageRecallComplete"));
    }
    return { complete: pageRecallSession.complete };
  }

  function registerLinkedPageVerse(verseKey) {
    if (!linkedPageSession || !linkedPageSession.keys.length) return { sealed: false };
    var key = String(verseKey || "");
    var expected = linkedPageSession.keys[linkedPageSession.nextIndex];
    if (key !== expected) {
      linkedPageSession.nextIndex = key === linkedPageSession.keys[0] ? 1 : 0;
      showToast(t("heartLinkedRestarted"));
      return { sealed: false };
    }
    linkedPageSession.nextIndex += 1;
    if (linkedPageSession.nextIndex < linkedPageSession.keys.length) {
      showToast(formatText("heartLinkedProgress", { done: formatMetric(linkedPageSession.nextIndex), total: formatMetric(linkedPageSession.keys.length) }));
      return { sealed: false };
    }
    var page = getHeartPageUnit(linkedPageSession.pageNumber);
    var now = new Date().toISOString();
    page.lastConnectedAt = now;
    if (page.permanent) page.connectedReviews += 1;
    else {
      page.sealedAt = now;
      page.permanent = true;
    }
    linkedPageSession = null;
    saveState();
    renderHeartReadCounter();
    showToast(t("heartPageSealed"));
    return { sealed: true };
  }

  function logActivity() {
    var key = dateKey(new Date());
    state.activity[key] = (Number(state.activity[key]) || 0) + 1;
  }

  function currentStreak() {
    var cursor = new Date();
    if (!state.activity[dateKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
    var streak = 0;
    while (Number(state.activity[dateKey(cursor)]) > 0) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function renderActivityHeatmap() {
    var heatmap = document.getElementById("activity-heatmap");
    if (!heatmap) return;
    heatmap.textContent = "";
    var start = new Date();
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - 34);
    for (var index = 0; index < 35; index += 1) {
      var day = new Date(start);
      day.setDate(start.getDate() + index);
      var key = dateKey(day);
      var count = Number(state.activity[key]) || 0;
      var cell = document.createElement("span");
      cell.className = "activity-day" + (count ? " level-" + Math.min(count, 3) : "");
      cell.title = day.toLocaleDateString(state.language) + " — " + formatMetric(count) + " " + t("sessionsShort");
      cell.setAttribute("aria-label", cell.title);
      heatmap.appendChild(cell);
    }
  }

  function updateDailyOverview() {
    var today = Number(state.activity[dateKey(new Date())]) || 0;
    document.getElementById("today-actions").textContent = formatMetric(today);
    document.getElementById("today-goal").textContent = formatMetric(state.dailyGoal);
    document.getElementById("today-goal-progress").style.width = Math.min(100, Math.round(today / state.dailyGoal * 100)) + "%";
    document.getElementById("current-streak").textContent = formatMetric(currentStreak());
    document.getElementById("saved-count").textContent = formatMetric(state.savedVerses.length);
    document.getElementById("review-count").textContent = formatMetric(state.reviewQueue.length);
  }

  function getLifeEntries() {
    return state.lifePractice && Array.isArray(state.lifePractice.entries) ? state.lifePractice.entries : [];
  }

  function formatLifeDate(value) {
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";
    return date.toLocaleDateString(state.language === "ar" ? "ar-SA" : (state.language === "en" ? "en-GB" : "ru-RU"), { day: "numeric", month: "short" });
  }

  function getLifeReviewAt(choice) {
    var date = new Date();
    if (choice === "evening") date.setHours(20, 0, 0, 0);
    else date.setDate(date.getDate() + Math.max(1, Number(choice) || 1));
    return date.toISOString();
  }

  function lifePracticeStreak() {
    var days = {};
    getLifeEntries().forEach(function (entry) { if (entry.createdAt) days[dateKey(new Date(entry.createdAt))] = true; });
    var cursor = new Date();
    cursor.setHours(12, 0, 0, 0);
    if (!days[dateKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
    var streak = 0;
    while (days[dateKey(cursor)]) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function renderLifePracticeSummary() {
    var summary = document.getElementById("open-life-practice-today");
    if (!summary) return;
    summary.hidden = false;
    var entries = getLifeEntries().slice().sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); });
    var latest = entries[0];
    var status = document.getElementById("life-today-status");
    if (status) {
      if (!latest) status.textContent = t("lifeTodayEmpty");
      else if (latest.completed) status.textContent = t("lifeDoneStatus").replace("{date}", formatLifeDate(latest.reviewAt));
      else if (latest.reviewAt && new Date(latest.reviewAt).getTime() <= Date.now()) status.textContent = t("lifeDueNow");
      else status.textContent = latest.action || latest.reflection || t("lifeDraftStatus");
    }
    var streak = document.getElementById("life-streak-count");
    if (streak) streak.textContent = formatMetric(lifePracticeStreak());
  }

  function completeLifeEntry(entry) {
    if (!entry || entry.completed) return;
    entry.completed = true;
    entry.completedAt = new Date().toISOString();
    entry.updatedAt = entry.completedAt;
    saveState();
    renderLifeHistory();
    renderLifePracticeSummary();
    updateProgress();
    var activeButton = document.getElementById("life-complete");
    if (activeButton && entry.id === activeLifeEntryId) activeButton.hidden = true;
    showToast(t("lifeCompleted"));
  }

  function renderLifeHistory() {
    var list = document.getElementById("life-history-list");
    if (!list) return;
    list.textContent = "";
    var entries = getLifeEntries().slice().sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); }).slice(0, 6);
    if (!entries.length) {
      var empty = document.createElement("p");
      empty.className = "life-history-empty";
      empty.textContent = t("lifeHistoryEmpty");
      list.appendChild(empty);
      return;
    }
    entries.forEach(function (entry) {
      var item = document.createElement("article");
      item.className = "life-history-item";
      var meta = document.createElement("span");
      var reference = document.createElement("strong");
      reference.textContent = entry.reference || entry.verseKey || "—";
      var date = document.createElement("small");
      date.textContent = formatLifeDate(entry.createdAt);
      meta.appendChild(reference);
      meta.appendChild(date);
      var reflection = document.createElement("p");
      reflection.textContent = entry.reflection || entry.action || "—";
      var action = document.createElement("small");
      action.textContent = (entry.completed ? "✓ " : "→ ") + (entry.action || t("lifeDraftStatus"));
      var footer = document.createElement("div");
      var status = document.createElement("small");
      if (entry.completed) status.textContent = t("lifeDoneStatus").replace("{date}", formatLifeDate(entry.completedAt || entry.updatedAt || entry.reviewAt));
      else if (entry.reviewAt && new Date(entry.reviewAt).getTime() <= Date.now()) status.textContent = t("lifeDueNow");
      else status.textContent = t("lifePlannedFor").replace("{date}", formatLifeDate(entry.reviewAt));
      footer.appendChild(status);
      if (!entry.completed && entry.action) {
        var complete = document.createElement("button");
        complete.type = "button";
        complete.className = "text-button";
        complete.textContent = t("lifeComplete");
        complete.addEventListener("click", function () { completeLifeEntry(entry); });
        footer.appendChild(complete);
      }
      item.appendChild(meta);
      item.appendChild(reflection);
      item.appendChild(action);
      item.appendChild(footer);
      list.appendChild(item);
    });
  }

  function normalizeLifeText(value) {
    return String(value || "").toLocaleLowerCase().replace(/[“”„'’`«».,!?;:()\[\]{}—–\-]/g, " ").replace(/\s+/g, " ").trim();
  }

  function lifeTextHasAny(value, fragments) {
    var normalized = normalizeLifeText(value);
    return fragments.some(function (fragment) { return normalized.indexOf(fragment) >= 0; });
  }

  function lifeActionCopiesReflection(reflection, action) {
    var normalizedReflection = normalizeLifeText(reflection);
    var normalizedAction = normalizeLifeText(action);
    if (!normalizedReflection || !normalizedAction) return false;
    if (normalizedAction.indexOf(normalizedReflection) >= 0) return true;
    if (lifeTextHasAny(normalizedAction, ["шаг по этому размышлению", "шаг по этому наблюдению", "step from this reflection", "step from this thought", "خطوة من هذا التدبر", "خطوة من هذه الملاحظة"])) return true;
    var stopWords = ["этот", "эта", "это", "сегодня", "один", "буду", "сделаю", "потому", "который", "this", "that", "today", "will", "from", "with", "then", "هذه", "هذا", "اليوم", "سوف", "الذي", "التي", "على"];
    var reflectionTokens = normalizedReflection.split(" ").filter(function (word) { return word.length > 3 && stopWords.indexOf(word) < 0; });
    var actionTokens = normalizedAction.split(" ").filter(function (word) { return word.length > 3 && stopWords.indexOf(word) < 0; });
    if (reflectionTokens.length < 3 || actionTokens.length < 3) return false;
    var actionSet = {};
    actionTokens.forEach(function (word) { actionSet[word] = true; });
    var shared = reflectionTokens.filter(function (word) { return actionSet[word]; }).length;
    return shared / reflectionTokens.length >= 0.68;
  }

  function analyzeLifePlan(reflection, action) {
    var personalText = normalizeLifeText(reflection);
    var personal = /(^|\s)(я|мне|меня|мой|моя|моё|мои|хочу|нужно|буду|i|me|my|want|need|أنا|نفسي|لي|أريد|عليّ)(\s|$)/i.test(personalText) || personalText.indexOf("سأ") >= 0;
    var hasAction = normalizeLifeText(action).length >= 10;
    var vague = lifeTextHasAny(action, ["сделаю шаг", "что то сделаю", "постараюсь", "буду лучше", "take a step", "do something", "try to", "be better", "سأفعل خطوة", "سأحاول", "أكون أفضل"]);
    var concrete = hasAction && !vague && lifeTextHasAny(action, ["напиш", "позвон", "спрошу", "помог", "прочита", "свер", "скажу", "заверш", "выдел", "удел", "останов", "удерж", "поблагодар", "выслуш", "провер", "вернусь", "message", "call", "ask", "help", "read", "check", "say", "finish", "pause", "thank", "listen", "return", "write", "give", "contact", "avoid", "send", "continue", "complete", "أكتب", "أتصل", "أسأل", "أساعد", "أقرأ", "أتحقق", "أقول", "أنهي", "أنجز", "أتم", "أعطي", "أواصل", "أتوقف", "أشكر", "أستمع", "أتواصل", "أراجع", "أخصص", "أعود", "لا أرد", "لا أرسل", "لا أنقل"]);
    var cue = hasAction && lifeTextHasAny(action, ["сегодня", "после", "когда", "перед", "при следующ", "до конца", "в ближай", "через", "today", "after", "when", "before", "next ", "within", "اليوم", "بعد", "عندما", "عند", "إذا", "قبل", "القادم"]);
    return {
      reflection: normalizeLifeText(reflection),
      personal: personal,
      hasAction: hasAction,
      distinct: hasAction ? !lifeActionCopiesReflection(reflection, action) : null,
      concrete: hasAction ? concrete : null,
      cue: hasAction ? cue : null
    };
  }

  function getLifePlanCopy() {
    var copies = {
      ru: {
        cues: {
          "next-prayer": { lead: "После ближайшей молитвы", condition: "закончится ближайшая молитва" },
          "next-conversation": { lead: "При следующем разговоре", condition: "начнётся следующий разговор" },
          "difficult-moment": { lead: "В ближайший трудный момент", condition: "я замечу привычную резкую реакцию" },
          "before-evening": { lead: "До конца сегодняшнего дня", condition: "наступит вечер" }
        },
        actions: {
          benefit: { self: "завершу один небольшой полезный шаг, который откладываю", family: "спрошу одного близкого, какая небольшая помощь нужна сегодня, и сразу выполню её", work: "завершу одну небольшую задачу, которая облегчит работу другому человеку", community: "свяжусь с одним человеком и предложу конкретную посильную помощь" },
          restraint: { self: "остановлюсь на 60 секунд и не последую первой автоматической реакции", family: "не отвечу резко: сначала сделаю паузу и скажу одну спокойную фразу", work: "не отправлю поспешный ответ: перечитаю его и уберу лишнюю резкость", community: "не стану передавать непроверенные слова, пока не сверю источник" },
          continue: { self: "вернусь к уже начатому полезному делу и уделю ему 10 минут", family: "уделю близкому 10 минут без телефона и внимательно выслушаю", work: "продолжу важную задачу ровно 10 минут, начав со следующего видимого шага", community: "доведу до конца один небольшой шаг, который обещал другому человеку" }
        },
        themes: { gratitude: "назову одну конкретную милость и поблагодарю человека, через которого пришло это благо", patience: "сделаю паузу на 60 секунд и выберу спокойный ответ вместо первой реакции", speech: "перечитаю ближайший ответ перед отправкой и уберу из него всё резкое или лишнее", help: "спрошу одного человека, какая небольшая помощь нужна сегодня, и выполню один посильный шаг", family: "уделю одному близкому 10 минут внимания без телефона", knowledge: "сверю один возникший вопрос с проверенным источником и запишу подтверждённый вывод", prayer: "вернусь к выбранному аяту после молитвы и запишу одну честную просьбу к Аллаху" },
        shortTitle: "Малый шаг", shortReason: "Учитывает выбранную сферу и остаётся выполнимым за 5–15 минут.",
        cueTitle: "План «если → тогда»", cueReason: "Привязывает поступок к заметному моменту, чтобы не полагаться только на память.",
        studyTitle: "Сначала проверить смысл", studyReason: "Если личный вывод ещё неясен, лучше проверить контекст, чем принимать AI-догадку.",
        contextTitle: "Прочитать контекст", contextReason: "Помогает увидеть, куда ведёт мысль, прежде чем выбирать действие.",
        sourceTitle: "Сверить один источник", sourceReason: "Сохраняет границу между вашим размышлением и подтверждённым толкованием.",
        returnTitle: "Вернуться с вопросом", returnReason: "Даёт личному выводу созреть без искусственного ответа.",
        studyAction: "Сегодня я прочитаю {reference} вместе с соседними аятами и запишу, к чему ведёт общий смысл.",
        sourceAction: "Сегодня я сверю {reference} с одним проверенным тафсиром и запишу один подтверждённый вывод своими словами.",
        returnAction: "Сегодня вечером я вернусь к {reference} и отвечу одной фразой: что этот аят просит изменить именно во мне?"
      },
      en: {
        cues: {
          "next-prayer": { lead: "After the next prayer", condition: "the next prayer is complete" },
          "next-conversation": { lead: "In the next conversation", condition: "the next conversation begins" },
          "difficult-moment": { lead: "At the next difficult moment", condition: "I notice my usual sharp reaction" },
          "before-evening": { lead: "Before the end of today", condition: "evening arrives" }
        },
        actions: {
          benefit: { self: "finish one small useful step I have been postponing", family: "ask one family member what small help they need today and do it", work: "finish one small task that makes another person's work easier", community: "contact one person and offer one specific, manageable kind of help" },
          restraint: { self: "pause for 60 seconds and not follow my first automatic reaction", family: "avoid a sharp reply, pause, and say one calm sentence first", work: "not send a rushed response, reread it, and remove unnecessary sharpness", community: "not pass on an unverified claim until I check its source" },
          continue: { self: "return to a useful task already in progress and give it 10 minutes", family: "give one family member 10 phone-free minutes and listen carefully", work: "continue one important task for exactly 10 minutes, beginning with the next visible step", community: "finish one small step I promised to another person" }
        },
        themes: { gratitude: "name one specific blessing and thank a person through whom that good reached me", patience: "pause for 60 seconds and choose a calm response instead of my first reaction", speech: "reread my next message before sending and remove anything sharp or unnecessary", help: "ask one person what small help they need today and complete one manageable step", family: "give one family member 10 minutes of attention without my phone", knowledge: "check one question against a verified source and record only the supported conclusion", prayer: "return to the selected verse after prayer and write one honest request to Allah" },
        shortTitle: "Small step", shortReason: "Fits the chosen setting and stays achievable within 5–15 minutes.",
        cueTitle: "If → then plan", cueReason: "Links the behaviour to a visible cue instead of relying on memory alone.",
        studyTitle: "Verify the meaning first", studyReason: "When the personal conclusion is unclear, checking context is better than accepting an AI guess.",
        contextTitle: "Read the context", contextReason: "Shows where the passage is going before you choose an action.",
        sourceTitle: "Check one source", sourceReason: "Keeps your reflection distinct from verified interpretation.",
        returnTitle: "Return with one question", returnReason: "Allows a personal insight to mature without an artificial answer.",
        studyAction: "Today I will read {reference} with the surrounding verses and note where the passage's overall meaning leads.",
        sourceAction: "Today I will check {reference} against one verified tafsir and write one supported conclusion in my own words.",
        returnAction: "This evening I will return to {reference} and answer in one sentence: what does this verse ask me personally to change?"
      },
      ar: {
        cues: {
          "next-prayer": { lead: "بعد الصلاة القادمة", condition: "انتهت الصلاة القادمة" },
          "next-conversation": { lead: "في الحديث القادم", condition: "بدأ الحديث القادم" },
          "difficult-moment": { lead: "عند أقرب موقف صعب", condition: "لاحظت رد فعلي الحاد المعتاد" },
          "before-evening": { lead: "قبل نهاية اليوم", condition: "جاء المساء" }
        },
        actions: {
          benefit: { self: "أنجز خطوة نافعة صغيرة كنت أؤجلها", family: "أسأل شخصًا من أسرتي عن مساعدة صغيرة يحتاجها اليوم ثم أقوم بها", work: "أنهي مهمة صغيرة تجعل عمل شخص آخر أسهل", community: "أتواصل مع شخص واحد وأعرض عليه مساعدة محددة أقدر عليها" },
          restraint: { self: "أتوقف ستين ثانية ولا أتبع أول رد فعل تلقائي", family: "لا أرد بحدة، بل أتوقف أولًا وأقول جملة هادئة", work: "لا أرسل ردًا متعجلًا، بل أراجعه وأحذف منه ما لا يلزم من الشدة", community: "لا أنقل كلامًا غير متحقق منه حتى أراجع مصدره" },
          continue: { self: "أعود إلى عمل نافع بدأته وأخصص له عشر دقائق", family: "أعطي شخصًا من أسرتي عشر دقائق من الانتباه بلا هاتف", work: "أواصل مهمة مهمة عشر دقائق بدءًا من الخطوة الواضحة التالية", community: "أتم خطوة صغيرة وعدت بها شخصًا آخر" }
        },
        themes: { gratitude: "أذكر نعمة محددة وأشكر شخصًا وصلني الخير عن طريقه", patience: "أتوقف ستين ثانية وأختار ردًا هادئًا بدل أول رد فعل", speech: "أراجع رسالتي القادمة قبل إرسالها وأحذف منها كل حدة أو زيادة", help: "أسأل شخصًا واحدًا عن مساعدة صغيرة يحتاجها اليوم ثم أنجز خطوة أقدر عليها", family: "أعطي شخصًا من أسرتي عشر دقائق من الانتباه بلا هاتف", knowledge: "أراجع سؤالًا واحدًا في مصدر موثوق ولا أكتب إلا النتيجة المدعومة", prayer: "أعود إلى الآية المختارة بعد الصلاة وأكتب دعاءً صادقًا واحدًا" },
        shortTitle: "خطوة صغيرة", shortReason: "تراعي المجال المختار ويمكن إنجازها خلال خمس إلى خمس عشرة دقيقة.",
        cueTitle: "خطة «إذا ← فسوف»", cueReason: "تربط العمل بإشارة واضحة بدل الاعتماد على التذكر وحده.",
        studyTitle: "تحقق من المعنى أولًا", studyReason: "إذا لم تتضح النتيجة الشخصية فمراجعة السياق خير من قبول تخمين آلي.",
        contextTitle: "اقرأ السياق", contextReason: "يساعدك على رؤية اتجاه الكلام قبل اختيار العمل.",
        sourceTitle: "راجع مصدرًا واحدًا", sourceReason: "يفصل بين تدبرك الشخصي والتفسير الموثق.",
        returnTitle: "عُد بسؤال واحد", returnReason: "يمنح النتيجة الشخصية وقتًا بلا جواب مصطنع.",
        studyAction: "سأقرأ اليوم {reference} مع الآيات القريبة وأسجل إلى أين يقود المعنى العام للسياق.",
        sourceAction: "سأراجع اليوم {reference} في تفسير موثوق واحد وأكتب نتيجة مدعومة بكلماتي.",
        returnAction: "سأعود هذا المساء إلى {reference} وأجيب بجملة واحدة: ما الذي تطلب هذه الآية أن أغيّره في نفسي؟"
      }
    };
    return copies[state.language] || copies.ru;
  }

  function detectLifeTheme(reflection) {
    var source = reflection + " " + (currentVerse ? localized(currentVerse.meaning) : "");
    var themes = [
      { name: "gratitude", words: ["благодар", "милост", "дар", "grateful", "gratitude", "blessing", "شكر", "نعمة", "حمد"] },
      { name: "patience", words: ["терпен", "спокой", "гнев", "patient", "patience", "calm", "anger", "صبر", "غضب", "هدوء"] },
      { name: "speech", words: ["говор", "ответ", "сообщени", "речь", "speech", "reply", "message", "قول", "كلام", "رد"] },
      { name: "help", words: ["помо", "польз", "поддерж", "help", "benefit", "support", "نفع", "مساعدة", "عون"] },
      { name: "family", words: ["семь", "родител", "близк", "family", "parent", "relative", "أسرة", "والد", "أهل"] },
      { name: "knowledge", words: ["знан", "понять", "изуч", "тафсир", "knowledge", "understand", "study", "tafsir", "علم", "فهم", "تفسير"] },
      { name: "prayer", words: ["молит", "намаз", "дуа", "prayer", "salah", "dua", "صلاة", "دعاء"] }
    ];
    var found = themes.find(function (theme) { return lifeTextHasAny(source, theme.words); });
    return found ? found.name : "";
  }

  function makeLifeSentence(copy, cue, phrase, conditional) {
    if (state.language === "ar") return conditional ? "إذا " + cue.condition + " فسوف " + phrase + "." : cue.lead + " سوف " + phrase + ".";
    if (state.language === "en") return conditional ? "If " + cue.condition + ", I will " + phrase + "." : cue.lead + ", I will " + phrase + ".";
    return conditional ? "Если " + cue.condition + ", я " + phrase + "." : cue.lead + " я " + phrase + ".";
  }

  function getCurrentFawaidEntry() {
    var entry = fawaidData.entries && fawaidData.entries[getVerseKey(currentSurah, currentVerse)];
    return entry && Array.isArray(entry.sources) && entry.sources.length ? entry : null;
  }

  function getSelectedFawaidFinding() {
    var entry = getCurrentFawaidEntry();
    if (!entry || !selectedFawaidId) return null;
    for (var sourceIndex = 0; sourceIndex < entry.sources.length; sourceIndex += 1) {
      var source = entry.sources[sourceIndex];
      for (var findingIndex = 0; findingIndex < source.findings.length; findingIndex += 1) {
        if (source.findings[findingIndex].id === selectedFawaidId) return { source: source, finding: source.findings[findingIndex] };
      }
    }
    return null;
  }

  function renderLifeFawaid() {
    var entry = getCurrentFawaidEntry();
    var content = document.getElementById("life-fawaid-content");
    var note = document.getElementById("life-fawaid-note");
    if (!content || !note) return;
    content.textContent = "";
    content.hidden = !entry;
    if (!entry) {
      note.textContent = t("lifeFawaidUnavailableText");
      return;
    }
    note.textContent = t("lifeFawaidAvailableText");
    entry.sources.forEach(function (source) {
      var card = document.createElement("article");
      var header = document.createElement("header");
      var identity = document.createElement("div");
      var scholar = document.createElement("strong");
      var work = document.createElement("small");
      var scope = document.createElement("span");
      var list = document.createElement("div");
      scholar.textContent = localized(source.scholar);
      work.textContent = localized(source.work);
      scope.textContent = formatText("lifeFawaidScope", { scope: source.scope });
      identity.appendChild(scholar);
      identity.appendChild(work);
      header.appendChild(identity);
      header.appendChild(scope);
      card.appendChild(header);
      source.findings.forEach(function (finding) {
        var item = document.createElement("section");
        var benefit = document.createElement("p");
        var actions = document.createElement("div");
        var link = document.createElement("a");
        var use = document.createElement("button");
        benefit.textContent = localized(finding.benefit);
        link.className = "text-button";
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = t("lifeFawaidSource");
        use.type = "button";
        use.className = "tertiary-button";
        use.setAttribute("data-fawaid-id", finding.id);
        use.setAttribute("aria-pressed", String(finding.id === selectedFawaidId));
        use.textContent = finding.id === selectedFawaidId ? t("lifeFawaidSelected") : t("lifeFawaidUse");
        use.addEventListener("click", function () {
          selectedFawaidId = finding.id;
          renderLifeFawaid();
          resetLifeAiReview();
          document.getElementById("life-ai-suggestion").textContent = t("lifeAiSuggestionIdle");
        });
        actions.appendChild(link);
        actions.appendChild(use);
        item.appendChild(benefit);
        item.appendChild(actions);
        list.appendChild(item);
      });
      card.appendChild(list);
      content.appendChild(card);
    });
  }

  function buildLifePlans(analysis, reflection) {
    var copy = getLifePlanCopy();
    var reference = currentSurah && currentVerse ? currentSurah.names[state.language] + " · " + getVerseKey(currentSurah, currentVerse) : "—";
    var studyPlans = [
      { title: copy.contextTitle, reason: copy.contextReason, action: copy.studyAction.replace("{reference}", reference) },
      { title: copy.sourceTitle, reason: copy.sourceReason, action: copy.sourceAction.replace("{reference}", reference) },
      { title: copy.returnTitle, reason: copy.returnReason, action: copy.returnAction.replace("{reference}", reference) }
    ];
    var selectedFinding = getSelectedFawaidFinding();
    if (!selectedFinding || !analysis.reflection || !analysis.personal) return studyPlans;
    var trigger = document.getElementById("life-trigger").value || "next-prayer";
    var cue = copy.cues[trigger] || copy.cues["next-prayer"];
    var primaryAction = localized(selectedFinding.finding.actions[0]);
    var alternativeAction = localized(selectedFinding.finding.actions[1]);
    return [
      { title: t("lifeAiVerifiedTitle"), reason: t("lifeAiVerifiedReason"), action: makeLifeSentence(copy, cue, primaryAction, false) },
      { title: copy.cueTitle, reason: copy.cueReason, action: makeLifeSentence(copy, cue, alternativeAction, true) },
      { title: copy.studyTitle, reason: copy.studyReason, action: copy.sourceAction.replace("{reference}", reference) }
    ];
  }

  function renderLifeAiChecks(analysis) {
    ["personal", "distinct", "concrete", "cue"].forEach(function (name) {
      var node = document.querySelector('[data-life-check="' + name + '"]');
      if (!node) return;
      var value = analysis[name];
      node.setAttribute("data-state", value === null ? "idle" : (value ? "pass" : "needs-work"));
      var icon = node.querySelector("i");
      if (icon) icon.textContent = value === null ? "○" : (value ? "✓" : "!");
    });
  }

  function renderLifeAiOptions(plans) {
    var container = document.getElementById("life-ai-options");
    container.textContent = "";
    var heading = document.createElement("p");
    heading.className = "life-ai-options-title";
    heading.textContent = t("lifeAiChoicesTitle");
    container.appendChild(heading);
    plans.forEach(function (plan, index) {
      var card = document.createElement("article");
      var head = document.createElement("div");
      var number = document.createElement("span");
      var title = document.createElement("strong");
      var reason = document.createElement("small");
      var action = document.createElement("p");
      var button = document.createElement("button");
      number.textContent = String(index + 1).padStart(2, "0");
      title.textContent = plan.title;
      reason.textContent = plan.reason;
      action.textContent = plan.action;
      button.type = "button";
      button.className = "tertiary-button";
      button.textContent = t("lifeAiUsePlan");
      button.addEventListener("click", function () {
        document.getElementById("life-action").value = plan.action.slice(0, 280);
        container.querySelectorAll("article").forEach(function (item) { item.classList.toggle("is-selected", item === card); });
        document.getElementById("life-ai-suggestion").textContent = t("lifeAiPlanApplied");
        renderLifeAiChecks(analyzeLifePlan(document.getElementById("life-reflection").value.trim(), plan.action));
        document.getElementById("life-action").focus();
      });
      head.appendChild(number);
      head.appendChild(title);
      card.appendChild(head);
      card.appendChild(reason);
      card.appendChild(action);
      card.appendChild(button);
      container.appendChild(card);
    });
    container.hidden = false;
  }

  function resetLifeAiReview() {
    var output = document.getElementById("life-ai-suggestion");
    var options = document.getElementById("life-ai-options");
    if (output) {
      output.textContent = t("lifeAiSuggestionIdle");
      output.classList.remove("is-ready");
    }
    if (options) {
      options.textContent = "";
      options.hidden = true;
    }
    renderLifeAiChecks({ personal: null, distinct: null, concrete: null, cue: null });
  }

  function openLifePracticeDialog() {
    if (!currentSurah || !currentVerse) return;
    var dialog = document.getElementById("life-practice-dialog");
    if (!dialog) return;
    var key = getVerseKey(currentSurah, currentVerse);
    var today = dateKey(new Date());
    var existing = getLifeEntries().slice().reverse().find(function (entry) {
      return entry.verseKey === key && entry.createdAt && dateKey(new Date(entry.createdAt)) === today;
    });
    activeLifeEntryId = existing ? existing.id : "";
    document.getElementById("life-verse-reference").textContent = currentSurah.names[state.language] + " · " + key;
    document.getElementById("life-verse-arabic").textContent = currentVerse.text;
    document.getElementById("life-verse-meaning").textContent = currentVerse.meaning[state.language];
    document.getElementById("life-reflection").value = existing ? existing.reflection || "" : "";
    document.getElementById("life-action").value = existing ? existing.action || "" : "";
    document.getElementById("life-trigger").value = existing && existing.trigger ? existing.trigger : "next-prayer";
    document.getElementById("life-complete").hidden = !existing || existing.completed || !existing.action;
    selectedFawaidId = existing && existing.fawaidId ? existing.fawaidId : "";
    renderLifeFawaid();
    resetLifeAiReview();
    renderLifeHistory();
    dialog.hidden = false;
    if (!dialog.open) dialog.showModal();
  }

  function saveLifePractice(completed) {
    if (!currentSurah || !currentVerse) return false;
    var reflection = document.getElementById("life-reflection").value.trim();
    var action = document.getElementById("life-action").value.trim();
    if (!reflection && !action) {
      showToast(t("lifeNeedWords"));
      return false;
    }
    if (completed && !action) {
      showToast(t("lifeNeedAction"));
      return false;
    }
    var entries = getLifeEntries();
    var entry = activeLifeEntryId ? entries.find(function (item) { return item.id === activeLifeEntryId; }) : null;
    var now = new Date().toISOString();
    if (!entry) {
      entry = { id: "life-" + Date.now(), createdAt: now };
      entries.push(entry);
      activeLifeEntryId = entry.id;
    }
    entry.verseKey = getVerseKey(currentSurah, currentVerse);
    entry.reference = currentSurah.names[state.language] + " · " + entry.verseKey;
    entry.reflection = reflection;
    entry.action = action;
    var selectedFinding = getSelectedFawaidFinding();
    entry.fawaidId = selectedFinding ? selectedFinding.finding.id : "";
    entry.fawaidScholar = selectedFinding ? localized(selectedFinding.source.scholar) : "";
    entry.fawaidBenefit = selectedFinding ? localized(selectedFinding.finding.benefit) : "";
    entry.fawaidSourceUrl = selectedFinding ? selectedFinding.source.url : "";
    entry.trigger = document.getElementById("life-trigger").value;
    entry.reviewAt = getLifeReviewAt(document.getElementById("life-review-delay").value);
    entry.updatedAt = now;
    if (completed) entry.completed = true;
    saveState();
    renderLifeHistory();
    renderLifePracticeSummary();
    updateProgress();
    showToast(t(completed ? "lifeCompleted" : "lifeSaved"));
    return true;
  }

  function suggestLifeAction() {
    var reflection = document.getElementById("life-reflection").value.trim();
    var action = document.getElementById("life-action").value.trim();
    var analysis = analyzeLifePlan(reflection, action);
    var output = document.getElementById("life-ai-suggestion");
    if (getCurrentFawaidEntry() && !getSelectedFawaidFinding()) {
      output.textContent = t("lifeFawaidChooseFirst");
      output.classList.add("is-ready");
      renderLifeAiChecks(analysis);
      var options = document.getElementById("life-ai-options");
      options.textContent = "";
      options.hidden = true;
      return;
    }
    if (!analysis.reflection) output.textContent = t("lifeAiNeedReflection");
    else if (!analysis.personal) output.textContent = t("lifeAiObservation");
    else if (analysis.distinct === false) output.textContent = t("lifeAiDuplicate");
    else if (!analysis.hasAction || !analysis.concrete || !analysis.cue) output.textContent = t("lifeAiImprove");
    else output.textContent = t("lifeAiReady");
    output.classList.add("is-ready");
    renderLifeAiChecks(analysis);
    renderLifeAiOptions(buildLifePlans(analysis, reflection));
  }

  function renderMemoryVerse() {
    if (!currentSurah || !currentVerse) return;
    if (memoryPracticeContext && memoryPracticeContext.key !== getVerseKey(currentSurah, currentVerse)) memoryPracticeContext = null;
    memorySeriesActive = false;
    stopMemoryRecognition(true);
    var words = splitVerseWords(currentVerse.text);
    var promptCount = words.length > 3 ? 2 : 1;
    var prompt = words.slice(0, promptCount);
    var answer = words.slice(promptCount);
    if (!answer.length) {
      prompt = [];
      answer = words;
      promptCount = 0;
    }
    memoryPromptCount = promptCount;
    memoryRevealedCount = 0;
    memoryHintsThisAttempt = 0;
    memoryHadError = false;
    memoryLastTranscript = "";
    memoryFullVerseMatched = false;
    document.getElementById("memory-reference").textContent = currentSurah.names[state.language] + " · " + getVerseKey(currentSurah, currentVerse);
    document.getElementById("memory-prompt").textContent = prompt.join(" ");
    var answerBox = document.getElementById("memory-answer");
    answerBox.textContent = "";
    answer.forEach(function (word, index) {
      var span = document.createElement("span");
      span.className = "hidden-word";
      span.setAttribute("data-answer-word", "");
      span.setAttribute("data-answer-index", String(index));
      span.textContent = word;
      answerBox.appendChild(span);
    });
    memorySessionCounted = false;
    document.getElementById("reveal-word").disabled = !answer.length;
    document.getElementById("memory-transcript-text").textContent = t("memoryWaiting");
    updateMemoryProgress();
    setMemoryStatus("memoryMicReady", "memoryMicReadySub", false);
    setMemorySeriesPhase("ready", "memorySeriesReady", "memorySeriesReadySub");
    setMemoryButton(false);
    checkMemoryRecognitionSupport();
    renderHeartMushaf();
    updateMemoryCounterDisplay();
  }

  function setStudioMode(active) {
    var shouldActivate = Boolean(active);
    document.body.classList.toggle("reader-studio", shouldActivate);
    document.getElementById("open-studio").classList.toggle("is-active", shouldActivate);
    renderCurrentMeaning();
    if (!shouldActivate) {
      document.querySelectorAll("[data-reader-mode]").forEach(function (item) {
        item.classList.toggle("is-active", item.getAttribute("data-reader-mode") === "read");
      });
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function selectSidePanelTab(name) {
    var selected = name === "word" ? "word" : "ai";
    document.querySelectorAll("[data-side-tab]").forEach(function (button) {
      var active = button.getAttribute("data-side-tab") === selected;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-side-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-side-panel") !== selected;
    });
  }

  function getCurrentReference() {
    return currentSurah && currentVerse ? currentSurah.names[state.language] + " · " + getVerseKey(currentSurah, currentVerse) : "";
  }

  function setAiMessage(message) {
    var target = document.getElementById("ai-message");
    if (!target) return;
    target.removeAttribute("data-i18n");
    target.textContent = message;
  }

  function updateAiMentor(kind) {
    if (!currentSurah || !currentVerse || !currentWords.length) return;
    var reference = getCurrentReference();
    var word = currentWords[selectedWordIndex] || currentWords[0];
    var message;
    if (kind === "memory") {
      message = formatText("aiMemoryAdvice", {
        reference: reference,
        words: formatMetric(currentWords.length),
        parts: formatMetric(Math.max(2, Math.min(4, Math.ceil(currentWords.length / 4))))
      });
    } else if (kind === "word") {
      message = formatText("aiWordAdvice", {
        word: word.ar,
        meaning: word.meaning[state.language],
        root: word.root,
        grammar: word.grammar[state.language]
      });
    } else if (kind === "review") {
      message = lastAlignment ? formatText("aiReviewAdvice", {
        matched: formatMetric(lastAlignment.matched),
        review: formatMetric(lastAlignment.warnings + lastAlignment.errors),
        extra: formatMetric(lastAlignment.extras)
      }) : formatText("aiReviewIdle", { reference: reference });
    } else if (kind === "reading" && lastAlignment) {
      message = lastAlignment.complete ? formatText("aiCompleteAdvice", { reference: reference }) : formatText("aiReviewAdvice", {
        matched: formatMetric(lastAlignment.matched),
        review: formatMetric(lastAlignment.warnings + lastAlignment.errors),
        extra: formatMetric(lastAlignment.extras)
      });
    } else {
      message = formatText("aiVerseReady", { reference: reference });
    }
    setAiMessage(message);
  }

  function getSelectedReciter() {
    return reciters.find(function (reciter) { return reciter.id === state.selectedReciter; }) || reciters[0];
  }

  function populateReciterSelect() {
    var select = document.getElementById("reciter-select");
    if (!select) return;
    select.textContent = "";
    reciters.forEach(function (reciter) {
      var option = document.createElement("option");
      option.value = reciter.id;
      option.textContent = reciter.names[state.language] || reciter.names.en;
      select.appendChild(option);
    });
    updateReciterIdentity();
  }

  function updateReciterIdentity() {
    var selected = getSelectedReciter();
    var select = document.getElementById("reciter-select");
    if (select && select.value !== selected.id) select.value = selected.id;
    var name = document.getElementById("audio-reciter-name");
    if (name) name.textContent = selected.names[state.language] || selected.names.en;
  }

  function padAudioIndex(value) {
    return String(value).padStart(3, "0");
  }

  function getCurrentAudioKey() {
    if (!currentSurah || !currentVerse) return "";
    var reciter = getSelectedReciter();
    return reciter.id + ":" + currentSurah.id + (reciter.provider === "chapter" ? ":surah" : ":" + currentVerse.ayah);
  }

  function getCurrentVerseAudioUrl() {
    if (!currentSurah || !currentVerse) return "";
    var reciter = getSelectedReciter();
    if (reciter.provider === "chapter") {
      if (reciter.availableSurahs && reciter.availableSurahs.indexOf(currentSurah.id) < 0) return "";
      return reciter.chapterBase + padAudioIndex(currentSurah.id) + ".mp3";
    }
    return "https://everyayah.com/data/" + reciter.path + "/" + padAudioIndex(currentSurah.id) + padAudioIndex(currentVerse.ayah) + ".mp3";
  }

  function revokeActiveAudioObjectUrl() {
    if (!activeAudioObjectUrl) return;
    window.URL.revokeObjectURL(activeAudioObjectUrl);
    activeAudioObjectUrl = "";
  }

  function resolveVerseAudioSource(url) {
    if (!window.caches || !url) return Promise.resolve(url);
    return window.caches.open(audioCacheName).then(function (cache) {
      return cache.match(url);
    }).then(function (response) {
      if (!response) return url;
      return response.blob().then(function (blob) {
        revokeActiveAudioObjectUrl();
        activeAudioObjectUrl = window.URL.createObjectURL(blob);
        return activeAudioObjectUrl;
      });
    }).catch(function () { return url; });
  }

  function updateAudioDownloadUi(statusKey, values, progress) {
    var status = document.getElementById("audio-download-status");
    var meter = document.getElementById("audio-download-progress");
    var button = document.getElementById("download-surah-audio");
    if (!status || !meter || !button) return;
    status.textContent = statusKey ? formatText(statusKey, values || {}) : t("offlineSurahText");
    meter.hidden = !Number.isFinite(progress);
    if (Number.isFinite(progress)) meter.value = Math.max(0, Math.min(100, progress));
    button.querySelector("span").textContent = t(audioDownloadController ? "cancelDownload" : "downloadSurah");
    button.classList.toggle("is-active", Boolean(audioDownloadController));
  }

  function downloadCurrentSurahAudio() {
    if (audioDownloadController) {
      audioDownloadController.abort();
      audioDownloadController = null;
      updateAudioDownloadUi();
      return;
    }
    if (!window.caches || !window.fetch || !window.AbortController || !currentSurah || !currentSurah.verses.length) {
      showToast(t("audioDownloadUnavailable"));
      return;
    }
    var controller = new window.AbortController();
    audioDownloadController = controller;
    var reciter = getSelectedReciter();
    var surah = currentSurah;
    var urls = reciter.provider === "chapter" ? [getCurrentVerseAudioUrl()] : surah.verses.map(function (verse) {
      return "https://everyayah.com/data/" + reciter.path + "/" + padAudioIndex(surah.id) + padAudioIndex(verse.ayah) + ".mp3";
    });
    if (!urls[0]) {
      audioDownloadController = null;
      updateAudioDownloadUi("audioUnavailable", {}, Number.NaN);
      showToast(t("audioUnavailable"));
      return;
    }
    var done = 0;
    updateAudioDownloadUi("audioDownloadProgress", { done: done, total: urls.length }, 0);
    window.caches.open(audioCacheName).then(function (cache) {
      return urls.reduce(function (chain, url) {
        return chain.then(function () {
          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
          return cache.match(url).then(function (cached) {
            if (cached) return cached;
            return window.fetch(url, { signal: controller.signal, mode: "cors" }).then(function (response) {
              if (!response.ok) throw new Error("audio-download-failed");
              return cache.put(url, response.clone()).then(function () { return response; });
            });
          }).then(function () {
            done += 1;
            updateAudioDownloadUi("audioDownloadProgress", { done: done, total: urls.length }, Math.round((done / urls.length) * 100));
          });
        });
      }, Promise.resolve());
    }).then(function () {
      if (audioDownloadController !== controller) return;
      audioDownloadController = null;
      updateAudioDownloadUi("audioDownloadReady", {}, 100);
      showToast(t("audioDownloadReady"));
    }).catch(function (error) {
      if (audioDownloadController === controller) audioDownloadController = null;
      if (error && error.name === "AbortError") updateAudioDownloadUi();
      else {
        updateAudioDownloadUi("audioDownloadError", {}, Number.NaN);
        showToast(t("audioDownloadError"));
      }
    });
  }

  function formatAudioTime(seconds) {
    var safeSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
    var minutes = Math.floor(safeSeconds / 60);
    return minutes + ":" + String(safeSeconds % 60).padStart(2, "0");
  }

  function setAudioMeta(key) {
    var meta = document.getElementById("audio-reciter-meta");
    if (!meta) return;
    var selected = getSelectedReciter();
    meta.textContent = t(key || (selected.provider === "chapter" ? "chapterRecitationSource" : "recitationSource"));
  }

  function updateAudioTimeline() {
    var audio = document.getElementById("verse-audio");
    var seek = document.getElementById("audio-seek");
    var current = document.getElementById("audio-current-time");
    var duration = document.getElementById("audio-duration");
    if (!audio || !seek || !current || !duration) return;
    var hasDuration = Number.isFinite(audio.duration) && audio.duration > 0;
    seek.disabled = !hasDuration;
    seek.value = hasDuration ? String(Math.round((audio.currentTime / audio.duration) * 1000)) : "0";
    current.textContent = formatAudioTime(audio.currentTime);
    duration.textContent = formatAudioTime(audio.duration);
  }

  function updateAudioControls() {
    var toolbarButton = document.getElementById("play-demo-audio");
    var mushafAudioButton = document.getElementById("mushaf-play-audio");
    var playButton = document.getElementById("audio-play-toggle");
    var stopButton = document.getElementById("audio-stop");
    var repeatButton = document.getElementById("audio-repeat");
    var nextButton = document.getElementById("audio-next");
    var panel = document.getElementById("audio-panel");
    if (!toolbarButton || !playButton || !stopButton || !panel) return;
    toolbarButton.classList.toggle("is-active", verseAudioPlaying && !verseAudioPaused);
    toolbarButton.setAttribute("aria-pressed", String(verseAudioPlaying && !verseAudioPaused));
    if (mushafAudioButton) {
      mushafAudioButton.classList.toggle("is-active", verseAudioPlaying && !verseAudioPaused);
      mushafAudioButton.setAttribute("aria-pressed", String(verseAudioPlaying && !verseAudioPaused));
    }
    playButton.querySelector("span").textContent = t(!verseAudioPlaying ? "playAudio" : (verseAudioPaused ? "resumeAudio" : "pauseAudio"));
    playButton.classList.toggle("is-paused", verseAudioPaused);
    stopButton.disabled = !verseAudioPlaying;
    panel.classList.toggle("is-playing", verseAudioPlaying && !verseAudioPaused);
    var mushafPanel = document.querySelector(".mushaf-panel");
    if (mushafPanel) mushafPanel.classList.toggle("is-audio-playing", verseAudioPlaying && !verseAudioPaused);
    if (repeatButton) {
      repeatButton.classList.toggle("is-active", state.audioRepeat);
      repeatButton.setAttribute("aria-pressed", String(state.audioRepeat));
    }
    if (nextButton) {
      nextButton.disabled = getSelectedReciter().provider === "chapter";
      nextButton.title = getSelectedReciter().provider === "chapter" ? t("chapterAudioScope") : "";
    }
    updateReciterIdentity();
    updateAudioTimeline();
  }

  function stopVerseAudio(showNotice) {
    var audio = document.getElementById("verse-audio");
    audioSourceRequest += 1;
    verseAudioPlaying = false;
    verseAudioPaused = false;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.removeAttribute("data-verse-key");
      audio.load();
    }
    revokeActiveAudioObjectUrl();
    setAudioMeta();
    updateAudioControls();
    if (showNotice) showToast(t("audioStopped"));
  }

  function handleVerseAudioError() {
    var audio = document.getElementById("verse-audio");
    if (!audio || !audio.getAttribute("src")) return;
    verseAudioPlaying = false;
    verseAudioPaused = false;
    setAudioMeta("audioUnavailable");
    updateAudioControls();
    showToast(t("audioUnavailable"));
  }

  function handleVerseAudioEnded() {
    var audio = document.getElementById("verse-audio");
    if (!verseAudioPlaying) return;
    if (state.audioRepeat && audio) {
      audio.currentTime = 0;
      audio.play().catch(handleVerseAudioError);
      return;
    }
    verseAudioPlaying = false;
    verseAudioPaused = false;
    updateAudioControls();
    if (getSelectedReciter().provider === "chapter") return;
    if (state.autoAdvance && goToNextVerse("audio")) window.setTimeout(playVerseAudio, 180);
  }

  function playVerseAudio() {
    var audio = document.getElementById("verse-audio");
    if (!audio || !currentVerse || !audio.canPlayType("audio/mpeg")) {
      showToast(t("audioUnavailable"));
      return;
    }
    document.getElementById("audio-panel").hidden = false;
    if (verseAudioPlaying && !verseAudioPaused) {
      audio.pause();
      verseAudioPaused = true;
      updateAudioControls();
      return;
    }
    var audioKey = getCurrentAudioKey();
    var sourceUrl = getCurrentVerseAudioUrl();
    if (!sourceUrl) {
      handleVerseAudioError();
      showToast(t("audioUnavailable"));
      return;
    }
    var sourceRequest = ++audioSourceRequest;
    verseAudioPlaying = true;
    verseAudioPaused = false;
    updateAudioControls();
    if (audio.getAttribute("data-verse-key") === audioKey && audio.getAttribute("src")) {
      audio.play().catch(handleVerseAudioError);
      return;
    }
    setAudioMeta("audioLoading");
    resolveVerseAudioSource(sourceUrl).then(function (source) {
      if (sourceRequest !== audioSourceRequest || !verseAudioPlaying) return;
      audio.src = source;
      audio.setAttribute("data-verse-key", audioKey);
      audio.load();
      return audio.play();
    }).then(function () {
      if (getSelectedReciter().provider === "chapter") {
        setAudioMeta("chapterRecitationSource");
        showToast(t("chapterAudioScope"));
      }
    }).catch(handleVerseAudioError);
  }

  function activateAudioMode() {
    setStudioMode(false);
    document.body.classList.add("audio-view");
    selectReaderMode("listen");
    document.getElementById("audio-panel").hidden = false;
    showToast(t("listenMode"));
    playVerseAudio();
  }

  function checkAudioSupport() {
    var audio = document.getElementById("verse-audio");
    var supported = Boolean(audio && audio.canPlayType && audio.canPlayType("audio/mpeg"));
    var toolbarButton = document.getElementById("play-demo-audio");
    var mushafAudioButton = document.getElementById("mushaf-play-audio");
    var modeButton = document.querySelector('[data-reader-mode="listen"]');
    var playButton = document.getElementById("audio-play-toggle");
    [toolbarButton, mushafAudioButton, modeButton, playButton].forEach(function (button) {
      if (!button) return;
      button.disabled = !supported;
      button.setAttribute("aria-disabled", String(!supported));
    });
    updateAudioControls();
  }

  function getNextVerseLocation() {
    if (!currentSurah || !currentVerse) return null;
    if (mushafSelectedVerseKey && mushafPageVerses.length) {
      var mushafIndex = mushafPageVerses.findIndex(function (verse) { return verse.verse_key === mushafSelectedVerseKey; });
      if (mushafIndex >= 0 && mushafIndex < mushafPageVerses.length - 1) return { mushafVerse: mushafPageVerses[mushafIndex + 1], newSurah: false };
      if (mushafIndex >= 0 && mushafPageNumber < 604) return { mushafNextPage: mushafPageNumber + 1, newSurah: false };
      return null;
    }
    if (quranCatalogReady && mushafChapterNames[currentSurah.id]) {
      var chapter = mushafChapterNames[currentSurah.id];
      if (Number(currentVerse.ayah) < Number(chapter.verses_count)) {
        return { remoteSurah: currentSurah.id, remoteAyah: Number(currentVerse.ayah) + 1, newSurah: false };
      }
      if (currentSurah.id < 114 && mushafChapterNames[currentSurah.id + 1]) {
        return { remoteSurah: currentSurah.id + 1, remoteAyah: 1, newSurah: true };
      }
      return null;
    }
    var surahIndex = corpus.indexOf(currentSurah);
    var verseIndex = currentSurah.verses.indexOf(currentVerse);
    if (verseIndex >= 0 && verseIndex < currentSurah.verses.length - 1) {
      return { surah: currentSurah, verse: currentSurah.verses[verseIndex + 1], newSurah: false };
    }
    if (surahIndex >= 0 && surahIndex < corpus.length - 1) {
      return { surah: corpus[surahIndex + 1], verse: corpus[surahIndex + 1].verses[0], newSurah: true };
    }
    return null;
  }

  function updateNextButton() {
    var button = document.getElementById("next-ayah");
    if (!button) return;
    var next = getNextVerseLocation();
    var blocked = Boolean(state.strictCorrection && correctionLocked);
    button.disabled = !next || blocked;
    button.setAttribute("aria-disabled", String(!next || blocked));
    button.title = blocked ? t("correctionBlocked") : "";
    button.querySelector("span").textContent = t(!next ? "corpusEnd" : (next.newSurah ? "nextSurah" : "nextAyah"));
  }

  function findCorrectionIndex(statuses, startAt) {
    var start = Math.max(0, Number(startAt) || 0);
    for (var index = start; index < statuses.length; index += 1) {
      if (statuses[index] !== "recognized") return index;
    }
    for (var rewind = 0; rewind < start; rewind += 1) {
      if (statuses[rewind] !== "recognized") return rewind;
    }
    return -1;
  }

  function renderCorrectionGate(resolved) {
    var gate = document.getElementById("correction-gate");
    if (!gate) return;
    gate.classList.toggle("is-resolved", Boolean(resolved));
    if (resolved) {
      gate.hidden = false;
      document.getElementById("correction-gate-title").textContent = t("correctionResolved");
      document.getElementById("correction-gate-text").textContent = t("correctionResolvedSub");
      return;
    }
    gate.hidden = !correctionLocked;
    if (!correctionLocked) return;
    var word = currentWords[correctionIndex] ? currentWords[correctionIndex].ar : "";
    document.getElementById("correction-gate-title").textContent = t("correctionRequired");
    document.getElementById("correction-gate-text").textContent = formatText("correctionRequiredSub", { word: word });
  }

  function clearCorrectionLock() {
    correctionLocked = false;
    correctionIndex = -1;
    correctionStatuses = [];
    var gate = document.getElementById("correction-gate");
    if (gate) {
      gate.hidden = true;
      gate.classList.remove("is-resolved");
    }
    updateNextButton();
  }

  function activateCorrectionLock(alignment) {
    if (!state.strictCorrection || !alignment || alignment.complete) return false;
    var targetIndex = findCorrectionIndex(alignment.statuses, 0);
    if (targetIndex < 0) return false;
    correctionLocked = true;
    correctionIndex = targetIndex;
    correctionStatuses = alignment.statuses.slice();
    clearAutoAdvance();
    renderCorrectionGate(false);
    updateNextButton();
    setRecognitionStatus("correctionStatus", "correctionStatusSub", true);
    document.getElementById("recitation-subtitle").textContent = formatText("correctionRequiredSub", {
      word: currentWords[correctionIndex] ? currentWords[correctionIndex].ar : ""
    });
    playErrorCue();
    return true;
  }

  function getAutoAdvanceNotice(context) {
    return document.getElementById(context === "memory" ? "memory-auto-advance" : "read-auto-advance");
  }

  function renderAutoAdvanceCountdown() {
    if (!autoAdvanceContext || autoAdvanceSeconds < 1) return;
    var notice = getAutoAdvanceNotice(autoAdvanceContext);
    if (!notice) return;
    var text = document.getElementById(autoAdvanceContext === "memory" ? "memory-auto-advance-text" : "read-auto-advance-text");
    text.textContent = formatText(autoAdvanceContext === "memory" ? "autoAdvanceMemoryCountdown" : "autoAdvanceReadCountdown", { seconds: formatMetric(autoAdvanceSeconds) });
    notice.hidden = false;
  }

  function clearAutoAdvance() {
    window.clearTimeout(autoAdvanceTimer);
    window.clearInterval(autoAdvanceInterval);
    autoAdvanceTimer = null;
    autoAdvanceInterval = null;
    autoAdvanceContext = null;
    autoAdvanceSeconds = 0;
    ["read-auto-advance", "memory-auto-advance"].forEach(function (id) {
      var notice = document.getElementById(id);
      if (notice) notice.hidden = true;
    });
  }

  function clearContinuousRestart() {
    window.clearTimeout(continuousRestartTimer);
    continuousRestartTimer = null;
  }

  function stopContinuousSession() {
    continuousSessionActive = false;
    continuousResumePending = false;
    clearContinuousRestart();
  }

  function queueContinuousRestart(delay) {
    clearContinuousRestart();
    if (state.recitationFlow !== "continuous" || !continuousSessionActive || userStoppedRecognition || quranSubmitting) return false;
    if (continuousFailureCount >= 4) {
      stopContinuousSession();
      setRecognitionStatus("recognitionError", "recognitionErrorSub", true);
      return false;
    }
    continuousRestartTimer = window.setTimeout(function () {
      continuousRestartTimer = null;
      if (state.recitationFlow === "continuous" && continuousSessionActive && !userStoppedRecognition && !isListening && !recognitionStartPending && !quranSubmitting && !autoAdvanceTimer) {
        startRecognition(true);
      }
    }, Math.max(240, Number(delay) || 420));
    return true;
  }

  function updateRecitationFlowUi() {
    var continuous = state.recitationFlow === "continuous";
    document.body.classList.toggle("continuous-recitation", continuous);
    document.querySelectorAll("[data-recitation-flow]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-recitation-flow") === state.recitationFlow));
    });
  }

  function scheduleAutoAdvance(context) {
    clearAutoAdvance();
    if ((!state.autoAdvance && state.recitationFlow !== "continuous") || !getNextVerseLocation()) {
      continuousResumePending = false;
      return false;
    }
    autoAdvanceContext = context === "memory" ? "memory" : "read";
    if (autoAdvanceContext === "read" && state.recitationFlow === "continuous" && continuousSessionActive) {
      autoAdvanceTimer = window.setTimeout(function () {
        clearAutoAdvance();
        goToNextVerse();
      }, 80);
      return true;
    }
    autoAdvanceSeconds = autoAdvanceContext === "read" ? 1 : 3;
    var delay = autoAdvanceSeconds * 1000;
    renderAutoAdvanceCountdown();
    autoAdvanceInterval = window.setInterval(function () {
      autoAdvanceSeconds -= 1;
      if (autoAdvanceSeconds > 0) renderAutoAdvanceCountdown();
    }, 1000);
    autoAdvanceTimer = window.setTimeout(function () {
      clearAutoAdvance();
      goToNextVerse();
    }, delay);
    return true;
  }

  function goToNextVerse(preserveMode) {
    clearAutoAdvance();
    if (state.strictCorrection && correctionLocked) {
      playErrorCue();
      showToast(t("correctionBlocked"));
      renderCorrectionGate(false);
      return false;
    }
    var next = getNextVerseLocation();
    if (!next) {
      continuousResumePending = false;
      return false;
    }
    var resumeContinuous = continuousResumePending && state.recitationFlow === "continuous" && continuousSessionActive && !userStoppedRecognition;
    continuousResumePending = false;
    if (next.mushafVerse) {
      activateMushafVerse(next.mushafVerse, true);
      if (resumeContinuous) window.setTimeout(function () { startRecognition(true); }, 90);
      return true;
    }
    if (next.mushafNextPage) {
      loadMushafPage(next.mushafNextPage, false).then(function () {
        if (mushafPageVerses[0]) activateMushafVerse(mushafPageVerses[0], true);
        if (resumeContinuous) window.setTimeout(function () { startRecognition(true); }, 90);
      });
      return true;
    }
    if (next.remoteSurah) {
      selectVerseByReference(next.remoteSurah, next.remoteAyah, { navigate: false, forceRemote: true }).then(function (selected) {
        if (selected && state.recitationFlow === "continuous" && preserveMode !== "audio") {
          setMushafMode(true);
          selectReaderMode("mushaf");
        }
        if (selected && resumeContinuous) window.setTimeout(function () { startRecognition(true); }, 90);
      });
      return true;
    }
    state.selectedSurah = next.surah.id;
    state.selectedAyah = next.verse.ayah;
    populateVerseSelectors();
    renderSelectedVerse(true);
    if (state.recitationFlow === "continuous" && preserveMode !== "audio") {
      setMushafMode(true);
      selectReaderMode("mushaf");
    }
    if (resumeContinuous) {
      window.setTimeout(function () {
        if (state.recitationFlow === "continuous" && continuousSessionActive && !isListening && !recognitionStartPending) startRecognition(true);
      }, 90);
    }
    return true;
  }

  function arabicNumber(value) {
    return String(value).replace(/[0-9]/g, function (digit) { return "٠١٢٣٤٥٦٧٨٩"[Number(digit)]; });
  }

  function getVerseLabel(surah, verse) {
    if (!surah || !verse) return "";
    if (state.language === "ar") return "سورة " + surah.names.ar + "، الآية " + arabicNumber(verse.ayah);
    if (state.language === "en") return "Surah " + surah.names.en + ", verse " + verse.ayah;
    return "Сура " + surah.names.ru + ", аят " + verse.ayah;
  }

  function updatePassageHeader() {
    if (!currentSurah || !currentVerse) return;
    document.getElementById("surah-seal").textContent = state.language === "ar" ? arabicNumber(currentSurah.id) : String(currentSurah.id);
    document.getElementById("reader-surah-name").textContent = currentSurah.names[state.language];
    document.getElementById("reader-surah-arabic").textContent = state.language === "ar" ? arabicNumber(currentSurah.id) + ":" + arabicNumber(currentVerse.ayah) : currentSurah.names.ar;
  }

  function updateMatchIndicator(matched) {
    var total = Math.max(currentWords.length, 1);
    var count = Math.max(0, Math.min(Number(matched) || 0, total));
    var localCount = state.language === "ar" ? arabicNumber(count) : String(count);
    var localTotal = state.language === "ar" ? arabicNumber(total) : String(total);
    var orbit = document.getElementById("match-orbit");
    document.getElementById("match-count").textContent = localCount + "/" + localTotal;
    orbit.style.setProperty("--match-progress", Math.round((count / total) * 100) + "%");
    orbit.setAttribute("aria-label", t("matchedWords") + ": " + localCount + " / " + localTotal);
  }

  function formatMetric(value) {
    return state.language === "ar" ? arabicNumber(value) : String(value);
  }

  function updateReadingSummary(alignment, isFinal) {
    var matched = alignment ? alignment.matched : 0;
    var review = alignment ? alignment.warnings + alignment.errors : 0;
    var extras = alignment ? alignment.extras : 0;
    document.getElementById("summary-matched").textContent = formatMetric(matched);
    document.getElementById("summary-review").textContent = formatMetric(review);
    document.getElementById("summary-extra").textContent = formatMetric(extras);
    var messageKey = !alignment ? "summaryIdle" : (alignment.complete ? "summaryComplete" : (isFinal ? "summaryFinal" : "summaryLive"));
    document.getElementById("summary-message").textContent = t(messageKey);
    document.getElementById("reading-summary").classList.toggle("has-results", Boolean(alignment));
    updateTeacherAssessmentUi(alignment);
  }

  function updateTeacherAssessmentUi(alignment) {
    if (!teacherAssessmentMode) return;
    var score = document.getElementById("teacher-assessment-word-score");
    if (!score) return;
    if (!alignment || !currentWords.length) {
      score.textContent = "—";
      return;
    }
    var percent = Math.max(0, Math.min(100, Math.round((Number(alignment.matched) || 0) / currentWords.length * 100)));
    score.textContent = formatMetric(percent) + "%";
  }

  async function initializeTeacherAssessmentMode() {
    if (!teacherAssessmentRequested) return;
    var returnUrl = "/academy?panel=teacher&feature=strict-assessment&lang=" + encodeURIComponent(state.language);
    try {
      var authResponse = await fetch("/api/method/frappe.auth.get_logged_user", { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!authResponse.ok) throw new Error("auth-" + authResponse.status);
      var auth = await authResponse.json();
      var user = auth.message || "Guest";
      if (user === "Guest") throw new Error("guest");
      var filters = encodeURIComponent(JSON.stringify([["member", "=", user]]));
      var fields = encodeURIComponent(JSON.stringify(["name", "batch"]));
      var accessResponse = await fetch("/api/resource/LMS%20Batch%20Enrollment?filters=" + filters + "&fields=" + fields + "&limit_page_length=1", { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!accessResponse.ok) throw new Error("access-" + accessResponse.status);
      var access = await accessResponse.json();
      if (!access.data || !access.data.length) throw new Error("not-enrolled");
    } catch (error) {
      window.location.replace(returnUrl);
      return;
    }
    teacherAssessmentMode = true;
    document.body.classList.add("teacher-assessment-mode");
    document.getElementById("teacher-assessment-banner").hidden = false;
    document.getElementById("teacher-assessment-result").hidden = false;
    state.recognitionMode = "quran";
    state.recognitionModeExplicit = true;
    state.recitationFlow = "single";
    state.recitationFlowExplicit = true;
    state.strictCorrection = true;
    saveState();
    updateRecognitionModeUi();
    updateRecitationFlowUi();
    document.getElementById("strict-correction-toggle").checked = true;
    updateTeacherAssessmentUi(lastAlignment);
  }

  function splitVerseWords(text) {
    return String(text || "").split(/\s+/).filter(function (token) {
      return normalizeArabic(token).length > 0;
    });
  }

  function selectReaderMode(mode) {
    document.querySelectorAll("[data-reader-mode]").forEach(function (item) {
      item.classList.toggle("is-active", item.getAttribute("data-reader-mode") === mode);
    });
    var pickerLabel = document.getElementById("reader-mode-picker-label");
    var picker = document.getElementById("reader-mode-picker");
    var labelKeys = { read: "modeRead", mushaf: "modeMushaf", listen: "modeListen", focus: "modeFocus" };
    if (pickerLabel) pickerLabel.textContent = t(labelKeys[mode] || "modeMushaf");
    if (picker) picker.removeAttribute("open");
  }

  function setMushafMode(active, skipLoad) {
    var enabled = Boolean(active);
    var wasEnabled = document.body.classList.contains("mushaf-view");
    if (!enabled && pageRecallSession) clearPageRecallMode();
    if (enabled && !wasEnabled) {
      recitationFlowBeforeMushaf = state.recitationFlow;
      state.recitationFlow = "continuous";
      updateRecitationFlowUi();
    } else if (!enabled && wasEnabled && recitationFlowBeforeMushaf) {
      state.recitationFlow = recitationFlowBeforeMushaf;
      recitationFlowBeforeMushaf = null;
      updateRecitationFlowUi();
    }
    document.body.classList.toggle("mushaf-view", enabled);
    if (enabled) document.body.classList.remove("audio-view");
    var page = document.getElementById("mushaf-page");
    var toolbar = document.getElementById("mushaf-page-toolbar");
    if (page) page.hidden = !enabled;
    if (toolbar) toolbar.hidden = !enabled;
    if (active && state.showInterlinear) {
      state.showInterlinear = false;
      updateInterlinearUi();
    }
    if (enabled) {
      window.scrollTo(0, 0);
      updateMushafFontUi();
      if (!skipLoad) loadMushafForCurrentVerse();
    }
  }

  function exitMushafToReading(restoreFocus) {
    document.body.classList.remove("audio-view");
    setMushafMode(false);
    stopVerseAudio(false);
    var audioPanel = document.getElementById("audio-panel");
    if (audioPanel) audioPanel.hidden = true;
    setStudioMode(false);
    selectReaderMode("read");
    setMeaningVisibility(state.showMeaning);
    if (restoreFocus) {
      window.requestAnimationFrame(function () {
        var mobileHome = document.querySelector(".mobile-brand");
        if (mobileHome) mobileHome.focus();
      });
    }
  }

  function updateMushafFontUi() {
    var select = document.getElementById("mushaf-font-select");
    if (select) select.value = state.mushafFont;
    applyMushafAppearance();
  }

  function getLocalSurahExact(id) {
    return corpus.find(function (surah) { return surah.id === Number(id); }) || null;
  }

  function getLocalVerseExact(surah, ayah) {
    if (!surah || !Array.isArray(surah.verses)) return null;
    return surah.verses.find(function (verse) { return verse.ayah === Number(ayah); }) || null;
  }

  function getCatalogChapters() {
    return Object.keys(mushafChapterNames).map(function (id) { return mushafChapterNames[id]; }).filter(Boolean).sort(function (left, right) { return left.id - right.id; });
  }

  function getChapterNames(chapter, localSurah) {
    var id = Number(chapter && chapter.id || localSurah && localSurah.id || 0);
    return {
      ru: localSurah && localSurah.names && localSurah.names.ru || russianSurahNames[id] || ("Сура " + id),
      en: localSurah && localSurah.names && localSurah.names.en || chapter && chapter.name_simple || ("Surah " + id),
      ar: localSurah && localSurah.names && localSurah.names.ar || chapter && chapter.name_arabic || ("سورة " + arabicNumber(id))
    };
  }

  function getChapterDisplayName(chapter) {
    var localSurah = getLocalSurahExact(chapter.id);
    var names = getChapterNames(chapter, localSurah);
    return names[state.language] || names.en;
  }

  function makeRemoteSurah(chapter) {
    return { id: Number(chapter.id), names: getChapterNames(chapter, getLocalSurahExact(chapter.id)), verses: [] };
  }

  function loadMushafChapterNames() {
    if (Object.keys(mushafChapterNames).length) return Promise.resolve(mushafChapterNames);
    return window.fetch("/api/mushaf/chapters", { headers: { "X-Requested-With": "QuranCompanion" } }).then(function (response) {
      if (!response.ok) throw new Error("mushaf-chapters-unavailable");
      return response.json();
    }).then(function (data) {
      (data.chapters || []).forEach(function (chapter) { mushafChapterNames[chapter.id] = chapter; });
      quranCatalogReady = Object.keys(mushafChapterNames).length === 114;
      return mushafChapterNames;
    }).catch(function () {
      quranCatalogReady = false;
      return mushafChapterNames;
    });
  }

  function loadMushafFont(pageNumber) {
    if (state.mushafFont === "readable") return Promise.resolve({ name: "Uthmanic Hafs", version: "readable", loaded: true });
    var version = state.mushafFont === "classic" ? "v1" : "v2";
    var fontKey = version + "-" + pageNumber;
    var fontName = "allim-qcf-" + version + "-p" + pageNumber;
    if (loadedMushafFonts[fontKey]) return Promise.resolve({ name: fontName, version: version, loaded: true });
    if (!window.FontFace || !document.fonts) return Promise.resolve({ name: "Uthmanic Hafs", version: "readable", loaded: false });
    var baseUrl = "https://verses.quran.foundation/fonts/quran/hafs/" + version;
    var sources = "url('" + baseUrl + "/woff2/p" + pageNumber + ".woff2') format('woff2'), url('" + baseUrl + "/woff/p" + pageNumber + ".woff') format('woff'), url('" + baseUrl + "/ttf/p" + pageNumber + ".ttf') format('truetype')";
    var face = new window.FontFace(fontName, sources);
    face.display = "swap";
    return face.load().then(function (loaded) {
      document.fonts.add(loaded);
      loadedMushafFonts[fontKey] = true;
      return { name: fontName, version: version, loaded: true };
    }).catch(function () {
      return { name: "Uthmanic Hafs", version: "readable", loaded: false };
    });
  }

  function fitMushafLines(container) {
    if (!container) return;
    if (mushafFitFrame) window.cancelAnimationFrame(mushafFitFrame);
    var viewportHeight = window.visualViewport && window.visualViewport.height ? window.visualViewport.height : window.innerHeight;
    var compactViewport = window.innerWidth <= 620;
    var minimumSize = compactViewport ? 9 : 12;
    var baseSize = Math.max(minimumSize, Math.min(compactViewport ? 28 : 39, Math.floor((viewportHeight - 140) / 22)));
    var lines = Array.prototype.slice.call(container.querySelectorAll(".mushaf-line"));
    lines.forEach(function (line) { line.style.setProperty("--mushaf-line-font-size", baseSize + "px"); });
    mushafFitFrame = window.requestAnimationFrame(function () {
      lines.forEach(function (line) {
        var classicCompact = compactViewport && state.mushafFont === "classic";
        var available = Math.max(1, line.clientWidth - (classicCompact ? 18 : 4));
        var glyphWidth = Array.prototype.slice.call(line.children).reduce(function (total, glyph) {
          return total + Math.max(glyph.offsetWidth, glyph.scrollWidth);
        }, 0);
        var safetyScale = state.mushafFont === "classic" ? (compactViewport ? 1.27 : 1.05) : 1.02;
        var needed = Math.max(1, line.scrollWidth, (glyphWidth + 4) * safetyScale);
        if (needed > available) {
          line.style.setProperty("--mushaf-line-font-size", Math.max(minimumSize, Math.floor(baseSize * available / needed)) + "px");
        }
      });
      mushafFitFrame = null;
    });
  }

  function getMushafChapterLabel(id) {
    var chapter = mushafChapterNames[id] || {};
    var label = chapter.name_arabic || arabicNumber(id);
    return /^\s*س[ُ]?ور[ةۃ]/.test(label) ? label : ("سُورَةُ " + label);
  }

  function makeMushafSurahWing(side) {
    var wing = document.createElement("span");
    wing.className = "mushaf-surah-wing is-" + side;
    wing.setAttribute("aria-hidden", "true");
    wing.innerHTML = '<svg viewBox="0 0 180 42" preserveAspectRatio="none" focusable="false">' +
      '<path class="mushaf-surah-vine" d="M2 21C24 21 28 8 48 8S72 34 94 34 120 8 142 8c17 0 20 13 36 13"/>' +
      '<path class="mushaf-surah-leaf" d="M44 10c-13-8-22 2-9 10 9 5 16-1 9-10Zm51 22c-12 9-22 0-10-9 8-6 16-1 10 9Zm48-22c-12-8-21 2-9 10 9 5 16-1 9-10Z"/>' +
      '<circle class="mushaf-surah-blossom" cx="70" cy="21" r="3.2"/><circle class="mushaf-surah-blossom" cx="119" cy="21" r="3.2"/>' +
      '</svg>';
    return wing;
  }

  function makeMushafHeader(chapterId) {
    var fragment = document.createDocumentFragment();
    var heading = document.createElement("div");
    heading.className = "mushaf-surah-banner";
    heading.setAttribute("role", "separator");
    heading.setAttribute("aria-label", getMushafChapterLabel(chapterId));
    var title = document.createElement("strong");
    title.className = "mushaf-surah-title";
    title.textContent = getMushafChapterLabel(chapterId);
    heading.appendChild(makeMushafSurahWing("start"));
    heading.appendChild(title);
    heading.appendChild(makeMushafSurahWing("end"));
    fragment.appendChild(heading);
    if (Number(chapterId) !== 9 && Number(chapterId) !== 1) {
      var basmala = document.createElement("div");
      basmala.className = "mushaf-basmala";
      basmala.textContent = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";
      fragment.appendChild(basmala);
    }
    return fragment;
  }

  function renderMushafPage(data, fontInfo) {
    var container = document.getElementById("mushaf-page");
    if (!container || !data || !Array.isArray(data.verses)) return;
    var resolvedFont = fontInfo && fontInfo.name ? fontInfo.name : "Uthmanic Hafs";
    var resolvedVersion = fontInfo && fontInfo.loaded ? fontInfo.version : "readable";
    container.textContent = "";
    mushafPageVerses = data.verses.slice();
    heartCurrentPageData = data;
    heartPageCache[data.page] = data;
    getHeartPageVerseKeys(data).forEach(function (key) { heartVersePageCache[key] = Number(data.page); });
    var lines = new Map();
    data.verses.forEach(function (verse) {
      var words = Array.isArray(verse.words) ? verse.words : [];
      words.forEach(function (word, index) {
        var lineNumber = Number(word.line_number) || 1;
        if (!lines.has(lineNumber)) lines.set(lineNumber, { words: [], headers: [] });
        var line = lines.get(lineNumber);
        if (verse.verse_number === 1 && index === 0) line.headers.push(Number(String(verse.verse_key).split(":")[0]));
        line.words.push({ word: word, verse: verse });
      });
    });
    Array.from(lines.keys()).sort(function (a, b) { return a - b; }).forEach(function (lineNumber) {
      var lineData = lines.get(lineNumber);
      lineData.headers.forEach(function (chapterId) { container.appendChild(makeMushafHeader(chapterId)); });
      var line = document.createElement("div");
      line.className = "mushaf-line";
      line.setAttribute("data-line", String(lineNumber));
      lineData.words.forEach(function (item) {
        var word = item.word;
        var span = document.createElement("button");
        span.type = "button";
        span.className = "mushaf-glyph" + (word.char_type_name === "end" ? " is-ayah-end" : "");
        span.style.fontFamily = resolvedFont;
        span.setAttribute("data-verse-key", item.verse.verse_key);
        span.setAttribute("aria-label", word.text_qpc_hafs || item.verse.verse_key);
        var glyph = resolvedVersion === "v1" ? String(word.code_v1 || word.code_v2 || "") : (resolvedVersion === "v2" ? String(word.code_v2 || "") : String(word.text_qpc_hafs || ""));
        if (glyph.indexOf("<") === -1 && glyph.indexOf(">") === -1) span.innerHTML = glyph;
        else span.textContent = word.text_qpc_hafs || "";
        span.addEventListener("click", function () {
          container.querySelectorAll(".mushaf-glyph.is-current").forEach(function (node) { node.classList.remove("is-current"); });
          container.querySelectorAll('[data-verse-key="' + item.verse.verse_key + '"]').forEach(function (node) { node.classList.add("is-current"); });
          activateMushafVerse(item.verse, true);
        });
        line.appendChild(span);
      });
      container.appendChild(line);
    });
    var lineCount = Math.max(lines.size, 1);
    container.style.setProperty("--mushaf-line-height", Math.max(36, Math.min(86, Math.floor(650 / lineCount))) + "px");
    var footer = document.createElement("div");
    footer.className = "mushaf-page-footer";
    footer.textContent = state.language === "ar" ? arabicNumber(data.page) : String(data.page);
    container.appendChild(footer);
    var activeKey = currentSurah && currentVerse ? currentSurah.id + ":" + currentVerse.ayah : "";
    var activeNodes = activeKey ? container.querySelectorAll('[data-verse-key="' + activeKey + '"]') : [];
    if (activeNodes.length) activeNodes.forEach(function (node) { node.classList.add("is-current"); });
    else if (data.verses[0]) activateMushafVerse(data.verses[0], true);
    renderHeartReadCounter();
    fitMushafLines(container);
    updatePageRecallUi();
  }

  function renderMeaningAttribution() {
    var attribution = document.getElementById("meaning-attribution");
    var edition = document.getElementById("meaning-edition");
    var source = document.getElementById("meaning-source");
    var metadata = currentVerse && currentVerse.translationMeta;
    var visible = Boolean(
      attribution &&
      metadata &&
      metadata.language === state.language &&
      state.showMeaning &&
      !document.body.classList.contains("reader-studio")
    );
    if (!attribution) return;
    attribution.hidden = !visible;
    if (!visible) return;
    edition.textContent = formatText("translationBy", { author: metadata.author });
    source.textContent = t("quranFoundationAttribution");
  }

  function renderCurrentMeaning(fallbackText) {
    var meaning = document.getElementById("meaning-text");
    if (!meaning || !currentVerse) return;
    var text = currentVerse.meaning && currentVerse.meaning[state.language];
    meaning.textContent = text || fallbackText || t("translationUnavailable");
    meaning.lang = state.language;
    meaning.setAttribute("translate", "no");
    meaning.classList.toggle("is-hidden", !state.showMeaning || document.body.classList.contains("reader-studio"));
    renderMeaningAttribution();
  }

  function ensureVerifiedVerseTranslation() {
    if (!currentSurah || !currentVerse || state.language !== "ru" || !window.fetch) {
      renderCurrentMeaning();
      return Promise.resolve(null);
    }
    var key = getVerseKey(currentSurah, currentVerse);
    var cached = verseTranslationCache[key];
    if (cached) {
      currentVerse.meaning.ru = cached.text;
      currentVerse.translationMeta = cached;
      renderCurrentMeaning();
      return Promise.resolve(cached);
    }
    if (window.location.protocol === "file:") {
      renderCurrentMeaning();
      return Promise.resolve(null);
    }
    if (verseTranslationPending[key]) return verseTranslationPending[key];
    verseTranslationRequestId += 1;
    var localFallback = currentVerse.meaning && currentVerse.meaning.ru;
    if (!localFallback || localFallback === t("glossPending")) {
      currentVerse.meaning.ru = t("translationLoading");
      renderCurrentMeaning();
    }
    verseTranslationPending[key] = window.fetch(
      "/api/quran/translation/" + currentSurah.id + "/" + currentVerse.ayah + "?resource_id=45",
      {
        cache: "force-cache",
        headers: { "X-Requested-With": "QuranCompanion" }
      }
    ).then(function (response) {
      if (!response.ok) throw new Error("translation-unavailable");
      return response.json();
    }).then(function (payload) {
      if (!payload || !payload.text || Number(payload.resource_id) !== 45) throw new Error("translation-invalid");
      var record = {
        language: "ru",
        text: String(payload.text),
        author: String(payload.author || "Эльмир Кулиев"),
        edition: String(payload.edition || "Russian Translation (Elmir Kuliev)"),
        source: String(payload.source || "Quran Foundation")
      };
      verseTranslationCache[key] = record;
      if (currentSurah && currentVerse && getVerseKey(currentSurah, currentVerse) === key) {
        currentVerse.meaning.ru = record.text;
        currentVerse.translationMeta = record;
        renderCurrentMeaning();
      }
      return record;
    }).catch(function () {
      if (currentSurah && currentVerse && getVerseKey(currentSurah, currentVerse) === key) {
        currentVerse.meaning.ru = localFallback && localFallback !== t("glossPending") ? localFallback : t("translationUnavailable");
        delete currentVerse.translationMeta;
        renderCurrentMeaning();
      }
      return null;
    }).then(function (payload) {
      delete verseTranslationPending[key];
      return payload;
    });
    return verseTranslationPending[key];
  }

  function activateMushafVerse(verseData, resetRecognition) {
    if (!verseData || !verseData.verse_key) return;
    var parts = String(verseData.verse_key).split(":");
    var surahId = Number(parts[0]);
    var ayahNumber = Number(parts[1]);
    var chapter = mushafChapterNames[surahId] || {};
    var localSurah = corpus.find(function (surah) { return surah.id === surahId; });
    var localVerse = localSurah && localSurah.verses.find(function (verse) { return verse.ayah === ayahNumber; });
    var readableWords = (verseData.words || []).filter(function (word) { return word.char_type_name !== "end"; }).map(function (word) { return word.text_qpc_hafs || ""; }).filter(Boolean);
    currentSurah = {
      id: surahId,
      names: getChapterNames(chapter, localSurah),
      verses: []
    };
    currentVerse = {
      ayah: ayahNumber,
      text: localVerse ? localVerse.text : readableWords.join(" "),
      meaning: localVerse ? localVerse.meaning : { ru: t("glossPending"), en: t("glossPending"), ar: t("glossPending") }
    };
    currentSurah.verses = [currentVerse];
    state.selectedSurah = surahId;
    state.selectedAyah = ayahNumber;
    populateVerseSelectors();
    saveState();
    currentWords = makeCurrentWords(currentVerse, currentSurah);
    mushafSelectedVerseKey = verseData.verse_key;
    selectedWordIndex = 0;
    renderCurrentVerseWords(ayahNumber);
    document.getElementById("verse-reference").textContent = verseData.verse_key;
    renderCurrentMeaning();
    updatePassageHeader();
    updateInterlinearUi();
    updateMatchIndicator(0);
    updateReadingSummary(null, false);
    updateWord(0, false);
    updateAiMentor("intro");
    updateNextButton();
    updateVerseActions();
    renderHeartReadCounter();
    stopVerseAudio(false);
    if (resetRecognition !== false) resetRecognitionView();
    document.querySelectorAll(".mushaf-glyph.is-current").forEach(function (node) { node.classList.remove("is-current"); });
    document.querySelectorAll('[data-verse-key="' + verseData.verse_key + '"]').forEach(function (node) { node.classList.add("is-current"); });
    ensureInterlinearWords();
    ensureVerifiedVerseTranslation();
  }

  function loadMushafPage(pageNumber, announce) {
    var page = Math.max(1, Math.min(604, Number(pageNumber) || 1));
    var requestId = ++mushafPageRequest;
    var container = document.getElementById("mushaf-page");
    var input = document.getElementById("mushaf-page-number");
    mushafPageNumber = page;
    if (input) input.value = String(page);
    if (container) {
      container.hidden = false;
      container.innerHTML = '<div class="mushaf-page-loading"><span></span><strong>' + t("mushafLoading") + "</strong></div>";
    }
    var mushafId = state.mushafFont === "classic" ? 2 : 1;
    return Promise.all([
      window.fetch("/api/mushaf/page/" + page + "?mushaf=" + mushafId, { headers: { "X-Requested-With": "QuranCompanion" } }).then(function (response) {
        if (!response.ok) throw new Error("mushaf-page-unavailable");
        return response.json();
      }),
      loadMushafFont(page),
      loadMushafChapterNames()
    ]).then(function (results) {
      if (requestId !== mushafPageRequest) return;
      renderMushafPage(results[0], results[1]);
      document.getElementById("mushaf-prev-page").disabled = page <= 1;
      document.getElementById("mushaf-next-page").disabled = page >= 604;
      if (announce) showToast(formatText("mushafPageReady", { page: state.language === "ar" ? arabicNumber(page) : page }));
    }).catch(function () {
      if (requestId !== mushafPageRequest || !container) return;
      container.innerHTML = '<div class="mushaf-page-error"><strong>' + t("mushafLoadError") + "</strong></div>";
    });
  }

  function navigateMushafPage(delta) {
    var direction = Number(delta) < 0 ? -1 : 1;
    if (direction > 0 && state.strictCorrection && correctionLocked) {
      showToast(t("correctionBlocked"));
      return false;
    }
    var targetPage = Math.max(1, Math.min(604, mushafPageNumber + direction));
    if (targetPage === mushafPageNumber) return false;
    loadMushafPage(targetPage, true).then(function () {
      var targetVerse = direction > 0 ? mushafPageVerses[0] : mushafPageVerses[mushafPageVerses.length - 1];
      if (targetVerse) activateMushafVerse(targetVerse, true);
    });
    return true;
  }

  function loadMushafForCurrentVerse() {
    if (!currentSurah || !currentVerse) return Promise.resolve(false);
    var requestId = ++mushafPageRequest;
    return window.fetch("/api/mushaf/locate/" + currentSurah.id + "/" + currentVerse.ayah, { headers: { "X-Requested-With": "QuranCompanion" } }).then(function (response) {
      if (!response.ok) throw new Error("mushaf-location-unavailable");
      return response.json();
    }).then(function (data) {
      if (requestId !== mushafPageRequest) return;
      mushafPageRequest -= 1;
      return loadMushafPage(data.page, false).then(function () { return true; });
    }).catch(function () {
      if (requestId !== mushafPageRequest) return false;
      mushafPageRequest -= 1;
      return loadMushafPage(mushafPageNumber || 1, false).then(function () { return false; });
    });
  }

  function setVerseLoading(loading) {
    var panel = document.querySelector(".mushaf-panel");
    if (panel) panel.setAttribute("aria-busy", String(Boolean(loading)));
    document.body.classList.toggle("is-loading-verse", Boolean(loading));
    var searchStatus = document.getElementById("quran-search-status");
    if (loading && searchStatus) searchStatus.textContent = t("verseLoading");
  }

  function selectVerseByReference(surahId, ayahNumber, options) {
    var opts = options || {};
    var id = Number(surahId);
    var ayah = Number(ayahNumber);
    var chapter = mushafChapterNames[id];
    var localSurah = getLocalSurahExact(id);
    var localVerse = getLocalVerseExact(localSurah, ayah);
    var maxAyah = chapter ? Number(chapter.verses_count) : (localSurah && localSurah.verses.length ? Math.max.apply(null, localSurah.verses.map(function (verse) { return verse.ayah; })) : 0);
    if (!id || !ayah || id < 1 || id > 114 || ayah > maxAyah) {
      showToast(t("searchNoResults"));
      return Promise.resolve(false);
    }
    if (opts.navigate !== false) navigate("read");
    state.selectedSurah = id;
    state.selectedAyah = ayah;
    populateVerseSelectors();
    if (localVerse && opts.forceRemote !== true) {
      renderSelectedVerse(true);
      if (document.body.classList.contains("mushaf-view")) return loadMushafForCurrentVerse().then(function () { return true; });
      return Promise.resolve(true);
    }
    var requestId = ++quranSearchRequest;
    setVerseLoading(true);
    showToast(t("verseLoading"));
    var mushafId = state.mushafFont === "classic" ? 2 : 1;
    return window.fetch("/api/mushaf/locate/" + id + "/" + ayah, { headers: { "X-Requested-With": "QuranCompanion" } }).then(function (response) {
      if (!response.ok) throw new Error("quran-location-unavailable");
      return response.json();
    }).then(function (location) {
      return window.fetch("/api/mushaf/page/" + location.page + "?mushaf=" + mushafId, { headers: { "X-Requested-With": "QuranCompanion" } });
    }).then(function (response) {
      if (!response.ok) throw new Error("quran-page-unavailable");
      return response.json();
    }).then(function (data) {
      if (requestId !== quranSearchRequest) return false;
      var verseKey = id + ":" + ayah;
      var verseData = (data.verses || []).find(function (verse) { return verse.verse_key === verseKey; });
      if (!verseData) throw new Error("quran-verse-unavailable");
      mushafPageNumber = Number(data.page) || mushafPageNumber;
      mushafPageVerses = (data.verses || []).slice();
      heartCurrentPageData = data;
      heartPageCache[data.page] = data;
      getHeartPageVerseKeys(data).forEach(function (key) { heartVersePageCache[key] = Number(data.page); });
      var fontReady = document.body.classList.contains("mushaf-view") ? loadMushafFont(mushafPageNumber) : Promise.resolve(null);
      return fontReady.then(function (fontInfo) {
        if (requestId !== quranSearchRequest) return false;
        if (document.body.classList.contains("mushaf-view")) {
          var pageInput = document.getElementById("mushaf-page-number");
          if (pageInput) pageInput.value = String(mushafPageNumber);
          document.getElementById("mushaf-prev-page").disabled = mushafPageNumber <= 1;
          document.getElementById("mushaf-next-page").disabled = mushafPageNumber >= 604;
          renderMushafPage(data, fontInfo);
        }
        activateMushafVerse(verseData, true);
        state.selectedSurah = id;
        state.selectedAyah = ayah;
        populateVerseSelectors();
        saveState();
        return true;
      });
    }).catch(function () {
      if (requestId === quranSearchRequest) showToast(t("verseUnavailable"));
      return false;
    }).then(function (result) {
      if (requestId === quranSearchRequest) setVerseLoading(false);
      return result;
    });
  }

  function latinDigits(value) {
    return String(value || "").replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); });
  }

  function normalizeQuranQuery(value) {
    return latinDigits(value).toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "").replace(/[’'`]/g, "").replace(/[^a-zа-яё0-9\u0600-\u06ff:]+/gi, " ").trim();
  }

  function makeQuranResultButton(chapter) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "quran-search-result";
    button.setAttribute("data-quran-surah", String(chapter.id));
    var number = document.createElement("span");
    number.className = "quran-result-number";
    number.textContent = state.language === "ar" ? arabicNumber(chapter.id) : String(chapter.id);
    var copy = document.createElement("span");
    copy.className = "quran-result-copy";
    var title = document.createElement("strong");
    title.textContent = getChapterDisplayName(chapter);
    var meta = document.createElement("small");
    var pages = Array.isArray(chapter.pages) ? chapter.pages.join("–") : "";
    meta.textContent = formatMetric(chapter.verses_count) + " " + t("surahVerses") + (pages ? " · " + t("pagesLabel") + " " + pages : "");
    copy.appendChild(title);
    copy.appendChild(meta);
    var arabic = document.createElement("span");
    arabic.className = "quran-result-arabic";
    arabic.lang = "ar";
    arabic.dir = "rtl";
    arabic.textContent = chapter.name_arabic || "";
    button.appendChild(number);
    button.appendChild(copy);
    button.appendChild(arabic);
    button.appendChild(createSvgIcon("i-chevron"));
    return button;
  }

  function makeQuranDirectResult(kind, primary, secondary, value) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "quran-search-result is-direct";
    button.setAttribute(kind === "page" ? "data-quran-page" : "data-quran-reference", value);
    button.appendChild(createSvgIcon(kind === "page" ? "i-book" : "i-arrow"));
    var copy = document.createElement("span");
    copy.className = "quran-result-copy";
    var title = document.createElement("strong");
    title.textContent = primary;
    var meta = document.createElement("small");
    meta.textContent = secondary;
    copy.appendChild(title);
    copy.appendChild(meta);
    button.appendChild(copy);
    button.appendChild(createSvgIcon("i-chevron"));
    return button;
  }

  function renderQuranSearchResults(query) {
    var container = document.getElementById("quran-search-results");
    var status = document.getElementById("quran-search-status");
    if (!container || !status) return;
    container.textContent = "";
    if (!quranCatalogReady) {
      status.textContent = t("searchLoading");
      return;
    }
    var raw = latinDigits(query || "").trim();
    var normalized = normalizeQuranQuery(raw);
    var chapters = getCatalogChapters();
    var referenceMatch = raw.match(/^\s*(\d{1,3})\s*[:.,،]\s*(\d{1,3})\s*$/);
    var pageMatch = raw.match(/(?:^|\s)(?:стр(?:аница)?|page|p|صفحة)?\s*(\d{1,3})\s*$/i);
    var explicitPage = /(?:стр|page|صفحة)/i.test(raw) || (pageMatch && Number(pageMatch[1]) > 114);
    var directCount = 0;
    if (referenceMatch) {
      var directChapter = mushafChapterNames[Number(referenceMatch[1])];
      var directAyah = Number(referenceMatch[2]);
      if (directChapter && directAyah >= 1 && directAyah <= directChapter.verses_count) {
        var directNames = getChapterNames(directChapter, getLocalSurahExact(directChapter.id));
        container.appendChild(makeQuranDirectResult("verse", t("searchDirectVerse") + " " + directChapter.id + ":" + directAyah, directNames[state.language] + " · " + directChapter.name_arabic, directChapter.id + ":" + directAyah));
        directCount += 1;
      }
    }
    if (pageMatch && explicitPage && Number(pageMatch[1]) >= 1 && Number(pageMatch[1]) <= 604) {
      var pageNumber = Number(pageMatch[1]);
      container.appendChild(makeQuranDirectResult("page", t("searchMushafPage") + " " + formatMetric(pageNumber), t("completeQuran"), String(pageNumber)));
      directCount += 1;
    }
    var filtered = chapters.filter(function (chapter) {
      if (!normalized || referenceMatch || explicitPage) return !referenceMatch && !explicitPage;
      var names = getChapterNames(chapter, getLocalSurahExact(chapter.id));
      var translated = chapter.translated_name && chapter.translated_name.name || "";
      var haystack = normalizeQuranQuery([chapter.id, names.ru, names.en, names.ar, chapter.name_simple, chapter.name_complex, translated].join(" "));
      return haystack.indexOf(normalized) >= 0;
    });
    filtered.forEach(function (chapter) { container.appendChild(makeQuranResultButton(chapter)); });
    var total = directCount + filtered.length;
    status.textContent = !raw ? t("allSurahs") : (total ? formatMetric(total) + " · " + raw : t("searchNoResults"));
  }

  function openQuranSearch() {
    var dialog = document.getElementById("quran-search-dialog");
    var input = document.getElementById("quran-search-input");
    if (!dialog || !input) return;
    if (!dialog.open) dialog.showModal();
    renderQuranSearchResults(input.value);
    loadMushafChapterNames().then(function () {
      populateVerseSelectors();
      renderQuranSearchResults(input.value);
      window.setTimeout(function () { input.focus(); }, 20);
    });
  }

  function updateInterlinearUi() {
    var button = document.getElementById("interlinear-toggle");
    var note = document.getElementById("interlinear-note");
    var status = document.getElementById("interlinear-status");
    var key = currentSurah && currentVerse ? getVerseKey(currentSurah, currentVerse) : "";
    var payload = key ? (interlinearWordCache[key] || getLocalInterlinearPayload(key, splitVerseWords(currentVerse.text))) : null;
    document.body.classList.toggle("show-interlinear", state.showInterlinear);
    if (button) {
      button.classList.toggle("is-active", state.showInterlinear);
      button.setAttribute("aria-pressed", String(state.showInterlinear));
    }
    if (note) note.hidden = !state.showInterlinear;
    if (status) {
      var statusClass = "is-idle";
      var statusKey = "interlinearIdle";
      if (state.showInterlinear && interlinearPending[key]) {
        statusClass = "is-loading";
        statusKey = "interlinearLoading";
      } else if (state.showInterlinear && payload && Array.isArray(payload.words)) {
        var total = payload.words.length;
        var targetField = state.language === "ru" ? "gloss_ru" : (state.language === "en" ? "gloss_en" : "gloss_ar");
        var targetCoverage = payload.words.filter(function (word) { return Boolean(word && word[targetField]); }).length;
        var englishCoverage = payload.words.filter(function (word) { return Boolean(word && word.gloss_en); }).length;
        if (total > 0 && targetCoverage === total) {
          statusClass = "is-ready";
          statusKey = "interlinearReady";
        } else if (total > 0 && state.language !== "en" && englishCoverage === total) {
          statusClass = "is-partial";
          statusKey = "interlinearEnglishReady";
        } else if (targetCoverage > 0 || englishCoverage > 0) {
          statusClass = "is-partial";
          statusKey = "interlinearPartial";
        } else if (state.showInterlinear) {
          statusClass = "is-error";
          statusKey = "interlinearUnavailable";
        }
      } else if (state.showInterlinear) {
        statusClass = "is-loading";
        statusKey = "interlinearLoading";
      }
      status.className = "interlinear-status " + statusClass;
      status.textContent = t(statusKey);
    }
  }

  function getLocalInterlinearPayload(key, displayWords) {
    if (key === "2:2") {
      return {
        verse_key: key,
        source: "ALLIM reviewed layer",
        words: displayWords.map(function (token, index) {
          var word = analysisWords[index];
          return word ? {
            position: index + 1,
            arabic: token,
            transliteration: word.translit,
            gloss_ru: word.meaning.ru,
            gloss_en: word.meaning.en,
            gloss_ar: word.meaning.ar,
            reviewed_ru: true
          } : null;
        }).filter(Boolean)
      };
    }
    var reviewed = reviewedRussianInterlinear[key];
    if (!reviewed) return null;
    return {
      verse_key: key,
      source: "ALLIM reviewed layer",
      words: displayWords.map(function (token, index) {
        var word = reviewed[index] || {};
        return {
          position: index + 1,
          arabic: token,
          transliteration: word.translit || "",
          gloss_ru: word.ru || "",
          gloss_en: word.en || "",
          gloss_ar: "",
          reviewed_ru: true
        };
      })
    };
  }

  function mergeInterlinearPayload(payload, localPayload) {
    if (!payload || !Array.isArray(payload.words)) return localPayload;
    var localWords = localPayload && Array.isArray(localPayload.words) ? localPayload.words : [];
    payload.words = payload.words.map(function (word, index) {
      var localWord = localWords[index] || {};
      return Object.assign({}, word, {
        gloss_ru: word.gloss_ru || localWord.gloss_ru || "",
        reviewed_ru: Boolean(word.reviewed_ru || localWord.reviewed_ru)
      });
    });
    return payload;
  }

  function makeCurrentWords(verse, surah) {
    var displayWords = splitVerseWords(verse ? verse.text : "");
    var isDetailedVerse = surah && verse && surah.id === 2 && verse.ayah === 2;
    var key = surah && verse ? getVerseKey(surah, verse) : "";
    var payload = interlinearWordCache[key] || getLocalInterlinearPayload(key, displayWords);
    var payloadWords = payload && Array.isArray(payload.words) ? payload.words : [];
    return displayWords.map(function (token, index) {
      var base = isDetailedVerse && analysisWords[index] ? Object.assign({}, analysisWords[index]) : {
        ar: token,
        translit: "—",
        root: "—",
        hasVerifiedGloss: false,
        meaning: { ru: t("glossPending"), en: t("glossPending"), ar: t("glossPending") },
        grammar: {
          ru: t("detailedAnalysisPending"),
          en: t("detailedAnalysisPending"),
          ar: t("detailedAnalysisPending")
        }
      };
      var remoteWord = payloadWords[index];
      if (!remoteWord) return Object.assign(base, { ar: token, hasVerifiedGloss: isDetailedVerse && Boolean(analysisWords[index]), glossLanguage: state.language });
      var glossRu = remoteWord.gloss_ru || (base.meaning && base.meaning.ru !== t("glossPending") ? base.meaning.ru : "");
      var glossEn = remoteWord.gloss_en || (base.meaning && base.meaning.en !== t("glossPending") ? base.meaning.en : "");
      var glossAr = remoteWord.gloss_ar || (base.meaning && base.meaning.ar !== t("glossPending") ? base.meaning.ar : "");
      var preferred = state.language === "ru" ? glossRu : (state.language === "en" ? glossEn : glossAr);
      var fallback = preferred || glossEn || glossRu || t("glossPending");
      base.ar = token;
      base.translit = remoteWord.transliteration || base.translit || "—";
      base.meaning = { ru: glossRu || glossEn || t("glossPending"), en: glossEn || glossRu || t("glossPending"), ar: glossAr || glossEn || t("glossPending") };
      base.hasVerifiedGloss = fallback !== t("glossPending");
      base.glossLanguage = preferred ? state.language : (glossEn ? "en" : (glossRu ? "ru" : state.language));
      base.reviewedRussian = Boolean(remoteWord.reviewed_ru);
      return base;
    });
  }

  function renderCurrentVerseWords(ayahNumber) {
    var ayahText = document.getElementById("ayah-text");
    if (!ayahText) return;
    ayahText.textContent = "";
    ayahText.setAttribute("aria-label", getVerseLabel(currentSurah, currentVerse));
    currentWords.forEach(function (word, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "quran-word" + (index === selectedWordIndex ? " is-selected" : "") + (word.hasVerifiedGloss ? " has-gloss" : " has-no-gloss");
      var arabic = document.createElement("span");
      arabic.className = "quran-word-ar";
      arabic.textContent = word.ar;
      var translit = document.createElement("small");
      translit.className = "quran-word-translit";
      translit.lang = "en";
      translit.dir = "ltr";
      translit.textContent = word.translit && word.translit !== "—" ? word.translit : "";
      var gloss = document.createElement("small");
      gloss.className = "quran-word-gloss";
      gloss.lang = word.glossLanguage || state.language;
      gloss.dir = gloss.lang === "ar" ? "rtl" : "ltr";
      gloss.textContent = word.meaning[state.language] || t("glossPending");
      button.appendChild(arabic);
      button.appendChild(translit);
      button.appendChild(gloss);
      button.setAttribute("aria-label", word.ar + (state.showInterlinear && word.hasVerifiedGloss ? " — " + gloss.textContent : ""));
      button.setAttribute("data-word", String(index));
      button.addEventListener("click", function () { updateWord(index, true); });
      ayahText.appendChild(button);
    });
    var marker = document.createElement("span");
    marker.className = "ayah-number";
    marker.textContent = arabicNumber(ayahNumber == null ? currentVerse.ayah : ayahNumber);
    marker.setAttribute("aria-label", getVerseLabel(currentSurah, currentVerse));
    ayahText.appendChild(marker);
  }

  function ensureInterlinearWords() {
    if (!state.showInterlinear || !currentSurah || !currentVerse || !window.fetch) return Promise.resolve(null);
    var key = getVerseKey(currentSurah, currentVerse);
    if (interlinearWordCache[key]) {
      updateInterlinearUi();
      return Promise.resolve(interlinearWordCache[key]);
    }
    if (interlinearPending[key]) return interlinearPending[key];
    var displayWords = splitVerseWords(currentVerse.text);
    var localPayload = getLocalInterlinearPayload(key, displayWords);
    if (window.location.protocol === "file:") {
      if (localPayload) interlinearWordCache[key] = localPayload;
      updateInterlinearUi();
      return Promise.resolve(localPayload);
    }
    var requestId = ++interlinearRequestId;
    updateInterlinearUi();
    interlinearPending[key] = window.fetch("/api/quran/words/" + currentSurah.id + "/" + currentVerse.ayah, {
      cache: "force-cache",
      headers: { "X-Requested-With": "QuranCompanion" }
    }).then(function (response) {
      if (!response.ok) throw new Error("interlinear-unavailable");
      return response.json();
    }).then(function (payload) {
      var merged = mergeInterlinearPayload(payload, localPayload);
      if (!merged || !Array.isArray(merged.words) || !merged.words.length) throw new Error("interlinear-empty");
      interlinearWordCache[key] = merged;
      if (requestId === interlinearRequestId && currentSurah && currentVerse && getVerseKey(currentSurah, currentVerse) === key) {
        currentWords = makeCurrentWords(currentVerse, currentSurah);
        renderCurrentVerseWords(currentVerse.ayah);
        updateMatchIndicator(lastMatchedCount);
        updateWord(Math.min(selectedWordIndex, currentWords.length - 1), false);
      }
      return merged;
    }).catch(function () {
      if (localPayload) interlinearWordCache[key] = localPayload;
      return localPayload;
    }).then(function (payload) {
      delete interlinearPending[key];
      updateInterlinearUi();
      return payload;
    });
    updateInterlinearUi();
    return interlinearPending[key];
  }

  function populateVerseSelectors() {
    var surahSelect = document.getElementById("surah-select");
    var ayahSelect = document.getElementById("ayah-select");
    if (!surahSelect || !ayahSelect || !corpus.length) return;
    var chapters = getCatalogChapters();
    var usingCatalog = quranCatalogReady && chapters.length === 114;
    surahSelect.textContent = "";
    (usingCatalog ? chapters : corpus).forEach(function (item) {
      var surah = usingCatalog ? getLocalSurahExact(item.id) : item;
      var names = usingCatalog ? getChapterNames(item, surah) : surah.names;
      var option = document.createElement("option");
      option.value = String(item.id);
      option.textContent = item.id + ". " + (names[state.language] || names.en);
      surahSelect.appendChild(option);
    });
    var selectedChapter = usingCatalog ? mushafChapterNames[state.selectedSurah] : null;
    var selectedLocalSurah = getLocalSurahExact(state.selectedSurah);
    if (!selectedChapter && !selectedLocalSurah) {
      state.selectedSurah = usingCatalog ? chapters[0].id : corpus[0].id;
      selectedChapter = usingCatalog ? mushafChapterNames[state.selectedSurah] : null;
      selectedLocalSurah = getLocalSurahExact(state.selectedSurah);
    }
    surahSelect.value = String(state.selectedSurah);
    ayahSelect.textContent = "";
    var ayahNumbers = [];
    if (selectedChapter) {
      for (var ayahNumber = 1; ayahNumber <= Number(selectedChapter.verses_count); ayahNumber += 1) ayahNumbers.push(ayahNumber);
    } else if (selectedLocalSurah) {
      ayahNumbers = selectedLocalSurah.verses.map(function (verse) { return verse.ayah; });
    }
    if (ayahNumbers.indexOf(Number(state.selectedAyah)) < 0) state.selectedAyah = ayahNumbers[0] || 1;
    ayahNumbers.forEach(function (ayahNumber) {
      var option = document.createElement("option");
      option.value = String(ayahNumber);
      option.textContent = state.language === "ar" ? "الآية " + arabicNumber(ayahNumber) : (state.language === "en" ? "Verse " + ayahNumber : "Аят " + ayahNumber);
      ayahSelect.appendChild(option);
    });
    ayahSelect.value = String(state.selectedAyah);
  }

  function renderSelectedVerse(resetRecognition) {
    if (!corpus.length) return;
    if (resetRecognition !== false) clearAutoAdvance();
    stopVerseAudio(false);
    mushafSelectedVerseKey = "";
    var localSurah = getLocalSurahExact(state.selectedSurah);
    var localVerse = getLocalVerseExact(localSurah, state.selectedAyah);
    if (localSurah && localVerse) {
      currentSurah = localSurah;
      currentVerse = localVerse;
    } else if (currentSurah && currentVerse && currentSurah.id === Number(state.selectedSurah) && currentVerse.ayah === Number(state.selectedAyah)) {
      currentSurah.names = getChapterNames(mushafChapterNames[currentSurah.id], localSurah);
      mushafSelectedVerseKey = currentSurah.id + ":" + currentVerse.ayah;
    } else if (quranCatalogReady) {
      selectVerseByReference(state.selectedSurah, state.selectedAyah, { navigate: false, forceRemote: true });
      return;
    }
    if (!currentSurah || !currentVerse) return;
    state.selectedSurah = currentSurah.id;
    state.selectedAyah = currentVerse.ayah;
    currentWords = makeCurrentWords(currentVerse, currentSurah);
    selectedWordIndex = 0;
    renderCurrentVerseWords(currentVerse.ayah);
    document.getElementById("verse-reference").textContent = currentSurah.id + ":" + currentVerse.ayah;
    renderCurrentMeaning();
    updateInterlinearUi();
    updatePassageHeader();
    updateMatchIndicator(resetRecognition === false ? lastMatchedCount : 0);
    updateReadingSummary(resetRecognition === false ? lastAlignment : null, resetRecognition === false ? lastAlignmentFinal : false);
    updateWord(0, false);
    updateAiMentor("intro");
    updateNextButton();
    updateVerseActions();
    renderHeartReadCounter();
    renderMemoryVerse();
    renderTafsir();
    if (resetRecognition !== false) resetRecognitionView();
    saveState();
    loadHeartPageContextForCurrentVerse().catch(function () { return null; });
    ensureInterlinearWords();
    ensureVerifiedVerseTranslation();
  }

  function updateWord(index, revealPanel) {
    var word = currentWords[index] || currentWords[0];
    if (!word) return;
    selectedWordIndex = Math.max(0, Math.min(Number(index) || 0, currentWords.length - 1));
    document.querySelectorAll(".quran-word").forEach(function (item) {
      item.classList.toggle("is-selected", Number(item.getAttribute("data-word")) === index);
    });
    document.getElementById("selected-word").textContent = word.ar;
    document.getElementById("word-translit").textContent = word.translit;
    document.getElementById("word-meaning").textContent = word.meaning[state.language];
    document.getElementById("word-root").textContent = word.root;
    document.getElementById("word-grammar").textContent = word.grammar[state.language];
    updateAiMentor("word");
    if (revealPanel) selectSidePanelTab("word");
  }

  function buildWordMap() {
    var map = document.getElementById("word-map");
    map.textContent = "";
    analysisWords.forEach(function (word, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "map-word" + (index === 0 ? " is-active" : "");
      button.textContent = word.ar;
      button.setAttribute("data-map-index", String(index));
      button.addEventListener("click", function () {
        document.querySelectorAll(".map-word").forEach(function (item) { item.classList.remove("is-active"); });
        button.classList.add("is-active");
        renderLearningDetail(index);
      });
      map.appendChild(button);
    });
    renderLearningDetail(0);
  }

  function getActiveMapIndex() {
    var active = document.querySelector(".map-word.is-active");
    return active ? Number(active.getAttribute("data-map-index")) : 0;
  }

  function renderLearningDetail(index) {
    var word = analysisWords[index] || analysisWords[0];
    var detail = document.getElementById("learning-detail");
    if (!detail) return;
    detail.textContent = "";
    var top = document.createElement("div");
    top.className = "detail-top";
    var arabic = document.createElement("span");
    arabic.className = "arabic";
    arabic.lang = "ar";
    arabic.dir = "rtl";
    arabic.textContent = word.ar;
    var root = document.createElement("span");
    root.className = "detail-root";
    root.textContent = t("root") + ": " + word.root;
    top.appendChild(arabic);
    top.appendChild(root);
    var meaning = document.createElement("p");
    var strong = document.createElement("strong");
    strong.textContent = word.meaning[state.language] + ". ";
    meaning.appendChild(strong);
    meaning.appendChild(document.createTextNode(word.grammar[state.language]));
    detail.appendChild(top);
    detail.appendChild(meaning);
  }

  function setMeaningVisibility(show) {
    state.showMeaning = Boolean(show);
    renderCurrentMeaning();
    document.getElementById("meaning-toggle").checked = state.showMeaning;
    document.getElementById("toggle-translation").setAttribute("aria-pressed", String(state.showMeaning));
    saveState();
  }

  function normalizeArabic(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
      .replace(/\u0640/g, "")
      .replace(/[ٱأإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ءا/g, "ا")
      .replace(/[^\u0621-\u063A\u0641-\u064A\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function firstArabicCluster(value) {
    var compact = String(value || "").normalize("NFC").replace(/^[^\u0621-\u063A\u0641-\u064A]+/, "");
    if (!compact) return "";
    var end = 1;
    while (end < compact.length && !/[\u0621-\u063A\u0641-\u064A]/.test(compact.charAt(end))) end += 1;
    return compact.slice(0, end);
  }

  function lastArabicCluster(value) {
    var compact = String(value || "").normalize("NFC").replace(/[^\u0621-\u063A\u0641-\u064A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
    if (!compact) return "";
    var start = compact.length - 1;
    while (start >= 0 && !/[\u0621-\u063A\u0641-\u064A]/.test(compact.charAt(start))) start -= 1;
    return start >= 0 ? compact.slice(start) : "";
  }

  function idghamJoinVariants(leftWord, rightWord) {
    var leftRaw = typeof leftWord === "string" ? leftWord : leftWord && leftWord.ar;
    var rightRaw = typeof rightWord === "string" ? rightWord : rightWord && rightWord.ar;
    var left = normalizeArabic(leftRaw);
    var right = normalizeArabic(rightRaw);
    if (!left || !right) return [];
    var leftCluster = lastArabicCluster(leftRaw);
    var rightCluster = firstArabicCluster(rightRaw);
    var rightLetter = normalizeArabic(rightCluster).charAt(0);
    var hasTanween = /[\u064B-\u064D]/.test(leftCluster);
    var hasAssimilatedNun = left.endsWith("ن") && !/[\u064E-\u0650\u0652]/.test(leftCluster);
    if (!(hasTanween || hasAssimilatedNun) || "يرملون".indexOf(rightLetter) < 0) return [];
    var spokenLeft = hasAssimilatedNun ? left.slice(0, -1) : left;
    return [spokenLeft + right, left + right].filter(function (variant, index, variants) {
      return variant && variants.indexOf(variant) === index;
    });
  }

  function idghamJoinSimilarity(leftWord, rightWord, heardWord) {
    return idghamJoinVariants(leftWord, rightWord).reduce(function (best, variant) {
      return Math.max(best, wordSimilarity(variant, heardWord));
    }, 0);
  }

  function idghamJoinThreshold() {
    return Math.max(0.8, recognitionMatchThreshold());
  }

  function levenshtein(left, right) {
    var a = String(left || "");
    var b = String(right || "");
    var previous = Array.from({ length: b.length + 1 }, function (_, index) { return index; });
    for (var i = 1; i <= a.length; i += 1) {
      var current = [i];
      for (var j = 1; j <= b.length; j += 1) {
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      previous = current;
    }
    return previous[b.length];
  }

  function wordSimilarity(left, right) {
    var a = normalizeArabic(left);
    var b = normalizeArabic(right);
    if (!a || !b) return 0;
    return 1 - (levenshtein(a, b) / Math.max(a.length, b.length));
  }

  function recognitionMatchThreshold() {
    return getEffectiveRecognitionMode() === "quran" ? 0.8 : 0.72;
  }

  function alignExpectedWords(expectedWords, transcript, isFinal) {
    var expected = expectedWords.map(function (word) {
      return normalizeArabic(typeof word === "string" ? word : word.ar);
    });
    var heard = normalizeArabic(transcript).split(/\s+/).filter(Boolean);
    var rows = expected.length + 1;
    var columns = heard.length + 1;
    var costs = Array.from({ length: rows }, function () { return Array(columns).fill(0); });
    var moves = Array.from({ length: rows }, function () { return Array(columns).fill(""); });
    var i;
    var j;
    for (i = 1; i < rows; i += 1) {
      costs[i][0] = i;
      moves[i][0] = "delete";
    }
    for (j = 1; j < columns; j += 1) {
      costs[0][j] = j;
      moves[0][j] = "insert";
    }
    for (i = 1; i < rows; i += 1) {
      for (j = 1; j < columns; j += 1) {
        var similarity = wordSimilarity(expected[i - 1], heard[j - 1]);
        var substitutionCost = similarity >= 0.88 ? 0 : (similarity >= 0.58 ? 0.45 : 1);
        var substitute = costs[i - 1][j - 1] + substitutionCost;
        var remove = costs[i - 1][j] + 1;
        var insert = costs[i][j - 1] + 1;
        var best = Math.min(substitute, remove, insert);
        costs[i][j] = best;
        moves[i][j] = best === substitute ? "substitute" : (best === remove ? "delete" : "insert");
        if (i >= 2) {
          var joinedSimilarity = idghamJoinSimilarity(expectedWords[i - 2], expectedWords[i - 1], heard[j - 1]);
          if (joinedSimilarity >= idghamJoinThreshold()) {
            var joinedCost = joinedSimilarity >= 0.88 ? 0 : 0.45;
            var joined = costs[i - 2][j - 1] + joinedCost;
            if (joined < costs[i][j]) {
              costs[i][j] = joined;
              moves[i][j] = "idgham-join";
            }
          }
        }
      }
    }
    var statuses = Array(expected.length).fill("pending");
    var extras = 0;
    i = expected.length;
    j = heard.length;
    while (i > 0 || j > 0) {
      var move = moves[i][j];
      if (i >= 2 && j > 0 && move === "idgham-join") {
        var joinedScore = idghamJoinSimilarity(expectedWords[i - 2], expectedWords[i - 1], heard[j - 1]);
        var joinedStatus = joinedScore >= idghamJoinThreshold() ? "recognized" : "warning";
        statuses[i - 2] = joinedStatus;
        statuses[i - 1] = joinedStatus;
        i -= 2;
        j -= 1;
      } else if (i > 0 && j > 0 && move === "substitute") {
        var score = wordSimilarity(expected[i - 1], heard[j - 1]);
        statuses[i - 1] = score >= recognitionMatchThreshold() ? "recognized" : "warning";
        i -= 1;
        j -= 1;
      } else if (i > 0 && (move === "delete" || j === 0)) {
        statuses[i - 1] = isFinal ? "error" : "pending";
        i -= 1;
      } else {
        extras += 1;
        j -= 1;
      }
    }
    return {
      statuses: statuses,
      matched: statuses.filter(function (status) { return status === "recognized"; }).length,
      warnings: statuses.filter(function (status) { return status === "warning"; }).length,
      errors: statuses.filter(function (status) { return status === "error"; }).length,
      extras: extras,
      score: (statuses.filter(function (status) { return status === "recognized"; }).length * 4) +
        (statuses.filter(function (status) { return status === "warning"; }).length * 1.5) -
        (statuses.filter(function (status) { return status === "error"; }).length * .5) -
        (Math.max(0, heard.length - expected.length) * .25),
      complete: statuses.length > 0 && statuses.every(function (status) { return status === "recognized"; })
    };
  }

  function alignRecognizedWords(transcript, isFinal) {
    return alignExpectedWords(currentWords, transcript, isFinal);
  }

  function chooseBestTranscript(event, expectedWords) {
    var targetWords = expectedWords && expectedWords.length ? expectedWords : currentWords;
    var candidates = [{ text: "", confidence: 0 }];
    var finalResult = true;
    for (var resultIndex = 0; resultIndex < event.results.length; resultIndex += 1) {
      var result = event.results[resultIndex];
      if (!result.isFinal) finalResult = false;
      var alternatives = [];
      for (var alternativeIndex = 0; alternativeIndex < Math.min(result.length, 5); alternativeIndex += 1) {
        alternatives.push({
          text: result[alternativeIndex].transcript,
          confidence: Number(result[alternativeIndex].confidence || 0)
        });
      }
      if (!alternatives.length) alternatives.push({ text: "", confidence: 0 });
      var expanded = [];
      candidates.forEach(function (candidate) {
        alternatives.forEach(function (alternative) {
          var text = (candidate.text + " " + alternative.text).trim();
          var alignment = alignExpectedWords(targetWords, text, finalResult);
          expanded.push({
            text: text,
            confidence: candidate.confidence + alternative.confidence,
            rank: alignment.score + ((candidate.confidence + alternative.confidence) * .05)
          });
        });
      });
      expanded.sort(function (left, right) { return right.rank - left.rank; });
      candidates = expanded.slice(0, 8);
    }
    return { transcript: candidates.length ? candidates[0].text : "", isFinal: finalResult };
  }

  function setRecognitionButton(listening) {
    var labelKey = listening ? "stopListening" : (recognitionStartPending ? "cancelMicRequest" : "startListening");
    var label = t(labelKey);
    ["start-recognition", "page-recall-mic", "mobile-recognition-toggle"].forEach(function (id) {
      var button = document.getElementById(id);
      if (!button) return;
      var text = button.querySelector("span");
      if (text) text.textContent = label;
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", String(listening));
      button.classList.toggle("is-requesting", recognitionStartPending);
      button.classList.toggle("is-listening", listening);
      var icon = button.querySelector("use");
      if (icon) icon.setAttribute("href", listening || recognitionStartPending ? "#i-stop" : "#i-mic");
    });
  }

  function setRecognitionControlsDisabled(disabled) {
    ["start-recognition", "page-recall-mic", "mobile-recognition-toggle"].forEach(function (id) {
      var button = document.getElementById(id);
      if (button) button.disabled = Boolean(disabled);
    });
  }

  function clearRecognitionStartTimer() {
    if (recognitionStartTimer) window.clearTimeout(recognitionStartTimer);
    recognitionStartTimer = null;
  }

  function finishRecognitionStart(requestId) {
    if (requestId && requestId !== recognitionRequestId) return false;
    clearRecognitionStartTimer();
    recognitionStartPending = false;
    var panel = document.getElementById("recitation-panel");
    panel.classList.remove("is-requesting");
    panel.setAttribute("aria-busy", "false");
    setRecognitionButton(isListening);
    return true;
  }

  function cancelRecognitionStart(showCancelled) {
    if (!recognitionStartPending) return false;
    recognitionRequestId += 1;
    clearRecognitionStartTimer();
    recognitionStartPending = false;
    var pendingRecognition = recognition;
    recognition = null;
    if (pendingRecognition) {
      try { pendingRecognition.abort(); } catch (error) { /* no-op */ }
    }
    stopAudioMeter();
    stopContinuousSession();
    var panel = document.getElementById("recitation-panel");
    panel.classList.remove("is-requesting", "is-listening");
    panel.setAttribute("aria-busy", "false");
    setRecognitionControlsDisabled(false);
    setRecognitionButton(false);
    if (showCancelled !== false) setRecognitionStatus("micRequestCancelled", "micRequestCancelledSub", false);
    return true;
  }

  function beginRecognitionStart() {
    clearRecognitionStartTimer();
    recognitionRequestId += 1;
    var requestId = recognitionRequestId;
    recognitionStartPending = true;
    var panel = document.getElementById("recitation-panel");
    panel.classList.add("is-requesting");
    panel.setAttribute("aria-busy", "true");
    setRecognitionControlsDisabled(false);
    setRecognitionStatus("requestingMic", "requestingMicSub", false);
    setRecognitionButton(false);
    recognitionStartTimer = window.setTimeout(function () {
      if (!recognitionStartPending || requestId !== recognitionRequestId) return;
      var pendingRecognition = recognition;
      recognition = null;
      finishRecognitionStart(requestId);
      recognitionRequestId += 1;
      if (pendingRecognition) {
        try { pendingRecognition.abort(); } catch (error) { /* no-op */ }
      }
      stopAudioMeter();
      stopContinuousSession();
      setRecognitionControlsDisabled(false);
      setRecognitionStatus("micRequestTimeout", "micRequestTimeoutSub", true);
      setRecognitionButton(false);
    }, MIC_REQUEST_TIMEOUT);
    return requestId;
  }

  function setRecognitionStatus(titleKey, subtitleKey, hasError) {
    var panel = document.getElementById("recitation-panel");
    var transcriptPanel = document.getElementById("live-transcript");
    recognitionTitleKey = titleKey;
    recognitionSubtitleKey = subtitleKey;
    recognitionStatusHasError = Boolean(hasError);
    document.getElementById("recitation-title").textContent = t(titleKey);
    document.getElementById("recitation-subtitle").textContent = t(subtitleKey);
    if (pageRecallSession) {
      var pageRecallTitle = document.getElementById("page-recall-dock-title");
      if (pageRecallTitle) pageRecallTitle.textContent = t(titleKey);
    }
    panel.classList.toggle("has-error", Boolean(hasError));
    transcriptPanel.classList.toggle("has-error", Boolean(hasError));
  }

  function stopAudioMeter() {
    stopQuranVad();
    if (micMeterFrame) window.cancelAnimationFrame(micMeterFrame);
    micMeterFrame = null;
    micAnalyser = null;
    if (micStream) {
      micStream.getTracks().forEach(function (track) { track.stop(); });
      micStream = null;
    }
    if (micAudioContext) {
      micAudioContext.close().catch(function () { return null; });
      micAudioContext = null;
    }
    var level = document.getElementById("mic-level");
    if (level) {
      level.style.opacity = "0";
      level.style.transform = "scale(.72)";
    }
  }

  function stopQuranVad() {
    if (quranVadFrame) window.cancelAnimationFrame(quranVadFrame);
    quranVadFrame = null;
    quranVadStartedAt = 0;
    quranVadLastVoiceAt = 0;
    quranVadSpeechDetected = false;
  }

  function startQuranVad(recorder) {
    stopQuranVad();
    quranVadStartedAt = Date.now();
    function inspectSilence() {
      if (recorder !== quranRecorder || recorder.state === "inactive") {
        stopQuranVad();
        return;
      }
      var now = Date.now();
      var elapsed = now - quranVadStartedAt;
      if (micAnalyser) {
        var values = new Uint8Array(micAnalyser.fftSize);
        micAnalyser.getByteTimeDomainData(values);
        var sum = 0;
        for (var index = 0; index < values.length; index += 1) {
          var sample = (values[index] - 128) / 128;
          sum += sample * sample;
        }
        var rms = Math.sqrt(sum / Math.max(values.length, 1));
        if (elapsed > 420 && rms >= .026) {
          quranVadSpeechDetected = true;
          quranVadLastVoiceAt = now;
        }
      }
      if (quranVadSpeechDetected && now - quranVadLastVoiceAt >= 950 && elapsed >= 1250) {
        try { recorder.stop(); } catch (error) { handleRecognitionError("audio-capture"); }
        return;
      }
      if (!quranVadSpeechDetected && elapsed >= 10000) {
        recorder._noSpeech = true;
        try { recorder.stop(); } catch (error) { handleRecognitionError("audio-capture"); }
        return;
      }
      if (elapsed >= 55000) {
        try { recorder.stop(); } catch (error) { handleRecognitionError("audio-capture"); }
        return;
      }
      quranVadFrame = window.requestAnimationFrame(inspectSilence);
    }
    quranVadFrame = window.requestAnimationFrame(inspectSilence);
  }

  function drawAudioMeter() {
    if (!micAnalyser) return;
    var values = new Uint8Array(micAnalyser.fftSize);
    micAnalyser.getByteTimeDomainData(values);
    var sum = 0;
    values.forEach(function (value) {
      var sample = (value - 128) / 128;
      sum += sample * sample;
    });
    var rms = Math.sqrt(sum / values.length);
    var visibleLevel = Math.min(1, rms * 7);
    var level = document.getElementById("mic-level");
    if (level) {
      level.style.opacity = String(.12 + (visibleLevel * .7));
      level.style.transform = "scale(" + (.78 + (visibleLevel * .42)) + ")";
    }
    micMeterFrame = window.requestAnimationFrame(drawAudioMeter);
  }

  function startAudioMeter(requestId) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject({ name: "NotSupportedError" });
    return navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (stream) {
      if (requestId && (requestId !== recognitionRequestId || !recognitionStartPending)) {
        stream.getTracks().forEach(function (track) { track.stop(); });
        return false;
      }
      micStream = stream;
      var AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) return true;
      micAudioContext = new AudioContextConstructor();
      var source = micAudioContext.createMediaStreamSource(stream);
      micAnalyser = micAudioContext.createAnalyser();
      micAnalyser.fftSize = 256;
      micAnalyser.smoothingTimeConstant = .72;
      source.connect(micAnalyser);
      return micAudioContext.resume().catch(function () { return null; }).then(function () {
        drawAudioMeter();
        return true;
      });
    });
  }

  function getQuranRecorderOptions() {
    var candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
    for (var index = 0; index < candidates.length; index += 1) {
      if (window.MediaRecorder.isTypeSupported(candidates[index])) return { mimeType: candidates[index] };
    }
    return {};
  }

  function submitQuranAudio(blob, mimeType) {
    var form = new FormData();
    var extension = mimeType.indexOf("mp4") >= 0 ? "m4a" : "webm";
    var alignmentResult = null;
    var controller = new window.AbortController();
    if (quranSubmitController) quranSubmitController.abort();
    quranSubmitController = controller;
    quranSubmitting = true;
    clearContinuousRestart();
    form.append("audio", blob, "recitation." + extension);
    form.append("verse_key", currentSurah.id + ":" + currentVerse.ayah);
    setRecognitionStatus("quranProcessing", "quranProcessingSub", false);
    document.getElementById("recognition-engine").textContent = t("quranRecognition");
    setRecognitionControlsDisabled(false);
    setRecognitionButton(true);
    return window.fetch("/api/quran-asr", {
      method: "POST",
      body: form,
      signal: controller.signal,
      headers: { "X-Requested-With": "QuranCompanion" }
    }).then(function (response) {
      if (!response.ok) throw new Error("quran-asr-unavailable");
      return response.json();
    }).then(function (data) {
      var transcript = data && data.transcript ? String(data.transcript) : "";
      if (!transcript.trim()) {
        continuousFailureCount += 1;
        handleRecognitionError("no-speech");
        return;
      }
      continuousFailureCount = 0;
      alignmentResult = correctionLocked ? applyCorrectionTranscript(transcript, true) : applyTranscript(transcript, true);
      recordRecognitionSession(alignmentResult.matched);
      if (!alignmentResult.complete && !(state.strictCorrection && correctionLocked)) setRecognitionStatus("recognitionStopped", "recognitionStoppedSub", false);
    }).catch(function (error) {
      if (error && error.name === "AbortError") return;
      continuousFailureCount += 1;
      setRecognitionStatus("quranRecognitionError", "quranRecognitionErrorSub", true);
      document.getElementById("recognition-engine").textContent = t("quranRecognitionError");
    }).then(function () {
      if (quranSubmitController !== controller) return;
      quranSubmitController = null;
      quranSubmitting = false;
      setRecognitionControlsDisabled(false);
      setRecognitionButton(false);
      if ((!alignmentResult || !alignmentResult.complete) && state.recitationFlow === "continuous" && continuousSessionActive && !userStoppedRecognition) {
        queueContinuousRestart(alignmentResult ? 520 : 900);
      }
    });
  }

  function startQuranRecognition() {
    if (!quranAsrAvailable || !window.MediaRecorder) {
      setRecognitionStatus("quranRecognitionError", "quranRecognitionErrorSub", true);
      return;
    }
    var requestId = beginRecognitionStart();
    startAudioMeter(requestId).then(function (meterReady) {
      if (!meterReady || !micStream || !finishRecognitionStart(requestId)) return;
      var chunks = [];
      var recorder;
      try {
        recorder = new window.MediaRecorder(micStream, getQuranRecorderOptions());
      } catch (error) {
        stopAudioMeter();
        handleRecognitionError("audio-capture");
        return;
      }
      quranRecorder = recorder;
      recorder.ondataavailable = function (event) {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = function () {
        continuousFailureCount += 1;
        stopAudioMeter();
        handleRecognitionError("audio-capture");
      };
      recorder.onstart = function () {
        isListening = true;
        if (!(state.recitationFlow === "continuous" && continuousSessionActive)) playStartCue();
        setRecognitionControlsDisabled(false);
        document.getElementById("recitation-panel").classList.add("is-listening");
        document.getElementById("recognition-engine").textContent = t("quranRecognition");
        setRecognitionStatus("quranRecording", "quranRecordingSub", false);
        setRecognitionButton(true);
        startQuranVad(recorder);
      };
      recorder.onstop = function () {
        isListening = false;
        quranRecorder = null;
        document.getElementById("recitation-panel").classList.remove("is-listening");
        setRecognitionButton(false);
        stopAudioMeter();
        if (recorder._discard) return;
        if (recorder._noSpeech) {
          continuousFailureCount += 1;
          handleRecognitionError("no-speech");
          queueContinuousRestart(620);
          return;
        }
        var mimeType = recorder.mimeType || chunks[0] && chunks[0].type || "audio/webm";
        var blob = new Blob(chunks, { type: mimeType });
        chunks.length = 0;
        if (!blob.size) {
          continuousFailureCount += 1;
          handleRecognitionError("no-speech");
          queueContinuousRestart(620);
          return;
        }
        submitQuranAudio(blob, mimeType);
      };
      recorder.start(500);
    }).catch(function (error) {
      if (requestId !== recognitionRequestId) return;
      finishRecognitionStart(requestId);
      continuousFailureCount += 1;
      handleRecognitionError(error && error.name === "NotAllowedError" ? "not-allowed" : "audio-capture");
      queueContinuousRestart(900);
    });
  }

  function resetRecognitionView() {
    clearContinuousRestart();
    recognitionRequestId += 1;
    clearRecognitionStartTimer();
    if (quranSubmitController) {
      quranSubmitController.abort();
      quranSubmitController = null;
    }
    quranSubmitting = false;
    if (quranRecorder && quranRecorder.state !== "inactive") {
      quranRecorder._discard = true;
      try { quranRecorder.stop(); } catch (error) { /* no-op */ }
    }
    quranRecorder = null;
    if (recognition && isListening) {
      recognitionHadError = true;
      try { recognition.abort(); } catch (error) { /* no-op */ }
    }
    recognition = null;
    recognitionStartPending = false;
    stopAudioMeter();
    isListening = false;
    userStoppedRecognition = false;
    recognitionHadError = false;
    recognitionSessionCounted = false;
    readingVerseCounted = false;
    lastTranscript = "";
    lastMatchedCount = 0;
    lastAlignment = null;
    lastAlignmentFinal = false;
    clearCorrectionLock();
    document.getElementById("recitation-panel").classList.remove("is-listening", "is-requesting", "has-error");
    document.getElementById("recitation-panel").setAttribute("aria-busy", "false");
    document.getElementById("live-transcript").classList.remove("has-error");
    document.getElementById("live-transcript-text").textContent = t("waitingSpeech");
    updateRecognitionEngineLabel();
    document.querySelector("#recognition-progress span").style.width = "0%";
    updateMatchIndicator(0);
    updateReadingSummary(null, false);
    updateAiMentor("intro");
    document.querySelectorAll(".quran-word").forEach(function (button) {
      button.classList.remove("is-recognized", "is-warning", "is-error");
    });
    if (mushafSelectedVerseKey) {
      document.querySelectorAll('[data-verse-key="' + mushafSelectedVerseKey + '"]').forEach(function (glyph) {
        glyph.classList.remove("is-recognized", "is-warning", "is-error");
      });
    }
    setRecognitionStatus("micReady", "micDisclosure", false);
    setRecognitionButton(false);
  }

  function recordRecognitionSession(matchedWords) {
    if (recognitionSessionCounted || !lastTranscript.trim()) return;
    recognitionSessionCounted = true;
    state.sessions += 1;
    state.wordsReviewed += matchedWords;
    logActivity();
    if (lastAlignment && lastAlignment.warnings + lastAlignment.errors > 0) ensureCurrentVerseInReview();
    saveState();
    updateProgress();
    updateVerseActions();
  }

  function makeAlignmentFromStatuses(statuses, extras) {
    var matched = statuses.filter(function (status) { return status === "recognized"; }).length;
    var warnings = statuses.filter(function (status) { return status === "warning"; }).length;
    var errors = statuses.filter(function (status) { return status === "error" || status === "pending"; }).length;
    return {
      statuses: statuses.slice(),
      matched: matched,
      warnings: warnings,
      errors: errors,
      extras: Number(extras) || 0,
      score: (matched * 4) + (warnings * 1.5) - (errors * .5),
      complete: statuses.length > 0 && statuses.every(function (status) { return status === "recognized"; })
    };
  }

  function renderRecognitionAlignment(alignment, isFinal) {
    lastMatchedCount = alignment.matched;
    lastAlignment = alignment;
    lastAlignmentFinal = Boolean(isFinal);
    updateMatchIndicator(alignment.matched);
    updateReadingSummary(alignment, isFinal);
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".quran-word"));
    buttons.forEach(function (button, index) {
      button.classList.remove("is-recognized", "is-warning", "is-error");
      var status = alignment.statuses[index];
      if (status === "recognized") button.classList.add("is-recognized");
      if (status === "warning") button.classList.add("is-warning");
      if (status === "error" || (isFinal && status === "pending")) button.classList.add("is-error");
    });
    if (mushafSelectedVerseKey) {
      var mushafWords = Array.prototype.slice.call(document.querySelectorAll('[data-verse-key="' + mushafSelectedVerseKey + '"]:not(.is-ayah-end)'));
      mushafWords.forEach(function (button, index) {
        button.classList.remove("is-recognized", "is-warning", "is-error");
        var status = alignment.statuses[index];
        if (status === "recognized") button.classList.add("is-recognized");
        if (status === "warning") button.classList.add("is-warning");
        if (status === "error" || (isFinal && status === "pending")) button.classList.add("is-error");
      });
    }
    document.querySelector("#recognition-progress span").style.width = Math.round((alignment.matched / Math.max(currentWords.length, 1)) * 100) + "%";
    var lastMatchedIndex = alignment.statuses.lastIndexOf("recognized");
    if (lastMatchedIndex >= 0) updateWord(lastMatchedIndex);
    updateAiMentor("reading");
  }

  function completeRecognizedVerse(alignment) {
    if (!readingVerseCounted && window.ALLIMReading) {
      readingVerseCounted = true;
      window.ALLIMReading.recognized(currentSurah.id, currentVerse.ayah);
    }
    continuousFailureCount = 0;
    var shouldCredit = !recognitionSessionCounted;
    var heartResult = null;
    var linkedResult = { sealed: false };
    var linked33Result = { active: false };
    var pageRecallResult = { complete: false };
    var resolvedCorrection = correctionLocked;
    clearCorrectionLock();
    if (resolvedCorrection) {
      renderCorrectionGate(true);
      window.setTimeout(function () {
        var gate = document.getElementById("correction-gate");
        if (gate && !correctionLocked) gate.hidden = true;
      }, 1500);
    }
    if (shouldCredit) {
      recordRecognitionSession(alignment.matched);
      var verseKey = getVerseKey(currentSurah, currentVerse);
      if (isStructured33Method(state.memorizationMethod) && linked33Session) {
        linked33Result = registerLinked33SegmentVerse(verseKey);
      } else if (state.memorizationMethod === "foundation300") {
        heartResult = recordHeartRecitation(verseKey);
        recordHifzLearningSignal("clean", "verse", 0);
        linkedResult = registerLinkedPageVerse(verseKey);
      }
      pageRecallResult = registerPageRecallVerse(verseKey);
      saveState();
      renderHeartMushaf();
      renderHeartReadCounter();
      if (state.memorizationMethod === "foundation300" && !linkedPageSession && !linkedResult.sealed && heartResult) showToast(formatText(heartResult.messageKey === "heartCreditRecorded" ? "heartReadCredit" : heartResult.messageKey, heartResult.values));
    }
    setRecognitionStatus("recognitionComplete", "recognitionCompleteSub", false);
    if (!(state.recitationFlow === "continuous" && continuousSessionActive)) playSuccessCue();
    isListening = false;
    stopAudioMeter();
    document.getElementById("recitation-panel").classList.remove("is-listening");
    setRecognitionButton(false);
    if (recognition) {
      userStoppedRecognition = true;
      try { recognition.stop(); } catch (error) { /* no-op */ }
    }
    if (state.recitationFlow === "continuous" && continuousSessionActive) {
      userStoppedRecognition = false;
      continuousResumePending = true;
    }
    if (linked33Result.cycleComplete) {
      continuousResumePending = false;
      clearAutoAdvance();
      if (linked33Result.restart) restartLinked33SegmentCycle();
      else {
        stopContinuousSession();
        window.setTimeout(function () {
          navigate("memorize");
          renderHeartMushaf();
          if (!linked33Result.methodComplete && isStructured33Method(state.memorizationMethod)) {
            loadHeartPageContextForCurrentVerse().then(startLinked33CurrentStep).catch(function () { showToast(t("heartPageLoadError")); });
          }
        }, 520);
      }
      return;
    }
    if (linkedResult.sealed) {
      continuousResumePending = false;
      stopContinuousSession();
      clearAutoAdvance();
      return;
    }
    if (pageRecallResult.complete) {
      continuousResumePending = false;
      stopContinuousSession();
      clearAutoAdvance();
      return;
    }
    scheduleAutoAdvance("read");
  }

  function applyTranscript(transcript, isFinal) {
    lastTranscript = String(transcript || "").trim();
    document.getElementById("live-transcript-text").textContent = lastTranscript || t("waitingSpeech");
    var alignment = alignRecognizedWords(lastTranscript, isFinal);
    renderRecognitionAlignment(alignment, isFinal);
    if (alignment.complete) completeRecognizedVerse(alignment);
    else if (isFinal && !alignment.complete && !activateCorrectionLock(alignment)) playErrorCue();
    return alignment;
  }

  function applyCorrectionTranscript(transcript, isFinal) {
    if (!state.strictCorrection || !correctionLocked) return applyTranscript(transcript, isFinal);
    lastTranscript = String(transcript || "").trim();
    document.getElementById("live-transcript-text").textContent = lastTranscript || t("waitingSpeech");
    var heard = normalizeArabic(lastTranscript).split(/\s+/).filter(Boolean);
    var statuses = correctionStatuses.length ? correctionStatuses.slice() : Array(currentWords.length).fill("error");
    var targetIndex = findCorrectionIndex(statuses, correctionIndex);
    var resolved = 0;
    var startedCorrection = false;
    var extras = 0;
    heard.forEach(function (heardWord) {
      if (targetIndex < 0) {
        extras += 1;
        return;
      }
      var score = wordSimilarity(currentWords[targetIndex].ar, heardWord);
      if (score >= recognitionMatchThreshold()) {
        statuses[targetIndex] = "recognized";
        resolved += 1;
        startedCorrection = true;
        targetIndex = findCorrectionIndex(statuses, targetIndex + 1);
      } else if (startedCorrection) {
        extras += 1;
      }
    });
    var alignment = makeAlignmentFromStatuses(statuses, extras);
    correctionStatuses = statuses.slice();
    renderRecognitionAlignment(alignment, isFinal);
    if (alignment.complete) {
      completeRecognizedVerse(alignment);
      return alignment;
    }
    correctionIndex = findCorrectionIndex(statuses, correctionIndex);
    correctionLocked = true;
    renderCorrectionGate(false);
    updateNextButton();
    setRecognitionStatus("correctionStatus", "correctionStatusSub", true);
    document.getElementById("recitation-subtitle").textContent = formatText("correctionRequiredSub", {
      word: currentWords[correctionIndex] ? currentWords[correctionIndex].ar : ""
    });
    if (isFinal && resolved === 0) playErrorCue();
    return alignment;
  }

  function canAutoFallbackToServer(errorCode) {
    return state.recognitionMode === "auto" &&
      !autoServerFallback &&
      !browserRecognitionSupported() &&
      quranRecognitionSupported() &&
      ["network", "phrases-not-supported", "start-failed", "unsupported"].indexOf(errorCode) >= 0;
  }

  function handleRecognitionError(errorCode) {
    recognitionHadError = true;
    isListening = false;
    finishRecognitionStart();
    stopAudioMeter();
    document.getElementById("recitation-panel").classList.remove("is-listening", "is-requesting");
    setRecognitionControlsDisabled(false);
    setRecognitionButton(false);
    if (canAutoFallbackToServer(errorCode)) {
      recognition = null;
      recognitionHadError = false;
      autoServerFallback = true;
      updateRecognitionModeUi();
      setRecognitionStatus("recognitionAutoFallback", "recognitionAutoFallbackSub", false);
      window.setTimeout(function () { startRecognition(true); }, 280);
      return;
    }
    if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
      stopContinuousSession();
      setRecognitionStatus("permissionDenied", "permissionDeniedSub", true);
    } else if (errorCode === "mic-timeout") {
      stopContinuousSession();
      setRecognitionStatus("micRequestTimeout", "micRequestTimeoutSub", true);
    } else if (errorCode === "no-speech") {
      setRecognitionStatus("noSpeech", "noSpeechSub", true);
    } else if (errorCode === "network") {
      setRecognitionStatus("recognitionNetwork", "recognitionNetworkSub", true);
    } else if (errorCode === "audio-capture") {
      setRecognitionStatus("audioCaptureError", "audioCaptureErrorSub", true);
    } else if (errorCode === "phrases-not-supported") {
      setRecognitionStatus("recognitionCompatibility", "recognitionCompatibilitySub", true);
    } else {
      setRecognitionStatus("recognitionError", "recognitionErrorSub", true);
    }
    document.getElementById("recognition-engine").textContent = errorCode || t("recognitionError");
    if (["no-speech", "network", "audio-capture", "aborted"].indexOf(errorCode) >= 0) queueContinuousRestart(errorCode === "no-speech" ? 520 : 900);
  }

  function createRecognition() {
    var RecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionConstructor) return null;
    var instance = new RecognitionConstructor();
    instance.lang = "ar-SA";
    instance.continuous = false;
    instance.interimResults = true;
    instance.maxAlternatives = 5;
    /* Keep the baseline recognizer free of experimental phrase and grammar hints.
       Some Chromium-based browsers expose these APIs but reject them at runtime. */
    instance.onstart = function () {
      if (recognition !== instance) return;
      if (!finishRecognitionStart(instance._allimRequestId)) {
        try { instance.abort(); } catch (error) { /* no-op */ }
        return;
      }
      isListening = true;
      setRecognitionControlsDisabled(false);
      if (!(state.recitationFlow === "continuous" && continuousSessionActive)) playStartCue();
      document.getElementById("recitation-panel").classList.add("is-listening");
      document.getElementById("recognition-engine").textContent = t("enhancedRecognition");
      setRecognitionStatus("listeningNow", "listeningSub", false);
      setRecognitionButton(true);
    };
    instance.onresult = function (event) {
      if (recognition !== instance) return;
      continuousFailureCount = 0;
      var correctionWords = correctionLocked ? currentWords.filter(function (_, index) { return correctionStatuses[index] !== "recognized"; }) : null;
      var best = chooseBestTranscript(event, correctionWords);
      if (correctionLocked) applyCorrectionTranscript(best.transcript, best.isFinal);
      else applyTranscript(best.transcript, best.isFinal);
    };
    instance.onerror = function (event) {
      if (recognition !== instance) return;
      if (event.error !== "aborted") continuousFailureCount += 1;
      handleRecognitionError(event.error);
    };
    instance.onend = function () {
      if (recognition !== instance) return;
      isListening = false;
      finishRecognitionStart(instance._allimRequestId);
      stopAudioMeter();
      document.getElementById("recitation-panel").classList.remove("is-listening");
      setRecognitionControlsDisabled(false);
      setRecognitionButton(false);
      if (recognitionHadError) return;
      if (lastTranscript && !lastAlignmentFinal) {
        var alignment = correctionLocked ? applyCorrectionTranscript(lastTranscript, true) : applyTranscript(lastTranscript, true);
        recordRecognitionSession(alignment.matched);
      }
      if (recognitionSessionCounted && !correctionLocked) {
        if (state.recitationFlow === "continuous" && continuousSessionActive && !userStoppedRecognition && (!lastAlignment || !lastAlignment.complete)) queueContinuousRestart(420);
        return;
      }
      if (state.strictCorrection && correctionLocked) {
        setRecognitionStatus("correctionStatus", "correctionStatusSub", true);
        queueContinuousRestart(320);
        return;
      }
      if (!(state.strictCorrection && correctionLocked)) setRecognitionStatus("recognitionStopped", "recognitionStoppedSub", false);
      if (state.recitationFlow === "continuous" && continuousSessionActive && !userStoppedRecognition) {
        if (!lastTranscript) {
          continuousFailureCount += 1;
        }
        queueContinuousRestart(lastTranscript ? 420 : 620);
      }
    };
    return instance;
  }

  function stopRecognitionImmediately() {
    userStoppedRecognition = true;
    stopContinuousSession();
    clearAutoAdvance();
    recognitionRequestId += 1;
    clearRecognitionStartTimer();
    recognitionStartPending = false;
    if (quranSubmitController) {
      quranSubmitController.abort();
      quranSubmitController = null;
    }
    quranSubmitting = false;
    if (quranRecorder && quranRecorder.state !== "inactive") {
      quranRecorder._discard = true;
      try { quranRecorder.stop(); } catch (error) { /* no-op */ }
    }
    quranRecorder = null;
    var activeRecognition = recognition;
    recognition = null;
    recognitionHadError = true;
    if (activeRecognition) {
      try { activeRecognition.abort(); } catch (error) { /* no-op */ }
    }
    isListening = false;
    stopAudioMeter();
    var panel = document.getElementById("recitation-panel");
    panel.classList.remove("is-listening", "is-requesting");
    panel.setAttribute("aria-busy", "false");
    setRecognitionControlsDisabled(false);
    setRecognitionButton(false);
    setRecognitionStatus("recognitionStopped", "recognitionStoppedSub", false);
  }

  function startRecognition(internalRestart) {
    if (recognitionStartPending) {
      cancelRecognitionStart(true);
      return;
    }
    if (quranSubmitting) {
      stopRecognitionImmediately();
      return;
    }
    if (!hasSecureAudioContext()) {
      updateRuntimeContextUi();
      setRecognitionStatus("secureMicStatus", "secureMicStatusSub", true);
      document.getElementById("recognition-engine").textContent = t("secureContextRequired");
      return;
    }
    if (isListening) {
      stopRecognitionImmediately();
      return;
    }
    primeCueAudio();
    recognitionHadError = false;
    userStoppedRecognition = false;
    if (!internalRestart && state.recognitionMode === "auto" && browserRecognitionSupported()) {
      autoServerFallback = false;
      updateRecognitionModeUi();
    }
    if (state.recitationFlow === "continuous") {
      continuousSessionActive = true;
      if (!internalRestart) continuousFailureCount = 0;
    } else {
      stopContinuousSession();
    }
    if (!correctionLocked) { recognitionSessionCounted = false; readingVerseCounted = false; }
    lastTranscript = "";
    lastMatchedCount = 0;
    if (!correctionLocked) resetRecognitionView();
    if (getEffectiveRecognitionMode() === "quran") {
      startQuranRecognition();
      return;
    }
    recognition = createRecognition();
    if (!recognition) {
      setRecognitionControlsDisabled(true);
      setRecognitionStatus("recognitionUnsupported", "recognitionUnsupportedSub", true);
      document.getElementById("recognition-engine").textContent = t("recognitionUnsupported");
      return;
    }
    var requestId = beginRecognitionStart();
    recognition._allimRequestId = requestId;
    try {
      recognition.start();
    } catch (error) {
      handleRecognitionError("start-failed");
    }
  }

  function focusMobileReadingTarget() {
    if (window.innerWidth > 760 || document.body.classList.contains("mushaf-view")) return;
    var target = document.getElementById("ayah-text");
    if (!target) return;
    var rect = target.getBoundingClientRect();
    var topbar = document.querySelector(".topbar");
    var navigation = document.querySelector(".bottom-nav");
    var safeTop = topbar ? topbar.getBoundingClientRect().bottom + 12 : 12;
    var safeBottom = window.innerHeight - (navigation ? navigation.getBoundingClientRect().height : 0) - 78;
    var viewportCenter = safeTop + Math.max(0, safeBottom - safeTop) / 2;
    var targetCenter = rect.top + rect.height / 2;
    var distance = targetCenter - viewportCenter;
    if (Math.abs(distance) > 16) window.scrollBy({ top: distance, behavior: "smooth" });
  }

  function toggleMobileRecognition() {
    if (!isListening && !recognitionStartPending && !quranSubmitting) focusMobileReadingTarget();
    startRecognition(false);
  }

  function checkRecognitionSupport() {
    var secureRuntime = updateRuntimeContextUi();
    var effectiveMode = getEffectiveRecognitionMode();
    var supported = secureRuntime && (effectiveMode === "quran" ? quranRecognitionSupported() : browserRecognitionSupported());
    setRecognitionControlsDisabled(!supported);
    if (!secureRuntime) {
      setRecognitionStatus("secureMicStatus", "secureMicStatusSub", true);
      document.getElementById("recognition-engine").textContent = t("secureContextRequired");
    } else if (!supported) {
      setRecognitionStatus("recognitionUnsupported", "recognitionUnsupportedSub", true);
      document.getElementById("recognition-engine").textContent = t("recognitionUnsupported");
    } else {
      updateRecognitionEngineLabel();
    }
  }

  function getMemoryWordElements() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-answer-word]"));
  }

  function getRemainingMemoryWords() {
    return getMemoryWordElements().slice(memoryRevealedCount).map(function (word) { return word.textContent; });
  }

  function memoryPipelineActive() {
    return memorySeriesActive || memoryStartPending || memoryIsListening || memorySubmitPending || Boolean(memoryRestartTimer);
  }

  function clearMemoryStartTimer() {
    if (memoryStartTimer) window.clearTimeout(memoryStartTimer);
    memoryStartTimer = null;
  }

  function clearMemoryRestartTimer() {
    if (memoryRestartTimer) window.clearTimeout(memoryRestartTimer);
    memoryRestartTimer = null;
  }

  function clearMemorySubmit() {
    if (memorySubmitTimer) window.clearTimeout(memorySubmitTimer);
    memorySubmitTimer = null;
    if (memorySubmitController) memorySubmitController.abort();
    memorySubmitController = null;
    memorySubmitPending = false;
  }

  function setMemorySeriesPhase(phase, titleKey, subtitleKey) {
    var bar = document.getElementById("memory-session-bar");
    var title = document.getElementById("memory-series-status");
    var detail = document.getElementById("memory-series-detail");
    if (bar) bar.setAttribute("data-phase", phase || "ready");
    if (title) title.textContent = t(titleKey || "memorySeriesReady");
    if (detail) detail.textContent = t(subtitleKey || "memorySeriesReadySub");
  }

  function updateMemoryCounterDisplay() {
    if (!currentSurah || !currentVerse) return;
    var key = getVerseKey(currentSurah, currentVerse);
    var linkedPage = getLinked33PageForCurrentVerse();
    var structured = isStructured33Method(state.memorizationMethod);
    var target = structured ? LINKED_33_TARGET : HEART_FOUNDATION_TOTAL;
    var structuredPage = linkedPage ? (state.memorizationMethod === "turkishWall33" ? getTurkishWallPageUnit(linkedPage.page) : getLinked33PageUnit(linkedPage.page)) : null;
    var total = structured ? (structuredPage ? Math.max(0, Number(structuredPage.verseCounts[key]) || 0) : 0) : getHeartFoundationTotal(getHeartUnit(key));
    var count = document.getElementById("memory-heart-count");
    var bar = document.getElementById("memory-heart-progress-bar");
    if (count) count.textContent = formatMetric(total);
    if (bar) bar.style.width = Math.min(100, Math.round((total / target) * 100)) + "%";
  }

  function stopMemoryVad() {
    if (memoryVadFrame) window.cancelAnimationFrame(memoryVadFrame);
    memoryVadFrame = null;
    memoryVadStartedAt = 0;
    memoryVadLastVoiceAt = 0;
    memoryVadSpeechDetected = false;
    memoryAnalyser = null;
    if (memoryAudioContext) memoryAudioContext.close().catch(function () { return null; });
    memoryAudioContext = null;
  }

  function stopMemoryMicStream() {
    stopMemoryVad();
    if (memoryMicStream) memoryMicStream.getTracks().forEach(function (track) { track.stop(); });
    memoryMicStream = null;
  }

  function startMemoryVad(recorder) {
    stopMemoryVad();
    var AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (AudioContextConstructor && memoryMicStream) {
      try {
        memoryAudioContext = new AudioContextConstructor();
        var source = memoryAudioContext.createMediaStreamSource(memoryMicStream);
        memoryAnalyser = memoryAudioContext.createAnalyser();
        memoryAnalyser.fftSize = 256;
        memoryAnalyser.smoothingTimeConstant = .7;
        source.connect(memoryAnalyser);
        memoryAudioContext.resume().catch(function () { return null; });
      } catch (error) {
        memoryAnalyser = null;
      }
    }
    memoryVadStartedAt = Date.now();
    function inspectSilence() {
      if (recorder !== memoryRecorder || recorder.state === "inactive") {
        stopMemoryVad();
        return;
      }
      var now = Date.now();
      var elapsed = now - memoryVadStartedAt;
      if (memoryAnalyser) {
        var values = new Uint8Array(memoryAnalyser.fftSize);
        memoryAnalyser.getByteTimeDomainData(values);
        var sum = 0;
        for (var index = 0; index < values.length; index += 1) {
          var sample = (values[index] - 128) / 128;
          sum += sample * sample;
        }
        if (elapsed > 380 && Math.sqrt(sum / Math.max(values.length, 1)) >= .024) {
          memoryVadSpeechDetected = true;
          memoryVadLastVoiceAt = now;
        }
      }
      if (memoryVadSpeechDetected && now - memoryVadLastVoiceAt >= 1150 && elapsed >= 1500) {
        try { recorder.stop(); } catch (error) { handleMemoryRecognitionError("audio-capture"); }
        return;
      }
      if (!memoryVadSpeechDetected && elapsed >= 10000) {
        recorder._noSpeech = true;
        try { recorder.stop(); } catch (error) { handleMemoryRecognitionError("audio-capture"); }
        return;
      }
      if (elapsed >= 55000) {
        try { recorder.stop(); } catch (error) { handleMemoryRecognitionError("audio-capture"); }
        return;
      }
      memoryVadFrame = window.requestAnimationFrame(inspectSilence);
    }
    memoryVadFrame = window.requestAnimationFrame(inspectSilence);
  }

  function setMemoryButton(listening) {
    var button = document.getElementById("start-memory-recognition");
    var stopButton = document.getElementById("stop-memory-recognition");
    var quickStop = document.getElementById("memory-quick-stop");
    if (!button) return;
    var active = memoryPipelineActive() || Boolean(listening);
    button.querySelector("span").textContent = t(active ? "memorySeriesActive" : "memorySeriesStart");
    button.setAttribute("aria-pressed", String(active));
    button.disabled = active;
    if (stopButton) stopButton.disabled = !active;
    if (quickStop) quickStop.disabled = !active;
  }

  function setMemoryStatus(titleKey, subtitleKey, hasError) {
    var stage = document.querySelector(".memory-stage");
    var title = document.getElementById("memory-status-title");
    var subtitle = document.getElementById("memory-status-subtitle");
    if (!stage || !title || !subtitle) return;
    title.textContent = t(titleKey);
    subtitle.textContent = t(subtitleKey);
    stage.classList.toggle("has-memory-error", Boolean(hasError));
    stage.classList.toggle("is-memory-listening", titleKey === "memoryListening");
    stage.classList.toggle("is-memory-complete", titleKey === "memoryComplete" || titleKey === "memoryCompleteWithHint");
  }

  function updateMemoryProgress() {
    var total = getMemoryWordElements().length;
    var counter = document.getElementById("memory-counter");
    var bar = document.getElementById("memory-progress-bar");
    if (counter) counter.textContent = formatMetric(memoryRevealedCount) + " / " + formatMetric(total);
    if (bar) bar.style.width = Math.round(memoryRevealedCount / Math.max(total, 1) * 100) + "%";
    getMemoryWordElements().forEach(function (word, index) {
      word.classList.toggle("is-current", index === memoryRevealedCount && memoryRevealedCount < total);
      if (index !== memoryRevealedCount) word.classList.remove("is-incorrect");
    });
  }

  function checkMemoryRecognitionSupport() {
    var button = document.getElementById("start-memory-recognition");
    if (!button) return false;
    var effectiveMode = getEffectiveRecognitionMode();
    var supported = hasSecureAudioContext() && (effectiveMode === "quran" ? quranRecognitionSupported() : browserRecognitionSupported());
    button.disabled = !supported || memoryPipelineActive();
    if (!supported) setMemoryStatus("memoryUnsupported", "memoryUnsupportedSub", true);
    return supported;
  }

  function prepareMemoryAttempt() {
    getMemoryWordElements().forEach(function (word) {
      word.classList.remove("is-revealed", "is-correct", "is-hint", "is-incorrect", "is-current");
    });
    memorySessionCounted = false;
    memoryRevealedCount = 0;
    memoryHintsThisAttempt = 0;
    memoryHadError = false;
    memoryLastTranscript = "";
    memoryFullVerseMatched = false;
    document.getElementById("reveal-word").disabled = false;
    document.getElementById("memory-transcript-text").textContent = t("memoryWaiting");
    updateMemoryProgress();
  }

  function queueMemoryRestart(delay, afterError) {
    clearMemoryRestartTimer();
    if (!memorySeriesActive) {
      setMemoryButton(false);
      return;
    }
    setMemorySeriesPhase(afterError ? "error" : "accepted", afterError ? "memorySeriesError" : "memorySeriesAccepted", afterError ? "memorySeriesErrorSub" : "memorySeriesAcceptedSub");
    memoryRestartTimer = window.setTimeout(function () {
      memoryRestartTimer = null;
      if (!memorySeriesActive) return;
      prepareMemoryAttempt();
      startMemoryRecognition(true);
    }, Math.max(450, Number(delay) || 750));
    setMemoryButton(false);
  }

  function finishMemorySession() {
    if (memorySessionCounted) return;
    memorySessionCounted = true;
    stopMemoryRecognition(true);
    state.sessions += 1;
    state.wordsReviewed += getMemoryWordElements().length;
    logActivity();
    var key = getVerseKey(currentSurah, currentVerse);
    var heartResult = null;
    var structured = isStructured33Method(state.memorizationMethod);
    var turkish = state.memorizationMethod === "turkishWall33";
    var reviewIndex = state.reviewQueue.indexOf(key);
    var qualifiesForHeart = memoryHintsThisAttempt === 0 && memoryFullVerseMatched;
    if (qualifiesForHeart) {
      heartResult = turkish ? recordTurkishWallVerseRecitation(key, getLinked33PageForCurrentVerse()) : (structured ? recordLinked33VerseRecitation(key, getLinked33PageForCurrentVerse()) : recordHeartRecitation(key));
      if (heartResult && heartResult.counted !== false && reviewIndex >= 0) state.reviewQueue.splice(reviewIndex, 1);
    }
    recordHifzLearningSignal(qualifiesForHeart ? "clean" : (memoryHintsThisAttempt > 0 ? "assisted" : "incomplete"), "verse", memoryHintsThisAttempt);
    if (memoryHintsThisAttempt > 0 && reviewIndex < 0) state.reviewQueue.push(key);
    document.getElementById("reveal-word").disabled = true;
    if (memoryHintsThisAttempt > 0) setMemoryStatus("memoryCompleteWithHint", "memoryCompleteWithHintSub", false);
    else if (!memoryFullVerseMatched) setMemoryStatus("heartFullVerseNeededTitle", "heartFullVerseNeededSub", true);
    else setMemoryStatus("memoryComplete", "memoryCompleteSub", false);
    saveState();
    updateProgress();
    updateVerseActions();
    renderHeartMushaf();
    renderHeartReadCounter();
    updateMemoryCounterDisplay();
    loadHeartPageContextForCurrentVerse().catch(function () { return null; });
    showToast(memoryHintsThisAttempt > 0 ? t("heartHintNotCounted") : (!memoryFullVerseMatched ? t("heartFullVerseRequired") : formatText(heartResult ? heartResult.messageKey : (turkish ? "turkishWrongVerse" : "linked33WrongVerse"), heartResult ? heartResult.values : {})));
    var total = structured ? (heartResult && heartResult.counted ? heartResult.total : 0) : getHeartFoundationTotal(getHeartUnit(key));
    var target = structured ? LINKED_33_TARGET : HEART_FOUNDATION_TOTAL;
    if (structured && qualifiesForHeart && heartResult && heartResult.stepComplete) {
      memorySeriesActive = false;
      setMemoryButton(false);
      setMemorySeriesPhase("accepted", "memoryComplete", "memoryCompleteSub");
      if (!heartResult.methodComplete) {
        window.setTimeout(function () {
          if (!isStructured33Method(state.memorizationMethod)) return;
          loadHeartPageContextForCurrentVerse().then(startLinked33CurrentStep).catch(function () { showToast(t("heartPageLoadError")); });
        }, 760);
      }
    } else if (qualifiesForHeart && total < target && memorySeriesActive && (!structured || heartResult && heartResult.counted)) {
      queueMemoryRestart(760, false);
    } else if (!qualifiesForHeart && memorySeriesActive) {
      queueMemoryRestart(980, true);
    } else {
      memorySeriesActive = false;
      setMemoryButton(false);
      if (structured && heartResult && heartResult.counted === false) setMemorySeriesPhase("error", "memorySeriesError", turkish ? "turkishWrongVerse" : "linked33WrongVerse");
      else if (total >= target) setMemorySeriesPhase("accepted", "memoryComplete", "memoryCompleteSub");
    }
  }

  function revealMemoryWord(word, asHint) {
    if (!word || word.classList.contains("is-revealed")) return false;
    word.classList.remove("is-incorrect", "is-current");
    word.classList.add("is-revealed");
    if (asHint) word.classList.add("is-hint");
    else word.classList.add("is-correct");
    memoryRevealedCount += 1;
    updateMemoryProgress();
    if (memoryRevealedCount >= getMemoryWordElements().length) finishMemorySession();
    return true;
  }

  function applyMemoryTranscript(transcript, isFinal) {
    var cleanTranscript = String(transcript || "").trim();
    if (!cleanTranscript) return null;
    memoryLastTranscript = cleanTranscript;
    document.getElementById("memory-transcript-text").textContent = cleanTranscript;
    var fullAlignment = alignExpectedWords(splitVerseWords(currentVerse.text), cleanTranscript, Boolean(isFinal));
    if (fullAlignment.complete) memoryFullVerseMatched = true;
    var remainingWords = getRemainingMemoryWords();
    if (!remainingWords.length) return null;
    var alignment = alignExpectedWords(remainingWords, cleanTranscript, Boolean(isFinal));
    var elements = getMemoryWordElements();
    var opened = 0;
    for (var index = 0; index < alignment.statuses.length; index += 1) {
      if (alignment.statuses[index] !== "recognized") break;
      if (revealMemoryWord(elements[memoryRevealedCount], false)) opened += 1;
      if (memorySessionCounted) break;
    }
    if (memorySessionCounted) return alignment;
    var current = elements[memoryRevealedCount];
    if (current) {
      current.classList.toggle("is-incorrect", Boolean(isFinal) && opened === 0);
      current.classList.add("is-current");
    }
    if (opened > 0) {
      setMemoryStatus("memoryWordCorrect", "memoryWordCorrectSub", false);
    } else if (isFinal) {
      setMemoryStatus("memoryWordRetry", "memoryWordRetrySub", true);
      playErrorCue();
    }
    return alignment;
  }

  function handleMemoryRecognitionError(errorCode) {
    memoryHadError = true;
    memoryIsListening = false;
    memoryStartPending = false;
    clearMemoryStartTimer();
    stopMemoryMicStream();
    if (canAutoFallbackToServer(errorCode)) {
      memoryRecognition = null;
      memoryHadError = false;
      autoServerFallback = true;
      updateRecognitionModeUi();
      setMemoryStatus("recognitionAutoFallback", "recognitionAutoFallbackSub", false);
      setMemorySeriesPhase("requesting", "memorySeriesRequesting", "memorySeriesRequestingSub");
      clearMemoryRestartTimer();
      memoryRestartTimer = window.setTimeout(function () {
        memoryRestartTimer = null;
        if (memorySeriesActive) startMemoryRecognition(true);
      }, 280);
      setMemoryButton(false);
      return;
    }
    if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
      memorySeriesActive = false;
      setMemoryStatus("memoryPermissionDenied", "memoryPermissionDeniedSub", true);
      setMemorySeriesPhase("error", "memoryPermissionDenied", "memoryPermissionDeniedSub");
    } else if (errorCode === "mic-timeout") {
      memorySeriesActive = false;
      setMemoryStatus("memoryUnsupported", "memoryUnsupportedSub", true);
      setMemorySeriesPhase("error", "memorySeriesTimeout", "memorySeriesTimeoutSub");
    } else if (errorCode === "no-speech") {
      setMemoryStatus("memoryNoSpeech", "memoryNoSpeechSub", true);
      queueMemoryRestart(850, true);
    } else {
      setMemoryStatus("memoryUnsupported", "memoryUnsupportedSub", true);
      queueMemoryRestart(1050, true);
    }
    setMemoryButton(false);
  }

  function createMemoryRecognition() {
    var RecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionConstructor) return null;
    var instance = new RecognitionConstructor();
    instance.lang = "ar-SA";
    instance.continuous = false;
    instance.interimResults = true;
    instance.maxAlternatives = 5;
    instance.onstart = function () {
      if (memoryRecognition !== instance) return;
      if (instance._allimRequestId !== memoryRequestId || !memorySeriesActive) {
        try { instance.abort(); } catch (error) { /* no-op */ }
        return;
      }
      clearMemoryStartTimer();
      memoryStartPending = false;
      memoryIsListening = true;
      playStartCue();
      setMemoryButton(true);
      setMemoryStatus("memoryListening", "memoryListeningSub", false);
      setMemorySeriesPhase("listening", "memorySeriesListening", "memorySeriesListeningSub");
    };
    instance.onresult = function (event) {
      if (memoryRecognition !== instance) return;
      var best = chooseBestTranscript(event, getRemainingMemoryWords());
      applyMemoryTranscript(best.transcript, best.isFinal);
    };
    instance.onerror = function (event) {
      if (memoryRecognition !== instance) return;
      handleMemoryRecognitionError(event.error);
    };
    instance.onend = function () {
      if (memoryRecognition !== instance) return;
      memoryRecognition = null;
      memoryIsListening = false;
      memoryStartPending = false;
      clearMemoryStartTimer();
      setMemoryButton(false);
      if (memorySessionCounted || memoryHadError) return;
      if (memoryLastTranscript) applyMemoryTranscript(memoryLastTranscript, true);
      if (!memorySessionCounted && memorySeriesActive) {
        var needsCorrection = Boolean(document.querySelector(".memory-stage.has-memory-error")) || !memoryLastTranscript;
        if (!needsCorrection) setMemoryStatus("memoryPaused", "memoryPausedSub", false);
        queueMemoryRestart(needsCorrection ? 900 : 520, needsCorrection);
      }
    };
    return instance;
  }

  function submitMemoryQuranAudio(blob, mimeType) {
    var form = new FormData();
    var extension = mimeType.indexOf("mp4") >= 0 ? "m4a" : "webm";
    var controller = window.AbortController ? new window.AbortController() : null;
    var submitToken = ++memoryRequestId;
    memorySubmitController = controller;
    memorySubmitPending = true;
    form.append("audio", blob, "memory-recitation." + extension);
    form.append("verse_key", currentSurah.id + ":" + currentVerse.ayah);
    setMemoryStatus("memoryProcessing", "memoryProcessingSub", false);
    setMemorySeriesPhase("processing", "memorySeriesProcessing", "memorySeriesProcessingSub");
    setMemoryButton(false);
    memorySubmitTimer = window.setTimeout(function () {
      if (memorySubmitController === controller && controller) controller.abort();
    }, 45000);
    return window.fetch("/api/quran-asr", {
      method: "POST",
      body: form,
      headers: { "X-Requested-With": "QuranCompanion" },
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (!response.ok) throw new Error("quran-asr-unavailable");
      return response.json();
    }).then(function (data) {
      if (submitToken !== memoryRequestId || !memorySeriesActive) return;
      var transcript = data && data.transcript ? String(data.transcript) : "";
      if (!transcript.trim()) {
        handleMemoryRecognitionError("no-speech");
        return;
      }
      applyMemoryTranscript(transcript, true);
      if (!memorySessionCounted && memorySeriesActive) {
        var needsCorrection = Boolean(document.querySelector(".memory-stage.has-memory-error"));
        queueMemoryRestart(needsCorrection ? 900 : 620, needsCorrection);
      }
    }).catch(function (error) {
      if (error && error.name === "AbortError" && (!memorySeriesActive || submitToken !== memoryRequestId)) return;
      handleMemoryRecognitionError("quran-asr-unavailable");
    }).then(function () {
      if (memorySubmitController === controller) {
        if (memorySubmitTimer) window.clearTimeout(memorySubmitTimer);
        memorySubmitTimer = null;
        memorySubmitController = null;
        memorySubmitPending = false;
      }
      setMemoryButton(false);
      checkMemoryRecognitionSupport();
    });
  }

  function startMemoryQuranRecognition() {
    var requestId = ++memoryRequestId;
    memoryStartPending = true;
    setMemoryStatus("memoryRequesting", "memoryRequestingSub", false);
    setMemorySeriesPhase("requesting", "memorySeriesRequesting", "memorySeriesRequestingSub");
    setMemoryButton(false);
    clearMemoryStartTimer();
    memoryStartTimer = window.setTimeout(function () {
      if (!memoryStartPending || requestId !== memoryRequestId) return;
      memoryRequestId += 1;
      memoryStartPending = false;
      stopMemoryMicStream();
      handleMemoryRecognitionError("mic-timeout");
    }, MIC_REQUEST_TIMEOUT);
    navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (stream) {
      if (requestId !== memoryRequestId || !memorySeriesActive) {
        stream.getTracks().forEach(function (track) { track.stop(); });
        return;
      }
      clearMemoryStartTimer();
      memoryMicStream = stream;
      var chunks = [];
      var recorder;
      try {
        recorder = new window.MediaRecorder(stream, getQuranRecorderOptions());
      } catch (error) {
        handleMemoryRecognitionError("audio-capture");
        return;
      }
      memoryRecorder = recorder;
      recorder.ondataavailable = function (event) { if (event.data && event.data.size > 0) chunks.push(event.data); };
      recorder.onerror = function () { handleMemoryRecognitionError("audio-capture"); };
      recorder.onstart = function () {
        memoryStartPending = false;
        memoryIsListening = true;
        playStartCue();
        setMemoryButton(true);
        setMemoryStatus("memoryListening", "memoryListeningSub", false);
        setMemorySeriesPhase("listening", "memorySeriesListening", "memorySeriesListeningSub");
        startMemoryVad(recorder);
      };
      recorder.onstop = function () {
        memoryIsListening = false;
        memoryRecorder = null;
        stopMemoryMicStream();
        setMemoryButton(false);
        if (recorder._discard) return;
        if (recorder._noSpeech) {
          handleMemoryRecognitionError("no-speech");
          return;
        }
        var mimeType = recorder.mimeType || chunks[0] && chunks[0].type || "audio/webm";
        var blob = new Blob(chunks, { type: mimeType });
        if (!blob.size) handleMemoryRecognitionError("no-speech");
        else submitMemoryQuranAudio(blob, mimeType);
      };
      recorder.start(500);
    }).catch(function (error) {
      if (requestId !== memoryRequestId) return;
      handleMemoryRecognitionError(error && error.name === "NotAllowedError" ? "not-allowed" : "audio-capture");
    });
  }

  function stopMemoryRecognition(discard) {
    memoryRequestId += 1;
    clearMemoryStartTimer();
    clearMemoryRestartTimer();
    clearMemorySubmit();
    memoryStartPending = false;
    if (memoryRecorder && memoryRecorder.state !== "inactive") {
      memoryRecorder._discard = Boolean(discard);
      try { memoryRecorder.stop(); } catch (error) { /* no-op */ }
    }
    if (memoryRecognition) {
      var activeRecognition = memoryRecognition;
      if (discard) memoryHadError = true;
      try {
        if (discard) activeRecognition.abort();
        else activeRecognition.stop();
      } catch (error) { /* no-op */ }
      if (discard) memoryRecognition = null;
    }
    memoryIsListening = false;
    stopMemoryMicStream();
    setMemoryButton(false);
  }

  function pauseMemoryRecognition() {
    if (!memoryPipelineActive()) return;
    memorySeriesActive = false;
    stopMemoryRecognition(true);
    setMemoryStatus("memoryPaused", "memoryPausedSub", false);
    setMemorySeriesPhase("ready", "memorySeriesPaused", "memorySeriesPausedSub");
    setMemoryButton(false);
    saveState();
    showToast(t("memoryStoppedSaved"));
  }

  function startMemoryRecognition(internalRestart) {
    if (memoryStartPending || memoryIsListening || memorySubmitPending) return;
    if (!checkMemoryRecognitionSupport()) return;
    if (!internalRestart) {
      memorySeriesActive = true;
      if (memorySessionCounted || memoryRevealedCount > 0) prepareMemoryAttempt();
    }
    if (!memorySeriesActive) return;
    primeCueAudio();
    memoryHadError = false;
    memoryLastTranscript = "";
    memoryFullVerseMatched = false;
    document.getElementById("memory-transcript-text").textContent = t("memoryWaiting");
    getMemoryWordElements().forEach(function (word) { word.classList.remove("is-incorrect"); });
    if (getEffectiveRecognitionMode() === "quran") {
      startMemoryQuranRecognition();
      return;
    }
    memoryRecognition = createMemoryRecognition();
    if (!memoryRecognition) {
      handleMemoryRecognitionError("unsupported");
      return;
    }
    var requestId = ++memoryRequestId;
    memoryRecognition._allimRequestId = requestId;
    memoryStartPending = true;
    setMemoryStatus("memoryRequesting", "memoryRequestingSub", false);
    setMemorySeriesPhase("requesting", "memorySeriesRequesting", "memorySeriesRequestingSub");
    setMemoryButton(false);
    clearMemoryStartTimer();
    memoryStartTimer = window.setTimeout(function () {
      if (!memoryStartPending || requestId !== memoryRequestId) return;
      var pending = memoryRecognition;
      memoryRecognition = null;
      memoryRequestId += 1;
      memoryStartPending = false;
      if (pending) try { pending.abort(); } catch (error) { /* no-op */ }
      handleMemoryRecognitionError("mic-timeout");
    }, MIC_REQUEST_TIMEOUT);
    try {
      memoryRecognition.start();
    } catch (error) {
      handleMemoryRecognitionError("start-failed");
    }
  }

  function revealNextWord() {
    var next = document.querySelector("[data-answer-word]:not(.is-revealed)");
    if (!next) {
      showToast(t("allWordsVisible"));
      return;
    }
    memorySeriesActive = false;
    stopMemoryRecognition(true);
    memoryHadError = false;
    memoryHintsThisAttempt += 1;
    state.hints += 1;
    revealMemoryWord(next, true);
    if (!memorySessionCounted) {
      setMemoryStatus("memoryMicReady", "memoryHintOpened", false);
      showToast(t("memoryHintOpened"));
    }
    saveState();
    updateProgress();
  }

  function resetMemory() {
    clearAutoAdvance();
    memorySeriesActive = false;
    stopMemoryRecognition(true);
    prepareMemoryAttempt();
    setMemoryStatus("memoryMicReady", "memoryMicReadySub", false);
    setMemorySeriesPhase("ready", "memorySeriesReady", "memorySeriesReadySub");
    setMemoryButton(false);
    checkMemoryRecognitionSupport();
    showToast(t("memoryReset"));
  }

  function updateProgress() {
    document.getElementById("metric-sessions").textContent = formatMetric(state.sessions);
    document.getElementById("metric-words").textContent = formatMetric(state.wordsReviewed);
    document.getElementById("metric-hints").textContent = formatMetric(state.hints);
    updateDailyOverview();
    renderLifePracticeSummary();
    renderActivityHeatmap();
    renderLibraries();
    var empty = document.getElementById("empty-progress");
    var hasData = state.sessions > 0 || state.wordsReviewed > 0 || state.hints > 0;
    empty.classList.toggle("has-data", hasData);
    var title = empty.querySelector("h3");
    var copy = empty.querySelector("p");
    if (hasData) {
      title.textContent = t("dataPresentTitle");
      copy.textContent = t("dataPresentText");
    } else {
      title.textContent = t("noInventedStats");
      copy.textContent = t("noInventedStatsText");
    }
  }

  function showToast(message) {
    var toast = document.getElementById("toast");
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(function () { toast.classList.remove("is-visible"); }, 2600);
  }

  function initializeEvents() {
    document.querySelectorAll("[data-view]").forEach(function (button) {
      button.addEventListener("click", function () { navigate(button.getAttribute("data-view")); });
    });
    document.querySelectorAll("[data-go]").forEach(function (button) {
      button.addEventListener("click", function () { navigate(button.getAttribute("data-go")); });
    });
    document.getElementById("language-switch").addEventListener("change", function (event) { setLanguage(event.target.value); });
    document.getElementById("language-select").addEventListener("change", function (event) { setLanguage(event.target.value); });
    document.getElementById("daily-goal").addEventListener("change", function (event) {
      state.dailyGoal = [1, 2, 3, 5].indexOf(Number(event.target.value)) >= 0 ? Number(event.target.value) : 1;
      saveState();
      updateProgress();
    });
    document.getElementById("auto-advance-toggle").addEventListener("change", function (event) {
      state.autoAdvance = Boolean(event.target.checked);
      if (!state.autoAdvance) clearAutoAdvance();
      saveState();
      showToast(t(state.autoAdvance ? "autoAdvanceEnabled" : "autoAdvanceDisabled"));
    });
    document.getElementById("sound-cues-toggle").addEventListener("change", function (event) {
      state.soundCues = Boolean(event.target.checked);
      saveState();
      if (state.soundCues) {
        primeCueAudio();
        playStartCue();
      }
      showToast(t(state.soundCues ? "soundCuesEnabled" : "soundCuesDisabled"));
    });
    document.getElementById("strict-correction-toggle").addEventListener("change", function (event) {
      state.strictCorrection = Boolean(event.target.checked);
      if (!state.strictCorrection) clearCorrectionLock();
      saveState();
      showToast(t(state.strictCorrection ? "strictCorrectionEnabled" : "strictCorrectionDisabled"));
    });
    document.querySelectorAll("[data-recitation-flow]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (isListening || recognitionStartPending) return;
        var flow = button.getAttribute("data-recitation-flow") === "continuous" ? "continuous" : "single";
        stopContinuousSession();
        state.recitationFlow = flow;
        state.recitationFlowExplicit = true;
        updateRecitationFlowUi();
        if (flow === "continuous") {
          stopVerseAudio(false);
          document.getElementById("audio-panel").hidden = true;
          setStudioMode(false);
          setMushafMode(true);
          selectReaderMode("mushaf");
        }
        saveState();
        showToast(t(flow === "continuous" ? "continuousFlowEnabled" : "singleFlowEnabled"));
      });
    });
    document.querySelectorAll("[data-recognition-choice]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (isListening || memoryIsListening || recognitionStartPending || memoryStartPending) return;
        var mode = button.getAttribute("data-recognition-choice");
        if (mode === "quran" && !quranRecognitionSupported()) return;
        resetRecognitionView();
        stopMemoryRecognition(true);
        state.recognitionMode = ["auto", "browser", "quran"].indexOf(mode) >= 0 ? mode : "auto";
        state.recognitionModeExplicit = true;
        autoServerFallback = false;
        updateRecognitionModeUi();
        checkRecognitionSupport();
        checkMemoryRecognitionSupport();
        saveState();
        showToast(t("recognitionModeChanged"));
      });
    });
    document.getElementById("arabic-size").addEventListener("input", function (event) {
      state.arabicSize = Number(event.target.value);
      document.documentElement.style.setProperty("--arabic-size", state.arabicSize + "px");
      saveState();
    });
    document.getElementById("meaning-toggle").addEventListener("change", function (event) { setMeaningVisibility(event.target.checked); });
    document.getElementById("toggle-translation").addEventListener("click", function () { setMeaningVisibility(!state.showMeaning); });
    document.getElementById("surah-select").addEventListener("change", function (event) {
      state.selectedSurah = Number(event.target.value);
      state.selectedAyah = 1;
      populateVerseSelectors();
      selectVerseByReference(state.selectedSurah, state.selectedAyah, { navigate: false });
    });
    document.getElementById("ayah-select").addEventListener("change", function (event) {
      state.selectedAyah = Number(event.target.value);
      selectVerseByReference(state.selectedSurah, state.selectedAyah, { navigate: false });
    });
    document.getElementById("tafsir-surah-select").addEventListener("change", function (event) {
      state.selectedSurah = Number(event.target.value);
      state.selectedAyah = 1;
      populateVerseSelectors();
      selectVerseByReference(state.selectedSurah, state.selectedAyah, { navigate: false });
    });
    document.getElementById("tafsir-ayah-select").addEventListener("change", function (event) {
      state.selectedAyah = Number(event.target.value);
      populateVerseSelectors();
      selectVerseByReference(state.selectedSurah, state.selectedAyah, { navigate: false });
    });
    document.querySelectorAll("[data-tafsir-prompt]").forEach(function (button) {
      button.addEventListener("click", function () {
        renderTafsirAnswer(button.getAttribute("data-tafsir-prompt"));
      });
    });
    document.getElementById("tafsir-question-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var input = document.getElementById("tafsir-question");
      var question = input.value.trim();
      if (!question) {
        input.focus();
        return;
      }
      renderTafsirAnswer("", question);
    });
    document.getElementById("next-ayah").addEventListener("click", goToNextVerse);
    document.getElementById("start-recognition").addEventListener("click", function () { startRecognition(false); });
    document.getElementById("mobile-recognition-toggle").addEventListener("click", toggleMobileRecognition);
    document.getElementById("bookmark-verse").addEventListener("click", toggleSavedVerse);
    document.getElementById("save-verse").addEventListener("click", toggleSavedVerse);
    document.getElementById("queue-review").addEventListener("click", toggleReviewVerse);
    document.getElementById("open-studio").addEventListener("click", function () { setStudioMode(true); });
    document.getElementById("studio-exit").addEventListener("click", function () { setStudioMode(false); });
    document.getElementById("interlinear-toggle").addEventListener("click", function () {
      var willShow = !state.showInterlinear;
      if (willShow) {
        setMushafMode(false);
        selectReaderMode("read");
      }
      state.showInterlinear = willShow;
      renderSelectedVerse(false);
      saveState();
      showToast(t(state.showInterlinear ? "interlinearOn" : "interlinearOff"));
    });
    document.getElementById("play-demo-audio").addEventListener("click", function () {
      if (document.body.classList.contains("mushaf-view")) {
        playVerseAudio();
        return;
      }
      setMushafMode(false);
      selectReaderMode("listen");
      activateAudioMode();
    });
    document.getElementById("mushaf-play-audio").addEventListener("click", function () {
      playVerseAudio();
    });
    document.getElementById("audio-play-toggle").addEventListener("click", playVerseAudio);
    document.getElementById("audio-stop").addEventListener("click", function () { stopVerseAudio(true); });
    document.getElementById("download-surah-audio").addEventListener("click", downloadCurrentSurahAudio);
    document.getElementById("audio-repeat").addEventListener("click", function () {
      state.audioRepeat = !state.audioRepeat;
      saveState();
      updateAudioControls();
      showToast(t(state.audioRepeat ? "repeatAudioOn" : "repeatAudioOff"));
    });
    document.getElementById("audio-next").addEventListener("click", function () {
      if (goToNextVerse("audio")) window.setTimeout(playVerseAudio, 120);
    });
    document.getElementById("reciter-select").addEventListener("change", function (event) {
      var requestedReciter = event.target.value;
      var shouldResume = verseAudioPlaying && !verseAudioPaused;
      state.selectedReciter = reciters.some(function (reciter) { return reciter.id === requestedReciter; }) ? requestedReciter : "husary";
      saveState();
      stopVerseAudio(false);
      updateAudioControls();
      showToast(formatText("reciterChanged", { name: getSelectedReciter().names[state.language] || getSelectedReciter().names.en }));
      if (getSelectedReciter().provider === "chapter") showToast(t("chapterAudioScope"));
      if (shouldResume) window.setTimeout(playVerseAudio, 120);
    });
    document.getElementById("audio-seek").addEventListener("input", function (event) {
      var audio = document.getElementById("verse-audio");
      if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
      audio.currentTime = (Number(event.target.value) / 1000) * audio.duration;
      updateAudioTimeline();
    });
    var verseAudioElement = document.getElementById("verse-audio");
    verseAudioElement.addEventListener("loadedmetadata", updateAudioTimeline);
    verseAudioElement.addEventListener("durationchange", updateAudioTimeline);
    verseAudioElement.addEventListener("timeupdate", updateAudioTimeline);
    verseAudioElement.addEventListener("waiting", function () { if (verseAudioPlaying) setAudioMeta("audioLoading"); });
    verseAudioElement.addEventListener("canplay", function () { setAudioMeta(); });
    verseAudioElement.addEventListener("play", function () {
      verseAudioPlaying = true;
      verseAudioPaused = false;
      setAudioMeta();
      updateAudioControls();
      if (verseAudioElement.currentTime < .25) showToast(t(getSelectedReciter().provider === "chapter" ? "chapterAudioStarted" : "audioPlaying"));
    });
    verseAudioElement.addEventListener("pause", function () {
      if (!verseAudioPlaying || verseAudioElement.ended) return;
      verseAudioPaused = true;
      updateAudioControls();
    });
    verseAudioElement.addEventListener("ended", handleVerseAudioEnded);
    verseAudioElement.addEventListener("error", handleVerseAudioError);
    document.querySelectorAll("[data-side-tab]").forEach(function (button) {
      button.addEventListener("click", function () { selectSidePanelTab(button.getAttribute("data-side-tab")); });
    });
    document.querySelectorAll("[data-ai-prompt]").forEach(function (button) {
      button.addEventListener("click", function () {
        selectSidePanelTab("ai");
        updateAiMentor(button.getAttribute("data-ai-prompt"));
      });
    });
    document.getElementById("start-memory-recognition").addEventListener("click", startActiveMemorizationStep);
    document.getElementById("stop-memory-recognition").addEventListener("click", pauseMemoryRecognition);
    document.getElementById("memory-quick-stop").addEventListener("click", pauseMemoryRecognition);
    document.getElementById("reveal-word").addEventListener("click", revealNextWord);
    document.getElementById("reset-memory").addEventListener("click", resetMemory);
    document.getElementById("heart-surah-select").addEventListener("change", function (event) {
      state.selectedSurah = Number(event.target.value);
      state.selectedAyah = 1;
      populateVerseSelectors();
      selectVerseByReference(state.selectedSurah, state.selectedAyah, { navigate: false });
    });
    document.getElementById("heart-ayah-select").addEventListener("change", function (event) {
      state.selectedAyah = Number(event.target.value);
      populateVerseSelectors();
      selectVerseByReference(state.selectedSurah, state.selectedAyah, { navigate: false });
    });
    document.getElementById("heart-start-practice").addEventListener("click", startActiveMemorizationStep);
    document.querySelectorAll("[data-hifz-method]").forEach(function (button) {
      button.addEventListener("click", function () { selectMemorizationMethod(button.getAttribute("data-hifz-method"), true); });
    });
    document.querySelectorAll("[data-hifz-choice-mode]").forEach(function (button) {
      button.addEventListener("click", function () { setHifzChoiceMode(button.getAttribute("data-hifz-choice-mode"), true); });
    });
    document.getElementById("lawh-photo-input").addEventListener("change", handleLawhPhoto);
    document.getElementById("lawh-save-local").addEventListener("click", saveCurrentLawhPage);
    document.querySelectorAll("[data-lawh-check]").forEach(function (checkbox) {
      checkbox.addEventListener("change", updateLawhVerificationButton);
    });
    document.getElementById("lawh-verify-page").addEventListener("click", confirmLawhVerification);
    document.getElementById("lawh-mark-read").addEventListener("click", function () { recordLawhPractice("read"); });
    document.getElementById("lawh-mark-recall").addEventListener("click", function () { recordLawhPractice("recall"); });
    document.getElementById("start-page-recall").addEventListener("click", enterPageRecall);
    document.getElementById("page-recall-mic").addEventListener("click", function () { startRecognition(false); });
    document.getElementById("toggle-page-recall-text").addEventListener("click", function () {
      if (!pageRecallSession) return;
      pageRecallShowText = !pageRecallShowText;
      document.body.classList.toggle("page-recall-show-text", pageRecallShowText);
      updatePageRecallUi();
    });
    document.getElementById("exit-page-recall").addEventListener("click", finishPageRecall);
    document.querySelectorAll("[data-cancel-auto-advance]").forEach(function (button) {
      button.addEventListener("click", function () {
        continuousResumePending = false;
        clearAutoAdvance();
        showToast(t("autoAdvanceCancelled"));
      });
    });
    document.getElementById("clear-progress").addEventListener("click", function () {
      if (!window.confirm(t("confirmClear"))) return;
      if (window.ALLIMReading && !window.ALLIMReading.clear()) return;
      state.sessions = 0;
      state.wordsReviewed = 0;
      state.hints = 0;
      state.activity = {};
      state.heartMushaf = { units: {}, pages: {}, linked33Pages: {}, turkishWallPages: {}, lawhPages: {} };
      state.hifzCoach.signals = [];
      releaseLawhPhotoUrl();
      lawhDraftBlob = null;
      lawhDraftMeta = null;
      lawhDraftReady = false;
      lawhDraftVerified = false;
      lawhDraftKey = "";
      lawhDraftStored = false;
      lawhStorageState = "idle";
      resetLawhDraftChecks();
      var lawhPreview = document.getElementById("lawh-preview");
      if (lawhPreview) lawhPreview.hidden = true;
      linkedPageSession = null;
      linked33Session = null;
      memoryPracticeContext = null;
      heartCurrentPageData = null;
      heartPageCache = {};
      heartVersePageCache = {};
      saveState();
      resetLawhStoredProgress();
      updateProgress();
      renderHeartMushaf();
      renderHeartReadCounter();
      showToast(t("progressCleared"));
    });
    document.querySelectorAll("[data-reader-mode]").forEach(function (button) {
      button.addEventListener("click", function () {
        var mode = button.getAttribute("data-reader-mode");
        selectReaderMode(mode);
        if (mode === "focus") {
          document.body.classList.remove("audio-view");
          setMushafMode(false);
          stopVerseAudio(false);
          document.getElementById("audio-panel").hidden = true;
          setStudioMode(true);
          showToast(t("focusMode"));
        } else if (mode === "mushaf") {
          document.body.classList.remove("audio-view");
          stopVerseAudio(false);
          document.getElementById("audio-panel").hidden = true;
          setStudioMode(false);
          setMushafMode(true);
          selectReaderMode("mushaf");
          showToast(t("mushafModeOn"));
        } else if (mode === "listen") {
          setMushafMode(false);
          activateAudioMode();
        } else {
          exitMushafToReading(false);
        }
      });
    });
    document.getElementById("mushaf-exit").addEventListener("click", function () { exitMushafToReading(true); });
    document.getElementById("mushaf-prev-page").addEventListener("click", function () { navigateMushafPage(-1); });
    document.getElementById("mushaf-next-page").addEventListener("click", function () { navigateMushafPage(1); });
    document.getElementById("mushaf-page-number").addEventListener("change", function (event) { loadMushafPage(event.target.value, true); });
    var mushafPage = document.getElementById("mushaf-page");
    mushafPage.addEventListener("touchstart", function (event) {
      if (event.touches.length !== 1) return;
      mushafSwipeStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }, { passive: true });
    mushafPage.addEventListener("touchend", function (event) {
      if (!mushafSwipeStart || !event.changedTouches.length) return;
      var deltaX = event.changedTouches[0].clientX - mushafSwipeStart.x;
      var deltaY = event.changedTouches[0].clientY - mushafSwipeStart.y;
      mushafSwipeStart = null;
      if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
      navigateMushafPage(deltaX < 0 ? 1 : -1);
    }, { passive: true });
    mushafPage.addEventListener("touchcancel", function () { mushafSwipeStart = null; }, { passive: true });
    document.getElementById("mushaf-font-select").addEventListener("change", function (event) {
      state.mushafFont = ["classic", "modern", "readable"].indexOf(event.target.value) >= 0 ? event.target.value : "classic";
      heartPageCache = {};
      heartVersePageCache = {};
      heartCurrentPageData = null;
      saveState();
      loadMushafPage(mushafPageNumber, false).then(function () {
        var openDialog = document.getElementById("heart-page-dialog");
        if (openDialog && openDialog.open && heartCurrentPageData) renderHeartPageDialog(heartCurrentPageData);
      });
      var picker = event.target.closest(".mushaf-appearance-picker");
      if (picker) picker.open = false;
      showToast(t("mushafFontChanged"));
    });
    document.querySelectorAll("[data-mushaf-paper-choice]").forEach(function (button) {
      button.addEventListener("click", function () {
        var choice = button.getAttribute("data-mushaf-paper-choice");
        if (["ivory", "white", "sage", "mist", "sky"].indexOf(choice) < 0) return;
        state.mushafPaper = choice;
        saveState();
        applyMushafAppearance();
        var picker = button.closest(".mushaf-appearance-picker");
        if (picker) picker.open = false;
        showToast(t("mushafAppearanceChanged"));
      });
    });
    document.querySelectorAll("[data-mushaf-ink-choice]").forEach(function (button) {
      button.addEventListener("click", function () {
        var choice = button.getAttribute("data-mushaf-ink-choice");
        if (["charcoal", "emerald", "navy", "sepia"].indexOf(choice) < 0) return;
        state.mushafInk = choice;
        saveState();
        applyMushafAppearance();
        var picker = button.closest(".mushaf-appearance-picker");
        if (picker) picker.open = false;
        showToast(t("mushafAppearanceChanged"));
      });
    });
    document.addEventListener("pointerdown", function (event) {
      var picker = document.querySelector(".mushaf-appearance-picker[open]");
      if (picker && !picker.contains(event.target)) picker.open = false;
      var modePicker = document.querySelector(".reader-mode-picker[open]");
      if (modePicker && !modePicker.contains(event.target)) modePicker.open = false;
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var picker = document.querySelector(".mushaf-appearance-picker[open]");
      if (picker) picker.open = false;
      var modePicker = document.querySelector(".reader-mode-picker[open]");
      if (modePicker) modePicker.open = false;
    });
    window.addEventListener("resize", function () {
      if (document.body.classList.contains("mushaf-view")) fitMushafLines(document.getElementById("mushaf-page"));
      var heartDialog = document.getElementById("heart-page-dialog");
      if (heartDialog && heartDialog.open) fitHeartMushafLines(document.getElementById("heart-page-sheet"));
    }, { passive: true });

    var heartPageDialog = document.getElementById("heart-page-dialog");
    document.getElementById("open-heart-page").addEventListener("click", openHeartPageDialog);
    document.getElementById("heart-page-launch").addEventListener("click", openHeartPageDialog);
    document.getElementById("close-heart-page").addEventListener("click", function () { heartPageDialog.close(); });
    document.getElementById("continue-heart-page").addEventListener("click", continueHeartPage);
    document.getElementById("start-linked-page").addEventListener("click", startLinkedPageReading);
    heartPageDialog.addEventListener("click", function (event) { if (event.target === heartPageDialog) heartPageDialog.close(); });

    var lifePracticeDialog = document.getElementById("life-practice-dialog");
    ["open-life-practice-today", "open-life-practice", "open-life-practice-ai"].forEach(function (id) {
      document.getElementById(id).addEventListener("click", openLifePracticeDialog);
    });
    document.getElementById("close-life-practice").addEventListener("click", function () { lifePracticeDialog.close(); });
    lifePracticeDialog.addEventListener("click", function (event) { if (event.target === lifePracticeDialog) lifePracticeDialog.close(); });
    document.getElementById("life-practice-form").addEventListener("submit", function (event) {
      event.preventDefault();
      if (saveLifePractice(false)) lifePracticeDialog.close();
    });
    document.getElementById("life-complete").addEventListener("click", function () {
      if (saveLifePractice(true)) lifePracticeDialog.close();
    });
    document.getElementById("life-ai-suggest").addEventListener("click", suggestLifeAction);
    ["life-trigger"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", resetLifeAiReview);
    });
    ["life-reflection", "life-action"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", function () {
        var options = document.getElementById("life-ai-options");
        if (!options.hidden) renderLifeAiChecks(analyzeLifePlan(document.getElementById("life-reflection").value.trim(), document.getElementById("life-action").value.trim()));
      });
    });

    var quranSearchDialog = document.getElementById("quran-search-dialog");
    var quranSearchInput = document.getElementById("quran-search-input");
    var quranSearchResults = document.getElementById("quran-search-results");
    document.getElementById("open-quran-search").addEventListener("click", openQuranSearch);
    document.getElementById("close-quran-search").addEventListener("click", function () { quranSearchDialog.close(); });
    quranSearchInput.addEventListener("input", function (event) { renderQuranSearchResults(event.target.value); });
    quranSearchInput.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      var first = quranSearchResults.querySelector("button");
      if (first) first.click();
    });
    document.querySelectorAll("[data-quran-query]").forEach(function (button) {
      button.addEventListener("click", function () {
        quranSearchInput.value = button.getAttribute("data-quran-query") || "";
        renderQuranSearchResults(quranSearchInput.value);
        quranSearchInput.focus();
      });
    });
    quranSearchResults.addEventListener("click", function (event) {
      var button = event.target.closest("button");
      if (!button) return;
      var reference = button.getAttribute("data-quran-reference");
      var page = Number(button.getAttribute("data-quran-page"));
      var surah = Number(button.getAttribute("data-quran-surah"));
      quranSearchDialog.close();
      if (reference) {
        var parts = reference.split(":");
        selectVerseByReference(Number(parts[0]), Number(parts[1]), { navigate: true, forceRemote: true });
      } else if (page) {
        navigate("read");
        setStudioMode(false);
        setMushafMode(true);
        selectReaderMode("mushaf");
        loadMushafPage(page, true).then(function () {
          if (mushafPageVerses[0]) activateMushafVerse(mushafPageVerses[0], true);
        });
      } else if (surah) {
        selectVerseByReference(surah, 1, { navigate: true, forceRemote: true });
      }
    });
    quranSearchDialog.addEventListener("click", function (event) { if (event.target === quranSearchDialog) quranSearchDialog.close(); });
    document.addEventListener("keydown", function (event) {
      var target = event.target;
      var typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (event.key === "/" && !typing && document.getElementById("view-read").classList.contains("is-active")) {
        event.preventDefault();
        openQuranSearch();
      }
      if (!typing && document.body.classList.contains("mushaf-view") && event.key === "Escape") {
        event.preventDefault();
        exitMushafToReading(false);
      }
      if (!typing && document.body.classList.contains("mushaf-view") && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        navigateMushafPage(event.key === "ArrowLeft" ? 1 : -1);
      }
    });

    var dialog = document.getElementById("source-dialog");
    document.getElementById("source-button").addEventListener("click", function () { dialog.showModal(); });
    document.getElementById("close-source").addEventListener("click", function () { dialog.close(); });
    document.querySelector("[data-close-dialog]").addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });

    var guide = document.getElementById("guide-dialog");
    document.getElementById("guide-button").addEventListener("click", function () { guide.showModal(); });
    document.getElementById("close-guide").addEventListener("click", function () { guide.close(); });
    document.getElementById("guide-done").addEventListener("click", function () { guide.close(); navigate("read"); });
    guide.addEventListener("click", function (event) { if (event.target === guide) guide.close(); });
  }

  function initialize() {
    if (window.__allimLearnInitialized) return;
    window.__allimLearnInitialized = true;
    var isFilePreview = window.location.protocol === "file:";
    var isLocalPreview = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    document.querySelectorAll("[data-home-link]").forEach(function (link) {
      link.setAttribute("href", isFilePreview ? "https://allimquran.com/" : (isLocalPreview ? "/homepage/?v=5" : "/"));
    });
    document.querySelectorAll("[data-academy-link]").forEach(function (link) {
      link.setAttribute("href", isFilePreview ? "https://allimquran.com/academy" : (isLocalPreview ? "/academy/?v=1" : "/academy"));
    });
    var launchLanguage = launchParams.get("lang");
    var sharedLanguage = readLanguagePreference();
    var normalizedLaunchLanguage = normalizePlatformLanguage(launchLanguage);
    if (normalizedLaunchLanguage) state.language = normalizedLaunchLanguage;
    else if (sharedLanguage) state.language = sharedLanguage;
    else state.language = normalizePlatformLanguage(state.language) || defaultState.language;
    applyMushafAppearance();
    initializeEvents();
    if (window.ALLIMReading) window.ALLIMReading.init({ page: fetchHeartPageData, versePage: fetchHeartPageForVerse, currentPage: function () { return mushafPageNumber; } });
    document.documentElement.style.setProperty("--arabic-size", state.arabicSize + "px");
    document.getElementById("arabic-size").value = String(state.arabicSize);
    document.getElementById("daily-goal").value = String(state.dailyGoal);
    document.getElementById("auto-advance-toggle").checked = state.autoAdvance !== false;
    document.getElementById("sound-cues-toggle").checked = state.soundCues !== false;
    document.getElementById("strict-correction-toggle").checked = state.strictCorrection !== false;
    updateRecitationFlowUi();
    updateAudioDownloadUi();
    var initialSelectedSurah = Number(state.selectedSurah) || 2;
    var initialSelectedAyah = Number(state.selectedAyah) || 2;
    setLanguage(state.language);
    loadMushafChapterNames().then(function () {
      state.selectedSurah = initialSelectedSurah;
      state.selectedAyah = initialSelectedAyah;
      populateVerseSelectors();
      renderQuranSearchResults("");
      var localInitial = getLocalVerseExact(getLocalSurahExact(initialSelectedSurah), initialSelectedAyah);
      if (!localInitial) selectVerseByReference(initialSelectedSurah, initialSelectedAyah, { navigate: false, forceRemote: true });
      else updateNextButton();
    });
    setMeaningVisibility(state.showMeaning);
    selectSidePanelTab("ai");
    checkAudioSupport();
    checkRecognitionSupport();
    checkQuranAsrService();
    updateProgress();
    updatePageRecallUi();
    getPageRecallAcademyAccess(false);
    var requestedView = new URLSearchParams(window.location.search).get("view");
    if (Object.prototype.hasOwnProperty.call(viewTitles, requestedView)) navigate(requestedView);
    initializeTeacherAssessmentMode();
    if ("serviceWorker" in navigator && isLocalPreview) {
      navigator.serviceWorker.register("sw.js?v=87").catch(function () {
        return null;
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
}());
