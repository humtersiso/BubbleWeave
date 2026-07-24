/**
 * BigQuery 目錄／事件欄位設計（與前端 catalog 對齊）
 *
 * 設計原則：
 * - 欄位 snake_case（BQ 慣例）
 * - 權重用 INT64（相對整數，≥1；抽樣機率 = weight / SUM(weight)）
 * - 陣列用 ARRAY（tags、allowed_action_ids、character_ids）
 * - dim_* 為季包維度表；fact_* 為產卡／抽樣事件
 */

import {
  SEASON,
  SCENES,
  ACTIONS,
  EMOTIONS,
  UNIVERSAL_ACTION_IDS,
  SCENE_ACTION_CROSSOVER_RATE,
  DEFAULT_CATALOG_WEIGHT,
  normalizeCatalogWeight,
} from './cardRecipes.js';
import { resolveSceneSlotId } from './seasonCatalog.js';
import { UNIVERSAL_SLOTS } from './universalSlots.js';

/** @typedef {'STRING'|'INT64'|'FLOAT64'|'BOOL'|'TIMESTAMP'|'DATE'|'ARRAY<STRING>'} BqType */

/**
 * @typedef {{ name: string, type: BqType, mode?: 'NULLABLE'|'REQUIRED'|'REPEATED', description: string }} BqField
 */

/** dim_season */
export const BQ_DIM_SEASON_SCHEMA = /** @type {BqField[]} */ ([
  { name: 'season_id', type: 'STRING', mode: 'REQUIRED', description: '季包主鍵，如 s1_taiwan' },
  { name: 'season_number', type: 'INT64', mode: 'REQUIRED', description: '季序' },
  { name: 'title_zh', type: 'STRING', mode: 'REQUIRED', description: '中文季名' },
  { name: 'title_en', type: 'STRING', mode: 'NULLABLE', description: '英文季名' },
  { name: 'blurb_zh', type: 'STRING', mode: 'NULLABLE', description: '季包一句話' },
  { name: 'is_active', type: 'BOOL', mode: 'REQUIRED', description: '是否為目前營運季' },
  { name: 'exported_at', type: 'TIMESTAMP', mode: 'REQUIRED', description: '目錄匯出時間' },
]);

/** dim_scene — 場景維度（含抽樣權重） */
export const BQ_DIM_SCENE_SCHEMA = /** @type {BqField[]} */ ([
  { name: 'season_id', type: 'STRING', mode: 'REQUIRED', description: '所屬季包' },
  { name: 'scene_id', type: 'STRING', mode: 'REQUIRED', description: '場景主鍵' },
  { name: 'universal_slot_id', type: 'STRING', mode: 'NULLABLE', description: '10 大通用槽位 id' },
  { name: 'label_zh', type: 'STRING', mode: 'REQUIRED', description: '中文場景名' },
  { name: 'label_en', type: 'STRING', mode: 'NULLABLE', description: '英文場景名' },
  { name: 'vibe', type: 'STRING', mode: 'NULLABLE', description: '場景群組，如 transit / food' },
  { name: 'tags', type: 'STRING', mode: 'REPEATED', description: '標籤陣列' },
  { name: 'weight', type: 'INT64', mode: 'REQUIRED', description: '相對抽樣權重（≥1）' },
  { name: 'allowed_action_ids', type: 'STRING', mode: 'REPEATED', description: '主池動作 id' },
  { name: 'prompt_keywords', type: 'STRING', mode: 'NULLABLE', description: '生圖場景關鍵字' },
  { name: 'is_active', type: 'BOOL', mode: 'REQUIRED', description: '是否參與抽樣' },
  { name: 'exported_at', type: 'TIMESTAMP', mode: 'REQUIRED', description: '目錄匯出時間' },
]);

/** dim_action — 動作維度（含抽樣權重） */
export const BQ_DIM_ACTION_SCHEMA = /** @type {BqField[]} */ ([
  { name: 'season_id', type: 'STRING', mode: 'REQUIRED', description: '所屬季包' },
  { name: 'action_id', type: 'STRING', mode: 'REQUIRED', description: '動作主鍵' },
  { name: 'label_zh', type: 'STRING', mode: 'REQUIRED', description: '中文動作名' },
  { name: 'label_en', type: 'STRING', mode: 'NULLABLE', description: '英文動作名' },
  { name: 'vibe', type: 'STRING', mode: 'NULLABLE', description: '動作群組' },
  { name: 'tags', type: 'STRING', mode: 'REPEATED', description: '標籤陣列' },
  { name: 'weight', type: 'INT64', mode: 'REQUIRED', description: '相對抽樣權重（≥1）' },
  { name: 'is_universal', type: 'BOOL', mode: 'REQUIRED', description: '是否可進萬用微跨界池' },
  { name: 'action_prompt', type: 'STRING', mode: 'NULLABLE', description: '生圖動作描述' },
  { name: 'prop_prompt', type: 'STRING', mode: 'NULLABLE', description: '生圖道具描述' },
  { name: 'is_active', type: 'BOOL', mode: 'REQUIRED', description: '是否參與抽樣' },
  { name: 'exported_at', type: 'TIMESTAMP', mode: 'REQUIRED', description: '目錄匯出時間' },
]);

