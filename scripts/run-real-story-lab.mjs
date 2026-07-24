/**
 * 從瀏覽器 profile 的 IndexedDB 透過 Playwright 讀出故事，並跑 bubble 視覺檢查
 */
import { mkdirSync, writeFileSync, cpSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import {
  layoutBubbleRect,
  resolveFaceCirclePx,
  resolveMouthPx,
  FACE_OUTSIDE_GAP,
  normalizePanelBubbles,
  resolveCardPartySize,
  MAX_TAIL_LENGTH,
  MICRO_STUB_LENGTH,
} from '../src/lib/speechBubble.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../data/generated/bubble-lab');
mkdirSync(OUT, { recursive: true });

const EDGE_IDB = join(
  process.env.LOCALAPPDATA,
  'Microsoft/Edge/User Data/Default/IndexedDB'
);

const ports = [5173, 5174];

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

async function loadStateViaPlaywright(port) {
  const { chromium } = await import('playwright');
  const srcLevel = join(EDGE_IDB, `http_localhost_${port}.indexeddb.leveldb`);
  const srcBlob = join(EDGE_IDB, `http_localhost_${port}.indexeddb.blob`);
  if (!existsSync(srcLevel)) {
    console.log(`no IDB for :${port}`);
    return null;
  }

  const profile = join(__dirname, '../data/generated/.pw-profile-' + port);
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(join(profile, 'Default/IndexedDB'), { recursive: true });
  cpSync(srcLevel, join(profile, 'Default/IndexedDB', `http_localhost_${port}.indexeddb.leveldb`), {
    recursive: true,
  });
  if (existsSync(srcBlob)) {
    cpSync(srcBlob, join(profile, 'Default/IndexedDB', `http_localhost_${port}.indexeddb.blob`), {
      recursive: true,
    });
  }

  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    channel: 'msedge',
    args: ['--disable-web-security'],
  });
  const page = await context.newPage();
  try {
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    const state = await page.evaluate(async () => {
      const openDb = () =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('bubbleweave', 1);
          req.onerror = () => reject(req.error);
          req.onsuccess = () => resolve(req.result);
        });
      try {
        const db = await openDb();
        const value = await new Promise((resolve, reject) => {
          const tx = db.transaction('state', 'readonly');
          const req = tx.objectStore('state').get('app');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        return value || null;
      } catch (e) {
        return { __error: String(e) };
      }
    });
    await context.close();
    return state;
  } catch (e) {
    await context.close().catch(() => {});
    throw e;
  }
}

function renderPanel(png, W, H, card, bubbles, partySize) {
  // bg
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 235;
    png.data[i + 1] = 232;
    png.data[i + 2] = 224;
    png.data[i + 3] = 255;
  }
  const setPx = (x, y, r, g, b) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
    const i = (W * iy + ix) << 2;
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = 255;
  };
  const fillRect = (rect, rgb) => {
    for (let y = Math.floor(rect.y); y < rect.y + rect.h; y++) {
      for (let x = Math.floor(rect.x); x < rect.x + rect.w; x++) setPx(x, y, ...rgb);
    }
  };
  const strokeRect = (rect, rgb, t = 2) => {
    fillRect({ x: rect.x, y: rect.y, w: rect.w, h: t }, rgb);
    fillRect({ x: rect.x, y: rect.y + rect.h - t, w: rect.w, h: t }, rgb);
    fillRect({ x: rect.x, y: rect.y, w: t, h: rect.h }, rgb);
    fillRect({ x: rect.x + rect.w - t, y: rect.y, w: t, h: rect.h }, rgb);
  };
  const line = (x0, y0, x1, y1, rgb) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      setPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, ...rgb);
    }
  };

  const normalized = normalizePanelBubbles(card, bubbles);
  const faceZones = normalized
    .map((b) => (b.face ? resolveFaceCirclePx(b.face, W, H) : null))
    .filter(Boolean);

  for (const b of normalized) {
    if (!b.face) continue;
    const c = resolveFaceCirclePx(b.face, W, H);
    const m = resolveMouthPx(b.face, W, H);
    // draw circle approx as square bbox for visibility
    const safe = c.r + FACE_OUTSIDE_GAP;
    fillRect({ x: c.cx - c.r, y: c.cy - c.r, w: c.r * 2, h: c.r * 2 }, [255, 180, 180]);
    strokeRect({ x: c.cx - safe, y: c.cy - safe, w: safe * 2, h: safe * 2 }, [200, 30, 30], 2);
    setPx(c.cx, c.cy, 20, 20, 20);
    setPx(m.x, m.y, 0, 100, 255);
  }

  const placed = [];
  const issues = [];
  for (const b of normalized) {
    const typo = {
      boxW: Math.min(160, W * (normalized.length >= 2 ? 0.46 : 0.55)),
      boxH: 52,
      font: 14,
      lines: [b.text || '…'],
      lineH: 18,
    };
    const local = layoutBubbleRect(
      W,
      H,
      b,
      typo,
      placed,
      faceZones,
      normalized.length,
      partySize
    );
    placed.push(local);
    fillRect(local, [255, 255, 255]);
    strokeRect(local, [28, 25, 23], 3);
    line(local.rootX, local.rootY, local.tipX, local.tipY, [28, 25, 23]);
    setPx(local.tipX, local.tipY, 200, 0, 0);

    if (b.face) {
      const c = resolveFaceCirclePx(b.face, W, H);
      const qx = Math.max(local.x, Math.min(c.cx, local.x + local.w));
      const qy = Math.max(local.y, Math.min(c.cy, local.y + local.h));
      const d = Math.hypot(c.cx - qx, c.cy - qy);
      if (d < c.r + FACE_OUTSIDE_GAP - 1) {
        issues.push(`${b.speakerId || '?'} bubble inside safe circle d=${d.toFixed(1)}`);
      }
      const tipD = Math.hypot(local.tipX - c.cx, local.tipY - c.cy);
      if (tipD < c.r - 1) issues.push(`${b.speakerId || '?'} tip in circle`);
    }
    const len = Math.hypot(local.tipX - local.rootX, local.tipY - local.rootY);
    if (partySize <= 1 && len > MICRO_STUB_LENGTH + 8) issues.push('solo tail long');
    if (partySize > 1 && len > MAX_TAIL_LENGTH + 1) issues.push('multi tail long');
  }
  return { issues, normalized };
}

