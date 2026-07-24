/**
 * 將故事全文對應到各格分鏡對白。
 * @param {string} storyText
 * @param {number} cardCount
 * @returns {{ panelLines: string[], fullScript: string }}
 */
export const buildMangaPanelLines = (storyText, cardCount) => {
  const fullScript = (storyText || '').trim();
  if (!cardCount) return { panelLines: [], fullScript };

  const panelLines = splitStoryToDialogues(fullScript, cardCount);
  return { panelLines, fullScript };
};

/**
 * 將整篇故事文字拆成各格對白（發布／舊版 feed 相容用）。
 * @param {string} text
 * @param {number} count
 * @returns {string[]}
 */
export const splitStoryToDialogues = (text, count) => {
  if (!count) return [];
  const raw = (text || '').trim();
  if (!raw) return Array.from({ length: count }, () => '');

  const bySep = raw
    .split(/\n?\s*---\s*\n?/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (bySep.length >= count) return bySep.slice(0, count);

  const byPara = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (byPara.length >= count) return byPara.slice(0, count);

  return Array.from({ length: count }, (_, i) => byPara[i] || (i === 0 ? raw : ''));
};

/**
 * AI 各格對白合併為一篇故事文字。
 * @param {string[]} lines
 */
export const joinDialoguesToStory = (lines) =>
  (lines || [])
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n\n');
