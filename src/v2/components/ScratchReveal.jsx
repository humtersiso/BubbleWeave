import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Canvas 刮刮樂塗層：destination-out 擦除，露出底層 children
 * 高度跟隨內容，絕不裁切對白文字
 */
export default function ScratchReveal({
  children,
  hint = '用手指刮開看看…',
  className = '',
  revealRatio = 0.42,
  onRevealed,
}) {
  const wrapRef = useRef(null);
  const contentRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const revealedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  const paintCoat = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const content = contentRef.current;
    if (!canvas || !wrap || revealedRef.current) return;

    const w = Math.max(1, Math.ceil(wrap.clientWidth || wrap.getBoundingClientRect().width));
    const h = Math.max(
      1,
      Math.ceil(
        Math.max(
          wrap.clientHeight,
          content?.scrollHeight || 0,
          content?.offsetHeight || 0,
          wrap.getBoundingClientRect().height
        )
      )
    );

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#c5c5c5');
    grad.addColorStop(0.35, '#e8e8e8');
    grad.addColorStop(0.55, '#b0b0b0');
    grad.addColorStop(1, '#9a9a9a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 120; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.18})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1);
    }

    ctx.fillStyle = 'rgba(28,25,23,0.55)';
    ctx.font = '600 13px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hint, w / 2, h / 2);
    setReady(true);
  }, [hint]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          if (!revealedRef.current) paintCoat();
        })
      : null;
    ro?.observe(wrap);
    if (contentRef.current) ro?.observe(contentRef.current);

    // 等一幀讓內容量高後再畫銀漆
    const raf = requestAnimationFrame(() => paintCoat());
    window.addEventListener('resize', paintCoat);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', paintCoat);
    };
  }, [paintCoat]);

  const scratchAt = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas || done) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    try {
      navigator.vibrate?.(15);
    } catch {
      /* ignore */
    }

    const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0;
    for (let i = 3; i < sample.length; i += 16) {
      if (sample[i] < 40) clear += 1;
    }
    const ratio = clear / (sample.length / 16);
    if (ratio >= revealRatio && !revealedRef.current) {
      revealedRef.current = true;
      setDone(true);
      onRevealed?.();
    }
  };

  const onPointerDown = (e) => {
    drawingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    scratchAt(e.clientX, e.clientY);
  };
  const onPointerMove = (e) => {
    if (!drawingRef.current) return;
    scratchAt(e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    drawingRef.current = false;
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div ref={contentRef} className={done ? '' : 'select-none'}>
        {children}
      </div>
      {!done ? (
        <canvas
          ref={canvasRef}
          className={`absolute left-0 top-0 z-10 touch-none ${ready ? '' : 'opacity-0'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      ) : null}
    </div>
  );
}
