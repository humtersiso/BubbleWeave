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
  '[GLOBAL STYLE - GHIBLI INK + SELECTIVE COLOR] Classic Studio Ghibli keyframe animation style, ' +
  'Miyazaki-inspired character design, hand-drawn Japanese anime line art, ' +
  'expressive animation frame layout, clean dark ink outlines, crisp high contrast, ' +
  'zero faint pencil smudges, crisp white / paper background, no text, no speech bubbles. ' +
  'BASE = grayscale black-and-white ink. REQUIRED selective/partial color only: warm vermilion-orange ' +
  'accents matching #c45c26 (burnt orange) on key props, clothing highlights, lights, or atmosphere — ' +
  'most of the image stays B&W. NOT full-color. NOT rainbow. ' +
  'Dark skin must use medium-dark gray fills on face/arms (never blank white-paper face for Black characters). ' +
  'ONLY human characters.';

/** 抽籤底圖：純墨線黑白，不上任何顏色（顏色交給第二段 color pass） */
const INK_ONLY_STYLE_LOCK =
  '[GLOBAL STYLE - GHIBLI INK ONLY] Classic Studio Ghibli keyframe, hand-drawn Japanese anime line art, ' +
  'clean dark ink outlines, high contrast, crisp white / paper background, no text, no speech bubbles. ' +
  'STRICT grayscale black-and-white ink ONLY. ZERO color. No orange, no neon, no fills in color. ' +
  'Dark skin = medium-dark gray fills (never blank white-paper face). ONLY human characters.';

/** 玩家自拍轉繪專用：禁止被 Bob／黑人膚色規則汙染；允許橘系部分上色 */
const PLAYER_STYLE_LOCK =
  '[PLAYER STYLE - GHIBLI INK + SELECTIVE COLOR] Classic Studio Ghibli keyframe, hand-drawn Japanese anime line art, ' +
  'clean dark ink outlines, high contrast, no text, no speech bubbles. ' +
  'BASE grayscale ink. Allow selective warm orange (#c45c26) accents on clothes/props only — face/skin stay gray tones. ' +
  'SKIN: light-to-mid gray matching the photo. NEVER solid black/charcoal face. ' +
  'NEVER African-American / Bob dark skin unless the photo clearly shows that. ' +
  'Facial features must be clearly readable. ONLY the same person as the reference photo.';

/** 咒術迴戰 ED1《LOST IN PARADISE》風格上色專用：強烈色溢、故意錯位、塗鴉感 */
const JJKE_ED1_COLOR_LOCK =
  '[STYLE - JUJUTSU KAISEN ED1 COLORING] Yuki Igarashi / Lost in Paradise. ' +
  'FATAL IF COLORS STAY INSIDE LINES. Color slabs MUST be offset 10-25px from ink (registration error look). ' +
  'Aggressive bleed past outlines. Chunky messy marker / silkscreen blocks. Graffiti vibe. ' +
  'Keep original dark ink lineart crisp and visible over the misaligned colors. ' +
  'KEY COLORS: neon yellow, vivid magenta, bright cyan, brand orange (#c45c26). ' +
  'Face and pose stay recognizable. Not clean cel-shading. Not colors-inside-lines.';

/** 剛剛已主題色局部上色風格：黑白基調，僅針對關鍵物件上色（burnt orange #c45c26） */
const SELECTIVE_COLOR_LOCK =
  '[STYLE - SELECTIVE COLOR] Studio Ghibli ink line art animation style. ' +
  'BASE = grayscale black-and-white. CRISP ink outlines. ' +
  'PARTIAL COLOR ONLY: Apply warm vermilion-orange (#c45c26) to character clothes, ' +
  'important props, or background atmosphere elements. 80% of the image remains grayscale. ' +
  'No full color, no rainbow. Clean and minimal pop vibe.';

