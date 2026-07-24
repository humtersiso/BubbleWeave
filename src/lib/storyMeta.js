/**
 * 故事基本資訊（匯出圖片／發布用）。
 * 標題以主題為主；登場角色僅作次要欄位（可省略顯示）。
 * @param {object[]} cards
 * @param {{ author?: string, createdAt?: string|Date, title?: string, theme?: string }} [options]
 */
export const buildStoryMeta = (cards, options = {}) => {
  const list = cards || [];
  const author = options.author || '我';
  const createdAt =
    options.createdAt instanceof Date
      ? options.createdAt.toISOString()
      : options.createdAt || new Date().toISOString();

  const castNames = [
    ...new Set(list.flatMap((c) => (c.castMembers || []).map((m) => m.nameZh)).filter(Boolean)),
  ];

  const scenes = [
    ...new Set(
      list
        .map((c) => c.recipe?.scene || c.scene?.split('·')?.[2]?.trim())
        .filter(Boolean)
    ),
  ];

  const autoTheme =
    options.theme?.trim() ||
    (scenes.length > 0
      ? scenes
          .slice(0, 3)
          .map((s) => s.split('/')[0].trim())
          .join(' · ')
      : '織泡劇場');

  // 標題＝主題（誰跟誰不是重點）
  const autoTitle =
    options.title?.trim() || autoTheme || `${list.length} 格故事串`;

  return {
    title: autoTitle,
    author,
    createdAt,
    theme: autoTheme,
    panelCount: list.length,
    cast: castNames.join('、'),
    brand: 'BubbleWeave 織泡劇場',
  };
};

/** 從已發布故事還原 meta（供 feed 匯出等） */
export const storyToMeta = (story) =>
  buildStoryMeta(story?.cards || [], {
    author: story?.author,
    createdAt: story?.createdAt,
    title: story?.theme || story?.title,
    theme: story?.theme,
  });

/** @param {string} iso */
export const formatStoryDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};
