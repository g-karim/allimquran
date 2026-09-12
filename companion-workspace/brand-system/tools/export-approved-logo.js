const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const source = '/Users/rafael/Desktop/Изображение Codex 4 сент. 2026 г., 21_20_16.jpg';
const out = path.resolve(__dirname, '../approved-logo');
const favOut = path.join(out, 'favicons');

const COLORS = {
  black: '#0A0D0B',
  white: '#F8F7F2',
  pureWhite: '#FFFFFF',
  emerald: '#087A59',
  board: '#EDEBE4',
};

const logoCrop = { left: 470, top: 675, width: 1444, height: 461 };
const aCrop = { left: 491, top: 695, width: 315, height: 421 };

function rgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function smoothAlpha(value) {
  const low = 58;
  const high = 205;
  const linear = Math.max(0, Math.min(1, (value - low) / (high - low)));
  const smooth = linear * linear * (3 - 2 * linear);
  return Math.round(255 * Math.pow(smooth, 0.88));
}

async function coloredCrop(crop, color, resize) {
  const { data, info } = await sharp(source)
    .extract(crop)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const fill = rgb(color);
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i += 1) {
    rgba[i * 4] = fill.r;
    rgba[i * 4 + 1] = fill.g;
    rgba[i * 4 + 2] = fill.b;
    rgba[i * 4 + 3] = smoothAlpha(data[i]);
  }

  let image = sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
  if (resize) image = image.resize(resize);
  return image.png().toBuffer();
}

async function logoCanvas(color) {
  const mark = await coloredCrop(logoCrop, color, { width: 2220 });
  const meta = await sharp(mark).metadata();
  return sharp({
    create: { width: 2400, height: 800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: mark, left: Math.round((2400 - meta.width) / 2), top: Math.round((800 - meta.height) / 2) }])
    .png()
    .toBuffer();
}

async function saveTransparentAndFlat(name, logoBuffer, background = null) {
  const image = background ? sharp(logoBuffer).flatten({ background }) : sharp(logoBuffer);
  await image.png().toFile(path.join(out, `${name}.png`));
  const webpSource = background ? sharp(logoBuffer).flatten({ background }) : sharp(logoBuffer);
  await webpSource.webp({ quality: 96, alphaQuality: 100 }).toFile(path.join(out, `${name}.webp`));
}

function roundedBackground(color) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" rx="220" fill="${color}"/></svg>`,
  );
}

async function faviconMaster(letterColor, background = null) {
  const letter = await coloredCrop(aCrop, letterColor, { height: 830 });
  const meta = await sharp(letter).metadata();
  const layers = [];
  if (background) layers.push({ input: roundedBackground(background), left: 0, top: 0 });
  layers.push({ input: letter, left: Math.round((1024 - meta.width) / 2), top: Math.round((1024 - meta.height) / 2) });
  return sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(layers).png().toBuffer();
}

async function saveFaviconSet(baseName, master) {
  await sharp(master).png().toFile(path.join(favOut, `${baseName}-1024.png`));
  for (const size of [16, 32, 48, 64, 180, 192, 512]) {
    await sharp(master).resize(size, size, { fit: 'fill' }).png().toFile(path.join(favOut, `${baseName}-${size}.png`));
  }
}

async function saveIco(baseName, master) {
  const sizes = [16, 32, 48, 256];
  const images = await Promise.all(
    sizes.map((size) => sharp(master).resize(size, size, { fit: 'fill' }).png().toBuffer()),
  );
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((image, index) => {
    const size = sizes[index];
    const entry = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });
  await fs.promises.writeFile(path.join(favOut, `${baseName}.ico`), Buffer.concat([header, ...images]));
}

async function makeBoard(logos, icons) {
  const base = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1440">
      <rect width="1800" height="1440" fill="${COLORS.board}"/>
      <rect x="40" y="40" width="1720" height="470" rx="32" fill="${COLORS.black}"/>
      <rect x="40" y="540" width="840" height="370" rx="28" fill="#FFFFFF"/>
      <rect x="920" y="540" width="840" height="370" rx="28" fill="#FFFFFF"/>
      <rect x="40" y="940" width="1120" height="450" rx="30" fill="${COLORS.emerald}"/>
      <rect x="1200" y="940" width="560" height="450" rx="30" fill="#DCDAD3"/>
      <g font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="3">
        <text x="92" y="98" fill="#858A86">WHITE / BLACK</text>
        <text x="92" y="598" fill="#888C88">BLACK / WHITE</text>
        <text x="972" y="598" fill="#888C88">EMERALD / WHITE</text>
        <text x="92" y="998" fill="#A4DDC9">WHITE / EMERALD</text>
        <text x="1252" y="998" fill="#777C78">A + Q / FAVICON</text>
      </g>
    </svg>
  `);

  const top = await sharp(logos.white).resize({ width: 1260 }).png().toBuffer();
  const black = await sharp(logos.black).resize({ width: 760 }).png().toBuffer();
  const green = await sharp(logos.green).resize({ width: 760 }).png().toBuffer();
  const greenBack = await sharp(logos.white).resize({ width: 1000 }).png().toBuffer();
  const iconGreen = await sharp(icons.green).resize(290, 290).png().toBuffer();
  const iconBlack = await sharp(icons.black).resize(120, 120).png().toBuffer();

  await sharp(base)
    .composite([
      { input: top, left: 270, top: 77 },
      { input: black, left: 80, top: 610 },
      { input: green, left: 960, top: 610 },
      { input: greenBack, left: 100, top: 1030 },
      { input: iconGreen, left: 1270, top: 1050 },
      { input: iconBlack, left: 1580, top: 1135 },
    ])
    .png()
    .toFile(path.join(out, 'allim-approved-variants-board.png'));
}

async function main() {
  const logos = {
    white: await logoCanvas(COLORS.white),
    black: await logoCanvas(COLORS.black),
    green: await logoCanvas(COLORS.emerald),
  };

  await saveTransparentAndFlat('allim-white-transparent', logos.white);
  await saveTransparentAndFlat('allim-black-transparent', logos.black);
  await saveTransparentAndFlat('allim-emerald-transparent', logos.green);
  await saveTransparentAndFlat('allim-black-on-white', logos.black, COLORS.pureWhite);
  await saveTransparentAndFlat('allim-emerald-on-white', logos.green, COLORS.pureWhite);
  await saveTransparentAndFlat('allim-white-on-black', logos.white, COLORS.black);
  await saveTransparentAndFlat('allim-white-on-emerald', logos.white, COLORS.emerald);

  const icons = {
    transparentBlack: await faviconMaster(COLORS.black),
    transparentGreen: await faviconMaster(COLORS.emerald),
    black: await faviconMaster(COLORS.white, COLORS.black),
    green: await faviconMaster(COLORS.white, COLORS.emerald),
  };

  await saveFaviconSet('allim-aq-black-transparent', icons.transparentBlack);
  await saveFaviconSet('allim-aq-emerald-transparent', icons.transparentGreen);
  await saveFaviconSet('allim-aq-white-on-black', icons.black);
  await saveFaviconSet('allim-aq-white-on-emerald', icons.green);
  await saveIco('allim-aq-white-on-emerald', icons.green);
  await saveIco('allim-aq-white-on-black', icons.black);
  await makeBoard(logos, icons);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
