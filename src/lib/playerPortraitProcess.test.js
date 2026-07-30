import { describe, expect, it } from 'vitest';
import { assertSingleClearFace } from './playerPortraitProcess.js';

const face = (score, area) => ({ score, area, x: 0.5, y: 0.4 });

describe('assertSingleClearFace', () => {
  it('單人清楚臉通過（嚴格）', () => {
    const { bestFace } = assertSingleClearFace([face(0.9, 0.05)]);
    expect(bestFace.score).toBe(0.9);
  });

  it('真人自拍低信心也可過', () => {
    const { bestFace } = assertSingleClearFace([face(0.18, 0.02)], { mode: 'photo' });
    expect(bestFace.score).toBe(0.18);
  });

  it('自拍只要有單一人臉即可（不擋臉偏小）', () => {
    const { bestFace } = assertSingleClearFace([face(0.2, 0.005)], { mode: 'photo' });
    expect(bestFace.score).toBe(0.2);
  });

  it('多人高信心臉擋下', () => {
    expect(() =>
      assertSingleClearFace([face(0.9, 0.05), face(0.8, 0.03)])
    ).toThrow(/張臉/);
  });

  it('無清楚臉擋下', () => {
    expect(() => assertSingleClearFace([])).toThrow(/偵測不到/);
    expect(() => assertSingleClearFace([face(0.1, 0.001)])).toThrow(/偵測不到/);
  });

  it('嚴格模式臉太小不夠清楚擋下', () => {
    expect(() => assertSingleClearFace([face(0.5, 0.01)])).toThrow(/不夠清楚|太小/);
  });

  it('嚴格模式弱第二張臉也擋', () => {
    expect(() =>
      assertSingleClearFace([face(0.9, 0.05), face(0.2, 0.015)])
    ).toThrow(/疑似還有其他人|張臉/);
  });

  it('自拍模式小雜訊不擋', () => {
    const { bestFace } = assertSingleClearFace(
      [face(0.5, 0.04), face(0.05, 0.001)],
      { mode: 'photo' }
    );
    expect(bestFace.score).toBe(0.5);
  });
});
