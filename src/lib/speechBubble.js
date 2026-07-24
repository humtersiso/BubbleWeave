/**
 * 對話框合成：站位避讓 + 抗晃動大字 + 無尾巴浮動卡片（Canvas）
 * 基準畫布：1080×1440（3:4）
 */

import { CHARACTERS_BY_ID } from './casts.js';
import seasonTaiwanDiverse from '../../data/generated/season-taiwan-diverse.json' with { type: 'json' };

/** 📱 BubbleWeave 定案參數（絕對 px 以 1080 寬為準，其它寬度等比縮放） */
export const BUBBLE_WEAVE_CONFIG = {
  canvas: {
    width: 1080,
    height: 1440,
    aspectRatio: '3:4',
    margin: 24,
  },
  bubbleCard: {
    minWidth: 280,
    maxWidth: 918, // 1080 * 0.85
    paddingY: 24,
    paddingX: 32,
    strokeWidth: 6,
    borderRadius: 24,
    fillColor: '#FFFFFF',
    strokeColor: '#000000',
  },
  typography: {
    fontFamily:
      '"Noto Sans TC", "Huninn", "PingFang TC", "Microsoft JhengHei", "Zen Kaku Gothic New", system-ui, sans-serif',
    fontWeight: 'bold',
    sizeBig: 46, // ≤6 字
    sizeNormal: 38, // 7～14 字
    sizeSmall: 31, // ≥15 字
    lineHeightRatio: 1.45,
    textColor: '#000000',
  },
};

/** 對白硬上限 */
export const MAX_BUBBLE_CHARS = 24;
export const MAX_BUBBLES_PER_PANEL = 4;
export const MAX_BUBBLE_LINES = 3;
export const HARD_MAX_BUBBLE_LINES = 4;

export const MANGA_PANEL_COMPOSE_WIDTH = BUBBLE_WEAVE_CONFIG.canvas.width;
export const MANGA_PANEL_COMPOSE_HEIGHT = BUBBLE_WEAVE_CONFIG.canvas.height;
/** height / width（3:4 → 4/3） */
export const MANGA_PANEL_ASPECT = MANGA_PANEL_COMPOSE_HEIGHT / MANGA_PANEL_COMPOSE_WIDTH;

export const bubbleScale = (panelW = MANGA_PANEL_COMPOSE_WIDTH) =>
  Math.max(0.05, (Number(panelW) || MANGA_PANEL_COMPOSE_WIDTH) / MANGA_PANEL_COMPOSE_WIDTH);

/** 氣泡最大寬相對格寬（定案 85%） */
export const bubbleSideMaxRatio = () =>
  BUBBLE_WEAVE_CONFIG.bubbleCard.maxWidth / BUBBLE_WEAVE_CONFIG.canvas.width;

const INK = BUBBLE_WEAVE_CONFIG.bubbleCard.strokeColor;
const WHITE = BUBBLE_WEAVE_CONFIG.bubbleCard.fillColor;
const FONT = BUBBLE_WEAVE_CONFIG.typography.fontFamily;

/** 畫面左→右排序權重（對齊總編輯 LEFT／CENTER／RIGHT） */
const SPATIAL_SIDE_RANK = {
  'FAR LEFT': 0,
  LEFT: 1,
  'LEFT-CENTER': 2,
  CENTER: 3,
  'RIGHT-CENTER': 4,
  RIGHT: 5,
  'FAR RIGHT': 6,
};

const CHARACTER_NAME_RE = Object.values(CHARACTERS_BY_ID).map((c) => ({
  id: c.id,
  re: new RegExp(`\\b${c.name}\\b|\\(${c.name}\\)|\\b${c.nameZh}\\b`, 'i'),
}));

/**
 * 從 image_prompt 解析畫面左→右角色（LEFT／CENTER／RIGHT）
 * character_ids 順序常與構圖不符，不可當 LTR 權威來源
 */
export const parseSpatialOrderFromPrompt = (prompt) => {
  const p = String(prompt || '');
  if (!p) return [];
  const markerRe =
    /\b(?:On the |on the )?(FAR LEFT|LEFT-CENTER|LEFT|CENTER|RIGHT-CENTER|FAR RIGHT|RIGHT)\b\s*[:：\-–—]?\s*/gi;
  const hits = [];
  let m;
  while ((m = markerRe.exec(p)) !== null) {
    const side = String(m[1] || '').toUpperCase();
    const rank = SPATIAL_SIDE_RANK[side];
    if (rank == null) continue;
    const start = m.index + m[0].length;
    const rest = p.slice(start);
    const nextAt = rest.search(
      /\b(?:On the |on the )?(?:FAR LEFT|LEFT-CENTER|LEFT|CENTER|RIGHT-CENTER|FAR RIGHT|RIGHT)\b/i
    );
    const chunk = (nextAt >= 0 ? rest.slice(0, nextAt) : rest).slice(0, 160);
    for (const { id, re } of CHARACTER_NAME_RE) {
      if (re.test(chunk)) {
        hits.push({ id, rank, index: m.index });
        break;
      }
    }
  }
  hits.sort((a, b) => a.rank - b.rank || a.index - b.index);
  const out = [];
  for (const h of hits) {
    if (!out.includes(h.id)) out.push(h.id);
  }
  return out;
};

/** scene_zh → 畫面 LTR（舊倉儲卡無 spatialOrder 時後備） */
const SCENE_SPATIAL_ORDER = (() => {
  const map = new Map();
  const cards = seasonTaiwanDiverse?.cards || seasonTaiwanDiverse || [];
  for (const c of cards) {
    const scene = String(c.scene_zh || '').trim();
    const order = parseSpatialOrderFromPrompt(c.image_prompt);
    if (scene && order.length >= 2) map.set(scene, order);
  }
  return map;
})();

/**
 * 卡牌畫面左→右角色順序
 * 優先：spatialOrder → prompt 解析 → 季包 scene 對照 → characterIds
 */
export const resolveSpatialOrder = (card) => {
  if (Array.isArray(card?.spatialOrder) && card.spatialOrder.length) {
    return card.spatialOrder.filter((id) => CHARACTERS_BY_ID[id]);
  }
  const fromPrompt = parseSpatialOrderFromPrompt(
    card?.imagePrompt || card?.image_prompt || card?.recipe?.prompt
  );
  if (fromPrompt.length >= 2) return fromPrompt;

  const scene = String(card?.scene || card?.recipe?.scene || '').trim();
  if (scene && SCENE_SPATIAL_ORDER.has(scene)) {
    return SCENE_SPATIAL_ORDER.get(scene);
  }

  return (card?.characterIds || []).filter((id) => CHARACTERS_BY_ID[id]);
};

/**
 * 依卡牌角色順序推站位（與 cardRecipes SPATIAL_SLOT 對齊）
 * @param {object} card
 * @param {string} [speakerId]
 * @returns {'top-left'|'top-right'|'top-center'}
 */
