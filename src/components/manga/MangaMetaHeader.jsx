import React from 'react';
import { formatStoryDate } from '../../lib/storyMeta.js';

/**
 * 漫畫頁首 — 以主題為標題；不強調誰跟誰。
 */
export default function MangaMetaHeader({ meta }) {
  if (!meta) return null;

  const dateLabel = formatStoryDate(meta.createdAt);
  const headline = meta.theme || meta.title || '織泡劇場';

  return (
    <header className="manga-meta-header mb-4 border-2 border-ink-950 bg-ink-50/80 px-4 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
        {meta.brand || 'BubbleWeave 織泡劇場'}
      </p>
      <h3 className="mt-1 font-display text-lg font-bold leading-snug text-ink-950">
        {headline}
      </h3>
      <dl className="mt-3 space-y-1 text-xs text-ink-600">
        {meta.author && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-ink-500">創作者</dt>
            <dd>{meta.author}</dd>
          </div>
        )}
        {dateLabel && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-ink-500">創作時間</dt>
            <dd>{dateLabel}</dd>
          </div>
        )}
        {meta.panelCount > 0 && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-ink-500">分鏡</dt>
            <dd>{meta.panelCount} 格</dd>
          </div>
        )}
      </dl>
    </header>
  );
}
