(function(){
  "use strict";
  var appStorageKey="quran-companion-prototype-v4";
  var planStorageKey="allim-academy-plan-v1";
  var copies={
    ru:{planSaved:"План сохранён",guestCourses:"Войдите, чтобы увидеть свои курсы",guestCoursesText:"Базовый кабинет и Companion остаются доступными без оплаты.",noCourses:"Зачислений на курсы пока нет",noCoursesText:"Выберите опубликованную программу, когда будете готовы добавить системное обучение.",openCourse:"Открыть курс",inProgress:"В ПРОЦЕССЕ",guidedActive:"Доступ с преподавателем активен",connected:"Подключён",signedIn:"Аккаунт подключён",serverUnavailable:"Данные курсов временно недоступны",serverUnavailableText:"Базовый кабинет продолжает работать. Попробуйте обновить страницу позже.",teacherAssigned:"Преподаватель назначен",openGroup:"Открыть группу",signIn:"Войти",notConnected:"Не подключён",basicAccess:"Базовый доступ",noFeedback:"Новых комментариев нет",starterBadge:"СТАРТОВЫЙ ПУТЬ",starterTitle:"От алифа до Аль‑Фатихи",starterText:"Интересный путь от первых звуков и букв к самостоятельному чтению коротких коранических фрагментов.",starterAction:"Посмотреть программу"},
    en:{skip:"Skip to content",cabinetNav:"Cabinet navigation",navOverview:"My path",navCourses:"My courses",navTeacher:"Teacher",navProgress:"Progress",duaMeaning:"O Allah, teach him the Book.",openCompanion:"Open Companion",studentCabinet:"STUDENT CABINET",pageTitle:"Your path with the Qur’an",deviceProgress:"On-device progress",changeLanguage:"Change language",signIn:"Sign in",basicAccess:"Basic access",salam:"As-salāmu ʿalaykum",welcomeText:"One clear step is enough today: recite, recall, understand and return on time.",editPlan:"Edit plan",todayPlan:"TODAY’S PLAN",minutes:"minutes of focus",recite:"Recite aloud",reciteHint:"Continue from the selected verse",memorize:"Recall without text",memorizeHint:"Strengthen a page in the heart",understand:"Understand the verse",understandHint:"Word, root and tafsir",review:"Return on time",ayahForReview:"verses to review",startLesson:"Start lesson",todaySessions:"Today",completedSessions:"completed sessions",streak:"Streak",days:"days",streakHint:"of regular return",myCourses:"My courses",courseHint:"active learning paths",heartBook:"HIFZ BOOK",heartTitle:"Qur’an in the heart",heartText:"Pages are revealed by accurate repetitions and kept alive through regular return.",continueHifz:"Continue building",acceptedRepeats:"accepted repetitions",securedAyat:"verses secured",dueForReview:"due for review",twoLevels:"TWO LEVELS, ONE PATH",basicTitle:"Basic cabinet",basicText:"Personal plan, Companion, hifz, reviews, courses and progress history.",included:"Included",guidedTitle:"With a teacher",guidedText:"Schedule, assignments, recitation review, feedback and study history.",notConnected:"Not connected",seeGuided:"See guided learning",learningPaths:"LEARNING PATHS",coursesTitle:"My courses and programs",coursesLead:"Only real enrollments and actual progress appear here.",browseCourses:"Browse programs",loadingCourses:"Checking your courses…",loadingCoursesText:"Basic learning in Companion is already available.",guidedAcademy:"GUIDED ACADEMY",teacherTitle:"Live guidance",teacherLead:"Teacher, schedule and feedback open only after a real cohort enrollment.",checkingAccess:"Checking access",yourTeacher:"YOUR TEACHER",teacherUnassigned:"Not assigned yet",teacherEmpty:"After enrollment, the teacher, program and in-Academy contact options will appear here.",findProgram:"Choose a program",nextLesson:"Next lesson",notScheduled:"Not scheduled",scheduleAppears:"Date and time appear after cohort confirmation.",latestAssignment:"Latest assignment",noAssignments:"No active assignments",assignmentAppears:"Assignments and reviewed results will be collected here.",feedback:"Feedback",noFeedback:"No new comments",feedbackHint:"Comments stay connected to a specific assignment or recitation.",humanTrust:"The teacher remains central.",humanTrustText:"Automated feedback supports practice between lessons, but does not replace live correction or grant ijazah.",evidenceTitle:"FACTUAL DATA ONLY",progressTitle:"Your progress",progressLead:"On-device Companion activity and enrolled-course progress are shown separately.",companionProgress:"Companion on this device",allSessions:"completed sessions in total",savedAyat:"saved verses",reviewQueue:"in review queue",reviewedWords:"reviewed words",fiveWeeks:"Last five weeks",activityHint:"Color represents completed sessions per day.",courseProgress:"Course progress",courseProgressEmpty:"Sign in to see server progress for enrolled courses.",personalPlan:"PERSONAL PLAN",planDialogTitle:"Set your learning rhythm",dailyTime:"Time per day",mainFocus:"Main focus",focusRecitation:"Recitation",focusMemorization:"Memorization",focusArabic:"Qur’anic Arabic",focusTafsir:"Tafsir",currentTarget:"Current goal",targetPlaceholder:"For example: strengthen Surah al-Mulk",planPrivacy:"Your plan stays private. Account sync will be shown separately.",cancel:"Cancel",savePlan:"Save plan",planSaved:"Plan saved",guestCourses:"Sign in to see your courses",guestCoursesText:"Your basic cabinet and Companion remain available without payment.",noCourses:"No course enrollments yet",noCoursesText:"Choose a published program when you are ready to add structured study.",openCourse:"Open course",inProgress:"IN PROGRESS",guidedActive:"Teacher access active",connected:"Connected",signedIn:"Account connected",serverUnavailable:"Course data is temporarily unavailable",serverUnavailableText:"The basic cabinet continues to work. Try refreshing this page later.",teacherAssigned:"Teacher assigned",openGroup:"Open group",starterBadge:"STARTING PATH",starterTitle:"From alif to Al-Fatihah",starterText:"An engaging path from first sounds and letters to independent reading of short Qur’anic passages.",starterAction:"View the curriculum"},
    ar:{skip:"انتقل إلى المحتوى",cabinetNav:"تنقل لوحة الطالب",navOverview:"مساري",navCourses:"دوراتي",navTeacher:"المعلّم",navProgress:"التقدم",duaMeaning:"اللهم علّمه الكتاب.",openCompanion:"افتح الرفيق",studentCabinet:"لوحة الطالب",pageTitle:"رحلتك مع القرآن",deviceProgress:"تقدم هذا الجهاز",changeLanguage:"تغيير اللغة",signIn:"تسجيل الدخول",basicAccess:"الوصول الأساسي",salam:"السلام عليكم",welcomeText:"تكفي اليوم خطوة واضحة: اقرأ واستحضر وافهم وعُد في وقتها.",editPlan:"ضبط الخطة",todayPlan:"خطة اليوم",minutes:"دقيقة من التركيز",recite:"التلاوة بصوت",reciteHint:"تابع من الآية المختارة",memorize:"استحضر بلا نص",memorizeHint:"ثبّت صفحة في القلب",understand:"افهم الآية",understandHint:"الكلمة والجذر والتفسير",review:"عُد في وقتها",ayahForReview:"آيات للمراجعة",startLesson:"ابدأ الدرس",todaySessions:"اليوم",completedSessions:"جلسات مكتملة",streak:"السلسلة",days:"أيام",streakHint:"من العودة المنتظمة",myCourses:"دوراتي",courseHint:"مسارات تعلم نشطة",heartBook:"كتاب الحفظ",heartTitle:"القرآن في القلب",heartText:"تظهر الصفحات بالتكرار الصحيح وتبقى حية بالمراجعة المنتظمة.",continueHifz:"تابع البناء",acceptedRepeats:"تكرارات مقبولة",securedAyat:"آيات مثبتة",dueForReview:"حان وقت مراجعتها",twoLevels:"مستويان لمسار واحد",basicTitle:"اللوحة الأساسية",basicText:"خطة شخصية ورفيق وحفظ ومراجعة ودورات وسجل تقدم.",included:"مشمول",guidedTitle:"مع معلّم",guidedText:"جدول وواجبات وتصحيح تلاوة وتغذية راجعة وسجل دراسة.",notConnected:"غير متصل",seeGuided:"عرض التعلم الموجّه",learningPaths:"مسارات التعلم",coursesTitle:"دوراتي وبرامجي",coursesLead:"تظهر هنا التسجيلات الحقيقية والتقدم الفعلي فقط.",browseCourses:"تصفح البرامج",loadingCourses:"جارٍ فحص دوراتك…",loadingCoursesText:"التعلم الأساسي في الرفيق متاح الآن.",guidedAcademy:"الأكاديمية الموجّهة",teacherTitle:"توجيه حي",teacherLead:"لا يظهر المعلّم والجدول والملاحظات إلا بعد تسجيل حقيقي في مجموعة.",checkingAccess:"جارٍ فحص الوصول",yourTeacher:"معلّمك",teacherUnassigned:"لم يُعيّن بعد",teacherEmpty:"بعد التسجيل يظهر اسم المعلّم والبرنامج ووسائل التواصل داخل الأكاديمية.",findProgram:"اختر برنامجًا",nextLesson:"الدرس القادم",notScheduled:"غير مجدول",scheduleAppears:"يظهر التاريخ والوقت بعد تأكيد المجموعة.",latestAssignment:"آخر واجب",noAssignments:"لا واجبات نشطة",assignmentAppears:"تُجمع الواجبات ونتائج التصحيح هنا.",feedback:"التغذية الراجعة",noFeedback:"لا تعليقات جديدة",feedbackHint:"ترتبط التعليقات بواجب أو تلاوة محددة.",humanTrust:"يبقى المعلّم في المركز.",humanTrustText:"يدعم التصحيح الآلي التدريب بين الدروس، ولا يستبدل التصحيح الحي ولا يمنح الإجازة.",evidenceTitle:"بيانات فعلية فقط",progressTitle:"تقدمك",progressLead:"يظهر تقدم الرفيق على هذا الجهاز وتقدم الدورات المسجلة بصورة منفصلة.",companionProgress:"الرفيق على هذا الجهاز",allSessions:"إجمالي الجلسات المكتملة",savedAyat:"آيات محفوظة",reviewQueue:"في قائمة المراجعة",reviewedWords:"كلمات روجعت",fiveWeeks:"آخر خمسة أسابيع",activityHint:"يمثل اللون عدد الجلسات المكتملة يوميًا.",courseProgress:"تقدم الدورات",courseProgressEmpty:"سجّل الدخول لرؤية تقدم الدورات المسجلة.",personalPlan:"الخطة الشخصية",planDialogTitle:"اضبط إيقاع تعلمك",dailyTime:"الوقت اليومي",mainFocus:"التركيز الرئيس",focusRecitation:"التلاوة",focusMemorization:"الحفظ",focusArabic:"العربية القرآنية",focusTafsir:"التفسير",currentTarget:"الهدف الحالي",targetPlaceholder:"مثال: تثبيت سورة الملك",planPrivacy:"تبقى خطتك خاصة. سيظهر خيار مزامنة الحساب بصورة منفصلة.",cancel:"إلغاء",savePlan:"حفظ الخطة",planSaved:"حُفظت الخطة",guestCourses:"سجّل الدخول لرؤية دوراتك",guestCoursesText:"تبقى اللوحة الأساسية والرفيق متاحين دون دفع.",noCourses:"لا تسجيلات في دورات بعد",noCoursesText:"اختر برنامجًا منشورًا حين تستعد للدراسة المنظمة.",openCourse:"افتح الدورة",inProgress:"قيد التقدم",guidedActive:"وصول المعلّم نشط",connected:"متصل",signedIn:"الحساب متصل",serverUnavailable:"بيانات الدورات غير متاحة مؤقتًا",serverUnavailableText:"تستمر اللوحة الأساسية بالعمل. حاول تحديث الصفحة لاحقًا.",teacherAssigned:"تم تعيين المعلّم",openGroup:"افتح المجموعة",starterBadge:"مسار البداية",starterTitle:"من الألف إلى الفاتحة",starterText:"مسار ممتع من الأصوات والحروف الأولى إلى قراءة مقاطع قرآنية قصيرة باستقلال.",starterAction:"شاهد المنهج"}
  };
  Object.assign(copies.ru,{
    threeLevels:"ТРИ УРОВНЯ ОДНОГО ПУТИ",
    openTitle:"Открытый доступ",
    openText:"Коран, чтение и базовая проверка слов — свободно, без регистрации.",
    alwaysOpen:"Всегда открыт",
    basicTitle:"Базовый кабинет",
    basicText:"Личный план, первичное обучение, «Коран в сердце», проверка страницы наизусть, курсы и история прогресса.",
    guidedTitle:"ALLIM Academy с преподавателем",
    guidedText:"Живое исправление чтения, задания, расписание, личная обратная связь и сопровождение преподавателя.",
    advancedRecallEyebrow:"ПРАКТИКА ХИФЗА В БАЗОВОМ КАБИНЕТЕ",
    advancedRecallTitle:"Проверка страницы наизусть",
    advancedRecallText:"Настоящая геометрия мусхафа остаётся на экране, текст скрывается, а правильные слова проявляются по порядку. Результат сохраняется в личной истории.",
    advancedRecallPoint1:"Связное чтение всей страницы",
    advancedRecallPoint2:"Остановка на ошибке до исправления",
    advancedRecallPoint3:"История самостоятельных проверок",
    secondAccessLocked:"Войдите в базовый кабинет",
    secondAccessActive:"Второй доступ активен",
    startPageRecall:"Начать проверку страницы",
    signInAndOpen:"Войти и открыть",
    openAccess:"Открытый доступ",
    levelThreeActive:"Третий доступ · преподаватель"
  });
  Object.assign(copies.en,{
    threeLevels:"THREE LEVELS, ONE PATH",
    openTitle:"Open access",
    openText:"The Qur’an, reading and basic word checking are open to everyone without registration.",
    alwaysOpen:"Always open",
    basicTitle:"Basic cabinet",
    basicText:"A personal plan, foundation learning, Qur’an in the Heart, full-page recall, courses and progress history.",
    guidedTitle:"ALLIM Academy with a teacher",
    guidedText:"Live recitation correction, assignments, schedule, personal feedback and teacher guidance.",
    advancedRecallEyebrow:"HIFZ PRACTICE IN THE BASIC CABINET",
    advancedRecallTitle:"Recall a full page from memory",
    advancedRecallText:"The real Mushaf page geometry stays in place while the text is hidden and correctly recited words appear in order. The result is saved to your personal history.",
    advancedRecallPoint1:"Continuous recitation of the full page",
    advancedRecallPoint2:"Pause on an error until it is corrected",
    advancedRecallPoint3:"History of independent checks",
    secondAccessLocked:"Sign in to the basic cabinet",
    secondAccessActive:"Level-two access is active",
    startPageRecall:"Start full-page recall",
    signInAndOpen:"Sign in and open",
    openAccess:"Open access",
    levelThreeActive:"Third level · teacher-guided"
  });
  Object.assign(copies.ar,{
    threeLevels:"ثلاثة مستويات لمسار واحد",
    openTitle:"الوصول المفتوح",
    openText:"المصحف والتلاوة والتحقق الأساسي من الكلمات متاحة للجميع بلا تسجيل.",
    alwaysOpen:"مفتوح دائمًا",
    basicTitle:"لوحة الطالب الأساسية",
    basicText:"خطة شخصية وتعلّم تأسيسي و«القرآن في القلب» واختبار الصفحة غيبًا ودورات وسجل للتقدم.",
    guidedTitle:"أكاديمية ALLIM مع معلّم",
    guidedText:"تصحيح حي للتلاوة، وواجبات، وجدول، وملاحظات شخصية، ومتابعة من المعلّم.",
    advancedRecallEyebrow:"تدريب الحفظ في لوحة الطالب الأساسية",
    advancedRecallTitle:"اختبار الصفحة غيبًا",
    advancedRecallText:"تبقى هيئة صفحة المصحف الحقيقية في مكانها، ويُخفى النص، ثم تظهر الكلمات الصحيحة بالترتيب. وتُحفظ النتيجة في سجلك الشخصي.",
    advancedRecallPoint1:"تلاوة الصفحة كاملة بصورة متصلة",
    advancedRecallPoint2:"التوقف عند الخطأ حتى تصحيحه",
    advancedRecallPoint3:"سجل للاختبارات المستقلة",
    secondAccessLocked:"سجّل الدخول إلى اللوحة الأساسية",
    secondAccessActive:"المستوى الثاني مفعّل",
    startPageRecall:"ابدأ اختبار الصفحة",
    signInAndOpen:"سجّل الدخول وافتح",
    openAccess:"وصول مفتوح",
    levelThreeActive:"المستوى الثالث · مع معلّم"
  });
  Object.assign(copies.ru,{
    strictAssessmentEyebrow:"УРОВЕНЬ 3 · С ПРЕПОДАВАТЕЛЕМ", strictAssessmentTitle:"Строгая проверка произношения и таджвида", strictAssessmentText:"Система строит предварительную карту чтения, а преподаватель подтверждает оценку и даёт точное задание на исправление.", strictAssessmentFlowLabel:"Этапы строгой проверки", strictAssessmentWords:"Порядок слов", strictAssessmentWordsText:"Пропуски и замены", strictAssessmentPhonetics:"Фонетическая карта", strictAssessmentPhoneticsText:"Махрадж и сифаты", strictAssessmentRules:"Правила таджвида", strictAssessmentRulesText:"Мадд, гунна, калькала, идгам и васл", strictAssessmentTeacher:"Вывод преподавателя", strictAssessmentTeacherText:"Интонация, паузы и личное задание", strictAssessmentBoundary:"Автооценка не становится итоговой, пока её не подтвердит преподаватель.", strictAssessmentLocked:"Доступен после зачисления", strictAssessmentActive:"Строгий режим активен", strictAssessmentChooseProgram:"Выбрать программу", strictAssessmentStart:"Начать сессию с преподавателем"
  });
  Object.assign(copies.en,{
    strictAssessmentEyebrow:"LEVEL 3 · WITH A TEACHER", strictAssessmentTitle:"Strict pronunciation and tajwid review", strictAssessmentText:"The system prepares a preliminary recitation map; the teacher confirms the assessment and gives a precise correction task.", strictAssessmentFlowLabel:"Strict assessment stages", strictAssessmentWords:"Word order", strictAssessmentWordsText:"Omissions and substitutions", strictAssessmentPhonetics:"Phonetic map", strictAssessmentPhoneticsText:"Makharij and attributes", strictAssessmentRules:"Tajwid rules", strictAssessmentRulesText:"Madd, ghunnah, qalqalah, idgham and wasl", strictAssessmentTeacher:"Teacher conclusion", strictAssessmentTeacherText:"Intonation, pauses and a personal task", strictAssessmentBoundary:"An automated score is not final until it is confirmed by the teacher.", strictAssessmentLocked:"Available after enrolment", strictAssessmentActive:"Strict mode is active", strictAssessmentChooseProgram:"Choose a programme", strictAssessmentStart:"Start a teacher-guided session"
  });
  Object.assign(copies.ar,{
    strictAssessmentEyebrow:"المستوى الثالث · مع معلّم", strictAssessmentTitle:"تحقق دقيق من النطق والتجويد", strictAssessmentText:"يعدّ النظام خريطة أولية للتلاوة، ثم يؤكد المعلّم التقييم ويحدد تمرينًا دقيقًا للتصحيح.", strictAssessmentFlowLabel:"مراحل التحقق الدقيق", strictAssessmentWords:"ترتيب الكلمات", strictAssessmentWordsText:"السقط والإبدال", strictAssessmentPhonetics:"الخريطة الصوتية", strictAssessmentPhoneticsText:"المخارج والصفات", strictAssessmentRules:"أحكام التجويد", strictAssessmentRulesText:"المد والغنة والقلقلة والإدغام والوصل", strictAssessmentTeacher:"خلاصة المعلّم", strictAssessmentTeacherText:"النغم والوقفات وتمرين شخصي", strictAssessmentBoundary:"لا تصبح النتيجة الآلية نهائية حتى يعتمدها المعلّم.", strictAssessmentLocked:"متاح بعد الالتحاق", strictAssessmentActive:"الوضع الدقيق مفعّل", strictAssessmentChooseProgram:"اختر برنامجًا", strictAssessmentStart:"ابدأ جلسة مع المعلّم"
  });
  var defaultPlan={minutes:15,focus:"recitation",target:""};
  var appState=readStorage(appStorageKey,{});
  var plan=Object.assign({},defaultPlan,readStorage(planStorageKey,{}));
  var language=["ru","en","ar"].indexOf(appState.language)>=0?appState.language:"ru";
  var currentUser="Guest";
  var enrollments=[];
  var batchEnrollments=[];
  var courseDetails={};
  var batchDetails={};
  var toastTimer;

  function readStorage(key,fallback){try{return JSON.parse(localStorage.getItem(key)||"")||fallback}catch(error){return fallback}}
  function writeStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(error){return false}}
  function t(key){return (copies[language]&&copies[language][key])||key}
  function applyLanguage(next){language=next;document.documentElement.lang=next;document.documentElement.dir=next==="ar"?"rtl":"ltr";document.getElementById("language-button").textContent=next.toUpperCase();document.querySelectorAll("[data-copy]").forEach(function(node){var key=node.getAttribute("data-copy");if(!node.dataset.copyRu)node.dataset.copyRu=node.textContent;node.textContent=next==="ru"?node.dataset.copyRu:t(key)});document.querySelectorAll("[data-copy-aria]").forEach(function(node){var key=node.getAttribute("data-copy-aria");if(!node.dataset.copyAriaRu)node.dataset.copyAriaRu=node.getAttribute("aria-label")||"";node.setAttribute("aria-label",next==="ru"?node.dataset.copyAriaRu:t(key))});document.querySelectorAll("[data-copy-placeholder]").forEach(function(node){var key=node.getAttribute("data-copy-placeholder");if(!node.dataset.copyPlaceholderRu)node.dataset.copyPlaceholderRu=node.getAttribute("placeholder")||"";node.setAttribute("placeholder",next==="ru"?node.dataset.copyPlaceholderRu:t(key))});renderCourses();renderGuided()}
  function dateKey(date){var local=new Date(date.getTime()-date.getTimezoneOffset()*60000);return local.toISOString().slice(0,10)}
  function currentStreak(){var activity=appState.activity||{};var cursor=new Date();if(!Number(activity[dateKey(cursor)]))cursor.setDate(cursor.getDate()-1);var count=0;while(Number(activity[dateKey(cursor)])>0){count+=1;cursor.setDate(cursor.getDate()-1)}return count}
  function heartMetrics(){var units=appState.heartMushaf&&appState.heartMushaf.units||{};var result={repetitions:0,pages:0,due:0};var now=Date.now();Object.keys(units).forEach(function(key){var unit=units[key]||{};var total=(unit.weekCounts||[]).reduce(function(sum,value){return sum+(Number(value)||0)},0);result.repetitions+=total;if(total>=300)result.pages+=1;if(unit.nextReviewAt&&new Date(unit.nextReviewAt).getTime()<=now)result.due+=1;else if(total>0&&total<300&&unit.lastAcceptedAt&&now-new Date(unit.lastAcceptedAt).getTime()>=7*86400000)result.due+=1});return result}
  function renderLocal(){var activity=appState.activity||{};var today=Number(activity[dateKey(new Date())])||0;var goal=Math.max(1,Number(appState.dailyGoal)||1);var heart=heartMetrics();document.getElementById("plan-minutes").textContent=String(plan.minutes);document.getElementById("today-count").textContent=String(today);document.getElementById("goal-count").textContent="/ "+goal;document.getElementById("metric-today").textContent=String(today);document.getElementById("metric-streak").textContent=String(currentStreak());document.getElementById("review-plan-count").textContent=String((appState.reviewQueue||[]).length);document.getElementById("heart-repetitions").textContent=String(heart.repetitions);document.getElementById("heart-pages").textContent=String(heart.pages);document.getElementById("heart-due").textContent=String(heart.due);document.getElementById("total-sessions").textContent=String(Number(appState.sessions)||0);document.getElementById("saved-count").textContent=String((appState.savedVerses||[]).length);document.getElementById("review-count").textContent=String((appState.reviewQueue||[]).length);document.getElementById("words-reviewed").textContent=String(Number(appState.wordsReviewed)||0);renderActivity()}
  function renderActivity(){var grid=document.getElementById("activity-grid");grid.textContent="";var activity=appState.activity||{};var start=new Date();start.setHours(12,0,0,0);start.setDate(start.getDate()-34);for(var index=0;index<35;index+=1){var day=new Date(start);day.setDate(start.getDate()+index);var value=Number(activity[dateKey(day)])||0;var cell=document.createElement("span");if(value)cell.className="level-"+Math.min(3,value);cell.title=day.toLocaleDateString(language)+" · "+value;grid.appendChild(cell)}}
  function selectPanel(name){document.querySelectorAll("[data-panel-content]").forEach(function(panel){var active=panel.getAttribute("data-panel-content")===name;panel.hidden=!active;panel.classList.toggle("is-active",active)});document.querySelectorAll("[data-panel]").forEach(function(button){var active=button.getAttribute("data-panel")===name;button.classList.toggle("is-active",active);if(active)button.setAttribute("aria-current","page");else button.removeAttribute("aria-current")});window.scrollTo({top:0,behavior:"smooth"})}
  function showToast(message){var toast=document.getElementById("toast");window.clearTimeout(toastTimer);toast.textContent=message;toast.classList.add("is-visible");toastTimer=window.setTimeout(function(){toast.classList.remove("is-visible")},2600)}
  async function getJson(url){var response=await fetch(url,{credentials:"same-origin",headers:{Accept:"application/json"}});if(!response.ok)throw new Error("request-"+response.status);return response.json()}
  async function getList(doctype,filters,fields){var query="?filters="+encodeURIComponent(JSON.stringify(filters||[]))+"&fields="+encodeURIComponent(JSON.stringify(fields||["name"]))+"&limit_page_length=100";var data=await getJson("/api/resource/"+encodeURIComponent(doctype)+query);return data.data||[]}
  async function getDoc(doctype,name){var data=await getJson("/api/resource/"+encodeURIComponent(doctype)+"/"+encodeURIComponent(name));return data.data||{}}
  async function loadAccount(){try{var auth=await getJson("/api/method/frappe.auth.get_logged_user");currentUser=auth.message||"Guest"}catch(error){currentUser="Guest"}updateAccountUi();if(currentUser==="Guest"){renderCourses();renderGuided();return}renderGuided();try{enrollments=await getList("LMS Enrollment",[["member","=",currentUser]],["name","course","progress","current_lesson","modified"]);batchEnrollments=await getList("LMS Batch Enrollment",[["member","=",currentUser]],["name","batch"]);await Promise.all(enrollments.map(async function(row){try{courseDetails[row.course]=await getDoc("LMS Course",row.course)}catch(error){courseDetails[row.course]={title:row.course}}}));await Promise.all(batchEnrollments.map(async function(row){try{batchDetails[row.batch]=await getDoc("LMS Batch",row.batch)}catch(error){batchDetails[row.batch]={title:row.batch}}}));document.getElementById("metric-courses").textContent=String(enrollments.length);renderCourses();renderGuided();renderServerProgress()}catch(error){renderServerError()}}
  function updateAccountUi(){var button=document.getElementById("account-button");var status=document.getElementById("sync-status");if(currentUser==="Guest")return;var label=currentUser.split("@")[0].replace(/[._-]+/g," ");button.href="/lms/profile";button.querySelector("span").textContent=label;document.getElementById("student-name").textContent=label;status.querySelector("span").textContent=t("signedIn")}
  function emptyCard(title,text){var card=document.createElement("article");card.className="empty-state";var icon=document.createElement("span");icon.innerHTML='<svg><use href="#i-book"/></svg>';var heading=document.createElement("h3");heading.textContent=title;var copy=document.createElement("p");copy.textContent=text;card.append(icon,heading,copy);return card}
  function starterCard(){var card=document.createElement("article");card.className="course-card starter-course";var head=document.createElement("div");head.className="course-card-head";var badge=document.createElement("span");badge.textContent=t("starterBadge");var symbol=document.createElement("strong");symbol.lang="ar";symbol.dir="rtl";symbol.textContent="ا ← بِ ← رَبِّ";head.append(badge,symbol);var title=document.createElement("h3");title.textContent=t("starterTitle");var copy=document.createElement("p");copy.textContent=t("starterText");var link=document.createElement("a");link.className="text-link";link.href=language==="ar"?"/ar/blog/learn-quranic-alphabet":(language==="ru"?"/ru/blog/arabskij-alfavit-dlya-chteniya-korana":"/blog/learn-quranic-alphabet");var label=document.createElement("span");label.textContent=t("starterAction");var arrow=document.createElementNS("http://www.w3.org/2000/svg","svg");arrow.innerHTML='<use href="#i-arrow"/>';link.append(label,arrow);card.append(head,title,copy,link);return card}
  function renderCourses(){var list=document.getElementById("course-list");if(!list)return;list.textContent="";list.appendChild(starterCard());if(currentUser==="Guest"){list.appendChild(emptyCard(t("guestCourses"),t("guestCoursesText")));return}if(!enrollments.length){list.appendChild(emptyCard(t("noCourses"),t("noCoursesText")));return}enrollments.forEach(function(row){var detail=courseDetails[row.course]||{};var progress=Math.max(0,Math.min(100,Number(row.progress)||0));var card=document.createElement("article");card.className="course-card";var head=document.createElement("div");head.className="course-card-head";var badge=document.createElement("span");badge.textContent=t("inProgress");var percent=document.createElement("strong");percent.textContent=Math.round(progress)+"%";head.append(badge,percent);var title=document.createElement("h3");title.textContent=detail.title||row.course;var intro=document.createElement("p");intro.textContent=detail.short_introduction||detail.description&&String(detail.description).replace(/<[^>]*>/g,"").slice(0,160)||"";var track=document.createElement("div");track.className="progress-track";var fill=document.createElement("i");fill.style.width=progress+"%";track.appendChild(fill);var link=document.createElement("a");link.className="text-link";link.href="/lms/courses/"+encodeURIComponent(row.course);var text=document.createElement("span");text.textContent=t("openCourse");var arrow=document.createElementNS("http://www.w3.org/2000/svg","svg");arrow.innerHTML='<use href="#i-arrow"/>';link.append(text,arrow);card.append(head,title,intro,track,link);list.appendChild(card)})}
  function teacherNames(){var names=[];Object.keys(batchDetails).forEach(function(key){var rows=batchDetails[key].instructors||[];rows.forEach(function(row){var value=row.instructor_name||row.full_name||row.instructor||row.member;if(value&&names.indexOf(value)<0)names.push(value)})});return names}
  async function renderGuided(){
    var active=batchEnrollments.length>0;
    var isGuest=currentUser==="Guest";
    var recallActive=!isGuest;
    var openLine=document.getElementById("open-access-line");
    var basicLine=document.getElementById("basic-access-line");
    var basicStatus=document.getElementById("basic-status");
    var line=document.getElementById("guided-access-line");
    var status=document.getElementById("guided-status");
    var pill=document.getElementById("guided-pill");
    var accessPill=document.getElementById("access-pill");
    var recallCard=document.getElementById("advanced-recall-card");
    var recallStatus=document.getElementById("advanced-recall-status");
    var recallAction=document.getElementById("advanced-recall-action");
    var strictCard=document.getElementById("strict-assessment-card");
    var strictStatus=document.getElementById("strict-assessment-status");
    var strictAction=document.getElementById("strict-assessment-action");

    if(openLine)openLine.classList.toggle("is-current",isGuest);
    if(basicLine)basicLine.classList.toggle("is-current",!isGuest&&!active);
    if(basicStatus)basicStatus.textContent=isGuest?t("signIn"):t("included");
    line.classList.toggle("is-active",active);
    line.classList.toggle("is-current",active);
    status.textContent=active?t("connected"):t("notConnected");
    pill.classList.toggle("muted",!active);
    pill.querySelector("span").textContent=active?t("thirdAccessActive"):(isGuest?t("signIn"):t("notConnected"));
    accessPill.querySelector("span").textContent=active?t("levelThreeActive"):(isGuest?t("openAccess"):t("basicAccess"));

    if(recallCard){
      recallCard.dataset.accessState=recallActive?"active":"locked";
      recallStatus.classList.toggle("muted",!recallActive);
      recallStatus.querySelector("span").textContent=recallActive?t("secondAccessActive"):t("secondAccessLocked");
      recallAction.href=recallActive?"/learn?view=memorize&academy=page-recall&lang="+encodeURIComponent(language):"/login?redirect-to=/academy";
      recallAction.querySelector("span").textContent=recallActive?t("startPageRecall"):t("signInAndOpen");
    }
    if(strictCard){
      strictCard.dataset.accessState=active?"active":"locked";
      strictStatus.classList.toggle("muted",!active);
      strictStatus.querySelector("span").textContent=active?t("strictAssessmentActive"):t("strictAssessmentLocked");
      strictAction.href=active?"/learn?view=read&assessment=teacher&lang="+encodeURIComponent(language):"/lms/batches";
      strictAction.querySelector("span").textContent=active?t("strictAssessmentStart"):t("strictAssessmentChooseProgram");
    }

    var names=teacherNames();
    if(names.length){
      document.getElementById("teacher-name").textContent=names.join(", ");
      document.getElementById("teacher-description").textContent=t("teacherAssigned");
      var first=batchEnrollments[0].batch;
      var action=document.getElementById("teacher-action");
      action.href="/lms/batches/"+encodeURIComponent(first);
      action.querySelector("span").textContent=t("openGroup");
    }
    if(!active)return;
    try{
      var batches=batchEnrollments.map(function(row){return row.batch});
      var live=await getList("LMS Live Class",[["batch_name","in",batches]],["name","title","date","time","duration","timezone","join_url","batch_name"]);
      live.sort(function(a,b){return String(a.date||"").localeCompare(String(b.date||""))});
      var next=live.find(function(item){return !item.date||new Date(item.date+"T"+(item.time||"00:00:00")).getTime()>=Date.now()})||live[0];
      if(next){
        document.getElementById("next-class").textContent=next.title||next.batch_name;
        document.getElementById("next-class-meta").textContent=[next.date,next.time,next.timezone].filter(Boolean).join(" · ");
      }
      var submissions=await getList("LMS Assignment Submission",[["member","=",currentUser]],["name","assignment_title","status","comments","modified"]);
      submissions.sort(function(a,b){return String(b.modified||"").localeCompare(String(a.modified||""))});
      if(submissions[0]){
        document.getElementById("latest-assignment").textContent=submissions[0].assignment_title||submissions[0].name;
        document.getElementById("latest-assignment-meta").textContent=submissions[0].status||"";
        if(submissions[0].comments)document.getElementById("feedback-status").textContent=String(submissions[0].comments).replace(/<[^>]*>/g,"").slice(0,100);
      }
    }catch(error){return}
  }
  function renderServerProgress(){var target=document.getElementById("server-course-progress");target.textContent="";if(!enrollments.length){var p=document.createElement("p");p.className="muted-copy";p.textContent=t("noCoursesText");target.appendChild(p);return}var list=document.createElement("div");list.className="server-progress-list";enrollments.forEach(function(row){var progress=Math.max(0,Math.min(100,Number(row.progress)||0));var item=document.createElement("div");item.className="server-progress-row";var title=document.createElement("strong");title.textContent=(courseDetails[row.course]||{}).title||row.course;var value=document.createElement("em");value.textContent=Math.round(progress)+"%";var track=document.createElement("div");track.className="progress-track";var fill=document.createElement("i");fill.style.width=progress+"%";track.appendChild(fill);item.append(title,value,track);list.appendChild(item)});target.appendChild(list)}
  function renderServerError(){var list=document.getElementById("course-list");list.textContent="";list.appendChild(emptyCard(t("serverUnavailable"),t("serverUnavailableText")));document.getElementById("sync-status").querySelector("span").textContent=t("serverUnavailable")}
  function initializePlan(){document.getElementById("plan-minutes-input").value=String(plan.minutes);document.getElementById("plan-focus-input").value=plan.focus;document.getElementById("plan-target-input").value=plan.target||""}
  function initialize(){
    var params=new URLSearchParams(window.location.search);
    var requestedLanguage=params.get("lang");
    if(["ru","en","ar"].indexOf(requestedLanguage)>=0)language=requestedLanguage;
    renderLocal();
    applyLanguage(language);
    initializePlan();
    document.querySelectorAll("[data-panel]").forEach(function(button){button.addEventListener("click",function(){selectPanel(button.getAttribute("data-panel"))})});
    document.querySelectorAll("[data-open-panel]").forEach(function(button){button.addEventListener("click",function(){selectPanel(button.getAttribute("data-open-panel"))})});
    document.getElementById("language-button").addEventListener("click",function(){var order=["ru","en","ar"];applyLanguage(order[(order.indexOf(language)+1)%order.length])});
    var dialog=document.getElementById("plan-dialog");
    document.getElementById("edit-plan").addEventListener("click",function(){initializePlan();dialog.showModal()});
    document.getElementById("plan-form").addEventListener("submit",function(event){if(event.submitter&&event.submitter.id==="save-plan"){plan.minutes=Math.max(10,Math.min(45,Number(document.getElementById("plan-minutes-input").value)||15));plan.focus=document.getElementById("plan-focus-input").value;plan.target=document.getElementById("plan-target-input").value.trim();writeStorage(planStorageKey,plan);renderLocal();showToast(t("planSaved"))}});
    dialog.addEventListener("click",function(event){if(event.target===dialog)dialog.close()});
    var requestedPanel=params.get("panel");
    if(["overview","courses","teacher","progress"].indexOf(requestedPanel)>=0)selectPanel(requestedPanel);
    if(params.get("feature")==="page-recall"){
      var feature=document.getElementById("advanced-recall-card");
      if(feature){
        feature.classList.add("is-feature-target");
        window.setTimeout(function(){feature.scrollIntoView({behavior:"smooth",block:"center"});feature.focus({preventScroll:true})},180);
      }
    }
    if(params.get("feature")==="strict-assessment"){
      selectPanel("teacher");
      var strictFeature=document.getElementById("strict-assessment-card");
      if(strictFeature){
        strictFeature.classList.add("is-feature-target");
        window.setTimeout(function(){strictFeature.scrollIntoView({behavior:"smooth",block:"center"});strictFeature.focus({preventScroll:true})},180);
      }
    }
    loadAccount();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize);else initialize();
}());

