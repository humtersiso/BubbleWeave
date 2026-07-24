# BubbleWeave（織泡劇場）── 產品需求說明書 (PRD) · **v2（大改進行中）**

> **版本**：v2.0-dev  
> **Git 分支**：`feat/v2-rewrite`  
> **狀態**：草稿／實驗 — 與 [`PRD_v1.md`](./PRD_v1.md)（tag `v1.0-stable`）並存  
> **本機資料**：IndexedDB **`bubbleweave.v2`**（與 v1 的 `bubbleweave` 隔離，互不覆寫）

---

## 0. 版本管理約定

| 項目 | v1（穩定） | v2（本分支） |
|------|------------|--------------|
| Git | tag `v1.0-stable`、`master` | 分支 `feat/v2-rewrite` |
| PRD | [`PRD_v1.md`](./PRD_v1.md) | 本檔 |
| IndexedDB | `bubbleweave` | `bubbleweave.v2` |
| 目標 | 可 demo、可回退 | 大改實驗，合進 master 前需可驗收 |

回退 v1：`git checkout v1.0-stable`（或 `master` 在合入 v2 前）。

---

## 1. v2 目標（待填）

> 在此寫大改的北極星與範圍。v1 能力預設**先視為可繼承**，破壊性變更需在下方列出。

### 1.1 計畫中的大改（placeholder）

- [ ] （例）產品流程／版面重構  
- [ ] （例）資料模型或角色體系調整  
- [ ] （例）社群／帳號／後端  

### 1.2 相對 v1 的破壊性變更

| 變更 | 影響 | 遷移策略 |
|------|------|----------|
| IndexedDB 改名 `bubbleweave.v2` | 本機從空庫開始 | 未來可做 v1→v2 匯入工具（可選） |

---

## 2. 繼承自 v1（暫時視為仍適用）

在 v2 定案前，細節以 [`PRD_v1.md`](./PRD_v1.md) 為準，包括：

- 總編輯開季、Canonical → I2I、3:4／1080×1440  
- 劇場放卡→對白→發布、YOLO 臉錨、無尾巴氣泡  
- 第 5 角 `me`、每日三張皆含我、稀有度五級×三套標誌  

v2 若推翻上述條款，請在本檔明確改寫，並更新驗收清單。

---

## 3. 驗收（v2）

- [ ] `npm run dev` 寫入／讀取的是 `bubbleweave.v2`，不清掉使用者瀏覽器裡的 v1 庫  
- [ ] tag `v1.0-stable` 仍可 checkout 並跑通  
- [ ] （大改完成後補齊功能驗收）  

---

## 4. 文件地圖

| 文件 | 用途 |
|------|------|
| [`PRD_v1.md`](./PRD_v1.md) | v1 凍結規格 |
| 本檔 | v2 大改規格 |
| [`BubbleWeave_PRD.md`](./BubbleWeave_PRD.md) | 指向目前「預設閱讀」的 PRD（v2 開發中指向本檔說明） |
| [`VERSIONING.md`](./VERSIONING.md) | Git／DB／發佈約定 |
