# BubbleWeave 角色情境組合說明（生圖 PRD）

> 產品總覽：[`BubbleWeave_PRD.md`](./BubbleWeave_PRD.md)  
> 程式來源：
> - 人物：[`src/data/character-bible.js`](../src/data/character-bible.js)（跨季不變）
> - 季包配方：[`src/lib/cardRecipes.js`](../src/lib/cardRecipes.js)
> - 匯出層：[`src/lib/casts.js`](../src/lib/casts.js)
> - 風格鎖：`SCENE_STYLE_BIBLE`／`PORTRAIT_STYLE_BIBLE`（cardRecipes）＋ `STYLE_LOCK`（gemini.js）

---

## 產品季包策略

| 季 | 主題 | 狀態 |
|----|------|------|
| **第 1 季** | **台灣篇** | ✅ 目前 |
| 第 2 季（預告） | 社畜辦公室與摸魚災難 | 之後只換場景／動作池 |

**為什麼這樣切季？**

1. **維護極簡**：角色簽名裝鎖定，不必另產「在地服裝版」參考圖  
2. **迷因感**：西裝／骷髏 T／宅 T 闖夜市、躲雷陣雨、擠捷運，畫面自帶笑點  
3. **擴充性**：換季只改 `SCENES` / `ACTIONS` / `SEASON`，不動 character-bible  

---

## 1. 組合公式

```
卡牌 = 人數(1|2|3|4) × 角色 × 場景 × 動作 × 情緒
```

- **人物不綁場景**：任何人可出現在任何台灣場景  
- **服裝永不換**：夜市、海邊、廟口、雨裡仍穿簽名裝（傘／飲料可當道具）  
- **劇場排版**：角色可自由混搭  

---

## 2. 四位角色（跨季）

詳見 [`CHARACTER_BIBLE.md`](./CHARACTER_BIBLE.md)。一致性公式：

```
[HEIGHT & SCALE] + [FACE] + [HAIR] + [BODY] + [OUTFIT]
```

| ID | 服裝簽名（台灣場景仍穿這套） | 易錯硬鎖 |
|----|------------------------------|----------|
| cindy | OL 黑色套裝（西裝外套／窄裙或西裝褲） | **無眼鏡**；長直黑髮過肩 |
| bob | 骷髏頭黑色 T 恤、牛仔褲 | **深灰膚**＋巨大啤酒肚；光頭＋鬍 |
| david | 格子襯衫、西裝褲、黑粗框眼鏡 | 厚黑**方框**眼鏡 |
| elise | 寬大至膝蓋的白 T 恤、夾腳拖鞋、圓框眼鏡 | 厚**圓框**眼鏡；凌亂齊肩髮；**東亞淺膚（非黑人）** |

---

## 3. 第一季：台灣場景（22）

每個場景有 `allowedActions`（群組綁定主池）。抽樣見 §4.1。

