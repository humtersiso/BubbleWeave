/**
 * 故事生成 pipeline（預設）：
 * 1. 單次 multimodal — 一次附上劇場全部附圖（通常 3～4 格），依畫面動作 + 風格產出極短對白 JSON
 * 2. 後備 — 無圖或解析失敗時，文字單步（recipe 輔助；季包僅輕量提示）
 *
 * （舊三階段：視覺分析 → 敘事節拍 → 風格台詞 — 仍保留供後備路徑內部使用）
 */

import { GoogleGenAI, createPartFromBase64 } from '@google/genai';
import { CHARACTERS_BY_ID } from './casts.js';
import { SEASON } from './cardRecipes.js';
import { splitStoryToDialogues } from './storyText.js';
import {
  normalizePanelBubbles,
  bubblesFromPlainLine,
  bubblesToDisplayLine,
  MAX_BUBBLE_CHARS,
} from './speechBubble.js';
import {
  buildBeatStructureGuide,
  buildDialogueCraftBlock,
} from './characterVoice.js';

const TEXT_MODEL = 'gemini-3.1-flash-lite';

/** 看圖寫對白時：季包僅背景參考（圖中已有情境就不必重複強調） */
const SEASON_LIGHT_HINT = `（背景）第 ${SEASON.number} 季「${SEASON.title}」— 若附圖已是台灣場景（夜市、捷運、廟口、雷陣雨等），台詞跟著畫面走即可，勿硬塞地名清單。`;

/** 文字後備路徑用：較完整的季包提示 */
const SEASON_NARRATIVE_BLOCK = [
  `【本季背景 — 次要於附圖】`,
  `第 ${SEASON.number} 季「${SEASON.title}」：${SEASON.blurb}`,
  '有附圖時以圖為準；無圖時再依分鏡 recipe 補台灣日常情境。',
].join('\n');

/** 排版階段可選的 AI 劇本風格（預設＝爆笑） */
export const DEFAULT_STORY_STYLE_ID = 'comedy';

export const STORY_STYLES = [
  {
    id: 'comedy',
    label: '爆笑',
    hint: '誇張吐槽，笑點一接一個',
    guide:
      '節奏快、每格一個小包袱：誇張反應、吐槽、反差。對白極短。跟圖中表情動作呼應，且要接上一格的笑點或結果。',
    toneSamples: '踩到水了／誰濺我',
  },
  {
    id: 'taiwan_meme',
    label: '台味迷因',
    hint: '雨天、排隊、珍奶，超有感',
    guide:
      '對白跟著附圖動作走；若畫面已是台灣場景，用在地節奏點出小包袱（排隊、熱、雨、飲料、搭錯車）。節奏快、每格一個小笑點，並與上一格銜接。勿長篇解說、勿堆疊觀光詞彙。',
    toneSamples: '這排沒完？／傘翻了／先喝珍奶',
  },
  {
    id: 'absurdist',
    label: '無厘頭',
    hint: '正經講屁事，越扯越好笑',
    guide:
      '語氣荒謬、因果錯位：認真講屁事、屁事當正經。跟圖中動作硬接一句荒謬結論即可，並讓下一格接得住。禁止長旁白。',
    toneSamples: '101在左轉？／筊說可以',
  },
  {
    id: 'office',
    label: '社畜日常',
    hint: '表面客氣，內心全是幹話',
    guide:
      '職場味吐槽，但台詞須對應圖中正在做的事（一句帶過已讀不回、請假、加班即可）。表面客氣、內耗自嘲。格與格要像同一天的吐槽串。',
    toneSamples: '晚點回你／這算出差嗎',
  },
  {
    id: 'scifi',
    label: '科幻',
    hint: '輕科幻包裝眼前這一格',
    guide:
      '輕科幻口吻包裝「眼前這一格」的動作：導航錯亂、體感指數、平行捷運一句帶過。設定服務畫面，並用同一個小設定貫穿各格。',
    toneSamples: '濕度爆表／定位漂移',
  },
];

