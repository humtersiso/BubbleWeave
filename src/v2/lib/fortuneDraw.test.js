import { describe, expect, it } from 'vitest';
import {
  buildFortuneDialoguePrompt,
  CATEGORY_SCENE_HINTS,
  clipDialogue,
  finalizeDialogue,
  pickSeasonEntry,
} from './fortuneDraw.js';

describe('fortuneDraw scene + dialogue grounding', () => {
  it('愛情運場景挑選仍會回傳有效卡', () => {
    const entry = pickSeasonEntry('love');
    expect(entry?.scene_zh).toBeTruthy();
  });

  it('類別關鍵字表涵蓋五個運勢', () => {
    expect(Object.keys(CATEGORY_SCENE_HINTS).sort()).toEqual(
      ['career', 'health', 'love', 'social', 'wealth'].sort()
    );
  });

  it('對白 prompt 以場景／互動為主、籤為調味', () => {
    const prompt = buildFortuneDialoguePrompt({
      categoryId: 'career',
      fortuneId: 'dai_kyo',
      tags: ['社畜吐槽'],
      displayName: '阿明',
      sceneZh: '士林夜市臭豆腐攤',
      actionZh: '排隊被插隊',
      castNames: ['阿明', 'Bob'],
    });
    expect(prompt).toContain('士林夜市臭豆腐攤');
    expect(prompt).toContain('排隊被插隊');
    expect(prompt).toContain('Bob');
    expect(prompt).toContain('工作／學業運');
    expect(prompt).toContain('大凶');
    expect(prompt).toContain('禁止直接寫');
    expect(prompt).toContain('約 20%');
  });

  it('clipDialogue 不會切成逗號半句，會優先完整句尾', () => {
    const raw = '爬到快斷氣，Cindy遞水的手比風景還好看啦真的啊';
    const clipped = clipDialogue(raw, 18);
    expect([...clipped].length).toBeLessThanOrEqual(26); // max + grace
    expect(clipped.endsWith('，')).toBe(false);
  });

  it('finalizeDialogue 會清除懸空尾詞', () => {
    const raw = '努力想夾起那一顆蚵仔，結果整鍋攤位衝擊都跟我對抗，這種進退兩難的窘境，也。';
    const fixed = finalizeDialogue(raw, 36);
    expect(fixed.endsWith('也。')).toBe(false);
    expect(/[。！？…～!?]$/u.test(fixed)).toBe(true);
  });

});
