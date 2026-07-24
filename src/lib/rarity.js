/**
 * 卡片稀有度：公式為主（人數＋槽位），非獨立抽獎。
 * 標誌樣式可選；每套 5 級。
 */

/** @typedef {'n'|'r'|'sr'|'ssr'|'ur'} RarityTier */
/** @typedef {'ink'|'foil'|'seal'} BadgeStyleId */

/** 高權重槽：達四人時可升 UR */
export const HIGH_SLOT_IDS = new Set([
  'STREET_FOOD',
  'TRANSIT_PUBLIC',
  'TRANSIT_PERSONAL',
  'LANDMARK_SPOT',
]);

export const RARITY_TIERS = [
  { id: 'n', rank: 1, label: 'N', labelZh: '普通' },
  { id: 'r', rank: 2, label: 'R', labelZh: '稀有' },
  { id: 'sr', rank: 3, label: 'SR', labelZh: '超稀' },
  { id: 'ssr', rank: 4, label: 'SSR', labelZh: '史詩' },
  { id: 'ur', rank: 5, label: 'UR', labelZh: '傳說' },
];

export const BADGE_STYLES = [
  {
    id: 'ink',
    label: '墨印',
    hint: '工房墨線角標，低調好讀',
  },
  {
    id: 'foil',
    label: '箔星',
    hint: '斜切箔邊＋星點，偏收藏感',
  },
  {
    id: 'seal',
    label: '朱印',
    hint: '圓形印章，偏刊物封面',
  },
];

export const DEFAULT_BADGE_STYLE = 'ink';

const TIER_BY_ID = Object.fromEntries(RARITY_TIERS.map((t) => [t.id, t]));

export const getRarityMeta = (tierId) => TIER_BY_ID[tierId] || TIER_BY_ID.n;

/**
 * 公式：
 * 1人→N / 2→R / 3→SR / 4→SSR；4人且高權重槽→UR
 * @param {{ characterIds?: string[], partySize?: number, recipe?: { slotId?: string, slotWeight?: number } }} card
 * @returns {RarityTier}
 */
export const computeRarityTier = (card) => {
  const n = Math.max(
    1,
    Number(card?.partySize) || (card?.characterIds || []).length || 1
  );
  const slotId = card?.recipe?.slotId || '';
  const slotWeight = Number(card?.recipe?.slotWeight) || 0;
  const highSlot = HIGH_SLOT_IDS.has(slotId) || slotWeight >= 24;

  if (n >= 4 && highSlot) return 'ur';
  if (n >= 4) return 'ssr';
  if (n === 3) return 'sr';
  if (n === 2) return 'r';
  return 'n';
};

/**
 * @param {object} card
 * @returns {{ tier: RarityTier, rank: number, label: string, labelZh: string }}
 */
export const attachRarity = (card) => {
  const tier = computeRarityTier(card);
  const meta = getRarityMeta(tier);
  return {
    ...card,
    rarity: {
      tier: meta.id,
      rank: meta.rank,
      label: meta.label,
      labelZh: meta.labelZh,
    },
  };
};

/**
 * 玩家收藏等級（依靈感池「含我」卡數）— 與卡片稀有度同一套五級語彙
 * @param {number} meCardCount
 */
export const computePlayerRank = (meCardCount = 0) => {
  const n = Math.max(0, Math.floor(Number(meCardCount) || 0));
  let tier = 'n';
  if (n >= 30) tier = 'ur';
  else if (n >= 18) tier = 'ssr';
  else if (n >= 9) tier = 'sr';
  else if (n >= 3) tier = 'r';
  const meta = getRarityMeta(tier);
  const nextAt =
    tier === 'n' ? 3 : tier === 'r' ? 9 : tier === 'sr' ? 18 : tier === 'ssr' ? 30 : null;
  return {
    ...meta,
    meCardCount: n,
    nextAt,
    progress:
      nextAt == null
        ? 1
        : Math.min(1, n / nextAt),
  };
};
