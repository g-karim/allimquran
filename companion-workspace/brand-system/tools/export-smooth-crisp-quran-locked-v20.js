// Export smooth, crisp ALLIM edges while keeping QURAN geometry immutable.
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'approved-logo/mushaf-pattern-v20-smooth-crisp-quran-locked');
const wordmarkMaskSource = path.join(root, 'approved-logo/allim-white-transparent.png');

const COLORS = {
  ivory: '#FFFFFF',
  deepTeal: '#176F7B',
  turquoise: '#249B95',
  jade: '#2AA56F',
};

const NO_BLUE = [
  { color: COLORS.deepTeal, offset: 0 },
  { color: COLORS.turquoise, offset: 48 },
  { color: COLORS.jade, offset: 100 },
];

function solidSvg(width, height, fill, radius = 0) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="${fill}"/></svg>`);
}

function gradientSvg(width, height, colors, radius = 0) {
  const stops = colors.map(({ color, offset }) =>
    `<stop offset="${offset}%" stop-color="${color}"/>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs><rect width="${width}" height="${height}" rx="${radius}" fill="url(#g)"/></svg>`);
}

function arabesqueSvg(width, height, stroke, opacity, tile = 82) {
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
      </defs>
      <rect width="${width}" height="${height}" fill="url(#arabesque)"/>
    </svg>`);
}

function flowLinesSvg(width, height, color = '#FFFFFF', opacity = 0.022) {
  const paths = [];
  for (let i = 0; i < 34; i += 1) {
    const y = 790 - i * 15;
    const c1y = 420 - i * 7;
    const c2y = 950 - i * 20;
    const endY = 120 + i * 13;
    paths.push(`<path d="M-120 ${y} C430 ${c1y}, 970 ${c2y}, 2520 ${endY}"/>`);
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g fill="none" stroke="${color}" stroke-width="1.25" opacity="${opacity}">${paths.join('')}</g></svg>`);
}

function outerSilhouetteCutsSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="2400" height="800">
      <!-- L stems are narrowed symmetrically around the locked U and R cuts. -->
      <rect x="675" y="72" width="25" height="480" fill="#fff"/>
      <rect x="897" y="72" width="25" height="480" fill="#fff"/>
      <rect x="1118" y="72" width="29" height="480" fill="#fff"/>
      <rect x="1344" y="72" width="29" height="480" fill="#fff"/>
      <!-- Remove the rear L heels without moving the locked cutouts. -->
      <path d="M675 552H700V681Q700 691 710 691H675Z" fill="#fff"/>
      <path d="M1118 552H1147V681Q1147 691 1157 691H1118Z" fill="#fff"/>
      <!-- I detail may touch only the outside edges, never the protected A cut. -->
      <rect x="1582" y="151" width="38" height="11" rx="3" fill="#fff"/>
      <rect x="1742" y="151" width="38" height="11" rx="3" fill="#fff"/>
    </svg>`);
}

async function assertQuranCutoutsLocked(originalMask, revisedMask) {
  const boxes = [
    { name: 'Q', left: 300, top: 86, width: 120, height: 490 },
    { name: 'U', left: 742, top: 86, width: 96, height: 490 },
    { name: 'R', left: 1188, top: 86, width: 124, height: 490 },
    { name: 'A', left: 1628, top: 86, width: 106, height: 490 },
    { name: 'N', left: 2020, top: 86, width: 126, height: 490 },
  ];

  for (const box of boxes) {
    const original = await sharp(originalMask).extract(box).extractChannel(3).raw().toBuffer();
    const revised = await sharp(revisedMask).extract(box).extractChannel(3).raw().toBuffer();
    if (!original.equals(revised)) {
      throw new Error(`Locked QURAN cutout changed: ${box.name}`);
    }
  }
}

