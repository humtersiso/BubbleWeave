import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  FORTUNE_TIERS,
  FORTUNE_CATEGORIES,
  rollFortuneTier,
  fortuneDisplay,
  CATEGORY_BY_ID,
} from '../data/fortune.js';

describe('fortune data', () => {
  it('有 6 檔籤等與正確排序權重鍵', () => {
    expect(FORTUNE_TIERS).toHaveLength(6);
    expect(FORTUNE_TIERS.map((t) => t.id)).toEqual([
      'dai_kichi',
      'kichi',
      'chu_kichi',
      'sho_kichi',
      'kyo',
      'dai_kyo',
    ]);
  });

  it('有 5 個運勢類別', () => {
    expect(FORTUNE_CATEGORIES).toHaveLength(5);
    expect(CATEGORY_BY_ID.career.short).toBe('工作運');
  });

  it('fortuneDisplay 未知 id 回退小吉', () => {
    expect(fortuneDisplay('nope').label).toBe('小吉');
    expect(fortuneDisplay('dai_kyo').emoji).toBe('💀');
  });

  it('rollFortuneTier 只回傳合法 id', () => {
    const ids = new Set(FORTUNE_TIERS.map((t) => t.id));
    for (let i = 0; i < 40; i += 1) {
      expect(ids.has(rollFortuneTier(['樂天']))).toBe(true);
      expect(ids.has(rollFortuneTier(['焦慮小宇宙']))).toBe(true);
      expect(ids.has(rollFortuneTier([]))).toBe(true);
    }
  });

  it('樂觀標籤提高吉系抽中機率（統計傾向）', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(['dai_kichi', 'kichi', 'chu_kichi']).toContain(rollFortuneTier(['樂天']));
    Math.random.mockRestore();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
