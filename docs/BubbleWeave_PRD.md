# BubbleWeave（織泡劇場）── 產品需求說明書 (PRD)

> **版本**：2026-07-23（劇場流程＋YOLO 臉錨＋3:4 定案＋icon 保留）  
> **相關文件**：[`CHARACTER_BIBLE.md`](./CHARACTER_BIBLE.md) · [`CHARACTER_COMBOS.md`](./CHARACTER_COMBOS.md) · [`README.md`](../README.md)  
> **程式**：Vite + React 18 + Tailwind；本機 Demo（IndexedDB，無後端）

---

## 1. 產品是什麼

BubbleWeave 是圖文故事創意社群平台：提供**高隨機、圖內無對白**的黑白分鏡卡牌，用戶選圖、排序，再以手動或 AI 寫對白並發布／匯出。

| 價值 | 說明 |
|------|------|
| 低門檻 | 選圖 → 排順序 → 寫／生成對白 → 發布／匯出 |
| 可傳播 | Like + Remix（複製畫面、清空對白、重新詮釋） |
| 角色一致 | 固定四角跨場景不變臉、不變簽名裝 |

**第 1 季主題**：台灣日常／旅遊（夜市、捷運、雷陣雨、廟口、地標等）。

---

## 2. 產品北極星：0 人工發想、一鍵開季

開發者不查景點、不手填「場景×動作」表單。開新季只做一件事：**觸發總編輯**。

```text
npm run create-season -- --theme="台灣旅遊" [--count=21|50|100]
        │
        ▼  Gemini 總編輯（文字）
   N 組 { 槽位, 場景, 動作, character_id, image_prompt }
        │  含 diversity 稽核；張數不限 21
        ▼
   圖像管線（Canonical 肖像 → I2I 場景卡）
        │
        ▼
   靈感池入庫 → 用戶創作
```

| 原則 | 說明 |
|------|------|
| 內容由 AI 發想 | 景點＋爆笑動作＋英文生圖 prompt 一步產出 |
| 10 槽位是 Constraints | 防偷懶、防重複、控主題覆蓋；不是營運手填表 |
| 多樣性隨量擴張 | `--count` 加大時，槽位保底與不重複規則等比放大；超過單波自動分波＋exclusion |
| 角色外觀動態寫入 | `STYLE_LOCK` 只鎖畫風；角色造型由該卡 `character_id` 寫進 `image_prompt` 主體 |

**程式**：`src/lib/seasonChiefEditor.js`、`scripts/create-season.mjs`  
**產物**：`data/generated/season-*.json`

### 主線 vs 相容舊線

| | 主線（現行目標） | 舊線（Demo 相容） |
|--|------------------|-------------------|
| 用途 | 開季／啟動倉庫／每日獎勵 | 舊 recipes 抽樣（相容保留） |
| 來源 | 總編輯 JSON 的 `image_prompt` | `cardRecipes.js` 手寫 SCENES／ACTIONS |
| 狀態 | ✅ `create-season` → `season-taiwan-diverse.json`；✅ 啟動／每日領卡皆 I2I | **非**上線主資料源 |

---

## 3. 系統架構（四層）

```text
Layer 1  DATA          槽位骨架 + 季設定 + 總編輯產出的卡牌配方 JSON
Layer 2  IMAGE         Canonical 肖像 → I2I 無字場景卡 → 倉庫
Layer 3  SCRIPT        季包分鏡底層 → 敘事節拍 → 風格化短對白
Layer 4  RENDER        人臉錨點氣泡疊加 → 預覽／JPEG／HTML
```

| Layer | 職責 | 主要程式 |
|-------|------|----------|
| 1 | 通用槽位、季 meta、總編輯發想 | `universalSlots.js`、`seasons/*.json`、`seasonChiefEditor.js`、`seasonCatalog.js` |
| 2 | 生圖與入庫 | `gemini.js`、`warehouse.js`、`character-bible.js` |
| 3 | AI 對白 | `storyGeneration.js`、`characterVoice.js` |
| 4 | 氣泡與匯出 | `speechBubble.js`、`exportMangaCanvas.js`、`MangaStripView` |

