import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

const MIN_SCALE = 1;
const MAX_SCALE = 4;

/**
 * 上傳預覽：雙指／滾輪縮放、單指拖拉；exportFrame 匯出視窗內裁切圖
 */
const PhotoPanZoom = forwardRef(function PhotoPanZoom({ src, className = '' }, ref) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const pinchRef = useRef(null);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setNatural({ w: 0, h: 0 });
  }, [src]);

  const getBase = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || !natural.w || !natural.h) return 1;
    return Math.min(wrap.clientWidth / natural.w, wrap.clientHeight / natural.h);
  }, [natural.h, natural.w]);

  const clampOffset = useCallback(
    (nextScale, nextOffset) => {
      const wrap = wrapRef.current;
      if (!wrap || !natural.w) return nextOffset;
      const vw = wrap.clientWidth;
      const vh = wrap.clientHeight;
      const base = Math.min(vw / natural.w, vh / natural.h);
      const dw = natural.w * base * nextScale;
      const dh = natural.h * base * nextScale;
      const maxX = Math.max(0, (dw - vw) / 2);
      const maxY = Math.max(0, (dh - vh) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, nextOffset.x)),
        y: Math.min(maxY, Math.max(-maxY, nextOffset.y)),
      };
    },
    [natural.h, natural.w]
  );

  const setScaleSafe = useCallback(
    (next) => {
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
      setScale(s);
      setOffset((o) => clampOffset(s, o));
    },
    [clampOffset]
  );

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
      },
      exportFrame: async () => {
        const wrap = wrapRef.current;
        const img = imgRef.current;
        if (!wrap || !img?.naturalWidth) throw new Error('預覽尚未就緒');
        const vw = wrap.clientWidth;
        const vh = wrap.clientHeight;
        if (!vw || !vh) throw new Error('預覽尺寸異常');

        const maxSide = 1600;
        const outScale = Math.min(maxSide / vw, maxSide / vh, 2);
        const cw = Math.round(vw * outScale);
        const ch = Math.round(vh * outScale);
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('無法匯出裁切');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);

        const base = Math.min(vw / img.naturalWidth, vh / img.naturalHeight);
        const dw = img.naturalWidth * base * scale;
        const dh = img.naturalHeight * base * scale;
        const left = (vw - dw) / 2 + offset.x;
        const top = (vh - dh) / 2 + offset.y;

        ctx.drawImage(img, left * outScale, top * outScale, dw * outScale, dh * outScale);
        return canvas.toDataURL('image/jpeg', 0.92);
      },
    }),
    [offset.x, offset.y, scale]
  );

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  };

  const onPointerMove = (e) => {
    if (pinchRef.current) return;
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    setOffset(
      clampOffset(scale, {
        x: d.ox + (e.clientX - d.x),
        y: d.oy + (e.clientY - d.y),
      })
    );
  };

  const onPointerUp = (e) => {
    if (dragRef.current?.id === e.pointerId) dragRef.current = null;
  };

  const onWheel = (e) => {
    e.preventDefault();
    setScaleSafe(scale + (e.deltaY > 0 ? -0.12 : 0.12));
  };

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinchRef.current = {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        scale,
      };
      dragRef.current = null;
    }
  };

  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      setScaleSafe(pinchRef.current.scale * (dist / (pinchRef.current.dist || 1)));
    }
  };

  const onTouchEnd = () => {
    pinchRef.current = null;
  };

  const base = getBase();
  const dispW = natural.w ? natural.w * base * scale : undefined;
  const dispH = natural.h ? natural.h * base * scale : undefined;

  return (
    <div className={`relative flex h-full min-h-0 w-full flex-col ${className}`}>
      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden bg-white"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 select-none"
          onLoad={(e) => {
            setNatural({
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            });
          }}
          style={{
            width: dispW ? `${dispW}px` : 'auto',
            height: dispH ? `${dispH}px` : 'auto',
            maxWidth: dispW ? 'none' : '100%',
            maxHeight: dispH ? 'none' : '100%',
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            transformOrigin: 'center center',
          }}
        />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t-2 border-[var(--ink)] bg-[var(--paper)] px-2 py-1.5">
        <p className="text-[10px] font-semibold text-[var(--ink)]/55">
          雙指／滾輪縮放 · 拖曳移動
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center border-2 border-[var(--ink)] bg-white text-sm font-black"
            onClick={(e) => {
              e.stopPropagation();
              setScaleSafe(scale - 0.25);
            }}
            aria-label="縮小"
          >
            −
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center border-2 border-[var(--ink)] bg-white text-sm font-black"
            onClick={(e) => {
              e.stopPropagation();
              setScaleSafe(scale + 0.25);
            }}
            aria-label="放大"
          >
            ＋
          </button>
          <button
            type="button"
            className="h-8 border-2 border-[var(--ink)] bg-white px-2 text-[10px] font-bold"
            onClick={(e) => {
              e.stopPropagation();
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
          >
            重置
          </button>
        </div>
      </div>
    </div>
  );
});

export default PhotoPanZoom;
