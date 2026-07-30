import React from 'react';
import RarityBadge from '../../components/rarity/RarityBadge.jsx';
import { BADGE_STYLES, DEFAULT_BADGE_STYLE } from '../../lib/rarity.js';
import { FORTUNE_TIERS } from '../data/fortune.js';

export const BADGE_STYLE_STORAGE_KEY = 'kujiwords.badgeStyle';

/** 籤級 → V1 稀有度色階（只借設計色，畫面文字仍是籤級） */
export const fortuneToVisualTier = (fortuneId) => {
  switch (fortuneId) {
    case 'dai_kichi':
      return 'ur';
    case 'kichi':
      return 'ssr';
    case 'chu_kichi':
      return 'sr';
    case 'sho_kichi':
      return 'r';
    case 'kyo':
      return 'n';
    case 'dai_kyo':
      return 'n';
    default:
      return 'r';
  }
};

export const loadBadgeStyle = () => {
  // 已定箔星；舊 localStorage 值一律忽略
  return 'foil';
};

export const saveBadgeStyle = (id) => {
  try {
    const ok = BADGE_STYLES.some((s) => s.id === id) ? id : DEFAULT_BADGE_STYLE;
    localStorage.setItem(BADGE_STYLE_STORAGE_KEY, ok);
  } catch {
    /* ignore */
  }
};

/** 限動匯出近似色（對齊 ink / foil / seal） */
export const resolveBadgeExportColors = (fortuneId, styleId = 'ink') => {
  const tier = fortuneToVisualTier(fortuneId);
  const ink = {
    n: { fill: '#fffef8', stroke: '#78716c', text: '#78716c' },
    r: { fill: '#fffef8', stroke: '#2563eb', text: '#2563eb' },
    sr: { fill: '#fffef8', stroke: '#7c3aed', text: '#7c3aed' },
    ssr: { fill: '#fffef8', stroke: '#c2410c', text: '#c2410c' },
    ur: { fill: '#fff7ed', stroke: '#b45309', text: '#b45309' },
  };
  const foil = {
    n: { fill: '#e7e5e4', stroke: '#1c1917', text: '#1c1917' },
    r: { fill: '#93c5fd', stroke: '#1e3a8a', text: '#1e3a8a' },
    sr: { fill: '#c4b5fd', stroke: '#5b21b6', text: '#5b21b6' },
    ssr: { fill: '#fdba74', stroke: '#9a3412', text: '#9a3412' },
    ur: { fill: '#fbbf24', stroke: '#92400e', text: '#92400e' },
  };
  const seal = {
    n: { fill: 'rgba(255,255,255,0.92)', stroke: '#57534e', text: '#57534e' },
    r: { fill: 'rgba(255,255,255,0.92)', stroke: '#1d4ed8', text: '#1d4ed8' },
    sr: { fill: 'rgba(255,255,255,0.92)', stroke: '#6d28d9', text: '#6d28d9' },
    ssr: { fill: 'rgba(255,255,255,0.92)', stroke: '#b91c1c', text: '#b91c1c' },
    ur: { fill: 'rgba(255,255,255,0.92)', stroke: '#a16207', text: '#a16207' },
  };
  const pack = styleId === 'foil' ? foil : styleId === 'seal' ? seal : ink;
  return pack[tier] || pack.r;
};

/**
 * 圖片左上角籤運角標：V1 稀有度視覺（墨印／箔星／朱印），文字為籤級
 */
export default function FortuneCornerBadge({
  fortune,
  variant = DEFAULT_BADGE_STYLE,
  className = '',
  size = 'lg',
}) {
  if (!fortune?.label) return null;
  const styleId = ['ink', 'foil', 'seal'].includes(variant)
    ? variant
    : DEFAULT_BADGE_STYLE;
  const tier = fortuneToVisualTier(fortune.id);

  return (
    <RarityBadge
      tier={tier}
      styleId={styleId}
      size={size}
      label={fortune.label}
      className={`absolute left-2 top-2 z-20 ${className}`}
    />
  );
}