舊抽樣輔助（相容）：`cardRecipes.js`（場景／動作目錄、組 prompt）。

---

## 4. 內容系統

### 4.1 固定四角

Cindy／Bob／David／Elise。規格唯一來源：`src/data/character-bible.js`（見人物誌）。  
**服裝跨季鎖定**：夜市、海邊、雨天也不換成觀光裝；傘／雨衣等可當道具。

### 4.2 季包

| 項目 | 說明 |
|------|------|
| 現行 | 第 1 季台灣篇 `src/data/seasons/s1_taiwan.json` |
| 槽位映射 | `sceneSlotMap`：在地場景 id → 通用槽位（舊線抽樣用） |
| 換季 | 同一 10 槽位；總編輯換 `theme` 即可（日／韓／辦公室／校園…） |

### 4.3 通用槽位（食衣住行育樂）

跨季不變。定義：`src/lib/universalSlots.js`。  
「行」拆成 **大眾運輸**／**個人交通** 兩槽（舊 `TRANSIT_DAILY` 會正規化成 `TRANSIT_PUBLIC`）。

| 槽位 ID | 類別 | 名稱 | weight | 台灣篇範例 |
|---------|------|------|-------:|------------|
| `STREET_FOOD` | 食 | 地道小吃 | **28**（高） | 夜市臭豆腐／大腸包小腸 |
| `DINING_SOCIAL` | 食 | 聚餐與酒吧 | **6**（低） | 熱炒店／流水席／火鍋 |
| `FASHION_LOCAL` | 衣 | 雨具／換裝災難 | 14（中） | 撐雨傘翻車／雨衣全身濕／藍白拖 |
| `ACCOMMODATION` | 住 | 住宿與歇腳 | **6**（低） | 汽車旅館／老舊旅社 |
| `TRANSIT_PUBLIC` | 行 | 大眾運輸 | **28**（高） | 捷運車廂／公車站／高鐵月台 |
| `TRANSIT_PERSONAL` | 行 | 個人交通 | **28**（高） | YouBike／腳踏車／機車陣 |
| `CULTURE_RULES` | 育 | 信仰與文化儀式 | 14（中） | 廟會擲筊／算命籤詩／刮樂透 |
| `LANDMARK_SPOT` | 樂 | 觀光經典地標 | **28**（高） | 台北 101／九份老街 |
| `SHOPPING_CHAOS` | 樂 | 爆買商店 | 14（中） | 24H 超商／全聯／家樂福 |
| `NATURE_OUTDOORS` | 樂 | 自然與戶外 | **6**（低） | 河濱公園／陽明山步道 |
| `ENTERTAINMENT` | 樂 | 夜生活與娛樂 | 14（中） | 夾娃娃機／KTV 包廂 |

產品規則摘要：**高**＝小吃／地標／大眾運輸／個人交通；**中**＝雨具／文化／娛樂／爆買；**低**＝聚餐／住宿／自然。

### 4.4 卡牌配方欄位

每張卡（總編輯 JSON／入庫 `recipe`）至少含：

- `universal_slot_id`、`scene_zh`、`action_zh`、`emotion_zh`
- `character_id`、`image_prompt`
- 入庫後另有 `slotWeight` 等快照（分析／BQ 用）

---

## 5. 賽季產出與生圖

### 5.1 總編輯（Layer 1）

```bash
npm run create-season -- --theme="台灣旅遊"
npm run create-season -- --theme="台灣旅遊" --count=50 --out=data/generated/taiwan-50.json
```

| 能力 | 說明 |
|------|------|
| 輸出 | N 組卡牌配方 + `image_prompt`（**不生圖**） |
| 多樣性 | `buildDiversityQuotas(N)`：槽位保底、動作／場景不重複、人數配額 |
| 大批次 | 超過單波上限（24）自動分波；後波帶已用場景／動作 exclusion |
| 稽核 | 產物含 `diversity`；**失敗預設擋檔**（`--force` 可強制寫入） |
| 預設輸出 | `data/generated/season-taiwan-diverse.json`（與 App import 對齊） |

