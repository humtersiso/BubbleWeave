# BubbleWeave（織泡）── PRD 入口

> **目前預設開發線**：v2（[`PRD_v2.md`](./PRD_v2.md)，分支 `feat/v2-rewrite`）  
> **穩定凍結規格**：v1（[`PRD_v1.md`](./PRD_v1.md)，tag `v1.0-stable`）  
> **版本約定**：[`VERSIONING.md`](./VERSIONING.md)

舊檔名 `BubbleWeave_PRD.md` 保留為入口，避免連結失效。完整條款請讀對應版本 PRD。

---

## 金鑰與機密（重要）

**API Key 只放本機 `.env`，絕對不要寫進本檔、PRD、README，也不要 `git add`／push。**

| 變數 | 用途 | 取得 |
|------|------|------|
| `VITE_GEMINI_API_KEY` | 轉繪、對白、個性標籤 | [Google AI Studio](https://aistudio.google.com/apikey) |
| `VITE_SHARE_API_URL` | （可選）分享／限次兌換 API | 見 [`gcp/README.md`](../gcp/README.md) |

專案已在 `.gitignore` 忽略 `.env`。範本請複製：

```bash
cp .env.example .env
# 只在本機 .env 填真實金鑰與 API URL
```

若金鑰曾貼到聊天室、截圖或誤 commit，請到 AI Studio **作廢並重開一把新 key**。

---

## 分享後端用什麼？

v2 用 **GCP**（專案 `gen-lang-client-0927009312`／data team test）：

- **Cloud Functions**：產生連結、兌換、查剩餘次數  
- **Firestore**：記每條連結兌了幾次（上限 **5**）  
- **Cloud Storage**：存卡圖（不把大圖塞進資料庫）

沒填 `VITE_SHARE_API_URL` 時，App 會用本機 `local-` 碼（同瀏覽器可測）；真要跨手機互測，把函式 URL 寫進 `.env` 即可。
