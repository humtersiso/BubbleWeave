import React, { useEffect, useState } from 'react';
import { formatCountdown } from '../../lib/storage.js';
import { DEFAULT_BADGE_STYLE } from '../../lib/rarity.js';
import { IconGift, IconClose } from '../Icons.jsx';
import RarityBadge from '../rarity/RarityBadge.jsx';
import CardImagePeek from '../CardImagePeek.jsx';

/**
 * 每日獎勵：領取＋翻卡開獎動畫
 */
export default function DailyReward({
  canClaim,
  countdownSeconds,
  claiming,
  onClaim,
  error,
  isModal = false,
  playerReady = false,
  revealCards = null,
  badgeStyleId = DEFAULT_BADGE_STYLE,
  onCloseReveal,
}) {
  return (
    <section className={isModal ? 'p-6' : 'panel p-4'}>
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink-950 ${
            canClaim && playerReady ? 'bg-accent text-white' : 'bg-ink-100 text-ink-400'
          }`}
        >
          <IconGift />
        </div>
        <h2 className="font-display text-2xl font-bold text-ink-950">每日獎勵</h2>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-ink-500">
        每天領取 3 張全新場景卡；完成個人角色後，三張都一定有你登場。
      </p>

      {!playerReady ? (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          請先在左側個人資料上傳照片，生成你的 2D 角色。
        </p>
      ) : null}

      {error && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn-accent mt-4 w-full"
        disabled={!canClaim || claiming || !playerReady}
        onClick={onClaim}
      >
        {claiming
          ? '開獎中…'
          : !playerReady
            ? '先建立個人角色'
            : canClaim
              ? '領取並開獎'
              : `冷卻中 ${formatCountdown(countdownSeconds)}`}
      </button>

      {revealCards?.length ? (
        <RewardRevealModal
          cards={revealCards}
          badgeStyleId={badgeStyleId}
          onClose={onCloseReveal}
        />
      ) : null}
    </section>
  );
}

function RewardRevealModal({ cards, badgeStyleId, onClose }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    const timers = cards.map((_, i) =>
      window.setTimeout(() => setShown(i + 1), 420 + i * 520)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [cards]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink-950/50"
        aria-label="關閉"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border-[3px] border-ink-950 bg-[var(--paper)] p-5 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
              Daily Pull
            </p>
            <h3 className="font-display text-xl font-bold">今日三張 · 皆有你</h3>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink-950 bg-white"
            onClick={onClose}
          >
            <IconClose className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((card, i) => {
            const open = shown > i;
            return (
              <div key={card.id || i} className="reward-flip-scene">
                <div className={`reward-flip-card ${open ? 'is-open' : ''}`}>
                  <div className="reward-flip-face reward-flip-back">
                    <span className="font-display text-2xl font-bold text-paper">?</span>
                  </div>
                  <div className="reward-flip-face reward-flip-front border-2 border-ink-950 bg-white">
                    <div className="relative overflow-hidden">
                      <CardImagePeek
                        src={card.imageUrl}
                        className="block"
                        imgClassName="aspect-[3/4] w-full object-cover grayscale"
                        disabled
                      />
                      <RarityBadge
                        tier={card.rarity?.tier || 'n'}
                        styleId={badgeStyleId}
                        className="absolute left-1.5 top-1.5 z-10"
                      />
                    </div>
                    <p className="truncate px-2 py-1.5 text-[11px] font-semibold text-ink-700">
                      {card.packNameZh || card.scene}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button type="button" className="btn-primary mt-5 w-full" onClick={onClose}>
          收入靈感池
        </button>
      </div>
    </div>
  );
}
