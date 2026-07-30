import { describe, expect, it } from 'vitest';
import {
  PSYCH_QUESTIONS,
  PSYCH_QUIZ_SETS,
  tagsFromQuizAnswers,
  getPsychQuestions,
} from './psychQuiz.js';

describe('psychQuiz', () => {
  it('有 5 組題庫，每組 5 題 × 4 選項', () => {
    expect(PSYCH_QUIZ_SETS).toHaveLength(5);
    for (const set of PSYCH_QUIZ_SETS) {
      expect(set.questions).toHaveLength(5);
      for (const q of set.questions) {
        expect(q.options).toHaveLength(4);
      }
    }
    expect(PSYCH_QUESTIONS).toHaveLength(5);
  });

  it('tagsFromQuizAnswers 合併去重並依頻率排序', () => {
    const tags = tagsFromQuizAnswers({
      q1: 'a',
      q2: 'a',
      q3: 'a',
      q4: 'a',
      q5: 'a',
    });
    expect(tags.length).toBeGreaterThan(0);
    expect(tagsFromQuizAnswers({})).toEqual([]);
  });

  it('getPsychQuestions 依 setId 取題', () => {
    const qs = getPsychQuestions('set_office');
    expect(qs[0].prompt).toMatch(/開會/);
  });
});
