# -*- coding: utf-8 -*-
from __future__ import annotations

import concurrent.futures
import json
import os
import re
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "i18n.js"
CACHE = Path("/tmp/allim-home-i18n-cache.json")
CURATED_FILES = {
    "tg": ROOT / "i18n-tg.json",
    "uz": ROOT / "i18n-uz.json",
    "tt": ROOT / "i18n-tt.json",
}

LANGUAGES = {
    "tg": {"api": "tg", "name": "Тоҷикӣ"},
    "uz": {"api": "uz", "name": "O‘zbekcha"},
    "tt": {"api": "tt", "name": "Татарча"},
    "bs": {"api": "bs", "name": "Bosanski"},
    "fr": {"api": "fr", "name": "Français"},
    "zh": {"api": "zh-CN", "name": "简体中文"},
    "ja": {"api": "ja", "name": "日本語"},
    "es": {"api": "es", "name": "Español"},
    "de": {"api": "de", "name": "Deutsch"},
    "ms": {"api": "ms", "name": "Bahasa Melayu"},
    "id": {"api": "id", "name": "Bahasa Indonesia"},
    "ur": {"api": "ur", "name": "اردو", "dir": "rtl"},
    "hi": {"api": "hi", "name": "हिन्दी"},
    "pt": {"api": "pt", "name": "Português"},
    "sw": {"api": "sw", "name": "Kiswahili"},
}

EXTRA_ENGLISH = {
    "languagePrimary": "Languages",
    "languageMore": "More languages",
    "introSound": "Listen to the du‘a",
    "introPlaying": "Playing the du‘a",
    "introSkip": "Skip",
    "introMission": "A prayer became our mission",
    "introLoading": "Preparing your reading space",
    "demoIdleTitle": "Hear how ALLIM responds",
    "demoIdleText": "A neutral learning voice demonstrates the pause and correction.",
    "demoListeningTitle": "Listening word by word…",
    "demoListeningText": "Correct words open in sequence.",
    "demoErrorTitle": "Pause. Correct this word.",
    "demoErrorText": "The next ayah stays locked until the word is corrected.",
    "demoCorrectedTitle": "Corrected. Continue.",
    "demoCorrectedText": "The reading opens again from this word.",
    "demoCompleteTitle": "Ayah completed",
    "demoCompleteText": "Replay the demonstration at any time.",
    "demoButton": "Play the recitation demonstration",
    "referralLabel": "PLANNED ONE-LEVEL ACADEMY INTRODUCTION",
    "referralTitle": "Academy invitations and automatic 10% discounts are planned and in development.",
    "referralText": "We plan that, for eligible paid Academy programs, the inviter and the new learner will each receive 10% off one billing period after the new learner’s first payment is final. Neither the Academy invitation nor automatic discount accrual is active yet. The general ALLIM share action below remains available. No cash, second level, teams or earnings from later invitations.",
    "referralAction": "Invite to the Academy",
    "shareEyebrow": "SHARE THE BENEFIT",
    "shareTitle": "A useful path becomes stronger when it reaches someone who needs it.",
    "shareText": "Invite a friend or relative to learn, read and understand the Qur’an with ALLIM.",
    "shareFaith": "We hope for reward from Allah for guiding others to what is beneficial. ALLIM does not promise or count spiritual reward.",
    "shareAction": "Share ALLIM",
    "shareOpenTitle": "Sharing stays open",
    "shareOpenText": "No purchase, fee or paid membership is required to share ALLIM with another learner.",
    "shareLevelTitle": "One invitation. One level.",
    "shareLevelText": "The planned Academy discount will be tied only to a new learner’s real paid enrolment — never to a chain of later invitations.",
    "shareMessage": "ALLIM is a learning space for reading, memorizing and understanding the Qur’an.",
    "shareCopied": "Link copied",
    "shareComplete": "Invitation ready to send",
    "shareFailed": "The share menu could not open. Copy the link manually.",
    "footerShare": "Share the benefit",
}

