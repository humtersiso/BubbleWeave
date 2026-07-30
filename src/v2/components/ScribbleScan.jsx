import React from 'react';

/**
 * 塗鴉素描風格掃描動畫
 * 強調快速手繪感的線條堆疊與對比色塊
 */
export default function ScribbleScan({ className = '', label = '命運描繪中' }) {
  return (
    <div
      className={`relative overflow-hidden border-2 border-[var(--ink)] bg-[#ffffff] ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* 快速移動的背景線條 */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="diagonalHatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M-1,1 l2,-2 M0,10 l10,-10 M9,11 l2,-2" stroke="black" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#diagonalHatch)" />
        </svg>
      </div>

      {/* 色塊爆炸感 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-40 w-40 animate-ping rounded-full bg-[var(--accent)] opacity-10" />
        <div className="h-60 w-60 animate-pulse rounded-full bg-[#00bcd4] opacity-5" style={{ animationDelay: '0.2s' }} />
      </div>

      {/* Rhythmic brush strokes */}
      <div className="absolute inset-0">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute h-[1px] w-full bg-[var(--ink)] opacity-20"
            style={{
              top: `${20 * i}%`,
              transform: `rotate(${Math.sin(i) * 5}deg)`,
              animation: `jjk-bar-slide ${0.5 + i * 0.1}s linear infinite`
            }}
          />
        ))}
      </div>

      {/* 文字層 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="font-display text-2xl font-bold uppercase tracking-widest text-[var(--ink)]">
          {label}
        </p>
        <div className="h-1 w-12 bg-[var(--accent)]" />
      </div>
    </div>
  );
}
