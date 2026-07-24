import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { STORY_STYLES } from '../../lib/storyGeneration.js';
import { CHARACTERS_BY_ID } from '../../lib/casts.js';
import { IconCheck, IconClose, IconSparkles } from '../Icons.jsx';
import MangaPanelFrame from '../manga/MangaPanelFrame.jsx';
import CardImagePeek from '../CardImagePeek.jsx';

/**
 * 編輯模式：每個出場角色各一行輸入框（可擇一或多人同時輸入）
 * editBubble 格式：{ [speakerId]: string | { text, face } }
 */
function EditBubbleBox({
  card,
  panelIndex,
  editBubble = {},
  onBubbleEdit,
  onKeyDown,
  firstInputRef,
  onFocus,
}) {
  const members = card?.castMembers?.length ? card.castMembers : [];
  // 若卡片沒有 castMembers，用 characterIds 補一個
  const rows = members.length
    ? members
    : (card?.characterIds || []).map((id) => {
        const ch = CHARACTERS_BY_ID[id];
        return { id, nameZh: ch?.nameZh || id };
      });

  const stop = (e) => e.stopPropagation();
  const textOf = (v) => (typeof v === 'string' ? v : v?.text ?? '');

  return (
    <div
      className="absolute inset-x-1.5 top-1.5 z-[8] flex max-h-[42%] flex-col gap-0.5 overflow-y-auto rounded-md border border-ink-950 bg-white/95 p-1 shadow-sm"
      onPointerDown={stop}
      onClick={stop}
    >
      {rows.map((m, i) => {
        const ch = CHARACTERS_BY_ID[m.id];
        const label = ch?.nameZh || m.nameZh || m.id;
        const val = textOf(editBubble[m.id]);
        const hasText = val.trim().length > 0;
        return (
          <div key={m.id} className="flex items-center gap-1">
            <span
              className={`flex-shrink-0 rounded-full border px-1 py-0.5 text-[7px] font-bold leading-none ${
                hasText
                  ? 'border-accent bg-accent text-white'
                  : 'border-ink-300 bg-ink-50 text-ink-400'
              }`}
            >
              {label}
            </span>
            <textarea
              ref={i === 0 ? firstInputRef : undefined}
              value={val}
              placeholder={`${label} 說…`}
              maxLength={24}
              rows={1}
              onPointerDown={stop}
              onClick={stop}
              onFocus={() => onFocus?.(card.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
                  const nextInPanel = rows[i + 1];
                  if (nextInPanel) {
                    e.preventDefault();
                    const next = document.querySelector(
                      `[data-edit-panel="${card.id}"][data-edit-speaker="${nextInPanel.id}"]`
                    );
                    next?.focus();
                  } else {
                    onKeyDown?.(e, panelIndex);
                  }
                }
              }}
              data-edit-panel={card.id}
              data-edit-speaker={m.id}
              onChange={(ev) =>
                onBubbleEdit?.({ cardId: card.id, speakerId: m.id, text: ev.target.value })
              }
              className="h-5 w-full resize-none rounded bg-white px-1 py-0.5 text-[8px] leading-tight text-ink-700 outline-none ring-1 ring-ink-200 focus:ring-accent placeholder:text-ink-300"
            />
          </div>
        );
      })}
    </div>
  );
}