OVERRIDES = {
    "tg": {
        "navIntelligence": "Зеҳни омӯзиши Қуръон",
        "heroEyebrow": "Аз бар кунед · Дарк кунед · Дар зиндагӣ татбиқ кунед",
        "intelligenceEyebrow": "Зеҳни омӯзиши Қуръон бо ҳудудҳои равшан",
        "earlyEyebrow": "Тарзи оғозро интихоб кунед",
        "earlyTitle": "Як роҳи омӯзиш. Интихоб кунед, ки чӣ гуна оғоз мекунед.",
        "earlyText": "Омӯзиши мустақилонаро дар ALLIM оғоз кунед ё вақте ба роҳнамоии мустақими устод ниёз доред, ALLIM QUR’AN ACADEMY-ро интихоб кунед. Ҳар ду роҳ якдигарро пурра мекунанд, то машқи ҳаррӯза ва омӯзиш бо устод як пешрафтро тақвият диҳанд.",
        "footerMission": "Аз бар кунед · Дарк кунед · Дар зиндагӣ татбиқ кунед",
    },
    "uz": {
        "navIntelligence": "Qur’onni o‘rganish intellekti",
        "heroEyebrow": "Yod oling · Tushuning · Hayotga tatbiq eting",
        "intelligenceEyebrow": "Aniq chegaralarga ega Qur’onni o‘rganish intellekti",
        "earlyEyebrow": "Qanday boshlashni tanlang",
        "earlyTitle": "Bitta o‘rganish yo‘li. Qanday boshlashni o‘zingiz tanlang.",
        "earlyText": "ALLIM’da mustaqil o‘rganishni boshlang yoki ustozning bevosita yo‘l-yo‘rig‘i kerak bo‘lganda ALLIM QUR’AN ACADEMY’ni tanlang. Har ikki yo‘l bir-birini to‘ldiradi: kundalik mashq va ustoz bilan ta’lim bir xil taraqqiyotni mustahkamlaydi.",
        "footerMission": "Yod oling · Tushuning · Hayotga tatbiq eting",
    },
    "tt": {
        "navIntelligence": "Коръән өйрәнү интеллекты",
        "heroEyebrow": "Ятлагыз · Аңлагыз · Тормышка ашырыгыз",
        "intelligenceEyebrow": "Ачык чикләре булган Коръән өйрәнү интеллекты",
        "earlyEyebrow": "Ничек башларга икәнен сайлагыз",
        "earlyTitle": "Бер уку юлы. Ничек башларга теләвегезне сайлагыз.",
        "earlyText": "ALLIMда мөстәкыйль өйрәнүдән башлагыз яки укытучының турыдан-туры җитәкчелеге кирәк булганда ALLIM QUR’AN ACADEMYны сайлагыз. Ике юл бер-берсен тулыландыра: көндәлек күнегүләр һәм укытучы белән уку уртак алгарышны ныгыта.",
        "footerMission": "Ятлагыз · Аңлагыз · Тормышка ашырыгыз",
    },
    "bs": {
        "navIntelligence": "Kur’anska inteligencija",
        "heroEyebrow": "Uči napamet · Razumij · Živi",
        "intelligenceEyebrow": "Kur’anska inteligencija s jasnim granicama",
        "aiRecitationTitle": "Inteligencija učenja Kur’ana",
        "aiMemoryTitle": "Inteligencija pamćenja",
        "aiKnowledgeTitle": "Inteligencija znanja",
        "earlyEyebrow": "Izaberite kako želite početi",
        "earlyTitle": "Jedan put učenja. Izaberite način na koji želite početi.",
        "earlyText": "Počnite samostalnim učenjem u ALLIM-u ili izaberite Academy kada vam je potrebno neposredno vodstvo učitelja. Oba pristupa se nadopunjuju, tako da svakodnevna vježba i učenje s učiteljem grade isti napredak.",
        "footerMission": "Uči napamet · Razumij · Živi",
    },
    "fr": {
        "heroEyebrow": "Mémoriser · Comprendre · Vivre",
        "earlyEyebrow": "Choisissez comment commencer",
        "earlyTitle": "Un seul parcours d’apprentissage. Choisissez votre point de départ.",
        "earlyText": "Commencez en autonomie dans ALLIM, ou choisissez l’Academy lorsque vous avez besoin de l’accompagnement direct d’un enseignant. Les deux approches se complètent : la pratique quotidienne et l’apprentissage guidé renforcent une même progression.",
        "footerMission": "Mémoriser · Comprendre · Vivre",
    },
    "zh": {
        "navIntelligence": "古兰经学习智能",
        "heroEyebrow": "背诵 · 理解 · 实践",
        "intelligenceEyebrow": "有明确边界的古兰经学习智能",
        "earlyEyebrow": "选择你的起点",
        "earlyTitle": "一条学习路径，两种清晰的开始方式。",
        "earlyText": "你可以先在 ALLIM 中自主学习，也可以在需要教师现场指导时选择 ALLIM QUR’AN ACADEMY。两种方式彼此衔接，让日常练习与教师指导共同推动同一段学习进程。",
        "footerMission": "背诵 · 理解 · 实践",
    },
    "ja": {
        "navIntelligence": "クルアーン学習支援AI",
        "heroEyebrow": "暗記する · 理解する · 実践する",
        "intelligenceEyebrow": "明確な境界を持つクルアーン学習支援AI",
        "earlyEyebrow": "始め方を選ぶ",
        "earlyTitle": "ひとつの学びの道。自分に合う始め方を選べます。",
        "earlyText": "ALLIMで自主学習を始めることも、教師による直接の指導が必要なときにALLIM QUR’AN ACADEMYを選ぶこともできます。日々の練習と教師との学びが、ひとつの進歩としてつながります。",
        "footerMission": "暗記する · 理解する · 実践する",
    },
    "es": {
        "heroEyebrow": "Memorizar · Comprender · Vivir",
        "earlyEyebrow": "Elige cómo empezar",
        "earlyTitle": "Un solo camino de aprendizaje. Elige cómo quieres comenzar.",
        "earlyText": "Empieza de forma autónoma en ALLIM o elige la Academy cuando necesites la guía directa de un profesor. Ambas modalidades se complementan para que la práctica diaria y el aprendizaje guiado fortalezcan un mismo progreso.",
        "footerMission": "Memorizar · Comprender · Vivir",
    },
    "de": {
        "heroEyebrow": "Auswendig lernen · Verstehen · Leben",
        "earlyEyebrow": "Wählen Sie Ihren Einstieg",
        "earlyTitle": "Ein Lernweg. Wählen Sie, wie Sie beginnen möchten.",
        "earlyText": "Beginnen Sie selbstständig in ALLIM oder wählen Sie die Academy, wenn Sie persönliche Begleitung durch eine Lehrkraft benötigen. Beide Wege greifen ineinander, sodass tägliches Üben und angeleitetes Lernen denselben Fortschritt stärken.",
        "footerMission": "Auswendig lernen · Verstehen · Leben",
    },
    "ms": {
        "heroEyebrow": "Hafaz · Fahami · Hayati",
        "earlyEyebrow": "Pilih cara untuk bermula",
        "earlyTitle": "Satu perjalanan pembelajaran. Pilih cara anda mahu bermula.",
        "earlyText": "Mulakan dengan pembelajaran kendiri dalam ALLIM, atau pilih Academy apabila anda memerlukan bimbingan langsung daripada guru. Kedua-dua laluan saling melengkapi agar latihan harian dan pembelajaran bersama guru mengukuhkan kemajuan yang sama.",
        "footerMission": "Hafaz · Fahami · Hayati",
    },
    "id": {
        "heroEyebrow": "Hafalkan · Pahami · Amalkan",
        "earlyEyebrow": "Pilih cara memulai",
        "earlyTitle": "Satu perjalanan belajar. Pilih cara Anda ingin memulai.",
        "earlyText": "Mulailah dengan belajar mandiri di ALLIM, atau pilih Academy ketika Anda membutuhkan bimbingan langsung dari guru. Kedua jalur saling melengkapi agar latihan harian dan pembelajaran bersama guru memperkuat kemajuan yang sama.",
        "footerMission": "Hafalkan · Pahami · Amalkan",
    },
    "ur": {
        "heroEyebrow": "حفظ کریں · سمجھیں · زندگی میں اپنائیں",
        "earlyEyebrow": "اپنا آغاز منتخب کریں",
        "earlyTitle": "سیکھنے کا ایک سفر۔ آغاز کا طریقہ آپ منتخب کریں۔",
        "earlyText": "ALLIM میں خود مطالعہ سے آغاز کریں، یا جب استاد کی براہِ راست رہنمائی درکار ہو تو ALLIM QUR’AN ACADEMY کا انتخاب کریں۔ دونوں طریقے ایک دوسرے سے مربوط ہیں، تاکہ روزانہ کی مشق اور استاد کے ساتھ سیکھنا ایک ہی پیش رفت کو مضبوط کریں۔",
        "footerMission": "حفظ کریں · سمجھیں · زندگی میں اپنائیں",
    },
    "hi": {
        "heroEyebrow": "कंठस्थ करें · समझें · जीवन में उतारें",
        "earlyEyebrow": "शुरुआत का तरीका चुनें",
        "earlyTitle": "सीखने की एक यात्रा। तय करें कि आप कैसे शुरू करना चाहते हैं।",
        "earlyText": "ALLIM में स्व-अध्ययन से शुरुआत करें, या जब शिक्षक के प्रत्यक्ष मार्गदर्शन की आवश्यकता हो तो ALLIM QUR’AN ACADEMY चुनें। दोनों मार्ग जुड़े हैं, ताकि दैनिक अभ्यास और शिक्षक के साथ अध्ययन एक ही प्रगति को मजबूत करें।",
        "footerMission": "कंठस्थ करें · समझें · जीवन में उतारें",
    },
    "pt": {
        "heroEyebrow": "Memorizar · Compreender · Viver",
        "earlyEyebrow": "Escolha como começar",
        "earlyTitle": "Uma só jornada de aprendizagem. Escolha como deseja começar.",
        "earlyText": "Comece a aprender de forma autónoma no ALLIM ou escolha a Academy quando precisar da orientação direta de um professor. As duas modalidades complementam-se, para que a prática diária e a aprendizagem guiada reforcem o mesmo progresso.",
        "footerMission": "Memorizar · Compreender · Viver",
    },
    "sw": {
        "heroEyebrow": "Hifadhi · Elewa · Ishi",
        "listenTitle": "Sikiliza kwa makini",
        "earlyEyebrow": "Chagua jinsi ya kuanza",
        "earlyTitle": "Safari moja ya kujifunza. Chagua jinsi unavyotaka kuanza.",
        "earlyText": "Anza kujifunza mwenyewe ndani ya ALLIM, au chagua Academy unapohitaji mwongozo wa moja kwa moja kutoka kwa mwalimu. Njia hizo mbili zinakamilishana ili mazoezi ya kila siku na kujifunza pamoja na mwalimu viimarishe maendeleo yale yale.",
        "footerMission": "Hifadhi · Elewa · Ishi",
    },
}

