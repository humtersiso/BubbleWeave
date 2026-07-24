/**
 * 角色身份鎖定工具 — 肖像／場景卡共用，避免漏傳或只鎖 Bob。
 */

/** 角色間禁止互換的特徵（多人同框必加） */
export const buildAntiSwapBlock = (chars) => {
  if (!chars?.length) return '';
  const ids = new Set(chars.map((c) => c.id));
  const lines = [
    '[ANTI-SWAP — never mix these traits across people]',
    'Each person keeps ONLY their own hair, glasses, outfit, body type, and skin tone.',
  ];
  if (ids.has('cindy')) {
    lines.push(
      'Cindy ONLY: long pin-straight black hair past shoulders + BLACK OL suit + NO glasses (bare eyes). ' +
        'Never messy hair, never white oversized tee, never ANY glasses/spectacles, never looking like Elise.'
    );
  }
  if (ids.has('bob')) {
    lines.push(
      'Bob ONLY: Black man with DARK gray-filled skin, BALD + full beard, skull tee, HUGE round beer belly under the shirt. ' +
        'Never pale face, never white hair, never glasses, never plaid, never OL suit, never flat stomach.'
    );
  }
  if (ids.has('david')) {
    lines.push(
      'David ONLY: short WHITE side-combed hair + thick BLACK SQUARE glasses + plaid shirt. Never bald, never round glasses, never beard, never skull tee.'
    );
  }
  if (ids.has('elise')) {
    lines.push(
      'Elise ONLY: East Asian pale-to-light skin (NEVER Black / NEVER dark / NEVER Bob gray-fill) + messy chin-to-shoulder black hair + thick ROUND glasses + knee-length white oversized tee + flip-flops. ' +
        'BODY = slightly plump / lightly chubby only (~65-70kg) — NOT obese, NOT heavy, NOT model-slim. ' +
        'Never sleek long hair, never square glasses, never OL suit, never Bob-dark skin.'
    );
  }
  if (ids.has('bob') && ids.has('elise')) {
    lines.push(
      'SKIN RULE: Bob = DARK Black gray-fill ONLY; Elise = pale-to-light East Asian ONLY. Never swap skin tones.'
    );
  }
  if (ids.has('david') && ids.has('elise')) {
    lines.push('GLASSES RULE: David = SQUARE frames; Elise = ROUND frames. Never swap.');
  }
  if (ids.has('cindy') && ids.has('elise')) {
    lines.push(
      'HAIR RULE: Cindy = long straight past shoulders; Elise = short messy chin-length. Never swap.'
    );
    lines.push(
      'GLASSES RULE: Cindy = NO glasses; Elise = ROUND glasses. Never put glasses on Cindy.'
    );
  }
  if (ids.has('cindy') && ids.has('david')) {
    lines.push('GLASSES RULE: Cindy = NO glasses; David = SQUARE glasses. Never put glasses on Cindy.');
  }
  return lines.join('\n');
};

/** 精簡簽名卡（避免超長 prompt 把身份沖掉） */
export const buildSignatureCard = (c) => {
  if (!c) return '';
  return [
    `=== ${c.name} (LOCKED) ===`,
    `SKIN/RACE: ${
      c.id === 'bob'
        ? 'Black man — DARK skin with medium-dark gray ink fill on face/arms (never pale)'
        : c.id === 'cindy'
          ? 'Japanese East Asian light skin'
          : c.id === 'elise'
            ? 'East Asian pale-to-light skin — NEVER Black, NEVER dark, NEVER Bob gray-fill'
            : 'light skin (not Black)'
    }`,
    `HAIR: ${c.hairSignature}`,
    c.glassesSignature ? `GLASSES: ${c.glassesSignature}` : '',
    `BODY: ${c.bodySignature || c.body}`,
    `OUTFIT: ${c.outfitSignature || c.outfit}`,
    `HARD: ${c.identityHardLock || ''}`,
  ]
    .filter(Boolean)
    .join('\n');
};

/** 畫前／畫後 checklist（四人對等） */
export const buildIdentityChecklist = (chars) =>
  (chars || [])
    .map((c) => {
      const bits = [
        `hair=${c.hairSignature}`,
        `outfit=${c.outfitSignature || c.outfit}`,
      ];
      if (c.glassesSignature) bits.push(`glasses=${c.glassesSignature}`);
      if (c.bodySignature) bits.push(`body=${c.bodySignature}`);
      if (c.id === 'bob') bits.push('skin=DARK Black gray-fill');
      if (c.id === 'elise') {
        bits.push('skin=East Asian light ONLY (not Black)');
        bits.push('body=slightly plump only (~65-70kg, not obese)');
      }
      if (c.portraitFailCheck) bits.push(`fail-if=${c.portraitFailCheck}`);
      return `- ${c.name}: ${bits.join('; ')}`;
    })
    .join('\n');

/** 文末最終鎖定（所有出場角色） */
export const buildFinalIdentityCap = (chars) => {
  if (!chars?.length) return '';
  return [
    '[FINAL IDENTITY CAP — re-check after posing]',
    buildIdentityChecklist(chars),
    'Reject: wrong hair, missing/wrong glasses, sportswear swap, trait bleeding between characters.',
    chars.some((c) => c.id === 'bob')
      ? 'Reject: pale/white Bob (blank-paper face). Reject: Bob without huge beer belly in full/three-quarter body shots.'
      : '',
    chars.some((c) => c.id === 'elise')
      ? 'Reject: Elise with Black/dark skin; Reject: Elise obese/heavy 90kg+ OR model-slim — she is lightly plump only.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
};

/** 參考圖旁的短提示 */
export const buildRefHint = (c) => {
  if (!c) return 'Copy this reference exactly.';
  return (
    `${c.name} identity lock: ${c.hairSignature}; ${c.outfitSignature || c.outfit}` +
    (c.glassesSignature ? `; ${c.glassesSignature}` : '') +
    (c.bodySignature ? `; ${c.bodySignature}` : '') +
    (c.id === 'bob' ? '; DARK Black skin gray-fill; HUGE beer belly in body shots' : '') +
    (c.id === 'elise'
      ? '; East Asian LIGHT skin only — NEVER Black/dark like Bob; BODY slightly plump only (NOT obese)'
      : '') +
    '. Copy THIS reference for face; TEXT locks override wrong hair/outfit/skin/body.'
  );
};
