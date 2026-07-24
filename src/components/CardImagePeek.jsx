import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const LONG_PRESS_MS = 380;
/** 相對原卡等比例放大（完整原圖，不裁切） */
const PEEK_SCALE = 2.2;
const PEEK_MIN_W = 200;
const PEEK_MAX_W = 420;

/**
 * 在原圖中心置中放大（不跟隨游標／手指位移）。
 * Portal 掛 body，避免劇場 dnd transform／overflow 裁切。
 */
export default function CardImagePeek({
  src,
  alt = '',
  className = '',
  imgClassName = '',
  disabled = false,
  children,
}) {
  const rootRef = useRef(null);
  const timerRef = useRef(0);
  const peekArmedRef = useRef(false);
  const [active, setActive] = useState(false);
  const [box, setBox] = useState(null);
  const finePointer =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches;

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
  };

  /** 只對齊原圖中心，不依游標、不因螢幕邊緣平移 */
  const measure = useCallback(() => {
    const el = rootRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const baseW = Math.max(r.width, 48);
    let w = Math.round(baseW * PEEK_SCALE);
    w = Math.min(PEEK_MAX_W, Math.max(PEEK_MIN_W, w));
    const h = Math.round(w * (4 / 3));
    return {
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      width: w,
      height: h,
    };
  }, []);

  const show = useCallback(() => {
    if (disabled || !src) return;
    const next = measure();
    if (!next) return;
    peekArmedRef.current = true;
    setBox(next);
    setActive(true);
  }, [disabled, src, measure]);

  const hide = useCallback(() => {
    clearTimer();
    setActive(false);
    setBox(null);
  }, []);

  useEffect(() => () => clearTimer(), []);

  useLayoutEffect(() => {
    if (!active) return undefined;
    const sync = () => {
      const next = measure();
      if (next) setBox(next);
    };
    sync();
    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [active, measure]);

  const onPointerEnter = (e) => {
    if (!finePointer || e.pointerType === 'touch') return;
    show();
  };

  const onPointerLeave = () => {
    if (finePointer) hide();
  };

  const onPointerDown = (e) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    clearTimer();
    peekArmedRef.current = false;
    timerRef.current = window.setTimeout(() => {
      show();
    }, LONG_PRESS_MS);
  };

  const onPointerUp = () => {
    clearTimer();
    if (!finePointer) hide();
  };

  const onClickCapture = (e) => {
    if (peekArmedRef.current && !finePointer) {
      e.preventDefault();
      e.stopPropagation();
      peekArmedRef.current = false;
    }
  };

  const onContextMenu = (e) => {
    e.preventDefault();
  };

  const peekLayer =
    active && box && src
      ? createPortal(
          <div
            className="pointer-events-none fixed z-[200] overflow-hidden rounded-xl border-2 border-ink-950 bg-[var(--paper,#f7f4ef)] shadow-lift"
            style={{
              left: box.cx,
              top: box.cy,
              width: box.width,
              height: box.height,
              transform: 'translate(-50%, -50%)',
            }}
            aria-hidden
          >
            <img
              src={src}
              alt=""
              draggable={false}
              className="h-full w-full object-contain object-center grayscale"
            />
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        ref={rootRef}
        className={`card-image-peek relative ${className}`}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        onContextMenu={onContextMenu}
        style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
      >
        {children || (
          <img src={src} alt={alt} draggable={false} className={imgClassName} />
        )}
      </div>
      {peekLayer}
    </>
  );
}
