# BubbleWeave（織泡劇場）── 產品需求說明書 (PRD) · **v2 籤詩運勢**

> **版本**：v2.0-dev（2026-07-24）  
> **Git 分支**：`feat/v2-rewrite`  
> **狀態**：定案實作中  
> **本機資料**：IndexedDB **`bubbleweave.v2`**  
> **雲端**：GCP（專案 `gen-lang-client-0927009312`）**Firestore + Cloud Functions + Cloud Storage**（分享兌換／每連結限 5 次）  
> **對照**：v1 凍結規格見 [`PRD_v1.md`](./PRD_v1.md)；版本約定見 [`VERSIONING.md`](./VERSIONING.md)

---

## 0. 產品一句话

以**直式手機**為主的「個人 2D 化身 × 台灣籤詩運勢」分享平台：上傳自拍 → 轉繪＋個性標籤 → 抽類別籤運 → 產出含本人的場景卡與對白 → 調對話框 → 分享限動圖給好友互測（互拿卡片、防刷）。

**相對 v1 的破壊性變更**：拿掉劇場排卡、社群熱門／最新當主線；稀有度 N～UR 改為籤運等級；主流程改為五步籤詩體驗。

---

## 1. 北極星與裝置

| 項目 | 規格 |
|------|------|
| 主裝置 | **直式手機**（390×844 基準）；桌面為置中手機框預覽 |
| 視覺 | **沿用 v1 atelier**：紙感、高對比墨線、Fraunces／Outfit、強調色 terracotta |
| 產圖比例 | 卡面／下載主圖 **3:4**；Threads／IG 限動分享底 **9:16** |
| 畫風 | Ghibli Ink Keyframe（黑白墨線）；場景與四角沿用 v1 管線 |

---

## 2. 使用者主流程（五步）

```text
Step1 上傳自拍 ──臉必須偵測到──►
Step2 2D 轉繪 + Gemini 性格 + 小測驗 ──► 個性標籤
Step3 選運勢類別 → 抽籤等級 → 產圖（必含本人）+ 三組對白
Step4 選對白（或自填 ≤20 字）+ 調對話框位置
Step5 下載／分享限動圖 + 好友連結（互拿卡片、防互刷）
```

懸浮入口（任意步驟可開，不中斷主流程）：

| Icon | 名稱 | 內容 |
|------|------|------|
| 圖庫 | 我的籤卡 | 已產出／好友複製來的卡 |
| 個人 | 我的檔案 | 2D 全身、頭像 icon、暱稱、個性標籤、等級進度 |
| 歷史 | 過往籤運 | 依時間的抽籤紀錄（類別、籤等、縮圖） |

---

## 3. Step 規格

### 3.1 Step1｜上傳與臉部防呆

- 上傳單人照（JPG／PNG／WebP）。
- **必須**通過本機 YOLO 臉偵測（沿用 v1 `validatePlayerPhotoUpload` 精神）：
  - 0 臉／過糊／臉太小／解析度不足 → **擋下並提示**，不進轉繪。
  - ≥2 張有意義的臉 → **擋下**：請上傳只有本人的照片。
- 通過後進入 Step2。

### 3.2 Step2｜2D 角色＋個性

1. **2D 轉繪**（沿用 v1）：全身以人為主放大；另產白底頭肩 icon（臉偵測→去背，對齊四角）。  
2. **Gemini 視覺性格分析**：依轉繪／原圖風格與氣質，產出 3～5 個短標籤（繁中，例：`社畜吐槽`、`軟爛樂觀`）。  
3. **小心理測驗**：固定 **5 題**（單選），題庫見 §6；答案映射到性格軸，與 Gemini 標籤合併去重，最終 **3～6 個個性標籤**。  
4. 完成畫面：大圖 2D、暱稱（可編）、標籤 chips。

### 3.3 Step3｜抽籤（取代稀有度）

#### 運勢類別（用戶必選一）

| id | 顯示名 |
|----|--------|
| `career` | 工作／學業運 |
| `love` | 愛情／桃花運 |
| `health` | 健康／體力運 |
| `wealth` | 財運／金富運 |
| `social` | 人際／小人運 |

#### 籤運等級（高→低）