### 5.2 圖像管線（Layer 2）

| 階段 | 內容 | 模型 |
|------|------|------|
| 1 · Canonical | 白底 **1:1** 角色肖像（靈感池 icon＋I2I 參考） | `gemini-3.1-flash-lite-image` |
| 2 · I2I | 肖像參考 + `image_prompt` → **3:4**（約 1080×1440）無字卡 | 同上 |

- 啟動倉庫：讀 `season-taiwan-diverse.json` → `bootstrapWarehouseFromSeason`
- 每日獎勵：同池抽尚未入庫配方 → `claimDailyCards`（同一 I2I 管線）
- Demo 預設靈感池約 **21** 張；上線以 `--count` 擴卡池後再批次生圖

#### 版本號與重建策略（重要）

| 版本 | 觸發 | 行為 |
|------|------|------|
| `CARD_SCHEMA_VERSION` | 場景卡比例／prompt 結構變更 | **只重建場景卡**；canonical icon **沿用既有** |
| `PORTRAIT_VERSION` | 簿記用 | **不**因升版強制重跑 icon |
| 缺肖像 | IndexedDB 缺某一角 | **只補缺**的那幾張，其餘保留 |

定案：**目前 canonical icon 視為最佳成品，靈感池升級不得整批重跑角色肖像。**  
若真要重做 icon：手動清 IndexedDB 的 `portraits`，或刪除特定角色後再啟動（`generateCharacterPortraits` 只補缺）。

### 5.3 畫風規範

統一 **吉卜力黑白動畫原畫（Ghibli Ink Keyframe）**：

| 項目 | 規範 |
|------|------|
| 色彩 | 黑白 only |
| 線條 | 乾淨深色墨線、高對比；禁止淡鉛筆殘影 |
| 構圖 | 單格原畫；禁止多格頁／整頁粗框 |
| 角色 | 僅人類；身份以 Bible + 參考圖鎖定 |
| 對白 | **不畫進圖**；前端疊加／匯出層處理 |
| 禁字 | 圖內禁止字母、數字、路牌字、字幕、浮水印 |

---

## 6. 產品功能

### 6.1 版面

- **上**：織泡劇場（排卡、對白、預覽）＋社群（熱門／最新）  
- **下**：靈感池全寬  
- **浮層**：每日獎勵、故事記錄、發布／匯出  
- UI 主題：**工房（atelier）** — 紙感、高對比墨線  

### 6.2 個人專區

| 模組 | 行為 |
|------|------|
| 每日獎勵 | 可領時得 **3** 張；之後 24h 冷卻 |
| 靈感池 | 肖像 icon＋場景卡；點選／拖曳進劇場 |
| 故事記錄 | 已發布清單；讚／Remix；可再匯出 |

### 6.3 織泡劇場

流程步驟列（現階段亮起、其餘反灰）：

```text
1 放卡 → 2 對白 → 3 發布
```

| 步驟 | 行為 |
|------|------|
| 1 放卡 | 從靈感池拖入／點選；建議 3～4 格；放卡時背景預熱 YOLO 臉偵測 |
| 2 對白 | AI 生成或「編輯對白」手寫；編輯中關閉自動 peek，方便打字 |
| 3 發布 | 有對白後可直接**拖曳對話框調位置**（不必另按「調整位置」）；再發布 |

其他 UX：

- **無放大按鈕**；非編輯時保留懸浮／長按自動 peek
- **再生成**對白：同格同說話者保留使用者手動 `manualPos`
- 可選主題、風格（`STORY_STYLES`）；主題用於發布／匯出標題

**AI 風格**（`STORY_STYLES`）：

