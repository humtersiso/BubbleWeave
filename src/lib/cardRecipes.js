/**
 * Recipe = partySize(1|2|3|4) × characters × scene × action × emotion
 *
 * 【產品季包】目前為 Season 1：台灣篇
 * - 角色底層（character-bible）不動；換季只換 SCENES / ACTIONS／本檔組裝邏輯
 * - 服裝嚴格鎖定：任何台灣場景仍穿各角色簽名裝（OL／骷髏 T／格子衫／寬大白 T）
 * - SCENES／ACTIONS／EMOTIONS 皆含 `weight`（INT≥1）供加權抽樣；BQ 目錄見 `bqCatalog.js`
 */

import {
  CHARACTERS,
  CHARACTERS_BY_ID,
  PARTY_SIZE_DISTRIBUTION,
  PARTY_SIZE_OPTIONS,
  TOTAL_BOOTSTRAP_CARDS,
} from './casts.js';
import {
  buildAntiSwapBlock,
  buildSignatureCard,
  buildIdentityChecklist,
  buildFinalIdentityCap,
} from './characterIdentity.js';
import {
  UNIVERSAL_SLOTS,
  getSeasonConfig,
  resolveSceneSlotId,
  groupScenesBySlot,
  getSlotForScene,
  getActiveSeasonMeta,
  ACTIVE_SEASON_ID,
} from './seasonCatalog.js';

/** 目前營運季（meta 來自 Layer 1 JSON；場景目錄仍在本檔 SCENES） */
export const SEASON = getActiveSeasonMeta();

/**
 * 約 10% 抽到「合理微跨界」萬用動作（滑手機、搧風、撐傘翻車等）。
 * 其餘 90% 嚴格走場景 `allowedActions`（池內再依 action.weight 加權）。
 */
export const SCENE_ACTION_CROSSOVER_RATE = 0.1;

/** 未填 weight 時的預設相對權重（INT64 友善，≥1） */
export const DEFAULT_CATALOG_WEIGHT = 10;

/** 萬用笑點動作 id（可出現在幾乎所有場景） */
export const UNIVERSAL_ACTION_IDS = [
  'peeking_phone',
  'fanning_heat',
  'wiping_sweat',
  'holding_umbrella',
  'umbrella_chaos',
  'sarcastic_clap',
];

/**
 * 第一季限定場景（台灣日常／景點／氣候；含便利商店萬用卡）
 * allowedActions：該場景主池（群組綁定）；抽樣時 90% 從此池取
 * vibe：場景群組標籤（相容舊欄位 sport）
 */
