import { toJpeg, toPng } from 'html-to-image';
import { getMangaGridCols } from './mangaGridLayout.js';
import { layoutBubbleCss, formatBubbleLines, buildTailGeometry } from './speechBubble.js';
import { attachFacesToStory } from './faceDetection.js';

/** 匯出／列印用共用樣式（兩格並排） */
const EXPORT_MANGA_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    background: #f4f1eb;
    color: #1c1917;
    font-family: "Noto Sans TC", system-ui, sans-serif;
  }
  .wrap { max-width: 820px; margin: 0 auto; }
  img { width: 100%; height: auto; display: block; }
  .manga-strip-vertical { max-width: 820px; margin: 0 auto; }
  .manga-strip-grid {
    display: grid;
    gap: 16px;
    align-items: start;
  }
  .manga-strip-grid.manga-cols-1 { grid-template-columns: 1fr; max-width: 480px; margin: 0 auto; }
  .manga-strip-grid.manga-cols-2 { grid-template-columns: repeat(2, 1fr); }
  .manga-strip-grid.manga-cols-3 { grid-template-columns: repeat(3, 1fr); }
  .manga-strip-grid.manga-cols-4 { grid-template-columns: repeat(4, 1fr); }
  .manga-strip-panel { min-width: 0; }
  .manga-panel-frame {
    border: 2px solid #1c1917;
    background: #fff;
    box-shadow: 4px 4px 0 #1c1917;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .manga-panel-image-wrap {
    position: relative;
    background: #ebe8e0;
    aspect-ratio: 3 / 4;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .manga-panel-image-wrap img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    filter: grayscale(1);
  }
  .speech-balloon {
    border-top: 2px solid #1c1917;
    padding: 12px 14px;
    font-size: 13px;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .speech-bubble-overlay {
    position: absolute;
    z-index: 6;
    pointer-events: none;
    width: fit-content;
    max-width: 58%;
  }
  .speech-bubble-overlay-body {
    position: relative;
    z-index: 1;
    display: flex;
    width: fit-content;
    max-width: 100%;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 6px 10px 8px;
    border: 2.5px solid #1c1917;
    border-radius: 10px;
    background: #fff;
    font-family: "Zen Kaku Gothic New", "Noto Sans TC", system-ui, sans-serif;
    font-weight: 700;
    line-height: 1.28;
    overflow-wrap: break-word;
    word-break: keep-all;
  }
  .speech-bubble-line {
    display: block;
    text-align: center;
    white-space: nowrap;
  }
  .speech-bubble-tails {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
    z-index: 5;
  }
  .bubble-tl { top: 2%; left: 2%; max-width: 46%; }
  .bubble-tr { top: 2%; right: 2%; max-width: 46%; }
  .bubble-tc { top: 2%; left: 24%; right: 24%; max-width: 50%; text-align: center; }
  .manga-meta-header {
    border: 2px solid #1c1917;
    background: rgba(250, 249, 246, 0.95);
    padding: 12px 16px;
    margin-bottom: 16px;
    box-shadow: 3px 3px 0 #1c1917;
  }
  .manga-meta-header h3 {
    margin: 4px 0 0;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.35;
  }
  .manga-meta-header dl {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: #57534e;
  }
  .manga-meta-header dt { font-weight: 600; color: #78716c; }
  .manga-meta-header dd { margin: 0; }
  @media print {
    body { padding: 12px; }
    .manga-strip-panel { break-inside: avoid; page-break-inside: avoid; }
    .manga-panel-frame { box-shadow: none; }
  }
`;

const MOBILE_EXPORT_WIDTH = 390;

const nextFrame = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

/** @param {HTMLElement} rootEl */
export const resolveExportRoot = (rootEl) => {
  if (!rootEl) return null;
  return rootEl.querySelector?.('.manga-strip-vertical') || rootEl;
};

const waitForImages = (root) => {
  const imgs = [...root.querySelectorAll('img')];
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        })
    )
  );
};

const loadImageElement = (src) =>
  new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('圖片網址為空'));
      return;
    }
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('分鏡圖載入失敗'));
    image.src = src;
  });

/**
 * 將超大 base64 圖 rasterize 成較小的 JPEG，避免 html-to-image 在 SVG 內嵌時失敗。
 * @param {string} src
 * @param {number} maxWidth
 */
const rasterizeForExport = async (src, maxWidth = MOBILE_EXPORT_WIDTH * 2) => {
  const image = await loadImageElement(src);
  const naturalW = image.naturalWidth || maxWidth;
  const naturalH = image.naturalHeight || Math.round((maxWidth * 16) / 9);
  const scale = Math.min(1, maxWidth / naturalW);
  const w = Math.max(1, Math.round(naturalW * scale));
  const h = Math.max(1, Math.round(naturalH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法建立畫布');
  ctx.fillStyle = '#f4f1eb';
  ctx.fillRect(0, 0, w, h);
  ctx.filter = 'grayscale(1)';
  // contain：與預覽 object-contain 一致
  const scaleFit = Math.min(w / naturalW, h / naturalH);
  const dw = naturalW * scaleFit;
  const dh = naturalH * scaleFit;
  ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    width: w,
    height: h,
  };
};

/**
 * 內嵌圖片並移除 grayscale（此濾鏡常導致匯出空白）。
 * @param {HTMLElement} root
 * @param {number} panelWidth
 */
const embedImagesForExport = async (root, panelWidth = MOBILE_EXPORT_WIDTH) => {
  const imgs = [...root.querySelectorAll('img')];

  await Promise.all(
    imgs.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src) return;

      try {
        const { dataUrl } = await rasterizeForExport(src, panelWidth * 2);
        img.src = dataUrl;
      } catch {
        // 保留原 src，至少不要讓整次匯出失敗
      }

      img.classList.remove('grayscale');
      img.style.filter = 'none';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.maxWidth = '100%';
      img.style.objectFit = 'contain';
      img.style.objectPosition = 'center';
      img.style.display = 'block';
      img.style.aspectRatio = 'auto';
      img.removeAttribute('crossorigin');
    })
  );
};

const stripExportBlockers = (node) => {
  node.querySelectorAll('img').forEach((img) => {
    img.classList.remove('grayscale');
    img.style.filter = 'none';
  });
};

/**
 * @param {HTMLElement} rootEl
 * @param {{ columns?: 1|2, hideScript?: boolean, panelWidth?: number }} options
 */
const prepareExportClone = (rootEl, options = {}) => {
  const { columns = 2, hideScript = true, panelWidth = MOBILE_EXPORT_WIDTH } = options;
  const clone = rootEl.cloneNode(true);
  clone.querySelectorAll('button').forEach((el) => el.remove());
  if (hideScript) clone.querySelector('footer')?.remove();

  const grid = clone.querySelector('.manga-strip-grid');
  if (grid && columns === 1) {
    grid.classList.remove('grid-cols-2');
    grid.classList.add('grid-cols-1', 'manga-cols-1');
    clone.classList.remove('max-w-2xl', 'max-w-lg', 'max-w-md', 'max-w-sm');
    clone.style.maxWidth = `${panelWidth}px`;
    clone.style.width = `${panelWidth}px`;
  }

  clone.style.display = 'block';
  clone.style.background = '#f4f1eb';
  clone.style.position = 'fixed';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.transform = 'translateX(-200vw)';
  clone.style.opacity = '1';
  clone.style.visibility = 'visible';
  clone.style.pointerEvents = 'none';
  clone.style.zIndex = '2147483646';
  document.body.appendChild(clone);
  stripExportBlockers(clone);
  return clone;
};

const downloadDataUrl = (dataUrl, filename) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
};

const isValidCapture = (dataUrl) =>
  Boolean(dataUrl && dataUrl.length > 1000 && dataUrl !== 'data:,' && !dataUrl.endsWith('data:,'));

const captureNode = async (node) => {
  const baseOpts = {
    backgroundColor: '#f4f1eb',
    cacheBust: false,
    skipFonts: true,
    pixelRatio: 1.5,
  };

  let dataUrl = await toJpeg(node, { ...baseOpts, quality: 0.95 });
  if (isValidCapture(dataUrl)) return dataUrl;

  dataUrl = await toPng(node, baseOpts);
  if (isValidCapture(dataUrl)) return dataUrl;

  throw new Error('圖片產生失敗，分鏡可能尚未載入完成');
};

/**
 * 存成 PNG/JPEG 長圖 — 單欄、無劇本全文。
 * @param {HTMLElement} rootEl
 * @param {{ filename?: string, mobile?: boolean }} [options]
 */
export const exportMangaPng = async (rootEl, options = {}) => {
  const target = resolveExportRoot(rootEl);
  if (!target) throw new Error('找不到漫畫預覽區');

  const { filename = 'bubbleweave-manga.jpg', mobile = true } = options;
  const panelWidth = mobile ? MOBILE_EXPORT_WIDTH : 410;

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  await waitForImages(target);

  const clone = prepareExportClone(target, {
    columns: mobile ? 1 : 2,
    hideScript: true,
    panelWidth,
  });

  try {
    await embedImagesForExport(clone, panelWidth);
    await waitForImages(clone);
    await nextFrame();

    const dataUrl = await captureNode(clone);
    downloadDataUrl(dataUrl, filename);
  } finally {
    clone.remove();
  }
};

/**
 * 由故事資料直接產出可下載 HTML（不依賴畫面上的預覽 DOM）。
 * @param {{ cards: object[], panelLines?: string[], dialogues?: string[], meta?: object, filename?: string }} options
 */
export const exportStoryAsHtml = async ({
  cards = [],
  panelLines = null,
  dialogues = null,
  panelBubbles = [],
  meta = null,
  filename = 'bubbleweave-manga.html',
}) => {
  if (!cards.length) throw new Error('沒有可匯出的分鏡');

  // 確保氣泡有人臉錨點（後備路徑）
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

  const lines =
    panelLines ||
    dialogues ||
    cards.map(() => '');

  const escape = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const metaHtml = meta
    ? `<header class="manga-meta-header">
        <p style="margin:0;font-size:11px;letter-spacing:0.12em;color:#78716c;">${escape(meta.brand || 'BubbleWeave 織泡劇場')}</p>
        <h3>${escape(meta.title || '故事串')}</h3>
        <dl>
          <div><dt>作者</dt><dd>${escape(meta.author || '我')}</dd></div>
          <div><dt>主題</dt><dd>${escape(meta.theme || '')}</dd></div>
          <div><dt>登場</dt><dd>${escape(meta.cast || '')}</dd></div>
          <div><dt>格數</dt><dd>${escape(String(meta.panelCount || cards.length))}</dd></div>
        </dl>
      </header>`
    : '';

  const cols = getMangaGridCols(cards.length);
  const gridClass = `manga-strip-grid manga-cols-${cols}`;

  const bubbleHtml = (bubbles) => {
    const list = bubbles || [];
    const bodies = list
      .map((b, i) => {
        const pos = layoutBubbleCss(b, i, list.length);
        const lines = formatBubbleLines(b.text, b.text?.length > 14 ? 9 : 11);
        const style = [
          `top:${pos.top}`,
          `left:${pos.left}`,
          `right:${pos.right}`,
          pos.bottom ? `bottom:${pos.bottom}` : '',
          `max-width:${pos.maxWidth}`,
          pos.transform ? `transform:${pos.transform}` : '',
          `font-size:${pos.fontPx || 12}px`,
        ]
          .filter(Boolean)
          .join(';');
        const lineHtml = lines
          .map((line) => `<span class="speech-bubble-line">${escape(line)}</span>`)
          .join('');
        return `<div class="speech-bubble-overlay absolute" style="${style}"><div class="speech-bubble-overlay-body">${lineHtml}</div></div>`;
      })
      .join('');

    // HTML 匯出無法量測 DOM：用百分比近似尾巴（本體角落 → face）
    const tailPaths = list
      .map((b, i) => {
        const pos = layoutBubbleCss(b, i, list.length);
        const face = pos.face || b.face;
        if (!face) return '';
        const onRight = pos.left === 'auto';
        const rootX = onRight ? 82 : 18;
        const rootY = pos.placeBelow ? Math.min(75, face.y * 100 + 10) : 8;
        const geo = buildTailGeometry(
          rootX,
          rootY,
          face.x * 100,
          face.y * 100,
          2.2
        );
        return `<path d="${geo.fillD}" fill="#fff"/><path d="${geo.strokeD}" fill="none" stroke="#1c1917" stroke-width="0.7" stroke-linejoin="round" stroke-linecap="round"/>`;
      })
      .join('');

    const svg = tailPaths
      ? `<svg class="speech-bubble-tails" viewBox="0 0 100 100" preserveAspectRatio="none">${tailPaths}</svg>`
      : '';
    return `${svg}${bodies}`;
  };

  const panels = cards.map((card, i) => {
    const line = (lines[i] || '').trim();
    const bubbles = finalPanelBubbles[i] || [];
    const img = card.imageUrl
      ? `<img src="${escape(card.imageUrl)}" alt="第 ${i + 1} 格" />`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#a8a29e;font-size:12px;">無分鏡圖</div>`;
    const pagePos = bubbles.length ? 'left:8px;bottom:8px;top:auto;' : 'left:8px;top:8px;';
    return `<section class="manga-strip-panel">
        <div class="manga-panel-frame">
          <div class="manga-panel-image-wrap">${img}
            ${bubbleHtml(bubbles)}
            <span style="position:absolute;${pagePos}border:2px solid #1c1917;background:#fff;padding:2px 6px;font-size:11px;font-weight:700;">${String(i + 1).padStart(2, '0')}</span>
            ${card.rarity?.label ? `<span style="position:absolute;right:8px;top:8px;border:2px solid #1c1917;background:#fff;padding:2px 6px;font-size:10px;font-weight:800;">${escape(card.rarity.label)}</span>` : ''}
          </div>
          ${bubbles.length ? '' : `<div class="speech-balloon">${escape(line || '（此格無台詞）')}</div>`}
        </div>
      </section>`;
  }).join('\n');


  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escape(meta?.title || 'BubbleWeave 漫畫')}</title>
  <style>${EXPORT_MANGA_CSS}</style>
