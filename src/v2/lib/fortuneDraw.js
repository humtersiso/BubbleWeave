import seasonTaiwan from '../../../data/generated/season-taiwan-diverse.json';
import { createId } from '../../lib/storage.js';
import { createCardFromSeasonEntry, rollPartyIncludingPlayer } from '../../lib/warehouse.js';
import {
  generateJsonText,
  getInkOnlyStyleLock,
  hasApiKey,
} from '../../lib/gemini.js';
import { attachFacesToBubbles } from '../../lib/faceDetection.js';
import { bubblesFromPlainLine } from '../../lib/speechBubble.js';
import { PLAYER_ID } from '../../lib/playerCharacter.js';
import { CHARACTERS_BY_ID } from '../../lib/casts.js';
import {
  CATEGORY_BY_ID,
  FORTUNE_BY_ID,
  rollFortuneTier,
} from '../data/fortune.js';
import {
  applyColorStyle,
  colorStyleStatus,
  DEFAULT_COLOR_STYLE,
  normalizeColorStyle,
} from './colorStyles.js';

const seasonCards = () =>
  Array.isArray(seasonTaiwan?.cards) ? seasonTaiwan.cards : Array.isArray(seasonTaiwan) ? seasonTaiwan : [];

/**
 * 類別 → 場景關鍵字（輕量偏置，不要鎖死）
 * 命中只加權重，未命中仍可被抽到
 */
export const CATEGORY_SCENE_HINTS = {
  career: ['捷運', '公車', '超商', '咖啡', '排隊', '辦公室', '學校', '圖書館', '通勤', '夜市', '早餐'],
  love: ['101', '夜市', '咖啡', '河岸', '公園', '街道', '捷運', '電影院', '商圈', '天橋'],
  health: ['公園', '運動', '爬山', '健走', '夜市', '排隊', '登山', '河濱', '健身房'],
  wealth: ['夜市', '商店', '百貨', '超商', '市場', '排隊', '攤', '商場'],
  social: ['捷運', '夜市', '餐廳', '聚會', '朋友', '排隊', 'KTV', '派對', '公車'],
};

const scoreSeasonEntry = (entry, categoryId) => {
  const hints = CATEGORY_SCENE_HINTS[categoryId] || [];
  if (!hints.length) return 1;
  const text = `${entry?.scene_zh || ''}${entry?.action_zh || ''}${entry?.universal_slot_id || ''}`;
  let hits = 0;
  for (const h of hints) {
    if (text.includes(h)) hits += 1;
  }
  // 輕量：基礎 1，每命中 +1.2（占比不要太高）
  return 1 + hits * 1.2;
};

/** 依類別輕量加權抽場景；無類別則均勻隨機 */
export const pickSeasonEntry = (categoryId = null) => {
  const pool = seasonCards();
  if (!pool.length) throw new Error('總編輯卡池為空，請先 npm run create-season');
  if (!categoryId || !CATEGORY_SCENE_HINTS[categoryId]) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const weighted = pool.map((e) => ({ e, w: scoreSeasonEntry(e, categoryId) }));
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const row of weighted) {
    r -= row.w;
    if (r <= 0) return row.e;
  }
  return weighted[weighted.length - 1].e;
};

const castDisplayNames = (characterIds = [], playerProfile = null) =>
  (characterIds || []).map((id) => {
    if (id === PLAYER_ID) return playerProfile?.displayName || '我';
    return CHARACTERS_BY_ID[id]?.nameZh || id;
  });

export const DIALOGUE_MAX_CHARS = 36;
const SENTENCE_END_RE = /[。！？…～!?]$/u;
const DANGLING_TAIL_RE = /(?:也|且|但|而|就|又|還|像|跟|和|與|或|在|把|被|讓|令|並|並且|而且|但是|然而|如果|雖然)$/u;

/**
 * 對白字數裁切：盡量保留完整句尾，避免逗號半句
 * @param {string} s
 * @param {number} [max=DIALOGUE_MAX_CHARS]
 */
export const clipDialogue = (s, max = DIALOGUE_MAX_CHARS) => {
  const normalized = String(s || '').replace(/\s+/g, ' ').trim();
  const chars = [...normalized];
  if (!chars.length) return '';
  if (chars.length <= max) return chars.join('');

  const sentenceEndMarks = new Set(['。', '！', '？', '…', '～', '!', '?']);
  for (let i = max - 1; i >= 0; i -= 1) {
    if (sentenceEndMarks.has(chars[i])) return chars.slice(0, i + 1).join('');
  }

  // 若 max 內沒句尾，容許向後多看幾字，優先收完整句
  const graceLimit = Math.min(chars.length - 1, max + 8);
  for (let i = max; i <= graceLimit; i += 1) {
    if (sentenceEndMarks.has(chars[i])) return chars.slice(0, i + 1).join('');
  }

  // 最後才硬切；避免尾端停在逗號造成「半句感」
  return chars
    .slice(0, max)
    .join('')
    .replace(/[，、,]\s*$/u, '');
};