export const SCENES = [
  {
    id: 'night_market',
    weight: 18,
    label: 'Taiwan night market alley',
    labelZh: '台灣夜市巷弄',
    promptKeywords:
      'crowded Taiwan night market alley, food stalls, hanging lamps, steam and smoke, plastic stools, lively street-food vibe (no readable text/logos)',
    tags: ['open', 'public', 'crowded', 'food', 'night'],
    vibe: 'night_market',
    sport: 'night_market',
    allowedActions: [
      'eating_chicken_cutlet',
      'ordering_street_food',
      'eating_shaved_ice',
      'stinky_tofu_recoil',
      'drinking_bubble_tea',
      'queue_collapse',
    ],
  },
  {
    id: 'taipei_101',
    weight: 10,
    label: 'Taipei 101 plaza',
    labelZh: '台北101廣場',
    promptKeywords:
      'plaza in front of Taipei 101 skyscraper silhouette, wide open urban square, tourist energy, tall tower in background (no readable text)',
    tags: ['open', 'urban', 'landmark', 'outdoor'],
    vibe: 'landmark',
    sport: 'landmark',
    allowedActions: [
      'tourist_selfie_fail',
      'map_spin_lost',
      'wind_hold_outfit',
      'drinking_bubble_tea',
      'holding_umbrella',
      'peeking_phone',
    ],
  },
  {
    id: 'temple_courtyard',
    weight: 10,
    label: 'Taiwan temple courtyard',
    labelZh: '廟宇廣場',
    promptKeywords:
      'traditional Taiwanese temple courtyard, incense burner, stone lions, tiled roof eaves, respectful but everyday local vibe (no readable text)',
    tags: ['open', 'temple', 'outdoor', 'cultural'],
    vibe: 'temple',
    sport: 'temple',
    allowedActions: [
      'incense_smoke_cough',
      'throwing_poe',
      'bowing_trip',
      'wiping_sweat',
      'peeking_phone',
    ],
  },
  {
    id: 'mrt_platform',
    weight: 22,
    label: 'Taipei MRT platform',
    labelZh: '捷運月台',
    promptKeywords:
      'underground Taipei MRT platform, platform edge, waiting passengers silhouette, modern transit hall (no readable station text)',
    tags: ['indoor', 'transit', 'crowded', 'narrow'],
    vibe: 'transit',
    sport: 'transit',
    allowedActions: [
      'door_squeeze',
      'wrong_train_panic',
      'leaning_asleep_bump',
      'rush_hour_compress',
      'bus_card_tap_fail',
      'peeking_phone',
      'queue_collapse',
    ],
  },
  {
    id: 'mrt_car',
    weight: 24,
    label: 'inside Taipei MRT train car',
    labelZh: '捷運車廂內',
    promptKeywords:
      'interior of a Taipei MRT train car, hand straps and poles, seats along sides, crowded or semi-crowded passengers, fluorescent transit vibe (no readable text/maps)',
    tags: ['indoor', 'transit', 'crowded', 'narrow', 'vehicle'],
    vibe: 'transit',
    sport: 'transit',
    allowedActions: [
      'holding_overhead_strap',
      'standing_sway',
      'leaning_asleep_bump',
      'rush_hour_compress',
      'missed_stop_panic',
      'offering_seat_awkward',
      'window_seat_doze',
      'peeking_phone',
      'drinking_bubble_tea',
    ],
  },
  {
    id: 'bus_stop',
    weight: 22,
    label: 'Taiwan city bus stop',
    labelZh: '市區公車站',
    promptKeywords:
      'Taiwan city bus stop shelter on a street, waiting bench, bus approaching silhouette, humid urban roadside (no readable route numbers/text)',
    tags: ['outdoor', 'transit', 'urban'],
    vibe: 'transit',
    sport: 'transit',
    allowedActions: [
      'queue_collapse',
      'wrong_bus_wave',
      'bus_card_tap_fail',
      'holding_umbrella',
      'fanning_heat',
      'peeking_phone',
      'drinking_bubble_tea',
    ],
  },
  {
    id: 'bus_interior',
    weight: 24,
    label: 'inside a Taiwan city bus',
    labelZh: '公車車廂內',
    promptKeywords:
      'interior of a Taiwan city bus, upright poles, hanging straps, seats, aisle, everyday commute vibe (no readable ads/text)',
    tags: ['indoor', 'transit', 'crowded', 'narrow', 'vehicle'],
    vibe: 'transit',
    sport: 'transit',
    allowedActions: [
      'holding_overhead_strap',
      'standing_sway',
      'missed_stop_panic',
      'bus_bell_reach',
      'bus_card_tap_fail',
      'offering_seat_awkward',
      'leaning_asleep_bump',
      'peeking_phone',
      'eating_egg_pancake',
    ],
  },
  {
    id: 'convenience_tw',
    weight: 16,
    label: 'Taiwan convenience store doorway',
    labelZh: '便利商店門口',
    promptKeywords:
      'Taiwan convenience store entrance doorway, bright storefront glow, drink fridge near door, everyday Taiwan street corner (no brand logos/text)',
    tags: ['indoor', 'wildcard', 'urban', 'food'],
    vibe: 'wildcard',
    sport: 'wildcard',
    allowedActions: [
      'microwave_binge',
      'eating_ice_bar',
      'drinking_bubble_tea',
      'holding_umbrella',
      'peeking_phone',
      'fanning_heat',
      'wiping_sweat',
      'sarcastic_clap',
      'umbrella_chaos',
    ],
  },
  {
    id: 'rainy_arcade',
    weight: 16,
    label: 'rainy Taiwan arcade / covered sidewalk',
    labelZh: '午後雷陣雨騎樓',
    promptKeywords:
      'Taiwanese arcade covered sidewalk during sudden afternoon thunderstorm, heavy rain sheets, puddles, scooters parked under cover, humid air',
    tags: ['outdoor', 'rain', 'urban', 'narrow'],
    vibe: 'weather',
    sport: 'weather',
    allowedActions: [
      'holding_umbrella',
      'umbrella_chaos',
      'puddle_splash',
      'scooter_splash_victim',
      'arcade_crowd_squeeze',
      'fanning_heat',
    ],
  },
  {
    id: 'humid_rooftop',
    weight: 10,
    label: 'humid Taiwan rooftop / water tower',
    labelZh: '悶熱頂樓水塔',
    promptKeywords:
      'humid Taiwan residential rooftop with water towers, laundry poles, sticky summer heat haze, urban skyline soft background',
    tags: ['open', 'outdoor', 'heat', 'urban'],
    vibe: 'weather',
    sport: 'weather',
    allowedActions: [
      'fanning_heat',
      'wiping_sweat',
      'ac_vent_hug',
      'melting_on_bench',
      'eating_ice_bar',
      'drinking_bubble_tea',
    ],
  },
  {
    id: 'breakfast_shop',
    weight: 16,
    label: 'Taiwan breakfast shop counter',
    labelZh: '台式早餐店',
    promptKeywords:
      'small Taiwan breakfast shop counter, steam from griddle, soy milk cups, morning rush local vibe (no readable menus/logos)',
    tags: ['indoor', 'food', 'narrow', 'urban'],
    vibe: 'food',
    sport: 'food',
    allowedActions: [
      'eating_egg_pancake',
      'sipping_soy_milk',
      'rush_bite',
      'queue_collapse',
      'peeking_phone',
    ],
  },
  {
    id: 'bubble_tea_shop',
    weight: 18,
    label: 'bubble tea shop doorway',
    labelZh: '手搖飲店門口',
    promptKeywords:
      'Taiwan bubble-tea / hand-shaken drink shop doorway, plastic cups, sealing machine glow, sidewalk queue vibe (no brand logos/text)',
    tags: ['urban', 'food', 'outdoor'],
    vibe: 'food',
    sport: 'food',
    allowedActions: [
      'drinking_bubble_tea',
      'straw_stab_seal',
      'pearl_cheek_sip',
      'cup_tower_balance',
      'fanning_heat',
      'holding_umbrella',
    ],
  },
  {
    id: 'ubike_lane',
    weight: 18,
    label: 'Taiwan riverside YouBike lane',
    labelZh: '河濱 YouBike 車道',
    promptKeywords:
      'Taiwan riverside shared-bike lane, green public rental bicycle (YouBike-like, no brand logos/text), painted bike path, river railing, daylight outdoor',
    tags: ['open', 'outdoor', 'cycling', 'urban'],
    vibe: 'cycling',
    sport: 'cycling',
    allowedActions: [
      'riding_ubike',
      'ubike_wobble',
      'ubike_dock_fumble',
      'holding_umbrella',
      'fanning_heat',
      'drinking_bubble_tea',
    ],
  },
  {
    id: 'jiufen_alley',
    weight: 8,
    label: 'Jiufen mountain old street',
    labelZh: '九份山城老街',
    promptKeywords:
      'Jiufen-like mountain old street, steep stone stairs, red lanterns, narrow hillside alley, misty tourist town vibe (no readable text)',
    tags: ['outdoor', 'landmark', 'narrow', 'tourist'],
    vibe: 'landmark',
    sport: 'landmark',
    allowedActions: [
      'steep_stair_slip',
      'lantern_dodge',
      'narrow_alley_squeeze',
      'holding_umbrella',
      'umbrella_chaos',
      'eating_egg_pancake',
      'wiping_sweat',
    ],
  },
  {
    id: 'kenting_beach',
    weight: 10,
    label: 'Kenting beach shore',
    labelZh: '墾丁海邊',
    promptKeywords:
      'Kenting-like sunny beach shore in Taiwan, sand, ocean horizon, bright vacation heat, casual beach path (characters stay in signature clothes, no swimsuits)',
    tags: ['open', 'outdoor', 'beach', 'heat', 'water'],
    vibe: 'coast',
    sport: 'coast',
    allowedActions: [
      'sand_in_shoes',
      'wave_chase_run',
      'sunscreen_mess',
      'eating_shaved_ice',
      'fanning_heat',
      'drinking_bubble_tea',
    ],
  },
  {
    id: 'sun_moon_lake',
    weight: 10,
    label: 'Sun Moon Lake pier',
    labelZh: '日月潭碼頭',
    promptKeywords:
      'Sun Moon Lake pier / lakeside boardwalk, calm water, mountains across the lake, scenic Taiwan tourism vibe (no readable text)',
    tags: ['open', 'outdoor', 'landmark', 'water'],
    vibe: 'landmark',
    sport: 'landmark',
    allowedActions: [
      'boat_wobble',
      'lake_photo_fall',
      'riding_ubike',
      'ubike_wobble',
      'drinking_bubble_tea',
      'peeking_phone',
    ],
  },
  {
    id: 'ximending',
    weight: 12,
    label: 'Ximending pedestrian street',
    labelZh: '西門町步行區',
    promptKeywords:
      'Ximending pedestrian shopping street, neon soft glow, dense crowd, youth culture Taiwan urban vibe (no readable shop signs)',
    tags: ['open', 'urban', 'crowded', 'night'],
    vibe: 'urban',
    sport: 'urban',
    allowedActions: [
      'crossing_crowd_spin',
      'photo_block_pose',
      'eating_chicken_cutlet',
      'drinking_bubble_tea',
      'holding_umbrella',
      'peeking_phone',
    ],
  },
  {
    id: 'temple_fair',
    weight: 8,
    label: 'Taiwan temple festival street',
    labelZh: '廟會遶境街頭',
    promptKeywords:
      'Taiwan temple festival street parade energy, incense smoke, firecracker paper on ground, festive crowd, traditional props silhouette (no readable text)',
    tags: ['open', 'outdoor', 'crowded', 'temple', 'festival'],
    vibe: 'temple',
    sport: 'temple',
    allowedActions: [
      'firecracker_jump',
      'palanquin_dodge',
      'cover_ears_boom',
      'incense_smoke_cough',
      'wiping_sweat',
    ],
  },
  {
    id: 'scooter_alley',
    weight: 10,
    label: 'Taiwan scooter-packed alley',
    labelZh: '巷弄機車陣',
    promptKeywords:
      'narrow Taiwan residential alley packed with parked scooters, tangled wires overhead, humid everyday neighborhood vibe',
    tags: ['outdoor', 'urban', 'narrow'],
    vibe: 'urban',
    sport: 'urban',
    allowedActions: [
      'scooter_weave',
      'helmet_fumble',
      'parallel_park_fail',
      'holding_umbrella',
      'drinking_bubble_tea',
      'peeking_phone',
    ],
  },
  {
    id: 'hsr_platform',
    weight: 14,
    label: 'Taiwan HSR platform',
    labelZh: '高鐵月台',
    promptKeywords:
      'Taiwan High Speed Rail platform, long train silhouette, luggage, modern open platform, travel rush vibe (no readable text)',
    tags: ['open', 'transit', 'outdoor'],
    vibe: 'transit',
    sport: 'transit',
    allowedActions: [
      'sprint_to_gate',
      'luggage_tumble',
      'seat_mixup',
      'window_seat_doze',
      'missed_stop_panic',
      'drinking_bubble_tea',
      'holding_umbrella',
      'peeking_phone',
    ],
  },
  {
    id: 'yangming_trail',
    weight: 8,
    label: 'Yangmingshan misty trail',
    labelZh: '陽明山步道',
    promptKeywords:
      'Yangmingshan misty mountain trail, sulfur steam wisps, volcanic rock path, cool foggy Taiwan nature vibe',
    tags: ['open', 'outdoor', 'nature', 'landmark'],
    vibe: 'nature',
    sport: 'nature',
    allowedActions: [
      'sulfur_smell_face',
      'mist_lost_spin',
      'trail_mud_slide',
      'holding_umbrella',
      'umbrella_chaos',
      'fanning_heat',
    ],
  },
  {
    id: 'park_banyan',
    weight: 12,
    label: 'park under giant banyan tree',
    labelZh: '公園大榕樹下',
    promptKeywords:
      'Taiwan city park under a giant banyan tree, hanging aerial roots, stone benches, elders and locals resting in shade',
    tags: ['open', 'outdoor', 'park', 'heat'],
    vibe: 'park',
    sport: 'park',
    allowedActions: [
      'melting_on_bench',
      'eating_shaved_ice',
      'drinking_bubble_tea',
      'fanning_heat',
      'wiping_sweat',
      'dog_drag',
      'riding_ubike',
      'peeking_phone',
    ],
  },
];

/**
 * 第一季動作池 — 台灣日常笑點；含道具描述 propPrompt
 * vibe／sport: 所屬群組；`universal` = 可進 10% 微跨界池
 */