const getApiKey = () => import.meta.env.VITE_GEMINI_API_KEY || '';

const getClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('缺少 VITE_GEMINI_API_KEY，請在 .env 設定 Gemini API 金鑰。');
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * @param {string} dataUrl
 */
const parseDataUrl = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
};

/**
 * @param {object} card
 * @param {number} index
 */
const buildPanelMeta = (card, index) => {
  const members = card.castMembers || [];
  const who =
    members.map((m) => `${m.nameZh}（${m.name}）`).join('、') ||
    card.packNameZh ||
    '見附圖';
  const r = card.recipe;
  const lines = [`第 ${index + 1} 格`, `出場角色：${who}`];
  if (r?.scene) lines.push(`場景設定：${r.scene}`);
  if (r?.action) lines.push(`動作：${r.action}`);
  if (r?.emotion) lines.push(`情緒：${r.emotion}`);
  return lines.join('\n');
};

const SKIPPED_VISION_NOTE =
  '（未執行附圖分析：各格 scene／action／emotion 已齊，以分鏡設定表與季包為準。）';

/** 分鏡表欄位是否足以支撐敘事底層（不需再看圖） */
export const cardRecipeGrounded = (card) => {
  const r = card?.recipe;
  return Boolean(
    r?.scene?.trim() && r?.action?.trim() && r?.emotion?.trim()
  );
};

/**
 * 是否執行 multimodal 視覺分析（舊管線用）
 * @param {object[]} cards
 * @param {{ useVisionAnalysis?: boolean }} [options]
 */
export const shouldUseVisionAnalysis = (cards, options = {}) => {
  if (options.useVisionAnalysis === true) return true;
  if (options.useVisionAnalysis === false) return false;
  return (cards || []).some((c) => parseDataUrl(c.imageUrl));
};

const cardsHaveImages = (cards) =>
  (cards || []).some((c) => parseDataUrl(c.imageUrl));

/**
 * 寫劇用分鏡表（以 recipe 為準；與視覺分析衝突時以本表為準）
 * @param {object[]} cards
 */
