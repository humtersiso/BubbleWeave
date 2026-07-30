/**
 * BubbleWeave v2 分享 API（Firestore + GCS）
 * 防刷：每條連結最多兌換 MAX_REDEEMS 次；同一 claimer 同一連結只能兌 1 次；禁止自兌。
 */
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const functions = require('@google-cloud/functions-framework');

const PROJECT_ID = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0927009312';
const BUCKET = process.env.BW_SHARE_BUCKET || 'gen-lang-client-0927009312-bw-share';
const MAX_REDEEMS = Number(process.env.BW_MAX_REDEEMS || 5);

const db = new Firestore({ projectId: PROJECT_ID });
const storage = new Storage({ projectId: PROJECT_ID });

const cors = (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
};

const createCode = () =>
  Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);

const parseDataUrl = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  return { mimeType: m[1], buffer: Buffer.from(m[2], 'base64') };
};

const extFromMime = (mime) => {
  if (String(mime).includes('png')) return 'png';
  if (String(mime).includes('webp')) return 'webp';
  return 'jpg';
};

async function uploadImage(dataUrl, pathPrefix) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    // 已經是 http(s) URL
    if (/^https?:\/\//i.test(String(dataUrl || ''))) return String(dataUrl);
    return null;
  }
  const ext = extFromMime(parsed.mimeType);
  const objectPath = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const file = storage.bucket(BUCKET).file(objectPath);
  await file.save(parsed.buffer, {
    contentType: parsed.mimeType || 'image/jpeg',
    resumable: false,
    metadata: { cacheControl: 'public, max-age=31536000' },
  });
  return `https://storage.googleapis.com/${BUCKET}/${objectPath}`;
}

async function sanitizeCardPayload(payload, pathPrefix) {
  const card = { ...(payload || {}) };
  if (card.imageUrl) {
    const url = await uploadImage(card.imageUrl, pathPrefix);
    if (url) card.imageUrl = url;
    else delete card.imageUrl;
  }
  // 避免意外塞超大欄位
  delete card.rawPhotoUrl;
  delete card.portraitUrl;
  return card;
}

