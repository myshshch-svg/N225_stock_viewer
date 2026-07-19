// N225全銘柄の日足データをYahoo Finance chart APIから取得し public/data/ に書き出す。
// 使い方: node scripts/fetch-data.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "data");
mkdirSync(outDir, { recursive: true });

const stocks = JSON.parse(readFileSync(join(root, "src", "n225.json"), "utf8"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (x) => (x == null ? null : Math.round(x * 100) / 100);

// ゴールデンクロス/デッドクロス判定。src/chart.ts の MA_SHORT_PERIOD/MA_LONG_PERIOD と揃えること。
const MA_SHORT_PERIOD = 50;
const MA_LONG_PERIOD = 200;
const CROSS_LOOKBACK = 15; // 直近何営業日以内のクロスを「シグナル中」とみなすか

function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

// 直近CROSS_LOOKBACK日以内に50日線と200日線が交差していれば 'golden'/'dead' を返す
function getCrossSignal(c) {
  const maShort = sma(c, MA_SHORT_PERIOD);
  const maLong = sma(c, MA_LONG_PERIOD);
  const last = c.length - 1;
  if (maShort[last] == null || maLong[last] == null) return null;
  const diffLast = maShort[last] - maLong[last];
  const from = Math.max(0, last - CROSS_LOOKBACK);
  if (maShort[from] == null || maLong[from] == null) return null;
  const diffFrom = maShort[from] - maLong[from];
  if (Math.sign(diffFrom) === Math.sign(diffLast)) return null;
  return diffLast > 0 ? "golden" : "dead";
}

async function fetchOne(code) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.T?range=5y&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const r = json.chart?.result?.[0];
  if (!r?.timestamp?.length) throw new Error("no data");
  const q = r.indicators.quote[0];
  const t = [], o = [], h = [], l = [], c = [], v = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    // 休場日や欠損はスキップ
    if (q.close[i] == null || q.open[i] == null) continue;
    const d = new Date((r.timestamp[i] + r.meta.gmtoffset) * 1000);
    t.push(d.toISOString().slice(0, 10));
    o.push(round(q.open[i]));
    h.push(round(q.high[i]));
    l.push(round(q.low[i]));
    c.push(round(q.close[i]));
    v.push(q.volume[i] ?? 0);
  }
  return { code, updated: new Date().toISOString().slice(0, 10), t, o, h, l, c, v };
}

const failed = [];
const signals = {};
let done = 0;
for (const s of stocks) {
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    try {
      if (attempt > 0) await sleep(2000 * attempt);
      const data = await fetchOne(s.code);
      writeFileSync(join(outDir, `${s.code}.json`), JSON.stringify(data));
      signals[s.code] = getCrossSignal(data.c);
      ok = true;
    } catch (e) {
      if (attempt === 2) {
        failed.push(s.code);
        console.error(`FAILED ${s.code} ${s.name}: ${e.message}`);
      }
    }
  }
  done++;
  if (done % 25 === 0) console.log(`${done}/${stocks.length}`);
  await sleep(250);
}

writeFileSync(
  join(outDir, "meta.json"),
  JSON.stringify({
    updated: new Date().toISOString(),
    count: stocks.length - failed.length,
    failed,
  })
);
writeFileSync(join(outDir, "signals.json"), JSON.stringify(signals));

console.log(`done: ${stocks.length - failed.length} ok, ${failed.length} failed`);
// 失敗が多すぎる場合はワークフローを失敗させ、前回のデプロイを維持する
if (failed.length > 20) {
  console.error("Too many failures; aborting.");
  process.exit(1);
}
