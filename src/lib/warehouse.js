import { generateCanonicalCharacterImage, generateStorySceneCard } from './gemini.js';
import { createId } from './storage.js';
import {
  buildBootstrapRecipes,
  buildFacePortraitPrompt,
  SEASON,
} from './cardRecipes.js';
import { CHARACTERS, CHARACTERS_BY_ID, TOTAL_BOOTSTRAP_CARDS } from './casts.js';
import { parseSpatialOrderFromPrompt } from './speechBubble.js';
import { PLAYER_ID, buildPlayerCharacter, resolveCharacter } from './playerCharacter.js';
import { attachRarity } from './rarity.js';
import { UNIVERSAL_SLOTS_BY_ID } from './universalSlots.js';

/** 兩階段生圖管線版本（與 App CARD_SCHEMA / PORTRAIT 對齊） */
export const IMAGE_PIPELINE_VERSION = 1;

/**
 * Resolve canonical face references — keep ids aligned with labels (no filter drift).
 * @param {string[]} characterIds
 * @param {Record<string, string>} portraits
 * @param {object} [playerProfile]
 */
const refsForCharacters = (characterIds, portraits = {}, playerProfile = null) => {
  const ids = characterIds || [];
  const missing = ids.filter((id) => !portraits[id]);
  if (missing.length) {
    throw new Error(`缺少角色參考圖：${missing.join(', ')}。請先完成階段一 canonical 產圖。`);
  }
  return ids.map((id) => portraits[id]);
};

const labelsForCharacters = (characterIds, playerProfile = null) =>
  (characterIds || []).map((id) => {
    const ch = resolveCharacter(id, playerProfile, CHARACTERS_BY_ID);
    if (!ch?.name) throw new Error(`未知角色 id：${id}`);
    return ch.name;
  });

/**
 * 倉庫卡牌是否符合當前 schema（每位角色至少出現一次）。
 */
export const warehouseMatchesSchema = (cards, cardSchemaVersion, expectedVersion) => {
  if (cardSchemaVersion !== expectedVersion) return false;
  if (!Array.isArray(cards) || cards.length === 0) return false;
  if (!cards.every((c) => Array.isArray(c.characterIds) && c.characterIds.length > 0)) {
    return false;
  }
  const covered = new Set(cards.flatMap((c) => c.characterIds || []));
  return CHARACTERS.every((c) => covered.has(c.id));
};

export const portraitsComplete = (portraits) =>
  CHARACTERS.every((c) => Boolean(portraits?.[c.id]));

/**
 * 場景卡是否需重建（schema／覆蓋率）。
 * 注意：canonical icon 與場景卡解耦——升 CARD_SCHEMA 不強制重跑肖像。
 */
export const needsCardRebuild = (cached, cardSchemaVersion) =>
  cached.cardSchemaVersion !== cardSchemaVersion ||
  !warehouseMatchesSchema(cached.cards, cached.cardSchemaVersion, cardSchemaVersion);

/**
 * 是否缺 canonical 肖像（僅缺才生；不因 PORTRAIT_VERSION 整批重跑）。
 */
export const needsMissingPortraits = (cached) =>
  !portraitsComplete(cached?.portraits || {});

/**
 * 是否需要重建場景卡／補齊缺的肖像。
 * 既有完整 icon 一律保留；僅當 CARD_SCHEMA 變更或缺肖像時觸發。
 */
export const needsWarehouseRebuild = (cached, cardSchemaVersion, _portraitVersion) =>
  needsCardRebuild(cached, cardSchemaVersion) || needsMissingPortraits(cached);

/**
 * 階段二：以 canonical 圖 + 場景 prompt 建立故事卡。
 */
