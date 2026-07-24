/**
 * 漫畫長圖匯出（Canvas）
 * 與預覽共用 speechBubble.paintBubblesOnImage，避免 html-to-image 離屏空白。
 */
import { formatStoryDate } from './storyMeta.js';
import { getMangaGridCols } from './mangaGridLayout.js';
import {
  normalizePanelBubbles,
  bubblesFromPlainLine,
  paintBubblesOnImage,
  MANGA_PANEL_COMPOSE_WIDTH,
  resolveCardPartySize,
  resolveContentFit,
} from './speechBubble.js';
import { attachFacesToStory } from './faceDetection.js';

const EXPORT_WIDTH = 820;
const OUTER_PAD = 20;
const PANEL_GAP = 12;
const BORDER = 2;
/** 與 MANGA_PANEL_COMPOSE 對齊：3:4 → height/width = 4/3 */
const IMAGE_ASPECT = 4 / 3;
const BG = '#f4f1eb';
const INK = '#1c1917';
const INK_MUTED = '#78716c';
const WHITE = '#ffffff';
const STRIP_BG = '#ebe8e0';
const FONT =
  '"Zen Kaku Gothic New", "Noto Sans TC", "Microsoft JhengHei", "PingFang TC", system-ui, sans-serif';

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('分鏡圖網址為空'));
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('分鏡圖載入失敗'));
    img.src = src;
  });

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const gridCellWidth = (cols) => {
  // 氣泡字級依 contentW 等比縮放（bubbleScale），不必鎖死 1080
  const gridW = EXPORT_WIDTH - OUTER_PAD * 2;
  return (gridW - PANEL_GAP * Math.max(0, cols - 1)) / cols;
};

/** @param {CanvasRenderingContext2D} ctx */
const drawLabelBadge = (ctx, text, x, y, opts = {}) => {
  const {
    font = `bold 11px ${FONT}`,
    padX = 7,
    height = 20,
    maxWidth = 200,
    bg = WHITE,
    color = INK,
    borderWidth = 1.5,
    align = 'left',
  } = opts;
  ctx.font = font;
  let label = String(text || '');
  while (label.length > 1 && ctx.measureText(label).width + padX * 2 > maxWidth) {
    label = `${label.slice(0, -2)}…`;
  }
  const tw = ctx.measureText(label).width;
  const bw = tw + padX * 2;
  const bx = align === 'right' ? x - bw : x;
  ctx.fillStyle = bg;
  ctx.strokeStyle = INK;
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.rect(bx, y, bw, height);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + padX, y + height / 2);
};

/** @param {CanvasRenderingContext2D} ctx */
const measureMetaHeader = (ctx, meta, width) => {
  if (!meta) return 0;
  return 92;
};