const CHIIKAWA_COLOR_LOCK =
  '[STYLE - CHIIKAWA WATERCOLOR] Healing picture-book watercolor vibe inspired by Chiikawa. ' +
  'Turn black ink lines into warm deep-brown lines, with creamy beige paper background. ' +
  'Add soft round blush on cheeks and gentle pastel watercolor bleeds. ' +
  'Keep composition and face likeness identical to reference lineart. ' +
  'No harsh neon, no heavy shadows, no photorealism.';

const RISO_COLOR_LOCK =
  '[STYLE - RISOGRAPH DUO TONE] Risograph print aesthetics with ink grain and misregistration. ' +
  'Only use fluorescent magenta and bright cyan as main inks, optionally tiny black support. ' +
  'Allow visible 3-5px print offset between layers. ' +
  'Keep original lineart readable and preserve subject likeness.';

const COMICS_COLOR_LOCK =
  '[STYLE - RETRO NEWSPAPER COMICS] Vintage newspaper comics frame. ' +
  'Muted CMYK-like colors, off-white paper tone, subtle halftone dots and print noise. ' +
  'Keep clean contour lines and nostalgic daily-strip feeling. ' +
  'Do not add modern glossy rendering or photoreal textures.';

const NEON_COLOR_LOCK =
  '[STYLE - CYBER NEON] Night cyberpunk neon grading with glowing cyan/magenta lights. ' +
  'Deep dark background, high-contrast luminous edges, slight chromatic aberration. ' +
  'Keep lineart and face identity crisp; avoid muddy colors.';

const SUMIE_COLOR_LOCK =
  '[STYLE - SUMI-E + VERMILION] Japanese sumi-e ink wash on washi paper. ' +
  'Dominant monochrome ink values with restrained vermilion accents and subtle gold dust. ' +
  'Brush textures should feel organic; composition and face likeness must stay unchanged.';

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
 * @param {{ aspectRatio?: string, hasReferences?: boolean, referenceLabels?: string[], cast?: object[], styleLock?: string }} [options]
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

  const subject = String(sceneOrPrompt || '')
    .replace(/\b9\s*:\s*16\b/gi, aspect)
    .replace(/ultra-tall|tall vertical/gi, aspect === '3:4' ? 'vertical' : 'tall vertical');

  return [
    options.styleLock || STYLE_LOCK,
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
 *   styleLock?: string,
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
    styleLock: options.styleLock,
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
 *   extraCharacters?: object[],
 *   styleLock?: string,
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
    styleLock: options.styleLock,
  });

/** 抽籤第一段：純墨線底圖用 */
export const getInkOnlyStyleLock = () => INK_ONLY_STYLE_LOCK;

/**
 * 第二段 I2I 上色：將墨線場景轉為咒術 ED1 時尚上色風
 */
export const applyEd1ColorPass = async (sceneDataUrl, options = {}) => {
  const prompt =
    'COLORIZE this black-and-white ink drawing in Yuki Igarashi / Jujutsu Kaisen ED1 "Lost in Paradise" style. ' +
    'CRITICAL: Do NOT stay inside the lines. Color blocks must be MISALIGNED — shifted left/right/up by 10–25px. ' +
    'Colors must BLEED and OVERSHOOT ink outlines like sloppy marker / silkscreen registration error. ' +
    'Chunky flat color slabs, graffiti residue, motion streaks. Keep crisp ink lineart visible ON TOP of messy colors. ' +
    'Palette: neon yellow, vivid magenta, bright cyan, brand orange (#c45c26). Face likeness unchanged.';

  return generateImageWithContent(prompt, {
    aspectRatio: options.aspectRatio || '3:4',
    referenceImages: [sceneDataUrl],
    referenceLabels: ['Ink Lineart Base'],
    model: STORY_IMAGE_MODEL,
    styleLock: JJKE_ED1_COLOR_LOCK,
  });
};

/**
 * 局部上色 I2I：將墨線場景轉為指定品牌色 (#c45c26) 局部上色風
 */
