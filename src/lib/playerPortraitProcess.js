/**
 * 玩家肖像後製：以人為主放大全身、臉偵測裁頭、去背成四角同款 icon。
 *
 * 上傳臉偵測：本機 YOLO 動漫臉（/__bw/detect-faces）。
 * 真人自拍信心通常低於動漫卡，故 photo 模式用較寬門檻（對齊 v1 可用體驗）。
 */
import { detectFacesInImage } from './faceDetection.js';

/** 上傳防呆門檻（場景卡／嚴格） */
export const PLAYER_PHOTO_GUARD = {
  minSide: 280,
  significantScore: 0.22,
  significantArea: 0.008,
  clearScore: 0.32,
  clearArea: 0.018,
  maxBytes: 12 * 1024 * 1024,
};

/** 真人自拍：只要偵測到單一人臉即可（不強制臉夠大／全身） */
export const PLAYER_SELFIE_GUARD = {
  significantScore: 0.08,
  significantArea: 0.002,
  multiScore: 0.28,
  multiArea: 0.01,
};

const loadHtmlImage = (src) =>
  new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('無圖'));
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('圖片載入失敗'));
    img.src = src;
  });

const pickBestFace = (detections = []) => {
  if (!detections?.length) return null;
  return [...detections].sort(
    (a, b) =>
      (Number(b.score) || 0) - (Number(a.score) || 0) ||
      (Number(b.area) || 0) - (Number(a.area) || 0)
  )[0];
};

/**
 * @param {object[]} faces
 * @param {{ mode?: 'photo' | 'strict' }} [opts]
 */
export const assertSingleClearFace = (faces = [], opts = {}) => {
  const photo = opts.mode === 'photo';
  const g = photo ? PLAYER_SELFIE_GUARD : PLAYER_PHOTO_GUARD;

  const isSignificant = (f) =>
    (Number(f?.score) || 0) >= g.significantScore &&
    (Number(f?.area) || 0) >= g.significantArea;
  const isClear = (f) =>
    !photo &&
    (Number(f?.score) || 0) >= g.clearScore &&
    (Number(f?.area) || 0) >= g.clearArea;

  const significant = (faces || []).filter(isSignificant);
  const bestFace = pickBestFace(significant.length ? significant : faces);

  if (significant.length >= 2) {
    throw new Error(
      `偵測到 ${significant.length} 張臉：這是合照吧？請只放你一個人進來`
    );
  }

  // 多人：兩張都夠大才擋（避免實拍雜訊誤殺）
  const multiFloor = photo
    ? { score: g.multiScore, area: g.multiArea }
    : { score: 0.45, area: 0.002 };
  const likelyPeople = (faces || []).filter(
    (f) =>
      (Number(f?.score) || 0) >= multiFloor.score &&
      (Number(f?.area) || 0) >= multiFloor.area
  );
  if (likelyPeople.length >= 2) {
    throw new Error(
      `偵測到約 ${likelyPeople.length} 張臉：團體照我們畫不動，請改單人照`
    );
  }

  if (!bestFace || significant.length === 0) {
    throw new Error(
      photo
        ? '找不到人臉：風景很美，但角色需要一張臉（建議全身，不強制）'
        : '偵測不到清楚的人臉：請換正面、光線足夠、臉夠大的單人照'
    );
  }

  // 嚴格模式才要求臉夠清楚／夠大；自拍只要單一人臉
  if (!photo && !isClear(bestFace)) {
    throw new Error(
      '臉部不夠清楚或太小：請靠近一點、正面入鏡，確保臉在畫面中夠大且對焦清楚'
    );
  }

  if (!photo) {
    const weakExtras = (faces || []).filter(
      (f) =>
        f !== bestFace &&
        (Number(f.area) || 0) >= 0.012 &&
        (Number(f.score) || 0) >= 0.15
    );
    if (weakExtras.length >= 1) {
      throw new Error(
        `畫面疑似還有其他人（約 ${weakExtras.length + 1} 人）：請換只有你本人的照片`
      );
    }
  }

  return { bestFace, significant };
};

/**
 * 上傳前防呆（真人自拍）
 */
