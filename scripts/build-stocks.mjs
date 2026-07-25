// JPX公式のTOPIXウエイトCSVから銘柄マスタ(src/stocks.json)を再生成する。
// 日経225の構成銘柄が変わった時・TOPIX500の定期入れ替え後などに再実行する。
// 使い方: node scripts/build-stocks.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// 東証33業種の標準的な並び順（セクション表示順に使う）
const SECTOR_ORDER = [
  "水産・農林業", "鉱業", "建設業", "食料品", "繊維製品", "パルプ・紙",
  "化学", "医薬品", "石油・石炭製品", "ゴム製品", "ガラス・土石製品",
  "鉄鋼", "非鉄金属", "金属製品", "機械", "電気機器", "輸送用機器",
  "精密機器", "その他製品", "電気・ガス業", "陸運業", "海運業", "空運業",
  "倉庫・運輸関連業", "情報・通信業", "卸売業", "小売業", "銀行業",
  "証券、商品先物取引業", "保険業", "その他金融業", "不動産業", "サービス業",
];

// TOPIX500 = Core30 + Large70 + Mid400 (JPXの「ニューインデックス区分」)
const TOPIX500_CATEGORIES = new Set(["TOPIX Core30", "TOPIX Large70", "TOPIX Mid400"]);

const CSV_URL = "https://www.jpx.co.jp/automation/markets/indices/topix/files/topixweight_j.csv";

async function fetchJpxCsv() {
  const res = await fetch(CSV_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Shift-JIS -> UTF-8 (Node標準には無いのでiconvコマンドに頼る)
  const tmp = join(root, "scripts", ".topixweight_sjis.csv");
  writeFileSync(tmp, buf);
  const utf8 = execSync(`iconv -f SHIFT-JIS -t UTF-8 ${tmp}`).toString();
  execSync(`rm ${tmp}`);
  return utf8;
}

function parseJpxCsv(text) {
  const lines = text.split("\n").map((l) => l.replace(/\r$/, "")).filter(Boolean);
  const rows = lines.slice(1).map((l) => l.split(","));
  const map = new Map(); // code -> {name, sector, category}
  for (const [, name, code, sector, , category] of rows) {
    map.set(code, { name: name.normalize("NFKC"), sector, category });
  }
  return map;
}

const n225 = JSON.parse(readFileSync(join(root, "src", "n225.json"), "utf8"));
const jpx = parseJpxCsv(await fetchJpxCsv());

const merged = new Map(); // code -> {code, name, sector, n225, topix500}
for (const s of n225) {
  const info = jpx.get(s.code);
  merged.set(s.code, {
    code: s.code,
    name: s.name, // 既存の日経225名称を優先（手動で整えたもの）
    sector: info?.sector ?? s.sector,
    n225: true,
    topix500: info ? TOPIX500_CATEGORIES.has(info.category) : false,
  });
}
for (const [code, info] of jpx) {
  if (!TOPIX500_CATEGORIES.has(info.category)) continue;
  if (merged.has(code)) continue;
  merged.set(code, {
    code,
    name: info.name,
    sector: info.sector,
    n225: false,
    topix500: true,
  });
}

const list = [...merged.values()].sort((a, b) => {
  const oa = SECTOR_ORDER.indexOf(a.sector);
  const ob = SECTOR_ORDER.indexOf(b.sector);
  if (oa !== ob) return oa - ob;
  return a.code.localeCompare(b.code);
});

writeFileSync(join(root, "src", "stocks.json"), JSON.stringify(list, null, 2) + "\n");
console.log(`wrote ${list.length} stocks (n225: ${list.filter((s) => s.n225).length}, topix500: ${list.filter((s) => s.topix500).length})`);
