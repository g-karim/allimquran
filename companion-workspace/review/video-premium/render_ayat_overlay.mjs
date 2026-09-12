import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/Users/rafael/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');
const sharp = require('sharp');

const width = 1890;
const height = 1080;
const fps = 30;
const overlayStart = 3.8;
const overlayDuration = 6.35;
const frameCount = Math.ceil(overlayDuration * fps);
const outDir = process.argv[2];
const singleFrame = process.argv[3] === undefined ? null : Number(process.argv[3]);

if (!outDir) {
  throw new Error('Usage: render_ayat_overlay.mjs OUTPUT_DIR [FRAME_INDEX]');
}

await fs.mkdir(outDir, { recursive: true });

const phrases = [
  'اقْرَأْ',
  'بِاسْمِ رَبِّكَ',
  'الَّذِي خَلَقَ',
  'عَلَّمَ بِالْقَلَمِ',
  'الْإِنسَانَ',
];

const wideTargets = [570, 750, 935, 1115, 1300];
const closeTargets = [355, 680, 960, 1225, 1535];

const clamp = (value, lower = 0, upper = 1) => Math.min(Math.max(value, lower), upper);
const smoothstep = (edge0, edge1, value) => {
  const x = clamp((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};
const noise = (index) => {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};
const quadratic = (p0, p1, p2, t) => {
  const omt = 1 - t;
  return {
    x: omt * omt * p0.x + 2 * omt * t * p1.x + t * t * p2.x,
    y: omt * omt * p0.y + 2 * omt * t * p1.y + t * t * p2.y,
  };
};
const escapeXml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

function textSvg(phrase, x, y, size, opacity, scaleX = 1) {
  if (opacity <= 0.01) return '';
  return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scaleX.toFixed(3)} 1)">
    <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" direction="rtl"
      font-family="SF Arabic, Geeza Pro, Noto Naskh Arabic, sans-serif" font-size="${size}" font-weight="600"
      fill="#FFE59A" opacity="${opacity.toFixed(3)}" filter="url(#textGlow)">${escapeXml(phrase)}</text>
  </g>`;
}

function dustSvg(stream, head, progress, opacity, dense) {
  const amount = dense ? 34 : 18;
  const particles = [];
  for (let particle = 0; particle < amount; particle += 1) {
    const key = stream * 1000 + particle * 17;
    const phase = ((particle / amount) + progress * 1.55) % 1;
    const jitterX = (noise(key) - 0.5) * (dense ? 66 : 34);
    const driftY = phase * (dense ? 115 : 64);
    const radius = 0.8 + noise(key + 3) * (dense ? 2.7 : 1.8);
    const particleOpacity = opacity * (1 - phase) * (0.28 + noise(key + 5) * 0.58);
    particles.push(`<circle cx="${(head.x + jitterX).toFixed(2)}" cy="${(head.y + driftY).toFixed(2)}" r="${radius.toFixed(2)}" fill="#FFE8A6" opacity="${particleOpacity.toFixed(3)}"/>`);
  }
  return particles.join('\n');
}

function buildSvg(frame) {
  const localTime = frame / fps;
  const sourceTime = overlayStart + localTime;
  const globalFadeIn = smoothstep(4.08, 4.55, sourceTime);
  const globalFadeOut = 1 - smoothstep(9.55, 10.05, sourceTime);
  const globalAlpha = globalFadeIn * globalFadeOut;
  const elements = [];

  if (sourceTime < 6.88) {
    const travel = smoothstep(4.30, 6.55, sourceTime);
    for (let stream = 0; stream < 5; stream += 1) {
      const start = { x: 900 + stream * 22, y: 335 };
      const end = { x: wideTargets[stream], y: 510 };
      const control = { x: (start.x + end.x) / 2, y: 400 - Math.abs(end.x - start.x) * 0.06 };
      const head = quadratic(start, control, end, travel);
      const streamAlpha = globalAlpha * (stream === 2 ? 1.0 : 0.86);
      const strokeWidth = stream === 2 ? 6.2 : 5.2;

      elements.push(`<path d="M ${start.x} ${start.y} Q ${control.x.toFixed(2)} ${control.y.toFixed(2)} ${head.x.toFixed(2)} ${head.y.toFixed(2)}" fill="none" stroke="#FFC95C" stroke-opacity="${(streamAlpha * 0.38).toFixed(3)}" stroke-width="${strokeWidth}" stroke-linecap="round" filter="url(#lineGlow)"/>`);
      for (let token = 0; token < 5; token += 1) {
        const tokenT = Math.max(0, travel - token * 0.13);
        const point = quadratic(start, control, end, tokenT);
        const tokenAlpha = streamAlpha * Math.max(0.18, 1 - token * 0.16);
        elements.push(textSvg(phrases[stream], point.x, point.y, 17, tokenAlpha, 0.78));
      }
      elements.push(dustSvg(stream, head, travel, streamAlpha, false));
    }
  } else {
    const depth = smoothstep(6.88, 9.58, sourceTime);
    const topY = 55;
    const bottomY = 805;
    const headY = topY + (bottomY - topY) * depth;

    for (let stream = 0; stream < 5; stream += 1) {
      const x = closeTargets[stream];
      const streamAlpha = globalAlpha * (stream === 2 ? 1.0 : 0.88);
      const strokeWidth = stream === 2 ? 7.2 : 6.0;
      elements.push(`<line x1="${x}" y1="${topY}" x2="${x}" y2="${headY.toFixed(2)}" stroke="#FFC95C" stroke-opacity="${(streamAlpha * 0.40).toFixed(3)}" stroke-width="${strokeWidth}" stroke-linecap="round" filter="url(#lineGlow)"/>`);

      const spacing = 82;
      let y = topY + ((sourceTime * 86) % spacing);
      let token = 0;
      while (y < headY + 10 && token < 14) {
        const distance = Math.max(0, (headY - y) / Math.max(1, headY - topY));
        const tokenAlpha = streamAlpha * (0.38 + 0.62 * distance);
        elements.push(textSvg(phrases[stream], x, y, 22, tokenAlpha, stream === 2 ? 0.76 : 0.70));
        y += spacing;
        token += 1;
      }
      elements.push(dustSvg(stream, { x, y: headY }, depth, streamAlpha, true));
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="textGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feFlood flood-color="#FFB72F" flood-opacity="0.72" result="color"/>
      <feComposite in="color" in2="blur" operator="in" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="lineGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="13" result="blur"/>
      <feFlood flood-color="#FFB72F" flood-opacity="0.78" result="color"/>
      <feComposite in="color" in2="blur" operator="in" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g style="mix-blend-mode:screen">${elements.join('\n')}</g>
</svg>`;
}

async function renderFrame(frame) {
  const svg = buildSvg(frame);
  const destination = path.join(outDir, `ayat-${String(frame).padStart(4, '0')}.png`);
  await sharp(Buffer.from(svg), { density: 144 })
    .resize(width, height)
    .png({ compressionLevel: 7 })
    .toFile(destination);
}

const frames = singleFrame === null ? Array.from({ length: frameCount }, (_, index) => index) : [singleFrame];
const concurrency = 6;
let cursor = 0;
async function worker() {
  while (cursor < frames.length) {
    const frame = frames[cursor];
    cursor += 1;
    await renderFrame(frame);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, frames.length) }, worker));
console.log(`Rendered ${frames.length} overlay frame(s) to ${outDir}`);
