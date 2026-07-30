# BubbleWeave 分享 API（GCP）

專案：`gen-lang-client-0927009312`（data team test）  
區域：`asia-east1`  
函式：`bubbleweave-share`  
Bucket：`gen-lang-client-0927009312-bw-share`  
Firestore：`(default)` collection `share_links` / subcollection `claims`

## 防刷

每條分享連結最多兌換 **5** 次；同一 claimer 同一連結只能 1 次；禁止自兌。

## 端點

| Method | Path | 說明 |
|--------|------|------|
| GET | `/health` | 健康檢查 |
| POST | `/create` | body: `{ ownerId, cardPayload }` |
| GET | `/share/:code` | 讀取連結 |
| POST | `/redeem` | body: `{ shareCode, claimerId, claimerCardPayload }` |
| GET | `/incoming/:ownerId` | 分享方拉取別人留下的卡 |

正式 URL：

```text
https://asia-east1-gen-lang-client-0927009312.cloudfunctions.net/bubbleweave-share
```

前端 `.env`：

```bash
VITE_SHARE_API_URL=https://asia-east1-gen-lang-client-0927009312.cloudfunctions.net/bubbleweave-share
```

## 重新部署

```bash
gcloud config set project gen-lang-client-0927009312
gcloud functions deploy bubbleweave-share \
  --gen2 \
  --runtime=nodejs20 \
  --region=asia-east1 \
  --source=gcp/share-api \
  --entry-point=shareApi \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=120s \
  --memory=512Mi \
  --set-env-vars="BW_SHARE_BUCKET=gen-lang-client-0927009312-bw-share,BW_MAX_REDEEMS=5,GCP_PROJECT=gen-lang-client-0927009312"
```