/** dim_emotion */
export const BQ_DIM_EMOTION_SCHEMA = /** @type {BqField[]} */ ([
  { name: 'season_id', type: 'STRING', mode: 'REQUIRED', description: '所屬季包（情緒可跨季共用）' },
  { name: 'emotion_id', type: 'STRING', mode: 'REQUIRED', description: '情緒主鍵' },
  { name: 'label_zh', type: 'STRING', mode: 'REQUIRED', description: '中文情緒' },
  { name: 'label_en', type: 'STRING', mode: 'NULLABLE', description: '英文情緒' },
  { name: 'tags', type: 'STRING', mode: 'REPEATED', description: '標籤陣列' },
  { name: 'weight', type: 'INT64', mode: 'REQUIRED', description: '相對抽樣權重（≥1）' },
  { name: 'is_active', type: 'BOOL', mode: 'REQUIRED', description: '是否參與抽樣' },
  { name: 'exported_at', type: 'TIMESTAMP', mode: 'REQUIRED', description: '目錄匯出時間' },
]);

/**
 * fact_card_draw — 每次抽卡／產卡事件（權重快照便於還原抽樣分布）
 * 建議 partition: DATE(drawn_at) ；cluster: season_id, scene_id, action_id
 */
export const BQ_FACT_CARD_DRAW_SCHEMA = /** @type {BqField[]} */ ([
  { name: 'event_id', type: 'STRING', mode: 'REQUIRED', description: '事件 UUID' },
  { name: 'drawn_at', type: 'TIMESTAMP', mode: 'REQUIRED', description: '抽樣時間' },
  { name: 'season_id', type: 'STRING', mode: 'REQUIRED', description: '季包' },
  { name: 'card_id', type: 'STRING', mode: 'NULLABLE', description: '前端卡牌 id' },
  { name: 'party_size', type: 'INT64', mode: 'REQUIRED', description: '1|2|3|4' },
  { name: 'character_ids', type: 'STRING', mode: 'REPEATED', description: '角色 id 陣列' },
  { name: 'scene_id', type: 'STRING', mode: 'REQUIRED', description: '抽中場景' },
  { name: 'universal_slot_id', type: 'STRING', mode: 'NULLABLE', description: '抽中通用槽位' },
  { name: 'action_id', type: 'STRING', mode: 'REQUIRED', description: '抽中動作' },
  { name: 'emotion_id', type: 'STRING', mode: 'REQUIRED', description: '抽中情緒' },
  { name: 'scene_weight', type: 'INT64', mode: 'REQUIRED', description: '抽樣當下場景權重快照' },
  { name: 'slot_weight', type: 'INT64', mode: 'NULLABLE', description: '抽樣當下槽位權重快照' },
  { name: 'action_weight', type: 'INT64', mode: 'REQUIRED', description: '抽樣當下動作權重快照' },
  { name: 'emotion_weight', type: 'INT64', mode: 'REQUIRED', description: '抽樣當下情緒權重快照' },
  { name: 'used_universal_crossover', type: 'BOOL', mode: 'NULLABLE', description: '是否走萬用微跨界' },
  { name: 'crossover_rate', type: 'FLOAT64', mode: 'NULLABLE', description: '當下 SCENE_ACTION_CROSSOVER_RATE' },
  { name: 'source', type: 'STRING', mode: 'NULLABLE', description: 'daily_reward|bootstrap|remix|…' },
]);

const nowIso = () => new Date().toISOString();

export const toBqSeasonRow = ({ isActive = true, exportedAt = nowIso() } = {}) => ({
  season_id: SEASON.id,
  season_number: SEASON.number,
  title_zh: SEASON.title,
  title_en: SEASON.titleEn || null,
  blurb_zh: SEASON.blurb || null,
  is_active: Boolean(isActive),
  exported_at: exportedAt,
});

