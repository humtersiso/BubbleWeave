import React from 'react';
import { IconClose, IconHistory } from '../../components/Icons.jsx';

const IconGallery = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.25"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconUser = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.25"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

/** 純懸浮：不佔版面；有大頭 icon 時個人鈕改顯示頭像 */
export default function FloatingDock({ active, onOpen, onClose, avatarUrl }) {
  const items = [
    { id: 'gallery', label: '圖庫', Icon: IconGallery },
    { id: 'profile', label: '個人', Icon: IconUser, avatar: true },
    { id: 'history', label: '歷史', Icon: IconHistory },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <div className="pointer-events-none absolute bottom-6 right-4 flex flex-col items-end gap-3">
        {active ? (
          <button
            type="button"
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-[var(--ink)] bg-white shadow-lift transition hover:-translate-y-1"
            onClick={onClose}
            aria-label="關閉面板"
          >
            <IconClose className="h-4 w-4" />
          </button>
        ) : null}
        {items.map(({ id, label, Icon, avatar }) => {
          const on = active === id;
          const showFace = Boolean(avatar && avatarUrl);
          return (
            <button
              key={id}
              type="button"
              title={label}
              onClick={() => onOpen(id)}
              className={`pointer-events-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-[3px] border-[var(--ink)] shadow-lift transition hover:-translate-y-1 active:translate-y-0 ${
                on && !showFace
                  ? 'bg-[var(--accent)] text-white'
                  : showFace
                    ? 'bg-white p-0'
                    : 'bg-white text-[var(--ink)]'
              }`}
            >
              {showFace ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Icon />
              )}
              <span className="sr-only">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