export const createCardFromRecipe = async (recipe, portraits = {}) => {
  const characterIds = recipe.characterIds || [];
  const referenceImages = refsForCharacters(characterIds, portraits);
  const referenceLabels = labelsForCharacters(characterIds);

  const imageUrl = await generateStorySceneCard(recipe.prompt, {
    aspectRatio: '3:4',
    referenceImages,
    referenceLabels,
    characterIds,
  });

  // recipe 管線 SPATIAL_SLOT 依 characterIds 左→右
  const parsedSpatial = parseSpatialOrderFromPrompt(recipe.prompt);
  const spatialOrder = parsedSpatial.length >= 2 ? parsedSpatial : characterIds.slice();

  const built = {
    id: createId('card'),
    imageUrl,
    scene: recipe.comboLabel,
    partySize: recipe.partySize || characterIds.length,
    characterIds,
    spatialOrder,
    imagePrompt: recipe.prompt || '',
    castId: recipe.castId,
    packId: recipe.castId,
    packNameZh: recipe.character,
    presence:
      characterIds.length === 1
        ? 'solo'
        : characterIds.length === 2
          ? 'duo'
          : characterIds.length === 3
            ? 'trio'
            : 'quad',
    castMembers: recipe.castMembers,
    recipe: {
      seasonId: recipe.seasonId,
      scene: recipe.scene,
      sceneId: recipe.sceneId,
      sceneWeight: recipe.sceneWeight,
      slotId: recipe.slotId,
      slotWeight: recipe.slotWeight,
      character: recipe.character,
      action: recipe.action,
      actionId: recipe.actionId,
      actionWeight: recipe.actionWeight,
      emotion: recipe.emotion,
      emotionId: recipe.emotionId,
      emotionWeight: recipe.emotionWeight,
      prompt: recipe.prompt,
    },
    createdAt: new Date().toISOString(),
    style: 'Ghibli Ink Keyframe',
    pipeline: 'canonical-i2i',
  };
  return attachRarity(built);
};

/**
 * 階段一：只補缺的 canonical 肖像；已存在的一律保留（不整批重跑）。
 * @param {(done:number,total:number,name?:string)=>void} [onProgress]
 * @param {Record<string, string>} [existing]
 */
export const generateCharacterPortraits = async (onProgress, existing = {}) => {
  const portraits = { ...(existing || {}) };
  const missing = CHARACTERS.filter((ch) => !portraits[ch.id]);
  const total = missing.length;
  if (!total) {
    onProgress?.(CHARACTERS.length, CHARACTERS.length, '角色肖像已齊');
    return portraits;
  }
  for (let i = 0; i < total; i += 1) {
    const ch = missing[i];
    // eslint-disable-next-line no-await-in-loop
    portraits[ch.id] = await generateCanonicalCharacterImage(
      buildFacePortraitPrompt(ch),
      ch.id
    );
    onProgress?.(i + 1, total, ch.nameZh);
  }
  return portraits;
};

/**
 * 完整啟動：階段一 portraits → 階段二 bootstrap 場景卡。
 */
export const bootstrapWarehouse = async (onProgress, portraits = {}) => {
  const recipes = buildBootstrapRecipes();
  const cards = [];
  const total = recipes.length || TOTAL_BOOTSTRAP_CARDS;

  for (let i = 0; i < recipes.length; i += 1) {
    const card = await createCardFromRecipe(recipes[i], portraits);
    cards.push(card);
    onProgress?.(i + 1, total, recipes[i].character);
  }

  return cards;
};

/**
 * 單張總編輯配方 → I2I 場景卡（缺肖像硬失敗）
 * @param {object} card
 * @param {Record<string, string>} portraits
 * @param {{ characterIds?: string[], playerProfile?: object, forcePlayer?: boolean }} [opts]
 */
