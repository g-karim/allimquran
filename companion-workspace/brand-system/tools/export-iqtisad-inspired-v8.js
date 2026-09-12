const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'approved-logo/mushaf-pattern-v11');
const favOut = path.join(out, 'favicons');
const webpOut = path.join(out, 'webp');
const wordmarkMaskSource = path.join(root, 'approved-logo/allim-white-transparent.png');
const iconMask = path.join(root, 'approved-logo/favicons/allim-aq-black-transparent-1024.png');

const COLORS = {
  ink: '#0B1623',
  ivory: '#F5F2E9',
  edgeBlue: '#31416F',
  deepTeal: '#176F7B',
  turquoise: '#249B95',
  jade: '#2AA56F',
  mist: '#E9ECE9',
};

const NO_BLUE = [
  { color: COLORS.deepTeal, offset: 0 },
  { color: COLORS.turquoise, offset: 48 },
  { color: COLORS.jade, offset: 100 },
];
const BLUE_EDGES = [
  { color: COLORS.edgeBlue, offset: 0 },
  { color: COLORS.deepTeal, offset: 6 },
  { color: COLORS.turquoise, offset: 46 },
  { color: COLORS.jade, offset: 76 },
  { color: COLORS.deepTeal, offset: 94 },
  { color: COLORS.edgeBlue, offset: 100 },
];

function solidSvg(width, height, fill, radius = 0) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="${fill}"/></svg>`);
}

function gradientSvg(width, height, colors, radius = 0) {
  const stops = colors.map((entry, index) => {
    const color = typeof entry === 'string' ? entry : entry.color;
    const offset = typeof entry === 'string'
      ? Math.round(index * 100 / (colors.length - 1))
      : entry.offset;
    return `<stop offset="${offset}%" stop-color="${color}"/>`;
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs><rect width="${width}" height="${height}" rx="${radius}" fill="url(#g)"/></svg>`);
}

function arabesqueSvg(width, height, stroke, opacity, startY = 0, tile = 230) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <pattern id="arabesque" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse">
          <g transform="scale(${tile / 230})" fill="none" stroke="${stroke}" stroke-width="2.2" opacity="${opacity}" stroke-linejoin="round">
            <path d="M115 7 L137 65 L196 34 L165 93 L223 115 L165 137 L196 196 L137 165 L115 223 L93 165 L34 196 L65 137 L7 115 L65 93 L34 34 L93 65 Z"/>
            <path d="M115 43 L140 90 L187 115 L140 140 L115 187 L90 140 L43 115 L90 90 Z"/>
            <path d="M0 0 L65 65 M230 0 L165 65 M0 230 L65 165 M230 230 L165 165"/>
            <path d="M0 115 L43 115 M187 115 L230 115 M115 0 L115 43 M115 187 L115 230"/>
            <circle cx="115" cy="115" r="50"/>
            <rect x="80" y="80" width="70" height="70" transform="rotate(45 115 115)"/>
          </g>
        </pattern>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="white" stop-opacity="0"/>
          <stop offset="0.24" stop-color="white" stop-opacity="0.45"/>
          <stop offset="1" stop-color="white" stop-opacity="1"/>
        </linearGradient>
        <mask id="lower"><rect x="0" y="${startY}" width="${width}" height="${height - startY}" fill="url(#fade)"/></mask>
      </defs>
      <rect x="0" y="${startY}" width="${width}" height="${height - startY}" fill="url(#arabesque)" mask="url(#lower)"/>
    </svg>`);
}

function flowLinesSvg(width, height, color = '#FFFFFF', opacity = 0.12) {
  const paths = [];
  for (let i = 0; i < 34; i += 1) {
    const y = 790 - i * 15;
    const c1y = 420 - i * 7;
    const c2y = 950 - i * 20;
    const endY = 120 + i * 13;
    paths.push(`<path d="M-120 ${y} C430 ${c1y}, 970 ${c2y}, 2520 ${endY}"/>`);
  }
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <g fill="none" stroke="${color}" stroke-width="1.25" opacity="${opacity}">${paths.join('')}</g>
    </svg>`);
}

function readableICapsSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="2400" height="800">
      <g fill="#FFFFFF">
        <rect x="1555" y="108" width="48" height="30" rx="8"/>
        <rect x="1760" y="108" width="48" height="30" rx="8"/>
        <rect x="1555" y="661" width="48" height="30" rx="8"/>
        <rect x="1760" y="661" width="48" height="30" rx="8"/>
      </g>
    </svg>`);
}

async function readableIWordmarkMask() {
  return sharp(wordmarkMaskSource).composite([
    { input: readableICapsSvg(), left: 0, top: 0 },
  ]).png().toBuffer();
}

async function maskPaint(paint, mask, width, height, overlays = []) {
  return sharp(paint).composite([
    ...overlays.map((input) => ({ input, left: 0, top: 0 })),
    { input: mask, left: 0, top: 0, blend: 'dest-in' },
  ]).png().toBuffer();
}

async function patternedBackground(width, height, radius = 0, palette = NO_BLUE) {
  const base = gradientSvg(width, height, palette, radius);
  const lines = flowLinesSvg(width, height, COLORS.ivory, 0.022);
  const geometry = arabesqueSvg(width, height, COLORS.ivory, 0.105, 0, 82);
  const composed = await sharp(base).composite([
    { input: lines, left: 0, top: 0 },
    { input: geometry, left: 0, top: 0 },
  ]).png().toBuffer();
  if (!radius) return composed;
  return sharp(composed).composite([
    { input: solidSvg(width, height, '#FFFFFF', radius), left: 0, top: 0, blend: 'dest-in' },
  ]).png().toBuffer();
}

async function onBackground(mark, background, width = 2400, height = 800) {
  return sharp(background).composite([{ input: mark, left: 0, top: 0 }]).png().toBuffer();
}

async function save(name, image) {
  await sharp(image).png().toFile(path.join(out, `${name}.png`));
  await sharp(image).webp({ quality: 96, alphaQuality: 100 }).toFile(path.join(webpOut, `${name}.webp`));
}

async function saveIconSet(name, master) {
  for (const size of [16, 32, 48, 64, 180, 192, 256, 512, 1024]) {
    await sharp(master).resize(size, size).png().toFile(path.join(favOut, `${name}-${size}.png`));
  }
}

async function main() {
  await fs.promises.mkdir(favOut, { recursive: true });
  await fs.promises.mkdir(webpOut, { recursive: true });

  const wordmarkMask = await readableIWordmarkMask();
  const noBlueBackground = await patternedBackground(2400, 800, 0, NO_BLUE);
  const blueEdgeBackground = await patternedBackground(2400, 800, 0, BLUE_EDGES);
  const ivoryMark = await maskPaint(solidSvg(2400, 800, COLORS.ivory), wordmarkMask, 2400, 800);
  const noBlue = await onBackground(ivoryMark, noBlueBackground);
  const blueEdges = await onBackground(ivoryMark, blueEdgeBackground);

  const lowerArabesque = arabesqueSvg(2400, 800, COLORS.ivory, 0.38, 350, 210);
  const gradientOrnamentMark = await maskPaint(
    gradientSvg(2400, 800, NO_BLUE),
    wordmarkMask,
    2400,
    800,
    [lowerArabesque],
  );

  const mist = solidSvg(2400, 800, COLORS.ivory);
  const gradientOnMist = await onBackground(gradientOrnamentMark, mist);

  await save('allim-no-blue-turquoise-jade-patterned-background', noBlue);
  await save('allim-ten-percent-blue-edges-patterned-background', blueEdges);
  await save('allim-turquoise-jade-with-lower-mushaf-geometry-transparent', gradientOrnamentMark);
  await save('allim-turquoise-jade-with-lower-mushaf-geometry-on-ivory', gradientOnMist);

  const iconBackground = await patternedBackground(1024, 1024, 220, NO_BLUE);
  const blueEdgeIconBackground = await patternedBackground(1024, 1024, 220, BLUE_EDGES);
  const iconLetter = await maskPaint(solidSvg(1024, 1024, COLORS.ivory), iconMask, 1024, 1024);
  const icon = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([
    { input: iconBackground, left: 0, top: 0 },
    { input: iconLetter, left: 0, top: 0 },
  ]).png().toBuffer();
  const blueEdgeIcon = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([
    { input: blueEdgeIconBackground, left: 0, top: 0 },
    { input: iconLetter, left: 0, top: 0 },
  ]).png().toBuffer();
  await sharp(icon).png().toFile(path.join(out, 'allim-aq-turquoise-jade-app-icon.png'));
  await sharp(blueEdgeIcon).png().toFile(path.join(out, 'allim-aq-blue-edges-app-icon.png'));
  await saveIconSet('allim-aq-turquoise-jade', icon);

  const headerBackground = await patternedBackground(1200, 300, 68, NO_BLUE);
  const headerMark = await sharp(ivoryMark).resize({ width: 900 }).png().toBuffer();
  const headerLogo = await sharp({
    create: { width: 1200, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([
    { input: headerBackground, left: 0, top: 0 },
    { input: headerMark, left: 150, top: 0 },
  ]).png().toBuffer();
  await sharp(headerLogo).png().toFile(path.join(out, 'allim-header-logo-turquoise-jade-v11.png'));
  await sharp(headerLogo).png().toFile(path.join(root, '../homepage/allim-header-logo.png'));

  const board = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1900" height="1700">
      <defs>
        <linearGradient id="noBlue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${COLORS.deepTeal}"/><stop offset="48%" stop-color="${COLORS.turquoise}"/><stop offset="100%" stop-color="${COLORS.jade}"/></linearGradient>
        <linearGradient id="blueEdges" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${COLORS.edgeBlue}"/><stop offset="6%" stop-color="${COLORS.deepTeal}"/><stop offset="46%" stop-color="${COLORS.turquoise}"/><stop offset="76%" stop-color="${COLORS.jade}"/><stop offset="94%" stop-color="${COLORS.deepTeal}"/><stop offset="100%" stop-color="${COLORS.edgeBlue}"/></linearGradient>
      </defs>
      <rect width="1900" height="1700" fill="${COLORS.mist}"/>
      <rect x="40" y="40" width="1820" height="480" rx="34" fill="url(#noBlue)"/>
      <text x="92" y="105" fill="#D8E8E3" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">01 / TURQUOISE + JADE — READABLE I CAPS</text>
      <rect x="40" y="550" width="1820" height="480" rx="34" fill="url(#blueEdges)"/>
      <text x="92" y="615" fill="#D8E8E3" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">02 / BLUE ONLY ON THE OUTER 10%</text>
      <rect x="40" y="1060" width="1120" height="600" rx="34" fill="${COLORS.ivory}"/>
      <text x="92" y="1125" fill="#737D80" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">03 / LARGER MUSHAF-INSPIRED GEOMETRY IN LETTERS</text>
      <rect x="1190" y="1060" width="670" height="600" rx="34" fill="#D6DAD8"/>
      <text x="1242" y="1125" fill="#737D80" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">A + Q / NO-BLUE ICON</text>
      <rect x="1500" y="1305" width="92" height="92" rx="18" fill="${COLORS.deepTeal}"/>
      <rect x="1610" y="1305" width="92" height="92" rx="18" fill="${COLORS.turquoise}"/>
      <rect x="1720" y="1305" width="92" height="92" rx="18" fill="${COLORS.jade}"/>
      <g fill="#626D70" font-family="Helvetica Neue, Arial, sans-serif" font-size="12" font-weight="600">
        <text x="1500" y="1425">DEEP TEAL</text><text x="1610" y="1425">TURQUOISE</text><text x="1720" y="1425">JADE</text>
      </g>
      <text x="1242" y="1540" fill="#667174" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="600" letter-spacing="1.1">QURAN ALWAYS SHOWS THE BACKGROUND.</text>
    </svg>`);

  const wordmarkPreview = await sharp(ivoryMark).resize({ width: 1100 }).png().toBuffer();
  const flowPreview = await sharp(flowLinesSvg(1820, 480, COLORS.ivory, 0.045)).png().toBuffer();
  const geometryPreview = await sharp(arabesqueSvg(1820, 480, COLORS.ivory, 0.105, 0, 82)).png().toBuffer();
  const gradientPreview = await sharp(gradientOrnamentMark).resize({ width: 940 }).png().toBuffer();
  const iconPreview = await sharp(icon).resize(300, 300).png().toBuffer();

  await sharp(board).composite([
    { input: flowPreview, left: 40, top: 40 },
    { input: geometryPreview, left: 40, top: 40 },
    { input: flowPreview, left: 40, top: 550 },
    { input: geometryPreview, left: 40, top: 550 },
    { input: wordmarkPreview, left: 400, top: 120 },
    { input: wordmarkPreview, left: 400, top: 630 },
    { input: gradientPreview, left: 125, top: 1200 },
    { input: iconPreview, left: 1270, top: 1190 },
  ]).png().toFile(path.join(out, 'allim-mushaf-pattern-v11-board.png'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
