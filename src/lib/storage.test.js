import { describe, expect, it } from 'vitest';
import {
  createId,
  formatCountdown,
  getRewardCountdownSeconds,
  REWARD_COOLDOWN_MS,
  defaultState,
} from './storage.js';

describe('storage helpers', () => {
  it('createId 含前綴與唯一性', () => {
    const a = createId('t');
    const b = createId('t');
    expect(a.startsWith('t-')).toBe(true);
    expect(a).not.toBe(b);
  });

  it('formatCountdown 零填充', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(3661)).toBe('01:01:01');
  });

  it('getRewardCountdownSeconds 冷卻內為正', () => {
    const last = new Date(Date.now() - 1000).toISOString();
    expect(getRewardCountdownSeconds(last)).toBeGreaterThan(0);
    expect(getRewardCountdownSeconds(last)).toBeLessThanOrEqual(
      Math.ceil(REWARD_COOLDOWN_MS / 1000)
    );
    expect(getRewardCountdownSeconds(null)).toBe(0);
  });

  it('defaultState 含 v2 欄位', () => {
    const s = defaultState();
    expect(s).toHaveProperty('fortuneCards');
    expect(s).toHaveProperty('draftCard');
    expect(s).toHaveProperty('flowStep', 1);
  });
});
