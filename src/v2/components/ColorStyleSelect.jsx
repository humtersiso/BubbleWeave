import React, { useEffect, useRef, useState } from 'react';
import {
  COLOR_STYLE_OPTIONS,
  colorStyleLabel,
  normalizeColorStyle,
} from '../lib/colorStyles.js';

/**
 * 右上角風格下拉：全面 Gemini 圖生圖上色
 */
export default function ColorStyleSelect({
  value,
  disabled = false,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const current = normalizeColorStyle(value);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative z-[60]">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-8 max-w-[9.5rem] items-center gap-1 border-2 border-[var(--ink)] bg-[var(--ink)] px-2 text-[10px] font-black text-white shadow-[2px_2px_0_0_#c45c26] transition active:translate-y-0.5 active:shadow-none disabled:opacity-50 sm:h-9 sm:max-w-[11rem] sm:gap-1.5 sm:px-2.5 sm:text-[11px]"
        title="繪圖／後製風格"
      >
        <span aria-hidden>🎨</span>
        <span className="truncate">{colorStyleLabel(current)}</span>
        <span className="opacity-70" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="繪圖風格"
          className="absolute right-0 top-full z-[70] mt-1 max-h-[min(70vh,26rem)] w-[min(17rem,calc(100vw-1.5rem))] overflow-y-auto border-2 border-[var(--ink)] bg-white shadow-[4px_4px_0_0_var(--ink)]"
        >
          {COLOR_STYLE_OPTIONS.map((opt) => {
            const on = opt.id === current;
            return (
              <li key={opt.id} role="option" aria-selected={on}>
                <button
                  type="button"
                  disabled={disabled}
                  className={`flex w-full flex-col items-start gap-0.5 border-b border-[var(--ink)]/15 px-3 py-2.5 text-left last:border-b-0 ${
                    on
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-white text-[var(--ink)] hover:bg-[var(--paper)]'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    if (opt.id !== current) onChange?.(opt.id);
                  }}
                >
                  <span className="text-[12px] font-black leading-none">{opt.label}</span>
                  <span
                    className={`text-[10px] font-medium leading-snug ${
                      on ? 'text-white/80' : 'text-[var(--ink)]/50'
                    }`}
                  >
                    {opt.hint}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