functions.http('shareApi', async (req, res) => {
  if (cors(req, res)) return;

  try {
    const path = String(req.path || '/').replace(/\/+$/, '') || '/';

    // POST /create
    if (req.method === 'POST' && (path === '/create' || path.endsWith('/create'))) {
      const { ownerId, cardPayload } = req.body || {};
      if (!ownerId || !cardPayload) {
        res.status(400).json({ ok: false, reason: '缺少 ownerId 或 cardPayload' });
        return;
      }
      let code = createCode();
      let ref = db.collection('share_links').doc(code);
      for (let i = 0; i < 5; i += 1) {
        const snap = await ref.get();
        if (!snap.exists) break;
        code = createCode();
        ref = db.collection('share_links').doc(code);
      }
      const clean = await sanitizeCardPayload(cardPayload, `shares/${code}`);
      await ref.set({
        ownerId: String(ownerId),
        cardPayload: clean,
        redeemCount: 0,
        maxRedeems: MAX_REDEEMS,
        createdAt: FieldValue.serverTimestamp(),
      });
      res.status(200).json({ ok: true, code, maxRedeems: MAX_REDEEMS });
      return;
    }

    // GET /share/:code
    const shareMatch = path.match(/\/share\/([^/]+)$/);
    if (req.method === 'GET' && shareMatch) {
      const code = decodeURIComponent(shareMatch[1]);
      const snap = await db.collection('share_links').doc(code).get();
      if (!snap.exists) {
        res.status(404).json({ ok: false, reason: '連結不存在' });
        return;
      }
      const d = snap.data();
      res.status(200).json({
        ok: true,
        code,
        ownerId: d.ownerId,
        cardPayload: d.cardPayload,
        redeemCount: d.redeemCount || 0,
        maxRedeems: d.maxRedeems || MAX_REDEEMS,
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() || null,
      });
      return;
    }

    // POST /redeem
    if (req.method === 'POST' && (path === '/redeem' || path.endsWith('/redeem'))) {
      const { shareCode, claimerId, claimerCardPayload } = req.body || {};
      if (!shareCode || !claimerId) {
        res.status(400).json({ ok: false, reason: '缺少分享碼或玩家身分' });
        return;
      }
      const linkRef = db.collection('share_links').doc(String(shareCode));
      const claimRef = linkRef.collection('claims').doc(String(claimerId));

      const linkSnap0 = await linkRef.get();
      if (!linkSnap0.exists) {
        res.status(404).json({ ok: false, reason: '連結不存在' });
        return;
      }
      const link0 = linkSnap0.data();
      if (String(link0.ownerId) === String(claimerId)) {
        res.status(403).json({ ok: false, reason: '不能兌換自己的分享連結' });
        return;
      }
      if (Number(link0.redeemCount || 0) >= Number(link0.maxRedeems || MAX_REDEEMS)) {
        res.status(410).json({
          ok: false,
          reason: `這條連結已兌換滿 ${link0.maxRedeems || MAX_REDEEMS} 次`,
        });
        return;
      }

      const cleanClaimer = await sanitizeCardPayload(
        claimerCardPayload || {},
        `claims/${shareCode}/${claimerId}`
      );

      try {
        await db.runTransaction(async (tx) => {
          const linkSnap = await tx.get(linkRef);
          if (!linkSnap.exists) throw Object.assign(new Error('連結不存在'), { status: 404 });
          const link = linkSnap.data();
          if (String(link.ownerId) === String(claimerId)) {
            throw Object.assign(new Error('不能兌換自己的分享連結'), { status: 403 });
          }
          const claimSnap = await tx.get(claimRef);
          if (claimSnap.exists) {
            throw Object.assign(new Error('你已經兌換過這張分享卡了'), { status: 409 });
          }
          const max = Number(link.maxRedeems || MAX_REDEEMS);
          const count = Number(link.redeemCount || 0);
          if (count >= max) {
            throw Object.assign(new Error(`這條連結已兌換滿 ${max} 次`), { status: 410 });
          }
          tx.set(claimRef, {
            claimerId: String(claimerId),
            claimerCardPayload: cleanClaimer,
            createdAt: FieldValue.serverTimestamp(),
          });
          tx.update(linkRef, { redeemCount: count + 1 });
        });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, reason: e.message || '兌換失敗' });
        return;
      }

      const fresh = await linkRef.get();
      res.status(200).json({
        ok: true,
        ownerCard: fresh.data()?.cardPayload || null,
        claimerCard: cleanClaimer,
        redeemCount: Number(fresh.data()?.redeemCount || 0),
        maxRedeems: Number(fresh.data()?.maxRedeems || MAX_REDEEMS),
      });
      return;
    }

    // GET /incoming/:ownerId
    const incomingMatch = path.match(/\/incoming\/([^/]+)$/);
    if (req.method === 'GET' && incomingMatch) {
      const ownerId = decodeURIComponent(incomingMatch[1]);
      const linksSnap = await db
        .collection('share_links')
        .where('ownerId', '==', String(ownerId))
        .limit(50)
        .get();
      const copies = [];
      for (const doc of linksSnap.docs) {
        const claimsSnap = await doc.ref
          .collection('claims')
          .orderBy('createdAt', 'desc')
          .limit(20)
          .get();
        for (const c of claimsSnap.docs) {
          const data = c.data();
          copies.push({
            ...(data.claimerCardPayload || {}),
            id: `claim-${doc.id}-${c.id}`,
            source: 'friend_copy',
            shareCode: doc.id,
            copiedAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
          });
        }
      }
      res.status(200).json({ ok: true, copies });
      return;
    }

    // GET /health
    if (req.method === 'GET' && (path === '/' || path === '/health' || path.endsWith('/health'))) {
      res.status(200).json({ ok: true, service: 'bubbleweave-share-api', maxRedeems: MAX_REDEEMS });
      return;
    }

    res.status(404).json({ ok: false, reason: `未知路徑 ${path}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, reason: err.message || '伺服器錯誤' });
  }
});
