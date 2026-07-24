import { createId } from './storage.js';
import { CHARACTERS } from './casts.js';

/**
 * Demo stories using the 4-character bible roster.
 */
export const buildDemoStories = (cards = []) => {
  const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
  const byChar = (id) => cards.filter((c) => (c.characterIds || []).includes(id));

  const demos = [];
  const cindy = CHARACTERS.find((c) => c.id === 'cindy');
  const bob = CHARACTERS.find((c) => c.id === 'bob');
  const david = CHARACTERS.find((c) => c.id === 'david');
  const elise = CHARACTERS.find((c) => c.id === 'elise');

  const cindyCards = byChar('cindy');
  if (cindyCards.length >= 3 && cindy) {
    demos.push({
      id: createId('demo'),
      author: 'Me',
      isMine: true,
      characterIds: ['cindy'],
      title: `${cindy.nameZh}的通勤日常`,
      cards: cindyCards.slice(0, 3),
      dialogues: [
        `${cindy.nameZh}：會議還有十分鐘——外套要皺了。`,
        `${cindy.nameZh}：捷運門開了。保持微笑，保持專業。`,
        `${cindy.nameZh}：收工。窄裙口袋裡好像進了名片。`,
      ],
      likes: 18,
      remixCount: 2,
      createdAt: hoursAgo(10),
    });
  }

  if (cards.length >= 4) {
    demos.push({
      id: createId('demo'),
      author: '墨水少女',
      isMine: false,
      characterIds: cards[0]?.characterIds || [],
      title: '四人格局偶遇',
      cards: cards.slice(0, 4),
      dialogues: [
        `${cindy?.nameZh || 'Cindy'}：抱歉，我趕會議……你擋到捷運門了。`,
        `${bob?.nameZh || 'Bob'}：門？我以為這是酒吧入口。骷髏 T 不會錯。`,
        `${elise?.nameZh || 'Elise'}：你們能不能小聲一點，我夾腳拖快掉了。`,
        `${david?.nameZh || 'David'}：年輕人，格子襯衫教過你們要排隊。`,
      ],
      likes: 33,
      remixCount: 8,
      createdAt: hoursAgo(3),
    });
  }

  const eliseCards = byChar('elise');
  if (eliseCards.length >= 3 && elise) {
    demos.push({
      id: createId('demo'),
      author: '深夜編輯',
      isMine: false,
      characterIds: ['elise'],
      title: `${elise.nameZh}宅女章`,
      cards: eliseCards.slice(0, 3),
      dialogues: [
        `${elise.nameZh}：別叫我出門。白 T 還沒洗。`,
        `${elise.nameZh}：圓框眼鏡霧了？那就不看世界了。`,
        `${elise.nameZh}：夾腳拖啪一聲。故事先暫停，我要回沙發。`,
      ],
      likes: 41,
      remixCount: 11,
      createdAt: hoursAgo(1),
    });
  }

  return demos;
};
