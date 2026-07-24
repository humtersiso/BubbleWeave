/**
 * YOLOv8 Anime Face（Fuyucch1/yolov8_animeface）
 * POST /__bw/detect-faces — 本機常駐 worker（固定 1280）
 *
 * 嚴格挑選規則：
 * 1. 模型辨識出所有候選臉
 * 2. 以卡牌已知人數（partySize／characterIds）為上限
 * 3. 從候選中取信心分數最高的 N 張，再依左→右對應說話者
 */
import { resolveSpatialOrder, resolveCardPartySize } from './speechBubble.js';

const DETECT_URL = '/__bw/detect-faces';
const CACHE_VER = 'v6'; // 嚴格：依人數取 top-N confidence

/** @type {Map<string, Promise<Array<object>>>} */
const detectCache = new Map();
const DETECT_CACHE_MAX = 64;

const cacheKeyForUrl = (url) => {
  const s = String(url || '');
  if (s.length < 120) return `${CACHE_VER}:${s}`;
  return `${CACHE_VER}:${s.slice(0, 48)}:${s.length}:${s.slice(-24)}`;
};

/** 信心優先；同分再比面積 */
const faceConfidence = (d) => Number(d?.score) || 0;
const faceArea = (d) => Number(d?.area) || 0;

/**
 * 從模型候選中，依信心取最高的 N 張（N＝已知人數）
 * @param {Array<object>} detections
 * @param {number} knownPeople
 */
export const pickTopFacesByConfidence = (detections, knownPeople) => {
  const need = Math.max(0, Math.min(Math.floor(knownPeople) || 0, detections?.length || 0));
  if (!need || !detections?.length) return [];
  return [...detections]
    .sort(
      (a, b) =>
        faceConfidence(b) - faceConfidence(a) ||
        faceArea(b) - faceArea(a)
    )
    .slice(0, need);
};

/** 臉來源標記（版本變更時會重跑配對） */
export const FACE_SOURCE_YOLO = 'yolov8_animeface_v6';

export const isYoloFaceSource = (source) =>
  typeof source === 'string' && source.startsWith('yolov8_animeface');

const loadHtmlImage = (src) =>
  new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('無圖'));
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('分鏡圖載入失敗'));
    img.src = src;
  });

/** 上傳給 API 的圖上限 1280（對齊 worker imgsz） */
const imageToJpegDataUrl = async (image, maxSide = 1280) => {
  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.85);
};

/**
 * @param {HTMLImageElement|string} imageOrUrl
 */
export const detectFacesInImage = async (imageOrUrl) => {
  const srcUrl = typeof imageOrUrl === 'string' ? imageOrUrl : imageOrUrl?.src || '';
  const key = cacheKeyForUrl(srcUrl);
  if (key && detectCache.has(key)) {
    return detectCache.get(key);
  }

  const run = (async () => {
    const image =
      typeof imageOrUrl === 'string' ? await loadHtmlImage(imageOrUrl) : imageOrUrl;
    const dataUrl = await imageToJpegDataUrl(image);
    const res = await fetch(DETECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `detect-faces HTTP ${res.status}`);
    }
    const body = await res.json();
    return Array.isArray(body.faces) ? body.faces : [];
  })();

  if (key) {
    if (detectCache.size >= DETECT_CACHE_MAX) {
      const first = detectCache.keys().next().value;
      detectCache.delete(first);
    }
    detectCache.set(key, run);
    run.catch(() => detectCache.delete(key));
  }
  return run;
};

/**
 * 已知人數 → 取信心最高的 N 張 → 左到右對應說話者
 */
