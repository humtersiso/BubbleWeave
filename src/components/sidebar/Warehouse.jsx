import React, { useMemo, useState } from 'react';
import { CHARACTERS } from '../../lib/casts.js';
import { PLAYER_ID, buildPlayerCharacter } from '../../lib/playerCharacter.js';
import { BADGE_STYLES, DEFAULT_BADGE_STYLE } from '../../lib/rarity.js';
import { cardMatchesFocusCast } from '../../lib/storyCast.js';
import CharacterIcon from '../CharacterIcon.jsx';
import CardImagePeek from '../CardImagePeek.jsx';
import RarityBadge, { RarityStylePreview } from '../rarity/RarityBadge.jsx';
import { IconCheck } from '../Icons.jsx';

/**
 * 靈感池網格：點選／拖曳加入劇場。
 */
export default function Warehouse({
  cards,
  selectedIds,
  focusCard = null,
  onSelect,
  characterFilter,
  onCharacterFilterChange,
  portraits = {},
  playerProfile = null,
  badgeStyleId = DEFAULT_BADGE_STYLE,
  onSelectBadgeStyle,
}) {
  const [draggingId, setDraggingId] = useState(null);

  const roster = useMemo(() => {
    const list = [...CHARACTERS];
    if (portraits[PLAYER_ID] || playerProfile?.portraitUrl) {
      list.push(buildPlayerCharacter(playerProfile || {}));
    }
    return list;
  }, [portraits, playerProfile]);

  const filtered =
    characterFilter === 'all'
      ? cards
      : cards.filter((c) => (c.characterIds || []).includes(characterFilter));

  const icons = useMemo(
    () =>
      roster.map((ch) => ({
        ...ch,
        avatar:
          ch.id === PLAYER_ID
            ? playerProfile?.iconUrl || portraits[PLAYER_ID] || playerProfile?.portraitUrl
            : portraits[ch.id] || null,
        count: cards.filter((c) => (c.characterIds || []).includes(ch.id)).length,
      })),
    [cards, portraits, roster, playerProfile]
  );

  const hasFocus = Boolean(focusCard?.characterIds?.length);
  const styleId = ['ink', 'foil', 'seal'].includes(badgeStyleId)
    ? badgeStyleId
    : DEFAULT_BADGE_STYLE;

  return (
    <section className="panel flex h-[400px] min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b-2 border-ink-950 bg-ink-50/50 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-xl font-bold">靈感池</h2>
          <p className="text-xs font-medium text-ink-500">
            {hasFocus
              ? '亮起的卡含焦點格角色（仍可選其他卡）'
              : '點選或拖曳到劇場'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-ink-500">稀有度標誌</span>
          <div className="flex gap-1">
            {BADGE_STYLES.map((s) => {
              const active = styleId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  title={s.hint}
                  onClick={() => onSelectBadgeStyle?.(s.id)}
                  className={`rounded-lg border px-2 py-1 transition ${
                    active
                      ? 'border-ink-950 bg-ink-950 text-paper'
                      : 'border-ink-200 bg-white text-ink-600 hover:border-ink-950'
                  }`}
                >
                  <span className="text-[10px] font-bold">{s.label}</span>
                </button>
              );
            })}
          </div>
          <RarityStylePreview styleId={styleId} />
          <span className="text-sm font-bold text-ink-950">
            {filtered.length}{' '}
            <span className="font-normal text-ink-400">/ {cards.length}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-end gap-5 overflow-x-auto border-b border-ink-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => onCharacterFilterChange('all')}
          className={`mb-5 flex h-20 w-14 flex-shrink-0 items-center justify-center rounded-xl border-2 text-xs font-bold transition-all ${
            characterFilter === 'all'
              ? 'border-ink-950 bg-ink-950 text-paper shadow-card'
              : 'border-ink-300 bg-white text-ink-600 hover:border-ink-950'
          }`}
        >
          全部
        </button>
        {icons.map((ch) => (
          <CharacterIcon
            key={ch.id}
            name={ch.nameZh}
            avatar={ch.avatar}
            active={characterFilter === ch.id}
            count={ch.count}
            size="lg"
            showLabel={true}
            onClick={() => onCharacterFilterChange(ch.id)}
          />
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm italic text-ink-400">尚無卡牌</p>
        ) : (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
            {filtered.map((card) => {
              const selected = selectedIds.has(card.id);
              const related = !hasFocus || cardMatchesFocusCast(card, focusCard);
              return (
                <button
                  key={card.id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-bubbleweave-card', card.id);
                    e.dataTransfer.effectAllowed = 'copy';
                    setDraggingId(card.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => onSelect(card)}
                  className={`relative overflow-visible rounded-xl border-2 text-left transition-all ${
                    selected
                      ? 'border-accent shadow-card ring-2 ring-accent/30'
                      : related
                        ? 'border-ink-950 shadow-card ring-2 ring-accent/25'
                        : 'border-ink-300 opacity-40 hover:opacity-70 hover:border-ink-950'
                  } ${draggingId === card.id ? 'opacity-60' : ''}`}
                >
                  <CardImagePeek
                    src={card.imageUrl}
                    className="block overflow-hidden rounded-[10px]"
                    imgClassName="aspect-[4/5] w-full object-cover grayscale"
                  />
                  <RarityBadge
                    tier={card.rarity?.tier || 'n'}
                    styleId={badgeStyleId}
                    size="sm"
                    className="absolute left-1 top-1 z-10"
                  />
                  {selected && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-[10px] bg-paper/60 backdrop-blur-[1px]">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-lift">
                        <IconCheck className="h-5 w-5" />
                      </div>
                      <span className="mt-2 text-[10px] font-bold text-accent">點擊取消</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
