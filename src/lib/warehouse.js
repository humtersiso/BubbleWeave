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
    scene: scenes[index],
    timestamp: new Date().toISOString(),
    style: "Pencil Sketch"
  }));
};

/**
 * 領取每日獎勵：隨機生成 3 張新卡牌
 * @returns {Promise<Object[]>} - 返回 3 張新卡牌
 */
export const claimDailyReward = async () => {
  const randomScenes = [
    "Unexpected rain", "Lost in the city", "Finding a secret door",
    "Talking to a bird", "A giant clock", "Floating islands"
  ];
  // 隨機挑選 3 個場景
  const selectedScenes = randomScenes.sort(() => 0.5 - Math.random()).slice(0, 3);
  
  const cardPromises = selectedScenes.map(scene => generateCardImage(scene));
  const newCards = await Promise.all(cardPromises);

  return newCards.map((imageData, index) => ({
    id: `reward-${Date.now()}-${index}`,
    imageUrl: imageData,
    scene: selectedScenes[index],
    timestamp: new Date().toISOString(),
    style: "Pencil Sketch"
  }));
};

/**
 * 計算下次領取獎勵的剩餘時間
 * @param {string} lastClaimTime - 上次領取時間 (ISO string)
 * @returns {number} - 剩餘秒數
 */
export const getRewardCountdown = (lastClaimTime) => {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const lastClaim = new Date(lastClaimTime).getTime();
  const now = new Date().getTime();
  const nextClaim = lastClaim + TWENTY_FOUR_HOURS;
  
  const timeLeft = nextClaim - now;
  return timeLeft > 0 ? Math.floor(timeLeft / 1000) : 0;
};