export const createCardFromSeasonEntry = async (card, portraits = {}, opts = {}) => {
  const playerProfile = opts.playerProfile || null;
  let characterIds = Array.isArray(opts.characterIds)
    ? opts.characterIds.slice()
    : Array.isArray(card.character_ids)
      ? card.character_ids.filter(
          (id) => id === PLAYER_ID || CHARACTERS_BY_ID[id]
        )
      : [];
  if (!characterIds.length && card.character_id && CHARACTERS_BY_ID[card.character_id]) {
    characterIds = [card.character_id];
  }
  if (opts.forcePlayer) {
    characterIds = [PLAYER_ID, ...characterIds.filter((id) => id !== PLAYER_ID)];
  }
  characterIds = [...new Set(characterIds)].slice(0, 4);
  if (!characterIds.length) {
    throw new Error(`總編輯卡缺少有效 character_ids（scene=${card.scene_zh || card.i}）`);
  }

  const referenceImages = refsForCharacters(characterIds, portraits, playerProfile);
  const referenceLabels = labelsForCharacters(characterIds, playerProfile);
  const presenceOf = (n) =>
    n === 1 ? 'solo' : n === 2 ? 'duo' : n === 3 ? 'trio' : 'quad';
  const castLabel = characterIds
    .map((id) => resolveCharacter(id, playerProfile, CHARACTERS_BY_ID)?.nameZh || id)
    .join('＋');

  const slotId = card.universal_slot_id || 'LANDMARK_SPOT';
  const slotWeight = UNIVERSAL_SLOTS_BY_ID[slotId]?.weight ?? 10;

  const imagePrompt = opts.forcePlayer
    ? buildPlayerAwareScenePrompt(card, characterIds, playerProfile)
    : card.image_prompt;

  const imageUrl = await generateStorySceneCard(imagePrompt, {
    aspectRatio: '3:4',
    referenceImages,
    referenceLabels,
    characterIds,
    extraCharacters: characterIds.includes(PLAYER_ID)
      ? [buildPlayerCharacter(playerProfile || {})]
      : [],
  });

  const spatialFromPrompt = parseSpatialOrderFromPrompt(imagePrompt);
  const spatialOrder =
    spatialFromPrompt.length >= 2 ? spatialFromPrompt : characterIds.slice();

  const built = {
    id: createId('card'),
    imageUrl,
    scene: card.scene_zh || `卡牌 ${card.i}`,
    partySize: characterIds.length,
    characterIds,
    spatialOrder,
    imagePrompt: imagePrompt || '',
    castId: characterIds.slice().sort().join('+'),
    packId: characterIds[0] || 'unknown',
    packNameZh: castLabel || '總編輯',
    presence: presenceOf(characterIds.length),
    castMembers: characterIds.map((id) => {
      const c = resolveCharacter(id, playerProfile, CHARACTERS_BY_ID);
      return { id: c.id, name: c.name, nameZh: c.nameZh };
    }),
    recipe: {
      seasonId: SEASON.id,
      scene: card.scene_zh,
      sceneId: `chief_${card.i}`,
      sceneWeight: 10,
      slotId,
      slotWeight,
      character: castLabel,
      action: card.action_zh,
      actionId: `chief_action_${card.i}`,
      actionWeight: 10,
      emotion: card.emotion_zh || '尷尬',
      emotionId: 'chief',
      emotionWeight: 10,
      prompt: imagePrompt,
    },
    createdAt: new Date().toISOString(),
    style: 'Ghibli Ink Keyframe',
    pipeline: opts.forcePlayer ? 'player-daily-i2i' : 'chief-editor-i2i',
  };

  return attachRarity(built);
};

/** 強制含「我」時改寫場景 prompt，避免舊四角描述搶臉 */
const buildPlayerAwareScenePrompt = (entry, characterIds, playerProfile) => {
  const me = buildPlayerCharacter(playerProfile || {});
  const others = characterIds
    .filter((id) => id !== PLAYER_ID)
    .map((id) => CHARACTERS_BY_ID[id])
    .filter(Boolean);

  const castLines = characterIds.map((id, i) => {
    const ch = resolveCharacter(id, playerProfile, CHARACTERS_BY_ID);
    const side =
      characterIds.length === 1
        ? 'CENTER'
        : i === 0
          ? 'LEFT'
          : i === characterIds.length - 1
            ? 'RIGHT'
            : 'CENTER';
    if (id === PLAYER_ID) {
      return `On the ${side}: ${ch.name} — match player canonical portrait exactly (${ch.identityHardLock})`;
    }
    return `On the ${side}: ${ch.name} — ${ch.identityHardLock || ch.appearance || ''}`;
  });

  return [
    `Taiwan everyday scene: ${entry.scene_zh || 'street'}.`,
    `Action: ${entry.action_zh || 'awkward moment'}.`,
    `Emotion: ${entry.emotion_zh || 'embarrassed'}.`,
    'Cast (left to right):',
    ...castLines,
    others.length
      ? 'Keep each named character identity locked; do not blend faces.'
      : `${me.nameZh} alone in frame.`,
    'Classic Studio Ghibli keyframe black-and-white ink line art, Miyazaki-inspired, clean dark outlines, high contrast, crisp white background, NO text, NO speech bubbles, NO panel borders, vertical 3:4 full-body or three-quarter shot.',
  ].join('\n');
};

