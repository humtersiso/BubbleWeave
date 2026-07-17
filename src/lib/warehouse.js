import { generateCardImage } from './gemini';

/**
 * 初始化倉庫，生成 21 張測試卡牌
 * 模擬用戶累積 7 天，每天領取 3 張的狀態
 */
export const initializeWarehouse = async () => {
  const scenes = [
    "Office argument", "Crowded concert", "Quiet library", 
    "Street dance battle", "Awkward elevator moment", "Busy subway station",
    "Café breakup", "Winning a marathon", "Surprise birthday party",
    "Job interview nerves", "Cooking disaster", "Walking in the rain",
    "High-stakes poker game", "Art gallery opening", "Laundromat waiting",
    "Airport farewell", "Mountain top view", "Fashion runway walk",
    "Street food stall", "Classroom exam stress", "Midnight rooftop talk"
  ];

  console.log("正在初始化倉庫，生成 21 張黑白素描卡牌...");
  
  const cardPromises = scenes.map(scene => generateCardImage(scene));
  const cards = await Promise.all(cardPromises);
  
  // 將生成的圖片資料格式化並回傳
  return cards.map((imageData, index) => ({
    id: `card-${index}`,
    imageUrl: imageData,
    timestamp: new Date().toISOString(),
    style: "Pencil Sketch"
  }));
};
