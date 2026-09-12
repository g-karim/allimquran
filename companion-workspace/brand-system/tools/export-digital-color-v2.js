const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const source = '/Users/rafael/Desktop/Изображение Codex 4 сент. 2026 г., 21_20_16.jpg';
const out = path.resolve(__dirname, '../approved-logo/digital-v2');
const favOut = path.join(out, 'favicons');
const webpOut = path.join(out, 'webp');

const logoCrop = { left: 470, top: 675, width: 1444, height: 461 };
const aCrop = { left: 491, top: 695, width: 315, height: 421 };

const COLORS = {
  deep: '#030B0D',
  white: '#FAFAF7',
  mint: '#00F5A0',
  teal: '#00E0C6',
  cyan: '#00B8FF',
  darkTeal: '#008E7B',
};

const AI_GRADIENT = [COLORS.mint, COLORS.teal, COLORS.cyan];
const LIGHT_GRADIENT = ['#00A875', '#00AFA6', '#0089D8'];

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function colorAt(stops, amount) {
  if (typeof stops === 'string') return hexToRgb(stops);
  const segmentCount = stops.length - 1;
  const scaled = Math.max(0, Math.min(0.999999, amount)) * segmentCount;
  const index = Math.floor(scaled);
  const local = scaled - index;
  const from = hexToRgb(stops[index]);
  const to = hexToRgb(stops[index + 1]);
  return from.map((channel, i) => Math.round(channel + (to[i] - channel) * local));
}

function smoothAlpha(value) {
  const low = 58;
  const high = 205;
  const linear = Math.max(0, Math.min(1, (value - low) / (high - low)));
  const smooth = linear * linear * (3 - 2 * linear);
  return Math.round(255 * Math.pow(smooth, 0.88));
}

async function paintedCrop(crop, paint, resize) {
  const { data, info } = await sharp(source)
    .extract(crop)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const pixel = y * info.width + x;
      const [r, g, b] = colorAt(paint, x / Math.max(1, info.width - 1));
      rgba[pixel * 4] = r;
      rgba[pixel * 4 + 1] = g;
      rgba[pixel * 4 + 2] = b;
      rgba[pixel * 4 + 3] = smoothAlpha(data[pixel]);
    }
  }
  let image = sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } });
  if (resize) image = image.resize(resize);
  return image.png().toBuffer();
}

async function logoCanvas(paint) {
  const mark = await paintedCrop(logoCrop, paint, { width: 2220 });
  const meta = await sharp(mark).metadata();
  return sharp({
    create: { width: 2400, height: 800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: mark, left: Math.round((2400 - meta.width) / 2), top: Math.round((800 - meta.height) / 2) }]).png().toBuffer();
}

function gradientField(width, height, stops, radius = 0) {
  const stopTags = stops.map((color, index) => `<stop offset="${(index / (stops.length - 1)) * 100}%" stop-color="${color}"/>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${stopTags}</linearGradient></defs><rect width="${width}" height="${height}" rx="${radius}" fill="url(#g)"/></svg>`);
}

async function saveLogo(name, logo, background = null) {
  let png;
  if (Array.isArray(background)) {
    const field = gradientField(2400, 800, background);
    png = await sharp(field).composite([{ input: logo, left: 0, top: 0 }]).png().toBuffer();
  } else if (background) {
    png = await sharp(logo).flatten({ background }).png().toBuffer();
  } else {
    png = logo;
  }
  await sharp(png).png().toFile(path.join(out, `${name}.png`));
  await sharp(png).webp({ quality: 96, alphaQuality: 100 }).toFile(path.join(webpOut, `${name}.webp`));
}

async function iconMaster(letterPaint, background = null) {
  const letter = await paintedCrop(aCrop, letterPaint, { height: 830 });
  const meta = await sharp(letter).metadata();
  const layers = [];
  if (Array.isArray(background)) layers.push({ input: gradientField(1024, 1024, background, 220), left: 0, top: 0 });
  else if (background) layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" rx="220" fill="${background}"/></svg>`), left: 0, top: 0 });
  layers.push({ input: letter, left: Math.round((1024 - meta.width) / 2), top: Math.round((1024 - meta.height) / 2) });
  return sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toBuffer();
}