| ID | 中文 | 主池動作（節錄） |
|----|------|------------------|
| night_market | 台灣夜市巷弄 | 雞排／點小吃／剉冰／珍奶 |
| taipei_101 | 台北101廣場 | 打卡失敗／地圖迷路／撐傘／珍奶 |
| temple_courtyard | 廟宇廣場 | 香煙嗆到／擲筊／鞠躬跌倒 |
| mrt_platform | 捷運月台 | 門縫硬擠／搭錯方向／尖峰擠／悠遊卡 |
| mrt_car | 捷運車廂內 | 抓吊環／急煞／坐過站／讓座／靠窗睡 |
| bus_stop | 市區公車站 | 招錯公車／排隊／悠遊卡／撐傘 |
| bus_interior | 公車車廂內 | 抓吊環／按下車鈴／坐過站／讓座 |
| convenience_tw | 便利商店門口 | **萬用卡**（枝仔冰／珍奶／撐傘／滑手機等） |
| rainy_arcade | 午後雷陣雨騎樓 | **撐傘**／傘翻／踩積水／機車濺水 |
| humid_rooftop | 悶熱頂樓水塔 | 搧風／擦汗／貼冷氣／吃冰／珍奶 |
| breakfast_shop | 台式早餐店 | **吃蛋餅**／喝豆漿／邊走邊啃 |
| bubble_tea_shop | 手搖飲店門口 | **喝珍奶**／戳杯蓋／吸珍珠／疊杯 |
| ubike_lane | 河濱 YouBike 車道 | **騎 YouBike**／騎到晃／還車卡住 |
| jiufen_alley | 九份山城老街 | 陡階滑／閃燈籠／撐傘／蛋餅 |
| kenting_beach | 墾丁海邊 | 倒沙／被浪追／**剉冰**／珍奶 |
| sun_moon_lake | 日月潭碼頭 | 船上晃／**騎 YouBike**／珍奶 |
| ximending | 西門町步行區 | 人潮轉圈／**雞排**／珍奶／撐傘 |
| temple_fair | 廟會遶境街頭 | 鞭炮嚇跳／閃神轎／摀耳 |
| scooter_alley | 巷弄機車陣 | 鑽車縫／安全帽卡住／撐傘／珍奶 |
| hsr_platform | 高鐵月台 | 衝刺趕車／行李炸開／靠窗睡／坐過站 |
| yangming_trail | 陽明山步道 | 硫磺味／山霧迷路／撐傘 |
| park_banyan | 公園大榕樹下 | 熱癱／剉冰／珍奶／YouBike |

---

## 4. 第一季：動作池

### 4.1 場景 ↔ 動作關聯（重要）

**會有關聯，而且必須過濾。**  
例如：夜市不能抽到高鐵衝刺；捷運月台不該出現海上衝浪動作。

實作策略（`cardRecipes.js` + `universalSlots.js` + `seasonCatalog.js`）：

| 機制 | 說明 |
|------|------|
| **10 通用槽位** | 跨季骨架；`pickSceneByUniversalSlot` 先抽槽位再抽場景 |
| **槽位權重** | `STREET_FOOD`、`LANDMARK_SPOT` = 28（最高）；`ACCOMMODATION`、`ENTERTAINMENT` = 4（最低） |
| **場景權重** | 槽內第二層：`pickWeighted` 於該槽的在地場景 |
| **動作權重** | 主池／萬用池內 `action.weight` |
| **群組綁定** | `allowedActions[]`（90%） |
| **萬用微跨界** | `SCENE_ACTION_CROSSOVER_RATE = 0.1` |
| **硬擋** | `isCompatible` |

**現況摘要（2026-07-21）**：兩段抽樣「槽位 → 場景」已上線；動作仍為場景主池＋萬用池。完整表見 [`BubbleWeave_PRD.md` §2.5～2.6](./BubbleWeave_PRD.md)。

**BigQuery**：`universal_slot_id`、`slot_weight` 見 `bqCatalog.js`。

萬用動作（可跨場景的合理笑點）：

`peeking_phone` · `fanning_heat` · `wiping_sweat` · `holding_umbrella` · `umbrella_chaos` · `sarcastic_clap`

> 專項動作（擲筊、捷運硬擠、神轎…）**只**能出現在對應場景主池，不會經由 10% 跨界跑出去。

抽樣流程：`加權抽 10 槽位 → 槽內加權抽場景 → pickActionForScene → 情緒 → isCompatible`。

### 4.2 動作一覽（節錄）

