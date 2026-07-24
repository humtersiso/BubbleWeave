/**
 * Runtime cast layer — reads the editable Character Bible.
 * 編輯人物請改：src/data/character-bible.js
 */

import {
  CHARACTER_BIBLE,
  PARTY_SIZE_DISTRIBUTION,
  PARTY_SIZE_OPTIONS,
} from '../data/character-bible.js';

/** 完整保留 bible 欄位（含 identityHardLock），不可漏傳 */
export const CHARACTERS = CHARACTER_BIBLE.map((c) => ({ ...c }));

export const CHARACTERS_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

export { PARTY_SIZE_OPTIONS, PARTY_SIZE_DISTRIBUTION, CHARACTER_BIBLE };

/** 啟動倉庫總卡數（計畫：7 天 × 3 張 = 21） */
export const TOTAL_BOOTSTRAP_CARDS = 21;

/** @deprecated pair concept removed — free mix only */
export const CHARACTER_PAIRS = [];
export const PAIRS_BY_ID = {};
export const getPairPartner = () => null;

/** @deprecated */
export const CHAPTER_PACKS = CHARACTERS.map((c) => ({
  id: c.id,
  nameZh: c.nameZh,
  nameEn: c.name,
  blurb: c.vibe,
  cast: { id: c.id, members: [c] },
}));