export const ACTIONS = [
  // —— 萬用 ——
  {
    id: 'peeking_phone',
    weight: 14,
    label: 'sneaking a look at a phone',
    labelZh: '偷偷滑手機',
    prompt:
      'sneaking a guilty glance at a smartphone mid-activity, trying to hide the screen from others',
    propPrompt: 'a smartphone with glowing screen (no readable text)',
    sport: 'universal',
    vibe: 'universal',
    tags: ['social', 'object', 'universal'],
  },
  {
    id: 'fanning_heat',
    weight: 12,
    label: 'desperately fanning against humid heat',
    labelZh: '悶熱猛搧風',
    prompt:
      'desperately fanning themselves against sticky Taiwan humid heat, clothes clinging, face shiny with sweat',
    propPrompt: 'a folding fan or a flyer used as a makeshift fan',
    sport: 'universal',
    vibe: 'universal',
    tags: ['physical', 'heat', 'exhausted', 'universal'],
  },
  {
    id: 'wiping_sweat',
    weight: 12,
    label: 'wiping cascading sweat',
    labelZh: '擦不完的汗',
    prompt:
      'wiping cascading sweat from forehead and neck in comic exhaustion from Taiwan heat',
    propPrompt: 'a crumpled tissue or towel soaked with sweat',
    sport: 'universal',
    vibe: 'universal',
    tags: ['physical', 'heat', 'exhausted', 'universal'],
  },
  {
    id: 'holding_umbrella',
    weight: 20,
    label: 'holding an umbrella in rain',
    labelZh: '撐著雨傘走路',
    prompt:
      'walking while firmly holding open a rain umbrella, rain falling around, focused everyday Taiwan rainy-day pose',
    propPrompt: 'an open umbrella held overhead (no logos/text)',
    sport: 'universal',
    vibe: 'universal',
    tags: ['physical', 'rain', 'object', 'universal'],
  },
  {
    id: 'umbrella_chaos',
    weight: 12,
    label: 'umbrella flipping in wind/rain',
    labelZh: '雨傘被風吹翻',
    prompt:
      'fighting a flimsy umbrella that flips inside-out in rain or wind, nearly poking someone',
    propPrompt: 'a flipped or tangled umbrella',
    sport: 'universal',
    vibe: 'universal',
    tags: ['physical', 'rain', 'object', 'high_energy', 'universal'],
  },
  {
    id: 'sarcastic_clap',
    weight: 8,
    label: 'sarcastic slow clap',
    labelZh: '諷刺慢動作鼓掌',
    prompt: 'giving an exaggerated sarcastic slow clap, deadpan face, judgmental energy',
    propPrompt: 'empty hands mid-clap',
    sport: 'universal',
    vibe: 'universal',
    tags: ['social', 'universal'],
  },
  {
    id: 'dog_drag',
    weight: 10,
    label: 'dragged by a leashed dog',
    labelZh: '被牽繩狗拉著狂奔',
    prompt:
      'being dragged forward helplessly by an energetic dog on a leash, stumbling at full comic speed',
    propPrompt: 'a leash and an excited dog pulling ahead',
    sport: 'park',
    vibe: 'park',
    tags: ['motion', 'needs_space', 'physical', 'outdoor', 'high_energy'],
  },
  {
    id: 'queue_collapse',
    weight: 10,
    label: 'collapsing while queueing',
    labelZh: '排隊等到崩潰',
    prompt:
      'collapsing in comic despair while waiting in a long Taiwanese queue, knees weak',
    propPrompt: 'a long queue of people silhouettes ahead',
    sport: 'urban',
    vibe: 'urban',
    tags: ['social', 'exhausted', 'physical'],
  },
  // —— YouBike ——
  {
    id: 'riding_ubike',
    weight: 22,
    label: 'riding a Taiwan shared bike',
    labelZh: '騎 YouBike',
    prompt:
      'pedaling a Taiwan riverside shared rental bicycle with comic determination, hair and clothes moving in the wind',
    propPrompt: 'a green public shared bicycle clearly visible (no brand logos/text)',
    sport: 'cycling',
    vibe: 'cycling',
    tags: ['motion', 'needs_space', 'physical', 'cycling', 'high_energy'],
  },
  {
    id: 'ubike_wobble',
    weight: 14,
    label: 'wobbling on a shared bike',
    labelZh: 'YouBike 騎到晃',
    prompt:
      'wobbling unsteadily on a shared bike, overcorrecting the handlebars in comic panic',
    propPrompt: 'a shared bicycle tilting side to side',
    sport: 'cycling',
    vibe: 'cycling',
    tags: ['motion', 'needs_space', 'physical', 'cycling', 'high_energy'],
  },
  {
    id: 'ubike_dock_fumble',
    weight: 12,
    label: 'fumbling at the bike dock',
    labelZh: '還車卡住手忙腳亂',
    prompt:
      'fumbling at a shared-bike docking station, shoving the bike in and out, frustrated comic energy',
    propPrompt: 'a bike dock / locking post and a shared bicycle (no readable text)',
    sport: 'cycling',
    vibe: 'cycling',
    tags: ['physical', 'object', 'cycling', 'high_energy'],
  },
  // —— 夜市／小吃 ——
  {
    id: 'eating_chicken_cutlet',
    weight: 20,
    label: 'eating a giant Taiwanese chicken cutlet',
    labelZh: '大口咬雞排',
    prompt:
      'taking a huge bite of a giant Taiwanese fried chicken cutlet held in a paper bag, eyes sparkling',
    propPrompt: 'an oversized fried chicken cutlet in a paper sleeve (no logos/text)',
    sport: 'night_market',
    vibe: 'night_market',
    tags: ['physical', 'food', 'high_energy'],
  },
  {
    id: 'eating_shaved_ice',
    weight: 18,
    label: 'eating Taiwanese shaved ice',
    labelZh: '吃剉冰／冰品',
    prompt:
      'happily digging into a big bowl of Taiwanese shaved ice with toppings, spoon raised',
    propPrompt: 'a mound of shaved ice in a bowl with colorful toppings (no text)',
    sport: 'food',
    vibe: 'food',
    tags: ['physical', 'food', 'heat'],
  },
  {
    id: 'eating_ice_bar',
    weight: 14,
    label: 'eating a melting ice pop',
    labelZh: '啃枝仔冰',
    prompt:
      'eagerly eating a Taiwanese ice pop / ice bar in humid heat, chasing the melt with quick bites',
    propPrompt: 'an ice pop on a stick, slightly melting',
    sport: 'wildcard',
    vibe: 'wildcard',
    tags: ['physical', 'food', 'heat'],
  },
  {
    id: 'ordering_street_food',
    weight: 12,
    label: 'ordering street food excitedly',
    labelZh: '興奮點夜市小吃',
    prompt:
      'leaning over a night-market stall excitedly ordering street food, pointing at sizzling pans',
    propPrompt: 'a night-market food stall and a paper tray',
    sport: 'night_market',
    vibe: 'night_market',
    tags: ['social', 'food', 'high_energy'],
  },
  {
    id: 'stinky_tofu_recoil',
    weight: 8,
    label: 'recoiling from stinky tofu smell',
    labelZh: '臭豆腐味衝臉',
    prompt:
      'recoiling comically from a powerful stinky-tofu smell wave, eyes watering, hands waving',
    propPrompt: 'a stinky-tofu stall plume of steam/smell lines',
    sport: 'night_market',
    vibe: 'night_market',
    tags: ['physical', 'food', 'high_energy'],
  },
  // —— 珍奶／早餐 ——
  {
    id: 'drinking_bubble_tea',
    weight: 22,
    label: 'drinking pearl milk tea',
    labelZh: '喝珍珠奶茶',
    prompt:
      'happily sipping Taiwanese pearl milk tea through a thick straw, cheeks slightly puffed, relaxed enjoyment',
    propPrompt: 'a sealed plastic bubble-tea cup with a thick straw (no brand logos/text)',
    sport: 'food',
    vibe: 'food',
    tags: ['physical', 'food', 'object'],
  },
  {
    id: 'straw_stab_seal',
    weight: 12,
    label: 'stabbing the cup seal with a straw',
    labelZh: '吸管戳杯蓋',
    prompt:
      'carefully stabbing the plastic seal of a bubble-tea cup with a straw, focused comic precision',
    propPrompt: 'a sealed plastic drink cup and a straw about to pierce the lid',
    sport: 'food',
    vibe: 'food',
    tags: ['physical', 'food', 'object'],
  },
  {
    id: 'pearl_cheek_sip',
    weight: 14,
    label: 'sipping pearls with puffed cheeks',
    labelZh: '用力吸珍珠鼓臉',
    prompt:
      'sucking tapioca pearls through a straw with comically puffed cheeks, determined face',
    propPrompt: 'a bubble tea cup; cheeks puffed mid-sip',
    sport: 'food',
    vibe: 'food',
    tags: ['physical', 'food', 'high_energy'],
  },
  {
    id: 'cup_tower_balance',
    weight: 8,
    label: 'balancing too many drink cups',
    labelZh: '手搖飲疊杯拿回家',
    prompt: 'balancing several drink cups in both hands after buying bubble tea, careful steps',
    propPrompt: 'a stacked tower of plastic drink cups',
    sport: 'food',
    vibe: 'food',
    tags: ['physical', 'food', 'object', 'high_energy'],
  },
  {
    id: 'eating_egg_pancake',
    weight: 20,
    label: 'eating a Taiwanese egg pancake',
    labelZh: '在早餐店吃蛋餅',
    prompt:
      'sitting or standing at a Taiwan breakfast shop eating a freshly made egg pancake / danbing, content morning vibe',
    propPrompt: 'a wrapped Taiwanese egg pancake (danbing) in hand',
    sport: 'food',
    vibe: 'food',
    tags: ['physical', 'food'],
  },
  {
    id: 'sipping_soy_milk',
    weight: 12,
    label: 'sipping hot soy milk',
    labelZh: '喝熱豆漿',
    prompt: 'carefully sipping hot soy milk from a breakfast-shop cup, warming hands around it',
    propPrompt: 'a soy milk cup (no logos/text)',
    sport: 'food',
    vibe: 'food',
    tags: ['physical', 'food', 'object'],
  },
  {
    id: 'rush_bite',
    weight: 10,
    label: 'rush-eating breakfast while walking',
    labelZh: '邊走邊啃早餐',
    prompt: 'rush-eating breakfast while walking to work, cheeks stuffed, hurried comic energy',
    propPrompt: 'a half-eaten egg pancake or breakfast wrap in hand',
    sport: 'food',
    vibe: 'food',
    tags: ['physical', 'food', 'high_energy'],
  },
  {
    id: 'microwave_binge',
    weight: 10,
    label: 'guarding the microwave',
    labelZh: '守微波爐等加熱',
    prompt:
      'hovering protectively over a convenience-store microwave, staring intensely at the timer',
    propPrompt: 'a microwave oven and a plastic meal box',
    sport: 'wildcard',
    vibe: 'wildcard',
    tags: ['social', 'food', 'object'],
  },
  // —— 101／景點 ——
  {
    id: 'tourist_selfie_fail',
    weight: 10,
    label: 'failing a tourist selfie',
    labelZh: '打卡自拍失敗',
    prompt:
      'attempting a tourist selfie with a landmark behind them and nearly dropping the phone',
    propPrompt: 'a smartphone held at awkward selfie angle',
    sport: 'landmark',
    vibe: 'landmark',
    tags: ['social', 'object', 'high_energy'],
  },
  {
    id: 'map_spin_lost',
    weight: 10,
    label: 'spinning with a paper map lost',
    labelZh: '地圖轉圈迷路',
    prompt: 'spinning in place holding a folded paper map, completely lost',
    propPrompt: 'a crumpled paper map (no readable text)',
    sport: 'landmark',
    vibe: 'landmark',
    tags: ['physical', 'object', 'high_energy'],
  },
  {
    id: 'wind_hold_outfit',
    weight: 10,
    label: 'holding outfit against strong wind',
    labelZh: '強風按住衣服',
    prompt:
      'bracing against strong plaza wind while desperately holding down their signature outfit',
    propPrompt: 'clothes billowing; hands pinning fabric',
    sport: 'landmark',
    vibe: 'landmark',
    tags: ['physical', 'high_energy'],
  },
  // —— 廟 ——
  {
    id: 'incense_smoke_cough',
    weight: 10,
    label: 'coughing through incense smoke',
    labelZh: '被香煙嗆到',
    prompt: 'coughing dramatically while enveloped in thick temple incense smoke',
    propPrompt: 'incense sticks and swirling smoke',
    sport: 'temple',
    vibe: 'temple',
    tags: ['physical', 'high_energy'],
  },
  {
    id: 'throwing_poe',
    weight: 10,
    label: 'throwing divination blocks chaotically',
    labelZh: '擲筊亂飛',
    prompt:
      'throwing Taiwanese moon blocks (poe) that bounce chaotically, leaning to read the result',
    propPrompt: 'crescent-shaped wooden divination blocks mid-air',
    sport: 'temple',
    vibe: 'temple',
    tags: ['physical', 'object', 'high_energy'],
  },
  {
    id: 'bowing_trip',
    weight: 10,
    label: 'tripping while bowing',
    labelZh: '鞠躬差點跌倒',
    prompt: 'bowing respectfully at a temple and nearly tipping over from overcommitment',
    propPrompt: 'prayer pose mid-bow near incense area',
    sport: 'temple',
    vibe: 'temple',
    tags: ['physical', 'high_energy'],
  },
  {
    id: 'firecracker_jump',
    weight: 10,
    label: 'jumping from firecrackers',
    labelZh: '鞭炮嚇跳',
    prompt: 'jumping straight up in shock from nearby temple-festival firecrackers',
    propPrompt: 'firecracker paper scraps bursting near feet',
    sport: 'temple',
    vibe: 'temple',
    tags: ['motion', 'physical', 'high_energy', 'needs_space'],
  },
  {
    id: 'palanquin_dodge',
    weight: 10,
    label: 'dodging a festival palanquin',
    labelZh: '閃神轎',
    prompt: 'diving aside to dodge a rushing temple-festival palanquin carried by a crowd',
    propPrompt: 'a traditional palanquin silhouette rushing past',
    sport: 'temple',
    vibe: 'temple',
    tags: ['motion', 'physical', 'high_energy', 'needs_space'],
  },
  {
    id: 'cover_ears_boom',
    weight: 10,
    label: 'covering ears from fireworks boom',
    labelZh: '煙火巨響摀耳',
    prompt: 'clapping both hands over ears from a huge festival boom, body scrunched',
    propPrompt: 'hands over ears; distant fireworks smoke',
    sport: 'temple',
    vibe: 'temple',
    tags: ['physical', 'high_energy'],
  },
  // —— 捷運／高鐵 ——
  {
    id: 'door_squeeze',
    weight: 16,
    label: 'squeezing into closing MRT doors',
    labelZh: '捷運門縫硬擠',
    prompt:
      'squeezing comically into nearly closed MRT doors with bags and limbs stuck',
    propPrompt: 'MRT door gap and a bag wedged in',
    sport: 'transit',
    vibe: 'transit',
    tags: ['physical', 'crowded', 'high_energy'],
  },
  {
    id: 'wrong_train_panic',
    weight: 14,
    label: 'panic realizing wrong train/direction',
    labelZh: '搭錯方向慌張',
    prompt:
      'freezing in panic on a platform after realizing they are on the wrong direction',
    propPrompt: 'platform edge and a departing train silhouette',
    sport: 'transit',
    vibe: 'transit',
    tags: ['social', 'high_energy'],
  },
  {
    id: 'leaning_asleep_bump',
    weight: 12,
    label: 'dozing off and bumping a stranger',
    labelZh: '站著打瞌睡撞人',
    prompt:
      'dozing upright on transit and accidentally bumping into a nearby stranger',
    propPrompt: 'swaying sleepy posture near another passenger silhouette',
    sport: 'transit',
    vibe: 'transit',
    tags: ['social', 'physical'],
  },
  {
    id: 'holding_overhead_strap',
    weight: 18,
    label: 'holding an overhead hand strap',
    labelZh: '抓吊環站著',
    prompt:
      'standing in a transit car gripping an overhead hand strap, body slightly swaying with the ride',
    propPrompt: 'an overhead transit hand strap / hanging ring',
    sport: 'transit',
    vibe: 'transit',
    tags: ['physical', 'vehicle'],
  },
  {
    id: 'standing_sway',
    weight: 16,
    label: 'swaying hard as the vehicle brakes',
    labelZh: '急煞站不穩',
    prompt:
      'lurching forward as the bus or MRT brakes suddenly, clinging to a pole for balance',
    propPrompt: 'a vertical hand pole inside the vehicle',
    sport: 'transit',
    vibe: 'transit',
    tags: ['physical', 'vehicle', 'high_energy'],
  },
  {
    id: 'rush_hour_compress',
    weight: 16,
    label: 'compressed in rush-hour crowd',
    labelZh: '尖峰時刻擠成一團',
    prompt:
      'compressed shoulder-to-shoulder in a rush-hour transit crowd, arms pinned, comic claustrophobia',
    propPrompt: 'dense passenger silhouettes pressing in',
    sport: 'transit',
    vibe: 'transit',
    tags: ['physical', 'crowded', 'vehicle'],
  },
  {
    id: 'missed_stop_panic',
    weight: 16,
    label: 'panic after missing the stop',
    labelZh: '坐過站驚慌',
    prompt:
      'eyes wide after realizing they missed their stop, half-rising from the seat in panic',
    propPrompt: 'transit seats and a closing door silhouette',
    sport: 'transit',
    vibe: 'transit',
    tags: ['social', 'vehicle', 'high_energy'],
  },
  {
    id: 'offering_seat_awkward',
    weight: 12,
    label: 'awkwardly offering a seat',
    labelZh: '讓座超尷尬',
    prompt:
      'awkwardly offering a seat with stiff polite gestures, both parties frozen in social panic',
    propPrompt: 'an empty transit seat between two people',
    sport: 'transit',
    vibe: 'transit',
    tags: ['social', 'vehicle', 'needs_partner'],
  },
  {
    id: 'window_seat_doze',
    weight: 14,
    label: 'dozing against the window',
    labelZh: '靠窗睡著流口水',
    prompt:
      'dozing against the vehicle window with a peaceful or slightly drooling comic face',
    propPrompt: 'a window seat and the glass window',
    sport: 'transit',
    vibe: 'transit',
    tags: ['physical', 'vehicle', 'exhausted'],
  },
  {
    id: 'bus_card_tap_fail',
    weight: 16,
    label: 'transit card tap failing',
    labelZh: '悠遊卡刷不過',
    prompt:
      'repeatedly tapping a transit smart card that will not beep, growing frustration',
    propPrompt: 'a smart card and a card reader gate/validator (no readable text)',
    sport: 'transit',
    vibe: 'transit',
    tags: ['physical', 'object', 'high_energy'],
  },
  {
    id: 'wrong_bus_wave',
    weight: 14,
    label: 'waving at the wrong bus',
    labelZh: '招錯公車',
    prompt:
      'enthusiastically waving down a bus that is clearly the wrong route, then freezing mid-wave',
    propPrompt: 'a city bus silhouette pulling up to the stop',
    sport: 'transit',
    vibe: 'transit',
    tags: ['social', 'high_energy'],
  },
  {
    id: 'bus_bell_reach',
    weight: 14,
    label: 'stretching to press the stop bell',
    labelZh: '伸手按下車鈴',
    prompt:
      'stretching awkwardly across the aisle to press the bus stop bell / button',
    propPrompt: 'a stop-request button or bell cord inside the bus',
    sport: 'transit',
    vibe: 'transit',
    tags: ['physical', 'vehicle', 'high_energy'],
  },
  {
    id: 'sprint_to_gate',
    weight: 10,
    label: 'sprinting for the HSR gate',
    labelZh: '衝刺趕車門',
    prompt: 'sprinting desperately toward a train gate with luggage bouncing',
    propPrompt: 'a rolling suitcase bouncing behind them',
    sport: 'transit',
    vibe: 'transit',
    tags: ['motion', 'needs_space', 'physical', 'high_energy'],
  },
  {
    id: 'luggage_tumble',
    weight: 10,
    label: 'luggage tumbling open',
    labelZh: '行李炸開翻滾',
    prompt: 'a suitcase tumbling open mid-rush, belongings spilling comically',
    propPrompt: 'an open suitcase with clothes spilling out',
    sport: 'transit',
    vibe: 'transit',
    tags: ['physical', 'object', 'high_energy'],
  },
  {
    id: 'seat_mixup',
    weight: 10,
    label: 'sitting in the wrong seat',
    labelZh: '坐錯位子社死',
    prompt:
      'sitting confidently in a seat then realizing it is the wrong one, frozen awkward smile',
    propPrompt: 'a train/platform seat and a ticket stub (no readable text)',
    sport: 'transit',
    vibe: 'transit',
    tags: ['social'],
  },
  // —— 天氣／騎樓 ——
  {
    id: 'puddle_splash',
    weight: 10,
    label: 'stepping into a deep puddle',
    labelZh: '踩進超深積水',
    prompt: 'stepping confidently into what turns out to be a deep rain puddle, splash everywhere',
    propPrompt: 'a deep puddle splash around their feet',
    sport: 'weather',
    vibe: 'weather',
    tags: ['physical', 'rain', 'high_energy'],
  },
  {
    id: 'scooter_splash_victim',
    weight: 10,
    label: 'splashed by a passing scooter',
    labelZh: '被機車濺一身水',
    prompt:
      'getting soaked by a muddy splash from a passing scooter on a rainy street',
    propPrompt: 'a scooter speeding past and a wall of dirty water',
    sport: 'weather',
    vibe: 'weather',
    tags: ['physical', 'rain', 'high_energy'],
  },
  {
    id: 'arcade_crowd_squeeze',
    weight: 10,
    label: 'squeezed under rainy arcade',
    labelZh: '騎樓避雨擠成一團',
    prompt:
      'squeezed shoulder-to-shoulder under a rainy arcade with strangers, holding bags awkwardly',
    propPrompt: 'crowded arcade pillars and rain sheets outside',
    sport: 'weather',
    vibe: 'weather',
    tags: ['social', 'rain', 'crowded'],
  },
  {
    id: 'ac_vent_hug',
    weight: 10,
    label: 'hugging an AC vent / cold air',
    labelZh: '整個人貼冷氣口',
    prompt:
      'pressing their whole body against a cold AC vent or outdoor AC exhaust for relief from heat',
    propPrompt: 'an air-conditioner vent blowing cold air',
    sport: 'weather',
    vibe: 'weather',
    tags: ['physical', 'heat', 'exhausted'],
  },
  {
    id: 'melting_on_bench',
    weight: 10,
    label: 'melting on a park bench',
    labelZh: '熱到癱在椅子上',
    prompt: 'melting comically on a bench in humid heat, limbs limp like soft ice cream',
    propPrompt: 'a park/rooftop bench under shade',
    sport: 'weather',
    vibe: 'weather',
    tags: ['physical', 'heat', 'exhausted', 'low_energy'],
  },
  // —— 九份／老街 ——
  {
    id: 'steep_stair_slip',
    weight: 10,
    label: 'slipping on steep old-street stairs',
    labelZh: '陡階差點滑倒',
    prompt: 'slipping midway on steep old-street stone stairs, arms windmilling',
    propPrompt: 'steep stone stairs and a handrail',
    sport: 'landmark',
    vibe: 'landmark',
    tags: ['motion', 'physical', 'high_energy'],
  },
  {
    id: 'lantern_dodge',
    weight: 10,
    label: 'dodging low hanging lanterns',
    labelZh: '閃頭上燈籠',
    prompt: 'ducking and weaving under low hanging red lanterns in a narrow alley',
    propPrompt: 'hanging lanterns at head height',
    sport: 'landmark',
    vibe: 'landmark',
    tags: ['physical', 'high_energy'],
  },
  {
    id: 'narrow_alley_squeeze',
    weight: 10,
    label: 'squeezing through a narrow tourist alley',
    labelZh: '窄巷人潮硬擠',
    prompt: 'squeezing sideways through a packed narrow tourist alley',
    propPrompt: 'narrow alley walls and tourist crowd silhouettes',
    sport: 'landmark',
    vibe: 'landmark',
    tags: ['physical', 'crowded', 'high_energy'],
  },
  // —— 海邊 ——
  {
    id: 'sand_in_shoes',
    weight: 10,
    label: 'dumping sand from shoes',
    labelZh: '鞋子倒沙',
    prompt: 'hopping on one foot dumping endless sand from a shoe or heel',
    propPrompt: 'a shoe tilted upside-down pouring sand',
    sport: 'coast',
    vibe: 'coast',
    tags: ['physical', 'beach'],
  },
  {
    id: 'wave_chase_run',
    weight: 10,
    label: 'running from a sudden wave',
    labelZh: '被海浪追著跑',
    prompt: 'running from a sudden wave that chases up the shore toward their feet',
    propPrompt: 'a foamy wave reaching toward their ankles',
    sport: 'coast',
    vibe: 'coast',
    tags: ['motion', 'needs_space', 'physical', 'water', 'high_energy'],
  },
  {
    id: 'sunscreen_mess',
    weight: 10,
    label: 'sunscreen smeared everywhere',
    labelZh: '防曬乳塗滿臉',
    prompt: 'smearing thick sunscreen messily across face and signature clothes',
    propPrompt: 'a sunscreen bottle and white cream streaks',
    sport: 'coast',
    vibe: 'coast',
    tags: ['physical', 'object', 'beach'],
  },
  // —— 日月潭／西門／機車／陽明 ——
  {
    id: 'boat_wobble',
    weight: 10,
    label: 'wobbling on a lake boat',
    labelZh: '船上站不穩',
    prompt: 'wobbling comically on a small lake boat, arms out for balance',
    propPrompt: 'a small boat deck and lake water',
    sport: 'landmark',
    vibe: 'landmark',
    tags: ['physical', 'water', 'high_energy'],
  },
  {
    id: 'lake_photo_fall',
    weight: 10,
    label: 'almost falling while lake photo',
    labelZh: '湖景拍照差點掉下去',
    prompt: 'leaning too far for a lake scenic photo and nearly tipping over the railing',
    propPrompt: 'a phone camera and lakeside railing',
    sport: 'landmark',
    vibe: 'landmark',
    tags: ['physical', 'object', 'high_energy'],
  },
  {
    id: 'bike_tire_soft',
    weight: 10,
    label: 'discovering a soft rental bike tire',
    labelZh: '租自行車爆胎感',
    prompt: 'discovering a mushy rental bike tire, staring in defeated disbelief',
    propPrompt: 'a bicycle with a visibly soft tire',
    sport: 'landmark',
    vibe: 'landmark',
    tags: ['physical', 'object'],
  },
  {
    id: 'crossing_crowd_spin',
    weight: 10,
    label: 'spun around by a pedestrian crowd',
    labelZh: '人潮轉圈走',
    prompt: 'getting spun around by dense pedestrian crowd flow, lost orientation',
    propPrompt: 'dense crowd silhouettes swirling past',
    sport: 'urban',
    vibe: 'urban',
    tags: ['physical', 'crowded', 'needs_space', 'high_energy'],
  },
  {
    id: 'photo_block_pose',
    weight: 10,
    label: 'accidentally blocking someone’s photo',
    labelZh: '擋到別人打卡',
    prompt:
      'accidentally walking into someone else’s photo spot and freezing mid-apology pose',
    propPrompt: 'tourists aiming phones at a landmark behind',
    sport: 'urban',
    vibe: 'urban',
    tags: ['social', 'high_energy'],
  },
  {
    id: 'scooter_weave',
    weight: 10,
    label: 'weaving between parked scooters',
    labelZh: '鑽機車縫',
    prompt: 'awkwardly weaving sideways between tightly parked scooters in an alley',
    propPrompt: 'rows of parked scooters',
    sport: 'urban',
    vibe: 'urban',
    tags: ['physical', 'narrow', 'high_energy'],
  },
  {
    id: 'helmet_fumble',
    weight: 10,
    label: 'fumbling with a scooter helmet',
    labelZh: '安全帽戴反／卡住',
    prompt: 'fumbling with a scooter helmet stuck halfway on, straps tangled',
    propPrompt: 'a scooter helmet jammed at an odd angle',
    sport: 'urban',
    vibe: 'urban',
    tags: ['physical', 'object', 'high_energy'],
  },
  {
    id: 'parallel_park_fail',
    weight: 10,
    label: 'failing to squeeze-park a scooter',
    labelZh: '機車停車塞不進',
    prompt:
      'failing to squeeze-park a scooter into an impossibly tight gap, scooter tipping slightly',
    propPrompt: 'a scooter wedged between others',
    sport: 'urban',
    vibe: 'urban',
    tags: ['physical', 'object', 'high_energy'],
  },
  {
    id: 'sulfur_smell_face',
    weight: 10,
    label: 'reacting to sulfur steam',
    labelZh: '硫磺味皺臉',
    prompt: 'reacting to strong Yangmingshan sulfur steam with a wrinkled face',
    propPrompt: 'sulfur steam vents and rocky trail',
    sport: 'nature',
    vibe: 'nature',
    tags: ['physical', 'high_energy'],
  },
  {
    id: 'mist_lost_spin',
    weight: 10,
    label: 'lost in mountain mist',
    labelZh: '山霧中迷路轉圈',
    prompt: 'turning in circles lost inside thick mountain mist on a trail',
    propPrompt: 'foggy trail and obscured path markers (no readable text)',
    sport: 'nature',
    vibe: 'nature',
    tags: ['physical', 'needs_space', 'high_energy'],
  },
  {
    id: 'trail_mud_slide',
    weight: 10,
    label: 'sliding on muddy trail',
    labelZh: '步道泥濘滑倒',
    prompt: 'sliding down a muddy mountain trail, one shoe half-off',
    propPrompt: 'muddy trail and a skidding foot',
    sport: 'nature',
    vibe: 'nature',
    tags: ['motion', 'physical', 'high_energy'],
  },
];

