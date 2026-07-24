/**
 * 漫才人設＋依格數的對白節拍（供 storyGeneration LLM 指令）
 * 人設欄位來源：character-bible.js（comedyRole / voiceLogic / sampleLines）
 */

import { CHARACTER_BIBLE } from '../data/character-bible.js';
import { CHARACTERS_BY_ID } from './casts.js';
import { buildPlayerCharacter } from './playerCharacter.js';

/**
 * @param {string[]} [characterIds]
 * @param {{ displayName?: string }} [playerProfile]
 */
export const buildComedyVoiceBlock = (characterIds = [], playerProfile = null) => {
  const ids =
    characterIds.length > 0
      ? [...new Set(characterIds)]
      : CHARACTER_BIBLE.map((c) => c.id);

  const lines = ids
    .map((id) => {
      const ch =
        id === 'me'
          ? buildPlayerCharacter(playerProfile || {})
          : CHARACTERS_BY_ID[id] || CHARACTER_BIBLE.find((c) => c.id === id);
      if (!ch?.comedyRoleZh) return null;
      const samples = (ch.sampleLines || []).map((s) => `「${s}」`).join('／');
      return (
        `- ${ch.name}（${ch.comedyRoleZh}／${ch.comedyRole}）：${ch.voiceLogic}` +
        (samples ? `\n  經典語氣參考（勿照抄）：${samples}` : '')
      );
    })
    .filter(Boolean);

  if (!lines.length) return '';

  return [
    '【漫才人設 — 發言必須像「這個人」】',
    '多人同框時：Boke（裝傻）丟荒謬／搞砸；Tsukkomi（吐槽）用理性冷面拆穿。Cindy 固定為核心吐槽位。',
    '單人時：用該角色自己的人設把災難講完（仍要有反差包袱）。',
    ...lines,
  ].join('\n');
};

/**
 * 依劇場格數選擇對白節拍策略
 * @param {number} panelCount
 */
export const buildBeatStructureGuide = (panelCount) => {
  const n = Math.max(1, Math.round(Number(panelCount) || 1));

  if (n <= 2) {
    return [
      `【篇幅策略＝極短篇迷因（${n} 格）】`,
      '直接重擊 Punchline，禁止長鋪陳。',
      n === 1
        ? '- 單格：一句同時完成 Setup＋Payoff（荒謬現狀＋人設收束）。'
        : '- 第1格 Setup：拋出荒謬現狀；第2格 Payoff：爆款台詞（優先由另一角色／吐槽位收）。',
    ].join('\n');
  }

  if (n <= 4) {
    const map3 =
      n === 3
        ? '\n（3 格合併）1＝setup → 2＝escalation＋climax → 3＝payoff'
        : '';
    return [
      `【篇幅策略＝標準篇／日式漫才四段（${n} 格）】`,
      '- Panel 1：setup（鋪梗／宣告現狀）',
      '- Panel 2：escalation（遞進／理直氣壯搞砸）',
      '- Panel 3：climax（情緒爆炸／肢體崩潰）',
      '- Panel 4：payoff（擺爛收尾／冷面結論）',
      map3,
    ]
      .filter(Boolean)
      .join('\n');
  }

  const waves = Math.ceil(n / 4);
  return [
    `【篇幅策略＝長篇波浪動線（${n} 格）】`,
    '禁止整篇只做一次起承轉合（讀者會疲倦）。',
    `採用波浪型：每 3～4 格一個小笑點循環（setup→escalation→climax→payoff），約 ${waves} 個小波串聯。`,
    '例：1–4 夜市暴雨篇 → 5–8 超商躲雨篇 → 9–12 捷運回家篇。',
    '每個小波結尾要有小結算，再接下一個衝突；角色人設貫穿全篇。',
  ].join('\n');
};

/**
 * 劇場出場角色的人設＋節拍（一次組好塞進 prompt）
 * @param {object[]} cards
 */
export const buildDialogueCraftBlock = (cards = [], playerProfile = null) => {
  const ids = cards.flatMap((c) => c.characterIds || []);
  const meName = cards
    .flatMap((c) => c.castMembers || [])
    .find((m) => m.id === 'me')?.nameZh;
  const profile =
    playerProfile ||
    (meName ? { displayName: meName } : null);
  return [buildComedyVoiceBlock(ids, profile), buildBeatStructureGuide(cards.length)]
    .filter(Boolean)
    .join('\n\n');
};