export const toBqSceneRow = (scene, { exportedAt = nowIso() } = {}) => ({
  season_id: SEASON.id,
  scene_id: scene.id,
  universal_slot_id: resolveSceneSlotId(scene),
  label_zh: scene.labelZh || scene.label,
  label_en: scene.label || null,
  vibe: scene.vibe || scene.sport || null,
  tags: [...(scene.tags || [])],
  weight: normalizeCatalogWeight(scene.weight, DEFAULT_CATALOG_WEIGHT),
  allowed_action_ids: [...(scene.allowedActions || [])],
  prompt_keywords: scene.promptKeywords || null,
  is_active: true,
  exported_at: exportedAt,
});

export const toBqActionRow = (action, { exportedAt = nowIso() } = {}) => ({
  season_id: SEASON.id,
  action_id: action.id,
  label_zh: action.labelZh || action.label,
  label_en: action.label || null,
  vibe: action.vibe || action.sport || null,
  tags: [...(action.tags || [])],
  weight: normalizeCatalogWeight(action.weight, DEFAULT_CATALOG_WEIGHT),
  is_universal:
    action.sport === 'universal' ||
    (action.tags || []).includes('universal') ||
    UNIVERSAL_ACTION_IDS.includes(action.id),
  action_prompt: action.prompt || null,
  prop_prompt: action.propPrompt || null,
  is_active: true,
  exported_at: exportedAt,
});

export const toBqEmotionRow = (emotion, { exportedAt = nowIso() } = {}) => ({
  season_id: SEASON.id,
  emotion_id: emotion.id,
  label_zh: emotion.labelZh || emotion.label,
  label_en: emotion.label || null,
  tags: [...(emotion.tags || [])],
  weight: normalizeCatalogWeight(emotion.weight, DEFAULT_CATALOG_WEIGHT),
  is_active: true,
  exported_at: exportedAt,
});

/**
 * 從 recipe 組 fact_card_draw 列（尚未含 event_id／drawn_at 可由呼叫端補）
 * @param {object} recipe
 * @param {{ cardId?: string, source?: string, usedUniversalCrossover?: boolean }} [meta]
 */
export const toBqCardDrawRow = (recipe, meta = {}) => ({
  event_id: meta.eventId || null,
  drawn_at: meta.drawnAt || nowIso(),
  season_id: recipe.seasonId || SEASON.id,
  card_id: meta.cardId || null,
  party_size: recipe.partySize,
  character_ids: [...(recipe.characterIds || [])],
  scene_id: recipe.sceneId,
  universal_slot_id: recipe.slotId || null,
  action_id: recipe.actionId,
  emotion_id: recipe.emotionId,
  scene_weight: normalizeCatalogWeight(recipe.sceneWeight),
  slot_weight: recipe.slotWeight == null ? null : normalizeCatalogWeight(recipe.slotWeight),
  action_weight: normalizeCatalogWeight(recipe.actionWeight),
  emotion_weight: normalizeCatalogWeight(recipe.emotionWeight),
  used_universal_crossover:
    meta.usedUniversalCrossover == null ? null : Boolean(meta.usedUniversalCrossover),
  crossover_rate: SCENE_ACTION_CROSSOVER_RATE,
  source: meta.source || null,
});

/** 匯出目前季包完整目錄（可直接 JSON → BQ load） */
export const exportBqCatalogSnapshot = () => {
  const exportedAt = nowIso();
  return {
    exported_at: exportedAt,
    season: toBqSeasonRow({ exportedAt }),
    scenes: SCENES.map((s) => toBqSceneRow(s, { exportedAt })),
    universal_slots: UNIVERSAL_SLOTS.map((s) => ({
      slot_id: s.id,
      order: s.order,
      category: s.category,
      name_zh: s.nameZh,
      name_en: s.nameEn,
      weight: normalizeCatalogWeight(s.weight),
      exported_at: exportedAt,
    })),
    actions: ACTIONS.map((a) => toBqActionRow(a, { exportedAt })),
    emotions: EMOTIONS.map((e) => toBqEmotionRow(e, { exportedAt })),
    schemas: {
      dim_season: BQ_DIM_SEASON_SCHEMA,
      dim_scene: BQ_DIM_SCENE_SCHEMA,
      dim_action: BQ_DIM_ACTION_SCHEMA,
      dim_emotion: BQ_DIM_EMOTION_SCHEMA,
      fact_card_draw: BQ_FACT_CARD_DRAW_SCHEMA,
    },
  };
};
