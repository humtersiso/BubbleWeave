import { initializeWarehouse, claimDailyReward, getRewardCountdown } from '../lib/warehouse';
import { generateDialogues } from '../lib/gemini';

/**
 * 簡單的自動化測試腳本，用於驗證核心邏輯
 */
const runTests = async () => {
  console.log("🚀 開始執行 BubbleWeave 自動化測試...");

  // 1. 測試 Warehouse 初始化
  try {
    console.log("📦 測試 Warehouse 初始化...");
    const cards = await initializeWarehouse();
    if (cards.length === 21) {
      console.log("✅ Warehouse 初始化成功: 已生成 21 張卡牌");
    } else {
      console.error("❌ Warehouse 初始化失敗: 卡牌數量不正確");
    }
  } catch (e) {
    console.error("❌ Warehouse 初始化異常:", e.message);
  }

  // 2. 測試每日獎勵
  try {
    console.log("🎁 測試每日獎勵領取...");
    const reward = await claimDailyReward();
    if (reward.length === 3) {
      console.log("✅ 每日獎勵領取成功: 已生成 3 張新卡牌");
    }
  } catch (e) {
    console.error("❌ 每日獎勵領取異常:", e.message);
  }

  // 3. 測試倒數計時邏輯
  console.log("⏲️ 測試倒數計時邏輯...");
  const now = new Date().toISOString();
  const timeLeft = getRewardCountdown(now);
  if (timeLeft > 0 && timeLeft <= 86400) {
    console.log("✅ 倒數計時計算正確");
  } else {
    console.error("❌ 倒數計時計算錯誤");
  }

  // 4. 測試 Gemini 對白生成 (模擬資料)
  try {
    console.log("🤖 測試 Gemini 對白生成...");
    const mockCards = [{ scene: "Test scene 1" }, { scene: "Test scene 2" }];
    const dialogues = await generateDialogues(mockCards);
    if (dialogues.length > 0) {
      console.log("✅ Gemini 對白生成功能回傳正常");
    }
  } catch (e) {
    console.warn("⚠️ Gemini API 測試跳過或異常 (可能缺少 API Key):", e.message);
  }

  console.log("🏁 測試執行完畢");
};

runTests();
export default runTests;