| id | 標籤 | 說明 |
|----|------|------|
| `comedy` | 爆笑 | 誇張吐槽（預設） |
| `taiwan_meme` | 台味迷因 | 雨天、排隊、珍奶 |
| `absurdist` | 無厘頭 | 正經講屁事 |
| `office` | 社畜日常 | 表面客氣、內心幹話 |
| `scifi` | 科幻 | 輕科幻包裝眼前這一格 |

### 6.4 社群

熱門（讚／Remix）／最新（時間序）。Like、Remix（複製卡序、**清空對白**）。Demo 資料在本機 IndexedDB。

| 規則 | 說明 |
|------|------|
| 標題 | **以主題為主**（誰跟誰不是重點）；feed／匯出 meta 不強調登場角色角標 |
| 版面 | 故事串依容器寬度自適應欄數（桌面橫向優先一列，避免強制 2×2 留白） |

### 6.5 預覽與匯出

1. 無字純圖（管線已產出，**3:4**）  
2. AI／手動對白（每格最多 **4** 氣泡；短句）  
3. Canvas／HTML 依 **YOLO 人臉錨點**壓氣泡（**無尾巴**白底圓角卡片）  

| 站位／排版 | 規則 |
|------|------|
| 基準畫布 | **1080×1440（3:4）**（`BUBBLE_WEAVE_CONFIG`） |
| 單／多人 | 依臉座標與避讓區排版；優先上方留白 |
| 手動微調 | `manualPos` 正規化座標；再生成時保留 |
| 除錯標記 | 臉紅框／嘴巴十字等**預設關閉**（僅 `localStorage.bwDebugBubbles=1`） |
| 匯出標題 | 主題為主；不畫「誰＋誰」角標 |

---

## 6.6 個人第 5 角與每日獎勵（2026-07-23）

| 項目 | 規格 |
|------|------|
| 版面 | 劇場左側個人卡：預設**展示態**（點擊資料區進入編輯）；大圖角色＋玩家收藏等級角標（與稀有度五級語彙） |
| 玩家等級 | 依靈感池「含我」卡數：0–2 N／3–8 R／9–17 SR／18–29 SSR／30+ UR；角標樣式跟靈感池所選標誌 |
| 上傳防呆 | 先 YOLO 檢查：多人／無人臉／臉太小或過糊／解析度不足 → **擋下並提示**，不進轉繪；僅單人清楚臉可過 |
| 生圖 | 上傳→轉繪（整身人物放大為主）→臉錨後裁個人卡；icon＝臉偵測裁頭→Nano Banana **白底去背頭肩**（對齊四角） |
| 定位 | 第 5 角 `me`，可與四角同框、進對白；不納入啟動倉庫 schema 強制覆蓋 |
| 每日 | **3 張皆含「我」**；人數權重 solo 35%／+1 40%／+2 20%／+3 5%；翻卡開獎動畫 |
| 稀有度 | 公式：1→N／2→R／3→SR／4→SSR；4＋高權重槽→UR |
| 標誌 | 3 套可選（墨印／箔星／朱印）× 5 級；選擇器在**靈感池**標題列；開獎／匯出皆顯示 |

---

## 7. AI 對白管線（Layer 3）

原則：**先季包與分鏡表，風格最後；對白不進圖。Gemini 只生對白文字，人臉錨點由本機 YOLO 偵測後再排氣泡。**  
實作：`src/lib/storyGeneration.js`（入口 `generateDialogues`）、臉偵測 `faceDetection.js`、排版 `speechBubble.js`。

### 7.1 流程總覽

```text
劇場選卡（含 card.recipe：場景／動作／情緒／角色）
        │
        ├─（可選）A · 視覺輔助：multimodal 看圖 → 繁中畫面描述
        │         recipe 齊全時預設跳過（useVisionAnalysis: true 可強制）
        ▼
      B · 敘事節拍：SEASON + 分鏡表 + 銜接規則 + 用戶大綱
        → 中性 JSON（theme / arc / 每格 beat·bridge·anchor·suggestedSpeakerId）
        │  禁止台詞口吻與風格梗
        ▼
      C · 風格整合：節拍 JSON + 所選 STORY_STYLES
        → panels[].bubbles[]（短句 + speakerId；**不含可靠 face**）
        ▼
      D · 人臉錨點：本機 YOLOv8 animeface（POST /__bw/detect-faces）
        → 依卡牌已知人數取信心最高的 N 張 → 左→右對應說話者
        ▼
      前端：ComposedPanelImage／SpeechBubbleOverlay／Canvas 依 face 排氣泡
```

