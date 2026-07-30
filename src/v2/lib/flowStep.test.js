import { describe, expect, it } from 'vitest';
import { resolveFlowStep } from './flowStep.js';

describe('resolveFlowStep', () => {
  it('無肖像一律 Step1', () => {
    expect(resolveFlowStep({ flowStep: 3 }, { tags: ['a', 'b', 'c'] }, null).step).toBe(1);
  });

  it('有肖像無標籤至少 Step2', () => {
    expect(
      resolveFlowStep({ flowStep: 1 }, { portraitUrl: 'x', tags: [] }, null).step
    ).toBe(2);
  });

  it('有肖像＋標籤可到 Step3', () => {
    expect(
      resolveFlowStep(
        { flowStep: 2 },
        { portraitUrl: 'x', tags: ['a', 'b', 'c'] },
        null
      ).step
    ).toBe(3);
  });

  it('Step4 無草稿且有 fortuneCards → Step5 並帶草稿', () => {
    const card = { id: 'f1' };
    const r = resolveFlowStep(
      { flowStep: 4, fortuneCards: [card] },
      { portraitUrl: 'x', tags: ['a', 'b', 'c'] },
      null
    );
    expect(r.step).toBe(5);
    expect(r.draft).toBe(card);
  });

  it('Step4 無草稿也無卡 → 回退 Step3', () => {
    const r = resolveFlowStep(
      { flowStep: 4, fortuneCards: [] },
      { portraitUrl: 'x', tags: ['a', 'b', 'c'] },
      null
    );
    expect(r.step).toBe(3);
  });

  it('有草稿時保留 Step4', () => {
    const draft = { id: 'd1' };
    const r = resolveFlowStep(
      { flowStep: 4 },
      { portraitUrl: 'x', tags: ['a', 'b', 'c'] },
      draft
    );
    expect(r.step).toBe(4);
    expect(r.draft).toBe(draft);
  });
});
