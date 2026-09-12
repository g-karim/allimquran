const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'approved-logo/mineral-v3');
const favOut = path.join(out, 'favicons');
const webpOut = path.join(out, 'webp');
const wordmarkMask = path.join(root, 'approved-logo/allim-white-transparent.png');
const iconMask = path.join(root, 'approved-logo/favicons/allim-aq-black-transparent-1024.png');

const PALETTE = {
  night: '#071216',
  ivory: '#F6F3EA',
  mineral: '#2C7F8C',
  jade: '#2B927D',
  blueTeal: '#2E7F98',
  cobalt: '#5269A8',
  copper: '#C79A68',
};

const PRIMARY_GRADIENT = [PALETTE.jade, PALETTE.blueTeal, PALETTE.cobalt];
const LIGHT_GRADIENT = ['#247764', '#276B82', '#43578D'];

function gradientSvg(width, height, colors, radius = 0, direction = 'horizontal') {
  const stops = colors.map((color, index) => `<stop offset="${Math.round(index * 100 / (colors.length - 1))}%" stop-color="${color}"/>`).join('');
  const vector = direction === 'diagonal' ? 'x1="0" y1="0" x2="1" y2="1"' : 'x1="0" y1="0" x2="1" y2="0"';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" ${vector}>${stops}</linearGradient></defs><rect width="${width}" height="${height}" rx="${radius}" fill="url(#g)"/></svg>`);
}

function solidSvg(width, height, color, radius = 0) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="${color}"/></svg>`);
}

async function paintMask(mask, width, height, paint) {
  const fill = Array.isArray(paint)
    ? gradientSvg(width, height, paint)
    : solidSvg(width, height, paint);
  return sharp(fill).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function placeOnBackground(foreground, width, height, background, radius = 0) {
  const field = Array.isArray(background)
    ? gradientSvg(width, height, background, radius, 'diagonal')
    : solidSvg(width, height, background, radius);
  return sharp(field).composite([{ input: foreground, left: 0, top: 0 }]).png().toBuffer();
}

async function saveAsset(name, png) {
  await sharp(png).png().toFile(path.join(out, `${name}.png`));
  await sharp(png).webp({ quality: 96, alphaQuality: 100 }).toFile(path.join(webpOut, `${name}.webp`));
}

async function makeIcon(letterPaint, background) {
  const letter = await paintMask(iconMask, 1024, 1024, letterPaint);
  return placeOnBackground(letter, 1024, 1024, background, 220);
}

async function saveIconSet(name, master) {
  const icoParts = [];
  for (const size of [16, 32, 48, 64, 180, 192, 256, 512, 1024]) {
    const png = await sharp(master).resize(size, size, { fit: 'fill' }).png().toBuffer();
    await fs.promises.writeFile(path.join(favOut, `${name}-${size}.png`), png);
    if ([16, 32, 48, 256].includes(size)) icoParts.push({ size, png });
  }
  const header = Buffer.alloc(6 + icoParts.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(icoParts.length, 4);
  let offset = header.length;
  icoParts.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(0, entry + 2);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  await fs.promises.writeFile(path.join(favOut, `${name}.ico`), Buffer.concat([header, ...icoParts.map(({ png }) => png)]));
}

async function makeBoard(assets) {
  const boardBase = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1440">
      <defs>
        <linearGradient id="primary" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="${PALETTE.jade}"/><stop offset="52%" stop-color="${PALETTE.blueTeal}"/><stop offset="100%" stop-color="${PALETTE.cobalt}"/>
        </linearGradient>
      </defs>
      <rect width="1800" height="1440" fill="#EDEDE9"/>
      <rect x="40" y="40" width="1720" height="490" rx="32" fill="${PALETTE.night}"/>
      <rect x="40" y="560" width="840" height="370" rx="28" fill="#FFFFFF"/>
      <rect x="920" y="560" width="840" height="370" rx="28" fill="${PALETTE.mineral}"/>
      <rect x="40" y="960" width="1120" height="440" rx="30" fill="#F7F4EC"/>
      <rect x="1200" y="960" width="560" height="440" rx="30" fill="#DADDD9"/>
      <g font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">
        <text x="92" y="100" fill="#7E8D91">ALLIM MINERAL / PRIMARY</text>
        <text x="92" y="620" fill="#838A89">MINERAL GRADIENT / LIGHT</text>
        <text x="972" y="620" fill="#BBD4D2">IVORY / SIGNATURE COLOR</text>
        <text x="92" y="1020" fill="#818887">OWNABLE PALETTE</text>
        <text x="1252" y="1020" fill="#747C7A">A + Q / APP ICON</text>
      </g>
      <g font-family="Helvetica Neue, Arial, sans-serif" font-size="14" font-weight="600">
        <rect x="96" y="1090" width="210" height="180" rx="20" fill="${PALETTE.mineral}"/><text x="96" y="1310" fill="#555D5B">MINERAL  #2C7F8C</text>
        <rect x="330" y="1090" width="210" height="180" rx="20" fill="${PALETTE.night}"/><text x="330" y="1310" fill="#555D5B">NIGHT  #071216</text>
        <rect x="564" y="1090" width="210" height="180" rx="20" fill="${PALETTE.ivory}" stroke="#DAD7CF"/><text x="564" y="1310" fill="#555D5B">IVORY  #F6F3EA</text>
        <rect x="798" y="1090" width="210" height="180" rx="20" fill="${PALETTE.copper}"/><text x="798" y="1310" fill="#555D5B">COPPER  #C79A68</text>
      </g>
    </svg>`);
  const primary = await sharp(assets.primary).resize({ width: 1280 }).png().toBuffer();
  const light = await sharp(assets.light).resize({ width: 760 }).png().toBuffer();
  const ivory = await sharp(assets.ivory).resize({ width: 760 }).png().toBuffer();
  const iconPrimary = await sharp(assets.iconPrimary).resize(292, 292).png().toBuffer();
  const iconDark = await sharp(assets.iconDark).resize(122, 122).png().toBuffer();
  await sharp(boardBase).composite([
    { input: primary, left: 260, top: 92 },
    { input: light, left: 80, top: 638 },
    { input: ivory, left: 960, top: 638 },
    { input: iconPrimary, left: 1270, top: 1050 },
    { input: iconDark, left: 1585, top: 1135 },
  ]).png().toFile(path.join(out, 'allim-mineral-color-v3-board.png'));
}