export const validatePlayerPhotoUpload = async (photoDataUrl) => {
  if (!photoDataUrl || typeof photoDataUrl !== 'string') {
    throw new Error('請上傳一張有效的個人照片');
  }
  if (!/^data:image\//i.test(photoDataUrl)) {
    throw new Error('檔案格式不支援，請改傳 JPG／PNG／WebP 圖片');
  }

  const b64 = photoDataUrl.split(',')[1] || '';
  const approxBytes = Math.floor((b64.length * 3) / 4);
  if (approxBytes > PLAYER_PHOTO_GUARD.maxBytes) {
    throw new Error('圖片太大（請壓縮到約 12MB 以內再傳）');
  }

  let img;
  try {
    img = await loadHtmlImage(photoDataUrl);
  } catch {
    throw new Error('無法讀取這張圖片，請換一張再試');
  }

  const width = img.naturalWidth || img.width || 0;
  const height = img.naturalHeight || img.height || 0;
  if (Math.min(width, height) < PLAYER_PHOTO_GUARD.minSide) {
    throw new Error(
      `圖片解析度太低（短邊需 ≥ ${PLAYER_PHOTO_GUARD.minSide}px），請換更清楚的照片`
    );
  }

  let faces = [];
  try {
    faces = await detectFacesInImage(photoDataUrl);
  } catch (err) {
    console.warn('[player] upload face check failed:', err);
    throw new Error(
      '臉部偵測服務未就緒（本機 YOLO）。請確認已執行 npm run dev，且模型已安裝（setup:animeface）'
    );
  }

  const { bestFace } = assertSingleClearFace(faces, { mode: 'photo' });

  return { faces, bestFace, width, height };
};

/**
 * 上傳前壓縮／轉 JPEG，並擋 HEIC
 */
export const preparePlayerPhotoFile = async (input) => {
  if (input && typeof input === 'object' && 'name' in input) {
    const file = /** @type {File} */ (input);
    const name = String(file.name || '').toLowerCase();
    const type = String(file.type || '').toLowerCase();
    if (
      type.includes('heic') ||
      type.includes('heif') ||
      name.endsWith('.heic') ||
      name.endsWith('.heif')
    ) {
      throw new Error(
        '此格式（HEIC／HEIF）瀏覽器常無法讀取：請先轉成 JPG／PNG 再傳'
      );
    }
    if (type && !type.startsWith('image/')) {
      throw new Error('請上傳圖片檔（JPG／PNG／WebP）');
    }
    if (!type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|bmp)$/i.test(name)) {
      throw new Error('檔名不像圖片：請改傳 JPG／PNG／WebP');
    }
    if (file.size > PLAYER_PHOTO_GUARD.maxBytes) {
      throw new Error('圖片太大（請壓縮到約 12MB 以內再傳）');
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('無法讀取檔案'));
      reader.readAsDataURL(file);
    });
    return downscalePhotoDataUrl(dataUrl);
  }
  return downscalePhotoDataUrl(String(input || ''));
};

export const downscalePhotoDataUrl = async (dataUrl, maxSide = 1600) => {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('請上傳一張有效的個人照片');
  }
  if (/^data:image\/(heic|heif)/i.test(dataUrl)) {
    throw new Error('此格式（HEIC）無法在瀏覽器處理，請先轉成 JPG');
  }
  const img = await loadHtmlImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('無法讀取圖片尺寸');
  const scale = Math.min(1, maxSide / Math.max(w, h));
  if (scale >= 0.98 && /^data:image\/jpeg/i.test(dataUrl)) return dataUrl;
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, cw, ch);
  return canvas.toDataURL('image/jpeg', 0.9);
};

/** 由正規化 face{x,y,area} 估像素臉框 */
const faceBoxPx = (face, imgW, imgH) => {
  const area = Math.max(0.004, Number(face.area) || 0.04);
  const side = Math.sqrt(area * imgW * imgH);
  const fw = side * 1.15;
  const fh = side * 1.35;
  const cx = Number(face.x) * imgW;
  const cy = Number(face.y) * imgH;
  return {
    x: cx - fw / 2,
    y: cy - fh * 0.42,
    w: fw,
    h: fh,
    cx,
    cy,
  };
};

