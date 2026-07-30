import React from 'react';

/**
 * 日式手繪風紅印章（純 CSS）
 * @param {{ label?: string, className?: string }} props
 */
export default function FortuneSealStamp({ label = '大吉', className = '' }) {
  const isBad = /凶/.test(String(label));
  return (
    <div
      className={`fortune-seal ${isBad ? 'fortune-seal--bad' : ''} ${className}`}
      aria-label={label}
    >
      <div className="fortune-seal__ring">
        <div className="fortune-seal__inner">
          <span className="fortune-seal__text">{label}</span>
        </div>
      </div>
    </div>
  );
}