export const resolveSpeakerSlot = (card, speakerId) => {
  const ids = resolveSpatialOrder(card);
  const n = ids.length || (card?.characterIds || []).length;
  // 單人常置中構圖：氣泡改偏左上，避免蓋住臉
  if (n <= 1) return 'top-left';

  let idx = speakerId ? ids.indexOf(speakerId) : 0;
  if (idx < 0) {
    const fallback = card?.characterIds || [];
    idx = speakerId ? fallback.indexOf(speakerId) : 0;
    if (idx < 0) idx = 0;
  }

  if (n === 2) return idx === 0 ? 'top-left' : 'top-right';
  if (n === 3) {
    // 三人也不放正中，避免蓋臉
    return idx === 0 ? 'top-left' : 'top-right';
  }
  // 4 人：一律左右，避開正中央臉部
  if (idx <= 1) return 'top-left';
  return 'top-right';
};

/** 對白長度上限；超出只裁切，不加省略號 */
export const clampBubbleText = (text, max = MAX_BUBBLE_CHARS) => {
  let t = String(text || '').replace(/\s+/g, '').trim();
  t = t.replace(/[\u201c\u201d\u300c\u300d\u300e\u300f"']/g, '');
  t = t.replace(/[\u2026\u22ef]+/gu, '').replace(/\.{2,}/g, '');
  if (!t) return '';
  return t.length <= max ? t : t.slice(0, max);
};

/** 手動位置（格內 0～1，氣泡左上角） */
export const sanitizeManualPos = (pos) => {
  if (!pos || typeof pos !== 'object') return null;
  const x = Number(pos.x);
  const y = Number(pos.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
};

/** 依定案字級表：短吐槽／標準／較長；隨 panelW 等比 */
export const getBubbleFontPx = (textLength, panelW = MANGA_PANEL_COMPOSE_WIDTH) => {
  const n = Number(textLength) || 0;
  const s = bubbleScale(panelW);
  const { sizeBig, sizeNormal, sizeSmall } = BUBBLE_WEAVE_CONFIG.typography;
  let base = sizeNormal;
  if (n <= 6) base = sizeBig;
  else if (n <= 14) base = sizeNormal;
  else base = sizeSmall;
  return Math.max(10, Math.round(base * s));
};

/** 繁中語意分詞（Intl.Segmenter；不支援則逐字） */
export const segmentZhWords = (text) => {
  const raw = String(text || '');
  if (!raw) return [];
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      const seg = new Intl.Segmenter('zh-TW', { granularity: 'word' });
      return Array.from(seg.segment(raw)).map((s) => s.segment);
    }
  } catch {
    /* fall through */
  }
  return Array.from(raw);
};

/**
 * 自然語意斷行：依詞打包，避免「臭豆｜腐」
 * @returns {string[]}
 */
export const formatBubbleLines = (text, maxCharsPerLine = 10) => {
  const words = segmentZhWords(text);
  if (!words.length) return [];
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && cur.length + w.length > maxCharsPerLine) {
      lines.push(cur);
      cur = w;
    } else {
      cur += w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= HARD_MAX_BUBBLE_LINES) return lines;
  const kept = lines.slice(0, HARD_MAX_BUBBLE_LINES - 1);
  return [...kept, lines.slice(HARD_MAX_BUBBLE_LINES - 1).join('')];
};

