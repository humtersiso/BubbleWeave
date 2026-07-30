import { CATEGORY_BY_ID, FORTUNE_BY_ID } from '../data/fortune.js';
import { BRAND_LOCKUP } from './brand.js';
import { resolveBadgeExportColors } from '../components/FortuneCornerBadge.jsx';
import { DIALOGUE_MAX_CHARS } from './fortuneDraw.js';

/**
 * 限動文案：根據吉凶調整口吻
 */
export const buildStoryCaption = ({ displayName, categoryId, fortuneId }) => {
  const name = displayName || '我';
  const cat = CATEGORY_BY_ID[categoryId]?.short || '運勢';
  const f = FORTUNE_BY_ID[fortuneId] || FORTUNE_BY_ID.sho_kichi;
  const isGood = ['dai_kichi', 'kichi', 'chu_kichi'].includes(fortuneId);

  if (isGood) {
    return `「${name}今日${cat}：【${f.label}】！點連結沾點好運，也看看你抽到什麼 ⬇️」`;
  }
  return `「${name}今日${cat}：【${f.label}】！點連結幫我改運，也看看你抽到什麼 ⬇️」`;
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('圖載入失敗'));
    img.src = src;
  });

/** 等比蓋滿矩形（對齊 UI object-cover，不留上下白邊） */
const fitCover = (srcW, srcH, boxW, boxH) => {
  const scale = Math.max(boxW / srcW, boxH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  return {
    dx: (boxW - dw) / 2,
    dy: (boxH - dh) / 2,
    dw,
    dh,
  };
};

/**
 * 合成 9:16 限動底（1080×1920）
 * 卡框 3:4 滿版 cover；籤級在卡框左上（對齊 UI）
 */
export const composeStoryExport = async ({
  cardImageUrl,
  caption,
  bubbleText,
  manualPos,
  fortuneId,
  fortuneLabel,
  badgeStyle = 'foil',
}) => {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ebe6dc';
  ctx.fillRect(0, 0, W, H);

  const padX = 36;
  const topBand = 150;
  const bottomBand = 88;
  const maxCardW = W - padX * 2;
  const maxCardH = H - topBand - bottomBand;
  let cardH = maxCardH;
  let cardW = Math.round(cardH * 0.75);
  if (cardW > maxCardW) {
    cardW = maxCardW;
    cardH = Math.round(cardW * (4 / 3));
  }
  const cx = Math.round((W - cardW) / 2);
  const cy = topBand + Math.round((maxCardH - cardH) / 2);

  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 36px "Outfit", "Noto Sans TC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  wrapText(ctx, caption || '', W / 2, 72, W - 72, 44);

  const img = await loadImage(cardImageUrl);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  // 外框
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 6;
  ctx.fillStyle = '#f4f1eb';
  ctx.fillRect(cx - 6, cy - 6, cardW + 12, cardH + 12);
  ctx.strokeRect(cx - 6, cy - 6, cardW + 12, cardH + 12);

  // 卡內滿版 cover（與 UI object-cover 一致，底下不會多一塊空白）
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx, cy, cardW, cardH);
  ctx.clip();
  const fit = fitCover(srcW, srcH, cardW, cardH);
  ctx.drawImage(img, cx + fit.dx, cy + fit.dy, fit.dw, fit.dh);
  ctx.restore();

  const label =
    fortuneLabel ||
    FORTUNE_BY_ID[fortuneId]?.label ||
    '';
  const styleId = ['ink', 'foil', 'seal'].includes(badgeStyle) ? badgeStyle : 'foil';
  if (label) {
    // 對齊 UI：absolute left-2 top-2（約 16px）
    drawFortuneBadge(ctx, label, fortuneId, cx + 16, cy + 16, styleId);
  }

  if (bubbleText) {
    // 座標相對整個 3:4 卡框（與 UI 舞台百分比一致）
    const bx =
      manualPos?.x != null ? cx + manualPos.x * cardW : cx + cardW * 0.62;
    const by =
      manualPos?.y != null ? cy + manualPos.y * cardH : cy + cardH * 0.16;
    drawBubble(ctx, String(bubbleText).slice(0, DIALOGUE_MAX_CHARS), bx, by, cardW);
  }

  ctx.fillStyle = '#1c1917';
  ctx.font = '600 26px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(BRAND_LOCKUP, W / 2, H - 36);

  return canvas.toDataURL('image/jpeg', 0.92);
};

const drawFortuneBadge = (ctx, label, fortuneId, x, y, variant = 'foil') => {
  const style = resolveBadgeExportColors(fortuneId, variant);
  ctx.font = '800 30px "Outfit", "Noto Sans TC", sans-serif';
  const padX = 16;
  const padY = 10;
  const tw = ctx.measureText(label).width;
  const bw = Math.max(tw + padX * 2, 64);
  const bh = 30 + padY * 2;

  if (variant === 'seal') {
    const r = Math.max(bw, bh) / 2 + 4;
    const ox = x + bw / 2;
    const oy = y + bh / 2;
    ctx.beginPath();
    ctx.arc(ox, oy, r, 0, Math.PI * 2);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = style.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, ox, oy);
    return;
  }

  // foil（預設）／ink：斜切箔邊對齊 CSS clip-path
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + bw, y);
  ctx.lineTo(x + bw, y + bh * 0.72);
  ctx.lineTo(x + bw * 0.82, y + bh);
  ctx.lineTo(x, y + bh);
  ctx.closePath();

  if (variant === 'foil') {
    const grad = ctx.createLinearGradient(x, y, x + bw, y + bh);
    grad.addColorStop(0, style.fill);
    grad.addColorStop(0.45, style.fill);
    grad.addColorStop(1, '#fffef8');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = style.fill;
  }
  ctx.fill();
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = style.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + padX, y + bh / 2);
};

const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
  const chars = [...text];
  let line = '';
  let yy = y;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = ch;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
};

/**
 * 對齊 UI FortuneBubble：固定約 72% 圖寬
 */
const drawBubble = (ctx, text, x, y, imageWidth) => {
  const bubbleW = Math.max(160, Math.round((imageWidth || 900) * 0.72));
  const padX = 18;
  const padY = 14;
  const maxTextW = bubbleW - padX * 2;
  const fontSize = Math.max(22, Math.round(imageWidth * 0.032));
  const lineHeight = Math.round(fontSize * 1.25);

  ctx.font = `600 ${fontSize}px "Outfit", "Noto Sans TC", sans-serif`;
  const lines = [];
  let line = '';
  for (const ch of [...String(text || '')]) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxTextW && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (!lines.length) return;

  const bh = lines.length * lineHeight + padY * 2;
  const left = Math.round(x - bubbleW / 2);
  const top = Math.round(y - bh / 2);

  ctx.fillStyle = '#fffef8';
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 3;
  ctx.fillRect(left, top, bubbleW, bh);
  ctx.strokeRect(left, top, bubbleW, bh);
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(left + 3, top + bh, bubbleW, 3);
  ctx.fillRect(left + bubbleW, top + 3, 3, bh);

  ctx.fillStyle = '#1c1917';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => {
    ctx.fillText(l, x, startY + i * lineHeight);
  });
};