</head>
<body>
  <div class="wrap">
    ${metaHtml}
    <div class="manga-strip-vertical">
      <div class="${gridClass}">${panels}</div>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * 產出圖片：Canvas 路徑（可靠；與預覽共用 paintBubblesOnImage）
 * 保留此 re-export 給舊呼叫；實作在 exportMangaCanvas.js
 */
export { exportMangaStripImage } from './exportMangaCanvas.js';

/**
 * @param {HTMLElement} rootEl
 */
export const printMangaStrip = async (rootEl) => {
  const target = resolveExportRoot(rootEl);
  if (!target) return;

  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) return;

  await waitForImages(target);

  const clone = prepareExportClone(target, { columns: 2, hideScript: true });
  try {
    await embedImagesForExport(clone, MOBILE_EXPORT_WIDTH);
    const inner = clone.innerHTML;
    clone.remove();

    printWindow.document.write(`<!DOCTYPE html>
<html lang="zh-Hant"><head>
<meta charset="utf-8" />
<title>列印漫畫</title>
<style>${EXPORT_MANGA_CSS}
  @media print { body { padding: 12px; } }
</style>
</head><body><div class="wrap">${inner}</div>
<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body></html>`);
    printWindow.document.close();
  } finally {
    if (clone.parentNode) clone.remove();
  }
};
