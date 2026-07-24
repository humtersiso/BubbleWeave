import React from 'react';

/**
 * Face-only character icon — circular crop that fills the ring (no square plate).
 */
export default function CharacterIcon({
  name,
  avatar,
  active = false,
  count,
  onClick,
  size = 'md',
  showLabel = true,
}) {
  const box =
    size === 'xl' ? 'h-24 w-24' : size === 'lg' ? 'h-20 w-20' : size === 'md' ? 'h-14 w-14' : 'h-10 w-10';
  const wrap = size === 'xl' ? 'w-28' : size === 'lg' ? 'w-24' : size === 'md' ? 'w-16' : 'w-12';
  const labelSize = size === 'xl' || size === 'lg' ? 'text-sm' : size === 'md' ? 'text-[11px]' : 'text-[10px]';

  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      className={`relative flex ${wrap} flex-shrink-0 flex-col items-center gap-1.5 transition ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      <span
        className={`${box} overflow-hidden rounded-full border-2 bg-white ${
          active
            ? 'border-ink-950 shadow-card ring-2 ring-accent/35'
            : 'border-ink-300'
        }`}
      >
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="character-face-icon h-full w-full scale-[1.12] object-cover object-center grayscale"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-white text-sm font-bold text-ink-400">
            {name?.slice(0, 1) || '?'}
          </span>
        )}
      </span>
      {showLabel && (
        <span
          className={`max-w-full truncate font-semibold ${labelSize} ${
            active ? 'text-ink-950' : 'text-ink-500'
          }`}
        >
          {name}
        </span>
      )}
      {typeof count === 'number' && active && (
        <span className="absolute right-0 top-0 rounded-full bg-accent px-1.5 text-[9px] font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}
