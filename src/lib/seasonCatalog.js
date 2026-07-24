/**
 * Layer 1 · Data：賽季設定載入 + 通用槽位分組
 */

import taiwanSeason from '../data/seasons/s1_taiwan.json';
import {
  UNIVERSAL_SLOTS,
  UNIVERSAL_SLOTS_BY_ID,
  normalizeSlotId,
} from './universalSlots.js';

const SEASON_REGISTRY = {
  s1_taiwan: taiwanSeason,
};

/** 目前營運季 id */
export const ACTIVE_SEASON_ID = 's1_taiwan';

/**
 * @param {string} [seasonId]
 */
export const getSeasonConfig = (seasonId = ACTIVE_SEASON_ID) =>
  SEASON_REGISTRY[seasonId] || taiwanSeason;

/** PRD／UI 用季包 meta */
export const getActiveSeasonMeta = () => {
  const cfg = getSeasonConfig();
  return {
    id: cfg.id,
    number: cfg.number,
    title: cfg.title,
    titleEn: cfg.titleEn,
    blurb: cfg.blurb,
    culturalVibes: cfg.culturalVibes || '',
  };
};

/**
 * @param {object} scene
 * @param {string} [seasonId]
 */
export const resolveSceneSlotId = (scene, seasonId = ACTIVE_SEASON_ID) => {
  if (scene?.slotId) return normalizeSlotId(scene.slotId) || scene.slotId;
  const cfg = getSeasonConfig(seasonId);
  const map = cfg.sceneSlotMap || {};
  return normalizeSlotId(map[scene?.id]) || 'TRANSIT_PUBLIC';
};

/**
 * @param {object[]} scenes
 * @param {string} [seasonId]
 */
export const groupScenesBySlot = (scenes, seasonId = ACTIVE_SEASON_ID) => {
  const groups = Object.fromEntries(UNIVERSAL_SLOTS.map((s) => [s.id, []]));
  for (const scene of scenes || []) {
    const slotId = resolveSceneSlotId(scene, seasonId);
    if (!groups[slotId]) groups[slotId] = [];
    groups[slotId].push(scene);
  }
  return groups;
};

export const getSlotForScene = (scene, seasonId = ACTIVE_SEASON_ID) => {
  const slotId = resolveSceneSlotId(scene, seasonId);
  return UNIVERSAL_SLOTS_BY_ID[slotId] || null;
};

export { UNIVERSAL_SLOTS, UNIVERSAL_SLOTS_BY_ID, normalizeSlotId };
