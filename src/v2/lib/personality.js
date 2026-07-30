import { generateJsonText, hasApiKey } from '../../lib/gemini.js';
import { getPsychQuestions, tagsFromQuizAnswers } from '../data/psychQuiz.js';

const FALLBACK_VISION_TAGS = ['社畜吐槽', '軟爛樂觀', '幹話王'];

/**
 * Gemini 視覺＋測驗合併個性標籤（3～6 個）
 * @param {{ portraitUrl?: string, displayName?: string, quizAnswers?: Record<string, string>, quizSetId?: string }} opts
 */
export const buildPersonalityTags = async (opts = {}) => {
  const questions = getPsychQuestions(opts.quizSetId);
  const quizTags = tagsFromQuizAnswers(opts.quizAnswers || {}, questions);
  let visionTags = [];

  if (hasApiKey() && opts.portraitUrl) {
    try {
      const name = opts.displayName || '我';
      const data = await generateJsonText(
        [
          `你是台灣社群文案顧問。根據角色「${name}」的氣質（已轉繪成吉卜力黑白墨線風），`,
          '產出 3～5 個繁中短個性標籤（2～5 字），語氣生活化、可分享。',
          '可用方向：社畜吐槽、軟爛樂觀、幹話王、佛系、焦慮小宇宙、樂天、選擇障礙…',
          '格式：{"tags":["…","…"]}',
        ].join('')
      );
      if (Array.isArray(data?.tags)) {
        visionTags = data.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 5);
      }
    } catch (err) {
      console.warn('vision tags failed', err);
      visionTags = FALLBACK_VISION_TAGS;
    }
  } else {
    visionTags = FALLBACK_VISION_TAGS;
  }

  const merged = [];
  const seen = new Set();
  for (const t of [...quizTags, ...visionTags]) {
    const key = String(t).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(key);
    if (merged.length >= 6) break;
  }
  while (merged.length < 3) {
    const pad = FALLBACK_VISION_TAGS.find((t) => !seen.has(t));
    if (!pad) break;
    seen.add(pad);
    merged.push(pad);
  }
  return merged;
};
