const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'approved-logo/noor-core-v6');
const favOut = path.join(out, 'favicons');
const webpOut = path.join(out, 'webp');
const wordmarkMask = path.join(root, 'approved-logo/allim-white-transparent.png');
const iconMask = path.join(root, 'approved-logo/favicons/allim-aq-black-transparent-1024.png');
const approvedSource = '/Users/rafael/Desktop/Изображение Codex 4 сент. 2026 г., 21_20_16.jpg';

// These are the exact crops used to build the approved wordmark and A+Q icon.
// Color is recovered from the original carved pixels, then resized and placed
// with the same geometry as the approved monochrome assets.
const LOGO_CROP = { left: 470, top: 675, width: 1444, height: 461 };
const A_CROP = { left: 491, top: 695, width: 315, height: 421 };
const LOGO_SLOTS = [
  { x: 144, y: 40, width: 76, height: 340 }, // Q
  { x: 442, y: 40, width: 61, height: 315 }, // U
  { x: 718, y: 40, width: 86, height: 321 }, // R
  { x: 1005, y: 40, width: 66, height: 325 }, // A
  { x: 1224, y: 40, width: 96, height: 325 }, // N
];
const A_Q_SLOT = [{ x: 119, y: 20, width: 82, height: 351 }];

const COLORS = {
  ink: '#0A171D',
  ivory: '#F5F2E9',
  turquoise: '#329B92',
  ocean: '#347E98',
  cobalt: '#5269A6',
  signature: '#357F92',
};

const SIGNATURE = [COLORS.turquoise, COLORS.ocean, COLORS.cobalt];

function rgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function sourceLetterAlpha(value) {
  const low = 58;
  const high = 205;
  const linear = Math.max(0, Math.min(1, (value - low) / (high - low)));
  const smooth = linear * linear * (3 - 2 * linear);
  return Math.round(255 * Math.pow(smooth, 0.88));
}

function gradientColor(position, colors) {
  const palette = colors.map(rgb);
  const scaled = Math.max(0, Math.min(1, position)) * (palette.length - 1);
  const index = Math.min(palette.length - 2, Math.floor(scaled));
  const amount = scaled - index;
  return palette[index].map((channel, channelIndex) =>
    Math.round(channel + (palette[index + 1][channelIndex] - channel) * amount));
}

async function exactCarvedLayer(crop, slots, resize, canvas, placement) {
  const { data, info } = await sharp(approvedSource)
    .extract(crop)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgba = Buffer.alloc(info.width * info.height * 4);
  const insideSlot = (x, y) => slots.some((slot) =>
    x >= slot.x && x < slot.x + slot.width && y >= slot.y && y < slot.y + slot.height);

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (!insideSlot(x, y)) continue;
      const pixel = y * info.width + x;
      const alpha = 255 - sourceLetterAlpha(data[pixel]);
      if (alpha < 8) continue;

      const [r, g, b] = gradientColor(x / Math.max(1, info.width - 1), SIGNATURE);
      rgba[pixel * 4] = r;
      rgba[pixel * 4 + 1] = g;
      rgba[pixel * 4 + 2] = b;
      rgba[pixel * 4 + 3] = alpha;
    }
  }

  const carved = await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).resize(resize).png().toBuffer();
  const carvedMeta = await sharp(carved).metadata();

  return sharp({
    create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{
    input: carved,
    left: placement.left ?? Math.round((canvas.width - carvedMeta.width) / 2),
    top: placement.top ?? Math.round((canvas.height - carvedMeta.height) / 2),
  }]).png().toBuffer();
}

function solidSvg(width, height, fill, radius = 0) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="${fill}"/></svg>`);
}

function gradientSvg(width, height, colors, radius = 0, vertical = false) {
  const stops = colors.map((color, index) => `<stop offset="${Math.round(index * 100 / (colors.length - 1))}%" stop-color="${color}"/>`).join('');
  const vector = vertical ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="0" x2="1" y2="0"';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" ${vector}>${stops}</linearGradient></defs><rect width="${width}" height="${height}" rx="${radius}" fill="url(#g)"/></svg>`);
}

async function paintMask(mask, width, height, fill) {
  const base = Array.isArray(fill) ? gradientSvg(width, height, fill) : solidSvg(width, height, fill);
  return sharp(base).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function wordmarkWithColorCore(letterColor, backgroundColor) {
  const letters = await paintMask(wordmarkMask, 2400, 800, letterColor);
  const slots = await exactCarvedLayer(
    LOGO_CROP,
    LOGO_SLOTS,
    { width: 2220 },
    { width: 2400, height: 800 },
    {},
  );
  const background = solidSvg(2400, 800, backgroundColor);
  return sharp(background).composite([
    { input: slots, left: 0, top: 0 },
    { input: letters, left: 0, top: 0 },
  ]).png().toBuffer();
}

async function wordmarkTransparent(fill) {
  return paintMask(wordmarkMask, 2400, 800, fill);
}

async function appIcon(backgroundFill, letterColor) {
  const bg = Array.isArray(backgroundFill)
    ? gradientSvg(1024, 1024, backgroundFill, 220)
    : solidSvg(1024, 1024, backgroundFill, 220);
  const letter = await paintMask(iconMask, 1024, 1024, letterColor);
  return sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: bg, left: 0, top: 0 }, { input: letter, left: 0, top: 0 }])
    .png().toBuffer();
}

async function appIconWithColorQ() {
  const bg = solidSvg(1024, 1024, COLORS.ink, 220);
  const letter = await paintMask(iconMask, 1024, 1024, COLORS.ivory);
  const qLight = await exactCarvedLayer(
    A_CROP,
    A_Q_SLOT,
    { height: 830 },
    { width: 1024, height: 1024 },
    {},
  );
  return sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: bg, left: 0, top: 0 },
      { input: qLight, left: 0, top: 0 },
      { input: letter, left: 0, top: 0 },
    ]).png().toBuffer();
}

