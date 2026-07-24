import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  normalizePanelBubbles,
  bubblesFromPlainLine,
  layoutPanelBubbles,
  drawSpeechBubble,
  resolveCardPartySize,
  resolveContentFit,
  MANGA_PANEL_COMPOSE_WIDTH,
  MANGA_PANEL_COMPOSE_HEIGHT,
} from '../../lib/speechBubble.js';

/**
 * 調整／預覽對話框：固定以 1080×1440 排版＋Canvas 繪製，再縮放到格內
 * → 與 ComposedPanelImage 合成結果同像素比例（無 CSS 框寬落差）
 */
export default function SpeechBubbleOverlay({
  card,
  bubbles = null,
  plainLine = '',
  interactive = false,
  onBubbleMove,
}) {
  const list = useMemo(() => {
    if (bubbles?.length) return normalizePanelBubbles(card, bubbles);
    return bubblesFromPlainLine(card, plainLine);
  }, [card, bubbles, plainLine]);

  const partySize = resolveCardPartySize(card);
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const [panelSize, setPanelSize] = useState({ w: 0, h: 0 });
  const [natSize, setNatSize] = useState({ w: 0, h: 0 });
  const [dragLive, setDragLive] = useState(null);
  const dragRef = useRef(null);

  const W = MANGA_PANEL_COMPOSE_WIDTH;
  const H = MANGA_PANEL_COMPOSE_HEIGHT;

  useEffect(() => {
    const src = card?.imageUrl;
    if (!src) {
      setNatSize({ w: 0, h: 0 });
      return undefined;
    }
    let cancelled = false;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (cancelled) return;
      setNatSize({
        w: img.naturalWidth || img.width || 0,
        h: img.naturalHeight || img.height || 0,
      });
    };
    img.onerror = () => {
      if (!cancelled) setNatSize({ w: 0, h: 0 });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [card?.imageUrl]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const measure = () => {
      const box = root.getBoundingClientRect();
      setPanelSize({
        w: Math.max(0, Math.round(box.width)),
        h: Math.max(0, Math.round(box.height)),
      });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(root);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [list.length]);

  const contentFit = useMemo(() => {
    if (natSize.w < 2 || natSize.h < 2) {
      return resolveContentFit(W, H, W, H);
    }
    return resolveContentFit(W, H, natSize.w, natSize.h);
  }, [natSize, W, H]);

  const layouts = useMemo(() => {
    if (!list.length) return [];
    const withLive = list.map((b, i) => {
      if (dragLive?.index === i) {
        return { ...b, manualPos: { x: dragLive.x, y: dragLive.y } };
      }
      return b;
    });
    return layoutPanelBubbles(W, H, withLive, { partySize, contentFit });
  }, [list, partySize, contentFit, dragLive, W, H]);

  // Canvas 繪製（邏輯座標固定 1080×1440）
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layouts.length) return;
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const { typo, layout } of layouts) {
      drawSpeechBubble(
        ctx,
        {
          x: layout.x,
          y: layout.y,
          w: layout.w,
          h: layout.h,
          panelW: W,
        },
        typo
      );
    }
  }, [layouts, W, H]);

  const onBubblePointerDown = (e, index) => {
    if (!interactive || !onBubbleMove) return;
    e.stopPropagation();
    e.preventDefault();
    const item = layouts[index];
    if (!item || panelSize.w < 2) return;
    const { layout } = item;
    const originX = layout.x / W;
    const originY = layout.y / H;
    const rootBox = rootRef.current.getBoundingClientRect();
    const grabDx = (e.clientX - rootBox.left) / panelSize.w - originX;
    const grabDy = (e.clientY - rootBox.top) / panelSize.h - originY;
    dragRef.current = { index, grabDx, grabDy, x: originX, y: originY };
    setDragLive({ index, x: originX, y: originY });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onBubblePointerMove = (e) => {
    const d = dragRef.current;
    if (!d || panelSize.w < 2) return;
    e.stopPropagation();
    const root = rootRef.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    const x = Math.min(0.9, Math.max(0.02, (e.clientX - box.left) / panelSize.w - d.grabDx));
    const y = Math.min(0.9, Math.max(0.02, (e.clientY - box.top) / panelSize.h - d.grabDy));
    dragRef.current = { ...d, x, y };
    setDragLive({ index: d.index, x, y });
  };

  const endDrag = (e) => {
    const d = dragRef.current;
    if (!d) return;
    e?.stopPropagation?.();
    const pos = {
      x: Number.isFinite(d.x) ? d.x : 0.1,
      y: Number.isFinite(d.y) ? d.y : 0.1,
    };
    const bubble = list[d.index];
    dragRef.current = null;
    setDragLive(null);
    if (bubble && onBubbleMove) {
      onBubbleMove({
        speakerId: bubble.speakerId,
        index: d.index,
        manualPos: pos,
      });
    }
  };

  if (!list.length) return null;

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 z-[6] overflow-hidden ${
        interactive ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ width: '100%', height: '100%' }}
        aria-hidden
      />
      {/* 透明熱區：座標以 1080 基準換算成百分比，與 Canvas 同位置 */}
      {interactive
        ? layouts.map(({ bubble: b, layout }, i) => (
            <div
              key={`hit-${b.speakerId}-${i}`}
              className={`absolute ${dragLive?.index === i ? 'z-[9]' : 'z-[7]'}`}
              style={{
                left: `${(layout.x / W) * 100}%`,
                top: `${(layout.y / H) * 100}%`,
                width: `${(layout.w / W) * 100}%`,
                height: `${(layout.h / H) * 100}%`,
                cursor: 'grab',
                touchAction: 'none',
              }}
              onPointerDown={(e) => onBubblePointerDown(e, i)}
              onPointerMove={onBubblePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          ))
        : null}
    </div>
  );
}
