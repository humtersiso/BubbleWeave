/**
 * 一鍵觸發 Gemini 總編輯：產出 N 組景點+動作+image_prompt（不生圖）
 *
 * 用法：
 *   npm run create-season -- --theme="台灣旅遊"
 *   npm run create-season -- --theme="台灣旅遊" --count=50
 *   npm run create-season -- --theme="社畜辦公室" --out=data/generated/office.json
 *   npm run create-season -- --theme="台灣旅遊" --force   # 稽核失敗仍寫檔
 *
 * 預設寫入 App 匯入路徑：data/generated/season-taiwan-diverse.json
 * 稽核（人數／槽位／不重複）失敗時預設擋檔不寫入。
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  generateSeasonCardPrompts,
  DEFAULT_SEASON_CARD_COUNT,
} from '../src/lib/seasonChiefEditor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/** 與 src/App.jsx import 路徑對齊 */
export const DEFAULT_APP_SEASON_JSON = resolve(
  root,
  'data',
  'generated',
  'season-taiwan-diverse.json'
);

const loadEnvFile = () => {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
};

const parseArgs = () => {
  const out = {
    theme: '',
    count: DEFAULT_SEASON_CARD_COUNT,
    out: '',
    force: false,
    help: false,
  };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--theme=')) out.theme = arg.slice('--theme='.length);
    else if (arg.startsWith('--count=')) out.count = Number(arg.slice('--count='.length));
    else if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
    else if (arg === '--force') out.force = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
  }
  return out;
};

const main = async () => {
  loadEnvFile();
  const args = parseArgs();
  if (args.help || !args.theme) {
    console.log(`用法: npm run create-season -- --theme="台灣旅遊" [--count=21|50|100] [--out=path] [--force]

僅產生 Gemini 總編輯 JSON（N 組 image_prompt），不呼叫生圖 API。
預設輸出：data/generated/season-taiwan-diverse.json（App 匯入檔）
人數／槽位稽核失敗時不寫檔；加 --force 可強制寫入。`);
    process.exit(args.help ? 0 : 1);
  }

  const apiKey =
    process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.error('請在 .env 設定 VITE_GEMINI_API_KEY');
    process.exit(1);
  }

  const count =
    Number.isFinite(args.count) && args.count > 0
      ? Math.round(args.count)
      : DEFAULT_SEASON_CARD_COUNT;
  console.log(`總編輯發想中：「${args.theme}」× ${count} 張（僅 prompt，多樣性隨張數擴張）…`);

  const pack = await generateSeasonCardPrompts({
    theme: args.theme,
    apiKey,
    cardCount: count,
  });

  const d = pack.diversity;
  if (d?.stats) {
    console.log(
      `多樣性：場景 ${d.stats.distinct_scenes}／動作 ${d.stats.distinct_actions}／槽位 ${d.stats.distinct_slots}` +
        (d.stats.party_counts
          ? `／人數 ${JSON.stringify(d.stats.party_counts)}`
          : '')
    );
  }

  if (d && !d.ok) {
    console.error('多樣性稽核失敗：');
    for (const issue of d.issues.slice(0, 16)) console.error(`  - ${issue}`);
    if (!args.force) {
      console.error('未寫入檔案。修正後重跑，或加 --force 強制寫入。');
      process.exit(1);
    }
    console.warn('--force：稽核失敗仍寫入。');
  }

  const defaultDir = resolve(root, 'data', 'generated');
  mkdirSync(defaultDir, { recursive: true });
  const outPath = args.out
    ? resolve(root, args.out)
    : DEFAULT_APP_SEASON_JSON;

  writeFileSync(outPath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
  console.log(`已寫入 ${pack.cards.length} 組 prompt → ${outPath}`);
};

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
