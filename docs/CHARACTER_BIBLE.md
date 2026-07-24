# BubbleWeave 人物誌（規格文件）

> **唯一程式來源**：[`src/data/character-bible.js`](../src/data/character-bible.js)  
> **產品 PRD**：[`BubbleWeave_PRD.md`](./BubbleWeave_PRD.md)  
> **角色情境組合／生圖 PRD**：[`CHARACTER_COMBOS.md`](./CHARACTER_COMBOS.md)  
> **畫風**：吉卜力黑白動畫原畫（Ghibli Ink Keyframe）— 詳見產品 PRD §2.2

## 平台設計原則

1. **人物鎖定臉孔**：Cindy / Bob / David / Elise（四位）  
2. **場景不綁人物**：任何人可出現在任何場景  
3. **人數是獨立參數**：1 / 2 / 3 / 4 人同框  
4. **倉庫 icon**：僅人臉特寫、**純白背景 #FFFFFF**、圓形對齊裁切  
5. **劇場**：角色可自由混搭穿插  
6. **季包只換場景／動作**：第 1 季＝台灣篇；角色簽名裝跨季不變（夜市／海邊／雨天也不換裝）  

詳見 [`CHARACTER_COMBOS.md`](./CHARACTER_COMBOS.md)。

## 五大抵一致性特徵

```
appearance = [HEIGHT & SCALE] + [FACE] + [HAIR] + [BODY] + [OUTFIT]
```

| 區塊 | 用途 | 寫法 |
|------|------|------|
| HEIGHT & SCALE | 身高與相對比例 | 用 cm；標明與其他人比較 |
| FACE | 臉型與骨相 | 瓜子／方臉／圓臉等可驗證骨相 |
| HAIR | 髮型細節 | 長度、分線、禿頭、顏色 |
| BODY | 身材結構 | 體重級距＋輪廓（啤酒肚／纖細等） |
| OUTFIT | 剪影服裝 | 每格不變的簽名裝 |

## 組合公式

```
卡牌 = 人數(1|2|3|4) × 人物 × 場景 × 動作 × 情緒
```

詳見 [`CHARACTER_COMBOS.md`](./CHARACTER_COMBOS.md)。

## 四位角色

| ID | 名 | 年齡 | 人設 | 體型 | 服裝簽名 |
|----|----|------|------|------|----------|
| cindy | Cindy | 25 | 日本 OL | 約 50kg 纖細優雅 | OL 黑色套裝 |
| bob | Bob | 40 | 混混大隻佬 | 約 120kg＋巨大啤酒肚 | 骷髏頭黑 T＋牛仔褲 |
| david | David | 55–60 | 老派退休 | 約 65kg 適中略老態 | 格子襯衫＋黑粗框眼鏡 |
| elise | Elise | 30–35 | 宅女 | **約 65～70kg，微微胖** | 膝長寬白 T＋夾腳拖＋圓框眼鏡；**東亞淺膚，絕非黑人** |

### 漫才分工與發言邏輯（對白 Layer 3）

程式欄位：`comedyRole`／`comedyRoleZh`／`voiceLogic`／`sampleLines`（`character-bible.js`）  
注入：`src/lib/characterVoice.js` → `storyGeneration.js` 對白 prompt。

| 角色 | 漫才位 | 核心性格與反差 | 經典語氣（勿照抄） |
|------|--------|----------------|-------------------|
| Elise | 極致裝傻（Boke） | 理直氣壯軟爛；失敗怪宇宙／天氣；永遠選最擺爛解法 | 「別叫我。白 T 還沒洗。」／「眼鏡霧了？那就不看世界了。」 |
| Cindy | 核心吐槽（Tsukkomi） | 理性強迫症／高冷；開會職場黑話拆穿荒謬 | 「這不是生化武器，這只是臭豆腐。」／「你的離職申請被這雙腿駁回了。」 |
| Bob | 反差裝傻（Boke） | 120kg 硬漢外表／內心少女怕痛；因極小災難崩潰 | 「這不是啤酒肚，這是防撞氣墊！」／「救命...這章魚燒比我還硬！」 |
| David | 時代落差裝傻（Boke） | 極度認真做荒謬事；嚴肅語氣誤解年輕人事物 | 「現在年輕人的捷運...開得真快啊。」／「宇宙剛剛用這張刮刮樂提醒我該回家了。」 |

多人同框：**Cindy 固定核心吐槽**；其餘 Boke 丟包袱。單人則用該角色人設把災難講完（仍要反差）。

### 依格數的對白節拍

| 格數 | 策略 | 節拍 |
|------|------|------|
| 1～2 | 極短篇迷因 | Setup → Payoff（直接 Punchline） |
| 3～4 | 日式漫才四段 | setup → escalation → climax → payoff |
| 5～20 | 波浪型動線 | 每 3～4 格一個小笑點循環，多小波串聯 |

詳見產品 PRD §7.3a。

## Icon 規格

- 構圖：臉部特寫（下巴到頭頂），置中  
- 背景：純白 `#FFFFFF`，無漸層、無場景  
- UI：圓形裁切、灰階線稿顯示、列對齊  
- `faceAppearance` 必須與 `appearance` 的 FACE／HAIR 一致  

## 改完人物誌之後

1. 編輯 `src/data/character-bible.js`  
2. 提高 `CARD_SCHEMA_VERSION` / `PORTRAIT_VERSION`（或清 IndexedDB `bubbleweave`）  
3. 重整頁面重產肖像與卡牌  
