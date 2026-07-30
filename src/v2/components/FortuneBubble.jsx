import React from 'react';

/** 固定寬度對話框：允許換行；勿被舞台 overflow 視覺切斷語意 */
export const FORTUNE_BUBBLE_CLASS =
  'absolute z-10 box-border w-[72%] max-w-[72%] min-h-[2.75rem] -translate-x-1/2 -translate-y-1/2 border-2 border-[var(--ink)] bg-[#fffef8] px-3.5 py-2.5 text-center text-[13px] font-bold leading-normal shadow-[2px_2px_0_0_var(--ink)] whitespace-normal break-words overflow-visible';

export default function FortuneBubble({
  text,
  x = 0.62,
  y = 0.16,
  interactive = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}) {
  if (!text) return null;

  const style = {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    whiteSpace: 'normal',
  };

  if (interactive) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={`${FORTUNE_BUBBLE_CLASS} cursor-grab touch-none select-none active:cursor-grabbing`}
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {text}
      </div>
    );
  }

  return (
    <div className={FORTUNE_BUBBLE_CLASS} style={style}>
      {text}
    </div>
  );
}