| 步驟 | 模型呼叫 | 輸入重點 | 輸出 | 含風格？ |
|------|----------|----------|------|----------|
| A 視覺 | 0～1 × multimodal | 附圖 + recipe | 繁中畫面描述 | 否 |
| B 節拍 | 1 × text | SEASON、權威分鏡表、銜接、大綱、A 文字 | theme／arc／beat／bridge／anchor | **否** |
| C 台詞 | 1 × text | B 骨架 + 風格 guide | `bubbles[{speakerId,text}]` | **是** |
| D 臉錨 | 本機 YOLO | 分鏡圖 + 已知人數 | `face{x,y,source}` | 否 |

**權威順序**：`card.recipe`（場景／動作／情緒）＞ 視覺分析。  
**成本**：通常 **2** 次文字呼叫；recipe／圖不全時 +1 視覺；失敗 fallback 最多再 +1。

### 7.2 風格（`STORY_STYLES`）

| id | 標籤 | 作用層 |
|----|------|--------|
| `comedy` | 爆笑（預設） | 僅步驟 C |
| `taiwan_meme` | 台味迷因 | 僅步驟 C |
| `absurdist` | 無厘頭 | 僅步驟 C |
| `office` | 社畜日常 | 僅步驟 C |
| `scifi` | 科幻 | 僅步驟 C |

介面 `hint` 給用戶；`guide` 只進 LLM。步驟 B 禁止帶風格。

### 7.3 銜接與鐵律

- 全串像同一條日常／出遊動線；相鄰格 `anchor` 至少共用一詞。  
- 換場時 `bridge` 先寫中性銜接（非台詞），步驟 C 再壓成短句。  
- 無共同角色時，以同一天動線暗線串起。  
- 每格最多 **4** 氣泡（`MAX_BUBBLES_PER_PANEL`）；優先短句；`text` ≤ 16 繁中字（換場銜接可放寬至約 18）。  
- `speakerId` 必須為該格出場角色（`cindy`／`bob`／`david`／`elise`／**`me`**）。  
- 第 1 季語境：台灣日常；簽名裝；笑點來自排隊／熱／雨／飲料／搭錯車等。

### 7.3a 漫才人設與依格數節拍

人設來源：`character-bible.js`；組裝：`characterVoice.js`（`buildDialogueCraftBlock`）。  
**步驟 B** 只注入中性節拍結構；**步驟 C／多模態主路徑／後備** 注入完整「人設＋節拍」。

#### 角色發言邏輯

| 角色 | 漫才位 | 發言邏輯 |
|------|--------|----------|
| Elise | Boke 極致裝傻 | 理直氣壯軟爛；失敗怪宇宙／天氣；永遠最低能量解法 |
| Cindy | Tsukkomi 核心吐槽 | 冷靜高冷；職場黑話拆穿荒謬（多人時固定吐槽位） |
| Bob | Boke 反差裝傻 | 硬漢外表／怕痛脆弱；因極小災難內心崩潰 |
| David | Boke 時代落差 | 嚴肅長輩口吻做荒謬事、錯誤解釋年輕人事物 |
| **我（me）** | 現場反應 | 第一人稱日常吐槽／自嘲；不搶四角招牌，當場面催化劑 |

#### 依劇場格數

