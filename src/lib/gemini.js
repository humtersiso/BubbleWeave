// 暫存 Gemini API 金鑰與配置
export const GEMINI_API_KEY = "***REMOVED***";
export const IMAGE_MODEL = "gemini-3.1-flash-lite-image";
export const TEXT_MODEL = "gemini-3.1-flash-lite";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * 生成黑白素描風格卡牌
 * @param {string} customPrompt - 使用者自定義或系統預設的場景描述
 * @returns {Promise<string>} - 返回生成圖片的 Base64 或 URL (取決於模型實作)
 */
export const generateCardImage = async (customPrompt) => {
  const model = genAI.getGenerativeModel({ model: IMAGE_MODEL });
  const basePrompt = "Pencil sketch style, black and white, high contrast, dramatic facial expressions, human characters only, scene: ";
  const result = await model.generateContent([basePrompt + customPrompt]);
  const response = await result.response;
  return response.text(); // 根據實際 API 回傳結構調整
};

/**
 * 根據卡牌順序生成對白
 * @param {Array} cards - 卡牌資料陣列
 * @returns {Promise<string[]>} - 返回對白陣列
 */
export const generateDialogues = async (cards) => {
  const model = genAI.getGenerativeModel({ model: TEXT_MODEL });
  const prompt = `基於以下卡牌內容順序，生成幽默有趣的對白：${JSON.stringify(cards)}`;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text().split('\n'); 
};
