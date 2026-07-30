import React from 'react';
import { fortuneDisplay, CATEGORY_BY_ID } from '../data/fortune.js';
import FortuneCornerBadge, { loadBadgeStyle } from './FortuneCornerBadge.jsx';

export function GallerySheet({ cards = [], onClose }) {
  const badgeStyle = loadBadgeStyle();
  return (
    <Sheet title="我的籤卡" onClose={onClose}>
      {!cards.length ? (
        <p className="text-sm opacity-70">還沒有籤卡。走完抽籤流程就會出現在這裡。</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {cards.map((c) => {
            const fortune = fortuneDisplay(c.fortuneId);
            return (
              <li key={c.id} className="overflow-hidden border-2 border-[var(--ink)] bg-white">
                <div className="relative">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" className="aspect-[3/4] w-full object-cover" />
                  ) : (
                    <div className="aspect-[3/4] bg-[var(--strip-bg)]" />
                  )}
                  <FortuneCornerBadge fortune={fortune} variant={badgeStyle} />
                </div>
                <div className="p-2 text-xs">
                  <div className="font-semibold">
                    {CATEGORY_BY_ID[c.categoryId]?.short || '運勢'}
                    {c.source === 'friend_copy' ? ' · 好友' : ''}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

export function ProfileSheet({ profile, tags = [], onClose, onNameChange }) {
  return (
    <Sheet title="我的檔案" onClose={onClose}>
      <div className="flex flex-col items-center gap-3">
        {profile?.portraitUrl ? (
          <div
            className="relative mx-auto w-full overflow-hidden border-2 border-[var(--ink)] bg-[#f7f4ef]"
            style={{ maxWidth: 260, aspectRatio: '3 / 4', minHeight: 280 }}
          >
            <img
              src={profile.portraitUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            {profile.iconUrl ? (
              <img
                src={profile.iconUrl}
                alt=""
                className="absolute bottom-2 right-2 z-10 h-16 w-16 rounded-full border-[3px] border-[var(--ink)] bg-white object-cover shadow-lift"
              />
            ) : null}
          </div>
        ) : (
          <div className="flex h-40 w-40 items-center justify-center border-2 border-dashed border-[var(--ink)] text-sm opacity-60">
            尚未建立 2D
          </div>
        )}
        <label className="w-full text-sm">
          <span className="mb-1 block font-semibold">暱稱</span>
          <input
            className="w-full border-2 border-[var(--ink)] bg-white px-3 py-2"
            value={profile?.displayName || ''}
            onChange={(e) => onNameChange?.(e.target.value)}
            maxLength={12}
          />
        </label>
        <div className="flex w-full flex-wrap gap-2">
          {(tags.length ? tags : profile?.tags || []).map((t) => (
            <span
              key={t}
              className="border-2 border-[var(--ink)] bg-[color-mix(in_srgb,var(--accent)_18%,white)] px-2 py-0.5 text-xs font-semibold"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

export function HistorySheet({ cards = [], onClose }) {
  const sorted = [...cards].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
  return (
    <Sheet title="過往籤運" onClose={onClose}>
      {!sorted.length ? (
        <p className="text-sm opacity-70">尚無紀錄。</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 border-2 border-[var(--ink)] bg-white p-2"
            >
              {c.imageUrl ? (
                <img src={c.imageUrl} alt="" className="h-14 w-11 object-cover" />
              ) : (
                <div className="h-14 w-11 bg-[var(--strip-bg)]" />
              )}
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-semibold">
                  {CATEGORY_BY_ID[c.categoryId]?.label || '運勢'} ·{' '}
                  {c.fortuneLabel || fortuneDisplay(c.fortuneId).label}{' '}
                  {c.fortuneEmoji || fortuneDisplay(c.fortuneId).emoji}
                </div>
                <div className="truncate text-xs opacity-60">
                  {c.createdAt ? new Date(c.createdAt).toLocaleString('zh-TW') : ''}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function Sheet({ title, onClose, children }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[color-mix(in_srgb,var(--paper)_96%,white)]">
      <header className="flex items-center justify-between border-b-2 border-[var(--ink)] px-4 py-3">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <button type="button" className="btn-secondary !px-3 !py-1.5 text-sm" onClick={onClose}>
          關閉
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}
