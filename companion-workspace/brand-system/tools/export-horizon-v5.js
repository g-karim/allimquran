const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'approved-logo/horizon-v5');
const favOut = path.join(out, 'favicons');
const wordmarkMask = path.join(root, 'approved-logo/allim-white-transparent.png');
const iconMask = path.join(root, 'approved-logo/favicons/allim-aq-black-transparent-1024.png');

const COLOR = {
  ink: '#14242D',
  ivory: '#F5F1E7',
  sand: '#C79A5B',
  sea: '#39958F',
  blue: '#385E8E',
  sage: '#6E9568',
  slate: '#647985',
};

const ROUTES = {
  horizon: [COLOR.sand, COLOR.sea, COLOR.blue],
  oasis: [COLOR.sage, '#3B9294', '#416896'],
  seaGold: ['#338A99', '#4A6797', '#B58A5C'],
};

function solidSvg(width, height, fill, radius = 0) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="${fill}"/></svg>`);
}

function gradientSvg(width, height, colors, radius = 0) {
  const stops = colors.map((color, index) => `<stop offset="${Math.round(index * 100 / (colors.length - 1))}%" stop-color="${color}"/>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs><rect width="${width}" height="${height}" rx="${radius}" fill="url(#g)"/></svg>`);
}

async function paintMask(mask, width, height, fill) {
  const base = Array.isArray(fill) ? gradientSvg(width, height, fill) : solidSvg(width, height, fill);
  return sharp(base).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function onField(foreground, width, height, fill, radius = 0) {
  const base = Array.isArray(fill) ? gradientSvg(width, height, fill, radius) : solidSvg(width, height, fill, radius);
  return sharp(base).composite([{ input: foreground, left: 0, top: 0 }]).png().toBuffer();
}

async function appIcon(route) {
  const letter = await paintMask(iconMask, 1024, 1024, COLOR.ivory);
  return onField(letter, 1024, 1024, route, 220);
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
  const inkWordmark = await paintMask(wordmarkMask, 2400, 800, COLOR.ink);
  const ivoryWordmark = await paintMask(wordmarkMask, 2400, 800, COLOR.ivory);
  const horizonWordmark = await paintMask(wordmarkMask, 2400, 800, ROUTES.horizon);

  const inkOnIvory = await onField(inkWordmark, 2400, 800, COLOR.ivory);
  const ivoryOnInk = await onField(ivoryWordmark, 2400, 800, COLOR.ink);
  const horizonOnInk = await onField(horizonWordmark, 2400, 800, COLOR.ink);
  await sharp(inkWordmark).png().toFile(path.join(out, 'allim-ink-transparent.png'));
  await sharp(ivoryWordmark).png().toFile(path.join(out, 'allim-ivory-transparent.png'));
  await sharp(inkOnIvory).png().toFile(path.join(out, 'allim-ink-on-ivory.png'));
  await sharp(ivoryOnInk).png().toFile(path.join(out, 'allim-ivory-on-ink.png'));
  await sharp(horizonOnInk).png().toFile(path.join(out, 'allim-horizon-gradient-on-ink-experimental.png'));

  const horizonIcon = await appIcon(ROUTES.horizon);
  const oasisIcon = await appIcon(ROUTES.oasis);
  const seaGoldIcon = await appIcon(ROUTES.seaGold);
  await sharp(horizonIcon).png().toFile(path.join(out, 'allim-aq-horizon-app-icon.png'));
  await sharp(oasisIcon).png().toFile(path.join(out, 'allim-aq-oasis-app-icon.png'));
  await sharp(seaGoldIcon).png().toFile(path.join(out, 'allim-aq-sea-gold-app-icon.png'));
  await saveIconSet('allim-aq-horizon', horizonIcon);

  const base = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1420">
      <defs>
        <linearGradient id="horizon" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${COLOR.sand}"/><stop offset="50%" stop-color="${COLOR.sea}"/><stop offset="100%" stop-color="${COLOR.blue}"/></linearGradient>
      </defs>
      <rect width="1800" height="1420" fill="#E9E8E3"/>
      <rect x="40" y="40" width="1720" height="460" rx="32" fill="${COLOR.ivory}"/>
      <text x="92" y="100" fill="#7D8585" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">PRIMARY / NEUTRAL WORDMARK + SIGNATURE ICON</text>
      <rect x="40" y="530" width="1720" height="420" rx="32" fill="${COLOR.ink}"/>
      <text x="92" y="590" fill="#7C8B91" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">DARK MODE</text>
      <rect x="40" y="980" width="1080" height="400" rx="30" fill="#F7F4EC"/>
      <text x="92" y="1040" fill="#7D8585" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">ALLIM HORIZON PALETTE</text>
      <rect x="92" y="1095" width="180" height="180" rx="22" fill="${COLOR.ink}"/>
      <rect x="294" y="1095" width="180" height="180" rx="22" fill="${COLOR.ivory}" stroke="#DDD8CE"/>
      <rect x="496" y="1095" width="180" height="180" rx="22" fill="${COLOR.sand}"/>
      <rect x="698" y="1095" width="180" height="180" rx="22" fill="${COLOR.sea}"/>
      <rect x="900" y="1095" width="180" height="180" rx="22" fill="${COLOR.blue}"/>
      <g fill="#626A6A" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="600">
        <text x="92" y="1315">INK  #14242D</text><text x="294" y="1315">IVORY  #F5F1E7</text><text x="496" y="1315">SAND  #C79A5B</text><text x="698" y="1315">SEA  #39958F</text><text x="900" y="1315">BLUE  #385E8E</text>
      </g>
      <rect x="1150" y="980" width="610" height="400" rx="30" fill="#D5D8D5"/>
      <text x="1202" y="1040" fill="#737C7C" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">ICON COLOR ROUTES</text>
      <text x="1270" y="1332" fill="#596262" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="700" text-anchor="middle">HORIZON</text>
      <text x="1455" y="1332" fill="#7B8381" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="600" text-anchor="middle">OASIS</text>
      <text x="1640" y="1332" fill="#7B8381" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="600" text-anchor="middle">SEA GOLD</text>
    </svg>`);

  const topWord = await sharp(inkWordmark).resize({ width: 1050 }).png().toBuffer();
  const darkWord = await sharp(ivoryWordmark).resize({ width: 1050 }).png().toBuffer();
  const iconMain = await sharp(horizonIcon).resize(260, 260).png().toBuffer();
  const iconMainDark = await sharp(horizonIcon).resize(210, 210).png().toBuffer();
  const iconA = await sharp(horizonIcon).resize(150, 150).png().toBuffer();
  const iconB = await sharp(oasisIcon).resize(150, 150).png().toBuffer();
  const iconC = await sharp(seaGoldIcon).resize(150, 150).png().toBuffer();

  await sharp(base).composite([
    { input: topWord, left: 150, top: 110 },
    { input: iconMain, left: 1430, top: 140 },
    { input: darkWord, left: 150, top: 590 },
    { input: iconMainDark, left: 1450, top: 640 },
    { input: iconA, left: 1195, top: 1110 },
    { input: iconB, left: 1380, top: 1110 },
    { input: iconC, left: 1565, top: 1110 },
  ]).png().toFile(path.join(out, 'allim-horizon-v5-board.png'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
