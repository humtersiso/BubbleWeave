import { chromium } from 'playwright';
import { mkdirSync, existsSync, cpSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const EDGE_IDB = join(
  process.env.LOCALAPPDATA,
  'Microsoft/Edge/User Data/Default/IndexedDB'
);
const port = 5173;
const profile = join('d:/Yulon/bubble_weave/data/generated/.pw-face3');
const srcLevel = join(EDGE_IDB, `http_localhost_${port}.indexeddb.leveldb`);
rmSync(profile, { recursive: true, force: true });
mkdirSync(join(profile, 'Default/IndexedDB'), { recursive: true });
cpSync(
  srcLevel,
  join(profile, 'Default/IndexedDB', `http_localhost_${port}.indexeddb.leveldb`),
  { recursive: true }
);
const srcBlob = join(EDGE_IDB, `http_localhost_${port}.indexeddb.blob`);
if (existsSync(srcBlob)) {
  cpSync(
    srcBlob,
    join(profile, 'Default/IndexedDB', `http_localhost_${port}.indexeddb.blob`),
    { recursive: true }
  );
}
const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  channel: 'msedge',
});
const page = await context.newPage();
await page.goto(`http://localhost:${port}/`, {
  waitUntil: 'domcontentloaded',
  timeout: 20000,
});
await page.waitForTimeout(1200);
const cards = await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('bubbleweave', 1);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const state = await new Promise((res, rej) => {
    const tx = db.transaction('state', 'readonly');
    const r = tx.objectStore('state').get('app');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return (state.cards || [])
    .filter((c) => c.imageUrl)
    .slice(0, 5)
    .map((c) => ({
      scene: c.scene,
      party: c.partySize,
      imageUrl: c.imageUrl,
    }));
});
await context.close();

const outDir = 'd:/Yulon/bubble_weave/data/generated/.face-tmp';
mkdirSync(outDir, { recursive: true });
for (let i = 0; i < cards.length; i += 1) {
  const c = cards[i];
  const m = String(c.imageUrl).match(/^data:image\/\w+;base64,(.+)$/);
  if (!m) continue;
  const p = join(outDir, `card-${i}.jpg`);
  writeFileSync(p, Buffer.from(m[1], 'base64'));
  const r = spawnSync('python', ['scripts/detect-animeface.py', p], {
    encoding: 'utf8',
    cwd: 'd:/Yulon/bubble_weave',
  });
  let faces = [];
  try {
    faces = JSON.parse((r.stdout || '').trim() || '[]');
  } catch {
    console.log('stderr', r.stderr);
  }
  console.log(
    c.scene,
    'party',
    c.party,
    'faces',
    faces.length,
    faces.slice(0, 3).map((f) => ({
      x: +f.x.toFixed(2),
      y: +f.y.toFixed(2),
      s: +f.score.toFixed(2),
    }))
  );
}
