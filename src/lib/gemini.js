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
  const basePrompt = "Hand-drawn pencil sketch, black and white, high contrast, sharp lines, dramatic facial expressions, comic book panel style, human characters only, scene: ";
  const result = await model.generateContent([basePrompt + customPrompt]);
  const response = await result.response;
  // 注意：Gemini Image API 目前回傳結構通常包含 inlineData 或 URL，此處保持靈活
  return response.text(); 
};

/**
 * 根據卡牌順序與其內容生成對白
 * @param {Array} cards - 卡牌資料陣列 (含 ID 與場景描述)
 * @returns {Promise<string[]>} - 返回對白陣列
 */
export const generateDialogues = async (cards) => {
  const model = genAI.getGenerativeModel({ model: TEXT_MODEL });
  const prompt = `You are a scriptwriter for a silent comedy. Based on the following sequence of scenes: ${JSON.stringify(cards.map(c => c.scene))}, provide a short, humorous dialogue line or thought bubble text for each scene. Return only the lines, separated by newlines.`;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text().split('\n').filter(line => line.trim() !== ""); 
};
