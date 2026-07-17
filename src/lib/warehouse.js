import { generateCardImage } from './gemini.js';

/**
 * 初始化倉庫，生成 21 張測試卡牌
 * 模擬用戶累積 7 天，每天領取 3 張的狀態
 */
export const initializeWarehouse = async () => {
  const scenes = [
    "Office argument over a stapler", "Clumsy waiter at a crowded concert", "Sneezing loudly in a quiet library", 
    "Street dance battle with a mascot", "Awkward elevator eye contact", "Chasing a closing subway train",
    "Spilling coffee during a café breakup", "Accidentally winning a marathon", "Hidden in a surprise party cake",
    "Job interview nerves with a squeaky chair", "Kitchen fire cooking disaster", "Umbrella flipping inside out in the rain",
    "Bluffing in a high-stakes poker game", "Mistaking a fire extinguisher for art", "Matching socks at a laundromat",
    "Airport farewell with the wrong person", "Selfie at a windy mountain top", "Tripping on a fashion runway",
    "Eating spicy food at a street stall", "Falling asleep during an exam", "Midnight rooftop telescope talk"
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
