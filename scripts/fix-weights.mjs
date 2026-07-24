/**
 * 一次性／維護用：依 id 寫入 SCENES／ACTIONS／EMOTIONS 的 weight 欄位。
 * 用法：node scripts/fix-weights.mjs
 *
 * weight 為相對整數（BQ INT64）；抽樣機率 = weight / SUM(weight)
 */
import fs from 'fs';

const path = 'src/lib/cardRecipes.js';
let s = fs.readFileSync(path, 'utf8');

const SCENE_W = {
  mrt_platform: 22,
  mrt_car: 24,
  bus_stop: 22,
  bus_interior: 24,
  hsr_platform: 14,
  night_market: 18,
  convenience_tw: 16,
  rainy_arcade: 16,
  breakfast_shop: 16,
  bubble_tea_shop: 18,
  ubike_lane: 18,
  humid_rooftop: 10,
  temple_courtyard: 10,
  temple_fair: 8,
  taipei_101: 10,
  jiufen_alley: 8,
  kenting_beach: 10,
  sun_moon_lake: 10,
  ximending: 12,
  scooter_alley: 10,
  yangming_trail: 8,
  park_banyan: 12,
};

const ACTION_W = {
  riding_ubike: 22,
  ubike_wobble: 14,
  ubike_dock_fumble: 12,
  drinking_bubble_tea: 22,
  straw_stab_seal: 12,
  pearl_cheek_sip: 14,
  cup_tower_balance: 8,
  eating_chicken_cutlet: 20,
  eating_shaved_ice: 18,
  eating_ice_bar: 14,
  eating_egg_pancake: 20,
  sipping_soy_milk: 12,
  rush_bite: 10,
  holding_umbrella: 20,
  umbrella_chaos: 12,
  door_squeeze: 16,
  wrong_train_panic: 14,
  leaning_asleep_bump: 12,
  holding_overhead_strap: 18,
  standing_sway: 16,
  rush_hour_compress: 16,
  missed_stop_panic: 16,
  offering_seat_awkward: 12,
  window_seat_doze: 14,
  bus_card_tap_fail: 16,
  wrong_bus_wave: 14,
  bus_bell_reach: 14,
  peeking_phone: 14,
  fanning_heat: 12,
  wiping_sweat: 12,
  sarcastic_clap: 8,
  queue_collapse: 10,
  ordering_street_food: 12,
  stinky_tofu_recoil: 8,
};

const DEFAULT_W = 10;

s = s.replace(
  /(id:\s*'([^']+)',\s*\n\s*)weight:\s*(?:\d+)?,/g,
  (m, prefix, id) => {
    const w = SCENE_W[id] ?? ACTION_W[id] ?? DEFAULT_W;
    return `${prefix}weight: ${w},`;
  }
);

// single-line emotion objects without weight
s = s.replace(
  /(\{ id: '([^']+)',)(?!\s*weight:)/g,
  (m, prefix, id) => `${prefix} weight: ${DEFAULT_W},`
);

fs.writeFileSync(path, s);
console.log('weights synced');
