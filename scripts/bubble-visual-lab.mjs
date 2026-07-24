/**
 * 視覺實驗室：輸出對話框 vs 臉禁區 PNG，並自動判定擋臉／刺臉
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import {
  layoutBubbleRect,
  headKeepoutRect,
  MAX_TAIL_LENGTH,
  MICRO_STUB_LENGTH,
} from '../src/lib/speechBubble.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../data/generated/bubble-lab');
mkdirSync(OUT, { recursive: true });

const W = 380;
const H = 675;

const overlap = (a, b) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
};

const inRect = (px, py, r, pad = 0) =>
  px >= r.x - pad &&
  px <= r.x + r.w + pad &&
  py >= r.y - pad &&
  py <= r.y + r.h + pad;

const setPx = (png, x, y, r, g, b, a = 255) => {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= png.width || iy >= png.height) return;
  const i = (png.width * iy + ix) << 2;
  png.data[i] = r;
  png.data[i + 1] = g;
  png.data[i + 2] = b;
  png.data[i + 3] = a;
};

const fillRect = (png, rect, rgb, alpha = 255) => {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(png.width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(png.height, Math.ceil(rect.y + rect.h));
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) setPx(png, x, y, rgb[0], rgb[1], rgb[2], alpha);
  }
};

const strokeRect = (png, rect, rgb, t = 2) => {
  fillRect(png, { x: rect.x, y: rect.y, w: rect.w, h: t }, rgb);
  fillRect(png, { x: rect.x, y: rect.y + rect.h - t, w: rect.w, h: t }, rgb);
  fillRect(png, { x: rect.x, y: rect.y, w: t, h: rect.h }, rgb);
  fillRect(png, { x: rect.x + rect.w - t, y: rect.y, w: t, h: rect.h }, rgb);
};

const fillCircle = (png, cx, cy, rad, rgb) => {
  const r2 = rad * rad;
  for (let y = -rad; y <= rad; y += 1) {
    for (let x = -rad; x <= rad; x += 1) {
      if (x * x + y * y <= r2) setPx(png, cx + x, cy + y, rgb[0], rgb[1], rgb[2]);
    }
  }
};

const drawLine = (png, x0, y0, x1, y1, rgb) => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    setPx(png, x0 + dx * t, y0 + dy * t, rgb[0], rgb[1], rgb[2]);
  }
};

const cases = [
  {
    id: '01-solo-center',
    partySize: 1,
    bubbles: [{ text: '這是什麼機車', face: { x: 0.5, y: 0.42 }, slot: 'top-left' }],
  },
  {
    id: '02-solo-high-face',
    partySize: 1,
    bubbles: [{ text: '太誇張了吧', face: { x: 0.55, y: 0.22 }, slot: 'top-right' }],
  },
  {
    id: '03-duo-left-right',
    partySize: 2,
    bubbles: [
      { text: '蝴蝶好美', face: { x: 0.28, y: 0.4 }, slot: 'top-left' },
      { text: '請停止你的', face: { x: 0.72, y: 0.38 }, slot: 'top-right' },
    ],
  },
  {
    id: '04-duo-cindy-right',
    partySize: 2,
    bubbles: [
      { text: '我在右邊', face: { x: 0.75, y: 0.36 }, slot: 'top-right' },
      { text: '我在左邊', face: { x: 0.25, y: 0.4 }, slot: 'top-left' },
    ],
  },
  {
    id: '05-solo-low-face',
    partySize: 1,
    bubbles: [{ text: '跌倒了啦', face: { x: 0.48, y: 0.62 }, slot: 'top-left' }],
  },
];

let failed = 0;

for (const c of cases) {
  const png = new PNG({ width: W, height: H });
  fillRect(png, { x: 0, y: 0, w: W, h: H }, [235, 232, 224]);

  const faces = c.bubbles.map((b) => b.face).filter(Boolean);
  const faceZones = faces.map((f) => headKeepoutRect(f, W, H));
  for (const f of faces) {
    const ko = headKeepoutRect(f, W, H);
    fillRect(png, ko, [255, 200, 200], 120);
    strokeRect(png, ko, [220, 40, 40], 2);
    fillCircle(png, f.x * W, f.y * H, 10, [40, 40, 40]); // face center
    const headY = f.y * H - H * 0.14 * 0.5;
    fillCircle(png, f.x * W, headY, 5, [0, 120, 255]); // head top
  }

  const typo = { boxW: 150, boxH: 52, font: 14, lines: ['x'], lineH: 18 };
  const placed = [];
  const issues = [];

  for (const b of c.bubbles) {
    const tw = Math.min(typo.boxW, W * (c.bubbles.length >= 2 ? 0.46 : 0.55));
    const local = layoutBubbleRect(
      W,
      H,
      b,
      { ...typo, boxW: tw },
      placed,
      faceZones,
      c.bubbles.length,
      c.partySize
    );
    placed.push(local);

    fillRect(png, local, [255, 255, 255]);
    strokeRect(png, local, [28, 25, 23], 3);
    // tail
    drawLine(png, local.rootX, local.rootY, local.tipX, local.tipY, [28, 25, 23]);
    fillCircle(png, local.tipX, local.tipY, 4, [180, 0, 0]);

    const ko = b.face ? headKeepoutRect(b.face, W, H) : null;
    if (ko) {
      const cover = overlap(local, ko);
      if (cover > 1) {
        issues.push(`bubble-covers-face area=${cover.toFixed(0)}`);
      }
      if (inRect(local.tipX, local.tipY, ko, 1)) {
        issues.push('tip-inside-keepout');
      }
      if (local.tipY > ko.y) {
        issues.push(`tip-below-keepout-top tipY=${local.tipY.toFixed(1)} ko.y=${ko.y.toFixed(1)}`);
      }
    }
    const len = Math.hypot(local.tipX - local.rootX, local.tipY - local.rootY);
    if (c.partySize <= 1) {
      if (len > MICRO_STUB_LENGTH + 6) issues.push(`solo-tail-too-long ${len.toFixed(1)}`);
    } else if (len > MAX_TAIL_LENGTH + 1) {
      issues.push(`multi-tail-too-long ${len.toFixed(1)}`);
    }
  }

  const file = join(OUT, `${c.id}.png`);
  writeFileSync(file, PNG.sync.write(png));
  if (issues.length) {
    failed += 1;
    console.error('FAIL', c.id, issues.join(' | '));
  } else {
    console.log('PASS', c.id, '->', file);
  }
}

console.log(failed ? `\\n${failed} FAILED` : '\\nALL VISUAL CHECKS PASSED');
process.exit(failed ? 1 : 0);