export const assignFacesToSpeakers = (detections, speakerIds, card) => {
  const map = new Map();
  const ids = (speakerIds || []).filter(Boolean);
  if (!ids.length || !detections?.length) return map;

  const knownPeople = Math.max(
    1,
    resolveCardPartySize(card) || 1,
    (card?.characterIds || []).length || 1
  );

  const pool = pickTopFacesByConfidence(detections, knownPeople);
  if (!pool.length) return map;

  // 單說話者：用信心最高的那張
  if (ids.length === 1) {
    const best = pool[0];
    map.set(ids[0], {
      x: best.x,
      y: best.y,
      source: FACE_SOURCE_YOLO,
      score: faceConfidence(best),
    });
    return map;
  }

  const byX = [...pool].sort((a, b) => (a.x || 0) - (b.x || 0) || (a.y || 0) - (b.y || 0));
  const spatial = resolveSpatialOrder(card);
  const speakersLtr = [...ids].sort((a, b) => {
    const ia = spatial.indexOf(a);
    const ib = spatial.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const n = Math.min(speakersLtr.length, byX.length);
  for (let i = 0; i < n; i += 1) {
    const det = byX[i];
    map.set(speakersLtr[i], {
      x: det.x,
      y: det.y,
      source: FACE_SOURCE_YOLO,
      score: faceConfidence(det),
    });
  }

  return map;
};

export const heuristicFacesForCard = (card, speakerIds = []) => {
  const map = new Map();
  const spatial = resolveSpatialOrder(card);
  const ids = speakerIds.length
    ? speakerIds
    : spatial.length
      ? spatial
      : card?.characterIds || [];
  const n = ids.length || 1;
  ids.forEach((id, i) => {
    const t = n <= 1 ? 0.5 : i / Math.max(1, n - 1);
    map.set(id, {
      x: n <= 1 ? 0.5 : 0.28 + t * 0.44,
      y: n <= 1 ? 0.28 : 0.3,
      source: 'heuristic',
    });
  });
  return map;
};

export const attachFacesToBubbles = async (card, bubbles = [], opts = {}) => {
  if (!card?.imageUrl || !bubbles?.length) return bubbles || [];

  const need = bubbles.filter((b) => {
    if (!b?.speakerId || !String(b.text || '').trim()) return false;
    if (opts.force) return true;
    if (!b.face) return true;
    return b.face.source !== FACE_SOURCE_YOLO;
  });
  if (!need.length) return bubbles;

  let detections = [];
  try {
    detections = await detectFacesInImage(card.imageUrl);
  } catch (err) {
    console.warn('[animeFace] detect failed:', err);
  }

  const speakerIds = [...new Set(bubbles.map((b) => b.speakerId).filter(Boolean))];
  let faceMap = assignFacesToSpeakers(detections, speakerIds, card);
  if (!faceMap.size) {
    faceMap = heuristicFacesForCard(card, speakerIds);
  }

  return bubbles.map((b) => {
    if (!b?.speakerId) return b;
    if (!opts.force && b.face?.source === FACE_SOURCE_YOLO) return b;
    const face = faceMap.get(b.speakerId);
    return face ? { ...b, face } : b;
  });
};

export const attachFacesToStory = async (cards = [], panelBubbles = [], opts = {}) => {
  const out = [];
  for (let i = 0; i < cards.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    out.push(await attachFacesToBubbles(cards[i], panelBubbles[i] || [], opts));
  }
  return out;
};

export const locatePanelFaces = async (cards = []) => {
  const panels = [];
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    const ids = card?.characterIds || [];
    let detections = [];
    try {
      if (card?.imageUrl) {
        // eslint-disable-next-line no-await-in-loop
        detections = await detectFacesInImage(card.imageUrl);
      }
    } catch (err) {
      console.warn('[animeFace] panel', i + 1, err);
    }
    let faceMap = assignFacesToSpeakers(detections, ids, card);
    if (!faceMap.size) faceMap = heuristicFacesForCard(card, ids);
    panels.push({
      i: i + 1,
      faces: [...faceMap.entries()].map(([speakerId, f]) => ({
        speakerId,
        x: f.x,
        y: f.y,
        source: f.source,
      })),
    });
  }
  return panels;
};

/** 放卡時背景預熱 YOLO（不擋 UI；結果進 detectCache） */
export const prefetchCardFaces = (card) => {
  if (!card?.imageUrl) return Promise.resolve([]);
  return detectFacesInImage(card.imageUrl).catch((err) => {
    console.warn('[animeFace] prefetch failed:', err);
    return [];
  });
};

export const prefetchStoryFaces = (cards = []) => {
  (cards || []).forEach((c) => {
    prefetchCardFaces(c);
  });
};