function SortableCard({
  card,
  panelIndex = 0,
  dialogue,
  bubbles,
  editBubble = {},
  focused,
  editing = false,
  onFocus,
  onRemove,
  onBubbleEdit,
  onBubbleMove,
  onDialogueKeyDown,
  onDialogueInputRef,
}) {
  const hasBubbles = Boolean(bubbles?.length || String(dialogue || '').trim());
  // 有對白且非編輯：直接可拖對話框（不必另按「調整位置」）
  const bubblesInteractive = hasBubbles && !editing;
  const useOverlay = editing || bubblesInteractive;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, disabled: bubblesInteractive });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragProps = bubblesInteractive ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative h-full flex-shrink-0 ${isDragging ? 'z-20 opacity-80' : ''}`}
    >
      <div
        className={`manga-panel-frame relative flex h-full flex-col overflow-hidden border-2 border-ink-950 bg-white shadow-card ${
          focused ? 'ring-2 ring-accent ring-offset-2 ring-offset-[var(--paper)]' : ''
        }`}
        {...dragProps}
        onClick={() => onFocus?.(card.id)}
      >
        <MangaPanelFrame
          card={card}
          index={panelIndex}
          bubbles={editing ? null : bubbles}
          plainLine={editing ? '' : dialogue}
          className={`h-full ${bubblesInteractive ? 'cursor-default' : 'cursor-pointer'}`}
          composeBubbles={!useOverlay}
          bubblesInteractive={bubblesInteractive}
          peekEnabled={!editing && !bubblesInteractive}
          onBubbleMove={
            bubblesInteractive
              ? (payload) => onBubbleMove?.({ cardId: card.id, ...payload })
              : null
          }
          imageSlot={
            useOverlay ? (
              <CardImagePeek
                src={card.imageUrl}
                alt={card.scene || '分鏡'}
                className="h-full w-full"
                imgClassName={`h-full w-full object-contain object-center ${
                  editing ? 'grayscale' : ''
                }`}
                disabled={editing || bubblesInteractive}
              />
            ) : null
          }
          overlaySlot={
            editing ? (
              <EditBubbleBox
                card={card}
                panelIndex={panelIndex}
                editBubble={editBubble}
                onBubbleEdit={onBubbleEdit}
                onKeyDown={onDialogueKeyDown}
                firstInputRef={(el) => onDialogueInputRef?.(card.id, el)}
                onFocus={onFocus}
              />
            ) : null
          }
        />

        <button
          type="button"
          className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs font-bold opacity-70 shadow-sm transition hover:bg-accent hover:text-white hover:opacity-100 group-hover:opacity-100"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(card.id);
          }}
          title="移出劇場"
        >
          <IconClose className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export default function PlayTheater({
  theaterCards,
  theaterDialogues = {},
  theaterPanelBubbles = [],
  focusCardId = null,
  editing = false,
  generating = false,
  publishing = false,
  canPublish = false,
  storyTheme = '',
  styleId = 'comedy',
  editBubbles = {},
  onThemeChange,
  onStyleChange,
  onToggleEdit,
  onGenerate,
  onPublish,
  onBubbleEdit,
  onBubbleMove,
  onFocusCard,
  onReorder,
  onRemove,
  onClear,
  onDropCardId,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const ids = useMemo(() => theaterCards.map((c) => c.id), [theaterCards]);
  const dialogueRefs = useRef({});
  const prevEditingRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const ready = theaterCards.length > 0;
  const hasAnyDialogue = theaterCards.some(
    (c, i) =>
      (theaterDialogues[c.id] || '').trim() || (theaterPanelBubbles[i] || []).length
  );
  const activeStyle = STORY_STYLES.find((s) => s.id === styleId) || STORY_STYLES[0];

  const bindDialogueInputRef = useCallback((cardId, el) => {
    if (el) dialogueRefs.current[cardId] = el;
    else delete dialogueRefs.current[cardId];
  }, []);

  const focusPanelDialogue = useCallback(
    (index) => {
      const card = theaterCards[index];
      if (!card) return;
      onFocusCard?.(card.id);
      requestAnimationFrame(() => {
        dialogueRefs.current[card.id]?.focus();
        dialogueRefs.current[card.id]?.select?.();
      });
    },
    [theaterCards, onFocusCard]
  );

  useEffect(() => {
    const justEntered = editing && !prevEditingRef.current;
    prevEditingRef.current = editing;
    if (justEntered && theaterCards.length) focusPanelDialogue(0);
  }, [editing, theaterCards.length, focusPanelDialogue]);

  const handleDialogueKeyDown = (e, index) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent?.isComposing) return;
    e.preventDefault();
    if (index + 1 < theaterCards.length) {
      focusPanelDialogue(index + 1);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = theaterCards.findIndex((c) => c.id === active.id);
    const to = theaterCards.findIndex((c) => c.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(from, to);
    onFocusCard?.(String(active.id));
  };

  // 流程：1 放卡 → 2 對白 → 3 發布（對白完成後可直接拖對話框）
  const flowStep = !ready ? 1 : editing || !hasAnyDialogue ? 2 : 3;
  const nextHint =
    flowStep === 1
      ? '從下方靈感池拖入 3～4 張卡'
      : flowStep === 2
        ? editing
          ? '在輸入框寫完對白，再按「完成編輯」'
          : '按「AI 生成對白」，或「編輯對白」手寫'
        : '可直接拖曳對話框調位置，再按「發布故事」';

  const btnBase = '!px-3 !py-1.5 !text-xs';
  const btnNext =
    'ring-2 ring-accent ring-offset-1 ring-offset-[var(--paper)] shadow-sm scale-[1.03]';

  return (
    <section
      className={`panel flex h-[440px] flex-col overflow-hidden ${
        dragOver ? 'ring-2 ring-accent' : ''
      }`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-bubbleweave-card')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData('application/x-bubbleweave-card');
        if (id) onDropCardId?.(id);
      }}
    >
      <div className="border-b-[3px] border-ink-950 px-4 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-bold">織泡劇場</h2>
            {/* 現階段亮起，其餘反灰 */}
            <ol className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] font-bold tracking-wide">
              {[
                { n: 1, label: '放卡' },
                { n: 2, label: '對白' },
                { n: 3, label: '發布' },
              ].map((s, i) => {
                const current = flowStep === s.n;
                return (
                  <li key={s.n} className="flex items-center gap-1">
                    {i > 0 ? (
                      <span
                        className={`mx-0.5 ${current || flowStep > s.n ? 'text-ink-400' : 'text-ink-200'}`}
                        aria-hidden
                      >
                        →
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors ${
                        current
                          ? 'border-accent bg-accent text-white'
                          : 'border-ink-200 bg-ink-50 text-ink-300'
                      }`}
                    >
                      <span className="tabular-nums opacity-80">{s.n}</span>
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-1.5 text-xs font-semibold text-ink-700">{nextHint}</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {flowStep >= 2 ? (
              <button
                type="button"
                className={`btn-secondary ${btnBase} ${
                  editing ? `!bg-ink-950 !text-paper ${btnNext}` : ''
                }`}
                disabled={!ready}
                onClick={onToggleEdit}
              >
                {editing ? '完成編輯' : '編輯對白'}
              </button>
            ) : null}

            {flowStep === 2 && !editing ? (
              <button
                type="button"
                disabled={!ready || generating}
                onClick={onGenerate}
                className={`btn-accent flex items-center gap-1.5 ${btnBase} ${btnNext}`}
              >
                <IconSparkles className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
                {generating ? '生成中…' : 'AI 生成對白'}
              </button>
            ) : null}

            {hasAnyDialogue && !editing && flowStep === 3 ? (
              <button
                type="button"
                disabled={!ready || generating}
                onClick={onGenerate}
                className={`btn-secondary flex items-center gap-1.5 ${btnBase}`}
                title="重新用 AI 生成對白"
              >
                <IconSparkles className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
                {generating ? '生成中…' : '再生成'}
              </button>
            ) : null}

            {flowStep === 3 ? (
              <button
                type="button"
                disabled={!canPublish || generating || publishing}
                onClick={onPublish}
                className={`btn-primary flex items-center gap-1.5 ${btnBase} ${btnNext}`}
              >
                <IconCheck className="h-3.5 w-3.5" />
                {publishing ? '發布中…' : '發布故事'}
              </button>
            ) : null}

            {ready ? (
              <button
                type="button"
                className={`btn-secondary ${btnBase} !text-ink-400`}
                onClick={() => onClear?.()}
              >
                清空
              </button>
            ) : null}
          </div>
        </div>

        {flowStep >= 2 ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={storyTheme}
              onChange={(e) => onThemeChange?.(e.target.value)}
              placeholder="主題（可選，例：週一上班、被狗追…）"
              className="w-full max-w-sm rounded-lg border-2 border-ink-950 bg-white px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-accent/30 placeholder:font-normal placeholder:text-ink-300"
            />
            <div className="character-roster flex gap-1.5 overflow-x-auto">
              {STORY_STYLES.map((s) => {
                const active = styleId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    title={s.hint}
                    onClick={() => onStyleChange?.(s.id)}
                    className={`flex-shrink-0 rounded-full border-2 px-2.5 py-1 text-[10px] font-bold transition-all ${
                      active
                        ? 'border-ink-950 bg-ink-950 text-paper'
                        : 'border-ink-200 bg-white text-ink-500 hover:border-ink-950'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-ink-400">{activeStyle.hint}</p>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-3">
        {theaterCards.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center border-[3px] border-dashed border-ink-300 bg-ink-50/40 text-center">
            <p className="font-display text-lg font-semibold text-ink-600">
              從下方靈感池拖入卡牌開始創作
            </p>
            <p className="mt-2 text-sm text-ink-400">建議排 3～4 格</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
              <div className="flex h-full gap-3">
                {theaterCards.map((card, index) => (
                  <SortableCard
                    key={card.id}
                    card={card}
                    panelIndex={index}
                    dialogue={theaterDialogues[card.id]}
                    bubbles={theaterPanelBubbles[index] || null}
                    editBubble={editBubbles[card.id] || {}}
                    focused={focusCardId === card.id}
                    editing={editing}
                    onFocus={onFocusCard}
                    onRemove={onRemove}
                    onBubbleEdit={onBubbleEdit}
                    onBubbleMove={onBubbleMove}
                    onDialogueKeyDown={handleDialogueKeyDown}
                    onDialogueInputRef={bindDialogueInputRef}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </section>
  );
}
