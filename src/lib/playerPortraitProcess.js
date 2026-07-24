/**
 * 玩家肖像後製：以人為主放大全身、臉偵測裁頭、去背成四角同款 icon。
 */
import { detectFacesInImage } from './faceDetection.js';

/** 上傳防呆門檻 */
export const PLAYER_PHOTO_GUARD = {
  minSide: 280,
  /** 算「有意義的臉」：信心與面積 */
  significantScore: 0.22,
  significantArea: 0.008,
  /** 主臉夠清楚才能畫 */
  clearScore: 0.32,
  clearArea: 0.018,
  maxBytes: 12 * 1024 * 1024,
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

const isSignificantFace = (f) =>
  (Number(f?.score) || 0) >= PLAYER_PHOTO_GUARD.significantScore &&
  (Number(f?.area) || 0) >= PLAYER_PHOTO_GUARD.significantArea;

const isClearFace = (f) =>
  (Number(f?.score) || 0) >= PLAYER_PHOTO_GUARD.clearScore &&
  (Number(f?.area) || 0) >= PLAYER_PHOTO_GUARD.clearArea;

/**
 * 上傳前防呆：單人、臉夠清楚；多人／模糊／無人則丟出可讀錯誤
 * @param {string} photoDataUrl
 * @returns {Promise<{ faces: object[], bestFace: object, width: number, height: number }>}
 */
export const validatePlayerPhotoUpload = async (photoDataUrl) => {
  if (!photoDataUrl || typeof photoDataUrl !== 'string') {
    throw new Error('請上傳一張有效的個人照片');
  }
  if (!/^data:image\//i.test(photoDataUrl)) {
    throw new Error('檔案格式不支援，請改傳 JPG／PNG／WebP 圖片');
  }

  // dataURL 粗估大小
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
      `圖片解析度太低（短邊需 ≥ ${PLAYER_PHOTO_GUARD.minSide}px），無法精準繪製，請換更清楚的照片`
    );
  }

  let faces = [];
  try {
    faces = await detectFacesInImage(photoDataUrl);
  } catch (err) {
    console.warn('[player] upload face check failed:', err);
    throw new Error(
      '臉部偵測失敗，請確認本機臉辨服務正常，或換一張更清楚的單人照'
    );
  }

  const significant = (faces || []).filter(isSignificantFace);
  const bestFace = pickBestFace(significant.length ? significant : faces);

  if (significant.length >= 2) {
    throw new Error(
      `偵測到 ${significant.length} 張臉：請上傳「只有你一個人」的照片，多人畫面無法精準繪製你的角色`
    );
  }

  if (!bestFace || significant.length === 0) {
    throw new Error(
      '偵測不到清楚的人臉：請換正面、光線足夠、臉夠大的單人照（勿傳風景、截圖、過度模糊或背影）'
    );
  }

  if (!isClearFace(bestFace)) {
    throw new Error(
      '臉部不夠清楚或太小：請靠近一點、正面入鏡，確保臉在畫面中夠大且對焦清楚，否則無法精準繪製'
    );
  }

  // 若模型還噴了其他低分臉，也視為可疑多人
  const weakExtras = (faces || []).filter(
    (f) => f !== bestFace && (Number(f.area) || 0) >= 0.012 && (Number(f.score) || 0) >= 0.15
  );
  if (weakExtras.length >= 1) {
    throw new Error(
      '畫面可能有其他人：請換一張只有你本人、背景單純的照片，多人無法精準繪製'
    );
  }

  return { faces, bestFace, width, height };
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
 * 以臉為錨點，裁出「整身放大、以人為主」的方圖（壓掉過大背景）
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

  let sx;
  let sy;
  let s;
  if (det) {
    const box = faceBoxPx(det, w, h);
    // 頭上方留一點，往下包全身；橫向以人為中心
    const bodyH = Math.min(h, box.h * 5.2);
    const bodyW = Math.min(w, Math.max(box.w * 2.6, bodyH * 0.72));
    s = Math.min(w, h, Math.max(bodyW, bodyH));
    const top = box.y - box.h * 0.35;
    sx = box.cx - s / 2;
    sy = top;
    ({ sx, sy, s } = clampCrop(sx, sy, s, w, h));
  } else {
    // 無臉：取中央偏上、較緊的方塊（略放大主體）
    s = Math.min(w, h) * 0.82;
    sx = (w - s) / 2;
    sy = Math.max(0, (h - s) * 0.12);
    ({ sx, sy, s } = clampCrop(sx, sy, s, w, h));
  }

  const out = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out, out);
  ctx.drawImage(img, sx, sy, s, s, 0, 0, out, out);
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
    // 頭＋肩：臉框放大
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
