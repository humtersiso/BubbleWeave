import { GoogleGenAI, Modality, createPartFromBase64 } from '@google/genai';
import { CHARACTERS_BY_ID } from './casts.js';
import {
  buildRefHint,
  buildFinalIdentityCap,
  buildAntiSwapBlock,
} from './characterIdentity.js';

/** 階段一 + 階段二皆使用 Nano Banana 2 Lite */
export const IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
export const CANONICAL_IMAGE_MODEL = IMAGE_MODEL;
export const STORY_IMAGE_MODEL = IMAGE_MODEL;
export const TEXT_MODEL = 'gemini-3.1-flash-lite';

const getApiKey = () => import.meta.env.VITE_GEMINI_API_KEY || '';

const getClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('缺少 VITE_GEMINI_API_KEY，請在 .env 設定 Gemini API 金鑰。');
  }
  return new GoogleGenAI({ apiKey });
};

const STYLE_LOCK =
  '[GLOBAL STYLE - GHIBLI INK LINEART] Classic Studio Ghibli keyframe animation style, ' +
  'Miyazaki-inspired character design, hand-drawn Japanese anime line art, ' +
  'expressive animation frame layout, clean dark ink outlines, crisp high contrast, ' +
  'zero faint pencil smudges, crisp white background, no text, no speech bubbles, black-and-white only. ' +
  'Dark skin must use medium-dark gray fills on face/arms (never blank white-paper face for Black characters). ' +
  'ONLY human characters.';

/**
 * @param {string} dataUrl
 * @returns {{ mimeType: string, data: string } | null}
 */
const parseDataUrl = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
};

/**
 * @param {string[]} labels
 * @param {string[]} [characterIds]
 * @param {object[]} [extraCharacters] 如玩家第 5 角
 */
const resolveCast = (labels = [], characterIds = [], extraCharacters = []) => {
  const byId = { ...CHARACTERS_BY_ID };
  (extraCharacters || []).forEach((c) => {
    if (c?.id) byId[c.id] = c;
  });
  if (characterIds.length) {
    return characterIds.map((id) => byId[id]).filter(Boolean);
  }
  return labels
    .map((name) => Object.values(byId).find((c) => c.name === name))
    .filter(Boolean);
};

/**
 * @param {string} sceneOrPrompt
 * @param {{ aspectRatio?: string, hasReferences?: boolean, referenceLabels?: string[], cast?: object[] }} [options]
 */
const buildImagePrompt = (sceneOrPrompt, options = {}) => {
  const aspect = options.aspectRatio || '3:4';
  const formatHint =
    aspect === '1:1'
      ? 'Output a square 1:1 image.'
      : aspect === '3:4'
        ? 'Output a vertical 3:4 image (approx 1080×1440). Never landscape, never ultra-tall 9:16.'
        : aspect === '9:16'
          ? 'Output a tall vertical 9:16 portrait. Never landscape.'
          : `Output aspect ratio ${aspect}.`;

  const cast = options.cast || [];
  const refSummary = (options.referenceLabels || [])
    .map((name, i) => `Ref${i + 1}=${name}`)
    .join(', ');

  const refHint = options.hasReferences
    ? [
        `Canonical portraits attached in order: ${refSummary}.`,
        'Match face from the matching reference; TEXT locks for hair/glasses/outfit/skin override wrong references.',
        'Change ONLY scene, pose, action, expression. Do not blend traits across people.',
      ].join(' ')
    : '';

  // 舊季包 prompt 常寫死 9:16 → 依本次 aspect 覆寫
  const subject = String(sceneOrPrompt || '')
    .replace(/\b9\s*:\s*16\b/gi, aspect)
    .replace(/ultra-tall|tall vertical/gi, aspect === '3:4' ? 'vertical' : 'tall vertical');

  return [
    STYLE_LOCK,
    formatHint,
    refHint,
    cast.length ? buildAntiSwapBlock(cast) : '',
    'CLEAN: no panel border, grid, logos, text, speech bubbles, watermarks.',
    'Subject:',
    subject,
  ]
    .filter(Boolean)
    .join('\n');
};

