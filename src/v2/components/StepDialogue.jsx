import React, { useState } from 'react';
import { CATEGORY_BY_ID, fortuneDisplay } from '../data/fortune.js';
import { StepHeading } from './HelpTip.jsx';
import FortuneBubble from './FortuneBubble.jsx';
import FortuneCornerBadge, {
  loadBadgeStyle,
} from './FortuneCornerBadge.jsx';
import FortuneCardStage from './FortuneCardStage.jsx';
import ScratchReveal from './ScratchReveal.jsx';
import { DIALOGUE_MAX_CHARS } from '../lib/fortuneDraw.js';

const DEFAULT_POS = { x: 0.62, y: 0.16 };

export default function StepDialogue({ card, onChangeDialogue, onCustom, onDragPos, onConfirm }) {
  const wrapRef = React.useRef(null);
  const draggingRef = React.useRef(false);
  const rafRef = React.useRef(0);
  const pendingPosRef = React.useRef(null);

  const fortune = fortuneDisplay(card?.fortuneId);
  const chosen =
    card?.chosenIndex === 3
      ? String(card.customText || '').slice(0, DIALOGUE_MAX_CHARS)
      : card?.dialogues?.[card.chosenIndex] || '';

  const [localPos, setLocalPos] = useState(() => card?.manualPos || DEFAULT_POS);
  const [linesUnlocked, setLinesUnlocked] = useState(false);
  const badgeStyle = loadBadgeStyle();

  React.useEffect(() => {
    if (!draggingRef.current && card?.manualPos) {
      setLocalPos(card.manualPos);
    }
  }, [card?.manualPos]);

  React.useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  React.useEffect(() => {
    setLinesUnlocked(false);
  }, [card?.id]);

  if (!card) return null;

  const pos = localPos || DEFAULT_POS;
  const cat = CATEGORY_BY_ID[card.categoryId]?.short || '運勢';

  const readPos = (clientX, clientY) => {
    const el = wrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.min(0.92, Math.max(0.08, (clientX - rect.left) / rect.width)),
      y: Math.min(0.94, Math.max(0.06, (clientY - rect.top) / rect.height)),
    };
  };

  const scheduleLocalPos = (next) => {
    pendingPosRef.current = next;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (pendingPosRef.current) setLocalPos(pendingPosRef.current);
    });
  };

  const endDrag = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    const finalPos = pendingPosRef.current || localPos;
    onDragPos?.(finalPos);
  };

  const optionClass = (active) =>
    // 注意：瀏覽器 button 預設 white-space:nowrap，一定要在 button 上覆寫，否則中文會長行被裁切
    `dialogue-option flex w-full min-w-0 flex-col items-stretch overflow-visible whitespace-normal break-words border-2 border-[var(--ink)] px-3 py-3 text-left text-sm leading-relaxed ${
      active ? 'bg-[var(--accent)] text-white' : 'bg-[var(--paper)]'
    }`;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-3 pt-2">
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        <div className="shrink-0">
          <StepHeading
            step="STEP 4"
            title={cat}
            hint="刮開對白後選一句；也可自己寫。對話框可拖到不擋臉的位置。"
            helpTitle="對白怎麼用"
          >
            <p>先刮開銀漆，看到三句建議對白。</p>
            <p>選一句，或選「自己寫」（最多 {DIALOGUE_MAX_CHARS} 字）。</p>
            <p>按住圖片上的對話框可拖移；放開後會記住位置。</p>
          </StepHeading>
        </div>

        <FortuneCardStage
          className="mt-3 select-none"
          imageUrl={card.imageUrl}
          stageRef={wrapRef}
        >
          <FortuneCornerBadge fortune={fortune} variant={badgeStyle} />
          {linesUnlocked && chosen ? (
            <FortuneBubble
              text={chosen}
              x={pos.x}
              y={pos.y}
              interactive
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                draggingRef.current = true;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                const next = readPos(e.clientX, e.clientY);
                if (next) {
                  pendingPosRef.current = next;
                  setLocalPos(next);
                }
              }}
              onPointerMove={(e) => {
                if (!draggingRef.current) return;
                e.preventDefault();
                const next = readPos(e.clientX, e.clientY);
                if (next) scheduleLocalPos(next);
              }}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          ) : null}
        </FortuneCardStage>

        <div className="mt-4 space-y-3 pb-10">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--ink)]/50">
            選擇對白
          </p>
          <ScratchReveal
            className="border-2 border-[var(--ink)] bg-white"
            hint="刮開看看今日對白…"
            onRevealed={() => setLinesUnlocked(true)}
          >
            <div className="flex w-full min-w-0 flex-col gap-2 p-2">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!linesUnlocked}
                  onClick={() => onChangeDialogue?.(i)}
                  className={optionClass(card.chosenIndex === i)}
                >
                  <span className="mb-1 block text-[10px] font-semibold opacity-70">
                    對白 {i + 1}
                  </span>
                  <span
                    className="block w-full max-w-full whitespace-normal break-words"
                    style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                  >
                    {card.dialogues?.[i] || '（空）'}
                  </span>
                </button>
              ))}
              <button
                type="button"
                disabled={!linesUnlocked}
                onClick={() => onChangeDialogue?.(3)}
                className={optionClass(card.chosenIndex === 3)}
              >
                <span className="mb-1 block text-[10px] font-semibold opacity-70">自己寫</span>
                <span className="italic">✎ 最多 {DIALOGUE_MAX_CHARS} 字</span>
              </button>
            </div>
          </ScratchReveal>

          {linesUnlocked && card.chosenIndex === 3 ? (
            <input
              className="w-full border-2 border-[var(--ink)] bg-white px-3 py-2 text-sm shadow-[2px_2px_0_0_var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              value={card.customText || ''}
              maxLength={DIALOGUE_MAX_CHARS}
              placeholder="在此輸入自訂對白…"
              onChange={(e) => onCustom?.(e.target.value)}
              autoFocus
            />
          ) : null}
        </div>
      </div>

      <div className="mt-3 shrink-0">
        <button
          type="button"
          className="btn-primary w-full min-h-[48px]"
          disabled={!linesUnlocked || !chosen}
          onClick={onConfirm}
        >
          確認這張籤
        </button>
      </div>
    </section>
  );
}