| 等級 id | 顯示 | 預設權重* |
|---------|------|----------|
| `dai_kichi` | 大吉 | 5 |
| `kichi` | 吉 | 15 |
| `chu_kichi` | 中吉 | 25 |
| `sho_kichi` | 小吉 | 30 |
| `kyo` | 凶 | 18 |
| `dai_kyo` | 大凶 | 7 |

\*權重會依**個性標籤**微調（例：偏焦慮標籤略增凶／大凶；偏樂觀略增吉系），但每檔仍有下限，避免永遠同結果。

#### 產圖規則

- 場景：沿用 v1 總編輯季包／I2I（`season-taiwan-diverse` + canonical 參考）。  
- **每張必含用戶本人**（`me`）。  
- 與四角互動人數權重沿用 v1 每日邏輯：solo 我 35%／我+1 40%／我+2 20%／我+3 5%。  
- **表情／動作**依籤等刻畫（寫入 image prompt）：  
  - 大吉～中吉：開朗、得意、鬆一口氣  
  - 小吉：微妙、苦笑  
  - 凶～大凶：崩潰、僵硬、社死感  
- 同步產出 **三組獨立短對白**（各 ≤20 字，繁中），語氣貼個性標籤＋類別＋籤等；供 Step4 選擇。

### 3.4 Step4｜對白與對話框

- 主畫面：3:4 卡面預覽。  
- 對白框上方切換：**對白 1／2／3／自己寫**（自填 ≤20 字）。  
- 可拖曳調整對話框位置（沿用 v1 `manualPos`）。  
- 確認後寫入該張籤卡最終對白與座標。

### 3.5 Step5｜分享與好友互測

#### 下載／分享圖

點「下載／分享圖片」時產出兩種構圖：

1. **3:4** 純卡面（對話框已壓上）。  
2. **9:16** 限動滿版：中央置入 3:4 卡（或等比），頂部粗體文案範本：

```text
「［暱稱］今日［類別短名］：【［籤等］］［emoji]】！點連結幫我改運，或是看看你有多慘 ⬇️」
```

例：`「阿明今日工作運：【大凶 💀】！點連結幫我改運，或是看看你有多慘 ⬇️」`

籤等 emoji：大吉 ✨／吉 🍀／中吉 🙂／小吉 😐／凶 😬／大凶 💀

#### 分享連結

- 格式：`https://{host}/s/{shareCode}`（或 hash router `#/s/{shareCode}`）。  
- 對方開啟 → 走 Step1～4（可用自己的帳／本機 profile）→ **完成 Step4 確認**後觸發兌換。

#### 互拿卡片

- A 分享卡 X；B 走完流程產出卡 Y 並完成兌換：  
  - B 的圖庫獲得 **A 的卡 X 複本**  
  - A 的圖庫獲得 **B 的卡 Y 複本**  
- 複本標記 `source: 'friend_copy'`，保留原作者暱稱。

#### 防刷（每連結限次）

| 規則 | 說明 |
|------|------|
| 每條 shareCode | 最多成功兌換 **5** 次 |
| 同一 claimer | 同一 shareCode 只能兌成功 **1** 次 |
| 自兌 | 禁止 `claimerId === ownerId` |
| 未完成 Step4 | 不可兌 |

超出上限回傳明確錯誤（例：「這條連結已兌換滿 5 次」）。

---

## 4. 資訊架構與用字

| 舊 v1 用字 | v2 用字 |
|------------|---------|
| 靈感池／倉庫 | 圖庫 |
| 每日獎勵 | 抽籤／今日抽籤 |
| 稀有度 N～UR | 籤運 大吉～大凶 |
| 織泡劇場 | （主線移除；品牌仍可稱織泡／BubbleWeave） |
| 發布故事 | 分享限動／傳給好友 |
| Remix | （主線不做；好友複本取代） |

品牌名：**織泡**／BubbleWeave；副標建議：「今日籤運，傳給朋友改運」。

---

## 5. 資料模型（摘要）

### 5.1 本機 IndexedDB `bubbleweave.v2`

```text
playerProfile: { id, displayName, portraitUrl, iconUrl, tags[], quizAnswers, createdAt }
fortuneCards[]: { id, category, fortune, imageUrl, dialogues[3], chosenDialogue, manualPos, createdAt, shareCode? }
history[]: 與 cards 對齊或同表
friendCopies[]: 複本卡
```

本機 `player.id`：首次啟動 UUID（自管，不上雲端帳號系統）。