| 格數 | 策略 | 結構 |
|------|------|------|
| 1～2 | 極短篇迷因 | 01 Setup 荒謬現狀 → 02 Payoff 爆款台詞（直接 Punchline） |
| 3～4 | 日式漫才四段 | setup → escalation → climax → payoff（3 格則合併 escalation＋climax） |
| 5～20 | 波浪型動線 | 每 3～4 格一個小笑點循環串聯（例：夜市雨 → 超商躲雨 → 捷運回家）；禁止整篇只做一次起承轉合 |

任意卡牌組合：以「角色鮮明人設 ＋ 對應節拍」穩定產出對白。

### 7.4 人臉錨點與排版（Layer 4）

**Gemini 不負責 face 座標。** 臉錨點由本機 YOLOv8 animeface 提供（`scripts/animeface-worker.py` → `POST /__bw/detect-faces`）。

#### 嚴格挑選規則

1. 模型辨識圖中所有候選臉  
2. 以卡牌已知人數 N（`partySize`／`characterIds.length`）為上限  
3. 從候選中取**信心分數最高的 N 張**  
4. 再依左→右對應說話者（單說話者取信心最高那張）  

例：模型找到 4 張臉、卡上只有 2 人 → 只留信心最高的 2 張來擺對話框。

| 項目 | 說明 |
|------|------|
| 合成基準 | 1080×1440；預覽與匯出同一 `composePanelImage`／`paintBubblesOnImage` |
| 氣泡造型 | **無尾巴**白底圓角卡片（定案描邊／padding） |
| 手動 | `manualPos`；再生成保留 |
| 除錯 | 紅框／嘴巴標記預設關；`bwDebugBubbles=1` 才開 |
| 後備 | YOLO 失敗時用 heuristic 站位 |

### 7.5 輸出與容錯

步驟 B 結構示例：

```json
{
  "theme": "夜市雷陣雨一日遊",
  "arc": "從夜市吃到飽，午後暴雨，最後擠進超商門口躲雨。",
  "panels": [
    {
      "i": 1,
      "beat": "Cindy 在夜市點小吃，窄裙擠在人潮裡。",
      "bridge": "開場",
      "anchor": ["夜市", "小吃"],
      "suggestedSpeakerId": "cindy"
    }
  ]
}
```

步驟 C 結構示例：

```json
{
  "theme": "夜市雷陣雨一日遊",
  "panels": [
    {
      "i": 1,
      "bubbles": [
        { "speakerId": "cindy", "text": "這味道也太衝了吧" }
      ]
    }
  ]
}
```

（`face` 由步驟 D／前端 YOLO 附加，不依賴步驟 C。）

**容錯**：

- B 解析失敗 → 用各格 `recipe` 組最小骨架再進 C。  
- C 無有效台詞 → 單步後備 prompt（仍：分鏡表底層 + 風格最後）。  
- 最終仍無氣泡 → 前端可用純文字行切分後備（體驗降級）。

### 7.6 與卡池的關係

對白**不重新生圖**；只讀劇場卡片的 `recipe`／圖像做敘事。  
卡池來自總編輯 JSON → I2I；對白管線是創作當下的 Layer 3。

**畫面一致性**：劇場（非編輯）／最新／熱門預覽為 **Canvas 合成圖**（`ComposedPanelImage`），與匯出同一繪製路徑；編輯中／拖曳調位時用 overlay。

---

## 8. 技術規格

| 項目 | 規格 |
|------|------|
| 前端 | Vite 6 + React 18 + Tailwind 3 |
| 拖曳 | `@dnd-kit` |
| SDK | `@google/genai` |
| 圖像 | `gemini-3.1-flash-lite-image` |
| 文字 | `gemini-3.1-flash-lite` |
| 臉偵測 | 本機 YOLOv8 animeface（`/__bw/detect-faces`） |
| 分鏡比例 | **3:4**（合成基準 1080×1440） |
| 持久化 | IndexedDB `bubbleweave` |
| 金鑰 | `VITE_GEMINI_API_KEY`（`.env.example`） |

### 關鍵檔案