export const ACTIONS_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
export const SCENES_BY_ID = Object.fromEntries(SCENES.map((s) => [s.id, s]));

/** 情緒：偏高能量／喜劇，保留少數崩潰／麻木作對比 */
export const EMOTIONS = [
  { id: 'joy', weight: 10, label: 'joyful laughter', labelZh: '開心大笑', tags: ['positive', 'high_energy'] },
  { id: 'delight', weight: 10, label: 'pure delight', labelZh: '純粹喜悅', tags: ['positive', 'high_energy'] },
  { id: 'competitive', weight: 10, label: 'competitive intensity', labelZh: '競爭感', tags: ['high_energy'] },
  { id: 'smug', weight: 10, label: 'smug confidence', labelZh: '得意', tags: ['social', 'high_energy'] },
  { id: 'shock', weight: 10, label: 'shocked disbelief', labelZh: '震驚', tags: ['high_energy'] },
  { id: 'panic', weight: 10, label: 'panic', labelZh: '慌亂', tags: ['negative', 'high_energy'] },
  { id: 'anger', weight: 10, label: 'explosive anger', labelZh: '暴怒', tags: ['negative', 'high_energy'] },
  { id: 'awkward', weight: 10, label: 'awkward embarrassment', labelZh: '尷尬', tags: ['social'] },
  { id: 'anxiety', weight: 10, label: 'nervous anxiety', labelZh: '焦慮', tags: ['negative'] },
  { id: 'doubt', weight: 10, label: 'suspicious doubt', labelZh: '懷疑', tags: ['social'] },
  { id: 'numb', weight: 10, label: 'exhausted numbness', labelZh: '疲憊麻木', tags: ['low_energy'] },
  { id: 'sorrow', weight: 10, label: 'deep sorrow after defeat', labelZh: '挫敗悲傷', tags: ['negative', 'low_energy'] },
];

