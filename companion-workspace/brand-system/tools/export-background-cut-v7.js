const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'approved-logo/background-cut-v7');
const favOut = path.join(out, 'favicons');
const webpOut = path.join(out, 'webp');
const wordmarkMask = path.join(root, 'approved-logo/allim-white-transparent.png');
const iconMask = path.join(root, 'approved-logo/favicons/allim-aq-black-transparent-1024.png');

const COLORS = {
  ink: '#0A171D',
  ivory: '#F5F2E9',
  turquoise: '#329B92',
  ocean: '#347E98',
  cobalt: '#5269A6',
  board: '#E8EAE7',
};

const SIGNATURE = [COLORS.turquoise, COLORS.ocean, COLORS.cobalt];

function solidSvg(width, height, fill, radius = 0) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="${fill}"/></svg>`);
}

function gradientSvg(width, height, colors, radius = 0) {
  const stops = colors.map((color, index) =>
    `<stop offset="${Math.round(index * 100 / (colors.length - 1))}%" stop-color="${color}"/>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient></defs><rect width="${width}" height="${height}" rx="${radius}" fill="url(#g)"/></svg>`);
}

async function paintMask(mask, width, height, fill) {
  const paint = Array.isArray(fill)
    ? gradientSvg(width, height, fill)
    : solidSvg(width, height, fill);
  return sharp(paint).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function onBackground(mark, background) {
  const canvas = Array.isArray(background)
    ? gradientSvg(2400, 800, background)
    : solidSvg(2400, 800, background);
  return sharp(canvas).composite([{ input: mark, left: 0, top: 0 }]).png().toBuffer();
}

async function appIcon(background, letterColor) {
  const bg = Array.isArray(background)
    ? gradientSvg(1024, 1024, background, 220)
    : solidSvg(1024, 1024, background, 220);
  const letter = await paintMask(iconMask, 1024, 1024, letterColor);
  return sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([
    { input: bg, left: 0, top: 0 },
    { input: letter, left: 0, top: 0 },
  ]).png().toBuffer();
}

async function save(name, image) {
  await sharp(image).png().toFile(path.join(out, `${name}.png`));
  await sharp(image).webp({ quality: 96, alphaQuality: 100 }).toFile(path.join(webpOut, `${name}.webp`));
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

async function main() {
  await fs.promises.mkdir(favOut, { recursive: true });
  await fs.promises.mkdir(webpOut, { recursive: true });

  // The QURAN glyphs remain transparent in every mark below. On a background,
  // their visible color is therefore exactly the background color.
  const inkMark = await paintMask(wordmarkMask, 2400, 800, COLORS.ink);
  const ivoryMark = await paintMask(wordmarkMask, 2400, 800, COLORS.ivory);
  const signatureMark = await paintMask(wordmarkMask, 2400, 800, SIGNATURE);

  const light = await onBackground(inkMark, COLORS.ivory);
  const dark = await onBackground(ivoryMark, COLORS.ink);
  const signature = await onBackground(ivoryMark, SIGNATURE);

  await save('allim-ink-transparent-quran-cutout', inkMark);
  await save('allim-ivory-transparent-quran-cutout', ivoryMark);
  await save('allim-signature-gradient-transparent-quran-cutout', signatureMark);
  await save('allim-ink-on-ivory-quran-background', light);
  await save('allim-ivory-on-ink-quran-background', dark);
  await save('allim-ivory-on-signature-quran-background', signature);

  const signatureIcon = await appIcon(SIGNATURE, COLORS.ivory);
  const darkIcon = await appIcon(COLORS.ink, COLORS.ivory);
  const lightIcon = await appIcon(COLORS.ivory, COLORS.ink);
  await sharp(signatureIcon).png().toFile(path.join(out, 'allim-aq-signature-app-icon.png'));
  await sharp(darkIcon).png().toFile(path.join(out, 'allim-aq-dark-app-icon.png'));
  await sharp(lightIcon).png().toFile(path.join(out, 'allim-aq-light-app-icon.png'));
  await saveIconSet('allim-aq-signature', signatureIcon);
  await saveIconSet('allim-aq-dark', darkIcon);

  const board = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1500">
      <defs><linearGradient id="sig" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${COLORS.turquoise}"/><stop offset="52%" stop-color="${COLORS.ocean}"/><stop offset="100%" stop-color="${COLORS.cobalt}"/></linearGradient></defs>
      <rect width="1800" height="1500" fill="${COLORS.board}"/>
      <rect x="40" y="40" width="1720" height="390" rx="32" fill="${COLORS.ivory}"/>
      <text x="92" y="100" fill="#7D8585" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">LIGHT / QURAN IS THE BACKGROUND</text>
      <rect x="40" y="460" width="1720" height="390" rx="32" fill="${COLORS.ink}"/>
      <text x="92" y="520" fill="#75878E" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">DARK / QURAN IS THE BACKGROUND</text>
      <rect x="40" y="880" width="1100" height="570" rx="32" fill="url(#sig)"/>
      <text x="92" y="940" fill="#D5E3E5" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">SIGNATURE / QURAN IS THE BACKGROUND</text>
      <rect x="1170" y="880" width="590" height="570" rx="32" fill="#D5D8D5"/>
      <text x="1222" y="940" fill="#737C7C" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">A + Q / SAME CUTOUT RULE</text>
      <g fill="#697273" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="600">
        <text x="1222" y="1392">NO SEPARATE COLOR INSIDE Q</text>
        <text x="1222" y="1418">THE BACKGROUND SHOWS THROUGH</text>
      </g>
    </svg>`);

  const lightPreview = await sharp(inkMark).resize({ width: 960 }).png().toBuffer();
  const darkPreview = await sharp(ivoryMark).resize({ width: 960 }).png().toBuffer();
  const signaturePreview = await sharp(ivoryMark).resize({ width: 880 }).png().toBuffer();
  const signatureIconPreview = await sharp(signatureIcon).resize(290, 290).png().toBuffer();
  const darkIconPreview = await sharp(darkIcon).resize(150, 150).png().toBuffer();

  await sharp(board).composite([
    { input: lightPreview, left: 420, top: 100 },
    { input: darkPreview, left: 420, top: 520 },
    { input: signaturePreview, left: 150, top: 1030 },
    { input: signatureIconPreview, left: 1220, top: 1010 },
    { input: darkIconPreview, left: 1515, top: 1080 },
  ]).png().toFile(path.join(out, 'allim-background-cut-v7-board.png'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
