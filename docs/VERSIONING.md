# BubbleWeave 版本管理

## 現況一覽

| | v1.0-stable | v2.0-dev |
|--|-------------|----------|
| Git | tag `v1.0-stable`；歷史在 `master` | 分支 `feat/v2-rewrite` |
| PRD | [`PRD_v1.md`](./PRD_v1.md) | [`PRD_v2.md`](./PRD_v2.md) |
| IndexedDB | `bubbleweave` | `bubbleweave.v2` |
| 用途 | 鎖定的好用版本，可隨時回退 | 大改實驗，不覆寫 v1 本機資料 |

遠端：`https://github.com/humtersiso/BubbleWeave.git`

## 日常指令

```bash
# 回到 v1 定案
git checkout v1.0-stable

# 繼續 v2 大改
git checkout feat/v2-rewrite

# 只修 v1（從 tag 開 hotfix）
git checkout -b hotfix/v1-xxx v1.0-stable
```

## 資料隔離

- v1 App（`v1.0-stable`／舊 `master` 程式）→ DB 名 `bubbleweave`
- v2 App（`feat/v2-rewrite`）→ DB 名 `bubbleweave.v2`（見 `src/lib/storage.js`）

同一瀏覽器可同時留著兩套倉庫／故事，互不洗庫。

## 合入策略（建議）

1. v2 在 `feat/v2-rewrite` 做到可 demo  
2. PR 合進 `master` 時視為 **2.0.0** 破壊性發佈  
3. 發 Release／tag `v2.0.0`，Changelog 註明 IndexedDB 為 `bubbleweave.v2`  
4. 若需從 v1 匯入，另開「匯入工具」任務，不要 silent migrate  

## App 版號常數

`src/lib/appVersion.js`：`APP_RELEASE`、`APP_CHANNEL`（`stable`｜`v2-dev`）。
