/** 漫畫分鏡網格：行 × 列（rows × cols），最多 20 格、每列最多 4 格 */

export const MANGA_GRID_MAX_PANELS = 20;
export const MANGA_GRID_MAX_COLS = 4;

/**
 * @param {number} count 分鏡數（1～20）
 * @returns {{ rows: number, cols: number }}
 */
export function getMangaGridLayout(count) {
  const n = Math.min(Math.max(0, Math.floor(count)), MANGA_GRID_MAX_PANELS);
  if (n <= 0) return { rows: 0, cols: 0 };
  if (n === 1) return { rows: 1, cols: 1 };
  if (n <= 4) return { rows: 2, cols: 2 };
  if (n <= 6) return { rows: 3, cols: 2 };
  if (n <= 8) return { rows: 4, cols: 2 };
  if (n <= 12) {
    const cols = 3;
    return { rows: Math.ceil(n / cols), cols };
  }
  const cols = MANGA_GRID_MAX_COLS;
  return { rows: Math.ceil(n / cols), cols };
}

/** @param {number} count */
export function getMangaGridCols(count) {
  return getMangaGridLayout(count).cols;
}

/**
 * 依容器寬度自適應欄數：橫向優先排滿一列，避免桌面強制 2×2 留白。
 * @param {number} count
 * @param {number} containerWidth px
 * @param {{ minPanelWidth?: number, gap?: number, maxCols?: number }} [opts]
 */
export function getAdaptiveMangaCols(
  count,
  containerWidth,
  { minPanelWidth = 148, gap = 16, maxCols = MANGA_GRID_MAX_COLS } = {}
) {
  const n = Math.min(Math.max(0, Math.floor(count)), MANGA_GRID_MAX_PANELS);
  if (n <= 0) return 0;
  if (!containerWidth || containerWidth <= 0) {
    // 寬度未知時：少數格優先橫排
    return Math.min(n, maxCols);
  }
  const fit = Math.floor((containerWidth + gap) / (minPanelWidth + gap));
  return Math.max(1, Math.min(n, maxCols, Math.max(1, fit)));
}
