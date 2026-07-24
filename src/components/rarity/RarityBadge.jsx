import React from 'react';
import { getRarityMeta, DEFAULT_BADGE_STYLE } from '../../lib/rarity.js';

/**
 * 稀有度角標 — 3 套視覺 × 5 級（純 CSS，後製疊加）
 */
export default function RarityBadge({
  tier = 'n',
  styleId = DEFAULT_BADGE_STYLE,
  size = 'md',
  className = '',
}) {
  const meta = getRarityMeta(tier);
  const style = ['ink', 'foil', 'seal'].includes(styleId) ? styleId : DEFAULT_BADGE_STYLE;
  const sizeClass =
    size === 'sm'
      ? 'text-[9px] min-w-[1.6rem] px-1 py-0.5'
      : size === 'lg'
        ? 'text-xs min-w-[2.4rem] px-2 py-1'
        : 'text-[10px] min-w-[2rem] px-1.5 py-0.5';

  const tierTone = {
    n: 'tier-n',
    r: 'tier-r',
    sr: 'tier-sr',
    ssr: 'tier-ssr',
    ur: 'tier-ur',
  }[meta.id] || 'tier-n';

  return (
    <span
      className={`rarity-badge rarity-${style} ${tierTone} ${sizeClass} ${className}`}
      title={`${meta.labelZh}（${meta.label}）`}
      aria-label={`稀有度 ${meta.labelZh}`}
    >
      <span className="rarity-badge__label">{meta.label}</span>
    </span>
  );
}

/** 個人卡內：五級預覽列 */
export function RarityStylePreview({ styleId, activeTier = ['n', 'r', 'sr', 'ssr', 'ur'] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {activeTier.map((t) => (
        <RarityBadge key={t} tier={t} styleId={styleId} size="sm" />
      ))}
    </div>
  );
}
