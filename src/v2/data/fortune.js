/** 籤運等級與類別（PRD §3.3） */

export const FORTUNE_TIERS = [
  {
    id: 'dai_kichi',
    label: '大吉',
    emoji: '✨',
    rarity: 'SSR',
    rarityLabel: '傳說',
    baseWeight: 5,
    mood: '開朗得意、鬆一口氣、眼神發亮',
  },
  {
    id: 'kichi',
    label: '吉',
    emoji: '🍀',
    rarity: 'SR',
    rarityLabel: '稀有',
    baseWeight: 15,
    mood: '開心、輕鬆吐槽、嘴角上揚',
  },
  {
    id: 'chu_kichi',
    label: '中吉',
    emoji: '🙂',
    rarity: 'R',
    rarityLabel: '精良',
    baseWeight: 25,
    mood: '還行、微妙安心、小確幸',
  },
  {
    id: 'sho_kichi',
    label: '小吉',
    emoji: '😐',
    rarity: 'N',
    rarityLabel: '普通',
    baseWeight: 30,
    mood: '苦笑、微妙、尷尬但不絕望',
  },
  {
    id: 'kyo',
    label: '凶',
    emoji: '😬',
    rarity: 'C',
    rarityLabel: '倒楣',
    baseWeight: 18,
    mood: '僵硬崩潰、社死感、額頭冒汗',
  },
  {
    id: 'dai_kyo',
    label: '大凶',
    emoji: '💀',
    rarity: 'CURSED',
    rarityLabel: '詛咒',
    baseWeight: 7,
    mood: '徹底破防、生無可戀、漫畫式崩潰',
  },
];

export const FORTUNE_BY_ID = Object.fromEntries(FORTUNE_TIERS.map((t) => [t.id, t]));

export const FORTUNE_CATEGORIES = [
  { id: 'career', label: '工作／學業運', short: '工作運' },
  { id: 'love', label: '愛情／桃花運', short: '愛情運' },
  { id: 'health', label: '健康／體力運', short: '健康運' },
  { id: 'wealth', label: '財運／金富運', short: '財運' },
  { id: 'social', label: '人際／小人運', short: '人際運' },
];

export const CATEGORY_BY_ID = Object.fromEntries(FORTUNE_CATEGORIES.map((c) => [c.id, c]));

/** 個性標籤微調：偏樂觀 → 吉系；偏焦慮 → 凶系 */
const BOOST_LUCKY = ['樂天', '軟爛樂觀', '佛系', '幹話王', '開朗'];
const BOOST_BAD = ['焦慮小宇宙', '社畜魂', '社畜吐槽', '選擇障礙', '玻璃心'];

/**
 * @param {string[]} tags
 * @returns {string} fortune tier id
 */
export const rollFortuneTier = (tags = []) => {
  const tagSet = new Set((tags || []).map(String));
  const lucky = BOOST_LUCKY.some((t) => tagSet.has(t));
  const bad = BOOST_BAD.some((t) => tagSet.has(t));

  const weighted = FORTUNE_TIERS.map((t) => {
    let w = t.baseWeight;
    if (lucky && ['dai_kichi', 'kichi', 'chu_kichi'].includes(t.id)) w *= 1.25;
    if (bad && ['kyo', 'dai_kyo', 'sho_kichi'].includes(t.id)) w *= 1.25;
    // 下限：避免某一檔被壓到 0
    return { id: t.id, weight: Math.max(3, w) };
  });

  const total = weighted.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const row of weighted) {
    r -= row.weight;
    if (r <= 0) return row.id;
  }
  return 'sho_kichi';
};

export const fortuneDisplay = (tierId) => {
  const t = FORTUNE_BY_ID[tierId] || FORTUNE_BY_ID.sho_kichi;
  return { ...t };
};