/**
 * 從總編輯 JSON（season-*.json）讀 image_prompt，搭配 canonical portraits 批次生圖入庫。
 */
export const bootstrapWarehouseFromSeason = async (seasonCards, portraits = {}, onProgress) => {
  const cards = [];
  const total = seasonCards.length;

  for (let i = 0; i < total; i += 1) {
    const card = await createCardFromSeasonEntry(seasonCards[i], portraits);
    cards.push(card);
    onProgress?.(i + 1, total, seasonCards[i].scene_zh || `卡牌 ${seasonCards[i].i}`);
  }

  return cards;
};

const seasonEntryKey = (c) =>
  `${String(c.scene_zh || c.recipe?.scene || '').trim()}|${String(c.action_zh || c.recipe?.action || '').trim()}`;

const shuffleCopy = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * 每日獎勵：3 張皆含「我」；人數權重 solo35 / +1 40 / +2 20 / +3 5
 * @param {object[]} seasonCards
 * @param {Record<string, string>} portraits
 * @param {object[]} [existingCards]
 * @param {number} [count]
 * @param {{ playerProfile?: object, requirePlayer?: boolean }} [opts]
 */
export const claimDailyCards = async (
  seasonCards = [],
  portraits = {},
  existingCards = [],
  count = 3,
  opts = {}
) => {
  if (!Array.isArray(seasonCards) || seasonCards.length === 0) {
    throw new Error('總編輯卡池為空，請先 npm run create-season');
  }

  const requirePlayer = opts.requirePlayer !== false;
  const playerProfile = opts.playerProfile || null;
  if (requirePlayer && !portraits[PLAYER_ID]) {
    throw new Error('請先在個人資料上傳照片，生成你的 2D 角色');
  }

  const used = new Set(existingCards.map(seasonEntryKey).filter((k) => k !== '|'));
  let pool = shuffleCopy(seasonCards.filter((c) => !used.has(seasonEntryKey(c))));
  if (pool.length < count) {
    pool = shuffleCopy(seasonCards);
  }

  const cards = [];
  for (let i = 0; i < count; i += 1) {
    const entry = pool[i % pool.length];
    const characterIds = requirePlayer
      ? rollPartyIncludingPlayer()
      : undefined;
    // eslint-disable-next-line no-await-in-loop
    cards.push(
      await createCardFromSeasonEntry(entry, portraits, {
        characterIds,
        playerProfile,
        forcePlayer: requirePlayer,
      })
    );
  }
  return cards;
};

/** 每日組隊：一定含 me；其餘從四角抽 */
const PARTY_ROLL = [
  { extra: 0, weight: 35 },
  { extra: 1, weight: 40 },
  { extra: 2, weight: 20 },
  { extra: 3, weight: 5 },
];

const rollPartyIncludingPlayer = () => {
  const total = PARTY_ROLL.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  let extra = 0;
  for (const row of PARTY_ROLL) {
    r -= row.weight;
    if (r <= 0) {
      extra = row.extra;
      break;
    }
  }
  const core = shuffleCopy(CHARACTERS.map((c) => c.id)).slice(0, extra);
  return [PLAYER_ID, ...core];
};

export { TOTAL_BOOTSTRAP_CARDS, CHARACTERS, PLAYER_ID };
