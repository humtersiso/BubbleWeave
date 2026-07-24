/**
 * 通用槽位（食衣住行育樂）— 跨季包不變的產品骨架
 * 「行」拆成大眾運輸／個人交通兩槽。
 */

export const UNIVERSAL_SLOT_IDS = [
  'STREET_FOOD',
  'DINING_SOCIAL',
  'FASHION_LOCAL',
  'ACCOMMODATION',
  'TRANSIT_PUBLIC',
  'TRANSIT_PERSONAL',
  'CULTURE_RULES',
  'LANDMARK_SPOT',
  'SHOPPING_CHAOS',
  'NATURE_OUTDOORS',
  'ENTERTAINMENT',
];

/** @deprecated 相容舊 JSON → 視為大眾運輸 */
export const LEGACY_TRANSIT_SLOT_ID = 'TRANSIT_DAILY';

/** @typedef {'食'|'衣'|'住'|'行'|'育'|'樂'} SlotCategory */

/**
 * 槽位目錄（weight = 抽樣用相對權重，≥1）
 * 高 28：STREET_FOOD / LANDMARK_SPOT / TRANSIT_PUBLIC / TRANSIT_PERSONAL
 * 中 14：FASHION_LOCAL / CULTURE_RULES / ENTERTAINMENT / SHOPPING_CHAOS
 * 低 6：DINING_SOCIAL / ACCOMMODATION / NATURE_OUTDOORS
 */
export const UNIVERSAL_SLOTS = [
  {
    id: 'STREET_FOOD',
    order: 1,
    category: '食',
    nameZh: '地道小吃',
    nameEn: 'Street Food',
    weight: 28,
    exampleTaiwan: '夜市臭豆腐／大腸包小腸',
    exampleJapan: '街頭章魚燒／鯛魚燒',
    exampleKorea: '辣炒年糕／魚板湯',
  },
  {
    id: 'DINING_SOCIAL',
    order: 2,
    category: '食',
    nameZh: '聚餐與酒吧',
    nameEn: 'Dining & Social',
    weight: 6,
    exampleTaiwan: '熱炒店／流水席／火鍋',
    exampleJapan: '居酒屋／日式拉麵店',
    exampleKorea: '韓國烤肉／布帳馬車',
  },
  {
    id: 'FASHION_LOCAL',
    order: 3,
    category: '衣',
    nameZh: '雨具／換裝災難',
    nameEn: 'Local Fashion',
    weight: 14,
    exampleTaiwan: '撐雨傘翻車／雨衣全身濕／藍白拖',
    exampleJapan: '和服木屐絆倒／原宿雨傘互戳',
    exampleKorea: '韓服體驗／東大門雨衣爆買',
  },
  {
    id: 'ACCOMMODATION',
    order: 4,
    category: '住',
    nameZh: '住宿與歇腳',
    nameEn: 'Accommodation',
    weight: 6,
    exampleTaiwan: '汽車旅館／老舊旅社',
    exampleJapan: '膠囊旅館／榻榻米溫泉',
    exampleKorea: '韓式汗蒸幕／鋪地墊',
  },
  {
    id: 'TRANSIT_PUBLIC',
    order: 5,
    category: '行',
    nameZh: '大眾運輸',
    nameEn: 'Public Transit',
    weight: 28,
    exampleTaiwan: '捷運車廂／公車站／高鐵月台',
    exampleJapan: '新幹線／電車滿員／巴士',
    exampleKorea: '地鐵／雙層公車／候車',
  },
  {
    id: 'TRANSIT_PERSONAL',
    order: 6,
    category: '行',
    nameZh: '個人交通',
    nameEn: 'Personal Transit',
    weight: 28,
    exampleTaiwan: 'YouBike／腳踏車／機車陣',
    exampleJapan: '自行車道／機車停等',
    exampleKorea: '共享單車／機車坡道',
  },
  {
    id: 'CULTURE_RULES',
    order: 7,
    category: '育',
    nameZh: '信仰與文化儀式',
    nameEn: 'Culture & Rituals',
    weight: 14,
    exampleTaiwan: '廟會擲筊／算命籤詩／刮樂透',
    exampleJapan: '神社拜拜抽籤／手水舍',
    exampleKorea: '祈福石堆／宮殿守衛',
  },
  {
    id: 'LANDMARK_SPOT',
    order: 8,
    category: '樂',
    nameZh: '觀光經典地標',
    nameEn: 'Landmark',
    weight: 28,
    exampleTaiwan: '台北 101／九份老街',
    exampleJapan: '東京鐵塔／大阪跑跑人',
    exampleKorea: '首爾塔／景福宮大門',
  },
  {
    id: 'SHOPPING_CHAOS',
    order: 9,
    category: '樂',
    nameZh: '爆買商店',
    nameEn: 'Shopping Chaos',
    weight: 14,
    exampleTaiwan: '24H 超商／全聯／家樂福',
    exampleJapan: '藥妝店／唐吉訶德',
    exampleKorea: '零食超市／美妝店',
  },
  {
    id: 'NATURE_OUTDOORS',
    order: 10,
    category: '樂',
    nameZh: '自然與戶外活動',
    nameEn: 'Nature & Outdoors',
    weight: 6,
    exampleTaiwan: '河濱公園／陽明山步道',
    exampleJapan: '富士山遠眺／鴨川跳石',
    exampleKorea: '漢江公園野餐／雪場',
  },
  {
    id: 'ENTERTAINMENT',
    order: 11,
    category: '樂',
    nameZh: '夜生活與娛樂',
    nameEn: 'Nightlife & Fun',
    weight: 14,
    exampleTaiwan: '夾娃娃機店／KTV 包廂',
    exampleJapan: '遊戲中心／拍貼機',
    exampleKorea: '街頭 KTV／遊戲酒吧',
  },
];

export const UNIVERSAL_SLOTS_BY_ID = Object.fromEntries(
  UNIVERSAL_SLOTS.map((s) => [s.id, s])
);

/** 正規化槽位 id（舊 TRANSIT_DAILY → TRANSIT_PUBLIC） */
export const normalizeSlotId = (slotId) => {
  const id = String(slotId || '').trim();
  if (id === LEGACY_TRANSIT_SLOT_ID) return 'TRANSIT_PUBLIC';
  return UNIVERSAL_SLOTS_BY_ID[id] ? id : '';
};
