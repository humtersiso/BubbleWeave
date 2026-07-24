/**
 * Layer 1 繚 Gemini?蜇蝺刻摩??靘蜓憿?甈∠??N 蝯暺???+?? prompt
 * 嚗??澆?? API嚗? create-season ?單??Image Pipeline 雿輻嚗?
 *
 * 憭見?找?隞?21 撘萇銝?嚗uota ??cardCount 蝑??游撐嚗?
 * 憭扳甈⊥??郭?澆 Gemini嚗蒂?歇?典?荔?????exclusion ?脤?銴?
 */

import { GoogleGenAI } from '@google/genai';
import { UNIVERSAL_SLOTS, normalizeSlotId } from './universalSlots.js';
import {
  CHARACTER_BIBLE,
  PARTY_SIZE_DISTRIBUTION,
} from '../data/character-bible.js';

export const CHIEF_EDITOR_TEXT_MODEL = 'gemini-3.1-flash-lite';
/** Demo ?身嚗?蝺??--count=50 / 100 蝑?*/
export const DEFAULT_SEASON_CARD_COUNT = 21;
/** ?格活 API 頛詨蝛拙?摨虫???頞???瘜Ｙ??*/
export const CHIEF_EDITOR_BATCH_SIZE = 24;

/** 蝝憸刻?蝭?銝閫?膩 */
const STYLE_LOCK =
  'Classic Studio Ghibli keyframe black-and-white ink line art, Miyazaki-inspired, ' +
  'clean dark outlines, high contrast, crisp white background, NO text, NO speech bubbles, ' +
  'NO panel borders, vertical 3:4 full-body or three-quarter shot.';

const VALID_CHAR_IDS = new Set(['cindy', 'bob', 'david', 'elise']);
const VALID_SLOT_IDS = new Set(UNIVERSAL_SLOTS.map((s) => s.id));
const SLOT_WEIGHT_SUM = UNIVERSAL_SLOTS.reduce((s, x) => s + x.weight, 0);
const SLOT_COUNT = UNIVERSAL_SLOTS.length;

/**
 * 鈭箸??嚗? PARTY_SIZE_DISTRIBUTION 撠?嚗 N ?游撐嚗?
 * @param {number} cardCount
 */
