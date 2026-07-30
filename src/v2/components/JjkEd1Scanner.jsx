import React from 'react';

/**
 * 咒術迴戰 ED1 風格掃描動畫
 * 結合節奏感色塊閃爍、塗鴉線條與斜切色帶
 */
export default function JjkEd1Scanner({ className = '', label = '賦予時尚色彩中' }) {
  return (
    <div
      className={`relative overflow-hidden border-2 border-[var(--ink)] bg-[#f4f1eb] ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* 閃爍色塊層 */}
      <div className="jjk-flash absolute inset-0 mix-blend-multiply opacity-60" />

      {/* 塗鴉遮罩層 */}
      <div className="jjk-scribble absolute inset-0 bg-[var(--accent)] mix-blend-overlay opacity-30" />

      {/* 律動色帶 */}
      <div className="absolute inset-0 flex flex-col justify-around overflow-hidden py-4 opacity-40">
        <div className="jjk-bar w-2/3 self-start" />
        <div className="jjk-bar w-1/2 self-end" style={{ animationDelay: '-0.3s', backgroundColor: '#e91e63' }} />
        <div className="jjk-bar w-3/4 self-center" style={{ animationDelay: '-0.6s', backgroundColor: '#00bcd4' }} />
      </div>

      {/* 文字層 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <div className="relative">
          <p className="font-display text-2xl font-black italic tracking-tighter text-[var(--ink)]">
            {label}
          </p>
          <p className="absolute -right-2 -top-1 font-display text-[10px] font-bold text-[var(--accent)]">
            POP!
          </p>
        </div>
        <p className="text-[11px] font-bold tracking-[0.3em] text-[var(--ink)]/40">
          STYLE OVERLAY
        </p>
      </div>

      {/* 邊框裝飾 */}
      <div className="absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-[var(--ink)]" />
      <div className="absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-[var(--ink)]" />
    </div>
  );
}
