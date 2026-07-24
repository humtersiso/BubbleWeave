import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildMangaPanelLines } from '../../lib/storyText.js';
import { getAdaptiveMangaCols, getMangaGridCols } from '../../lib/mangaGridLayout.js';
import MangaMetaHeader from './MangaMetaHeader.jsx';
import MangaPanelFrame from './MangaPanelFrame.jsx';

function MangaPanel({ card, index, line, bubbles }) {
  return (
    <section className="manga-strip-panel min-w-0">
      <div className="manga-panel-frame flex flex-col overflow-hidden border-2 border-ink-950 bg-white shadow-card">
        <MangaPanelFrame
          card={card}
          index={index}
          bubbles={bubbles}
          plainLine={line}
          showCast={false}
        />
      </div>
    </section>
  );
}

/**
 * 漫畫條 — 與劇場單格、匯出圖共用 MangaPanelFrame
 * adaptive：依容器寬度決定欄數（桌面橫向優先一列）
 */
export default function MangaStripView({
  cards = [],
  storyText = '',
  dialogues = null,
  panelBubbles = null,
  meta = null,
  title = '',
  showScript = false,
  compact = false,
  columns = null,
  adaptive = true,
  className = '',
  id,
}) {
  const gridRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!adaptive || columns != null) return undefined;
    const el = gridRef.current;
    if (!el) return undefined;
    const measure = () => setContainerWidth(el.clientWidth || 0);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [adaptive, columns, cards.length]);

  const { panelLines, fullScript } = useMemo(() => {
    if (dialogues?.length) {
      return {
        panelLines: cards.map((_, i) => dialogues[i] || ''),
        fullScript: storyText?.trim() || joinFromDialogues(dialogues),
      };
    }
    return buildMangaPanelLines(storyText, cards.length);
  }, [cards, storyText, dialogues]);

  const hasDialogue =
    panelLines.some((l) => l?.trim()) ||
    fullScript ||
    panelBubbles?.some((b) => b?.length);

  const gridCols =
    columns != null
      ? columns === 1
        ? 1
        : getMangaGridCols(cards.length)
      : adaptive
        ? getAdaptiveMangaCols(cards.length, containerWidth, {
            minPanelWidth: compact ? 120 : 148,
            gap: compact ? 12 : 16,
          })
        : getMangaGridCols(cards.length);

  const colClassMap = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };
  const colClass = colClassMap[gridCols] || 'grid-cols-2';

  return (
    <article
      id={id}
      ref={gridRef}
      className={`manga-strip-vertical mx-auto w-full max-w-full ${className}`}
      data-manga-columns={gridCols}
    >
      {meta ? (
        <MangaMetaHeader meta={meta} />
      ) : (
        title && (
          <header className="mb-4 border-b-2 border-ink-950 pb-3 text-center">
            <h3 className="font-display text-lg font-bold leading-snug">{title}</h3>
          </header>
        )
      )}

      <div className={`manga-strip-grid grid w-full items-start gap-3 md:gap-4 ${colClass}`}>
        {cards.map((card, index) => (
          <MangaPanel
            key={card.id || `panel-${index}`}
            card={card}
            index={index}
            line={panelLines[index]?.trim()}
            bubbles={panelBubbles?.[index] || null}
          />
        ))}
      </div>

      {showScript && fullScript && (
        <footer className="mt-6 rounded-xl border-2 border-ink-950 bg-ink-50/60 p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-500">
            短對白一覽
          </p>
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-ink-800">
            {fullScript}
          </div>
        </footer>
      )}

      {!hasDialogue && cards.length > 0 && (
        <p className="mt-4 text-center text-sm italic text-ink-400">尚未撰寫故事</p>
      )}
    </article>
  );
}

function joinFromDialogues(dialogues) {
  return (dialogues || [])
    .map((l) => l?.trim())
    .filter(Boolean)
    .join('\n\n');
}