SHARE_OVERRIDES = {
    "bs": {
        "referralLabel": "JEDNONIVOJSKA PREPORUKA AKADEMIJE", "referralTitle": "Jasan popust za stvarnog polaznika — nikada za izgradnju mreže.", "referralText": "U prihvatljivim plaćenim programima Akademije, osoba koja poziva i novi polaznik mogu dobiti po 10% popusta za jedan obračunski period nakon konačne prve uplate. Nema isplate u novcu, drugog nivoa, timova ni zarade od kasnijih poziva.", "referralAction": "Pozovi u Akademiju",
        "shareEyebrow": "PODIJELI KORIST", "shareTitle": "Koristan put postaje snažniji kada stigne do onoga kome je potreban.", "shareText": "Pozovite prijatelja ili člana porodice da uz ALLIM uči, čita i razumije Kur’an.", "shareFaith": "Nadamo se nagradi od Allaha za upućivanje drugih na ono što koristi. ALLIM ne obećava niti računa nagradu na Ahiretu.", "shareAction": "Podijeli ALLIM", "shareOpenTitle": "Dijeljenje ostaje otvoreno", "shareOpenText": "Za dijeljenje ALLIM-a s drugim polaznikom nisu potrebni kupovina, naknada ni plaćeno članstvo.", "shareLevelTitle": "Jedan poziv. Jedan nivo.", "shareLevelText": "Popust Akademije vezan je samo za stvarni plaćeni upis novog polaznika — nikada za lanac kasnijih poziva.", "shareMessage": "ALLIM je prostor za učenje čitanja, pamćenja i razumijevanja Kur’ana.", "shareCopied": "Link je kopiran", "shareComplete": "Poziv je spreman za slanje", "shareFailed": "Meni za dijeljenje nije otvoren. Kopirajte link ručno.", "footerShare": "Podijeli korist",
    },
    "fr": {
        "referralLabel": "PARRAINAGE DIRECT DE L’ACADÉMIE", "referralTitle": "Une remise claire pour un véritable élève — jamais pour construire un réseau.", "referralText": "Pour les programmes payants éligibles de l’Académie, le parrain et le nouvel élève peuvent recevoir chacun 10 % de remise sur une période de facturation après validation définitive du premier paiement. Aucun versement en espèces, second niveau, équipe ou gain sur les invitations suivantes.", "referralAction": "Inviter à l’Académie",
        "shareEyebrow": "PARTAGER LE BIEN", "shareTitle": "Un chemin utile prend plus de force lorsqu’il atteint la personne qui en a besoin.", "shareText": "Invitez un ami ou un proche à apprendre, lire et comprendre le Coran avec ALLIM.", "shareFaith": "Nous espérons la récompense d’Allah pour avoir orienté autrui vers ce qui est bénéfique. ALLIM ne promet ni ne comptabilise de récompense dans l’au-delà.", "shareAction": "Partager ALLIM", "shareOpenTitle": "Le partage reste ouvert", "shareOpenText": "Aucun achat, frais ou abonnement payant n’est requis pour partager ALLIM avec un autre élève.", "shareLevelTitle": "Une invitation. Un seul niveau.", "shareLevelText": "Toute remise de l’Académie dépend uniquement de l’inscription payante réelle d’un nouvel élève — jamais d’une chaîne d’invitations ultérieures.", "shareMessage": "ALLIM est un espace pour apprendre à lire, mémoriser et comprendre le Coran.", "shareCopied": "Lien copié", "shareComplete": "Invitation prête à être envoyée", "shareFailed": "Le menu de partage n’a pas pu s’ouvrir. Copiez le lien manuellement.", "footerShare": "Partager le bien",
    },
    "zh": {
        "referralLabel": "学院单层邀请", "referralTitle": "为真实学员提供清晰优惠——绝不用于发展网络。", "referralText": "在符合条件的学院付费课程中，邀请者和新学员在首笔付款最终确认后，均可获得一个计费周期的九折优惠。不返现金、不设第二层级、不组团队，也不从后续邀请中获利。", "referralAction": "邀请加入学院",
        "shareEyebrow": "分享裨益", "shareTitle": "当有益的道路抵达真正需要它的人时，影响会更深远。", "shareText": "邀请朋友或家人与 ALLIM 一起学习、诵读并理解《古兰经》。", "shareFaith": "我们祈望安拉因我们引导他人获得裨益而赐予回赐。ALLIM 不承诺也不计算后世的回赐。", "shareAction": "分享 ALLIM", "shareOpenTitle": "分享始终开放", "shareOpenText": "向其他学员分享 ALLIM 无需购买、付费或加入付费会员。", "shareLevelTitle": "一次邀请。一个层级。", "shareLevelText": "学院优惠只与新学员真实的付费报名相关，绝不与后续邀请链相关。", "shareMessage": "ALLIM 是学习诵读、背诵和理解《古兰经》的空间。", "shareCopied": "链接已复制", "shareComplete": "邀请已可发送", "shareFailed": "无法打开分享菜单，请手动复制链接。", "footerShare": "分享裨益",
    },
    "ja": {
        "referralLabel": "アカデミーへの1段階紹介", "referralTitle": "実際に学ぶ人への明確な割引。ネットワーク作りのためではありません。", "referralText": "対象となるアカデミーの有料プログラムでは、初回支払いの確定後、紹介者と新しい受講者がそれぞれ1回の支払期間について10%割引を受けられます。現金支払い、2段階目、チーム、後続紹介からの収益はありません。", "referralAction": "アカデミーに招待する",
        "shareEyebrow": "学びの恵みを分かち合う", "shareTitle": "有益な道は、それを必要とする人に届くことでさらに力を持ちます。", "shareText": "友人や家族を、ALLIMでクルアーンを学び、読み、理解する道へ招きましょう。", "shareFaith": "人を有益なことへ導くことで、アッラーから報奨をいただけるよう願います。ALLIMは来世の報奨を約束したり数値化したりしません。", "shareAction": "ALLIMを共有", "shareOpenTitle": "共有は誰にでも開かれています", "shareOpenText": "ALLIMを他の学習者に共有するための購入、料金、有料会員登録は不要です。", "shareLevelTitle": "一つの招待。一つの段階。", "shareLevelText": "アカデミー割引は、新しい受講者の実際の有料登録だけに結びつき、その後の紹介の連鎖には結びつきません。", "shareMessage": "ALLIMはクルアーンを読み、暗記し、理解するための学習空間です。", "shareCopied": "リンクをコピーしました", "shareComplete": "招待を送信できます", "shareFailed": "共有メニューを開けませんでした。リンクを手動でコピーしてください。", "footerShare": "学びの恵みを共有",
    },
    "es": {
        "referralLabel": "REFERENCIA DIRECTA A LA ACADEMIA", "referralTitle": "Un descuento claro para un alumno real, nunca para construir una red.", "referralText": "En los programas de pago elegibles de la Academia, quien invita y el nuevo alumno pueden recibir cada uno un 10 % de descuento durante un período de facturación después de que el primer pago sea definitivo. Sin pagos en efectivo, segundo nivel, equipos ni ganancias por invitaciones posteriores.", "referralAction": "Invitar a la Academia",
        "shareEyebrow": "COMPARTE EL BIEN", "shareTitle": "Un camino útil cobra más fuerza cuando llega a quien lo necesita.", "shareText": "Invita a un amigo o familiar a aprender, leer y comprender el Corán con ALLIM.", "shareFaith": "Esperamos la recompensa de Allah por guiar a otros hacia lo beneficioso. ALLIM no promete ni contabiliza recompensas en la otra vida.", "shareAction": "Compartir ALLIM", "shareOpenTitle": "Compartir está abierto a todos", "shareOpenText": "No se requiere compra, cuota ni membresía de pago para compartir ALLIM con otro alumno.", "shareLevelTitle": "Una invitación. Un nivel.", "shareLevelText": "El descuento de la Academia depende únicamente de la inscripción real de pago del nuevo alumno, nunca de una cadena de invitaciones posteriores.", "shareMessage": "ALLIM es un espacio para aprender a leer, memorizar y comprender el Corán.", "shareCopied": "Enlace copiado", "shareComplete": "Invitación lista para enviar", "shareFailed": "No se pudo abrir el menú para compartir. Copia el enlace manualmente.", "footerShare": "Comparte el bien",
    },
    "de": {
        "referralLabel": "DIREKTE AKADEMIE-EMPFEHLUNG", "referralTitle": "Ein klarer Rabatt für einen echten Lernenden — niemals zum Aufbau eines Netzwerks.", "referralText": "Bei berechtigten kostenpflichtigen Akademie-Programmen können die einladende Person und der neue Lernende nach endgültiger Bestätigung der ersten Zahlung jeweils 10 % Rabatt für einen Abrechnungszeitraum erhalten. Keine Barauszahlung, keine zweite Ebene, keine Teams und keine Erträge aus späteren Einladungen.", "referralAction": "Zur Akademie einladen",
        "shareEyebrow": "NUTZEN TEILEN", "shareTitle": "Ein hilfreicher Weg wird stärker, wenn er den Menschen erreicht, der ihn braucht.", "shareText": "Laden Sie Freunde oder Angehörige ein, mit ALLIM den Koran zu lernen, zu lesen und zu verstehen.", "shareFaith": "Wir hoffen auf Belohnung von Allah dafür, andere zu Nützlichem zu führen. ALLIM verspricht oder zählt keine Belohnung im Jenseits.", "shareAction": "ALLIM teilen", "shareOpenTitle": "Teilen bleibt offen", "shareOpenText": "Um ALLIM mit einem anderen Lernenden zu teilen, sind weder Kauf noch Gebühr oder bezahlte Mitgliedschaft erforderlich.", "shareLevelTitle": "Eine Einladung. Eine Ebene.", "shareLevelText": "Ein Akademie-Rabatt ist ausschließlich an die tatsächliche bezahlte Anmeldung eines neuen Lernenden gebunden — niemals an eine Kette späterer Einladungen.", "shareMessage": "ALLIM ist ein Lernraum zum Lesen, Auswendiglernen und Verstehen des Korans.", "shareCopied": "Link kopiert", "shareComplete": "Einladung ist versandbereit", "shareFailed": "Das Teilen-Menü konnte nicht geöffnet werden. Kopieren Sie den Link manuell.", "footerShare": "Nutzen teilen",
    },
    "ms": {
        "referralLabel": "RUJUKAN AKADEMI SATU PERINGKAT", "referralTitle": "Diskaun yang jelas untuk pelajar sebenar — bukan untuk membina rangkaian.", "referralText": "Bagi program Akademi berbayar yang layak, pengundang dan pelajar baharu masing-masing boleh menerima diskaun 10% untuk satu tempoh bil selepas bayaran pertama menjadi muktamad. Tiada bayaran tunai, peringkat kedua, pasukan atau pendapatan daripada undangan seterusnya.", "referralAction": "Jemput ke Akademi",
        "shareEyebrow": "KONGSI MANFAAT", "shareTitle": "Jalan yang bermanfaat menjadi lebih kuat apabila sampai kepada orang yang memerlukannya.", "shareText": "Jemput rakan atau ahli keluarga untuk belajar, membaca dan memahami al-Quran bersama ALLIM.", "shareFaith": "Kami mengharapkan ganjaran daripada Allah kerana menunjukkan orang lain kepada perkara yang bermanfaat. ALLIM tidak menjanjikan atau mengira ganjaran akhirat.", "shareAction": "Kongsi ALLIM", "shareOpenTitle": "Perkongsian terbuka untuk semua", "shareOpenText": "Tiada pembelian, yuran atau keahlian berbayar diperlukan untuk berkongsi ALLIM dengan pelajar lain.", "shareLevelTitle": "Satu undangan. Satu peringkat.", "shareLevelText": "Diskaun Akademi hanya berkaitan dengan pendaftaran berbayar sebenar pelajar baharu — bukan rantaian undangan seterusnya.", "shareMessage": "ALLIM ialah ruang pembelajaran untuk membaca, menghafaz dan memahami al-Quran.", "shareCopied": "Pautan disalin", "shareComplete": "Undangan sedia dihantar", "shareFailed": "Menu perkongsian tidak dapat dibuka. Salin pautan secara manual.", "footerShare": "Kongsi manfaat",
    },
    "id": {
        "referralLabel": "RUJUKAN AKADEMI SATU TINGKAT", "referralTitle": "Diskon yang jelas untuk pelajar nyata — bukan untuk membangun jaringan.", "referralText": "Untuk program Akademi berbayar yang memenuhi syarat, pengundang dan pelajar baru masing-masing dapat menerima diskon 10% untuk satu periode tagihan setelah pembayaran pertama bersifat final. Tanpa pembayaran tunai, tingkat kedua, tim, atau penghasilan dari undangan berikutnya.", "referralAction": "Undang ke Akademi",
        "shareEyebrow": "BAGIKAN MANFAAT", "shareTitle": "Jalan yang bermanfaat menjadi lebih kuat ketika sampai kepada orang yang membutuhkannya.", "shareText": "Ajak teman atau keluarga untuk belajar, membaca, dan memahami Al-Qur’an bersama ALLIM.", "shareFaith": "Kami mengharap pahala dari Allah karena menunjukkan orang lain kepada hal yang bermanfaat. ALLIM tidak menjanjikan atau menghitung pahala akhirat.", "shareAction": "Bagikan ALLIM", "shareOpenTitle": "Berbagi terbuka untuk semua", "shareOpenText": "Tidak diperlukan pembelian, biaya, atau keanggotaan berbayar untuk membagikan ALLIM kepada pelajar lain.", "shareLevelTitle": "Satu undangan. Satu tingkat.", "shareLevelText": "Diskon Akademi hanya terkait dengan pendaftaran berbayar nyata dari pelajar baru — bukan rantai undangan berikutnya.", "shareMessage": "ALLIM adalah ruang belajar untuk membaca, menghafal, dan memahami Al-Qur’an.", "shareCopied": "Tautan disalin", "shareComplete": "Undangan siap dikirim", "shareFailed": "Menu berbagi tidak dapat dibuka. Salin tautan secara manual.", "footerShare": "Bagikan manfaat",
    },
    "ur": {
        "referralLabel": "اکیڈمی کا ایک سطحی تعارف", "referralTitle": "حقیقی طالب علم کے لیے واضح رعایت — نیٹ ورک بنانے کے لیے نہیں۔", "referralText": "اکیڈمی کے اہل بامعاوضہ پروگراموں میں دعوت دینے والے اور نئے طالب علم، پہلی ادائیگی حتمی ہونے کے بعد ایک بلنگ مدت کے لیے الگ الگ 10٪ رعایت حاصل کر سکتے ہیں۔ نہ نقد ادائیگی، نہ دوسری سطح، نہ ٹیمیں اور نہ بعد کی دعوتوں سے آمدن۔", "referralAction": "اکیڈمی میں دعوت دیں",
        "shareEyebrow": "فائدہ پہنچائیں", "shareTitle": "فائدہ مند راستہ اس وقت مضبوط ہوتا ہے جب وہ ضرورت مند تک پہنچے۔", "shareText": "کسی دوست یا عزیز کو ALLIM کے ساتھ قرآن سیکھنے، پڑھنے اور سمجھنے کی دعوت دیں۔", "shareFaith": "ہم دوسروں کو نفع بخش چیز کی رہنمائی کرنے پر اللہ سے اجر کی امید رکھتے ہیں۔ ALLIM آخرت کے اجر کا وعدہ یا حساب نہیں کرتا۔", "shareAction": "ALLIM شیئر کریں", "shareOpenTitle": "شیئر کرنا سب کے لیے کھلا ہے", "shareOpenText": "ALLIM کسی دوسرے طالب علم کے ساتھ شیئر کرنے کے لیے خریداری، فیس یا بامعاوضہ رکنیت ضروری نہیں۔", "shareLevelTitle": "ایک دعوت۔ ایک سطح۔", "shareLevelText": "اکیڈمی کی رعایت صرف نئے طالب علم کے حقیقی بامعاوضہ داخلے سے منسلک ہے، بعد کی دعوتوں کی زنجیر سے نہیں۔", "shareMessage": "ALLIM قرآن پڑھنے، حفظ کرنے اور سمجھنے کے لیے ایک تعلیمی جگہ ہے۔", "shareCopied": "لنک نقل ہو گیا", "shareComplete": "دعوت بھیجنے کے لیے تیار ہے", "shareFailed": "شیئر مینو نہ کھل سکا۔ لنک خود نقل کریں۔", "footerShare": "فائدہ پہنچائیں",
    },
    "hi": {
        "referralLabel": "अकादमी का एक-स्तरीय परिचय", "referralTitle": "वास्तविक विद्यार्थी के लिए स्पष्ट छूट — नेटवर्क बनाने के लिए नहीं।", "referralText": "अकादमी के पात्र सशुल्क कार्यक्रमों में, आमंत्रित करने वाला और नया विद्यार्थी पहली भुगतान की अंतिम पुष्टि के बाद एक बिलिंग अवधि के लिए अलग-अलग 10% छूट पा सकते हैं। नकद भुगतान, दूसरा स्तर, टीम या आगे के आमंत्रणों से कमाई नहीं।", "referralAction": "अकादमी में आमंत्रित करें",
        "shareEyebrow": "लाभ साझा करें", "shareTitle": "लाभकारी राह तब और मजबूत होती है जब वह उस व्यक्ति तक पहुँचे जिसे उसकी आवश्यकता है।", "shareText": "किसी मित्र या परिवारजन को ALLIM के साथ क़ुरआन सीखने, पढ़ने और समझने के लिए आमंत्रित करें।", "shareFaith": "हम दूसरों को लाभकारी बात की राह दिखाने पर अल्लाह से अज्र की आशा रखते हैं। ALLIM आख़िरत के अज्र का वादा या हिसाब नहीं करता।", "shareAction": "ALLIM साझा करें", "shareOpenTitle": "साझा करना सबके लिए खुला है", "shareOpenText": "ALLIM को किसी अन्य विद्यार्थी के साथ साझा करने के लिए खरीद, शुल्क या सशुल्क सदस्यता आवश्यक नहीं।", "shareLevelTitle": "एक आमंत्रण। एक स्तर।", "shareLevelText": "अकादमी की छूट केवल नए विद्यार्थी के वास्तविक सशुल्क नामांकन से जुड़ी है — आगे के आमंत्रणों की शृंखला से नहीं।", "shareMessage": "ALLIM क़ुरआन पढ़ने, याद करने और समझने के लिए एक शिक्षण स्थान है।", "shareCopied": "लिंक कॉपी हो गया", "shareComplete": "आमंत्रण भेजने के लिए तैयार है", "shareFailed": "साझा करने का मेनू नहीं खुला। लिंक को स्वयं कॉपी करें।", "footerShare": "लाभ साझा करें",
    },
    "pt": {
        "referralLabel": "INDICAÇÃO DIRETA PARA A ACADEMIA", "referralTitle": "Um desconto claro para um aluno real — nunca para construir uma rede.", "referralText": "Nos programas pagos elegíveis da Academia, quem convida e o novo aluno podem receber, cada um, 10% de desconto durante um período de faturação após a confirmação definitiva do primeiro pagamento. Sem pagamento em dinheiro, segundo nível, equipas ou ganhos com convites posteriores.", "referralAction": "Convidar para a Academia",
        "shareEyebrow": "PARTILHE O BEM", "shareTitle": "Um caminho útil ganha força quando chega a quem precisa dele.", "shareText": "Convide um amigo ou familiar a aprender, ler e compreender o Alcorão com o ALLIM.", "shareFaith": "Esperamos a recompensa de Allah por orientar outras pessoas para o que é benéfico. O ALLIM não promete nem contabiliza recompensas na outra vida.", "shareAction": "Partilhar o ALLIM", "shareOpenTitle": "A partilha permanece aberta", "shareOpenText": "Não é necessária qualquer compra, taxa ou adesão paga para partilhar o ALLIM com outro aluno.", "shareLevelTitle": "Um convite. Um nível.", "shareLevelText": "O desconto da Academia está ligado apenas à inscrição paga real de um novo aluno — nunca a uma cadeia de convites posteriores.", "shareMessage": "O ALLIM é um espaço para aprender a ler, memorizar e compreender o Alcorão.", "shareCopied": "Ligação copiada", "shareComplete": "Convite pronto para enviar", "shareFailed": "Não foi possível abrir o menu de partilha. Copie a ligação manualmente.", "footerShare": "Partilhe o bem",
    },
    "sw": {
        "referralLabel": "MWALIKO WA NGAZI MOJA KWA AKADEMI", "referralTitle": "Punguzo wazi kwa mwanafunzi halisi — si kwa kujenga mtandao.", "referralText": "Katika programu zinazostahiki za kulipia za Akademi, mwaliko na mwanafunzi mpya wanaweza kila mmoja kupata punguzo la 10% kwa kipindi kimoja cha malipo baada ya malipo ya kwanza kuthibitishwa kabisa. Hakuna malipo ya fedha, ngazi ya pili, timu au mapato kutoka mialiko ya baadaye.", "referralAction": "Alika kwenye Akademi",
        "shareEyebrow": "SHIRIKI MANUFAA", "shareTitle": "Njia yenye manufaa huwa na nguvu zaidi inapomfikia anayeihitaji.", "shareText": "Mwalike rafiki au ndugu ajifunze, asome na aelewe Qur’ani pamoja na ALLIM.", "shareFaith": "Tunatarajia malipo kutoka kwa Allah kwa kuwaelekeza wengine kwenye yenye manufaa. ALLIM haiahidi wala kuhesabu malipo ya Akhera.", "shareAction": "Shiriki ALLIM", "shareOpenTitle": "Kushiriki ni wazi kwa wote", "shareOpenText": "Hakuna ununuzi, ada au uanachama wa kulipia unaohitajika ili kushiriki ALLIM na mwanafunzi mwingine.", "shareLevelTitle": "Mwaliko mmoja. Ngazi moja.", "shareLevelText": "Punguzo la Akademi linahusishwa tu na usajili halisi wa kulipia wa mwanafunzi mpya — si mlolongo wa mialiko ya baadaye.", "shareMessage": "ALLIM ni nafasi ya kujifunza kusoma, kuhifadhi na kuelewa Qur’ani.", "shareCopied": "Kiungo kimenakiliwa", "shareComplete": "Mwaliko uko tayari kutumwa", "shareFailed": "Menyu ya kushiriki haikuweza kufunguka. Nakili kiungo mwenyewe.", "footerShare": "Shiriki manufaa",
    },
}


class CopyParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.stack: list[dict[str, object]] = []
        self.items: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data_copy = dict(attrs).get("data-copy")
        self.stack.append({"tag": tag, "key": data_copy, "text": []})

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        return

    def handle_data(self, data: str) -> None:
        for item in self.stack:
            if item["key"]:
                item["text"].append(data)

    def handle_endtag(self, tag: str) -> None:
        if not self.stack:
            return
        item = self.stack.pop()
        key = item["key"]
        if key and key not in self.items:
            self.items[str(key)] = " ".join("".join(item["text"]).split())


def source_copy() -> dict[str, str]:
    parser = CopyParser()
    parser.feed((ROOT / "index.html").read_text(encoding="utf-8"))
    copy = dict(parser.items)
    copy.update(EXTRA_ENGLISH)
    return copy


def batches(copy: dict[str, str], limit: int = 1500) -> list[list[tuple[str, str]]]:
    result: list[list[tuple[str, str]]] = []
    current: list[tuple[str, str]] = []
    current_size = 0
    for key, value in copy.items():
        line_size = len((f"[[{key}]] {value}\n").encode("utf-8"))
        if current and current_size + line_size > limit:
            result.append(current)
            current = []
            current_size = 0
        current.append((key, value))
        current_size += line_size
    if current:
        result.append(current)
    return result


