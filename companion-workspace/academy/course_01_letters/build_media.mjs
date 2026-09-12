import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MEDIA = path.join(ROOT, "media");
const SCENES = path.join(MEDIA, "scenes");
const BRAND = path.resolve(ROOT, "../../brand-system/approved-logo/mushaf-pattern-v9");
const BACKGROUND = path.join(BRAND, "allim-no-blue-turquoise-jade-patterned-background.png");
const LOGO = path.join(BRAND, "allim-turquoise-jade-with-lower-mushaf-geometry-transparent.png");
const FFMPEG = "/Applications/Compass.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg";

const COLORS = {
  ivory: "#F7F1E5",
  ink: "#093F42",
  teal: "#0B7377",
  jade: "#24B77C",
  mint: "#9DE5C4",
  white: "#FFFFFF",
};

const esc = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function textLines(lines, { x, y, size, weight = 600, fill = COLORS.ivory, gap = 1.12, anchor = "start", family = "SF Pro Display, Arial, sans-serif", dir = "ltr" }) {
  return lines.map((line, index) => (
    `<text x="${x}" y="${y + index * size * gap}" text-anchor="${anchor}" direction="${dir}" unicode-bidi="bidi-override" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(line)}</text>`
  )).join("\n");
}

function backdrop(width, height, opacity = 0.16) {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#073F48" stop-opacity="0.86"/>
        <stop offset="0.58" stop-color="#086E72" stop-opacity="0.72"/>
        <stop offset="1" stop-color="#139C72" stop-opacity="0.48"/>
      </linearGradient>
      <radialGradient id="glow" cx="82%" cy="20%" r="72%">
        <stop offset="0" stop-color="#83E1BB" stop-opacity="0.38"/>
        <stop offset="1" stop-color="#83E1BB" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="#086E72"/>
    <rect width="100%" height="100%" fill="url(#shade)"/>
    <rect width="100%" height="100%" fill="url(#glow)"/>
    <g fill="none" stroke="#D8F7E6" stroke-opacity="${opacity}" stroke-width="1.5">
      <path d="M-${width * 0.08} ${height * 0.82} C${width * 0.2} ${height * 0.66}, ${width * 0.38} ${height * 1.08}, ${width * 0.66} ${height * 0.83} S${width * 1.04} ${height * 0.62}, ${width * 1.1} ${height * 0.8}"/>
      <path d="M-${width * 0.1} ${height * 0.91} Q${width * 0.18} ${height * 0.63} ${width * 0.42} ${height * 0.9} T${width * 0.92} ${height * 0.9} T${width * 1.12} ${height * 0.72}"/>
      <path d="M0 ${height * 0.72} L${width * 0.11} ${height * 0.92} L${width * 0.22} ${height * 0.72} L${width * 0.33} ${height * 0.92} L${width * 0.44} ${height * 0.72} L${width * 0.55} ${height * 0.92} L${width * 0.66} ${height * 0.72} L${width * 0.77} ${height * 0.92} L${width * 0.88} ${height * 0.72} L${width} ${height * 0.92}"/>
      <path d="M0 ${height * 0.9} H${width}"/>
    </g>
  </svg>`;
}

async function whiteLogo(width) {
  return sharp(LOGO)
    .resize({ width })
    .ensureAlpha()
    .tint(COLORS.ivory)
    .png()
    .toBuffer();
}

async function baseCanvas(width, height) {
  return sharp(Buffer.from(backdrop(width, height)));
}

async function makeCover() {
  const width = 1500;
  const height = 844;
  const logo = await whiteLogo(238);
  const overlay = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="26" flood-color="#002E33" flood-opacity="0.25"/></filter>
    </defs>
    <text x="108" y="200" font-family="SF Pro Display, Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="4" fill="#9DE5C4">БАЗОВЫЙ КУРС • УРОВЕНЬ 1</text>
    ${textLines(["Буквы", "Корана"], { x: 104, y: 310, size: 104, weight: 750, gap: 0.92 })}
    <text x="110" y="528" font-family="SF Pro Display, Arial, sans-serif" font-size="30" font-weight="550" fill="#D7F4E7">Узнаём форму. Находим в аятах.</text>
    <g filter="url(#shadow)">
      <rect x="920" y="150" width="450" height="480" rx="54" fill="#F7F1E5" fill-opacity="0.96"/>
      <rect x="963" y="193" width="364" height="54" rx="27" fill="#DFF6E9"/>
      <text x="1145" y="230" text-anchor="middle" font-family="SF Pro Display, Arial, sans-serif" font-size="21" font-weight="700" letter-spacing="2" fill="#0B7377">ОДНА БУКВА — 4 ФОРМЫ</text>
      <text x="1145" y="392" text-anchor="middle" direction="rtl" unicode-bidi="bidi-override" font-family="Geeza Pro, Arial Unicode MS, serif" font-size="82" font-weight="700" fill="#093F42">ب   بـ   ـبـ   ـب</text>
      <path d="M1003 467 H1287" stroke="#B9DFCF" stroke-width="2" stroke-linecap="round"/>
      <text x="1145" y="531" text-anchor="middle" font-family="SF Pro Display, Arial, sans-serif" font-size="23" font-weight="650" fill="#0B7377">ИЩЕМ В КОРАНЕ</text>
      <circle cx="1216" cy="557" r="23" fill="none" stroke="#24B77C" stroke-width="8"/>
      <path d="M1233 574 L1262 603" stroke="#24B77C" stroke-width="8" stroke-linecap="round"/>
    </g>
    <rect x="108" y="666" width="286" height="62" rx="31" fill="#F7F1E5"/>
    <text x="251" y="707" text-anchor="middle" font-family="SF Pro Display, Arial, sans-serif" font-size="23" font-weight="750" fill="#0B7377">28 БУКВ · 25 УРОКОВ</text>
  </svg>`;

  await (await baseCanvas(width, height))
    .composite([
      { input: logo, left: 108, top: 72 },
      { input: Buffer.from(overlay), left: 0, top: 0 },
    ])
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toFile(path.join(MEDIA, "allim-course-01-cover-1500x844.jpg"));

  await sharp(path.join(MEDIA, "allim-course-01-cover-1500x844.jpg"))
    .resize(750, 422, { fit: "cover" })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toFile(path.join(MEDIA, "allim-course-01-cover-750x422.jpg"));
}