const extractImageDataUrl = (response) => {
  const parts =
    response?.candidates?.[0]?.content?.parts ||
    response?.response?.candidates?.[0]?.content?.parts ||
    [];

  for (const part of parts) {
    if (part?.thought) continue;
    const inline = part?.inlineData || part?.inline_data;
    if (inline?.data) {
      const mime = inline.mimeType || inline.mime_type || 'image/png';
      return `data:${mime};base64,${inline.data}`;
    }
  }

  if (typeof response?.data === 'string' && response.data.length > 64) {
    return `data:image/png;base64,${response.data}`;
  }

  const inlineParts =
    typeof response?.inlineDataParts === 'function'
      ? response.inlineDataParts()
      : response?.inlineDataParts;
  if (Array.isArray(inlineParts) && inlineParts[0]?.inlineData?.data) {
    const inline = inlineParts[0].inlineData;
    return `data:${inline.mimeType || 'image/png'};base64,${inline.data}`;
  }

  return null;
};

const describeImageFailure = (response) => {
  const candidate = response?.candidates?.[0];
  const finish = candidate?.finishReason || candidate?.finish_reason || '';
  const block =
    response?.promptFeedback?.blockReason || response?.promptFeedback?.block_reason || '';
  const texts = (candidate?.content?.parts || [])
    .map((p) => p?.text)
    .filter(Boolean)
    .join(' ')
    .slice(0, 240);
  const bits = [
    finish && `finishReason=${finish}`,
    block && `blockReason=${block}`,
    texts && `modelText=${texts}`,
  ].filter(Boolean);
  return bits.length ? bits.join('；') : '回傳 parts 無 inlineData';
};

/**
 * @param {string} prompt
 * @param {{
 *   aspectRatio?: string,
 *   referenceImages?: string[],
 *   referenceLabels?: string[],
 *   characterIds?: string[],
 *   extraCharacters?: object[],
 *   model?: string,
 * }} [options]
 */
const generateImageWithContent = async (prompt, options = {}) => {
  const aspectRatio = options.aspectRatio || '3:4';
  const model = options.model || IMAGE_MODEL;
  const referenceImages = (options.referenceImages || []).map(parseDataUrl).filter(Boolean);
  const referenceLabels = options.referenceLabels || [];
  const cast = resolveCast(
    referenceLabels,
    options.characterIds || [],
    options.extraCharacters || []
  );
  const textPrompt = buildImagePrompt(prompt, {
    aspectRatio,
    hasReferences: referenceImages.length > 0,
    referenceLabels,
    cast,
  });

  const parts = [];
  if (referenceImages.length > 0) {
    parts.push({
      text:
        'Canonical portrait references follow (one per named character). ' +
        'Use each for FACE identity. If hair/glasses/outfit/skin disagree with TEXT LOCKS, obey TEXT LOCKS.',
    });

    referenceImages.forEach((img, i) => {
      const name = referenceLabels[i] || `Character ${i + 1}`;
      const ch =
        cast[i] ||
        Object.values(CHARACTERS_BY_ID).find((c) => c.name === name) ||
        null;
      parts.push({
        text: `REFERENCE ${i + 1} — ${name}: ${buildRefHint(ch)}${
          ch?.identityHardLock ? ` | ${ch.identityHardLock}` : ''
        }`,
      });
      parts.push(createPartFromBase64(img.data, img.mimeType || 'image/jpeg'));
    });

    parts.push({
      text: [
        `Generate the scene with locked identities:\n${textPrompt}`,
        '',
        buildFinalIdentityCap(cast),
      ]
        .filter(Boolean)
        .join('\n'),
    });
  } else {
    parts.push({
      text: [textPrompt, '', buildFinalIdentityCap(cast)].filter(Boolean).join('\n'),
    });
  }

  const ai = getClient();
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
      imageConfig: {
        aspectRatio,
        imageSize: '1K',
      },
    },
  });

  const dataUrl = extractImageDataUrl(response);
  if (dataUrl) return dataUrl;

  throw new Error(`模型回傳中找不到圖像資料（${describeImageFailure(response)}）`);
};

