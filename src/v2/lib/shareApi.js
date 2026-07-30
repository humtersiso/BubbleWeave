/**
 * BubbleWeave v2 分享 API 客戶端（GCP Cloud Functions + Firestore）
 * 未設定 VITE_SHARE_API_URL 時 fallback 本機 localStorage（僅同瀏覽器測試）。
 */

const MAX_REDEEMS = 5;

const createCode = () =>
  Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);

export const getShareApiBase = () =>
  String(import.meta.env.VITE_SHARE_API_URL || '')
    .trim()
    .replace(/\/+$/, '');

export const isShareApiConfigured = () => Boolean(getShareApiBase());

const apiFetch = async (path, options = {}) => {
  const base = getShareApiBase();
  if (!base) throw new Error('未設定 VITE_SHARE_API_URL');
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw Object.assign(new Error(data?.reason || `HTTP ${res.status}`), {
      status: res.status,
      data,
    });
  }
  return data;
};

/** @deprecated 保留空實作，相容舊呼叫 */
export const upsertPlayerRemote = async () => ({ ok: true });

/**
 * 建立分享連結
 * @returns {Promise<{ ok: boolean, code?: string, reason?: string, local?: boolean }>}
 */
export const createShareLink = async (ownerId, cardPayload) => {
  if (!isShareApiConfigured()) {
    const code = `local-${createCode()}`;
    try {
      localStorage.setItem(
        `bw.v2.share.${code}`,
        JSON.stringify({
          ownerId,
          cardPayload,
          redeemCount: 0,
          maxRedeems: MAX_REDEEMS,
          createdAt: Date.now(),
        })
      );
    } catch {
      /* ignore */
    }
    return { ok: true, code, local: true, maxRedeems: MAX_REDEEMS };
  }
  try {
    const data = await apiFetch('/create', {
      method: 'POST',
      body: JSON.stringify({ ownerId, cardPayload }),
    });
    return { ok: true, code: data.code, maxRedeems: data.maxRedeems || MAX_REDEEMS };
  } catch (err) {
    return { ok: false, reason: err.message || '建立連結失敗' };
  }
};

export const fetchShareLink = async (code) => {
  if (!code) return null;
  if (String(code).startsWith('local-')) {
    try {
      const raw = localStorage.getItem(`bw.v2.share.${code}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  if (!isShareApiConfigured()) return null;
  try {
    const data = await apiFetch(`/share/${encodeURIComponent(code)}`);
    return {
      ownerId: data.ownerId,
      cardPayload: data.cardPayload,
      createdAt: data.createdAt,
      redeemCount: data.redeemCount,
      maxRedeems: data.maxRedeems,
    };
  } catch {
    return null;
  }
};

/**
 * 兌換：拿到分享者卡；計入連結次數（上限 5）
 */
export const claimShareMutual = async ({
  shareCode,
  ownerId,
  claimerId,
  claimerCardPayload,
}) => {
  if (!shareCode || !claimerId) {
    return { ok: false, reason: '缺少分享碼或玩家身分' };
  }
  if (ownerId && claimerId === ownerId) {
    return { ok: false, reason: '不能兌換自己的分享連結' };
  }

  if (String(shareCode).startsWith('local-') || !isShareApiConfigured()) {
    const link = await fetchShareLink(shareCode);
    if (!link) return { ok: false, reason: '連結不存在' };
    const claimKey = `bw.v2.claim.${shareCode}.${claimerId}`;
    if (localStorage.getItem(claimKey)) {
      return { ok: false, reason: '你已經兌換過這張分享卡了' };
    }
    const count = Number(link.redeemCount || 0);
    const max = Number(link.maxRedeems || MAX_REDEEMS);
    if (count >= max) {
      return { ok: false, reason: `這條連結已兌換滿 ${max} 次` };
    }
    localStorage.setItem(claimKey, '1');
    try {
      localStorage.setItem(
        `bw.v2.share.${shareCode}`,
        JSON.stringify({ ...link, redeemCount: count + 1 })
      );
      const inboxKey = `bw.v2.inbox.${link.ownerId}`;
      const inbox = JSON.parse(localStorage.getItem(inboxKey) || '[]');
      inbox.unshift({
        ...(claimerCardPayload || {}),
        id: `local-claim-${Date.now()}`,
        source: 'friend_copy',
        shareCode,
        copiedAt: new Date().toISOString(),
      });
      localStorage.setItem(inboxKey, JSON.stringify(inbox.slice(0, 50)));
    } catch {
      /* ignore */
    }
    return {
      ok: true,
      ownerCard: link.cardPayload || null,
      claimerCard: claimerCardPayload,
      local: true,
    };
  }

  try {
    const data = await apiFetch('/redeem', {
      method: 'POST',
      body: JSON.stringify({ shareCode, claimerId, claimerCardPayload }),
    });
    return {
      ok: true,
      ownerCard: data.ownerCard || null,
      claimerCard: data.claimerCard || claimerCardPayload,
      redeemCount: data.redeemCount,
      maxRedeems: data.maxRedeems,
    };
  } catch (err) {
    return { ok: false, reason: err.message || '兌換失敗' };
  }
};

export const shareUrlForCode = (code) => {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/s/${code}`;
};

export const fetchIncomingCopiesForOwner = async (ownerId) => {
  if (!ownerId) return [];
  if (!isShareApiConfigured()) {
    try {
      return JSON.parse(localStorage.getItem(`bw.v2.inbox.${ownerId}`) || '[]');
    } catch {
      return [];
    }
  }
  try {
    const data = await apiFetch(`/incoming/${encodeURIComponent(ownerId)}`);
    return Array.isArray(data.copies) ? data.copies : [];
  } catch {
    return [];
  }
};