const sceneData = [
  {
    kicker: "ALLIM QUR’AN • БАЗОВЫЙ КУРС",
    title: ["Буквы Корана"],
    subtitle: ["Первый шаг к чтению"],
    arabic: "ا  ب  ت  ث",
  },
  {
    kicker: "ШАГ 1",
    title: ["Узнайте", "28 букв"],
    subtitle: ["Не зубрите весь алфавит сразу —", "собирайте его понятными группами."],
    arabic: "ا  ل  م",
  },
  {
    kicker: "ШАГ 2",
    title: ["Увидьте", "каждую форму"],
    subtitle: ["Отдельно, в начале,", "середине и конце слова."],
    arabic: "ب   بـ   ـبـ   ـب",
  },
  {
    kicker: "ШАГ 3",
    title: ["Найдите букву", "в Коране"],
    subtitle: ["После каждого знакомства —", "короткий поиск в настоящем аяте."],
    arabic: "قُلْ هُوَ ٱللَّهُ أَحَدٌ",
  },
  {
    kicker: "ВАШ МАРШРУТ",
    title: ["8 глав", "25 коротких уроков"],
    subtitle: ["В своём темпе. С повторением.", "С ясным прогрессом."],
    arabic: "حرف  •  شكل  •  قرآن",
  },
  {
    kicker: "БЕСПЛАТНЫЙ ПЕРВЫЙ УРОК",
    title: ["Начните", "с первой буквы"],
    subtitle: ["Буква. Форма. Коран."],
    arabic: "ا",
    cta: "ОТКРЫТЬ КУРС",
  },
];

