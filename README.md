# 織泡劇場 · BubbleWeave

圖文故事創意社群平台：以**吉卜力黑白動畫原畫**卡牌排列故事，支援手動／AI 對白，並透過 Remix 傳播。

## 版本（重要）

| 線 | Git | PRD | IndexedDB |
|----|-----|-----|-----------|
| **v1 穩定** | tag [`v1.0-stable`](https://github.com/humtersiso/BubbleWeave/releases/tag/v1.0-stable) | [`docs/PRD_v1.md`](docs/PRD_v1.md) | `bubbleweave` |
| **v2 大改（目前預設分支）** | `feat/v2-rewrite` | [`docs/PRD_v2.md`](docs/PRD_v2.md) | `bubbleweave.v2` |

約定詳見 [`docs/VERSIONING.md`](docs/VERSIONING.md)。

```bash
# 跑穩定 v1
git checkout v1.0-stable && npm install && npm run dev

# 跑 v2 實驗（不覆寫 v1 本機庫）
git checkout feat/v2-rewrite && npm install && npm run dev
```

## 文件

| 文件 | 內容 |
|------|------|
| [`docs/VERSIONING.md`](docs/VERSIONING.md) | Git／DB／發佈約定 |
| [`docs/PRD_v1.md`](docs/PRD_v1.md) | v1 凍結 PRD |
| [`docs/PRD_v2.md`](docs/PRD_v2.md) | v2 大改 PRD（草稿） |
| [`docs/CHARACTER_COMBOS.md`](docs/CHARACTER_COMBOS.md) | 生圖組合 |
| [`docs/CHARACTER_BIBLE.md`](docs/CHARACTER_BIBLE.md) | 四角人物規格 |

## 版面（v1／現行體驗）

- **上**：個人卡＋織泡劇場＋社群（熱門／最新）  
- **下**：靈感池全寬  
- **浮層**：每日獎勵、故事記錄、發布／匯出  

## 快速開始

```bash
cp .env.example .env
# 編輯 .env，填入 VITE_GEMINI_API_KEY
npm install
# 下載 YOLOv8 動漫臉模型（Fuyucch1/yolov8_animeface，約 186MB）
python scripts/export-animeface-onnx.py
npm run dev
```

金鑰請至 [Google AI Studio](https://aistudio.google.com/apikey) 申請。**切勿**把真實金鑰提交到 git。

Repo：<https://github.com/humtersiso/BubbleWeave>

### 對話框臉座標

- Gemini **只**生圖／對白，不回傳 face
- 編輯／AI 生成／合成時，呼叫本機 [yolov8_animeface](https://github.com/Fuyucch1/yolov8_animeface)（`POST /__bw/detect-faces`）取得臉座標再排氣泡
- 需已安裝 Python + `ultralytics`，且 `models/yolov8x6_animeface.pt` 存在

## 資料持久化

- v1：IndexedDB `bubbleweave`
- v2：IndexedDB `bubbleweave.v2`（與 v1 並存）

## 人物／畫風變更（v1 規則）

- **場景卡**：提高 `CARD_SCHEMA_VERSION` → 只重建場景卡，沿用既有角色 icon  
- **角色 icon**：不因升級整批重跑；缺才補  
- `PORTRAIT_VERSION` 僅簿記  

## 驗收對照

詳見對應版 PRD。精簡版：

- `create-season` 一鍵產季 prompt；倉庫可依總編輯 JSON 生圖  
- 劇場：排序、手動／AI 對白、發布；前端疊加對白  
- Like／Remix；可匯出 JPEG／HTML  
- `npm run build`／`npm run dev` 可跑  