(function(){
  "use strict";
  var storageKey="allim-academy-diagnostic-v1";
  var dialog=document.getElementById("diagnostic-dialog");
  var form=document.getElementById("diagnostic-form");
  var result=document.getElementById("academy-route-result");
  if(!dialog||!form||!result)return;

  var copy={
    ru:{eyebrow:"ПЕРВЫЙ ВХОД В ACADEMY",title:"Сначала определим вашу точку старта.",lead:"Короткая диагностика займёт около двух минут. После неё вы получите понятный маршрут и сможете записаться на пробный урок.",stepsLabel:"Путь начала обучения",stepDiagnostic:"Диагностика",stepDiagnosticHint:"Уровень и цель",stepRoute:"Личный маршрут",stepRouteHint:"Темп и программа",stepTrial:"Пробный урок",stepTrialHint:"Живое знакомство",stepLearning:"Обучение",stepLearningHint:"План и сопровождение",startDiagnostic:"Пройти диагностику",privacy:"Ответы сохраняются на этом устройстве. Заявка на урок отправляется отдельно.",routeReady:"ВАШ МАРШРУТ ГОТОВ",bookTrial:"Записаться на пробный урок",retake:"Пройти заново",dialogEyebrow:"ДИАГНОСТИКА",dialogTitle:"Три вопроса для точного старта",dialogLead:"Это не экзамен. Мы определяем первый посильный шаг, а преподаватель уточнит маршрут на пробном уроке.",levelQuestion:"Как вы читаете сейчас?",levelLetters:"Только начинаю",levelLettersHint:"Не знаю все буквы или соединения",levelAssisted:"Читаю с помощью",levelAssistedHint:"Читаю медленно и часто сомневаюсь",levelIndependent:"Читаю самостоятельно",levelIndependentHint:"Хочу улучшить точность и беглость",goalQuestion:"Что важнее сейчас?",goalReading:"Научиться читать",goalReadingHint:"Буквы, соединения и чтение аятов",goalTajwid:"Исправить чтение",goalTajwidHint:"Махрадж, правила и плавность",goalHifz:"Заучивать Коран",goalHifzHint:"Повторение, связки и проверка",timeQuestion:"Сколько времени удобно заниматься ежедневно?",cancel:"Отмена",buildRoute:"Составить маршрут",close:"Закрыть",foundationTitle:"От алифа до уверенного чтения",foundationSummary:"Начнём с опоры: правильные звуки, соединения и короткие коранические фрагменты. Рекомендуемый ритм — {minutes} минут в день.",foundationModules:["Звуки и формы букв","Соединения и огласовки","Первые аяты с преподавателем"],readingTitle:"Уверенное чтение Корана",readingSummary:"Укрепим чтение без спешки: точность слова, плавные переходы и регулярная практика по {minutes} минут.",readingModules:["Диагностика чтения","Практика по аятам","Связное чтение страницы"],tajwidTitle:"Точность и беглость",tajwidSummary:"Маршрут сосредоточен на исправлении чтения и устойчивом применении правил в живой тилавате по {minutes} минут.",tajwidModules:["Махрадж и сифаты","Правила в контексте аята","Живая коррекция преподавателя"],hifzTitle:"Хифз с прочной связкой",hifzSummary:"Сначала проверим точность чтения, затем выстроим повторение, связки между аятами и своевременное возвращение по {minutes} минут.",hifzModules:["Точное чтение отрывка","Повторение и воспроизведение","Связка и план повторения"]},
    en:{eyebrow:"YOUR START IN ACADEMY",title:"First, let us find your starting point.",lead:"A short two-minute diagnostic gives you a clear route and a direct next step to a trial lesson.",stepsLabel:"Learning entry path",stepDiagnostic:"Diagnostic",stepDiagnosticHint:"Level and goal",stepRoute:"Personal route",stepRouteHint:"Pace and programme",stepTrial:"Trial lesson",stepTrialHint:"Meet a teacher",stepLearning:"Learning",stepLearningHint:"Plan and guidance",startDiagnostic:"Start diagnostic",privacy:"Answers stay on this device. A lesson request is submitted separately.",routeReady:"YOUR ROUTE IS READY",bookTrial:"Book a trial lesson",retake:"Retake",dialogEyebrow:"DIAGNOSTIC",dialogTitle:"Three questions for a precise start",dialogLead:"This is not an exam. We identify a manageable first step; a teacher refines it in the trial lesson.",levelQuestion:"How do you read today?",levelLetters:"I am just starting",levelLettersHint:"I do not know every letter or connection",levelAssisted:"I read with help",levelAssistedHint:"I read slowly and often hesitate",levelIndependent:"I read independently",levelIndependentHint:"I want greater accuracy and fluency",goalQuestion:"What matters most now?",goalReading:"Learn to read",goalReadingHint:"Letters, joining and first verses",goalTajwid:"Correct my recitation",goalTajwidHint:"Makharij, rules and fluency",goalHifz:"Memorise the Qur’an",goalHifzHint:"Repetition, linking and review",timeQuestion:"How much daily time is comfortable?",cancel:"Cancel",buildRoute:"Build my route",close:"Close",foundationTitle:"From alif to confident reading",foundationSummary:"Start with a sound foundation: correct sounds, joining and short Qur’anic passages at {minutes} minutes a day.",foundationModules:["Letter sounds and forms","Joining and vowel marks","First verses with a teacher"],readingTitle:"Confident Qur’an reading",readingSummary:"Build accuracy without rushing: clear words, smooth transitions and {minutes} minutes of regular practice.",readingModules:["Reading diagnostic","Verse-by-verse practice","Connected page reading"],tajwidTitle:"Accuracy and fluency",tajwidSummary:"Focus on correcting recitation and applying rules consistently in live tilawah for {minutes} minutes a day.",tajwidModules:["Makharij and attributes","Rules in verse context","Live teacher correction"],hifzTitle:"Hifz with strong connections",hifzSummary:"Verify accurate recitation first, then build repetition, links between verses and timely review in {minutes}-minute sessions.",hifzModules:["Accurate passage reading","Repetition and recall","Linking and review plan"]},
    ar:{eyebrow:"بدايتك في الأكاديمية",title:"نحدد أولًا نقطة البداية المناسبة لك.",lead:"تشخيص قصير يستغرق نحو دقيقتين، ثم تحصل على مسار واضح وخطوة مباشرة نحو درس تجريبي.",stepsLabel:"مسار بدء التعلم",stepDiagnostic:"التشخيص",stepDiagnosticHint:"المستوى والهدف",stepRoute:"المسار الشخصي",stepRouteHint:"الوتيرة والبرنامج",stepTrial:"درس تجريبي",stepTrialHint:"تعارف حي",stepLearning:"التعلّم",stepLearningHint:"خطة وتوجيه",startDiagnostic:"ابدأ التشخيص",privacy:"تبقى الإجابات على هذا الجهاز، ويُرسل طلب الدرس بصورة مستقلة.",routeReady:"مسارك جاهز",bookTrial:"احجز درسًا تجريبيًا",retake:"أعد التشخيص",dialogEyebrow:"التشخيص",dialogTitle:"ثلاثة أسئلة لبداية دقيقة",dialogLead:"هذا ليس اختبارًا. نحدد خطوة أولى ميسّرة، ثم يضبط المعلّم المسار في الدرس التجريبي.",levelQuestion:"كيف تقرأ الآن؟",levelLetters:"أنا في البداية",levelLettersHint:"لا أعرف جميع الحروف أو أشكال اتصالها",levelAssisted:"أقرأ بمساعدة",levelAssistedHint:"أقرأ ببطء وأتردد كثيرًا",levelIndependent:"أقرأ باستقلال",levelIndependentHint:"أريد دقة وطلاقة أكبر",goalQuestion:"ما الأهم لك الآن؟",goalReading:"تعلّم القراءة",goalReadingHint:"الحروف والوصل وقراءة الآيات",goalTajwid:"تصحيح التلاوة",goalTajwidHint:"المخارج والأحكام والطلاقة",goalHifz:"حفظ القرآن",goalHifzHint:"التكرار والربط والمراجعة",timeQuestion:"كم دقيقة تناسبك يوميًا؟",cancel:"إلغاء",buildRoute:"أنشئ مساري",close:"إغلاق",foundationTitle:"من الألف إلى القراءة الواثقة",foundationSummary:"نبدأ بأساس متين: الأصوات الصحيحة ووصل الحروف ومقاطع قرآنية قصيرة بمعدل {minutes} دقيقة يوميًا.",foundationModules:["أصوات الحروف وأشكالها","الوصل والحركات","الآيات الأولى مع معلّم"],readingTitle:"قراءة القرآن بثقة",readingSummary:"نبني الدقة بلا استعجال: وضوح الكلمة وسلاسة الانتقال وممارسة منتظمة لمدة {minutes} دقيقة.",readingModules:["تشخيص القراءة","تدريب آية آية","قراءة الصفحة متصلة"],tajwidTitle:"الدقة والطلاقة",tajwidSummary:"يركز المسار على تصحيح التلاوة وتطبيق الأحكام بثبات في قراءة حية لمدة {minutes} دقيقة يوميًا.",tajwidModules:["المخارج والصفات","الأحكام في سياق الآية","تصحيح حي مع المعلّم"],hifzTitle:"حفظ مترابط راسخ",hifzSummary:"نثبت صحة القراءة أولًا، ثم نبني التكرار والربط بين الآيات والمراجعة في وقتها خلال {minutes} دقيقة.",hifzModules:["قراءة المقطع بدقة","التكرار والاستظهار","الربط وخطة المراجعة"]}
  };

  function language(){var value=document.documentElement.lang;return copy[value]?value:"ru"}
  function text(){return copy[language()]}
  function read(){try{return JSON.parse(localStorage.getItem(storageKey)||"null")}catch(error){return null}}
  function write(value){try{localStorage.setItem(storageKey,JSON.stringify(value));return true}catch(error){return false}}
  function interpolate(value,minutes){return String(value).replace("{minutes}",String(minutes))}
  function routeFor(values){if(values.level==="letters")return"foundation";if(values.goal==="hifz")return"hifz";if(values.goal==="tajwid")return"tajwid";return"reading"}
  function openDialog(){
    var saved=read();
    if(saved){
      ["level","goal"].forEach(function(name){var input=form.querySelector('[name="'+name+'"][value="'+saved[name]+'"]');if(input)input.checked=true});
      if(form.elements.minutes)form.elements.minutes.value=String(saved.minutes||15);
    }
    if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
  }
  function closeDialog(){if(typeof dialog.close==="function")dialog.close();else dialog.removeAttribute("open")}
  function renderLanguage(){
    var strings=text();
    document.querySelectorAll("[data-diagnostic-copy]").forEach(function(node){var key=node.getAttribute("data-diagnostic-copy");if(strings[key])node.textContent=strings[key]});
    document.querySelectorAll("[data-diagnostic-aria]").forEach(function(node){var key=node.getAttribute("data-diagnostic-aria");if(strings[key])node.setAttribute("aria-label",strings[key])});
    renderResult(read());
  }
  function renderResult(saved){
    var start=document.getElementById("academy-entry-actions");
    var strings=text();
    var hasResult=Boolean(saved&&saved.route&&copy.ru[saved.route+"Title"]);
    result.hidden=!hasResult;
    start.hidden=hasResult;
    document.querySelectorAll("[data-entry-step]").forEach(function(step){var name=step.getAttribute("data-entry-step");step.classList.toggle("is-complete",hasResult&&(name==="diagnostic"||name==="route"));step.classList.toggle("is-active",hasResult?name==="trial":name==="diagnostic")});
    if(!hasResult)return;
    document.getElementById("diagnostic-route-title").textContent=strings[saved.route+"Title"];
    document.getElementById("diagnostic-route-summary").textContent=interpolate(strings[saved.route+"Summary"],saved.minutes);
    var modules=document.getElementById("diagnostic-route-modules");
    modules.textContent="";
    strings[saved.route+"Modules"].forEach(function(label,index){var item=document.createElement("span");item.innerHTML="<b>"+String(index+1).padStart(2,"0")+"</b><em></em>";item.querySelector("em").textContent=label;modules.appendChild(item)});
    var locale=language();
    var trialPath=locale==="ru"?"/ru/probnyj-urok/new":(locale==="ar"?"/ar/academy-trial/new":"/academy-trial/new");
    var params=new URLSearchParams({route:saved.route,level:saved.level,goal:saved.goal,minutes:String(saved.minutes),lang:locale,source:"academy-diagnostic"});
    document.getElementById("book-trial-lesson").href=trialPath+"?"+params.toString();
  }

  document.getElementById("start-diagnostic").addEventListener("click",openDialog);
  document.getElementById("retake-diagnostic").addEventListener("click",openDialog);
  document.getElementById("close-diagnostic").addEventListener("click",closeDialog);
  document.getElementById("cancel-diagnostic").addEventListener("click",closeDialog);
  dialog.addEventListener("click",function(event){if(event.target===dialog)closeDialog()});
  form.addEventListener("submit",function(event){
    event.preventDefault();
    var values=new FormData(form);
    var saved={level:String(values.get("level")||""),goal:String(values.get("goal")||""),minutes:Math.max(10,Math.min(30,Number(values.get("minutes"))||15)),createdAt:new Date().toISOString()};
    if(!saved.level||!saved.goal)return;
    saved.route=routeFor(saved);
    write(saved);
    closeDialog();
    renderResult(saved);
    result.focus({preventScroll:true});
    result.scrollIntoView({behavior:"smooth",block:"nearest"});
  });
  document.getElementById("language-button").addEventListener("click",function(){window.setTimeout(renderLanguage,0)});
  renderLanguage();
}());