export const applySelectiveColorPass = async (sceneDataUrl, options = {}) => {
  const prompt =
    'ADD PARTIAL COLOR. Apply the brand orange (#c45c26) selectively to key clothing items, ' +
    'props, or lighting elements. Keep 80% of the image as clean black-and-white ink line art. ' +
    'Preserve subject likeness and composition perfectly. Clean, high-contrast animation frame.';

  return generateImageWithContent(prompt, {
    aspectRatio: options.aspectRatio || '3:4',
    referenceImages: [sceneDataUrl],
    referenceLabels: ['Original Scene'],
    model: STORY_IMAGE_MODEL,
    styleLock: SELECTIVE_COLOR_LOCK,
  });
};

const applyInkStyleColorPass = async (sceneDataUrl, { prompt, styleLock, aspectRatio = '3:4' }) =>
  generateImageWithContent(prompt, {
    aspectRatio,
    referenceImages: [sceneDataUrl],
    referenceLabels: ['Ink Lineart Base'],
    model: STORY_IMAGE_MODEL,
    styleLock,
  });

export const applyChiikawaColorPass = async (sceneDataUrl, options = {}) =>
  applyInkStyleColorPass(sceneDataUrl, {
    aspectRatio: options.aspectRatio || '3:4',
    styleLock: CHIIKAWA_COLOR_LOCK,
    prompt:
      'Colorize this black-and-white ink drawing in a Chiikawa-like healing picture-book style. ' +
      'Convert ink lines to warm deep brown, use creamy beige paper background, and add soft pink round cheek blush. ' +
      'Use gentle pastel watercolor bleeds while keeping the scene clean, cute, and readable.',
  });

export const applyRisoColorPass = async (sceneDataUrl, options = {}) =>
  applyInkStyleColorPass(sceneDataUrl, {
    aspectRatio: options.aspectRatio || '3:4',
    styleLock: RISO_COLOR_LOCK,
    prompt:
      'Colorize this lineart in Risograph print style. ' +
      'Use mainly fluorescent magenta and bright cyan with visible grain and 3-5px misregistration offset. ' +
      'Preserve the original composition and character likeness.',
  });

export const applyComicsColorPass = async (sceneDataUrl, options = {}) =>
  applyInkStyleColorPass(sceneDataUrl, {
    aspectRatio: options.aspectRatio || '3:4',
    styleLock: COMICS_COLOR_LOCK,
    prompt:
      'Colorize this lineart as a retro newspaper comics frame. ' +
      'Use off-white paper base, muted vintage inks, and subtle halftone print texture. ' +
      'Keep contours clear and preserve face likeness.',
  });

export const applyNeonColorPass = async (sceneDataUrl, options = {}) =>
  applyInkStyleColorPass(sceneDataUrl, {
    aspectRatio: options.aspectRatio || '3:4',
    styleLock: NEON_COLOR_LOCK,
    prompt:
      'Colorize this lineart with cyber neon night mood. ' +
      'Deep dark base, glowing cyan/magenta highlights, and slight chromatic offset for energy. ' +
      'Keep the subject and linework sharp and recognizable.',
  });

export const applySumieColorPass = async (sceneDataUrl, options = {}) =>
  applyInkStyleColorPass(sceneDataUrl, {
    aspectRatio: options.aspectRatio || '3:4',
    styleLock: SUMIE_COLOR_LOCK,
    prompt:
      'Colorize this lineart as sumi-e ink wash on washi paper. ' +
      'Keep mostly monochrome brush ink values, with restrained vermilion accents and very light gold dust touches. ' +
      'Preserve the original composition and face identity.',
  });

/**
 * 上傳真人照 → 以「整身人物為主」轉繪（背景可保留但人物放大填滿）
 */
