# 籤語 · KujiWords

**v2（預設）**：個人 2D 化身 × 台灣籤詩運勢分享（直式手機主流程）。  
**v1（凍結）**：吉卜力墨線劇場排卡＋社群 Remix（見 tag `v1.0-stable`，產品名 BubbleWeave）。

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
| [`docs/PRD_v2.md`](docs/PRD_v2.md) | v2 籤詩運勢 PRD（定案） |
| [`docs/CHARACTER_COMBOS.md`](docs/CHARACTER_COMBOS.md) | 生圖組合 |
| [`docs/CHARACTER_BIBLE.md`](docs/CHARACTER_BIBLE.md) | 四角人物規格 |

## 版面（v2 · 目前預設）

- **主線**：直式五步籤詩（上傳 → 2D／測驗 → 抽籤 → 對白 → 分享）
- **懸浮**：圖庫／個人／歷史
- **雲端**：GCP Firestore／Cloud Functions 分享互兌（見 `gcp/`）

## 版面（v1 · tag `v1.0-stable`）

- **上**：個人卡＋織泡劇場＋社群（熱門／最新）  
- **下**：靈感池全寬  
- **浮層**：每日獎勵、故事記錄、發布／匯出  

## 快速開始

```bash
cp .env.example .env
# 編輯 .env：VITE_GEMINI_API_KEY（必要）
# 可選：VITE_SHARE_API_URL（GCP 分享 API；未設則用本機 local 分享碼）
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

詳見對應版 PRD。v2 精簡版：

- 直式主流程五步可跑通；懸浮圖庫／個人／歷史
- 臉防呆；2D＋個性標籤；籤等六檔；對白可選／自填；3:4＋9:16 匯出
- GCP 互兌防刷：每連結最多 5 次（或本機 local 碼 fallback）
- `npm run build`／`npm run dev` 可跑  