/** @param {CanvasRenderingContext2D} ctx */
const drawMetaHeader = (ctx, meta, x, y, width) => {
  if (!meta) return y;
  const boxH = 84;
  const pad = 14;
  ctx.fillStyle = 'rgba(250, 249, 246, 0.95)';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.fillRect(x + OUTER_PAD, y, width - OUTER_PAD * 2, boxH);
  ctx.strokeRect(x + OUTER_PAD, y, width - OUTER_PAD * 2, boxH);

  let ty = y + pad;
  ctx.fillStyle = INK_MUTED;
  ctx.font = `11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(meta.brand || 'BubbleWeave 織泡劇場', x + OUTER_PAD + pad, ty);
  ty += 18;
  ctx.fillStyle = INK;
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillText(String(meta.title || '故事串').slice(0, 28), x + OUTER_PAD + pad, ty);
  ty += 26;
  ctx.fillStyle = INK_MUTED;
  ctx.font = `12px ${FONT}`;
  const bits = [
    meta.author ? `作者 ${meta.author}` : '',
    meta.theme ? `主題 ${meta.theme}` : '',
    meta.cast ? `登場 ${meta.cast}` : '',
    meta.createdAt ? formatStoryDate(meta.createdAt) : '',
  ].filter(Boolean);
  ctx.fillText(bits.join(' · '), x + OUTER_PAD + pad, ty);
  return y + boxH + PANEL_GAP;
};

const measurePanel = (cellW) => {
  const contentW = cellW - BORDER * 2;
  const imageH = Math.round(contentW * IMAGE_ASPECT);
  return imageH + BORDER * 2;
};

/**
 * @param {CanvasRenderingContext2D} ctx
 * @returns {number} panel height
 */
const drawPanelAt = (ctx, card, index, line, img, boxX, boxY, cellW, bubbles = null) => {
  const contentW = cellW - BORDER * 2;
  const imageH = Math.round(contentW * IMAGE_ASPECT);
  const panelBubbles = bubbles?.length
    ? normalizePanelBubbles(card, bubbles)
    : bubblesFromPlainLine(card, line);
  const boxH = imageH + BORDER * 2;

  ctx.fillStyle = WHITE;
  ctx.fillRect(boxX, boxY, cellW, boxH);
  ctx.strokeStyle = INK;
  ctx.lineWidth = BORDER;
  ctx.strokeRect(boxX, boxY, cellW, boxH);

  const imgX = boxX + BORDER;
  const imgY = boxY + BORDER;

  ctx.fillStyle = STRIP_BG;
  ctx.fillRect(imgX, imgY, contentW, imageH);

  let contentFit = null;
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(imgX, imgY, contentW, imageH);
    ctx.clip();
    ctx.filter = 'grayscale(1)';
    contentFit = resolveContentFit(
      contentW,
      imageH,
      img.naturalWidth,
      img.naturalHeight
    );
    ctx.drawImage(
      img,
      imgX + contentFit.dx,
      imgY + contentFit.dy,
      contentFit.dw,
      contentFit.dh
    );
    ctx.restore();
  } else {
    ctx.fillStyle = INK_MUTED;
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('無分鏡圖', imgX + contentW / 2, imgY + imageH / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // 與預覽同一套氣泡幾何（含 content-fit 座標映射）
  paintBubblesOnImage(ctx, imgX, imgY, contentW, imageH, panelBubbles, {
    partySize: resolveCardPartySize(card),
    contentFit,
  });

  const pageLabel = String(index + 1).padStart(2, '0');
  const pageY = panelBubbles.length ? imgY + imageH - 26 : imgY + 6;
  drawLabelBadge(ctx, pageLabel, imgX + 6, pageY, {
    font: `bold 11px ${FONT}`,
    padX: 7,
    height: 20,
    borderWidth: 1.5,
  });

  const rarityLabel = card?.rarity?.label;
  if (rarityLabel) {
    drawLabelBadge(ctx, rarityLabel, imgX + contentW - 6, imgY + 6, {
      font: `bold 10px ${FONT}`,
      padX: 6,
      height: 18,
      borderWidth: 1.5,
      align: 'right',
      bg: WHITE,
      color: INK,
    });
  }

  return boxH;
};

/** @param {CanvasRenderingContext2D} ctx */
const measureGridHeight = (cards, startY) => {
  const cols = getMangaGridCols(cards.length);
  const cellW = gridCellWidth(cols);
  let y = startY;
  const rowCount = Math.ceil(cards.length / cols);
  for (let row = 0; row < rowCount; row += 1) {
    let rowH = 0;
    for (let col = 0; col < cols; col += 1) {
      const i = row * cols + col;
      if (i >= cards.length) break;
      rowH = Math.max(rowH, measurePanel(cellW));
    }
    y += rowH + PANEL_GAP;
  }
  return y;
};

/** @param {CanvasRenderingContext2D} ctx */
const drawGrid = (ctx, cards, panelLines, images, startY, panelBubbles = []) => {
  const cols = getMangaGridCols(cards.length);
  const cellW = gridCellWidth(cols);
  const baseX = OUTER_PAD;
  let y = startY;
  const rowCount = Math.ceil(cards.length / cols);

  for (let row = 0; row < rowCount; row += 1) {
    let rowH = 0;
    const slots = [];
    for (let col = 0; col < cols; col += 1) {
      const i = row * cols + col;
      if (i >= cards.length) break;
      rowH = Math.max(rowH, measurePanel(cellW));
      slots.push({ i, col });
    }
    for (const { i, col } of slots) {
      const boxX = baseX + col * (cellW + PANEL_GAP);
      drawPanelAt(
        ctx,
        cards[i],
        i,
        panelLines[i] || '',
        images[i],
        boxX,
        y,
        cellW,
        panelBubbles[i] || null
      );
    }
    y += rowH + PANEL_GAP;
  }
  return y;
};

/**
 * @param {{ cards: object[], panelLines?: string[], panelBubbles?: object[][], meta?: object, filename?: string }} options
 */
export const exportMangaStripImage = async ({
  cards = [],
  panelLines = [],
  panelBubbles = [],
  meta = null,
  filename = 'bubbleweave-manga.jpg',
}) => {
  if (!cards.length) throw new Error('沒有可匯出的分鏡');

  const images = await Promise.all(
    cards.map((card) =>
      card.imageUrl ? loadImage(card.imageUrl).catch(() => null) : Promise.resolve(null)
    )
  );

  if (!images.some(Boolean)) {
    throw new Error('分鏡圖皆無法載入，請確認卡牌已有圖片');
  }

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) throw new Error('無法建立畫布');

  let totalH = OUTER_PAD;
  totalH += meta ? measureMetaHeader(measureCtx, meta, EXPORT_WIDTH) : 0;
  totalH = measureGridHeight(cards, totalH);
  totalH += OUTER_PAD;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH * scale;
  canvas.height = totalH * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法建立畫布');

  ctx.scale(scale, scale);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, EXPORT_WIDTH, totalH);

  let y = OUTER_PAD;
  y = drawMetaHeader(ctx, meta, 0, y, EXPORT_WIDTH);

  let finalPanelBubbles = panelBubbles;
  const missingFace = cards.some((_, i) => {
    const bubbles = panelBubbles[i] || [];
    return bubbles.length > 0 && bubbles.some((b) => !b.face);
  });
  if (missingFace) {
    try {
      finalPanelBubbles = await attachFacesToStory(cards, panelBubbles, {
        force: true,
      });
    } catch (err) {
      console.warn('Fallback MediaPipe faces failed:', err);
    }
  }

  drawGrid(ctx, cards, panelLines, images, y, finalPanelBubbles);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('圖片產生失敗'))),
      'image/jpeg',
      0.94
    );
  });

  downloadBlob(blob, filename);
};