export const finalizeDialogue = (s, max = DIALOGUE_MAX_CHARS) => {
  const normalized = String(s || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  // 1) 先嘗試做「短句裁切」（若真的可安全裁）
  const clipped = clipDialogue(normalized, max).trim();
  let out = clipped || normalized;

  // 2) 若裁完仍無句尾，回退為原句，避免語意被硬砍半句
  if (!SENTENCE_END_RE.test(out) && SENTENCE_END_RE.test(normalized)) {
    out = normalized;
  }

  // 3) 清掉尾端逗號（避免「...，」）
  out = out.replace(/[，、,]\s*$/u, '').trim();
  if (!out) return '';

  // 4) 若句尾是懸空連接詞（例如「...，也。」），回收最後片段
  const bare = out.replace(/[。！？…～!?]$/u, '').trim();
  if (DANGLING_TAIL_RE.test(bare)) {
    const cut = bare.lastIndexOf('，');
    if (cut >= 0) {
      out = bare.slice(0, cut).trim();
    } else {
      out = bare.replace(DANGLING_TAIL_RE, '').trim();
    }
  }
  out = out.replace(/[，、,]\s*$/u, '').trim();
  if (!out) return '';

  // 5) 最後保證句尾標點
  return SENTENCE_END_RE.test(out) ? out : `${out}。`;
};

const fallbackDialogues = ({
  categoryId,
  fortuneId,
  tags = [],
  sceneZh = '',
  actionZh = '',
  castNames = [],
}) => {
  const cat = CATEGORY_BY_ID[categoryId]?.short || '運勢';
  const fortune = FORTUNE_BY_ID[fortuneId]?.label || '小吉';
  const tag = tags[0] || '社畜';
  const scene = sceneZh || '街上';
  const other = castNames.find((n) => n && n !== '我') || '';
  const lines = [
    scene ? `在${String(scene).slice(0, 8)}…這也算${fortune}？` : `今日${cat}：${fortune}，先這樣吧。`,
    actionZh ? `${String(actionZh).slice(0, 12)}，認了。` : `${tag}模式啟動中。`,
    other ? `${other}一出現我就知道今天不簡單。` : `傳給朋友一起看看運勢。`,
  ];
  return lines.map((s) => finalizeDialogue(s, DIALOGUE_MAX_CHARS));
};

/** 組對白 prompt（可單測） */
export const buildFortuneDialoguePrompt = ({
  categoryId,
  fortuneId,
  tags = [],
  displayName = '我',
  sceneZh = '',
  actionZh = '',
  castNames = [],
}) => {
  const cat = CATEGORY_BY_ID[categoryId]?.label || '運勢';
  const fortune = FORTUNE_BY_ID[fortuneId] || FORTUNE_BY_ID.sho_kichi;
  const castLine = (castNames.length ? castNames : [displayName]).join('、');

  return [
    '你是台灣社群短對白作者。',
    '【畫面事實｜主軸，必須寫進去】',
    `場景：${sceneZh || '台灣日常街頭'}`,
    `動作／互動：${actionZh || '尷尬日常'}`,
    `出場人物：${castLine}`,
    '【輕量運勢調味｜約 20% 語氣，不要變成報籤文】',
    `類別：${cat}；籤等：${fortune.label}（情緒方向：${fortune.mood}）`,
    `個性標籤：${tags.join('、') || '無'}；說話者暱稱「${displayName}」`,
    '【寫作規則】',
    '1. 產出 3 句互不重複的繁中短對白，每句完整可讀，建議 14～36 字（含標點），句尾必須是「。！？」之一。',
    '2. 每句都要讓人聯想到「這個場景」或「和場上人物的互動」（排隊、攤位、對方走近、對到眼…）。',
    '3. 籤等只影響情緒濃淡（大凶→倒楣吐槽；小吉→微妙心動／鬆一口氣），禁止直接寫「今日○○運：大凶」這類播報句。',
    '4. 清楚好懂，可幽默自嘲，不要玩到看不懂。',
    '5. 用第一人稱內心話或嘴邊碎念即可。',
    '風格參考（勿照抄）：「真的是大凶無誤，連排隊都為難我」「難道這就是夢中情人？好像不是我的菜…」',
    '格式：{"dialogues":["…","…","…"]}',
  ].join('\n');
};

/**
 * 產出三組短對白（場景／互動為主，籤別為調味）
 */
export const generateFortuneDialogues = async ({
  categoryId,
  fortuneId,
  tags = [],
  displayName = '我',
  sceneZh = '',
  actionZh = '',
  castNames = [],
}) => {
  const fallbackArgs = { categoryId, fortuneId, tags, sceneZh, actionZh, castNames };
  if (!hasApiKey()) return fallbackDialogues(fallbackArgs);

  try {
    const data = await generateJsonText(
      buildFortuneDialoguePrompt({
        categoryId,
        fortuneId,
        tags,
        displayName,
        sceneZh,
        actionZh,
        castNames,
      })
    );
    const lines = (data?.dialogues || [])
      .map((s) => finalizeDialogue(s, DIALOGUE_MAX_CHARS))
      .filter(Boolean);
    if (lines.length >= 3) return lines.slice(0, 3);
  } catch (err) {
    console.warn('fortune dialogues failed', err);
  }
  return fallbackDialogues(fallbackArgs);
};

/**
 * Step3：抽籤＋產圖（必含本人）＋三組對白
 */
export const drawFortuneCard = async ({
  categoryId,
  tags = [],
  portraits = {},
  playerProfile = null,
  onStatus,
  colorStyle = DEFAULT_COLOR_STYLE,
}) => {
  if (!portraits[PLAYER_ID] && !playerProfile?.iconUrl && !playerProfile?.portraitUrl) {
    throw new Error('請先完成 2D 角色');
  }

  const fortuneId = rollFortuneTier(tags);
  const fortune = FORTUNE_BY_ID[fortuneId];
  const category = CATEGORY_BY_ID[categoryId];
  onStatus?.('描繪場景中…');

  const portraitsMerged = {
    ...portraits,
    [PLAYER_ID]: portraits[PLAYER_ID] || playerProfile?.iconUrl || playerProfile?.portraitUrl,
  };

  const characterIds = rollPartyIncludingPlayer();
  const entry = pickSeasonEntry(categoryId);
  const entryWithMood = {
    ...entry,
    // 籤等只輕推情緒，不覆蓋場景主軸
    emotion_zh: fortune.mood,
    action_zh: entry.action_zh || '日常',
  };

  const sceneCard = await createCardFromSeasonEntry(entryWithMood, portraitsMerged, {
    characterIds,
    playerProfile,
    forcePlayer: true,
    styleLock: getInkOnlyStyleLock(),
    fortuneHint: {
      mood: fortune.mood,
      categoryId,
      categoryLabel: category?.label || category?.short || '',
      fortuneLabel: fortune.label,
    },
  });
  const inkImageUrl = sceneCard.imageUrl;
  const sceneZh = entry.scene_zh || sceneCard.scene || '';
  const actionZh = entry.action_zh || '';
  const castNames = castDisplayNames(characterIds, playerProfile);

  const style = normalizeColorStyle(colorStyle);
  onStatus?.(colorStyleStatus(style));
  let finalImageUrl = inkImageUrl;
  try {
    finalImageUrl = await applyColorStyle(inkImageUrl, style);
  } catch (err) {
    console.warn('color pass failed, using ink version', err);
  }

  onStatus?.('撰寫對白中…');
  const dialogues = await generateFortuneDialogues({
    categoryId,
    fortuneId,
    tags,
    displayName: playerProfile?.displayName || '我',
    sceneZh,
    actionZh,
    castNames,
  });

  let bubbles = bubblesFromPlainLine(
    { characterIds, imageUrl: finalImageUrl },
    dialogues[0]
  );
  bubbles = (bubbles || []).map((b) => ({ ...b, speakerId: PLAYER_ID }));
  try {
    bubbles = await attachFacesToBubbles(
      { imageUrl: finalImageUrl, characterIds },
      bubbles,
      { force: true }
    );
  } catch (err) {
    console.warn('face attach failed', err);
  }

  return {
    id: createId('fortune'),
    categoryId,
    fortuneId,
    fortuneLabel: fortune.label,
    fortuneEmoji: fortune.emoji,
    imageUrl: finalImageUrl,
    inkImageUrl,
    colorStyle: style,
    characterIds,
    dialogues,
    chosenIndex: 0,
    customText: '',
    bubbles,
    manualPos: null,
    sceneZh,
    actionZh,
    castNames,
    source: 'self',
    createdAt: new Date().toISOString(),
    shareCode: null,
  };
};

/**
 * 用既有墨線底圖切換風格（不重抽籤）
 */
export const recolorFortuneInk = async (inkImageUrl, colorStyle = DEFAULT_COLOR_STYLE) => {
  if (!inkImageUrl) throw new Error('缺少墨線底圖');
  return applyColorStyle(inkImageUrl, normalizeColorStyle(colorStyle));
};
