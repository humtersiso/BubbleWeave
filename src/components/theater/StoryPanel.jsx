import React from 'react';
import { STORY_STYLES } from '../../lib/storyGeneration.js';
import { IconSparkles, IconCheck } from '../Icons.jsx';

const PANEL_H = 'h-[440px]';

/**
 * 右側 AI 劇本設定：主題 → 風格 → 故事內容 → 生成／發布
 */
export default function StoryPanel({
  storyText = '',
  theme = '',
  styleId = 'comedy',
  cardCount = 0,
  generating = false,
  onChange,
  onThemeChange,
  onStyleChange,
  onGenerate,
  onPublish,
  className = '',
}) {
  const ready = cardCount > 0;
  const activeStyle = STORY_STYLES.find((s) => s.id === styleId) || STORY_STYLES[0];

  return (
    <aside
      className={`panel flex ${PANEL_H} min-h-0 flex-col overflow-hidden ${className}`}
    >
      <div className="border-b-2 border-ink-950 bg-ink-50 px-4 py-2.5">
        <h2 className="font-display text-lg font-bold">AI 短對白</h2>
        <p className="mt-0.5 text-[11px] text-ink-500">每格 ≤16 字，氣泡壓圖、依站位避讓</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
        <input
          type="text"
          value={theme}
          onChange={(e) => onThemeChange?.(e.target.value)}
          placeholder="輸入故事主題（例：週一上班、被狗追...）"
          className="w-full shrink-0 rounded-lg border-2 border-ink-950 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-accent/30 placeholder:font-normal placeholder:text-ink-300"
        />

        <label className="flex shrink-0 flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-ink-500">風格</span>
          <div className="character-roster flex gap-1.5 overflow-x-auto pb-0.5">
            {STORY_STYLES.map((s) => {
              const active = styleId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  title={s.hint}
                  onClick={() => onStyleChange?.(s.id)}
                  className={`flex-shrink-0 rounded-full border-2 px-3 py-1 text-[11px] font-bold transition-all ${
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
          <p className="truncate text-[10px] text-ink-400">{activeStyle.hint}</p>
        </label>

        <textarea
          value={storyText}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={
            ready
              ? '在這裡寫故事內容，或點下方 AI 生成…'
              : '先從下方靈感池把卡牌拉進劇場…'
          }
          className="min-h-0 w-full flex-1 resize-none rounded-xl border-2 border-ink-950 bg-white p-3 text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-accent/30"
        />

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={!ready || generating}
            onClick={onGenerate}
            className="btn-accent flex flex-1 items-center justify-center gap-1.5 !py-2.5 text-sm"
          >
            <IconSparkles className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? '生成中…' : 'AI 生成'}
          </button>
          <button
            type="button"
            disabled={!ready || generating}
            onClick={onPublish}
            className="btn-primary flex flex-1 items-center justify-center gap-1.5 !py-2.5 text-sm"
          >
            <IconCheck className="h-4 w-4" />
            發布
          </button>
        </div>
      </div>
    </aside>
  );
}
