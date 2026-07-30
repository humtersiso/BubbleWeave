import React from 'react';
import { FORTUNE_CATEGORIES } from '../data/fortune.js';
import { StepHeading } from './HelpTip.jsx';
import JjkEd1Scanner from './JjkEd1Scanner.jsx';
import ScribbleScan from './ScribbleScan.jsx';
import FortuneSealStamp from './FortuneSealStamp.jsx';

export default function StepDraw({
  busy,
  status,
  error,
  selectedCategory,
  onSelect,
  onDraw,
  drawPhase = null,
  sealLabel = '',
}) {
  const scanning = busy && (drawPhase === 'scan' || !drawPhase);
  const sealing = drawPhase === 'seal';

  // 根據狀態文字切換不同設計風格
  const isColoring =
    status?.includes('色彩') ||
    status?.includes('上色') ||
    status?.includes('後製') ||
    status?.includes('套印') ||
    status?.includes('發光') ||
    status?.includes('朱砂');
  const isScribble = status?.includes('描繪') || status?.includes('構圖');

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col px-5 pb-3 pt-2">
      <div className="shrink-0">
        <StepHeading
          step="STEP 3"
          title="今日抽籤"
          hint="選一個運勢主題，抽出今日吉凶，並生成有你出場的場景卡。"
          helpTitle="抽籤怎麼玩"
        >
          <p>先選類別（例如人際運、工作運），再按抽籤。</p>
          <p>系統會生成一張有你出場的圖，再給三句對白讓你挑。</p>
          <p>個性標籤會微調吉凶機率，但仍有運氣成分——不服可以再抽。</p>
        </StepHeading>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 basis-0 flex-col gap-2">
        {FORTUNE_CATEGORIES.map((c) => {
          const on = selectedCategory === c.id;
          return (
            <button
              key={c.id}
              type="button"
              disabled={busy}
              onClick={() => onSelect?.(c.id)}
              className={`flex min-h-0 flex-1 items-center border-2 border-[var(--ink)] px-4 py-3 text-left text-base font-semibold transition ${
                on
                  ? 'bg-[var(--accent)] text-white shadow-card'
                  : 'bg-white hover:-translate-y-0.5'
              }`}
              style={on ? undefined : { boxShadow: '3px 3px 0 0 var(--ink)' }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 shrink-0 space-y-2">
        {error ? (
          <p className="border-2 border-[var(--ink)] bg-[color-mix(in_srgb,#dc2626_12%,white)] px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="btn-primary w-full min-h-[48px]"
          disabled={busy || !selectedCategory}
          onClick={onDraw}
        >
          {busy ? '抽籤中…' : '抽！'}
        </button>
      </div>

      {scanning || sealing ? (
        <div className="absolute inset-0 z-30 flex flex-col bg-[color-mix(in_srgb,var(--paper)_94%,white)] p-5">
          {scanning ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              {isColoring ? (
                <JjkEd1Scanner className="min-h-0 flex-1" label={status} />
              ) : (
                <ScribbleScan className="min-h-0 flex-1" label={status || '描繪場景中'} />
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
              <p className="text-sm font-semibold tracking-wide text-[var(--ink)]/70">
                蓋上今日籤印
              </p>
              <FortuneSealStamp label={sealLabel || '吉'} />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