const clampCrop = (x, y, side, imgW, imgH) => {
  let s = Math.min(side, imgW, imgH);
  let sx = x;
  let sy = y;
  if (sx < 0) sx = 0;
  if (sy < 0) sy = 0;
  if (sx + s > imgW) sx = imgW - s;
  if (sy + s > imgH) sy = imgH - s;
  return { sx: Math.max(0, sx), sy: Math.max(0, sy), s: Math.max(1, s) };
};

const canvasToJpeg = (canvas, quality = 0.92) =>
  canvas.toDataURL('image/jpeg', quality);

/**
 * 以臉為錨點，裁出直式 3:4「全身放大入框」
 * 若原圖人物很小：依臉高估全身高度再 zoom-in，避免沿用遠景構圖
 */
export const reframingPersonPortrait = async (portraitDataUrl, face = null) => {
  const img = await loadHtmlImage(portraitDataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return portraitDataUrl;

  let det = face;
  if (!det) {
    try {
      const faces = await detectFacesInImage(portraitDataUrl);
      det = pickBestFace(faces);
    } catch {
      det = null;
    }
  }

  const outW = 1080;
  const outH = 1440; // 3:4
  const targetAspect = outW / outH; // 0.75

  let cropW;
  let cropH;
  let sx;
  let sy;

  if (det) {
    const box = faceBoxPx(det, w, h);
    // 臉約佔全身高度 1/7～1/8；略放大讓人物填滿 3:4
    const estimatedBodyH = box.h * 7.5;
    cropH = Math.min(h, Math.max(estimatedBodyH, Math.min(h * 0.92, box.h * 9)));
    // 人物太小時（臉佔畫面 <12%）強制更緊的全身框
    if (box.h / h < 0.12) {
      cropH = Math.min(h, Math.max(box.h * 8.2, h * 0.55));
    }
    cropW = cropH * targetAspect;
    if (cropW > w) {
      cropW = w;
      cropH = cropW / targetAspect;
    }
    // 頭頂留一點空間，臉約在框高 10～14%
    sx = box.cx - cropW / 2;
    sy = box.y - cropH * 0.12;
  } else {
    // 無臉偵測：取畫面中偏上主體，略裁邊放大
    cropH = h * 0.88;
    cropW = cropH * targetAspect;
    if (cropW > w) {
      cropW = w * 0.92;
      cropH = cropW / targetAspect;
    }
    sx = (w - cropW) / 2;
    sy = Math.max(0, (h - cropH) * 0.06);
  }

  sx = Math.max(0, Math.min(sx, w - cropW));
  sy = Math.max(0, Math.min(sy, h - cropH));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f1eb';
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH);
  return canvasToJpeg(canvas, 0.92);
};

/**
 * 臉部偵測 → 裁臉區（給去背 icon 生圖當參考）
 */
export const cropDetectedFaceRegion = async (imageDataUrl) => {
  const img = await loadHtmlImage(imageDataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  let faces = [];
  try {
    faces = await detectFacesInImage(imageDataUrl);
  } catch (err) {
    console.warn('[player] face detect for icon failed:', err);
  }
  const det = pickBestFace(faces);

  let sx;
  let sy;
  let s;
  if (det) {
    const box = faceBoxPx(det, w, h);
    s = Math.min(w, h, Math.max(box.w, box.h) * 2.35);
    sx = box.cx - s / 2;
    sy = box.y - s * 0.12;
    ({ sx, sy, s } = clampCrop(sx, sy, s, w, h));
  } else {
    s = Math.min(w, h) * 0.45;
    sx = (w - s) / 2;
    sy = Math.max(0, h * 0.06);
    ({ sx, sy, s } = clampCrop(sx, sy, s, w, h));
  }

  const out = 768;
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out, out);
  ctx.drawImage(img, sx, sy, s, s, 0, 0, out, out);
  return {
    cropDataUrl: canvasToJpeg(canvas, 0.92),
    face: det,
  };
};

export { pickBestFace, loadHtmlImage };