/** 場景卡生圖全域風格 — 吉卜力黑白動畫原畫 */
export const SCENE_STYLE_BIBLE =
  'Classic Studio Ghibli keyframe animation style, Miyazaki-inspired character design, ' +
  'hand-drawn Japanese anime line art, expressive animation frame layout, ' +
  'clean dark ink outlines, crisp high contrast, zero faint pencil smudges, ' +
  'crisp white background, no text, no speech bubbles, black-and-white only. ' +
  'ONE single clean keyframe only (never a 2x2 grid, never multi-panel comic page). ' +
  'NO comic panel border, NO thick black frame lines around the whole page, NO square grid overlay. ' +
  'Dark skin (e.g. Bob): medium-dark gray fill on face/arms so skin reads as dark — never blank white-paper face.';

/** 倉庫 icon 肖像風格 — 吉卜力黑白動畫原畫頭像 */
export const PORTRAIT_STYLE_BIBLE =
  'Classic Studio Ghibli keyframe animation portrait, Miyazaki-inspired character design, ' +
  'hand-drawn Japanese anime line art, clean dark ink outlines, crisp high contrast, ' +
  'zero faint pencil smudges, flat solid pure white #FFFFFF background, black-and-white only.';

/** @deprecated 相容舊引用 → 場景風格 */
export const STYLE_BIBLE = SCENE_STYLE_BIBLE;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** 正規化為 BQ INT64 友善的相對權重（≥1） */
export const normalizeCatalogWeight = (value, fallback = DEFAULT_CATALOG_WEIGHT) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(1, Math.round(n));
};