/** 正規化人臉錨點（0～1）；無效則回 null */
export const sanitizeFace = (face) => {
  if (!face || typeof face !== 'object') return null;
  const x = Number(face.x);
  const y = Number(face.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const out = {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
  if (face.source) out.source = face.source;
  return out;
};

/**
 * 多人同框：依「畫面左→右」重配 face，修正 LLM 指錯人
 * （不可用 characterIds：總編輯卡常與 LEFT／RIGHT 不一致）
 */
export const reconcileBubbleFaces = (card, bubbles = []) => {
  if (!Array.isArray(bubbles) || bubbles.length < 2) return bubbles;
  const speakerIds = [...new Set(bubbles.map((b) => b.speakerId).filter(Boolean))];
  if (speakerIds.length < 2) return bubbles;

  const withFace = bubbles.filter((b) => b.face && typeof b.face.x === 'number');
  if (withFace.length < 2) return bubbles;

  const spatial = resolveSpatialOrder(card);
  const speakersLtr = [...speakerIds].sort((a, b) => {
    const ia = spatial.indexOf(a);
    const ib = spatial.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const facesLtr = withFace
    .map((b) => sanitizeFace(b.face))
    .filter(Boolean)
    .sort((a, b) => a.x - b.x || a.y - b.y);

  if (facesLtr.length < 2) return bubbles;

  const faceBySpeaker = new Map();
  speakersLtr.forEach((id, i) => {
    const face = facesLtr[Math.min(i, facesLtr.length - 1)];
    if (face) faceBySpeaker.set(id, face);
  });

  return bubbles.map((b) => {
    const face = faceBySpeaker.get(b.speakerId) || b.face;
    const slot =
      face && typeof face.x === 'number'
        ? face.x < 0.5
          ? 'top-left'
          : 'top-right'
        : b.slot;
    return { ...b, face, slot };
  });
};

/**
 * 正規化一格的 bubbles，補 slot／speaker／face，並強制錯開站位避免重疊
 * @param {object} card
 * @param {Array<{ speakerId?: string, speaker?: string, text?: string, slot?: string, face?: {x:number,y:number}, manualPos?: {x:number,y:number} }>} bubbles
 */
export const normalizePanelBubbles = (card, bubbles = []) => {
  const list = (Array.isArray(bubbles) ? bubbles : [])
    .map((b) => {
      const speakerId = b.speakerId || guessSpeakerId(card, b.speaker);
      const speaker =
        b.speaker ||
        CHARACTERS_BY_ID[speakerId]?.nameZh ||
        CHARACTERS_BY_ID[speakerId]?.name ||
        '';
      const text = clampBubbleText(b.text);
      if (!text) return null;
      const slot = b.slot || resolveSpeakerSlot(card, speakerId);
      const manualPos = sanitizeManualPos(b.manualPos);
      return {
        speakerId,
        speaker,
        text,
        slot,
        face: sanitizeFace(b.face),
        ...(manualPos ? { manualPos } : {}),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_BUBBLES_PER_PANEL);

  let placed;
  if (list.length <= 1) {
    placed = list.map((b) => ({
      ...b,
      slot: resolveSpeakerSlot(card, b.speakerId),
      stackIndex: 0,
    }));
  } else if (list.length === 2) {
    const spatial = resolveSpatialOrder(card);
    if (list[0].speakerId === list[1].speakerId) {
      placed = [
        { ...list[0], slot: 'top-left', stackIndex: 0 },
        { ...list[1], slot: 'top-right', stackIndex: 0 },
      ];
    } else {
      const ranked = [...list].sort((a, b) => {
        const ia = spatial.indexOf(a.speakerId);
        const ib = spatial.indexOf(b.speakerId);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      const leftSpeaker = ranked[0].speakerId;
      placed = list.map((b) => ({
        ...b,
        slot: b.speakerId === leftSpeaker ? 'top-left' : 'top-right',
        stackIndex: 0,
      }));
    }
  } else {
    // 3～4 人：依畫面左→右分左／中／右，避免被砍成兩句
    const spatial = resolveSpatialOrder(card);
    const ranked = [...list].sort((a, b) => {
      const ia = spatial.indexOf(a.speakerId);
      const ib = spatial.indexOf(b.speakerId);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    const slots =
      ranked.length === 3
        ? ['top-left', 'top-center', 'top-right']
        : ['top-left', 'top-left', 'top-right', 'top-right'];
    const slotOf = new Map(ranked.map((b, i) => [b.speakerId, slots[i] || 'top-right']));
    const used = {};
    placed = list.map((b) => {
      const slot = slotOf.get(b.speakerId) || 'top-right';
      used[slot] = (used[slot] || 0) + 1;
      return { ...b, slot, stackIndex: used[slot] - 1 };
    });
  }

  return reconcileBubbleFaces(card, placed);
};

const guessSpeakerId = (card, speakerName) => {
  if (!speakerName) return card?.characterIds?.[0] || '';
  const name = String(speakerName).trim().toLowerCase();
  const members = card?.castMembers || [];
  const hit = members.find(
    (m) =>
      m.nameZh?.toLowerCase() === name ||
      m.name?.toLowerCase() === name ||
      m.id === name
  );
  if (hit) return hit.id;
  const fromBible = Object.values(CHARACTERS_BY_ID).find(
    (c) => c.nameZh.toLowerCase() === name || c.name.toLowerCase() === name
  );
  return fromBible?.id || card?.characterIds?.[0] || '';
};

/** 純字串台詞 → 單氣泡（相容舊資料） */
export const bubblesFromPlainLine = (card, line) => {
  const text = clampBubbleText(extractSpokenCore(line));
  if (!text) return [];
  const speakerId = card?.characterIds?.[0] || '';
  return normalizePanelBubbles(card, [{ speakerId, text }]);
};

/** 從「Cindy：（開心）……」抽核心對白 */
const extractSpokenCore = (line) => {
  const raw = String(line || '').trim();
  if (!raw) return '';
  const m = raw.match(/[）)]\s*(.+)$/u) || raw.match(/[:：]\s*(.+)$/u);
  const core = (m ? m[1] : raw).split(/\n/)[0];
  return core.replace(/^[（(][^）)]*[）)]\s*/u, '').trim();
};

/**
 * @param {CanvasRenderingContext2D} ctx
 */
export const wrapBubbleLines = (ctx, text, maxWidth) => {
  const words = segmentZhWords(text);
  if (!words.length) return [];
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line + w;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
};

/** 行高倍數：定案 1.45（抗晃動） */
export const BUBBLE_LINE_HEIGHT = BUBBLE_WEAVE_CONFIG.typography.lineHeightRatio;

/** @deprecated 改用 MAX_TAIL_LENGTH（絕對 px） */
export const MAX_TAIL_RATIO = 0.25;

/** 多人尾巴最長 35px — 提示方位，不是指標線 */
export const MAX_TAIL_LENGTH = 35;

/** 單人分鏡：固定向下小鋸齒（不計算向量） */
export const MICRO_STUB_LENGTH = 15;

/** 尖端／框底相對頭頂外圍再上退，避免刺進頭髮／輪廓 */
export const HEAD_TOP_CLEARANCE = 24;

/** 頭高約佔格高比例（face.y＝臉心 → 頭頂 = face.y - headH/2） */
export const HEAD_HEIGHT_RATIO = 0.14;

/** 卡牌出場人數（單人＝微 stub） */
export const resolveCardPartySize = (card) => {
  const n = Number(card?.partySize);
  if (Number.isFinite(n) && n >= 1) return Math.min(4, Math.round(n));
  const ids = card?.characterIds || [];
  return Math.max(1, Math.min(4, ids.length || 1));
};

/** 人臉圓外再留 10px，對話框／尖端不得進入 */
export const FACE_OUTSIDE_GAP = 10;

/** 臉圓半徑（相對格短邊）— 只包頭，勿大到胸口 */
export const FACE_CIRCLE_RATIO = 0.1;

/**
 * LLM 全身構圖常把 face.y 報得偏低（落在胸）；基礎上移量
 * （除錯圖會同時標 RAW / CAL）
 */
export const FACE_Y_LIFT = 0.07;

/**
 * 依 raw.y 自適應上移：胸口多拉、頭部帶少動
 * solo 近景另見 remapFaceForPanel 的 partySize 加成
 */
export const faceYLiftFor = (y) => {
  const raw = Number(y);
  if (!Number.isFinite(raw)) return FACE_Y_LIFT;
  if (raw <= 0.28) return 0.04;
  if (raw <= 0.34) return 0.07;
  if (raw <= 0.4) return 0.1;
  return Math.min(0.14, raw - 0.31);
};

/**
 * 分鏡圖在格內的 contain 置中矩形（與 drawImage 一致）
 * face 正規化座標是相對「原圖」，必須先映射到此矩形
 */
export const resolveContentFit = (panelW, panelH, natW, natH) => {
  const iw = Math.max(1, Number(natW) || panelW);
  const ih = Math.max(1, Number(natH) || panelH);
  const scale = Math.min(panelW / iw, panelH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  return {
    dx: (panelW - dw) / 2,
    dy: (panelH - dh) / 2,
    dw,
    dh,
    scale,
    natW: iw,
    natH: ih,
  };
};

/** 原圖 0～1 → 格內像素 */
export const faceNormToPanelPx = (face, fit, panelW, panelH) => {
  const x = Number(face?.x);
  const y = Number(face?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (!fit) {
    return { x: x * panelW, y: y * panelH };
  }
  return {
    x: fit.dx + x * fit.dw,
    y: fit.dy + y * fit.dh,
  };
};

/** 原圖 0～1 → 校正後再映成「格內 0～1」（給 layout 用） */
export const remapFaceForPanel = (face, fit, panelW, panelH, opts = {}) => {
  if (!face) return null;
  const raw = {
    x: Math.min(1, Math.max(0, Number(face.x))),
    y: Math.min(1, Math.max(0, Number(face.y))),
  };
  // YOLO / MediaPipe 來源直接信任，不做額外上移
  let lift = 0;
  if (opts.lift != null) {
    lift = opts.lift;
  } else if (
    (typeof face.source === 'string' && face.source.startsWith('yolov8_animeface')) ||
    face.source === 'mediapipe'
  ) {
    lift = 0;
  } else if (face.source === 'heuristic') {
    lift = 0;
  } else {
    lift = faceYLiftFor(raw.y);
    const party = Number(opts.partySize);
    if (Number.isFinite(party) && party <= 1 && raw.y >= 0.3 && raw.y <= 0.38) {
      lift = Math.max(lift, 0.12);
    }
    if (Number.isFinite(party) && party >= 2 && raw.y >= 0.36 && raw.y <= 0.4) {
      lift = Math.min(lift, 0.06);
    }
  }
  const calImg = {
    x: raw.x,
    y: Math.min(0.95, Math.max(0.04, raw.y - lift)),
  };
  const px = faceNormToPanelPx(calImg, fit, panelW, panelH);
  if (!px) return { ...calImg, raw, calImg, lift, source: face.source };
  return {
    x: px.x / panelW,
    y: px.y / panelH,
    raw,
    calImg,
    px,
    lift,
    source: face.source,
  };
};

/**
 * 人臉圓：圆心＝face（鼻／眼中點），半徑依格尺寸
 */
export const resolveFaceCirclePx = (face, panelW, panelH) => {
  const cx = Number(face?.x) * panelW;
  const cy = Number(face?.y) * panelH;
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const r = Math.max(28, Math.min(panelW, panelH) * FACE_CIRCLE_RATIO);
  return { cx, cy, r };
};

/**
 * 人臉方框（除錯／禁區）：只包頭部，略含髮際
 */
export const resolveFaceBoxPx = (face, panelW, panelH) => {
  const c = resolveFaceCirclePx(face, panelW, panelH);
  if (!c) return null;
  const topExtra = c.r * 0.4;
  const botExtra = c.r * 0.05;
  return {
    x: c.cx - c.r,
    y: c.cy - c.r - topExtra,
    w: c.r * 2,
    h: c.r * 2 + topExtra + botExtra,
    cx: c.cx,
    cy: c.cy,
    r: c.r,
  };
};

/**
 * 嘴巴參照點：在臉圓圆心下方（LLM face 是鼻眼中點）
 */
export const resolveMouthPx = (face, panelW, panelH) => {
  const circle = resolveFaceCirclePx(face, panelW, panelH);
  if (!circle) return null;
  return {
    x: circle.cx,
    y: circle.cy + circle.r * 0.28,
    ...circle,
  };
};

/** @deprecated 改用 resolveFaceCirclePx／resolveMouthPx */
export const resolveHeadTopPx = (face, panelW, panelH) => {
  const c = resolveFaceCirclePx(face, panelW, panelH);
  if (!c) return null;
  return { x: c.cx, y: c.cy - c.r };
};

/**
 * 頭部禁區 AABB（相容舊呼叫）≈ 臉方框再外扩 gap
 */
export const headKeepoutRect = (face, panelW, panelH) => {
  const box = resolveFaceBoxPx(face, panelW, panelH);
  if (!box) {
    const fx = face.x * panelW;
    const fy = face.y * panelH;
    const headH = panelH * HEAD_HEIGHT_RATIO;
    return { x: fx - headH / 2, y: fy - headH * 0.6, w: headH, h: headH * 1.2 };
  }
  const g = FACE_OUTSIDE_GAP;
  return {
    x: box.x - g,
    y: box.y - g,
    w: box.w + g * 2,
    h: box.h + g * 2,
  };
};

const pointInRect = (px, py, r, pad = 0) =>
  px >= r.x - pad &&
  px <= r.x + r.w + pad &&
  py >= r.y - pad &&
  py <= r.y + r.h + pad;

const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** 圆心到矩形最近距離（在內＝0） */
const distCenterToRect = (cx, cy, rect) => {
  const qx = clampNum(cx, rect.x, rect.x + rect.w);
  const qy = clampNum(cy, rect.y, rect.y + rect.h);
  return Math.hypot(cx - qx, cy - qy);
};

const rectHitsSafeCircle = (rect, cx, cy, safeR) => distCenterToRect(cx, cy, rect) < safeR - 0.5;

/** 矩形是否侵入臉方框（已含 gap 的 keepout） */
const rectHitsFaceBox = (rect, keepout) => overlapArea(rect, keepout) > 1;

const distPointToRect = (px, py, rect) => {
  const qx = clampNum(px, rect.x, rect.x + rect.w);
  const qy = clampNum(py, rect.y, rect.y + rect.h);
  return Math.hypot(px - qx, py - qy);
};

/**
 * 尖端沿 root→target，停在臉圓外圍（不進圓）
 */
const clampTipOutsideCircle = (rootX, rootY, targetX, targetY, cx, cy, r, maxLen) => {
  const dx = targetX - rootX;
  const dy = targetY - rootY;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  let len = Math.min(dist, maxLen);
  let tipX = rootX + ux * len;
  let tipY = rootY + uy * len;
  // 若尖端進圓，縮到圓外
  for (let i = 0; i < 12; i += 1) {
    if (Math.hypot(tipX - cx, tipY - cy) >= r + 1) break;
    len = Math.max(4, len * 0.75);
    tipX = rootX + ux * len;
    tipY = rootY + uy * len;
  }
  if (Math.hypot(tipX - cx, tipY - cy) < r + 1) {
    // 改放在「圆心→root」反方向圓上靠近嘴巴的外側點
    const fromC = Math.hypot(rootX - cx, rootY - cy) || 1;
    tipX = cx + ((rootX - cx) / fromC) * (r + 1);
    tipY = cy + ((rootY - cy) / fromC) * (r + 1);
  }
  return { tipX, tipY };
};

/**
 * 漫畫級尾巴：瞄嘴巴；尖端停在臉圓外；單人微 stub
 */
export const resolveMangaTail = ({
  x,
  y,
  w,
  h,
  face = null,
  panelW,
  panelH,
  partySize = 2,
}) => {
  const mouth = face ? resolveMouthPx(face, panelW, panelH) : null;
  const circle = face ? resolveFaceCirclePx(face, panelW, panelH) : null;
  const aimX = mouth ? mouth.x : x + w / 2;
  const aimY = mouth ? mouth.y : y + h + MAX_TAIL_LENGTH;

  if (partySize <= 1) {
    const rootX = x + w / 2;
    const rootY = y + h;
    let tipX = rootX;
    let tipY = rootY + MICRO_STUB_LENGTH;
    if (circle) {
      const t = clampTipOutsideCircle(
        rootX,
        rootY,
        aimX,
        aimY,
        circle.cx,
        circle.cy,
        circle.r,
        MICRO_STUB_LENGTH
      );
      tipX = t.tipX;
      tipY = t.tipY;
    }
    // 尖端也不得進入臉方框（含 10px）
    const keep = face ? headKeepoutRect(face, panelW, panelH) : null;
    if (keep && tipY > keep.y - 1 && tipX >= keep.x && tipX <= keep.x + keep.w) {
      tipY = keep.y - 1;
    }
    if (tipY < rootY + 4) tipY = rootY + 4;
    return { rootX, rootY, tipX, tipY, mode: 'stub', aimX, aimY };
  }

  const preferBottom = aimY >= y + h * 0.45;
  const rootX = Math.min(x + w - 16, Math.max(x + 16, aimX));
  const rootY = preferBottom ? y + h : y;
  const maxLen = MAX_TAIL_LENGTH;
  if (!circle) {
    const dx = aimX - rootX;
    const dy = aimY - rootY;
    const dist = Math.hypot(dx, dy) || 1;
    const len = Math.min(dist, maxLen);
    return {
      rootX,
      rootY,
      tipX: rootX + (dx / dist) * len,
      tipY: rootY + (dy / dist) * len,
      mode: 'vector',
      aimX,
      aimY,
    };
  }
  const tip = clampTipOutsideCircle(
    rootX,
    rootY,
    aimX,
    aimY,
    circle.cx,
    circle.cy,
    circle.r,
    maxLen
  );
  let tipX = tip.tipX;
  let tipY = tip.tipY;
  const keep = face ? headKeepoutRect(face, panelW, panelH) : null;
  if (keep && tipY > keep.y - 1 && tipX >= keep.x && tipX <= keep.x + keep.w) {
    tipY = keep.y - 1;
  }
  // 禁區修正後仍不得超過最大尾長
  {
    const dx = tipX - rootX;
    const dy = tipY - rootY;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > maxLen) {
      tipX = rootX + (dx / dist) * maxLen;
      tipY = rootY + (dy / dist) * maxLen;
    }
  }
  return { rootX, rootY, tipX, tipY, mode: 'vector', aimX, aimY };
};

/**
 * Hug Contents：字少框緊、字多框展開；字級／padding／min-max 寬依定案等比
 * @param {CanvasRenderingContext2D} ctx
 */
export const fitBubbleTypography = (ctx, text, maxBoxW, opts = {}) => {
  const panelW = opts.panelW || MANGA_PANEL_COMPOSE_WIDTH;
  const s = bubbleScale(panelW);
  const cfg = BUBBLE_WEAVE_CONFIG.bubbleCard;
  const padX = opts.padX ?? Math.round(cfg.paddingX * s);
  const padY = opts.padY ?? Math.round(cfg.paddingY * s);
  const minW = Math.round(cfg.minWidth * s);
  const hardMaxW = Math.round(cfg.maxWidth * s);
  const boxMax = Math.min(maxBoxW, hardMaxW);
  const minFont = opts.minFont ?? Math.max(10, Math.round(BUBBLE_WEAVE_CONFIG.typography.sizeSmall * s * 0.85));
  const suggested = getBubbleFontPx(String(text || '').length, panelW);
  const maxFont = opts.maxFont ?? Math.max(suggested, minFont);
  const softMaxLines = opts.maxLines ?? MAX_BUBBLE_LINES;
  const hardMaxLines = opts.hardMaxLines ?? HARD_MAX_BUBBLE_LINES;
  const innerMax = Math.max(48, boxMax - padX * 2);
  const lh = BUBBLE_LINE_HEIGHT;

  const pack = (font, lines) => {
    const lineH = Math.round(font * lh);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 24);
    const contentW = Math.ceil(widest + padX * 2);
    const boxW = Math.min(boxMax, Math.max(minW, contentW));
    return {
      font,
      lineH,
      lines,
      textW: widest,
      padX,
      padY,
      panelW,
      boxW,
      boxH: Math.ceil(lines.length * lineH + padY * 2),
    };
  };

  for (let font = maxFont; font >= minFont; font -= 1) {
    ctx.font = `700 ${font}px ${FONT}`;
    const lines = wrapBubbleLines(ctx, text, innerMax);
    if (lines.length <= softMaxLines) return pack(font, lines);
  }

  for (let font = maxFont; font >= minFont; font -= 1) {
    ctx.font = `700 ${font}px ${FONT}`;
    const lines = wrapBubbleLines(ctx, text, innerMax);
    if (lines.length <= hardMaxLines) return pack(font, lines);
  }

  ctx.font = `700 ${minFont}px ${FONT}`;
  let lines = wrapBubbleLines(ctx, text, innerMax);
  if (lines.length > hardMaxLines) {
    const kept = lines.slice(0, hardMaxLines - 1);
    lines = [...kept, lines.slice(hardMaxLines - 1).join('')];
  }
  return pack(minFont, lines);
};

/** AABB 是否重疊（含 pad） */
const rectsOverlap = (a, b, pad = 0) =>
  !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  );

/**
 * 臉／頭禁區
 * @param {{x:number,y:number}} face 正規化 0～1
 */
export const faceExclusionRect = (face, panelW, panelH) => {
  const fx = face.x * panelW;
  const fy = face.y * panelH;
  const zw = panelW * 0.3;
  const zh = panelH * 0.24;
  return {
    x: fx - zw / 2,
    y: fy - zh * 0.65,
    w: zw,
    h: zh,
  };
};

/**
 * 軀幹禁區（胸口／肚腹）— 避開「蓋在腰上」
 */
export const bodyExclusionRect = (face, panelW, panelH) => {
  const fx = face.x * panelW;
  const fy = face.y * panelH;
  const zw = panelW * 0.36;
  const zh = panelH * 0.4;
  return {
    x: fx - zw / 2,
    y: fy + panelH * 0.04,
    w: zw,
    h: zh,
  };
};

const clampBubbleXY = (x, y, w, h, panelW, panelH, margin) => ({
  x: Math.max(margin, Math.min(panelW - margin - w, x)),
  y: Math.max(margin, Math.min(panelH - margin - h, y)),
});

const overlapArea = (a, b) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
};

/**
 * 四象限：本體放乾淨區，尾巴另指向 face（解耦）
 */
export const resolveBubbleQuadrant = (bubble, total = 1) => {
  const face = bubble.face;
  const fx = face?.x;
  const fy = face?.y;
  const stack = bubble.stackIndex || 0;

  if (total >= 2) {
    // 雙人：以臉的左右為準（reconcile 後 slot 也會對齊）；勿再走對側候選
    const onRight =
      typeof fx === 'number' ? fx >= 0.5 : bubble.slot === 'top-right';
    return {
      region: onRight ? 'top-right' : 'top-left',
      onRight,
      // 僅臉貼頂時才改放下（0.32 太鬆，會把氣泡甩到胸口）
      placeBelow: typeof fy === 'number' ? fy < 0.18 : false,
      face: face || null,
      stack,
    };
  }

  // 單氣泡：框放在「臉同側」（勿對側，否則尾巴斜穿、看起來指錯人）
  if (typeof fy === 'number' && fy < 0.18) {
    const onRight = typeof fx === 'number' ? fx >= 0.5 : true;
    return {
      region: onRight ? 'below-right' : 'below-left',
      onRight,
      placeBelow: true,
      face: face || null,
      stack,
    };
  }

  const onRight =
    typeof fx === 'number' ? fx >= 0.5 : bubble.slot === 'top-right';
  return {
    region: onRight ? 'top-right' : 'top-left',
    onRight,
    placeBelow: false,
    face: face || null,
    stack,
  };
};

/**
 * 計算氣泡矩形 + 漫畫級短尾巴
 * 人臉＝圓；參照＝嘴巴；對話框在圓外 FACE_OUTSIDE_GAP(10px)，並盡量靠近嘴巴
 */
export const layoutBubbleRect = (
  panelW,
  panelH,
  bubble,
  typo,
  peers = [],
  faceZones = [],
  totalBubbles = 0,
  partySize = 2
) => {
  const margin = Math.max(
    4,
    Math.round(BUBBLE_WEAVE_CONFIG.canvas.margin * bubbleScale(panelW))
  );
  const total = Math.max(1, totalBubbles || peers.length + 1);
  const solo = partySize <= 1;
  const q = resolveBubbleQuadrant(bubble, solo ? 1 : Math.max(total, 2));
  const sideMax = bubbleSideMaxRatio();
  const w = Math.min(typo.boxW, panelW * sideMax);
  const h = typo.boxH;
  const stack = (q.stack || 0) * Math.max(h + 8, panelH * 0.035);
  const leftX = margin;
  const rightX = panelW - margin - w;

  // 使用者手動位置：跳過自動站位，仍算尾巴指向臉
  const manual = sanitizeManualPos(bubble.manualPos);
  if (manual) {
    const clamped = clampBubbleXY(
      manual.x * panelW,
      manual.y * panelH,
      w,
      h,
      panelW,
      panelH,
      margin
    );
    const tail = resolveMangaTail({
      x: clamped.x,
      y: clamped.y,
      w,
      h,
      face: q.face,
      panelW,
      panelH,
      partySize,
    });
    return {
      x: clamped.x,
      y: clamped.y,
      w,
      h,
      slot: bubble.slot,
      tailX: tail.rootX,
      rootX: tail.rootX,
      rootY: tail.rootY,
      tipX: tail.tipX,
      tipY: tail.tipY,
      tailMode: tail.mode,
      placeBelow: tail.rootY <= clamped.y + 1,
      manual: true,
    };
  }

  const circle = q.face ? resolveFaceCirclePx(q.face, panelW, panelH) : null;
  const mouth = q.face ? resolveMouthPx(q.face, panelW, panelH) : null;
  const faceBox = q.face ? resolveFaceBoxPx(q.face, panelW, panelH) : null;
  const primaryKeepout = q.face ? headKeepoutRect(q.face, panelW, panelH) : null;

  // 禁區：本說話者＋同格其他人臉方框（外扩 10px）
  const keepouts = [];
  if (primaryKeepout) keepouts.push(primaryKeepout);
  for (const z of faceZones) {
    if (!z) continue;
    if (typeof z.x === 'number' && typeof z.w === 'number') {
      keepouts.push(z);
    } else if (typeof z.cx === 'number') {
      const g = FACE_OUTSIDE_GAP;
      keepouts.push({
        x: z.cx - z.r - g,
        y: z.cy - z.r - g,
        w: (z.r + g) * 2,
        h: (z.r + g) * 2,
      });
    }
  }

  const hitsKeepout = (rect) => keepouts.some((k) => rectHitsFaceBox(rect, k));

  const scoreCandidate = (rawX, rawY, bias = 0) => {
    const { x, y } = clampBubbleXY(rawX, rawY, w, h, panelW, panelH, margin);
    const rect = { x, y, w, h };
    let score = bias;
    if (hitsKeepout(rect)) score += 200000;
    for (const p of peers) {
      score += overlapArea(rect, p) * 0.2;
      if (rectsOverlap(rect, p, 8)) score += 800;
    }
    if (mouth) {
      // 核心：離嘴巴越近越好
      score += distPointToRect(mouth.x, mouth.y, rect) * 2.2;
    }
    if (!solo && total >= 2 && circle) {
      const midX = x + w / 2;
      if (q.onRight && midX < panelW * 0.5) score += 900;
      if (!q.onRight && midX > panelW * 0.5) score += 900;
    }
    // 略偏好在臉框上方
    if (faceBox && y + h > faceBox.y) score += 20;
    return { x, y, w, h, score };
  };

  const ranked = [];

  if (faceBox && mouth && primaryKeepout) {
    // 臉框四邊外側錨點（圓外／框外 10px 已含在 keepout）
    const topY = primaryKeepout.y - h - stack;
    const botY = primaryKeepout.y + primaryKeepout.h + stack;
    const midY = mouth.y - h / 2;
    // 鏡子／偏左臉：氣泡跟說話者同側，避免蓋到另一側倒影
    const sideBiasLeft = mouth.x < panelW * 0.42 ? -35 : 0;
    const sideBiasRight = mouth.x > panelW * 0.58 ? -35 : 0;
    ranked.push(scoreCandidate(mouth.x - w / 2, topY, -100)); // 正上方優先（多數情況要更高）
    ranked.push(scoreCandidate(mouth.x - w / 2, Math.max(margin, topY - h * 0.35), -70));
    ranked.push(scoreCandidate(primaryKeepout.x - w, midY, -15 + sideBiasLeft));
    ranked.push(scoreCandidate(primaryKeepout.x + primaryKeepout.w, midY, -15 + sideBiasRight));
    ranked.push(scoreCandidate(mouth.x - w / 2, botY, 60));

    // 沿臉框頂邊密採樣（偏上）
    for (let t = 0; t <= 1.0001; t += 0.1) {
      ranked.push(
        scoreCandidate(
          primaryKeepout.x + primaryKeepout.w * t - w / 2,
          primaryKeepout.y - h - stack,
          -50
        )
      );
      ranked.push(
        scoreCandidate(primaryKeepout.x - w, primaryKeepout.y + primaryKeepout.h * t - h / 2, 10)
      );
      ranked.push(
        scoreCandidate(
          primaryKeepout.x + primaryKeepout.w,
          primaryKeepout.y + primaryKeepout.h * t - h / 2,
          10
        )
      );
    }
  } else {
    ranked.push(scoreCandidate(q.onRight ? rightX : leftX, margin, 0));
  }

  ranked.push(scoreCandidate(leftX, margin, 120));
  ranked.push(scoreCandidate(rightX, margin, 120));

  ranked.sort((a, b) => a.score - b.score);
  let best =
    ranked.find((c) => !hitsKeepout(c)) ||
    ranked[0] || {
      x: q.onRight ? rightX : leftX,
      y: margin,
      w,
      h,
    };

  // 硬推：若仍撞臉框 → 強制到臉框正上方
  if (primaryKeepout && hitsKeepout(best)) {
    let fixed = clampBubbleXY(
      (mouth?.x ?? primaryKeepout.x + primaryKeepout.w / 2) - w / 2,
      primaryKeepout.y - h - 2,
      w,
      h,
      panelW,
      panelH,
      margin
    );
    if (hitsKeepout({ ...fixed, w, h })) {
      const midY = mouth ? mouth.y - h / 2 : primaryKeepout.y;
      const tryL = clampBubbleXY(primaryKeepout.x - w - 2, midY, w, h, panelW, panelH, margin);
      const tryR = clampBubbleXY(
        primaryKeepout.x + primaryKeepout.w + 2,
        midY,
        w,
        h,
        panelW,
        panelH,
        margin
      );
      if (!hitsKeepout({ ...tryL, w, h })) fixed = tryL;
      else if (!hitsKeepout({ ...tryR, w, h })) fixed = tryR;
      else fixed = clampBubbleXY(fixed.x, margin, w, h, panelW, panelH, margin);
    }
    best = { ...best, ...fixed };
  }

  const tail = resolveMangaTail({
    x: best.x,
    y: best.y,
    w: best.w,
    h: best.h,
    face: q.face,
    panelW,
    panelH,
    partySize,
  });

  return {
    x: best.x,
    y: best.y,
    w: best.w,
    h: best.h,
    slot: bubble.slot,
    tailX: tail.rootX,
    rootX: tail.rootX,
    rootY: tail.rootY,
    tipX: tail.tipX,
    tipY: tail.tipY,
    tailMode: tail.mode,
    placeBelow: tail.rootY <= best.y + 1,
  };
};

/**
 * CSS 百分比版 — 與 Canvas 相同：臉遠則下沉，避免雷射尾巴
 */
export const layoutBubbleCss = (bubble, index = 0, total = 1, partySize = 1) => {
  const q = resolveBubbleQuadrant(bubble, total);
  const side = bubbleSideMaxRatio();
  const maxWidth = `${Math.round(side * 100)}%`;
  const stackPct = q.stack * 8;
  const face = q.face;
  const fontPx = getBubbleFontPx(bubble.text?.length || 0, MANGA_PANEL_COMPOSE_WIDTH);
  const halfW = side * 50;

  const manual = sanitizeManualPos(bubble.manualPos);
  if (manual) {
    return {
      top: `${manual.y * 100}%`,
      left: `${manual.x * 100}%`,
      right: 'auto',
      bottom: 'auto',
      maxWidth,
      transform: 'none',
      fontPx,
      face,
      placeBelow: false,
      manual: true,
    };
  }

  if (q.placeBelow && face) {
    const leftPct = Math.max(2, Math.min(98 - halfW * 2, face.x * 100 - halfW));
    return {
      top: `${Math.min(70, face.y * 100 + 5 + stackPct)}%`,
      left: `${leftPct}%`,
      right: 'auto',
      bottom: 'auto',
      maxWidth,
      transform: 'none',
      fontPx,
      face,
      placeBelow: true,
    };
  }

  // 頭頂正上方（垂直尾巴）— face.y > 0.2
  if (face && face.y > 0.2) {
    const leftPct = Math.max(2, Math.min(98 - halfW * 2, face.x * 100 - halfW));
    const top = Math.max(2, face.y * 100 - 22 - stackPct);
    return {
      top: `${top}%`,
      left: `${leftPct}%`,
      right: 'auto',
      bottom: 'auto',
      maxWidth,
      transform: 'none',
      fontPx,
      face,
      placeBelow: false,
    };
  }

  return {
    top: `${1.5 + stackPct}%`,
    left: q.onRight ? 'auto' : '2%',
    right: q.onRight ? '2%' : 'auto',
    bottom: 'auto',
    maxWidth,
    transform: 'none',
    fontPx,
    face: face || null,
    placeBelow: false,
  };
};

/**
 * 尾巴幾何（SVG 預覽）— 與 Canvas 同一套 resolveMangaTail
 */
export const buildTailGeometry = (
  rootX,
  rootY,
  tipX,
  tipY,
  half = 9
) => {
  const dx = tipX - rootX;
  const dy = tipY - rootY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const b1x = rootX + nx * half;
  const b1y = rootY + ny * half;
  const b2x = rootX - nx * half;
  const b2y = rootY - ny * half;
  return {
    b1x,
    b1y,
    b2x,
    b2y,
    tipX,
    tipY,
    fillD: `M ${b1x} ${b1y} L ${tipX} ${tipY} L ${b2x} ${b2y} Z`,
    strokeD: `M ${b1x} ${b1y} L ${tipX} ${tipY} L ${b2x} ${b2y}`,
  };
};

/**
 * 圓角矩形＋尾巴一次閉合路徑（無疊加接縫）
 */
const traceBubbleWithTail = (ctx, x, y, w, h, r, tipX, tipY) => {
  const rr = Math.min(r, w / 2, h / 2);
  const half = Math.min(10, w * 0.12);
  const cx = x + w / 2;
  const cy = y + h / 2;
  // 尾巴接在離 tip 最近的邊
  const toTop = Math.abs(tipY - y);
  const toBottom = Math.abs(tipY - (y + h));
  const toLeft = Math.abs(tipX - x);
  const toRight = Math.abs(tipX - (x + w));
  const edge = Math.min(toTop, toBottom, toLeft, toRight);

  ctx.moveTo(x + rr, y);

  if (edge === toTop && tipY <= cy) {
    const ax = Math.min(x + w - rr - half, Math.max(x + rr + half, tipX));
    ctx.lineTo(ax - half, y);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(ax + half, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
  } else if (edge === toBottom || tipY >= cy) {
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    const ax = Math.min(x + w - rr - half, Math.max(x + rr + half, tipX));
    ctx.lineTo(ax + half, y + h);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(ax - half, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
  } else if (edge === toRight) {
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    const ay = Math.min(y + h - rr - half, Math.max(y + rr + half, tipY));
    ctx.lineTo(x + w, ay - half);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(x + w, ay + half);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
  } else {
    const ay = Math.min(y + h - rr - half, Math.max(y + rr + half, tipY));
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, ay + half);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(x, ay - half);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
  }
  ctx.closePath();
};

/**
 * 畫對話框：無尾巴純白圓角卡片（定案描邊／圓角／padding）
 */
export const drawSpeechBubble = (ctx, rect, typo) => {
  const { x, y, w, h } = rect;
  const panelW = typo.panelW || rect.panelW || MANGA_PANEL_COMPOSE_WIDTH;
  const s = bubbleScale(panelW);
  const cfg = BUBBLE_WEAVE_CONFIG.bubbleCard;
  const r = Math.min(cfg.borderRadius * s, w / 2, h / 2);
  const lw = Math.max(1.5, cfg.strokeWidth * s);
  const padY = typo.padY ?? Math.round(cfg.paddingY * s);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = lw;
  ctx.fillStyle = WHITE;
  ctx.strokeStyle = INK;

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = BUBBLE_WEAVE_CONFIG.typography.textColor;
  ctx.font = `700 ${typo.font}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let ty = y + padY;
  for (const line of typo.lines) {
    ctx.fillText(line, x + w / 2, ty);
    ty += typo.lineH;
  }
  ctx.restore();
};

/**
 * 除錯標記：臉方框＋嘴巴＋數值座標＋content-fit 區
 */
export const drawFaceDebugMarkers = (
  ctx,
  imgX,
  imgY,
  imgW,
  imgH,
  bubbles = [],
  opts = {}
) => {
  const fit = opts.contentFit || null;

  if (fit) {
    ctx.save();
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(imgX + fit.dx, imgY + fit.dy, fit.dw, fit.dh);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.95)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `FIT dx=${fit.dx.toFixed(0)} dy=${fit.dy.toFixed(0)} ${fit.dw.toFixed(0)}x${fit.dh.toFixed(0)} img=${fit.natW}x${fit.natH}`,
      imgX + 4,
      imgY + 4
    );
    ctx.restore();
  }

  for (const b of bubbles) {
    if (!b?.face) continue;
    const box = resolveFaceBoxPx(b.face, imgW, imgH);
    const mouth = resolveMouthPx(b.face, imgW, imgH);
    const keep = headKeepoutRect(b.face, imgW, imgH);
    if (!box || !mouth) continue;

    ctx.save();
    // 安全外扩框（虛線）
    ctx.strokeStyle = 'rgba(255, 80, 0, 0.95)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(imgX + keep.x, imgY + keep.y, keep.w, keep.h);
    ctx.setLineDash([]);

    // 臉方框（實線紅）
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(imgX + box.x, imgY + box.y, box.w, box.h);

    // face 圆心
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.arc(imgX + box.cx, imgY + box.cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // 嘴巴十字
    const mx = imgX + mouth.x;
    const my = imgY + mouth.y;
    ctx.strokeStyle = '#06b6d4';
    ctx.fillStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(mx - 10, my);
    ctx.lineTo(mx + 10, my);
    ctx.moveTo(mx, my - 10);
    ctx.lineTo(mx, my + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
    ctx.fill();

    const raw = b.faceRaw || b.face;
    const src =
      b.faceRaw?.source || b._faceMeta?.source || b.face?.source || 'unknown';
    const lines = [
      `FACE ${b.speakerId || ''} src=${src}`,
      `raw(${Number(raw?.x).toFixed(2)},${Number(raw?.y).toFixed(2)})`,
      `cal(${Number(b.face.x).toFixed(2)},${Number(b.face.y).toFixed(2)})`,
      `px(${box.cx.toFixed(0)},${box.cy.toFixed(0)}) r=${box.r.toFixed(0)}`,
      `mouth(${mouth.x.toFixed(0)},${mouth.y.toFixed(0)})`,
    ];
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let ty = imgY + Math.max(4, box.y - 2 - lines.length * 12);
    for (const line of lines) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const tw = ctx.measureText(line).width + 6;
      ctx.fillRect(imgX + box.x, ty - 1, tw, 12);
      ctx.fillStyle = line.startsWith('mouth') ? '#0e7490' : '#be123c';
      ctx.fillText(line, imgX + box.x + 3, ty);
      ty += 12;
    }
    ctx.restore();
  }
};

/**
 * 與 Canvas 壓圖同一套排版（位置／字級／換行），供預覽拖曳對齊合成圖
 * @returns {Array<{ bubble: object, typo: object, layout: object }>}
 */
export const layoutPanelBubbles = (panelW, panelH, bubbles, opts = {}) => {
  if (!bubbles?.length || panelW < 2 || panelH < 2) return [];
  if (typeof document === 'undefined') return [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const partySize = Math.max(1, Number(opts.partySize) || 2);
  const fit = opts.contentFit || null;

  const mapped = bubbles.map((b) => {
    if (!b?.face) return b;
    const remapped = remapFaceForPanel(b.face, fit, panelW, panelH, {
      partySize,
    });
    return {
      ...b,
      face: remapped
        ? { x: remapped.x, y: remapped.y, source: remapped.source || b.face?.source }
        : b.face,
    };
  });

  const faceZones = mapped
    .map((b) => (b.face ? headKeepoutRect(b.face, panelW, panelH) : null))
    .filter(Boolean);

  const placed = [];
  const total = mapped.length;
  const out = [];
  for (const bubble of mapped) {
    const maxBoxW = panelW * bubbleSideMaxRatio();
    const typo = fitBubbleTypography(ctx, bubble.text, maxBoxW, { panelW });
    const local = layoutBubbleRect(
      panelW,
      panelH,
      bubble,
      typo,
      placed,
      faceZones,
      total,
      partySize
    );
    placed.push(local);
    out.push({ bubble, typo, layout: local });
  }
  return out;
};

/**
 * 在已繪好的分鏡圖上壓對話框
 * @param {object} [opts]
 * @param {number} [opts.partySize]
 * @param {boolean} [opts.debugFaces] 畫臉框＋嘴巴＋座標
 * @param {{dx:number,dy:number,dw:number,dh:number,natW?:number,natH?:number}|null} [opts.contentFit]
 */
export const paintBubblesOnImage = (
  ctx,
  imgX,
  imgY,
  imgW,
  imgH,
  bubbles,
  opts = {}
) => {
  if (!bubbles?.length) return;
  const debugFaces = Boolean(opts.debugFaces);
  const fit = opts.contentFit || null;
  const partySize = Math.max(1, Number(opts.partySize) || 2);

  if (debugFaces) {
    const mapped = bubbles.map((b) => {
      if (!b?.face) return b;
      const remapped = remapFaceForPanel(b.face, fit, imgW, imgH, { partySize });
      return {
        ...b,
        faceRaw: b.face,
        face: remapped
          ? { x: remapped.x, y: remapped.y, source: remapped.source || b.face?.source }
          : b.face,
        _faceMeta: remapped,
      };
    });
    drawFaceDebugMarkers(ctx, imgX, imgY, imgW, imgH, mapped, { contentFit: fit });
  }

  const results = layoutPanelBubbles(imgW, imgH, bubbles, opts);
  for (const { typo, layout: local } of results) {
    drawSpeechBubble(
      ctx,
      {
        x: imgX + local.x,
        y: imgY + local.y,
        w: local.w,
        h: local.h,
        slot: local.slot,
        tailX: imgX + local.tailX,
        rootX: imgX + local.rootX,
        rootY: imgY + local.rootY,
        tipX: imgX + local.tipX,
        tipY: imgY + local.tipY,
      },
      typo
    );
  }
};

const loadImage = (src) =>
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

/**
 * 單格：無字純圖 + 對話框 → 合成 dataURL（最終漫畫格）
 * High-DPI：依 devicePixelRatio 放大畫布，邏輯座標仍為 width×height
 */
export const composePanelImage = async (card, bubbles = [], opts = {}) => {
  const width = opts.width || MANGA_PANEL_COMPOSE_WIDTH;
  const height = opts.height || Math.round(width * MANGA_PANEL_ASPECT);
  const mime = opts.mime || 'image/png';
  const quality = opts.quality ?? 0.95;
  const dpr = Math.min(
    2.5,
    opts.dpr ??
      (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  );

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法建立畫布');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = '#ebe8e0';
  ctx.fillRect(0, 0, width, height);

  let contentFit = resolveContentFit(width, height, width, height);
  if (card?.imageUrl) {
    try {
      const img = await loadImage(card.imageUrl);
      contentFit = resolveContentFit(
        width,
        height,
        img.naturalWidth,
        img.naturalHeight
      );
      ctx.save();
      ctx.filter = 'grayscale(1)';
      ctx.drawImage(
        img,
        contentFit.dx,
        contentFit.dy,
        contentFit.dw,
        contentFit.dh
      );
      ctx.restore();
    } catch {
      /* keep bg */
    }
  }

  const normalized = normalizePanelBubbles(card, bubbles);
  paintBubblesOnImage(ctx, 0, 0, width, height, normalized, {
    partySize: resolveCardPartySize(card),
    debugFaces: Boolean(opts.debugFaces),
    contentFit,
  });

  if (mime === 'image/jpeg') {
    return canvas.toDataURL('image/jpeg', quality);
  }
  return canvas.toDataURL('image/png');
};

/**
 * 多格一次合成（匯出前）
 * @param {object[]} cards
 * @param {object[][]} panelBubbles
 */
export const composeAllPanels = async (cards, panelBubbles = []) => {
  const out = [];
  for (let i = 0; i < cards.length; i += 1) {
    const bubbles = panelBubbles[i]?.length
      ? panelBubbles[i]
      : bubblesFromPlainLine(cards[i], '');
    const dataUrl = await composePanelImage(cards[i], bubbles);
    out.push({ ...cards[i], imageUrl: dataUrl, composed: true });
  }
  return out;
};

/** bubbles → 顯示用短字串 */
export const bubblesToDisplayLine = (bubbles = []) =>
  bubbles
    .map((b) => (b.speaker ? `${b.speaker}：${b.text}` : b.text))
    .filter(Boolean)
    .join('／');