### 5.2 GCP（Firestore + Storage + Cloud Functions）

專案：`gen-lang-client-0927009312`。詳見 [`gcp/README.md`](../gcp/README.md)。

| 資源 | 用途 |
|------|------|
| Firestore `share_links/{code}` | ownerId、cardPayload（圖為 GCS URL）、redeemCount、maxRedeems=5 |
| Firestore `share_links/{code}/claims/{claimerId}` | 兌換紀錄＋claimer 卡複本 |
| GCS `…-bw-share` | 卡面圖（避免 Firestore 塞 base64） |
| Cloud Function `bubbleweave-share` | HTTP：create／share／redeem／incoming |

---

## 6. 心理測驗題庫（5 題）

每題 4 選 1，映射標籤（實作寫死於 `src/v2/data/psychQuiz.js`）：

1. 週末突然放晴，你最想？→ 宅家／衝戶外／找人吃飯／補眠  
2. 被捷運門夾到心理第一句？→ 吐槽北捷／認命／拍照發限動／假裝沒事  
3. 朋友揪你臨時局？→ 秒答應／看名單／編藉口／問吃什麼  
4. 錢包只剩銅板？→ 慌／淡定吃泡麵／借貸語氣玩笑／開始記帳  
5. 看到「大凶」兩字？→ 笑著接受／想改運／轉念小吉／傳給更慘的朋友  

標籤例：`樂天`、`社畜魂`、`選擇障礙`、`幹話王`、`佛系`、`焦慮小宇宙` 等。

---

## 7. 技術規格

| 項目 | 規格 |
|------|------|
| 前端 | Vite 6 + React 18 + Tailwind 3（v1 棧） |
| 生圖／文字 | Gemini（Nano Banana image + flash-lite text） |
| 臉偵測 | 本機 YOLO `/__bw/detect-faces` |
| 後端 | **GCP**：Firestore + Cloud Functions + Cloud Storage（專案 data team test） |
| 路由 | hash：`#/` 主流程、`#/s/:code` 分享進入 |
| 繼承模組 | `faceDetection`、`playerPortraitProcess`、`gemini` I2I、`warehouse` season 抽場景、`speechBubble` 對話框 |

環境變數：

```bash
VITE_GEMINI_API_KEY=
VITE_SHARE_API_URL=https://asia-east1-gen-lang-client-0927009312.cloudfunctions.net/bubbleweave-share
```

---

## 8. 驗收清單

- [ ] 直式主畫面；懸浮圖庫／個人／歷史可用  
- [ ] Step1：多人／無臉／不清 → 明確提示且不轉繪  
- [ ] Step2：2D＋icon＋≥3 個性標籤  
- [ ] Step3：五類別可選；籤等六檔；圖必含本人；三組對白  
- [ ] Step4：切換對白／自填 20 字；可拖對話框  
- [ ] Step5：3:4＋9:16 限動圖文案正確；分享連結可開  
- [ ] 好友完成後雙方圖庫互得複本；同 pair 超限被拒  
- [ ] IndexedDB 為 `bubbleweave.v2`；v1 庫不被清  
- [ ] `docs/PRD_v2.md` 與實作一致  

---

## 9. 實作分期

| 期 | 內容 | 狀態 |
|----|------|------|
| P0 | PRD、GCP 分享 API、手機殼＋步驟機、懸浮 icon | ✅ |
| P1 | Step1～2（臉防呆、2D、測驗、標籤） | ✅ |
| P2 | Step3～4（抽籤、產圖、對白、拖框） | ✅ |
| P3 | Step5 匯出 9:16、GCP 分享兌換（每連結 5 次） | ✅（未設 API URL 時用 `local-` fallback） |
| P4 | 文案打磨、空態、錯誤態、效能（圖壓縮） | 待辦 |

**程式入口**：`src/main.jsx` → `src/v2/AppV2.jsx`（舊劇場 UI 留在 `src/App.jsx` 供對照，不掛載）

---

## 10. 文件地圖

| 文件 | 用途 |
|------|------|
| 本檔 | v2 產品規格（定案） |
| [`PRD_v1.md`](./PRD_v1.md) | v1 凍結 |
| [`VERSIONING.md`](./VERSIONING.md) | Git／DB |
| `supabase/migrations/` | 雲端表結構 |