| 路徑 | 職責 |
|------|------|
| `src/data/character-bible.js` | 四角鎖定 |
| `src/lib/universalSlots.js` | 10 槽位與 weight |
| `src/lib/seasonChiefEditor.js` | 總編輯發想／多樣性 |
| `scripts/create-season.mjs` | 一鍵開季 CLI |
| `src/data/seasons/s1_taiwan.json` | 台灣篇季設定 |
| `src/lib/warehouse.js` | 肖像（只補缺）、總編輯 JSON 生圖入庫、每日獎勵 |
| `src/lib/gemini.js` | 生圖 I2I |
| `src/lib/storyGeneration.js` | 三階段／多模態對白 |
| `src/lib/characterVoice.js` | 漫才人設＋依格數節拍注入 |
| `src/lib/faceDetection.js` | YOLO 偵測＋依人數取 top-N confidence |
| `src/lib/speechBubble.js` | 氣泡排版／1080 合成 |
| `src/components/theater/PlayTheater.jsx` | 劇場流程 UX |
| `src/App.jsx` | 殼層、版本號、流程 |

---

## 9. 驗收清單

- [ ] `npm run create-season` 可產出 N 組 prompt（含 diversity）  
- [ ] 啟動倉庫可依總編輯 JSON 生出真實無字卡（無 placeholder）；比例 **3:4**  
- [ ] **升 `CARD_SCHEMA_VERSION` 重建場景卡時，既有 canonical icon 不重跑**  
- [ ] 畫風為 Ghibli Ink Keyframe；圖內無字、無對白框  
- [ ] 四角身份穩定（Cindy 無眼鏡、Bob 深灰膚＋啤酒肚等）  
- [ ] 劇場：放卡→對白→發布；編輯關 peek；有對白可直接拖位置；再生成保留 manualPos  
- [ ] AI 對白：recipe 驅動節拍；風格僅最後一步；臉錨由 YOLO 嚴格 top-N  
- [ ] 最新／匯出以主題為標題；故事串寬度自適應  
- [ ] 每日獎勵 3 張／24h；Like／Remix；匯出 JPEG／HTML  
- [ ] `npm run build`／`npm run dev` 可跑  

---

## 10. 文件地圖

| 文件 | 用途 |
|------|------|
| 本 PRD | 產品目標、架構、功能、技術總覽 |
| `CHARACTER_BIBLE.md` | 人物一致性與 icon |
| `CHARACTER_COMBOS.md` | 生圖組合／舊目錄細節（實作補充） |
| `README.md` | 快速開始 |

---

## 11. 與實作對照（2026-07-23）

| PRD 條款 | 實作狀態 | 備註 |
|----------|----------|------|
| 總編輯一鍵開季 | ✅ | `create-season` → season JSON |
| Canonical → I2I；場景卡 3:4 | ✅ | `gemini.js`／`warehouse.js` |
| icon 與場景卡解耦、升級保留 icon | ✅ | `needsWarehouseRebuild` 不因 portraitVersion 整批重跑 |
| 劇場三步流程＋直接拖位 | ✅ | `PlayTheater.jsx` |
| 再生成保留 manualPos | ✅ | `App.jsx` `mergeManualBubblePositions` |
| YOLO 臉錨 top-N by confidence | ✅ | `faceDetection.js` v6 |
| 無尾巴氣泡、1080×1440 | ✅ | `speechBubble.js` |
| 社群／匯出主題優先 | ✅ | `storyMeta.js`／feed／export |
| 故事串自適應欄數 | ✅ | `MangaStripView`＋`getAdaptiveMangaCols` |
| Gemini 回傳 face | ❌ 已廢棄 | 改 YOLO；舊 PRD 敘述已刪 |
| 9:16 場景卡 | ❌ 已改 3:4 | |
| 個人第 5 角＋上傳轉繪 | ✅ | `ProfileCard`／`generatePlayerPortraitFromPhoto` |
| 每日 3 張皆含我＋翻卡 | ✅ | `claimDailyCards` requirePlayer |
| 稀有度 5 級×3 套標誌 | ✅ | `rarity.js`／`RarityBadge`；匯出帶標 |
