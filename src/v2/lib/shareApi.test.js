import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { buildStoryCaption } from './shareExport.js';

describe('buildStoryCaption', () => {
  it('組出限動文案含暱稱類別籤等', () => {
    const text = buildStoryCaption({
      displayName: '阿明',
      categoryId: 'career',
      fortuneId: 'dai_kyo',
    });
    expect(text).toContain('阿明');
    expect(text).toContain('工作運');
    expect(text).toContain('大凶');
    expect(text).not.toContain('💀');
    expect(text).toContain('改運');
  });

  it('缺省暱稱用「我」', () => {
    expect(buildStoryCaption({ categoryId: 'love', fortuneId: 'kichi' })).toContain('「我今日');
  });
});

describe('shareApi local redeem limit', () => {
  beforeEach(() => {
    vi.resetModules();
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    });
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:5173', pathname: '/' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('local 分享：同 claimer 不可兌兩次；滿 5 次拒絕', async () => {
    // 未設 VITE_SHARE_API_URL → local 模式
    vi.stubEnv('VITE_SHARE_API_URL', '');
    const {
      createShareLink,
      claimShareMutual,
      fetchShareLink,
    } = await import('./shareApi.js');

    const created = await createShareLink('owner-1', {
      displayName: 'A',
      fortuneLabel: '小吉',
    });
    expect(created.ok).toBe(true);
    expect(created.local).toBe(true);

    for (let i = 0; i < 5; i += 1) {
      const r = await claimShareMutual({
        shareCode: created.code,
        ownerId: 'owner-1',
        claimerId: `c-${i}`,
        claimerCardPayload: { displayName: `C${i}` },
      });
      expect(r.ok).toBe(true);
    }

    const sixth = await claimShareMutual({
      shareCode: created.code,
      ownerId: 'owner-1',
      claimerId: 'c-extra',
      claimerCardPayload: { displayName: 'X' },
    });
    expect(sixth.ok).toBe(false);
    expect(sixth.reason).toMatch(/滿 5/);

    const dup = await claimShareMutual({
      shareCode: created.code,
      ownerId: 'owner-1',
      claimerId: 'c-0',
      claimerCardPayload: { displayName: 'C0' },
    });
    expect(dup.ok).toBe(false);

    const self = await claimShareMutual({
      shareCode: created.code,
      ownerId: 'owner-1',
      claimerId: 'owner-1',
      claimerCardPayload: {},
    });
    expect(self.ok).toBe(false);
    expect(self.reason).toMatch(/自己/);

    const link = await fetchShareLink(created.code);
    expect(link.redeemCount).toBe(5);
  });
});