export const generatePlayerPortraitFromPhoto = async (photoDataUrl, opts = {}) => {
  const name = String(opts.displayName || 'Me').trim() || 'Me';
  if (!photoDataUrl) throw new Error('請先上傳個人照片');

  const prompt = [
    `IMAGE-TO-IMAGE of the attached photo of "${name}".`,
    'CRITICAL COMPOSITION: Output a FULL-BODY (or head-to-near-feet) character portrait that FILLS the frame.',
    'The person must occupy ~80–92% of the image HEIGHT — enlarge them aggressively.',
    'If the photo shows a tiny person in a large room/landscape, ZOOM IN and crop away empty background.',
    'Do NOT copy the photo\'s distant wide framing. Do NOT leave large empty margins around a small figure.',
    'Preserve the SAME person likeness, pose, clothes, and glasses; stylize remaining background as Ghibli ink.',
    'SKIN TONE LOCK (FATAL IF WRONG): Match the attached photo\'s face/skin LIGHTNESS in grayscale exactly.',
    'Do NOT darken the face/arms. Do NOT redraw as a Black / African-American person unless the photo clearly shows that.',
    'Do NOT copy Bob\'s dark skin. Keep East Asian / light / medium skin as light-to-mid gray fills — never charcoal face.',
    'NEVER output a blank/black/solid-dark face silhouette. Face features (eyes, nose, mouth) must be clearly drawn.',
    'Do NOT output a tiny figure in a huge background. Do NOT head-only crop. Prefer standing full body when possible.',
    'STYLE: Ghibli ink BASE in black-and-white, with SELECTIVE warm orange (#c45c26) accents on clothes/props only.',
    'OUTPUT: vertical 3:4 full-body portrait. NO square crop. NO text, NO speech bubbles, NO circular frame, NO photorealism.',
  ].join('\n');

  return generateImageWithContent(prompt, {
    aspectRatio: '3:4',
    model: CANONICAL_IMAGE_MODEL,
    referenceImages: [photoDataUrl],
    referenceLabels: [name],
    characterIds: [],
    styleLock: PLAYER_STYLE_LOCK,
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
    'PURE FLAT WHITE BACKGROUND only — remove ALL scene/background from the photo (studio white like other character icons).',
    'EXACT same person face as the reference. Ghibli black-and-white ink line art only (icon stays grayscale for UI circle crop).',
    'SKIN TONE LOCK (FATAL IF WRONG): Preserve the reference face gray value. Do NOT darken into Black / African-American skin. Do NOT look like Bob.',
    'NEVER output a blank/black/solid-dark face. Keep facial features readable on light-to-mid gray skin.',
    'NO photorealism, NO full-color face, NO text, NO speech bubbles, NO circular frame baked into the image.',
    'The UI applies a circular CSS crop — bitmap must be a plain square portrait with white corners.',
  ].join('\n');

  return generateImageWithContent(prompt, {
    aspectRatio: '1:1',
    model: CANONICAL_IMAGE_MODEL,
    referenceImages: [faceCropDataUrl],
    referenceLabels: [name],
    characterIds: [],
    styleLock: PLAYER_STYLE_LOCK,
  });
};

/**
 * 純文字生成（繁中）
 * @param {string} prompt
 * @returns {Promise<string>}
 */
export const generatePlainText = async (prompt) => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: 'user', parts: [{ text: String(prompt || '') }] }],
  });
  const parts = response?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p?.text).filter(Boolean).join('\n').trim();
  if (!text) throw new Error('文字模型未回傳內容');
  return text;
};

/**
 * 要求模型回 JSON；失敗時丟錯
 * @param {string} prompt
 * @returns {Promise<object|array>}
 */
export const generateJsonText = async (prompt) => {
  const raw = await generatePlainText(
    `${prompt}\n\n只輸出合法 JSON，不要 markdown、不要註解。`
  );
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (!match) throw new Error('無法解析模型 JSON');
    return JSON.parse(match[0]);
  }
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