const buildPanelRecipeTable = (cards) =>
  cards
    .map((card, i) => {
      const r = card.recipe || {};
      const who =
        (card.castMembers || []).map((m) => m.nameZh).join('＋') ||
        card.packNameZh ||
        '見附圖';
      const scene = r.scene || '（見附圖）';
      const action = r.action || '（見附圖）';
      const emotion = r.emotion || '（見附圖）';
      const ids = [
        r.seasonId ? `季=${r.seasonId}` : '',
        r.sceneId ? `場景id=${r.sceneId}` : '',
        r.actionId ? `動作id=${r.actionId}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      const idSuffix = ids ? `｜${ids}` : '';
      return `第${i + 1}格｜${who}｜場景：${scene}｜動作：${action}｜情緒：${emotion}${idSuffix}`;
    })
    .join('\n');

/**
 * @param {object[]} cards
 */
const buildFlowNotes = (cards) => {
  if (cards.length < 2) return '（單格分鏡）';
  const notes = [];
  for (let i = 1; i < cards.length; i += 1) {
    const prev = cards[i - 1];
    const curr = cards[i];
    const prevIds = new Set(prev.characterIds || []);
    const shared = (curr.characterIds || []).filter((id) => prevIds.has(id));
    const sharedNames = shared.map((id) => CHARACTERS_BY_ID[id]?.nameZh || id).join('、') || '無';
    const newcomers = (curr.characterIds || [])
      .filter((id) => !prevIds.has(id))
      .map((id) => CHARACTERS_BY_ID[id]?.nameZh || id);
    const prevScene = prev.recipe?.scene || '（見附圖）';
    const currScene = curr.recipe?.scene || '（見附圖）';
    const prevAction = prev.recipe?.action || '';
    const currAction = curr.recipe?.action || '';
    const sceneJump = prevScene !== currScene;
    notes.push(
      `第 ${i} → ${i + 1} 格：` +
        `「${prevScene}／${prevAction}」→「${currScene}／${currAction}」` +
        (sceneJump
          ? '（換場：第' +
            (i + 1) +
            '格對白須用短句帶出銜接，如「剛出夜市」「轉乘去」「雨忽然下」；勿長旁白）'
          : '（同場或相近，對白接上一格的動作或結果）') +
        `；共同角色「${sharedNames}」` +
        (newcomers.length ? `；新登場「${newcomers.join('、')}」（一句點名或招呼即可）` : '') +
        (sharedNames === '無'
          ? '。無共同角色時，用同一天出遊／同一條捷運或市區動線當暗線串起。'
          : '。讓共同角色的一句話呼應上一格發生的事。')
    );
  }
  notes.push(
    '全串：theme 與各格對白須像同一條台灣日常／出遊動線；相鄰兩格至少共用一個錨點詞（人名、地名簡稱、剛發生的動作）。'
  );
  return notes.join('\n');
};

/**
 * @param {object[]} cards
 */
const buildVisionAnalysisParts = (cards) => {
  const parts = [
    {
      text:
        '你是漫畫分鏡分析師。請「只看附圖」描述每一格畫面，禁止腦補圖中沒有的物品、文字、場景。\n\n' +
        `本批分鏡屬於「${SEASON.title}」；若圖像線條難辨，仍須參考每格下方「場景設定／動作」元資料，並點出台灣日常／景點線索。\n\n` +
        '對每一格輸出以下欄位（繁體中文）：\n' +
        '【第N格】\n' +
        '- 看見誰：（依圖中人物數量與特徵描述，不確定就說不確定）\n' +
        '- 台灣情境：（夜市／捷運／廟口／下雨／悶熱等；對照元資料）\n' +
        '- 場景：（室內/室外、具體地點線索）\n' +
        '- 動作與姿態：\n' +
        '- 表情與情緒：\n' +
        '- 關鍵道具：（僅限圖中可見；若無則寫「無」）\n' +
        '- 與上一格關係：（第1格寫「開場」；若場景/人數變了，用一句假設「從夜市轉捷運」這類動線）\n\n' +
        `共 ${cards.length} 格，依序分析：`,
    },
  ];

  cards.forEach((card, i) => {
    parts.push({ text: `\n---\n${buildPanelMeta(card, i)}\n（附圖如下）` });
    const img = parseDataUrl(card.imageUrl);
    if (img) {
      parts.push(createPartFromBase64(img.data, img.mimeType || 'image/jpeg'));
    } else {
      parts.push({ text: '（此格無附圖，僅依元資料描述）' });
    }
  });

  return parts;
};

/** 看圖寫對白用的簡短銜接提示（強調整串連戲，非各格獨立） */
const buildLightFlowNotes = (cards) => {
  if (cards.length < 2) return '（單格分鏡）';
  const chain = [];
  for (let i = 1; i < cards.length; i += 1) {
    chain.push(
      `第${i}格 → 第${i + 1}格：第${i + 1}格台詞必須明確接第${i}格的狀況／結果／未說完的話（因果或吐槽接力），不可另起無關主題。`
    );
  }
  return [
    '【連戲鐵律 — 禁止各格各說各的】',
    `- 這 ${cards.length} 格＝同一則短篇、同一天、同一條外出／奔波動線。`,
    '- 先寫 1 句「整串主線」（給自己用，勿輸出），再拆成各格台詞。',
    '- 第1格：丟出狀況／慾望／麻煩；最後一格：收束或反轉，呼應第1格。',
    '- 中間格：每格只推進「上一格留下的問題」一步。',
    ...chain,
    '- 跨格同一角色：用一句話點名上一格發生的事（例：剛買的蛋餅→害我過站）。',
    '- 換場也要接戲：場景變了，因果不能斷。',
    '- 禁止：每格獨立迷因、重開話題、互不相干的旁白。',
  ].join('\n');
};

/**
 * 單次 multimodal：全部附圖 + 風格 → 極短對白 JSON
 * @param {object[]} cards
 * @param {{ styleId?: string, outline?: string }} [options]
 */
const buildMultimodalDialogueParts = (cards, options = {}) => {
  const style =
    STORY_STYLES.find((s) => s.id === options.styleId) ||
    STORY_STYLES.find((s) => s.id === DEFAULT_STORY_STYLE_ID) ||
    STORY_STYLES[0];
  const toneSamples = style.toneSamples || '嗯／好';
  const outline = (options.outline || '').trim();
  const { castLine, panelCast } = buildCastLines(cards);

  const panelCastWithSlots = cards
    .map((c, i) => {
      const ids = c.characterIds || [];
      const slots =
        ids.length <= 1
          ? 'sole→top-center'
          : ids.length === 2
            ? `${ids[0]}=left, ${ids[1]}=right`
            : ids.map((id, j) => `${id}@${j}`).join(', ');
      return `第${i + 1}格 speakerId∈{${ids.join('|')}}；站位：${slots}`;
    })
    .join('\n');

  const parts = [
    {
      text:
        `你是漫畫「氣泡對白」編劇。下面一次附上 ${cards.length} 格分鏡圖（圖上無字、無氣泡）。\n\n` +
        '【優先順序】\n' +
        '1. **整串連戲**：先想同一條故事弧，再寫各格台詞（禁止各格互相獨立；極短篇迷因除外）\n' +
        '2. **附圖**：依每格動作、姿態、表情、場景寫台詞（權威來源）\n' +
        `3. **風格**：${style.label}\n` +
        `${style.guide}\n` +
        `4. ${SEASON_LIGHT_HINT}\n\n` +
        `${buildDialogueCraftBlock(cards)}\n\n` +
        '【元資料（僅在圖看不清時參考；與圖衝突以圖為準）】\n' +
        `${buildPanelRecipeTable(cards)}\n\n` +
        '【格與格】\n' +
        `${buildLightFlowNotes(cards)}\n\n` +
        '【角色 id】\n' +
        `${castLine || '見各格'}\n\n` +
        '【各格出場】\n' +
        `${panelCast}\n\n` +
        '【各格發言】\n' +
        `${panelCastWithSlots}\n\n` +
        '【用戶大綱】\n' +
        `${outline || '（無）'}\n\n` +
        '【對白鐵律 — 圖上要讀得完】\n' +
        '- 每格氣泡數 ≤ 該格出場人數（最多 4）；三人同框可 3 句，仍優先精簡\n' +
        `- 每句 text 建議 14～28 繁中字，**硬上限 ${MAX_BUBBLE_CHARS} 字**；必須是完整可讀句子\n` +
        '- **禁止**句尾用「…」「……」「..」或寫到一半被截斷的感覺\n' +
        '- 後一格台詞要能聽出「接在前一格後面」（可重複上一格關鍵詞 1 個）\n' +
        '- speakerId 必須在該格出場名單內\n' +
        '- theme 8～14 字，概括整串主線（不是單格摘要）\n' +
        `- panels 長度必須＝${cards.length}\n` +
        '- **不要回傳 face／座標**（人臉錨點由前端 MediaPipe 偵測）\n\n' +
        '【只輸出 JSON，勿 markdown】\n' +
        '{"theme":"…","panels":[{"i":1,"bubbles":[{"speakerId":"cindy","text":"短句"}]}]}\n\n' +
        `【${style.label} 語氣參考（勿照抄）】${toneSamples}\n\n` +
        '依序閱讀以下各格附圖（讀完全部後，一次寫出整串對白）：',
    },
  ];

  cards.forEach((card, i) => {
    parts.push({ text: `\n---\n${buildPanelMeta(card, i)}\n（附圖如下）` });
    const img = parseDataUrl(card.imageUrl);
    if (img) {
      parts.push(createPartFromBase64(img.data, img.mimeType || 'image/jpeg'));
    } else {
      parts.push({ text: '（此格無附圖，依元資料）' });
    }
  });

  return parts;
};

/**
 * @param {string} raw
 */
const parseJsonFromModel = (raw) => {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
  }
  return null;
};

/** @param {object[]} cards */
const buildCastLines = (cards) => {
  const allCast = new Map();
  cards.forEach((c) => {
    (c.castMembers || []).forEach((m) => {
      allCast.set(m.id || m.name, m);
    });
  });
  const castLine = [...allCast.values()]
    .map((m) => {
      const ch = CHARACTERS_BY_ID[m.id];
      return ch
        ? `${m.id}｜${m.nameZh}（${m.name}）— ${ch.vibe}`
        : `${m.id}｜${m.nameZh}（${m.name}）`;
    })
    .join('\n');

  const panelCast = cards
    .map((c, i) => {
      const ids = c.characterIds || [];
      return `第${i + 1}格 出場 id：${ids.join('|') || '（見分鏡表）'}`;
    })
    .join('\n');

  return { castLine, panelCast };
};

/**
 * 階段 2：季包＋分鏡表 → 中性敘事節拍（不帶風格）
 * @param {object[]} cards
 * @param {string} panelAnalysis
 * @param {{ outline?: string }} [options]
 */
const buildNarrativeSpinePrompt = (cards, panelAnalysis, options = {}) => {
  const outline = (options.outline || '').trim();
  const { castLine, panelCast } = buildCastLines(cards);

  return `你是漫畫「分鏡敘事編劇」。本步只建立故事骨架，不寫角色台詞、不選喜劇風格。

${SEASON_NARRATIVE_BLOCK}

【權威分鏡設定表 — 劇情必須服務此表】
${buildPanelRecipeTable(cards)}

【附圖理解（輔助；與設定表衝突時以設定表為準）】
${panelAnalysis || '（無附圖分析）'}

【格與格銜接】
${buildFlowNotes(cards)}

【角色 id】
${castLine || '見各格'}

【各格出場】
${panelCast}

【用戶大綱】
${outline || '（無）'}

【節拍結構（中性骨架也須對齊；本步仍禁止寫喜劇台詞）】
${buildBeatStructureGuide(cards.length)}

【本步任務】
- 產出整串同一條「台灣日常／出遊」主線（arc）
- 每格一句中性 beat：這格發生什麼、和上一格怎麼接（可含誰在場）；beat 須對應上列節拍位（setup／escalation／climax／payoff 或波浪小循環）
- 每格 bridge：若換場，用 6～20 字說明銜接理由（給下一步寫對白用，不是台詞）
- 每格 anchor：1～3 個錨點詞，相鄰格至少共用一個
- suggestedSpeakerId：該格最適合開口的角色 id（須在該格出場名單內；吐槽位優先 cindy）
- 禁止幽默口吻、禁止網路梗、禁止 office／科幻等風格用語

【只輸出 JSON】
{"theme":"8～14字中性主題含台灣日常語境","arc":"20～40字整串主線","panels":[{"i":1,"beat":"中性敘事","bridge":"開場或銜接","anchor":["詞"],"suggestedSpeakerId":"cindy"}]}
panels 長度必須＝${cards.length}`;
};

/**
 * @typedef {{ theme: string, arc: string, panels: object[] }} NarrativeSpine
 */

/**
 * @param {string} raw
 * @param {number} panelCount
 * @returns {NarrativeSpine | null}
 */
const parseNarrativeSpine = (raw, panelCount) => {
  const parsed = parseJsonFromModel(raw);
  if (!parsed?.panels || !Array.isArray(parsed.panels)) return null;
  const theme = String(parsed.theme || '')
    .trim()
    .replace(/[。．…]+$/u, '')
    .slice(0, 20);
  const arc = String(parsed.arc || '').trim().slice(0, 80);
  const panels = Array.from({ length: panelCount }, (_, i) => {
    const p =
      parsed.panels.find((x) => Number(x.i) === i + 1) || parsed.panels[i] || {};
    return {
      i: i + 1,
      beat: String(p.beat || '').trim(),
      bridge: String(p.bridge || '').trim(),
      anchor: Array.isArray(p.anchor) ? p.anchor.map(String) : [],
      suggestedSpeakerId: String(p.suggestedSpeakerId || '').trim(),
    };
  });
  return { theme, arc, panels };
};

/**
 * 階段 3：敘事節拍 + 風格 → 氣泡短對白
 * @param {object[]} cards
 * @param {NarrativeSpine} spine
 * @param {{ styleId?: string }} [options]
 */
const buildStyledDialoguePrompt = (cards, spine, options = {}) => {
  const style =
    STORY_STYLES.find((s) => s.id === options.styleId) ||
    STORY_STYLES.find((s) => s.id === DEFAULT_STORY_STYLE_ID) ||
    STORY_STYLES[0];
  const toneSamples = style.toneSamples || '加油／還行';
  const { castLine } = buildCastLines(cards);
  const spineJson = JSON.stringify(spine, null, 0);

  const panelCastWithSlots = cards
    .map((c, i) => {
      const ids = c.characterIds || [];
      const slots =
        ids.length <= 1
          ? 'sole→top-center'
          : ids.length === 2
            ? `${ids[0]}=left, ${ids[1]}=right`
            : ids.map((id, j) => `${id}@${j}`).join(', ');
      return `第${i + 1}格 speakerId∈{${ids.join('|')}}；站位：${slots}`;
    })
    .join('\n');

  return `你是漫畫「氣泡對白」編劇。圖上無字；你只把既有敘事節拍改寫成極短台詞。

【底層已定 — 不可改劇情方向】
季包：第 ${SEASON.number} 季「${SEASON.title}」
敘事骨架 JSON：
${spineJson}

分鏡設定（事實依據）：
${buildPanelRecipeTable(cards)}

規則：台詞必須落實每格 beat／bridge；不可無視換場銜接；優先跟著畫面的台灣情境。

【最後一層：風格＝${style.label}】
${style.guide}
只在此步加入語氣與包袱；不得改寫成與骨架矛盾的情節。

${buildDialogueCraftBlock(cards)}

【角色 id】
${castLine}

【各格發言限制】
${panelCastWithSlots}

【對白鐵律】
1. 每格氣泡數 ≤ 出場人數（最多 4）；三人可 3 句，優先精簡
2. 每句 text 建議 14～28 字，硬上限 ${MAX_BUBBLE_CHARS}；完整句子，禁止句尾「…」
3. 後一格必須接前一格因果／吐槽（極短篇迷因依 Setup→Payoff）
4. speakerId 必須該格有出場；優先採 skeleton 的 suggestedSpeakerId（可換同格他人若更合理）
5. theme 用骨架的 theme，可微調用字
6. panels 長度＝${cards.length}
7. **不要回傳 face／座標**（人臉由前端 MediaPipe 偵測）

【只輸出 JSON】
{"theme":"…","panels":[{"i":1,"bubbles":[{"speakerId":"cindy","text":"短句"}]}]}

【${style.label} 語氣參考（勿照抄）】${toneSamples}`;
};

/**
 * @deprecated 單步後備（節拍階段失敗時）
 */
const buildStoryWritingPrompt = (cards, panelAnalysis, options = {}) => {
  const { castLine, panelCast } = buildCastLines(cards);
  const panelSlots = cards
    .map((c, i) => {
      const ids = c.characterIds || [];
      const slots =
        ids.length <= 1
          ? 'sole→top-center'
          : ids.length === 2
            ? `${ids[0]}=left(top-left), ${ids[1]}=right(top-right)`
            : ids.map((id, j) => `${id}@${j}`).join(', ');
      return `第${i + 1}格 speakerId 只能選：${ids.join('|') || '（見圖）'}；站位參考：${slots}`;
    })
    .join('\n');

  const style =
    STORY_STYLES.find((s) => s.id === options.styleId) ||
    STORY_STYLES.find((s) => s.id === DEFAULT_STORY_STYLE_ID) ||
    STORY_STYLES[0];
  const outline = (options.outline || '').trim();
  const toneSamples = style.toneSamples || '加油／還行';

  return `你是漫畫「氣泡對白」編劇。圖像本身無字；你只產出極短對白供程式壓上對話框。

${SEASON_NARRATIVE_BLOCK}

【分鏡設定表 — 權威來源】
${buildPanelRecipeTable(cards)}

【分鏡視覺分析（輔助）】
${panelAnalysis || '（無）'}

【串連與銜接】
${buildFlowNotes(cards)}

【最後：風格＝${style.label}】
寫作指引：${style.guide}

${buildDialogueCraftBlock(cards)}

【角色 id】
${castLine || '依各格分析'}

【各格可發言角色】
${panelSlots || panelCast}

【用戶大綱】
${outline || '（無）'}

【對白鐵律】
1. 每格氣泡數 ≤ 出場人數（最多 4）；三人可 3 句，優先精簡
2. 每句 text 建議 14～28 字，硬上限 ${MAX_BUBBLE_CHARS}；完整句子，禁止句尾「…」
3. speakerId 須為該格出場角色
4. 格與格必須連戲銜接（極短篇迷因依 Setup→Payoff）
5. panels 長度＝${cards.length}
6. theme 8～14 字
7. **不要回傳 face／座標**（人臉由前端 MediaPipe 偵測）

【只輸出 JSON】
{"theme":"…","panels":[{"i":1,"bubbles":[{"speakerId":"cindy","text":"…"}]}]}

【${style.label} 語氣參考】${toneSamples}`;
};

/**
 * @param {string} raw
 * @param {object[]} cards
 * @returns {{ theme: string, storyText: string, panelBubbles: object[][], lines: string[] }}
 */
const parseStoryJsonResponse = (raw, cards) => {
  const parsed = parseJsonFromModel(raw);

  if (!parsed?.panels || !Array.isArray(parsed.panels)) {
    // 舊格式後備
    const legacy = parseStoryResponse(raw);
    const lines = splitStoryToDialogues(legacy.storyText, cards.length);
    const panelBubbles = cards.map((card, i) =>
      bubblesFromPlainLine(card, lines[i] || '')
    );
    return {
      theme: legacy.theme,
      storyText: legacy.storyText,
      panelBubbles,
      lines: panelBubbles.map((b) => bubblesToDisplayLine(b)),
    };
  }

  const theme = String(parsed.theme || '')
    .trim()
    .replace(/[。．…]+$/u, '')
    .slice(0, 20);

  const panelBubbles = cards.map((card, i) => {
    const panel =
      parsed.panels.find((p) => Number(p.i) === i + 1) || parsed.panels[i] || {};
    // 丟棄模型回傳的 face（改由 MediaPipe）
    const rawBubbles = (panel.bubbles || []).map((b) => {
      if (!b || typeof b !== 'object') return b;
      const { face: _drop, ...rest } = b;
      return rest;
    });
    return normalizePanelBubbles(card, rawBubbles);
  });

  const lines = panelBubbles.map((b) => bubblesToDisplayLine(b));
  const storyText = lines.filter(Boolean).join('\n\n');

  return { theme, storyText, panelBubbles, lines };
};

/**
 * @param {string} raw
 * @returns {{ theme: string, storyText: string }}
 */
const parseStoryResponse = (raw) => {
  let text = (raw || '').trim();
  let theme = '';
  const themeMatch = text.match(/^【主題】\s*(.+?)\s*$/m);
  if (themeMatch) {
    theme = themeMatch[1].trim().replace(/[。．…]+$/u, '').slice(0, 20);
    text = text.replace(/^【主題】[^\n]*\n?/m, '');
  }
  text = text.replace(/^【故事】\s*\n?/m, '');
  text = cleanStoryOutput(text);
  return { theme, storyText: text };
};

/**
 * @param {string} text
 */
const cleanStoryOutput = (text) =>
  (text || '')
    .replace(/^```[\s\S]*?```/gm, '')
    .replace(/^#+\s*.+$/gm, '')
    .replace(/^【故事】\s*$/gm, '')
    .trim();

/**
 * 季包分鏡底層 → 風格化對白（2～3 次模型呼叫：視覺可選、節拍、台詞）
 * @param {object[]} cards
 * @param {{ styleId?: string, outline?: string, useVisionAnalysis?: boolean }} [options]
 * @returns {Promise<{ theme: string, storyText: string, panelBubbles: object[][], lines: string[] }>}
 */
export const generateStoryText = async (cards, options = {}) => {
  if (!cards?.length) {
    return { theme: '', storyText: '', panelBubbles: [], lines: [] };
  }

  const ai = getClient();
  const genConfig = { maxOutputTokens: 1536 };

  const useMultimodal =
    options.useVisionAnalysis !== false && cardsHaveImages(cards);

  if (useMultimodal) {
    const primaryRes = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ role: 'user', parts: buildMultimodalDialogueParts(cards, options) }],
      config: genConfig,
    });
    const primary = parseStoryJsonResponse(primaryRes.text || '', cards);
    if (primary.lines?.some(Boolean)) {
      return primary;
    }
  }

  const runVision = shouldUseVisionAnalysis(cards, options);
  let panelAnalysis = SKIPPED_VISION_NOTE;
  if (runVision) {
    const analysisRes = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ role: 'user', parts: buildVisionAnalysisParts(cards) }],
    });
    panelAnalysis = analysisRes.text?.trim() || '';
  }

  const spineRes = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: buildNarrativeSpinePrompt(cards, panelAnalysis, options),
    config: genConfig,
  });
  let spine = parseNarrativeSpine(spineRes.text || '', cards.length);

  if (!spine) {
    spine = {
      theme: SEASON.title.slice(0, 12),
      arc: SEASON.blurb,
      panels: cards.map((card, i) => ({
        i: i + 1,
        beat: [
          card.recipe?.scene,
          card.recipe?.action,
          card.recipe?.emotion,
        ]
          .filter(Boolean)
          .join('／'),
        bridge: i === 0 ? '開場' : '承接上一格',
        anchor: [],
        suggestedSpeakerId: (card.characterIds || [])[0] || '',
      })),
    };
  }

  const dialogueRes = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: buildStyledDialoguePrompt(cards, spine, options),
    config: genConfig,
  });
  let result = parseStoryJsonResponse(dialogueRes.text || '', cards);

  if (!result.lines?.some(Boolean)) {
    const fallbackRes = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: buildStoryWritingPrompt(cards, panelAnalysis, options),
      config: genConfig,
    });
    result = parseStoryJsonResponse(fallbackRes.text || '', cards);
  }

  return result;
};

/**
 * @param {object[]} cards
 * @param {{ styleId?: string, outline?: string }} [options]
 * @returns {Promise<{ lines: string[], theme: string, storyText: string, panelBubbles: object[][] }>}
 */
export const generateDialogues = async (cards, options = {}) => {
  const { theme, storyText, panelBubbles, lines } = await generateStoryText(
    cards,
    options
  );
  // 不在這裡等 YOLO：對白先回傳，臉座標由 UI／合成層背景補
  return {
    lines: lines?.length ? lines : splitStoryToDialogues(storyText, cards.length),
    theme,
    storyText,
    panelBubbles: panelBubbles || [],
  };
};

/**
 * 補位：MediaPipe 偵測各格人臉座標（舊 Gemini 實作已移除）
 * @param {object[]} cards
 * @returns {Promise<Array<{ i: number, faces: Array<{ speakerId: string, x: number, y: number }> }>>}
 */
export { locatePanelFaces } from './faceDetection.js';


