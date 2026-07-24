import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  normalizePanelBubbles,
  bubblesFromPlainLine,
  composePanelImage,
  MANGA_PANEL_COMPOSE_WIDTH,
} from '../../lib/speechBubble.js';
import { attachFacesToBubbles, FACE_SOURCE_YOLO } from '../../lib/faceDetection.js';
import CardImagePeek from '../CardImagePeek.jsx';

/**
 * 與匯出圖同一套 Canvas 合成（1080×1440 定案基準）
 * peekEnabled：自動懸浮放大（編輯對白時應關閉）
 */
export default function ComposedPanelImage({
  card,
  bubbles = null,
  plainLine = '',
  alt = '',
  className = 'h-full w-full object-contain object-center',
  peekEnabled = true,
}) {
  const normalized = useMemo(() => {
    if (bubbles?.length) return normalizePanelBubbles(card, bubbles);
    if (String(plainLine || '').trim()) return bubblesFromPlainLine(card, plainLine);
    return [];
  }, [card, bubbles, plainLine]);

  // 臉部除錯標記：僅在 localStorage bwDebugBubbles=1 時開啟（預設關閉）
  const debugFaces = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('bwDebugBubbles') === '1';
    } catch {
      return false;
    }
  }, []);

  const fingerprint = useMemo(
    () =>
      JSON.stringify({
        v: 20,
        dbg: debugFaces,
        img: card?.imageUrl || '',
        w: MANGA_PANEL_COMPOSE_WIDTH,
        bubbles: normalized.map((b) => ({
          id: b.speakerId,
          t: b.text,
          f: b.face?.source || null,
          m: b.manualPos || null,
          s: b.slot,
        })),
      }),
    [card?.imageUrl, normalized, debugFaces]
  );

  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    if (!normalized.length) {
      setSrc(null);
      return undefined;
    }

    (async () => {
      try {
        const quickUrl = await composePanelImage(card, normalized, {
          width: MANGA_PANEL_COMPOSE_WIDTH,
          mime: 'image/jpeg',
          quality: 0.92,
          debugFaces,
        });
        if (cancelled) return;
        setSrc(quickUrl);

        const needsDetect = normalized.some(
          (b) => b.text && (!b.face || b.face.source !== FACE_SOURCE_YOLO)
        );
        if (!needsDetect) return;

        const withFaces = await attachFacesToBubbles(card, normalized, {
          force: false,
        });
        if (cancelled) return;
        const finalUrl = await composePanelImage(card, withFaces, {
          width: MANGA_PANEL_COMPOSE_WIDTH,
          mime: 'image/jpeg',
          quality: 0.92,
          debugFaces,
        });
        if (!cancelled) setSrc(finalUrl);
      } catch {
        if (!cancelled) {
          setSrc(null);
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [card, normalized, fingerprint, debugFaces]);

  const imgClass = `${className}${!src && card?.imageUrl ? ` grayscale${failed ? ' opacity-80' : ''}` : ''}`;
  const imgSrc = src || card?.imageUrl || null;

  if (!imgSrc) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-ink-100 text-xs text-ink-400">
        無分鏡圖
      </div>
    );
  }

  return (
    <CardImagePeek
      src={imgSrc}
      alt={alt}
      className="h-full w-full"
      imgClassName={imgClass}
      disabled={!peekEnabled}
    />
  );
}