async function main() {
  const primary = await paintMask(wordmarkMask, 2400, 800, PRIMARY_GRADIENT);
  const light = await paintMask(wordmarkMask, 2400, 800, LIGHT_GRADIENT);
  const solid = await paintMask(wordmarkMask, 2400, 800, PALETTE.mineral);
  const ivory = await paintMask(wordmarkMask, 2400, 800, PALETTE.ivory);
  const night = await paintMask(wordmarkMask, 2400, 800, PALETTE.night);

  await saveAsset('allim-mineral-gradient-transparent', primary);
  await saveAsset('allim-mineral-gradient-on-night', await placeOnBackground(primary, 2400, 800, PALETTE.night));
  await saveAsset('allim-mineral-solid-transparent', solid);
  await saveAsset('allim-mineral-gradient-on-white', await placeOnBackground(light, 2400, 800, '#FFFFFF'));
  await saveAsset('allim-ivory-on-mineral', await placeOnBackground(ivory, 2400, 800, PALETTE.mineral));
  await saveAsset('allim-night-on-mineral-gradient', await placeOnBackground(night, 2400, 800, PRIMARY_GRADIENT));

  const iconPrimary = await makeIcon(PALETTE.ivory, PRIMARY_GRADIENT);
  const iconDark = await makeIcon(PRIMARY_GRADIENT, PALETTE.night);
  const iconSolid = await makeIcon(PALETTE.ivory, PALETTE.mineral);
  await saveIconSet('allim-aq-ivory-on-mineral-gradient', iconPrimary);
  await saveIconSet('allim-aq-mineral-gradient-on-night', iconDark);
  await saveIconSet('allim-aq-ivory-on-mineral-solid', iconSolid);

  await makeBoard({ primary, light, ivory, iconPrimary, iconDark });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