def request_translation(target: str, entries: list[tuple[str, str]]) -> dict[str, str]:
    source = "\n".join(f"[[K{index:03d}]] {value}" for index, (_, value) in enumerate(entries))
    query = urllib.parse.urlencode({
        "client": "dict-chrome-ex",
        "sl": "en",
        "tl": target,
        "q": source,
    })
    request = urllib.request.Request(
        "https://clients5.google.com/translate_a/t?" + query,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    error: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                payload = json.load(response)
            translated = payload[0]
            markers = list(re.finditer(r"\[\[K(\d{3})\]\]", translated))
            values: dict[str, str] = {}
            for index, marker in enumerate(markers):
                entry_index = int(marker.group(1))
                if entry_index >= len(entries):
                    continue
                key = entries[entry_index][0]
                end = markers[index + 1].start() if index + 1 < len(markers) else len(translated)
                values[key] = translated[marker.end():end].strip()
            missing = [key for key, _ in entries if not values.get(key)]
            if missing:
                if len(entries) > 1:
                    midpoint = len(entries) // 2
                    recovered = request_translation(target, entries[:midpoint])
                    recovered.update(request_translation(target, entries[midpoint:]))
                    return recovered
                cleaned = re.sub(r"^\s*\[\[[^\]]+\]\]\s*", "", translated).strip()
                if cleaned:
                    return {entries[0][0]: cleaned}
                raise RuntimeError("Missing marker: " + missing[0])
            return {key: values[key] for key, _ in entries}
        except Exception as caught:
            error = caught
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Translation failed for {target}: {error}")


def main() -> None:
    english = source_copy()
    cached: dict[str, dict[str, str]] = {}
    if CACHE.exists():
        cached = json.loads(CACHE.read_text(encoding="utf-8"))

    for language, path in CURATED_FILES.items():
        curated = json.loads(path.read_text(encoding="utf-8"))
        missing = [key for key in english if not curated.get(key)]
        if missing:
            raise RuntimeError(f"Incomplete curated {language} translation: {missing}")
        cached.setdefault(language, {}).update({key: curated[key] for key in english})

    work: list[tuple[str, str, list[list[tuple[str, str]]]]] = []
    offline = os.environ.get("ALLIM_I18N_OFFLINE") == "1"
    for language, meta in LANGUAGES.items():
        cached.setdefault(language, {})
        missing = {key: value for key, value in english.items() if key not in cached[language]}
        if offline and missing:
            cached[language].update(missing)
            missing = {}
        language_batches = batches(missing)
        if language_batches:
            work.append((language, str(meta["api"]), language_batches))

    def translate(item: tuple[str, str, list[list[tuple[str, str]]]]) -> tuple[str, dict[str, str]]:
        language, target, language_batches = item
        result: dict[str, str] = {}
        for entries in language_batches:
            result.update(request_translation(target, entries))
            time.sleep(0.7)
        return language, result

    if work:
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            for language, translated in executor.map(translate, work):
                cached[language].update(translated)
                CACHE.write_text(json.dumps(cached, ensure_ascii=False, indent=2), encoding="utf-8")

    missing_report = {
        language: [key for key in english if not cached[language].get(key)]
        for language in LANGUAGES
    }
    if any(missing_report.values()):
        raise RuntimeError("Incomplete translation: " + json.dumps(missing_report, ensure_ascii=False))

    payload = {
        language: {key: cached[language][key] for key in english}
        for language in LANGUAGES
    }
    for language, replacements in OVERRIDES.items():
        payload[language].update(replacements)
    for language, replacements in SHARE_OVERRIDES.items():
        payload[language].update(replacements)
    for key, value in payload["bs"].items():
        payload["bs"][key] = value.replace("Kur 'an", "Kur’an").replace("kur 'an", "kur’an")
    output = (
        "/* Generated static interface translations. Rebuild with build_i18n.py. */\n"
        "window.ALLIM_EXTRA_COPIES = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\nwindow.ALLIM_LANGUAGE_META = "
        + json.dumps(LANGUAGES, ensure_ascii=False, indent=2)
        + ";\n"
    )
    OUTPUT.write_text(output, encoding="utf-8")
    print(json.dumps({"languages": len(payload), "keys": len(english), "output": str(OUTPUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