async function saveIconSet(name, master) {
  const ico = [];
  for (const size of [16, 32, 48, 64, 180, 192, 256, 512, 1024]) {
    const png = await sharp(master).resize(size, size).png().toBuffer();
    await fs.promises.writeFile(path.join(favOut, `${name}-${size}.png`), png);
    if ([16, 32, 48, 256].includes(size)) ico.push({ size, png });
  }
  const header = Buffer.alloc(6 + ico.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(ico.length, 4);
  let offset = header.length;
  ico.forEach(({ size, png }, index) => {
    const p = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, p);
    header.writeUInt8(size === 256 ? 0 : size, p + 1);
    header.writeUInt16LE(0, p + 2);
    header.writeUInt16LE(1, p + 4);
    header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(png.length, p + 8);
    header.writeUInt32LE(offset, p + 12);
    offset += png.length;
  });
  await fs.promises.writeFile(path.join(favOut, `${name}.ico`), Buffer.concat([header, ...ico.map(({ png }) => png)]));
}

async function save(name, image) {
  await sharp(image).png().toFile(path.join(out, `${name}.png`));
  await sharp(image).webp({ quality: 96, alphaQuality: 100 }).toFile(path.join(webpOut, `${name}.webp`));
}

async function main() {
  const lightCore = await wordmarkWithColorCore(COLORS.ink, COLORS.ivory);
  const darkCore = await wordmarkWithColorCore(COLORS.ivory, COLORS.ink);
  const gradientTransparent = await wordmarkTransparent(SIGNATURE);
  const inkTransparent = await wordmarkTransparent(COLORS.ink);
  const ivoryTransparent = await wordmarkTransparent(COLORS.ivory);

  await save('allim-ink-with-turquoise-blue-quran-on-ivory', lightCore);
  await save('allim-ivory-with-turquoise-blue-quran-on-ink', darkCore);
  await save('allim-turquoise-blue-gradient-transparent', gradientTransparent);
  await save('allim-ink-transparent', inkTransparent);
  await save('allim-ivory-transparent', ivoryTransparent);

  const primaryIcon = await appIcon(SIGNATURE, COLORS.ivory);
  const darkIcon = await appIconWithColorQ();
  const solidIcon = await appIcon(COLORS.signature, COLORS.ivory);
  await sharp(primaryIcon).png().toFile(path.join(out, 'allim-aq-signature-gradient-app-icon.png'));
  await sharp(darkIcon).png().toFile(path.join(out, 'allim-aq-color-core-app-icon.png'));
  await sharp(solidIcon).png().toFile(path.join(out, 'allim-aq-signature-solid-app-icon.png'));
  await saveIconSet('allim-aq-signature-gradient', primaryIcon);
  await saveIconSet('allim-aq-color-core', darkIcon);

  const board = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1440">
      <defs><linearGradient id="sig" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${COLORS.turquoise}"/><stop offset="52%" stop-color="${COLORS.ocean}"/><stop offset="100%" stop-color="${COLORS.cobalt}"/></linearGradient></defs>
      <rect width="1800" height="1440" fill="#E9EAE6"/>
      <rect x="40" y="40" width="1720" height="450" rx="32" fill="${COLORS.ivory}"/>
      <text x="92" y="100" fill="#7D8585" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">LIGHT / COLOR LIVES INSIDE QURAN</text>
      <rect x="40" y="520" width="1720" height="450" rx="32" fill="${COLORS.ink}"/>
      <text x="92" y="580" fill="#75878E" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">DARK / COLOR LIVES INSIDE QURAN</text>
      <rect x="40" y="1000" width="1060" height="400" rx="30" fill="#F7F5EF"/>
      <text x="92" y="1060" fill="#7D8585" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">ALLIM TURQUOISE–BLUE</text>
      <rect x="92" y="1110" width="210" height="190" rx="22" fill="${COLORS.ink}"/>
      <rect x="326" y="1110" width="210" height="190" rx="22" fill="${COLORS.turquoise}"/>
      <rect x="560" y="1110" width="210" height="190" rx="22" fill="${COLORS.ocean}"/>
      <rect x="794" y="1110" width="210" height="190" rx="22" fill="${COLORS.cobalt}"/>
      <g fill="#626A6A" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="600"><text x="92" y="1340">INK  #0A171D</text><text x="326" y="1340">TURQUOISE  #329B92</text><text x="560" y="1340">OCEAN  #347E98</text><text x="794" y="1340">COBALT  #5269A6</text></g>
      <rect x="1130" y="1000" width="630" height="400" rx="30" fill="#D5D8D5"/>
      <text x="1182" y="1060" fill="#737C7C" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">A + Q / APP ICON</text>
      <text x="1300" y="1350" fill="#596262" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="700" text-anchor="middle">SIGNATURE</text>
      <text x="1540" y="1350" fill="#737C7C" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="600" text-anchor="middle">COLOR CORE</text>
    </svg>`);

  const l = await sharp(lightCore).resize({ width: 1050 }).png().toBuffer();
  const d = await sharp(darkCore).resize({ width: 1050 }).png().toBuffer();
  const i1 = await sharp(primaryIcon).resize(250, 250).png().toBuffer();
  const i2 = await sharp(darkIcon).resize(190, 190).png().toBuffer();
  await sharp(board).composite([
    { input: l, left: 180, top: 110 },
    { input: d, left: 180, top: 590 },
    { input: i1, left: 1175, top: 1090 },
    { input: i2, left: 1445, top: 1120 },
  ]).png().toFile(path.join(out, 'allim-noor-core-v6-board.png'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