async function main() {
  let state = null;
  let usedPort = null;
  for (const port of ports) {
    try {
      state = await loadStateViaPlaywright(port);
      if (state && !state.__error && Array.isArray(state.stories) && state.stories.length) {
        usedPort = port;
        break;
      }
      console.log(`port ${port}:`, state?.__error || `stories=${state?.stories?.length ?? 0}`);
    } catch (e) {
      console.log(`port ${port} failed:`, e.message);
    }
  }

  if (!state?.stories?.length) {
    console.error('無法從 IndexedDB 讀到 stories。請確認瀏覽器曾在 localhost 開啟過本專案。');
    process.exit(2);
  }

  console.log(`loaded from :${usedPort}, stories=${state.stories.length}`);
  const target =
    state.stories.find((s) => /Cindy.*Bob.*David|辛蒂.*鮑勃.*大衛/i.test(s.title || '')) ||
    state.stories.find((s) => (s.title || '').includes('Cindy＆Bob＆David')) ||
    state.stories.find((s) => {
      const ids = [...new Set((s.cards || []).flatMap((c) => c.characterIds || []))];
      return ids.includes('cindy') && ids.includes('bob') && ids.includes('david') && (s.cards || []).length === 4;
    });

  if (!target) {
    console.error('找不到 Cindy＆Bob＆David · 4 格。現有標題：');
    state.stories.slice(0, 15).forEach((s) => console.error(' -', s.title, 'cards=', s.cards?.length));
    process.exit(3);
  }

  console.log('TARGET:', target.title, 'id=', target.id);
  const slim = {
    title: target.title,
    id: target.id,
    cards: (target.cards || []).map((c) => ({
      id: c.id,
      partySize: c.partySize,
      characterIds: c.characterIds,
      spatialOrder: c.spatialOrder,
      scene: c.scene,
      hasImage: Boolean(c.imageUrl),
    })),
    panelBubbles: target.panelBubbles,
    dialogues: target.dialogues,
  };
  writeFileSync(join(OUT, 'cindy-bob-david-4.json'), JSON.stringify(slim, null, 2), 'utf8');

  const W = 380;
  const H = 675;
  let failed = 0;
  for (let i = 0; i < (target.cards || []).length; i += 1) {
    const card = target.cards[i];
    const bubbles = target.panelBubbles?.[i] || [];
    const partySize = resolveCardPartySize(card);
    const png = new PNG({ width: W, height: H });
    const { issues, normalized } = renderPanel(png, W, H, card, bubbles, partySize);
    const file = join(OUT, `real-p${i + 1}.png`);
    writeFileSync(file, PNG.sync.write(png));
    console.log(
      `Panel ${i + 1}: party=${partySize} ids=${(card.characterIds || []).join(',')} bubbles=${normalized.length} faces=${normalized.map((b) => `${b.speakerId}:{${b.face?.x?.toFixed?.(2)},${b.face?.y?.toFixed?.(2)}}`).join(' ')}`
    );
    if (issues.length) {
      failed += 1;
      console.error('  FAIL', issues.join(' | '));
    } else {
      console.log('  PASS', file);
    }
  }
  console.log(failed ? `${failed} panels FAILED` : 'ALL REAL PANELS PASSED');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