async function saveIconSet(name, master) {
  const buffers = [];
  for (const size of [16, 32, 48, 64, 180, 192, 256, 512, 1024]) {
    const image = await sharp(master).resize(size, size, { fit: 'fill' }).png().toBuffer();
    await fs.promises.writeFile(path.join(favOut, `${name}-${size}.png`), image);
    if ([16, 32, 48, 256].includes(size)) buffers.push({ size, image });
  }
  const header = Buffer.alloc(6 + buffers.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(buffers.length, 4);
  let offset = header.length;
  buffers.forEach(({ size, image }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(0, entry + 2);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });
  await fs.promises.writeFile(path.join(favOut, `${name}.ico`), Buffer.concat([header, ...buffers.map(({ image }) => image)]));
}

async function board(logos, icons) {
  const base = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1440">
      <defs><linearGradient id="field" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${COLORS.mint}"/><stop offset="50%" stop-color="${COLORS.teal}"/><stop offset="100%" stop-color="${COLORS.cyan}"/></linearGradient></defs>
      <rect width="1800" height="1440" fill="#EDEDEA"/>
      <rect x="40" y="40" width="1720" height="490" rx="32" fill="${COLORS.deep}"/>
      <rect x="40" y="560" width="840" height="370" rx="28" fill="${COLORS.deep}"/>
      <rect x="920" y="560" width="840" height="370" rx="28" fill="#FFFFFF"/>
      <rect x="40" y="960" width="1120" height="440" rx="30" fill="url(#field)"/>
      <rect x="1200" y="960" width="560" height="440" rx="30" fill="#D9DBD7"/>
      <g font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">
        <text x="92" y="100" fill="#81908E">AI GRADIENT / PRIMARY</text>
        <text x="92" y="620" fill="#81908E">ELECTRIC MINT / DARK</text>
        <text x="972" y="620" fill="#7E8582">DIGITAL TEAL / LIGHT</text>
        <text x="92" y="1020" fill="#075B55">DARK / AI GRADIENT FIELD</text>
        <text x="1252" y="1020" fill="#737B78">A + Q / APP ICON</text>
      </g>
    </svg>`);
  const primary = await sharp(logos.primary).resize({ width: 1280 }).png().toBuffer();
  const mint = await sharp(logos.mint).resize({ width: 760 }).png().toBuffer();
  const light = await sharp(logos.light).resize({ width: 760 }).png().toBuffer();
  const dark = await sharp(logos.dark).resize({ width: 1000 }).png().toBuffer();
  const iconPrimary = await sharp(icons.primary).resize(292, 292).png().toBuffer();
  const iconInverse = await sharp(icons.inverse).resize(122, 122).png().toBuffer();
  await sharp(base).composite([
    { input: primary, left: 260, top: 92 },
    { input: mint, left: 80, top: 638 },
    { input: light, left: 960, top: 638 },
    { input: dark, left: 100, top: 1045 },
    { input: iconPrimary, left: 1270, top: 1050 },
    { input: iconInverse, left: 1585, top: 1135 },
  ]).png().toFile(path.join(out, 'allim-digital-color-v2-board.png'));
}

async function main() {
  const logos = {
    primary: await logoCanvas(AI_GRADIENT),
    mint: await logoCanvas(COLORS.mint),
    light: await logoCanvas(LIGHT_GRADIENT),
    dark: await logoCanvas(COLORS.deep),
    white: await logoCanvas(COLORS.white),
  };
  await saveLogo('allim-ai-gradient-transparent', logos.primary);
  await saveLogo('allim-ai-gradient-on-deep', logos.primary, COLORS.deep);
  await saveLogo('allim-electric-mint-transparent', logos.mint);
  await saveLogo('allim-electric-mint-on-deep', logos.mint, COLORS.deep);
  await saveLogo('allim-digital-teal-gradient-on-white', logos.light, '#FFFFFF');
  await saveLogo('allim-dark-on-ai-gradient', logos.dark, AI_GRADIENT);
  await saveLogo('allim-white-on-ai-gradient', logos.white, AI_GRADIENT);

  const icons = {
    primary: await iconMaster(AI_GRADIENT, COLORS.deep),
    inverse: await iconMaster(COLORS.deep, AI_GRADIENT),
    transparent: await iconMaster(AI_GRADIENT),
  };
  await saveIconSet('allim-aq-ai-gradient-on-deep', icons.primary);
  await saveIconSet('allim-aq-dark-on-ai-gradient', icons.inverse);
  await saveIconSet('allim-aq-ai-gradient-transparent', icons.transparent);
  await board(logos, icons);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
