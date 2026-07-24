/**
 * 從 IndexedDB 靈感池／故事抽幾格，用真實 face 合成除錯圖並自動＋肉眼可檢
 */
import { mkdirSync, writeFileSync, existsSync, cpSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../data/generated/bubble-lab/pool-check');
mkdirSync(OUT, { recursive: true });

const EDGE_IDB = join(
  process.env.LOCALAPPDATA,
  'Microsoft/Edge/User Data/Default/IndexedDB'
);
const ports = [5173, 5174];
const WANT = 4;

async function loadState(port) {
  const srcLevel = join(EDGE_IDB, `http_localhost_${port}.indexeddb.leveldb`);
  if (!existsSync(srcLevel)) return null;
  const profile = join(__dirname, `../data/generated/.pw-pool-${port}`);
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(join(profile, 'Default/IndexedDB'), { recursive: true });
  cpSync(srcLevel, join(profile, 'Default/IndexedDB', `http_localhost_${port}.indexeddb.leveldb`), {
    recursive: true,
  });
  const srcBlob = join(EDGE_IDB, `http_localhost_${port}.indexeddb.blob`);
  if (existsSync(srcBlob)) {
    cpSync(srcBlob, join(profile, 'Default/IndexedDB', `http_localhost_${port}.indexeddb.blob`), {
      recursive: true,
    });
  }
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    channel: 'msedge',
  });
  const page = await context.newPage();
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1200);
  const state = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('bubbleweave', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
    return new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readonly');
      const req = tx.objectStore('state').get('app');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
  await context.close();
  return state;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 故事格 + 靈感池卡圖，必須有真實 face */
function pickPanels(state) {
  const cardById = new Map((state.cards || []).map((c) => [c.id, c]));
  const candidates = [];
  for (const story of state.stories || []) {
    const cards = story.cards || [];
    const pbs = story.panelBubbles || [];
    for (let i = 0; i < cards.length; i += 1) {
      const cardRef = cards[i];
      const card = typeof cardRef === 'string' ? cardById.get(cardRef) : cardRef;
      const bubbles = (pbs[i] || []).filter((b) => b?.face && Number.isFinite(b.face.x) && Number.isFinite(b.face.y));
      if (!card?.imageUrl || !bubbles.length) continue;
      candidates.push({
        storyId: story.id,
        storyTitle: story.title,
        panelIndex: i,
        card: {
          id: card.id,
          imageUrl: card.imageUrl,
          characterIds: card.characterIds,
          partySize: card.partySize,
          scene: card.scene,
          spatialOrder: card.spatialOrder,
          castMembers: card.castMembers,
        },
        bubbles: bubbles.map((b) => ({
          speakerId: b.speakerId,
          speaker: b.speaker,
          text: b.text,
          face: { x: b.face.x, y: b.face.y },
          slot: b.slot,
        })),
      });
    }
  }
  const multi = shuffle(candidates.filter((c) => c.bubbles.length >= 2 || (c.card.partySize || 0) >= 2));
  const solo = shuffle(candidates.filter((c) => c.bubbles.length === 1));
  // 回歸優先：先前易失敗場景；陽明山固定插第一（全身遠景）
  const yangming = candidates.filter((c) => /陽明山/.test(String(c.card.scene || '')));
  const motorcycle = candidates.filter((c) => /機車/.test(String(c.card.scene || '')));
  const regression = candidates.filter((c) =>
    /九份|觀景|臭豆腐|暴雨|捷運/.test(String(c.card.scene || ''))
  );
  const pick = [];
  for (const pool of [yangming, motorcycle, shuffle(regression), multi, solo, shuffle(candidates)]) {
    for (const c of pool) {
      if (pick.length >= WANT) break;
      const key = `${c.card.id}:${c.storyId}:${c.panelIndex}`;
      if (!pick.find((p) => `${p.card.id}:${p.storyId}:${p.panelIndex}` === key)) pick.push(c);
    }
  }
  return pick.slice(0, WANT);
}

async function main() {
  let state = null;
  let port = null;
  for (const p of ports) {
    try {
      state = await loadState(p);
      if (state?.cards?.length) {
        port = p;
        break;
      }
    } catch (e) {
      console.log(`port ${p}:`, e.message);
    }
  }
  if (!state?.cards?.length) {
    console.error('靈感池無卡，無法測試');
    process.exit(2);
  }

  const picked = pickPanels(state);
  if (!picked.length) {
    console.error('沒有帶真實 face 的故事格可測');
    process.exit(2);
  }

  console.log(`port :${port} warehouse=${state.cards.length} stories=${(state.stories || []).length} picked=${picked.length}`);
  picked.forEach((c, i) =>
    console.log(
      `  [${i + 1}] ${c.card.scene || c.card.id} party=${c.card.partySize || c.card.characterIds?.length} faces=${c.bubbles.map((b) => `${b.speakerId}(${b.face.x},${b.face.y})`).join(' ')} ← ${c.storyTitle}`
    )
  );

  const context = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await context.newPage();
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(800);

  const results = await page.evaluate(async (payload) => {
    const {
      composePanelImage,
      resolveContentFit,
      remapFaceForPanel,
      headKeepoutRect,
      layoutBubbleRect,
      fitBubbleTypography,
      normalizePanelBubbles,
      resolveCardPartySize,
    } = await import('/src/lib/speechBubble.js');

    const out = [];
    for (const item of payload.items) {
      const card = item.card;
      const bubbles = item.bubbles;
      const normalized = normalizePanelBubbles(card, bubbles);
      const dataUrl = await composePanelImage(card, normalized, {
        width: 380,
        mime: 'image/jpeg',
        quality: 0.9,
        debugFaces: true,
      });

      const W = 380;
      const H = Math.round(W * (16 / 9));
      let fit = resolveContentFit(W, H, W, H);
      try {
        const img = await new Promise((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = card.imageUrl;
        });
        fit = resolveContentFit(W, H, img.naturalWidth, img.naturalHeight);
      } catch {
        /* keep */
      }

      const partySize = resolveCardPartySize(card);
      const mapped = normalized.map((b) => {
        const remapped = remapFaceForPanel(b.face, fit, W, H, { partySize });
        return {
          ...b,
          face: remapped ? { x: remapped.x, y: remapped.y } : b.face,
          remapped,
        };
      });

      const canvas = document.createElement('canvas');
      canvas.width = 10;
      canvas.height = 10;
      const ctx = canvas.getContext('2d');
      const issues = [];
      const placed = [];
      const faceZones = mapped
        .map((b) => (b.face ? headKeepoutRect(b.face, W, H) : null))
        .filter(Boolean);

      for (const b of mapped) {
        const maxBoxW = W * (mapped.length >= 2 ? 0.46 : 0.55);
        const typo = fitBubbleTypography(ctx, b.text, maxBoxW, { panelW: W });
        const local = layoutBubbleRect(
          W,
          H,
          b,
          typo,
          placed,
          faceZones,
          mapped.length,
          partySize
        );
        placed.push(local);
        if (b.face) {
          const keep = headKeepoutRect(b.face, W, H);
          const hit = !(
            local.x + local.w <= keep.x ||
            keep.x + keep.w <= local.x ||
            local.y + local.h <= keep.y ||
            keep.y + keep.h <= local.y
          );
          if (hit) issues.push(`${b.speakerId} bubble overlaps face box`);
          if (partySize <= 1 && local.y + local.h > keep.y + 2) {
            issues.push(
              `${b.speakerId} bubble not above face (bottom=${(local.y + local.h).toFixed(0)} keepTop=${keep.y.toFixed(0)})`
            );
          }
        }
      }

      out.push({
        id: card.id,
        scene: card.scene,
        storyId: item.storyId,
        partySize,
        fit,
        faces: mapped.map((b) => ({
          speakerId: b.speakerId,
          raw: bubbles.find((n) => n.speakerId === b.speakerId)?.face,
          cal: b.face,
          remapped: b.remapped,
        })),
        issues,
        dataUrl,
      });
    }
    return out;
  }, {
    items: picked.map((p) => ({
      storyId: p.storyId,
      card: p.card,
      bubbles: p.bubbles,
    })),
  });

  await context.close();

  let failed = 0;
  const summary = [];
  for (let i = 0; i < results.length; i += 1) {
    const r = results[i];
    const file = join(OUT, `pool-${String(i + 1).padStart(2, '0')}.jpg`);
    const m = String(r.dataUrl || '').match(/^data:image\/\w+;base64,(.+)$/);
    if (m) writeFileSync(file, Buffer.from(m[1], 'base64'));
    const ok = !r.issues?.length;
    if (!ok) failed += 1;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${r.scene || r.id} party=${r.partySize} fit=${r.fit?.natW}x${r.fit?.natH}→${r.fit?.dw?.toFixed?.(0)}x${r.fit?.dh?.toFixed?.(0)} dy=${r.fit?.dy?.toFixed?.(1)}`
    );
    if (r.issues?.length) console.error(' ', r.issues.join(' | '));
    summary.push({
      scene: r.scene,
      storyId: r.storyId,
      partySize: r.partySize,
      fit: r.fit,
      faces: r.faces,
      issues: r.issues,
      file: `pool-${String(i + 1).padStart(2, '0')}.jpg`,
    });
  }
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(failed ? `\n${failed} FAILED (geometry)` : '\nALL GEOMETRY CHECKS PASSED');
  console.log('out:', OUT);
  console.log('請肉眼對照 JPG：臉框／嘴巴是否對準真臉、氣泡是否壓臉');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
