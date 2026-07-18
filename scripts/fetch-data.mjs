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

async function fetchOne(code) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.T?range=1y&interval=1d`;
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
let done = 0;
for (const s of stocks) {
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    try {
      if (attempt > 0) await sleep(2000 * attempt);
      const data = await fetchOne(s.code);
      writeFileSync(join(outDir, `${s.code}.json`), JSON.stringify(data));
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

console.log(`done: ${stocks.length - failed.length} ok, ${failed.length} failed`);
// 失敗が多すぎる場合はワークフローを失敗させ、前回のデプロイを維持する
if (failed.length > 20) {
  console.error("Too many failures; aborting.");
  process.exit(1);
}
