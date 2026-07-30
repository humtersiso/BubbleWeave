import { describe, expect, it } from 'vitest';
import { pickTopFacesByConfidence } from './faceDetection.js';

describe('pickTopFacesByConfidence', () => {
  it('依信心取前 N', () => {
    const faces = [
      { score: 0.2, area: 0.1 },
      { score: 0.9, area: 0.01 },
      { score: 0.5, area: 0.05 },
    ];
    const top = pickTopFacesByConfidence(faces, 2);
    expect(top).toHaveLength(2);
    expect(top[0].score).toBe(0.9);
    expect(top[1].score).toBe(0.5);
  });

  it('N=0 或空陣列回傳空', () => {
    expect(pickTopFacesByConfidence([], 3)).toEqual([]);
    expect(pickTopFacesByConfidence([{ score: 1 }], 0)).toEqual([]);
  });
});