/**
 * 階段一：canonical 角色圖（白底正臉/半身）→ 存入 IndexedDB portraits
 * @param {string} portraitPrompt
 * @param {string} [characterId]
 * @returns {Promise<string>} data URL
 */
export const generateCanonicalCharacterImage = async (portraitPrompt, characterId) =>
  generateImageWithContent(portraitPrompt, {
    aspectRatio: '1:1',
    model: CANONICAL_IMAGE_MODEL,
    characterIds: characterId ? [characterId] : [],
  });

/**
 * @param {string} scenePrompt
 * @param {{
 *   aspectRatio?: string,
 *   referenceImages?: string[],
 *   referenceLabels?: string[],
 *   characterIds?: string[],
 * }} [options]
 */
export const generateStorySceneCard = async (scenePrompt, options = {}) =>
  generateImageWithContent(scenePrompt, {
    aspectRatio: options.aspectRatio || '3:4',
    referenceImages: options.referenceImages || [],
    referenceLabels: options.referenceLabels || [],
    characterIds: options.characterIds || [],
    extraCharacters: options.extraCharacters || [],
    model: STORY_IMAGE_MODEL,
  });

/**
 * 上傳真人照 → 以「整身人物為主」轉繪（背景可保留但人物放大填滿）
 */
export const generatePlayerPortraitFromPhoto = async (photoDataUrl, opts = {}) => {
  const name = String(opts.displayName || 'Me').trim() || 'Me';
  if (!photoDataUrl) throw new Error('請先上傳個人照片');

  const prompt = [
    `IMAGE-TO-IMAGE of the attached photo of "${name}".`,
    'SUBJECT FIRST: Enlarge the FULL PERSON (head to feet if visible) so they dominate the frame — about 75-90% of the image height.',
    'Crop away excess empty background / distant surroundings; keep only a little scene context around the body.',
    'Preserve the SAME person likeness, pose, clothes, and glasses; stylize remaining background as Ghibli ink (not blank white unless the photo was already plain).',
    'Do NOT output a tiny figure in a huge background. Do NOT head-only crop.',
    'STYLE: Classic Studio Ghibli keyframe black-and-white ink, clean dark outlines, high contrast, no color.',
    'OUTPUT: square 1:1. NO text, NO speech bubbles, NO circular frame, NO photorealism.',
  ].join('\n');

  return generateImageWithContent(prompt, {
    aspectRatio: '1:1',
    model: CANONICAL_IMAGE_MODEL,
    referenceImages: [photoDataUrl],
    referenceLabels: [name],
    characterIds: [],
  });
};

/**
 * 臉部裁切圖 → 四角同款：白底頭肩 canonical icon（去背）
 */
export const generatePlayerFaceIconOnWhite = async (faceCropDataUrl, opts = {}) => {
  const name = String(opts.displayName || 'Me').trim() || 'Me';
  if (!faceCropDataUrl) throw new Error('缺少臉部裁切圖');

  const prompt = [
    `Create a CANONICAL character ICON of "${name}" from the attached face crop.`,
    'Head-and-shoulders FILL the frame edge-to-edge (tight crop). Face centered, full hairstyle visible, eyes slightly above middle.',
    'PURE FLAT WHITE BACKGROUND only — remove ALL scene/background from the photo (studio white like other BubbleWeave character icons).',
    'EXACT same person face as the reference. Ghibli black-and-white ink line art only.',
    'NO photorealism, NO color, NO text, NO speech bubbles, NO circular frame baked into the image.',
    'The UI applies a circular CSS crop — bitmap must be a plain square portrait with white corners.',
  ].join('\n');

  return generateImageWithContent(prompt, {
    aspectRatio: '1:1',
    model: CANONICAL_IMAGE_MODEL,
    referenceImages: [faceCropDataUrl],
    referenceLabels: [name],
    characterIds: [],
  });
};

export {
  generateStoryText,
  generateDialogues,
  STORY_STYLES,
  DEFAULT_STORY_STYLE_ID,
  cardRecipeGrounded,
  shouldUseVisionAnalysis,
} from './storyGeneration.js';

export const hasApiKey = () => Boolean(getApiKey());