/**
 * 依 weight 加權抽樣（場景／動作／情緒共用）
 * @template {{ weight?: number }} T
 * @param {T[]} items
 * @returns {T | undefined}
 */
export const pickWeighted = (items) => {
  if (!items?.length) return undefined;
  let total = 0;
  const weights = items.map((item) => {
    const w = normalizeCatalogWeight(item?.weight);
    total += w;
    return w;
  });
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
};

/**
 * 兩段抽樣：10 大通用槽位（槽位 weight）→ 槽內場景（場景 weight）
 * @param {object[]} [scenes]
 * @param {string} [seasonId]
 */
export const pickSceneByUniversalSlot = (scenes = SCENES, seasonId = ACTIVE_SEASON_ID) => {
  const groups = groupScenesBySlot(scenes, seasonId);
  const slotPool = UNIVERSAL_SLOTS.filter((s) => (groups[s.id] || []).length > 0).map(
    (s) => ({
      ...s,
      weight: normalizeCatalogWeight(s.weight),
    })
  );
  if (!slotPool.length) return pickWeighted(scenes) || scenes[0];

  const slotPick = pickWeighted(slotPool);
  const scenePool = groups[slotPick.id] || scenes;
  return pickWeighted(scenePool) || scenePool[0];
};

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const has = (item, tag) => (item.tags || []).includes(tag);