async function makeScene(index, data) {
  const width = 1280;
  const height = 720;
  const logo = await whiteLogo(172);
  const titleStart = data.title.length === 1 ? 272 : 240;
  const subtitleStart = data.title.length === 1 ? 378 : 438;
  const isAyah = index === 3;
  const arabicSize = isAyah ? 50 : (index === 5 ? 170 : 74);
  const cardY = isAyah ? 210 : 184;
  const overlay = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="shadow"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#002E33" flood-opacity="0.26"/></filter></defs>
    <text x="76" y="180" font-family="SF Pro Display, Arial, sans-serif" font-size="19" font-weight="750" letter-spacing="3.4" fill="#9DE5C4">${esc(data.kicker)}</text>
    ${textLines(data.title, { x: 72, y: titleStart, size: 67, weight: 760, gap: 0.94 })}
    ${textLines(data.subtitle, { x: 77, y: subtitleStart, size: 25, weight: 520, fill: "#D8F4E8", gap: 1.32 })}
    <g filter="url(#shadow)">
      <rect x="760" y="${cardY}" width="444" height="318" rx="48" fill="#F7F1E5" fill-opacity="0.97"/>
      ${index === 5 ? `<path d="M982 ${cardY + 72} Q1002 ${cardY + 86} 984 ${cardY + 105} L972 ${cardY + 236}" fill="none" stroke="#093F42" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>` : `<text x="982" y="${cardY + 170}" text-anchor="middle" direction="rtl" unicode-bidi="bidi-override" font-family="Geeza Pro, Arial Unicode MS, serif" font-size="${arabicSize}" font-weight="700" fill="#093F42">${esc(data.arabic)}</text>`}
      ${isAyah ? `<rect x="824" y="${cardY + 222}" width="316" height="48" rx="24" fill="#DFF6E9"/><text x="982" y="${cardY + 254}" text-anchor="middle" font-family="SF Pro Display, Arial, sans-serif" font-size="19" font-weight="700" fill="#0B7377">НАЙДИ ЗНАКОМЫЕ БУКВЫ</text>` : ""}
    </g>
    ${data.cta ? `<rect x="76" y="556" width="260" height="64" rx="32" fill="#F7F1E5"/><text x="206" y="598" text-anchor="middle" font-family="SF Pro Display, Arial, sans-serif" font-size="21" font-weight="750" letter-spacing="1" fill="#0B7377">${esc(data.cta)}</text>` : ""}
    <rect x="76" y="654" width="${Math.round((index + 1) / sceneData.length * 1128)}" height="5" rx="2.5" fill="#9DE5C4"/>
  </svg>`;

  await (await baseCanvas(width, height))
    .composite([
      { input: logo, left: 76, top: 58 },
      { input: Buffer.from(overlay), left: 0, top: 0 },
    ])
    .png()
    .toFile(path.join(SCENES, `scene-${String(index + 1).padStart(2, "0")}.png`));
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}`);
}

async function makeVideo() {
  const narration = "Начните с самого простого: увидеть букву, узнать её форму и найти её в Коране. В первом курсе А́ллим вы познакомитесь с двадцатью восемью арабскими буквами, научитесь различать их в начале, середине и конце слова и закрепите каждую через короткий поиск в аятах. Буква. Форма. Коран. Ваш первый шаг начинается здесь.";
  const audioAiff = path.join(MEDIA, "allim-course-01-preview-ru.aiff");
  const output = path.join(MEDIA, "allim-course-01-preview-ru.mp4");
  run("say", ["-v", "Milena", "-r", "172", "-o", audioAiff, narration]);

  const audioProbe = spawnSync(FFMPEG, ["-hide_banner", "-i", audioAiff], { encoding: "utf8" });
  const match = audioProbe.stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new Error("Could not read narration duration");
  const narrationSeconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  const sceneLength = Math.max(4.7, (narrationSeconds + 1.2) / sceneData.length);
  const fade = 0.55;

  const inputs = [];
  for (let i = 0; i < sceneData.length; i += 1) {
    inputs.push("-loop", "1", "-t", String(sceneLength), "-i", path.join(SCENES, `scene-${String(i + 1).padStart(2, "0")}.png`));
  }
  inputs.push("-i", audioAiff);

  const filters = [];
  for (let i = 0; i < sceneData.length; i += 1) {
    const zoomEnd = 1.025;
    filters.push(`[${i}:v]scale=1320:742,crop=1280:720,zoompan=z='min(zoom+0.00012,${zoomEnd})':d=${Math.round(sceneLength * 30)}:s=1280x720:fps=30,format=yuv420p[v${i}]`);
  }
  let current = "v0";
  let elapsed = sceneLength;
  for (let i = 1; i < sceneData.length; i += 1) {
    const out = `x${i}`;
    filters.push(`[${current}][v${i}]xfade=transition=fade:duration=${fade}:offset=${(elapsed - fade).toFixed(2)}[${out}]`);
    current = out;
    elapsed += sceneLength - fade;
  }
  filters.push(`[6:a]loudnorm=I=-16:LRA=7:TP=-1.5,afade=t=in:st=0:d=0.15,afade=t=out:st=${Math.max(0, narrationSeconds - 0.6).toFixed(2)}:d=0.6[a]`);

  run(FFMPEG, [
    "-y", ...inputs,
    "-filter_complex", filters.join(";"),
    "-map", `[${current}]`, "-map", "[a]",
    "-t", (narrationSeconds + 0.8).toFixed(2),
    "-c:v", "libx264", "-preset", "medium", "-crf", "21",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    output,
  ]);

  run(FFMPEG, [
    "-y", "-hide_banner", "-ss", "1.2", "-i", output,
    "-frames:v", "1", "-update", "1", "-q:v", "2",
    path.join(MEDIA, "allim-course-01-preview-poster.jpg"),
  ]);
}

await fs.mkdir(SCENES, { recursive: true });
await makeCover();
for (let i = 0; i < sceneData.length; i += 1) await makeScene(i, sceneData[i]);
await makeVideo();
console.log(`Created course media in ${MEDIA}`);
