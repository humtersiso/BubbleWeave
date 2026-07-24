/**
 * IndexedDB persistence — localStorage cannot hold 21 base64 card images.
 */

const DB_NAME = 'bubbleweave';
const DB_VERSION = 1;
const STORE = 'state';
const STATE_KEY = 'app';

const openDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });

export const defaultState = () => ({
  cards: [],
  portraits: {},
  portraitVersion: 0,
  stories: [],
  lastClaimAt: null,
  initialized: false,
  demoSeeded: false,
  theme: 'atelier',
  cardSchemaVersion: 0,
  storyPackVersion: 0,
  playerProfile: null,
});

export const loadState = async () => {
  try {
    const db = await openDb();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(STATE_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!value) return defaultState();
    return {
      ...defaultState(),
      ...value,
      cards: Array.isArray(value.cards) ? value.cards : [],
      stories: Array.isArray(value.stories) ? value.stories : [],
    };
  } catch (err) {
    console.error('loadState failed', err);
    return defaultState();
  }
};

export const saveState = async (partial) => {
  const current = await loadState();
  const next = { ...current, ...partial };
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(next, STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('saveState failed', err);
  }
  return next;
};

export const clearState = async () => {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('clearState failed', err);
  }
};

export const REWARD_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const getRewardCountdownSeconds = (lastClaimAt) => {
  if (!lastClaimAt) return 0;
  const next = new Date(lastClaimAt).getTime() + REWARD_COOLDOWN_MS;
  const left = next - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
};

export const formatCountdown = (totalSeconds) => {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
};

export const createId = (prefix = 'id') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