export const buildPartyQuotas = (cardCount) => {
  const n = Math.max(1, Math.round(Number(cardCount) || DEFAULT_SEASON_CARD_COUNT));
  const totalW = PARTY_SIZE_DISTRIBUTION.reduce((s, x) => s + x.weight, 0);
  const quotas = PARTY_SIZE_DISTRIBUTION.map(({ size, weight }) => {
    const exact = (n * weight) / totalW;
    return { size, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let assigned = quotas.reduce((s, q) => s + q.count, 0);
  const byRem = [...quotas].sort((a, b) => b.remainder - a.remainder);
  let i = 0;
  while (assigned < n) {
    byRem[i % byRem.length].count += 1;
    assigned += 1;
    i += 1;
  }
  return Object.fromEntries(quotas.map((q) => [q.size, q.count]));
};

/**
 * 靘蜇撘菜蝑?撅?瑽賭?靽?嚗???銝?甇?21嚗?
 * @param {number} cardCount
 */
export const buildDiversityQuotas = (cardCount) => {
  const n = Math.max(1, Math.round(Number(cardCount) || DEFAULT_SEASON_CARD_COUNT));
  const share = (weight, floor = 0) =>
    Math.max(floor, Math.round((n * weight) / SLOT_WEIGHT_SUM));

  const streetMin = Math.max(1, share(28));
  const landmarkMin = Math.max(1, share(28));
  const transitPublicMin = Math.max(1, share(28));
  const transitPersonalMin = Math.max(1, share(28));
  const fashionMin = Math.max(1, share(14, 1));
  const cultureMin = Math.max(1, share(14, 1));
  const entertainmentMin = Math.max(1, share(14, 1));
  const diningMax = Math.max(1, Math.min(share(6), Math.ceil(n * 0.12)));
  const accommodationMax = Math.max(1, Math.min(share(6), Math.ceil(n * 0.12)));
  const natureMax = Math.max(1, Math.min(share(6), Math.ceil(n * 0.12)));

  const distinctSlotsMin = Math.min(
    SLOT_COUNT,
    Math.max(7, Math.ceil(n >= 12 ? 9 : n * 0.6))
  );
  const party = buildPartyQuotas(n);

  return {
    cardCount: n,
    distinctSlotsMin,
    streetMin,
    landmarkMin,
    transitPublicMin,
    transitPersonalMin,
    fashionMin,
    cultureMin,
    entertainmentMin,
    diningMax,
    accommodationMax,
    natureMax,
    partySolo: party[1] || 0,
    partyDuo: party[2] || 0,
    partyTrio: party[3] || 0,
    partyQuad: party[4] || 0,
    maxSameAction: 1,
    maxSameScene: n <= 40 ? 1 : 2,
  };
};

const normalizePhrase = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[嚗?嚗?.!?]/g, '');

/** 敺?CHARACTER_BIBLE ??撱箇?閫蝪∟” */
const buildCharacterGuide = () =>
  CHARACTER_BIBLE.map(
    (c) =>
      `- ${c.name}嚗?{c.vibe}嚗?${c.outfitSignature}` +
      (c.glassesSignature ? `嚗?∴?${c.glassesSignature}` : '') +
      (c.identityHardLock
        ? `嚗ARD LOCK: ${c.identityHardLock.slice(0, 120)}?圳
        : '')
  ).join('\n');

/**
 * @param {string} theme
 * @param {number} [cardCount]
 * @param {{ excludeScenes?: string[], excludeActions?: string[], batchIndex?: number, batchTotal?: number }} [opts]
 */
export const buildChiefEditorPrompt = (
  theme,
  cardCount = DEFAULT_SEASON_CARD_COUNT,
  opts = {}
) => {
  const quotas = buildDiversityQuotas(cardCount);
  const slotGuide = UNIVERSAL_SLOTS.map(
    (s) =>
      `- ${s.id}嚗?{s.category}繚${s.nameZh}繚weight ${s.weight}嚗?嚗?{s.exampleTaiwan}`
  ).join('\n');

  const characterGuide = buildCharacterGuide();
  const excludeScenes = (opts.excludeScenes || []).slice(-80);
  const excludeActions = (opts.excludeActions || []).slice(-120);
  const batchNote =
    opts.batchTotal > 1
      ? `\n??瘜Ｙ?喋蝚?${opts.batchIndex}/${opts.batchTotal} 瘜ｇ??祆郭?芾??Ｗ?啣末 ${cardCount} 撘蛛??游迤憭見?折??歇蝳皜????靘雁?
      : '';

  const excludeBlock =
    excludeScenes.length || excludeActions.length
      ? `
?歇蝳嚗瘜Ｙ?甇Ｗ??箇嚗??撖急?銋?銵???
撌脩?湔嚗?{excludeScenes.length ? excludeScenes.join('??) : '嚗嚗?}
撌脩??嚗?{excludeActions.length ? excludeActions.join('??) : '嚗嚗?}
`
      : '';

  return `雿銝雿?蝝蕙???潭憤?怒蜇蝺刻摩???箔蜓憿?{theme}??單憟?${cardCount} 撘菜憤?怠?????舫?/?湔 + ???? + ?望??? prompt嚗?
?格??臭?蝺?憭見?改?????舫閬擙殷?銝??瑟????蝚???
${batchNote}

?瑽賭? Constraints ???脤?銴???銝鈭粹??‵銵典??
瘥撐?∪???銝??universal_slot_id??
?祆郭 ${cardCount} 撘菟?瘨菔??喳? ${quotas.distinctSlotsMin} 蝔桐??局雿?
瑽賭?撘菜?格?嚗 簣1嚗?銝?冽??典?銝瑽踝?嚗?
- 擃???STREET_FOOD ??${quotas.streetMin}嚗ANDMARK_SPOT ??${quotas.landmarkMin}嚗RANSIT_PUBLIC ??${quotas.transitPublicMin}嚗RANSIT_PERSONAL ??${quotas.transitPersonalMin}
- 銝剜???FASHION_LOCAL ??${quotas.fashionMin}嚗?瘀?嚗ULTURE_RULES ??${quotas.cultureMin}嚗?急???嚗NTERTAINMENT ??${quotas.entertainmentMin}
- 雿?????DINING_SOCIAL ??${quotas.diningMax}嚗CCOMMODATION ??${quotas.accommodationMax}嚗ATURE_OUTDOORS ??${quotas.natureMax}
- ??????TRANSIT_PUBLIC嚗??擃嚗頠???嚗RANSIT_PERSONAL嚗頦?嚗ouBike嚗?頠?

${slotGuide}

??璅?折敺?銝??嚗?
1. ?祆郭?扳?璇?action_zh 敹?鈭??詨?嚗?甇Ｗ?蝢拇撖恬????扒???憟嗉??????嚗?
2. ?祆郭?扳?璇?scene_zh 敹?鈭??詨?嚗?銝憭?銝??支??臭誑嚗?閬神?箏????琿?暺???
3. ?湔??雿????蝛粹?????
4. ??閬?撘瑕?撌柴?急??格?祇?嚗??◤??憭整??啣??豢除??蝧餉?????樴佗???
5. ?犖?賊?憿???蝳迫?湔?賭?鈭箝瘜Ｗ??之?渡泵??
   - party_size=1嚗olo嚗? ${quotas.partySolo} 撘?
   - party_size=2嚗uo嚗? ${quotas.partyDuo} 撘?
   - party_size=3嚗rio嚗? ${quotas.partyTrio} 撘?
   - party_size=4嚗uad嚗? ${quotas.partyQuad} 撘?
   瘥撐?∟撓??character_ids ???嚗摨?= party_size嚗?id ?芾??cindy/bob/david/elise銝?????
6. 憭犖?∴?image_prompt 敹?撖怠瘥?雿?憭?嚗蒂??LEFT嚗ENTER嚗IGHT 璅征??蝵殷????臭?鈭箔蜓?隞犖????
7. image_prompt ?刻????胯???雿??脣擃?閫????雿”???憸券?摰??
8. 銝?頛詨 markdown嚗頛詨 JSON??
${excludeBlock}
??雿摰??莎???閬????
瘥撐 image_prompt 銝駁?敹?撖怠閰脣????脩???嚗?????孵噩嚗?甇Ｕ character? man??瘜迂??
${characterGuide}

?憸券?摰嚗神?脫?璇?image_prompt ?怠偏嚗?
${STYLE_LOCK}

?撓??JSON ?澆???
{
  "theme": "${theme}",
  "cards": [
    {
      "i": 1,
      "universal_slot_id": "STREET_FOOD",
      "scene_zh": "擖眾憭??⊥?擗",
      "action_zh": "鋡怠??箇??璊???頝唾絲",
      "emotion_zh": "??",
      "party_size": 1,
      "character_ids": ["bob"],
      "image_prompt": "At a bustling Raohe Night Market pepper bun stall, a large Black man in his 40s (completely bald, full dark beard, huge round beer belly, black skull-print T-shirt stretched over belly, blue jeans) is mid-air, mouth blasting steam from a scorching hot pepper bun, eyes wide in shock. Classic Studio Ghibli keyframe black-and-white ink line art, Miyazaki-inspired, clean dark outlines, high contrast, crisp white background, NO text, NO speech bubbles, NO panel borders, vertical 3:4 full-body or three-quarter shot."
    },
    {
      "i": 2,
      "universal_slot_id": "TRANSIT_PUBLIC",
      "scene_zh": "?琿?頠?",
      "action_zh": "?亦??拐犖鈭?",
      "emotion_zh": "撠瑕鬲",
      "party_size": 2,
      "character_ids": ["cindy", "elise"],
      "image_prompt": "Inside a Taipei MRT car, On the LEFT: Cindy — slim Japanese woman in black OL suit, long straight black hair, NO glasses — stumbling forward; On the RIGHT: Elise — lightly plump East Asian woman in oversized white knee-length tee, messy shoulder hair, thick ROUND glasses — recoiling; both mid-collision as the train brakes. Classic Studio Ghibli keyframe black-and-white ink line art, Miyazaki-inspired, clean dark outlines, high contrast, crisp white background, NO text, NO speech bubbles, NO panel borders, vertical 3:4 full-body or three-quarter shot."
    }
  ]
}

cards ????瑕漲敹??啣末蝑 ${cardCount}?;
};

/**
 * @param {string} raw
 */
export const parseChiefEditorJson = (raw) => {
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

/**
 * @param {object} parsed
 * @param {number} expectedCount
 */
export const normalizeChiefEditorCards = (parsed, expectedCount = DEFAULT_SEASON_CARD_COUNT) => {
  const list = Array.isArray(parsed?.cards)
    ? parsed.cards
    : Array.isArray(parsed)
      ? parsed
      : [];
  return list
    .map((c, idx) => {
      const slotRaw = String(c.universal_slot_id || c.slot_id || '').trim();
      const slotId = normalizeSlotId(slotRaw) || slotRaw;
      const scene_zh = String(c.scene_zh || c.scene || '').trim();
      const action_zh = String(c.action_zh || c.action || '').trim();
      const image_prompt = String(c.image_prompt || c.prompt || '').trim();
      if (!scene_zh || !action_zh || !image_prompt) return null;

      let character_ids = [];
      if (Array.isArray(c.character_ids)) {
        character_ids = c.character_ids
          .map((id) => String(id || '').trim().toLowerCase())
          .filter((id) => VALID_CHAR_IDS.has(id));
      } else if (c.character_id) {
        const one = String(c.character_id).trim().toLowerCase();
        if (VALID_CHAR_IDS.has(one)) character_ids = [one];
      }
      // ?駁???摨?
      character_ids = [...new Set(character_ids)];
      if (!character_ids.length) character_ids = ['cindy'];

      let party_size = Number(c.party_size);
      if (![1, 2, 3, 4].includes(party_size)) party_size = character_ids.length;
      party_size = Math.min(4, Math.max(1, party_size));
      character_ids = character_ids.slice(0, party_size);
      // 鈭箸銝雲?雁?祕?摨?
      party_size = character_ids.length;

      return {
        i: Number(c.i) > 0 ? Number(c.i) : idx + 1,
        universal_slot_id: VALID_SLOT_IDS.has(slotId) ? slotId : 'LANDMARK_SPOT',
        scene_zh,
        action_zh,
        emotion_zh: String(c.emotion_zh || c.emotion || '撠瑕鬲').trim().slice(0, 12),
        party_size,
        character_ids,
        character_id: character_ids[0] || null,
        image_prompt,
      };
    })
    .filter(Boolean)
    .slice(0, expectedCount);
};

const countBy = (cards, keyFn) => {
  const map = new Map();
  for (const c of cards) {
    const k = keyFn(c);
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
};

/**
 * ?Ｗ?蝔賣嚗???issues嚗?銝莎???stats
 * @param {object[]} cards
 * @param {number} expectedCount
 */
export const auditSeasonDiversity = (cards, expectedCount) => {
  const quotas = buildDiversityQuotas(expectedCount);
  const issues = [];
  const slotCounts = countBy(cards, (c) => c.universal_slot_id);
  const actionCounts = countBy(cards, (c) => normalizePhrase(c.action_zh));
  const sceneCounts = countBy(cards, (c) => normalizePhrase(c.scene_zh));

  if (cards.length < expectedCount) {
    issues.push(`撘菜銝雲嚗?{cards.length}/${expectedCount}`);
  }

  const distinctSlots = slotCounts.size;
  if (distinctSlots < quotas.distinctSlotsMin) {
    issues.push(`瑽賭?蝔桅?銝雲嚗?{distinctSlots}嚗撠?${quotas.distinctSlotsMin}嚗);
  }

  const need = [
    ['STREET_FOOD', quotas.streetMin],
    ['LANDMARK_SPOT', quotas.landmarkMin],
    ['TRANSIT_PUBLIC', quotas.transitPublicMin],
    ['TRANSIT_PERSONAL', quotas.transitPersonalMin],
    ['FASHION_LOCAL', quotas.fashionMin],
    ['CULTURE_RULES', quotas.cultureMin],
    ['ENTERTAINMENT', quotas.entertainmentMin],
  ];
  for (const [id, min] of need) {
    const got = slotCounts.get(id) || 0;
    if (got < min) issues.push(`${id} ??${got} 撘蛛??格? ??${min}嚗);
  }
  const lowCaps = [
    ['DINING_SOCIAL', quotas.diningMax],
    ['ACCOMMODATION', quotas.accommodationMax],
    ['NATURE_OUTDOORS', quotas.natureMax],
  ];
  for (const [id, max] of lowCaps) {
    const got = slotCounts.get(id) || 0;
    if (got > max) issues.push(`${id} ${got} 撘菔?????${max}`);
  }
  if (expectedCount >= 12) {
    if ((slotCounts.get('TRANSIT_PUBLIC') || 0) < 1) {
      issues.push('蝻箏? TRANSIT_PUBLIC嚗之?暸?頛賂??琿?嚗頠?擃嚗?);
    }
    if ((slotCounts.get('TRANSIT_PERSONAL') || 0) < 1) {
      issues.push('蝻箏? TRANSIT_PERSONAL嚗犖鈭日?YouBike嚗頦?嚗?頠?');
    }
  }

  for (const [action, n] of actionCounts) {
    if (n > quotas.maxSameAction) {
      issues.push(`??????{action}??{n}`);
    }
  }
  for (const [scene, n] of sceneCounts) {
    if (n > quotas.maxSameScene) {
      issues.push(`?湔????{scene}??{n}`);
    }
  }

  const partyCounts = countBy(cards, (c) => String(c.party_size || c.character_ids?.length || 1));
  const gotSolo = partyCounts.get('1') || 0;
  const gotDuo = partyCounts.get('2') || 0;
  const gotTrio = partyCounts.get('3') || 0;
  const gotQuad = partyCounts.get('4') || 0;
  const multi = gotDuo + gotTrio + gotQuad;

  // 鈭箸嚗鈭箔??舫?頞?憿??犖嚗?鈭箄撠???銝??
  const soloCap = quotas.partySolo + Math.max(2, Math.ceil(quotas.partySolo * 0.3));
  if (expectedCount >= 8 && gotSolo > soloCap) {
    issues.push(`?桐犖?⊿?憭?${gotSolo}嚗璅? ${quotas.partySolo}嚗???${soloCap}嚗);
  }
  if (quotas.partyDuo > 0 && gotDuo < Math.max(1, Math.floor(quotas.partyDuo * 0.5))) {
    issues.push(`?犖?⊿?撠?${gotDuo}嚗璅? ${quotas.partyDuo}嚗);
  }
  if (quotas.partyTrio > 0 && gotTrio < 1 && expectedCount >= 16) {
    issues.push(`銝犖?∠撩憭梧??格?蝝?${quotas.partyTrio}嚗);
  }
  if (quotas.partyQuad > 0 && gotQuad < 1 && expectedCount >= 16) {
    issues.push(`?犖?∠撩憭梧??格?蝝?${quotas.partyQuad}嚗);
  }
  if (expectedCount >= 10 && multi < Math.max(2, Math.floor(expectedCount * 0.3))) {
    issues.push(
      `憭犖?⊿?撠???${multi} 撘蛛??喳?蝝?${Math.floor(expectedCount * 0.3)} 撘菜???2鈭箔誑銝?`
    );
  }

  return {
    ok: issues.length === 0,
    issues,
    quotas,
    stats: {
      card_count: cards.length,
      distinct_slots: distinctSlots,
      distinct_actions: actionCounts.size,
      distinct_scenes: sceneCounts.size,
      slot_counts: Object.fromEntries(slotCounts),
      party_counts: Object.fromEntries(partyCounts),
    },
  };
};

/**
 * ?餅?????格?頠??∴?銝血?瘜Ｗ?券?銴?靽???曄?嚗?
 * @param {object[]} cards
 * @param {{ scenes: Set<string>, actions: Set<string> }} used
 */
export const dedupeAgainstUsed = (cards, used) => {
  const seenScene = new Set();
  const seenAction = new Set();
  const out = [];
  for (const c of cards) {
    const sn = normalizePhrase(c.scene_zh);
    const an = normalizePhrase(c.action_zh);
    if (used.scenes.has(sn) || seenScene.has(sn)) continue;
    if (used.actions.has(an) || seenAction.has(an)) continue;
    seenScene.add(sn);
    seenAction.add(an);
    out.push(c);
  }
  return out;
};

const callChiefEditorOnce = async ({
  ai,
  model,
  theme,
  cardCount,
  excludeScenes,
  excludeActions,
  batchIndex,
  batchTotal,
}) => {
  const res = await ai.models.generateContent({
    model,
    contents: buildChiefEditorPrompt(theme, cardCount, {
      excludeScenes,
      excludeActions,
      batchIndex,
      batchTotal,
    }),
    config: { maxOutputTokens: 8192 },
  });
  const parsed = parseChiefEditorJson(res.text || '');
  return normalizeChiefEditorCards(parsed, cardCount);
};

/**
 * @param {{ theme: string, apiKey: string, cardCount?: number, model?: string }} opts
 */
export const generateSeasonCardPrompts = async ({
  theme,
  apiKey,
  cardCount = DEFAULT_SEASON_CARD_COUNT,
  model = CHIEF_EDITOR_TEXT_MODEL,
}) => {
  if (!apiKey) throw new Error('蝻箏? API ?');
  const themeTrim = String(theme || '').trim();
  if (!themeTrim) throw new Error('隢?靘?theme');

  const total = Math.max(1, Math.round(Number(cardCount) || DEFAULT_SEASON_CARD_COUNT));
  const batchSize = CHIEF_EDITOR_BATCH_SIZE;
  const batchSizes = [];
  let remain = total;
  while (remain > 0) {
    const n = Math.min(batchSize, remain);
    batchSizes.push(n);
    remain -= n;
  }

  const ai = new GoogleGenAI({ apiKey });
  const used = { scenes: new Set(), actions: new Set() };
  const allCards = [];

  for (let b = 0; b < batchSizes.length; b += 1) {
    const need = batchSizes[b];
    let batchCards = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const raw = await callChiefEditorOnce({
        ai,
        model,
        theme: themeTrim,
        cardCount: need,
        excludeScenes: [...used.scenes],
        excludeActions: [...used.actions],
        batchIndex: b + 1,
        batchTotal: batchSizes.length,
      });
      batchCards = dedupeAgainstUsed(raw, used);
      if (batchCards.length >= Math.ceil(need * 0.7)) break;
    }

    for (const c of batchCards.slice(0, need)) {
      used.scenes.add(normalizePhrase(c.scene_zh));
      used.actions.add(normalizePhrase(c.action_zh));
      allCards.push({
        ...c,
        i: allCards.length + 1,
      });
    }
  }

  if (allCards.length < Math.min(3, total)) {
    throw new Error(
      `蝮賜楊頛?JSON 閫??憭望??撐?訾?頞喉?敺 ${allCards.length}嚗???${total}嚗
    );
  }

  const diversity = auditSeasonDiversity(allCards, total);

  return {
    theme: themeTrim,
    generated_at: new Date().toISOString(),
    card_count: allCards.length,
    requested_count: total,
    model,
    pipeline_stage: 'prompts_only',
    diversity,
    cards: allCards,
  };
};