async function crispAlphaMask(sourceMask) {
  // Median removes the noisy raster fringe before thresholding. The binary
  // result is then downsampled once during layout, producing a single clean
  // antialiasing row instead of a wide translucent halo.
  const smoothedAlpha = await sharp(sourceMask)
    .extractChannel(3)
    .median(7)
    .blur(1.2)
    .png().toBuffer();
  const alpha = await sharp(smoothedAlpha).threshold(128).png().toBuffer();
  const mask = await sharp({
    create: { width: 2400, height: 800, channels: 3, background: '#FFFFFF' },
  }).joinChannel(alpha).png().toBuffer();
  const rawAlpha = await sharp(mask).extractChannel(3).raw().toBuffer();
  if (rawAlpha.some((value) => value !== 0 && value !== 255)) {
    throw new Error('Crisp wordmark mask contains translucent edge pixels');
  }
  return mask;
}

async function quranLockedWordmarkMask() {
  const sourceMask = await sharp(wordmarkMaskSource).png().toBuffer();
  const originalMask = await crispAlphaMask(sourceMask);
  await sharp(originalMask).png().toFile(path.join(out, 'allim-quran-protected-smooth-master-v1.png'));
  const revisedMask = await sharp(originalMask).composite([
    { input: outerSilhouetteCutsSvg(), left: 0, top: 0, blend: 'dest-out' },
  ]).png().toBuffer();
  await assertQuranCutoutsLocked(originalMask, revisedMask);
  return revisedMask;
}

async function patternedBackground(width, height, radius = 0, tile = 82) {
  const base = gradientSvg(width, height, NO_BLUE, radius);
  const composed = await sharp(base).composite([
    { input: flowLinesSvg(width, height, COLORS.ivory), left: 0, top: 0 },
    { input: arabesqueSvg(width, height, COLORS.ivory, 0.105, tile), left: 0, top: 0 },
  ]).png().toBuffer();
  if (!radius) return composed;
  return sharp(composed).composite([
    { input: solidSvg(width, height, '#FFFFFF', radius), left: 0, top: 0, blend: 'dest-in' },
  ]).png().toBuffer();
}

async function main() {
  await fs.promises.mkdir(out, { recursive: true });

  const wordmarkMask = await quranLockedWordmarkMask();
  const ivoryMark = await sharp(solidSvg(2400, 800, COLORS.ivory)).composite([
    { input: wordmarkMask, left: 0, top: 0, blend: 'dest-in' },
  ]).png().toBuffer();

  const headerBackground = await patternedBackground(2400, 600, 136, 164);
  const headerMark = await sharp(ivoryMark).resize({ width: 1800, kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  const header = await sharp({
    create: { width: 2400, height: 600, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([
    { input: headerBackground, left: 0, top: 0 },
    { input: headerMark, left: 300, top: 0 },
  ]).png().toBuffer();

  const headerPreview = await sharp(header).resize({ width: 1200, height: 300, kernel: sharp.kernel.lanczos3 }).png().toBuffer();

  await sharp(header).png().toFile(path.join(out, 'allim-header-logo-smooth-crisp-v20.png'));
  await sharp(headerPreview).png().toFile(path.join(out, 'allim-header-logo-smooth-crisp-v20-1200.png'));
  await sharp(ivoryMark).png().toFile(path.join(out, 'allim-wordmark-smooth-crisp-white-v20.png'));

  const closeup = await sharp(headerPreview).extract({ left: 675, top: 15, width: 220, height: 270 }).resize({ width: 660 }).png().toBuffer();
  const board = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900">
      <rect width="1400" height="900" fill="#F5F2E9"/>
      <text x="80" y="72" fill="#176F7B" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">ALLIM / SMOOTH CRISP 20</text>
      <text x="80" y="112" fill="#5E6C70" font-family="Helvetica Neue, Arial, sans-serif" font-size="20">Noise-free contours, one clean antialiasing edge and immutable Q U R A N geometry.</text>
    </svg>`);
  await sharp(board).composite([
    { input: headerPreview, left: 100, top: 170 },
    { input: closeup, left: 370, top: 535 },
  ]).png().toFile(path.join(out, 'allim-smooth-crisp-v20-study.png'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