| ID | 中文 | 群組 |
|----|------|------|
| peeking_phone | 偷偷滑手機 | **萬用** |
| fanning_heat | 悶熱猛搧風 | **萬用** |
| wiping_sweat | 擦不完的汗 | **萬用** |
| holding_umbrella | 撐著雨傘走路 | **萬用** |
| umbrella_chaos | 雨傘被風吹翻 | **萬用** |
| sarcastic_clap | 諷刺慢動作鼓掌 | **萬用** |
| riding_ubike | 騎 YouBike | 單車 |
| drinking_bubble_tea | 喝珍珠奶茶 | 飲食 |
| eating_chicken_cutlet | 大口咬雞排 | 夜市 |
| eating_shaved_ice | 吃剉冰／冰品 | 飲食 |
| eating_egg_pancake | 在早餐店吃蛋餅 | 飲食 |
| ordering_street_food | 興奮點夜市小吃 | 夜市 |
| stinky_tofu_recoil | 臭豆腐味衝臉 | 夜市 |
| tourist_selfie_fail | 打卡自拍失敗 | 景點 |
| incense_smoke_cough | 被香煙嗆到 | 廟 |
| throwing_poe | 擲筊亂飛 | 廟 |
| door_squeeze | 捷運門縫硬擠 | 交通 |
| holding_overhead_strap | 抓吊環站著 | 車廂 |
| standing_sway | 急煞站不穩 | 車廂 |
| rush_hour_compress | 尖峰時刻擠成一團 | 交通 |
| missed_stop_panic | 坐過站驚慌 | 車廂 |
| bus_card_tap_fail | 悠遊卡刷不過 | 交通 |
| wrong_bus_wave | 招錯公車 | 公車站 |
| bus_bell_reach | 伸手按下車鈴 | 公車 |
| sprint_to_gate | 衝刺趕車門 | 交通 |
| sipping_soy_milk | 喝熱豆漿 | 飲食 |
| straw_stab_seal | 吸管戳杯蓋 | 飲食 |
| puddle_splash | 踩進超深積水 | 天氣 |
| scooter_splash_victim | 被機車濺一身水 | 天氣 |
| steep_stair_slip | 陡階差點滑倒 | 老街 |
| wave_chase_run | 被海浪追著跑 | 海岸 |
| scooter_weave | 鑽機車縫 | 巷弄 |
| sulfur_smell_face | 硫磺味皺臉 | 自然 |

完整清單以 `src/lib/cardRecipes.js` 的 `ACTIONS` 為準。

約略組合：`20 場景 ×（主池 3～6 ＋ 萬用）× 12 情緒 × 人數` → 仍遠超百種，但不會出現場景道具衝突。

---

## 5. 人數權重

| 人數 | 權重 |
|------|------|
| 1 人 | 55 |
| 2 人 | 30 |
| 3 人 | 10 |
| 4 人 | 5 |

啟動倉庫預設 **21 張**。

---

## 6. Prompt 組裝（Phase 2）

### 6.1 全域畫風（現行）

**吉卜力黑白動畫原畫風** — 標籤：`[GLOBAL STYLE - GHIBLI INK LINEART]`

```
Classic Studio Ghibli keyframe animation style, Miyazaki-inspired character design,
hand-drawn Japanese anime line art, expressive animation frame layout,
clean dark ink outlines, crisp high contrast, zero faint pencil smudges,
crisp white background, no text, no speech bubbles.
```

附加約束：單格原畫、無多格頁／粗框；Bob 深灰膚不可空白紙臉；黑白 only。

### 6.2 場景卡組裝骨架

```
[GLOBAL STYLE - GHIBLI INK LINEART]
…SCENE_STYLE_BIBLE…

[CHARACTER IDENTITY …]
簽名卡／防換臉／檢查清單（characterIdentity.js）
OUTFIT STRICTLY LOCKED — keep signature clothes in every Taiwan scene

[SCENE & ACTION]
Location: ${scene.promptKeywords}
Action: ${name} is ${action.prompt}, featuring ${action.propPrompt}.
Emotion: …
```

實作：`composePrompt()` in `cardRecipes.js`；肖像用 `buildFacePortraitPrompt()` + `PORTRAIT_STYLE_BIBLE`。

---

## 7. 換季 checklist

1. 改 `SEASON` 標題與 id  
2. 換成新 `SCENES` / `ACTIONS`（記得填每場景 `allowedActions`，必要時更新 `UNIVERSAL_ACTION_IDS`）  
3. 提高 `CARD_SCHEMA_VERSION`（場景卡重建）；**改畫風或臉孔**時一併提高 `PORTRAIT_VERSION`  
4. 更新本文件與 [`BubbleWeave_PRD.md`](./BubbleWeave_PRD.md) §2.2  

> 閱讀本文件不會觸發重建；重整頁面且版本號提高後才會重產倉庫卡。