/** 場景主池動作（allowedActions → 物件） */
export const getAllowedActionsForScene = (scene) => {
  const ids = scene?.allowedActions || [];
  const list = ids.map((id) => ACTIONS_BY_ID[id]).filter(Boolean);
  return list.length ? list : ACTIONS;
};

/** 萬用微跨界動作池 */
export const getUniversalActions = () =>
  UNIVERSAL_ACTION_IDS.map((id) => ACTIONS_BY_ID[id]).filter(Boolean);

/**
 * 場景 ↔ 動作是否允許（群組綁定 + 萬用例外）
 * - 動作在 scene.allowedActions → OK
 * - 動作為 universal → OK（僅供 10% 跨界或場景主池已列入者）
 */
export const isSceneActionAllowed = (scene, action, { allowUniversal = true } = {}) => {
  if (!scene || !action) return false;
  const allowed = scene.allowedActions || [];
  if (allowed.includes(action.id)) return true;
  if (allowUniversal && (action.sport === 'universal' || has(action, 'universal'))) {
    return true;
  }
  return false;
};

/**
 * 依場景抽動作：90% 主池（加權）、10% 萬用微跨界（加權）
 */
export const pickActionForScene = (scene) => {
  const primary = getAllowedActionsForScene(scene);
  const universal = getUniversalActions();
  const useCrossover =
    Math.random() < SCENE_ACTION_CROSSOVER_RATE && universal.length > 0;

  if (useCrossover) {
    return pickWeighted(universal) || pick(universal);
  }
  return pickWeighted(primary) || pick(primary);
};

/**
 * @param {object} scene
 * @param {number} partySize 1|2|3|4
 */
export const isCompatible = (scene, partySize, action, emotion) => {
  if (!isSceneActionAllowed(scene, action, { allowUniversal: true })) return false;

  if (partySize < 2 && has(action, 'needs_partner')) return false;
  if (partySize >= 4 && has(scene, 'narrow')) return false;
  // 窄空間不適合大範圍移動
  if (has(scene, 'narrow') && has(action, 'needs_space')) return false;

  // 室內捷運／窄店：被狗拉不合理
  if (action.id === 'dog_drag' && (has(scene, 'indoor') || has(scene, 'water'))) {
    return false;
  }

  if (has(emotion, 'low_energy') && has(action, 'high_energy') && !has(action, 'exhausted')) {
    if (
      !['melting_on_bench', 'queue_collapse', 'fanning_heat', 'wiping_sweat'].includes(action.id)
    ) {
      return false;
    }
  }
  return true;
};

/** Pick N distinct characters */
export const pickCharacters = (partySize, preferId = null) => {
  const n = Math.min(Math.max(partySize, 1), CHARACTERS.length);
  const pool = shuffle(CHARACTERS);
  if (preferId) {
    const preferred = CHARACTERS_BY_ID[preferId];
    const rest = pool.filter((c) => c.id !== preferId);
    return preferred ? [preferred, ...rest].slice(0, n) : pool.slice(0, n);
  }
  return pool.slice(0, n);
};

const SPATIAL_SLOT = (index, partySize) => {
  if (partySize === 2) return index === 0 ? 'On the LEFT' : 'On the RIGHT';
  if (partySize === 3) {
    if (index === 0) return 'On the LEFT';
    if (index === 1) return 'In the CENTER';
    return 'On the RIGHT';
  }
  if (partySize >= 4) {
    const slots = [
      'On the FAR LEFT',
      'On the LEFT-CENTER',
      'On the RIGHT-CENTER',
      'On the FAR RIGHT',
    ];
    return slots[index] || slots[slots.length - 1];
  }
  return 'Center frame';
};

const hardLocksBlock = (chars) => {
  const locks = chars.map((c) => c.identityHardLock).filter(Boolean);
  if (!locks.length) return '';
  return ['[HARD IDENTITY LOCKS — NON-NEGOTIABLE]', ...locks].join('\n');
};

const buildWhoBlock = (chars, partySize) => {
  const hard = hardLocksBlock(chars);
  const anti = buildAntiSwapBlock(chars);
  const cards = chars
    .map((c, i) => `${SPATIAL_SLOT(i, partySize)}\n${buildSignatureCard(c)}`)
    .join('\n\n');

  return [
    `[CHARACTER IDENTITY MANDATE]`,
    chars.length === 1
      ? `Draw the EXACT SAME person ${chars[0].name} as the clear main subject. No other main characters.`
      : `Exactly ${partySize} distinct people. Strict spatial separation — do NOT merge faces or swap features.`,
    'Priority: (1) skin/race (2) hair (3) glasses (4) outfit silhouette (5) body.',
    'HAIR + GLASSES + OUTFIT are frozen in every Taiwan scene. Never change into local tourist costumes / raincoats as identity swap — keep signature clothes (umbrella OK as prop).',
    hard,
    anti,
    cards,
  ]
    .filter(Boolean)
    .join('\n');
};

/**
 * Phase 2 場景卡 Prompt — 身份精簡置前，動作置中，文末再鎖一次
 */
const composePrompt = (characterIds, partySize, scene, action, emotion) => {
  const chars = characterIds.map((id) => CHARACTERS_BY_ID[id]).filter(Boolean);
  const whoBlock = buildWhoBlock(chars, partySize);
  const lead = chars[0];
  const actionLine = lead
    ? `${lead.name} is ${action.prompt}, featuring ${action.propPrompt}. High dynamic comedic motion.`
    : `${action.prompt}, featuring ${action.propPrompt}. High dynamic comedic motion.`;

  const othersAction =
    chars.length > 1
      ? `Others react with energy but keep locked hair/glasses/outfit; primary action: ${actionLine}`
      : actionLine;

  return [
    `[GLOBAL STYLE - GHIBLI INK LINEART]`,
    SCENE_STYLE_BIBLE,
    'Dark skin (Bob): medium-dark gray ink fill on face/arms — never blank white-paper face.',
    'Bob body shots: show his HUGE round beer belly under the skull tee (signature silhouette).',
    `SEASON: ${SEASON.titleEn}. FORMAT: vertical 3:4 (approx 1080×1440). Full figure / three-quarter so hair+outfit(+Bob belly) read clearly.`,
    `PARTY SIZE: ${partySize}.`,
    '',
    whoBlock,
    '',
    `[PRE-DRAW CHECKLIST]`,
    buildIdentityChecklist(chars),
    '',
    `[SCENE & ACTION]`,
    `Location: ${scene.promptKeywords}`,
    `Action: ${othersAction}`,
    `Emotion: ${emotion.label}.`,
    'Pose freely but do NOT restyle hair, glasses, or outfit for the location. Signature clothes stay locked even in heat, rain, beach, or temple.',
    '',
    buildFinalIdentityCap(chars),
    'No text, letters, logos, speech bubbles, watermarks.',
  ]
    .filter(Boolean)
    .join('\n');
};

const buildRecipeRecord = (characterIds, partySize, scene, action, emotion, usedKeys) => {
  const ids = characterIds.slice(0, partySize);
  const key = `${ids.slice().sort().join('+')}|p${partySize}|${scene.id}|${action.id}|${emotion.id}`;
  if (usedKeys.has(key)) return null;
  usedKeys.add(key);

  const chars = ids.map((id) => CHARACTERS_BY_ID[id]);
  const label = chars.map((c) => c.nameZh).join('＋');
  const sceneLabel = scene.labelZh || scene.label;
  const actionLabel = action.labelZh || action.label;
  const slot = getSlotForScene(scene);

  return {
    seasonId: SEASON.id,
    partySize,
    characterIds: ids,
    castId: ids.slice().sort().join('+'),
    scene: sceneLabel,
    sceneId: scene.id,
    sceneWeight: normalizeCatalogWeight(scene.weight),
    slotId: slot?.id || resolveSceneSlotId(scene),
    slotWeight: normalizeCatalogWeight(slot?.weight),
    character: label,
    action: actionLabel,
    actionId: action.id,
    actionWeight: normalizeCatalogWeight(action.weight),
    emotion: emotion.labelZh || emotion.label,
    emotionId: emotion.id,
    emotionWeight: normalizeCatalogWeight(emotion.weight),
    comboLabel: `${SEASON.title} · ${partySize}人 · ${label} · ${sceneLabel} · ${actionLabel}`,
    prompt: composePrompt(ids, partySize, scene, action, emotion),
    castMembers: chars.map((c) => ({
      id: c.id,
      name: c.name,
      nameZh: c.nameZh,
    })),
    key,
  };
};

