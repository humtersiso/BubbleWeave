import React from 'react';
import SpeechBubbleOverlay from './SpeechBubbleOverlay.jsx';
import ComposedPanelImage from './ComposedPanelImage.jsx';

/**
 * 劇場／最新發布共用單格畫面（3:4／1080×1440 基準）
 */
export default function MangaPanelFrame({
  card,
  index = 0,
  bubbles = null,
  plainLine = '',
  showPageNum = true,
  showCast = true,
  composeBubbles = true,
  bubblesInteractive = false,
  onBubbleMove = null,
  /** 自動懸浮放大；編輯對白時請關閉 */
  peekEnabled = true,
  imageSlot = null,
  overlaySlot = null,
  className = '',
}) {
  const who =
    (card?.castMembers || []).map((m) => m.nameZh).join('＋') ||
    card?.packNameZh ||
    '';
  const hasBubbles = Boolean(bubbles?.length || String(plainLine || '').trim());
  const alt = card?.scene || `第 ${index + 1} 格`;

  return (
    <div
      className={`group relative aspect-[3/4] shrink-0 overflow-hidden bg-[var(--strip-bg)] ${className}`}
    >
      {composeBubbles ? (
        <ComposedPanelImage
          card={card}
          bubbles={bubbles}
          plainLine={plainLine}
          alt={alt}
          peekEnabled={peekEnabled}
        />
      ) : (
        <>
          {imageSlot ||
            (card?.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={alt}
                className="manga-panel-image h-full w-full object-contain object-center grayscale"
                draggable={false}
                loading="eager"
                decoding="async"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-ink-100 text-xs text-ink-400">
                無分鏡圖
              </div>
            ))}
          <SpeechBubbleOverlay
            card={card}
            bubbles={bubbles}
            plainLine={plainLine}
            interactive={bubblesInteractive}
            onBubbleMove={onBubbleMove}
          />
        </>
      )}

      {overlaySlot}

      {showPageNum && (
        <span
          className={`manga-page-num absolute z-[7] rounded-sm border-2 border-ink-950 bg-white px-2 py-0.5 text-[11px] font-bold ${
            hasBubbles ? 'bottom-2 left-2' : 'left-2 top-2'
          }`}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
      )}

      {showCast && who ? (
        <span className="absolute bottom-2 right-2 z-[7] rounded-sm border border-ink-950 bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-ink-600">
          {who}
        </span>
      ) : null}
    </div>
  );
}
