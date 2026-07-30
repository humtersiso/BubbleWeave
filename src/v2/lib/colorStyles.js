/**
 * 籤卡著色風格：全面 Gemini 圖生圖二階段上色
 */

import {
  applyChiikawaColorPass,
  applyComicsColorPass,
  applyEd1ColorPass,
  applyNeonColorPass,
  applyRisoColorPass,
  applySelectiveColorPass,
  applySumieColorPass,
} from '../../lib/gemini.js';

/** @typedef {'jjk'|'selective'|'chiikawa'|'riso'|'comics'|'neon'|'sumie'} ColorStyleId */

export const COLOR_STYLE_OPTIONS = [
  { id: 'jjk', label: '咒術 ED1', hint: '錯位色溢・AI', kind: 'ai' },
  { id: 'selective', label: '主題橘', hint: '局部上色・AI', kind: 'ai' },
  { id: 'chiikawa', label: '吉依卡哇', hint: '暖棕線・粉彩水彩・AI', kind: 'ai' },
  { id: 'riso', label: 'Risograph', hint: '專色套印・顆粒・AI', kind: 'ai' },
  { id: 'comics', label: '復古連環畫', hint: '舊報紙質感・AI', kind: 'ai' },
  { id: 'neon', label: '賽博霓虹', hint: '黑夜發光線・AI', kind: 'ai' },
  { id: 'sumie', label: '水墨朱砂', hint: '和紙筆觸・AI', kind: 'ai' },
];

export const COLOR_STYLE_BY_ID = Object.fromEntries(COLOR_STYLE_OPTIONS.map((o) => [o.id, o]));

export const DEFAULT_COLOR_STYLE = 'jjk';

export const normalizeColorStyle = (id) => (COLOR_STYLE_BY_ID[id] ? id : DEFAULT_COLOR_STYLE);

export const colorStyleLabel = (id) =>
  COLOR_STYLE_BY_ID[normalizeColorStyle(id)]?.label || '風格';

export const colorStyleStatus = (id) => {
  const s = normalizeColorStyle(id);
  const map = {
    jjk: '咒術風上色中…',
    selective: '主題色局部上色中…',
    chiikawa: '吉依卡哇上色中…',
    riso: 'Risograph 上色中…',
    comics: '復古連環畫上色中…',
    neon: '賽博霓虹上色中…',
    sumie: '水墨朱砂上色中…',
  };
  return map[s] || '風格上色中…';
};

const APPLY_COLOR_PASS = {
  jjk: applyEd1ColorPass,
  selective: applySelectiveColorPass,
  chiikawa: applyChiikawaColorPass,
  riso: applyRisoColorPass,
  comics: applyComicsColorPass,
  neon: applyNeonColorPass,
  sumie: applySumieColorPass,
};

/**
 * @param {string} inkDataUrl
 * @param {ColorStyleId|string} styleId
 */
export const applyColorStyle = async (inkDataUrl, styleId = DEFAULT_COLOR_STYLE) => {
  if (!inkDataUrl) throw new Error('缺少墨線底圖');
  const id = normalizeColorStyle(styleId);
  const runPass = APPLY_COLOR_PASS[id] || applyEd1ColorPass;
  return runPass(inkDataUrl);
};
