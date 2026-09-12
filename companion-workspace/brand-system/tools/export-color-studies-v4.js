const sharp = require('sharp');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'approved-logo/color-studies-v4');
const wordmarkMask = path.join(root, 'approved-logo/allim-white-transparent.png');
const iconMask = path.join(root, 'approved-logo/favicons/allim-aq-black-transparent-1024.png');

const NIGHT = '#071115';
const IVORY = '#F6F3EA';

const STUDIES = [
  {
    id: '01',
    slug: 'aurora-ink',
    name: 'AURORA INK',
    colors: ['#49B39F', '#4587B3', '#6D63AE'],
  },
  {
    id: '02',
    slug: 'ocean-cobalt',
    name: 'OCEAN COBALT',
    colors: ['#2E9C9A', '#3677AD', '#505FBA'],
  },
  {
    id: '03',
    slug: 'glacial-opal',
    name: 'GLACIAL OPAL',
    colors: ['#68B5AA', '#6397B8', '#7B7DB5'],
  },
  {
    id: '04',
    slug: 'petrol-iris',
    name: 'PETROL IRIS',
    colors: ['#287D77', '#35638D', '#67528C'],
  },
];

function gradientSvg(width, height, colors, radius = 0, diagonal = false) {
  const stops = colors.map((color, index) => `<stop offset="${Math.round(index * 100 / (colors.length - 1))}%" stop-color="${color}"/>`).join('');
  const vector = diagonal ? 'x1="0" y1="0" x2="1" y2="1"' : 'x1="0" y1="0" x2="1" y2="0"';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" ${vector}>${stops}</linearGradient></defs><rect width="${width}" height="${height}" rx="${radius}" fill="url(#g)"/></svg>`);
}

function solidSvg(width, height, color, radius = 0) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="${color}"/></svg>`);
}

async function paintMask(mask, width, height, paint) {
  const fill = Array.isArray(paint) ? gradientSvg(width, height, paint) : solidSvg(width, height, paint);
  return sharp(fill).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function field(foreground, width, height, background, radius = 0) {
  const base = Array.isArray(background)
    ? gradientSvg(width, height, background, radius, true)
    : solidSvg(width, height, background, radius);
  return sharp(base).composite([{ input: foreground, left: 0, top: 0 }]).png().toBuffer();
}

async function icon(colors) {
  const whiteA = await paintMask(iconMask, 1024, 1024, IVORY);
  return field(whiteA, 1024, 1024, colors, 220);
}

async function main() {
  const rendered = [];
  for (const study of STUDIES) {
    const logo = await paintMask(wordmarkMask, 2400, 800, study.colors);
    const onNight = await field(logo, 2400, 800, NIGHT);
    const onWhite = await field(logo, 2400, 800, '#FFFFFF');
    const appIcon = await icon(study.colors);
    await sharp(logo).png().toFile(path.join(out, `${study.id}-${study.slug}-transparent.png`));
    await sharp(onNight).png().toFile(path.join(out, `${study.id}-${study.slug}-on-night.png`));
    await sharp(onWhite).png().toFile(path.join(out, `${study.id}-${study.slug}-on-white.png`));
    await sharp(appIcon).png().toFile(path.join(out, `${study.id}-${study.slug}-app-icon.png`));
    rendered.push({ ...study, logo, appIcon });
  }

  const cards = [
    { x: 40, y: 110 }, { x: 920, y: 110 },
    { x: 40, y: 820 }, { x: 920, y: 820 },
  ];
  const cardMarkup = rendered.map((study, index) => {
    const { x, y } = cards[index];
    const [a, b, c] = study.colors;
    return `
      <rect x="${x}" y="${y}" width="840" height="660" rx="30" fill="#FFFFFF"/>
      <text x="${x + 48}" y="${y + 62}" fill="#172025" font-family="Helvetica Neue, Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="2">${study.id} / ${study.name}</text>
      <rect x="${x + 24}" y="${y + 92}" width="792" height="330" rx="24" fill="${NIGHT}"/>
      <text x="${x + 48}" y="${y + 468}" fill="#8A918F" font-family="Helvetica Neue, Arial, sans-serif" font-size="14" font-weight="600" letter-spacing="2">SAME COLOR / WHITE FIELD</text>
      <text x="${x + 648}" y="${y + 530}" fill="#A0A5A3" font-family="Helvetica Neue, Arial, sans-serif" font-size="12" font-weight="600" letter-spacing="1.5" text-anchor="middle">COLOR STOPS</text>
      <circle cx="${x + 610}" cy="${y + 575}" r="16" fill="${a}"/><circle cx="${x + 658}" cy="${y + 575}" r="16" fill="${b}"/><circle cx="${x + 706}" cy="${y + 575}" r="16" fill="${c}"/>`;
  }).join('');

  const base = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1530">
      <rect width="1800" height="1530" fill="#ECEDE9"/>
      <text x="54" y="65" fill="#1B2427" font-family="Helvetica Neue, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="3">ALLIM / COLOR LAB 04</text>
      <text x="1746" y="65" fill="#7F8785" text-anchor="end" font-family="Helvetica Neue, Arial, sans-serif" font-size="15" font-weight="600" letter-spacing="2">TEAL + BLUE / NON-NEON</text>
      ${cardMarkup}
    </svg>`);

  const composites = [];
  for (let index = 0; index < rendered.length; index += 1) {
    const { x, y } = cards[index];
    const logoDark = await sharp(rendered[index].logo).resize({ width: 620 }).png().toBuffer();
    const logoLight = await sharp(rendered[index].logo).resize({ width: 510 }).png().toBuffer();
    const appIcon = await sharp(rendered[index].appIcon).resize(126, 126).png().toBuffer();
    composites.push({ input: logoDark, left: x + 50, top: y + 150 });
    composites.push({ input: appIcon, left: x + 650, top: y + 188 });
    composites.push({ input: logoLight, left: x + 48, top: y + 477 });
  }
  await sharp(base).composite(composites).png().toFile(path.join(out, 'allim-color-studies-v4-board.png'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
