import React, { useState } from 'react';
import { getPsychQuestions } from '../data/psychQuiz.js';
import { StepHeading } from './HelpTip.jsx';
import JjkEd1Scanner from './JjkEd1Scanner.jsx';
import ScribbleScan from './ScribbleScan.jsx';

export default function StepPersonality({
  profile,
  quizAnswers = {},
  quizSetId,
  tags = [],
  busy,
  status,
  onAnswer,
  onNameChange,
  onContinue,
}) {
  const questions = getPsychQuestions(quizSetId) || [];
  const answeredCount = questions.filter((q) => quizAnswers && quizAnswers[q.id]).length;
  const answered = questions.length > 0 && answeredCount === questions.length;
  const ready = Boolean(profile?.portraitUrl) && answered && (tags?.length || 0) >= 3 && !busy;
  const hasPortrait = Boolean(profile?.portraitUrl);
  const [imgBroken, setImgBroken] = useState(false);

  const isColoring =
    String(status || '').includes('色彩') ||
    String(status || '').includes('上色') ||
    String(status || '').includes('後製') ||
    String(status || '').includes('套印') ||
    String(status || '').includes('發光') ||
    String(status || '').includes('朱砂');

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col px-5 pb-3 pt-2">
      <div className="shrink-0">
        <StepHeading
          step="STEP 2"
          title="角色 × 個性"
          hint="確認 2D 角色與暱稱，再答 5 題小測驗，產出今日個性標籤。"
          helpTitle="這一頁在做什麼"
        >
          <p>左邊是轉繪後的你；暱稱可改，之後分享文案會用到。</p>
          <p>答完 5 題會生出個性標籤，抽籤時會參考這些標籤調整語氣與機率。</p>
        </StepHeading>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pb-4 overscroll-contain">
        {busy ? (
          <div className="mx-auto flex aspect-[3/4] w-full max-w-[340px] flex-col gap-4 overflow-hidden border-2 border-[var(--ink)] shadow-card">
            {isColoring ? (
              <JjkEd1Scanner className="min-h-0 flex-1" label={status} />
            ) : (
              <ScribbleScan className="min-h-0 flex-1" label={status || '處理中'} />
            )}
          </div>
        ) : (
          <>
            {hasPortrait && !imgBroken ? (
              <div
                className="relative mx-auto w-full overflow-hidden border-2 border-[var(--ink)] bg-[#f7f4ef] shadow-card"
                style={{ maxWidth: 340, aspectRatio: '3 / 4' }}
              >
                <img
                  src={profile.portraitUrl}
                  alt="今日角色"
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={() => setImgBroken(true)}
                />
                {profile.iconUrl ? (
                  <img
                    src={profile.iconUrl}
                    alt=""
                    className="absolute bottom-2.5 right-2.5 z-10 h-24 w-24 rounded-full border-[3px] border-[var(--ink)] bg-white object-cover shadow-lift"
                  />
                ) : null}
              </div>
            ) : (
              <div
                className="mx-auto flex w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--ink)] bg-white px-4 text-center text-sm"
                style={{ maxWidth: 340, aspectRatio: '3 / 4' }}
              >
                <p className="font-semibold">{imgBroken ? '角色圖載入失敗' : '尚未有角色'}</p>
                <p className="text-xs opacity-60">
                  {imgBroken ? '請回 Step1 重新上傳轉繪' : '請回上一步上傳'}
                </p>
              </div>
            )}

            <label className="text-sm block mt-4">
              <span className="mb-1 block font-semibold text-[var(--ink)]/70">暱稱</span>
              <input
                className="w-full border-2 border-[var(--ink)] bg-white px-3 py-2 font-bold shadow-[2px_2px_0_0_var(--ink)]"
                value={profile?.displayName || ''}
                onChange={(e) => onNameChange?.(e.target.value)}
                maxLength={12}
              />
            </label>

            <div className="flex items-center justify-between mt-6">
              <p className="text-sm font-bold text-[var(--ink)]/70">個性測驗</p>
              <p className="text-xs font-black text-[var(--accent)]">{answeredCount}／5</p>
            </div>

            <div className="space-y-4">
              {questions.map((q) => (
                <fieldset key={q.id} className="border-2 border-[var(--ink)] bg-white p-3 shadow-[2px_2px_0_0_var(--ink)]">
                  <legend className="px-1 text-xs font-black uppercase tracking-tighter">Question</legend>
                  <p className="mb-2 text-sm font-bold">{q.prompt}</p>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {q.options.map((opt) => {
                      const on = quizAnswers?.[q.id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={busy}
                          onClick={() => onAnswer?.(q.id, opt.id)}
                          className={`min-h-[44px] border-2 border-[var(--ink)] px-2 py-2 text-left text-xs font-bold transition ${
                            on
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--paper)] hover:bg-white shadow-[1px_1px_0_0_var(--ink)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>

            {tags?.length ? (
              <div className="flex flex-wrap gap-2 mt-4">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="border-2 border-[var(--ink)] bg-[color-mix(in_srgb,var(--accent)_12%,white)] px-2 py-0.5 text-xs font-black shadow-[1.5px_1.5px_0_0_var(--ink)]"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            ) : null}

            {!ready && !busy && answeredCount < 5 ? (
              <p className="text-xs font-bold text-[var(--accent)] animate-pulse">
                還差 {5 - answeredCount} 題就能繼續抽籤
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-3 shrink-0">
        <button
          type="button"
          className="btn-primary w-full min-h-[52px] text-lg font-black tracking-widest shadow-[4px_4px_0_0_var(--ink)]"
          disabled={!ready}
          onClick={onContinue}
        >
          去抽籤
        </button>
      </div>
    </section>
  );
}
