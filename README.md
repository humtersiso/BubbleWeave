# 織泡劇場 · BubbleWeave

圖文故事創意社群平台：以**吉卜力黑白動畫原畫**卡牌排列故事，支援手動／AI 對白，並透過 Remix 傳播。

## 文件

| 文件 | 內容 |
|------|------|
| [`docs/BubbleWeave_PRD.md`](docs/BubbleWeave_PRD.md) | 產品 PRD（與現況同步） |
| [`docs/CHARACTER_COMBOS.md`](docs/CHARACTER_COMBOS.md) | 生圖 PRD（季包／組合／prompt） |
| [`docs/CHARACTER_BIBLE.md`](docs/CHARACTER_BIBLE.md) | 四角人物規格 |

## 版面（現行）

- **上**：織泡劇場（排卡、AI／手動劇本、預覽）＋社群頁籤（熱門／最新）
- **下**：倉庫全寬
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

### 對話框臉座標

- Gemini **只**生圖／對白，不回傳 face
- 編輯／AI 生成／合成時，呼叫本機 [yolov8_animeface](https://github.com/Fuyucch1/yolov8_animeface)（`POST /__bw/detect-faces`）取得臉座標再排氣泡
- 需已安裝 Python + `ultralytics`，且 `models/yolov8x6_animeface.pt` 存在

## 資料持久化

卡牌為 base64 圖像，無法放進 `localStorage`，改以 IndexedDB（`bubbleweave`）儲存倉庫、故事與每日領取時間。重整瀏覽器不會丟資料。

## 人物／畫風變更

- **場景卡**結構／比例變更：提高 `src/App.jsx` 的 `CARD_SCHEMA_VERSION` → 只重建場景卡，**沿用現有角色 icon**
- **角色 icon**：視為定案；升級靈感池**不會**整批重跑。若真要重做，請清除 IndexedDB 的 `portraits` 後再啟動（只會補缺的那幾張）
- `PORTRAIT_VERSION` 僅簿記，不強制重跑肖像

## 驗收對照

詳見 [`docs/BubbleWeave_PRD.md`](docs/BubbleWeave_PRD.md) §9。精簡版：

- `create-season` 一鍵產季 prompt；倉庫可依總編輯 JSON 生圖
- 畫風為 Ghibli Ink Keyframe；每日獎勵 3 張／24h
- 劇場：排序、手動／AI 對白、發布；前端疊加對白
- Like／Remix；可匯出 JPEG／HTML
- `npm run build`／`npm run dev` 可跑