export const buildFacePortraitPrompt = (character) =>
  [
    character.identityHardLock || '',
    `LOCKED FACE for ${character.name}: ${character.faceAppearance || character.appearance}`,
    `HAIR LOCK: ${character.hairSignature}`,
    character.glassesSignature ? `GLASSES LOCK: ${character.glassesSignature}` : '',
    character.portraitFailCheck
      ? `FAILED IMAGE IF: ${character.portraitFailCheck}`
      : '',
    character.id === 'bob'
      ? [
          'BOB PORTRAIT CRITICAL (skin):',
          'Fill the ENTIRE face, forehead, cheeks, nose, neck, and bald scalp with MEDIUM-DARK / DARK GRAY ink tone.',
          'The face must be clearly DARKER than the white #FFFFFF background (high contrast).',
          'Pale, white, Caucasian, or paper-blank face = FAILED. Do not leave skin as unshaded white.',
        ].join(' ')
      : '',
    character.id === 'cindy'
      ? [
          'CINDY PORTRAIT CRITICAL (no glasses):',
          'Draw BARE eyes only. ZERO eyewear — no glasses, no spectacles, no frames, no sunglasses.',
          'Cindy is an OL without glasses. Any glasses on Cindy = FAILED (do not copy Elise/David).',
        ].join(' ')
      : '',
    character.id === 'elise'
      ? [
          'ELISE PORTRAIT CRITICAL (skin + body):',
          'Elise is East Asian with PALE-TO-LIGHT skin — NOT Black, NOT African, NOT dark-skinned.',
          'Do NOT shade her face with medium-dark / dark gray fill (that is Bob only).',
          'Face is lightly soft / 微微胖 only — NOT heavy double chin, NOT obese cheeks.',
          'Dark or Black Elise face = FAILED. Obese heavy Elise = FAILED.',
        ].join(' ')
      : '',
    PORTRAIT_STYLE_BIBLE,
    'Official face reference for UI — one character only. Square 1:1. Ghibli keyframe B&W ink lineart.',
    'Head-and-shoulders FILL the frame edge-to-edge (tight crop). Face centered, full hairstyle visible, eyes slightly above middle.',
    'CRITICAL: Do NOT draw any circle, ring, oval frame, medallion, badge, vignette, or border inside the image.',
    'The UI already applies a circular CSS crop — the bitmap must be a plain square portrait with flat white corners only.',
    'White #FFFFFF is BACKGROUND only (~8–12% margin at corners). Do not confuse white background with light skin (Bob must stay dark).',
    'No border/frame/vignette/halo. No hands, props, scenery, logos, text.',
    'Looking at camera, calm expression.',
    character.id === 'cindy'
      ? 'FINAL CHECK: Cindy has NO glasses on her face.'
      : '',
    character.id === 'bob'
      ? 'FINAL CHECK: Bob face is dark gray-filled Black skin, not white.'
      : '',
    character.id === 'elise'
      ? 'FINAL CHECK: Elise is light East Asian + lightly plump face only — NOT Black, NOT obese/heavy.'
      : '',
    character.identityHardLock
      ? `FINAL CHECK before finish: ${character.name} still matches locks.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

/**
 * 依權重分配人數（總和 = total），使用最大餘數法。
 * @param {number} total
 * @returns {number[]}
 */
export const allocatePartySizes = (total) => {
  const specs = PARTY_SIZE_DISTRIBUTION;
  const totalWeight = specs.reduce((sum, item) => sum + item.weight, 0);
  const quotas = specs.map(({ size, weight }) => {
    const exact = (total * weight) / totalWeight;
    return { size, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });

  let assigned = quotas.reduce((sum, q) => sum + q.count, 0);
  const byRemainder = [...quotas].sort((a, b) => b.remainder - a.remainder);
  let i = 0;
  while (assigned < total) {
    byRemainder[i % byRemainder.length].count += 1;
    assigned += 1;
    i += 1;
  }

  const sizes = [];
  quotas.forEach(({ size, count }) => {
    for (let j = 0; j < count; j += 1) sizes.push(size);
  });
  return shuffle(sizes);
};

/** 單次隨機抽樣人數（每日獎勵等） */
export const pickWeightedPartySize = () => {
  const specs = PARTY_SIZE_DISTRIBUTION;
  const totalWeight = specs.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const { size, weight } of specs) {
    roll -= weight;
    if (roll <= 0) return size;
  }
  return 1;
};

/**
 * Solo recipe for one character.
 */
export const buildCharacterRecipe = (characterId, usedKeys = new Set()) => {
  const focus = CHARACTERS_BY_ID[characterId] || CHARACTERS[0];
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const scene = pickSceneByUniversalSlot(SCENES);
    const action = pickActionForScene(scene);
    const emotion = pickWeighted(EMOTIONS) || pick(EMOTIONS);
    if (!isCompatible(scene, 1, action, emotion)) continue;
    const recipe = buildRecipeRecord([focus.id], 1, scene, action, emotion, usedKeys);
    if (recipe) return recipe;
  }
  const scene = SCENES.find((s) => s.id === 'convenience_tw') || SCENES[0];
  const action = ACTIONS_BY_ID.drinking_bubble_tea || ACTIONS[0];
  const emotion = EMOTIONS.find((e) => e.id === 'awkward') || EMOTIONS[0];
  return buildRecipeRecord([focus.id], 1, scene, action, emotion, usedKeys);
};

/**
 * Recipe with explicit party size (1|2|3|4), optional preferred character.
 */
export const buildPartyRecipe = (partySize = 1, preferId = null, usedKeys = new Set()) => {
  const size = [1, 2, 3, 4].includes(partySize) ? partySize : 1;

  for (let attempt = 0; attempt < 160; attempt += 1) {
    const scene = pickSceneByUniversalSlot(SCENES);
    const action = pickActionForScene(scene);
    const emotion = pickWeighted(EMOTIONS) || pick(EMOTIONS);
    const effectiveSize = has(action, 'needs_partner') ? Math.max(size, 2) : size;
    if (!isCompatible(scene, effectiveSize, action, emotion)) continue;
    const picked = pickCharacters(effectiveSize, preferId);
    const recipe = buildRecipeRecord(
      picked.map((c) => c.id),
      effectiveSize,
      scene,
      action,
      emotion,
      usedKeys
    );
    if (recipe) return recipe;
  }
  return buildCharacterRecipe(preferId || pick(CHARACTERS).id, usedKeys);
};

/** Fully random daily: weighted partySize + characters + scene + action + emotion */
export const buildFullyRandomRecipe = (usedKeys = new Set()) =>
  buildPartyRecipe(pickWeightedPartySize(), null, usedKeys);

export const buildBootstrapRecipes = () => {
  const used = new Set();
  const recipes = [];
  const sizes = allocatePartySizes(TOTAL_BOOTSTRAP_CARDS);

  const soloCount = sizes.filter((s) => s === 1).length;
  const soloChars = shuffle(
    Array.from({ length: soloCount }, (_, i) => CHARACTERS[i % CHARACTERS.length].id)
  );
  let soloIdx = 0;

  for (const partySize of shuffle(sizes)) {
    if (partySize === 1) {
      const charId = soloChars[soloIdx] || pick(CHARACTERS).id;
      soloIdx += 1;
      recipes.push(buildPartyRecipe(1, charId, used));
    } else {
      recipes.push(buildPartyRecipe(partySize, null, used));
    }
  }

  return recipes;
};

export const buildRandomRecipe = () => buildFullyRandomRecipe();
export const buildRandomRecipes = (count) => buildBootstrapRecipes().slice(0, count);
export const buildPackRecipe = (id, usedKeys) => buildCharacterRecipe(id, usedKeys || new Set());
export const buildDuoRecipe = (_pairId, usedKeys) => buildPartyRecipe(2, null, usedKeys || new Set());
export const buildFreeMixDuoRecipe = (usedKeys) => buildPartyRecipe(2, null, usedKeys || new Set());
