import { useEffect, useMemo, useState } from "react";
import StockCard from "./StockCard";
import IndexCard from "./IndexCard";
import type { Stock, Earnings, Fundamentals } from "./StockCard";
import { MA_SHORT_COLOR, MA_LONG_COLOR, MA_SHORT_PERIOD, MA_LONG_PERIOD, STOP_COLOR } from "./chart";
import stocksJson from "./n225.json";
import "./App.css";

const stocks = stocksJson as Stock[];

const INDICES = [
  { code: "n225", name: "日経平均" },
  { code: "sp500", name: "S&P500" },
  { code: "usdjpy", name: "ドル円" },
];

const PERIODS = [
  { label: "1ヶ月", days: 22 },
  { label: "4ヶ月", days: 82 },
  { label: "1年", days: 260 },
  { label: "3年", days: 780 },
  { label: "5年", days: 1300 },
];

type CrossSignal = "golden" | "dead" | null;
type CrossFilter = "all" | "golden" | "dead";

const CROSS_FILTERS: { label: string; value: CrossFilter }[] = [
  { label: "全て", value: "all" },
  { label: "ゴールデンクロス", value: "golden" },
  { label: "デッドクロス", value: "dead" },
];

interface Meta {
  updated: string;
  count: number;
  failed: string[];
}

export default function App() {
  const [days, setDays] = useState(82);
  const [showMa, setShowMa] = useState(true);
  const [showStop, setShowStop] = useState(true);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [filter, setFilter] = useState("");
  const [signals, setSignals] = useState<Record<string, CrossSignal>>({});
  const [earnings, setEarnings] = useState<Record<string, Earnings | null>>({});
  const [fundamentals, setFundamentals] = useState<Record<string, Fundamentals | null>>({});
  const [crossFilter, setCrossFilter] = useState<CrossFilter>("all");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/meta.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMeta)
      .catch(() => {});
    fetch(`${import.meta.env.BASE_URL}data/signals.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then(setSignals)
      .catch(() => {});
    fetch(`${import.meta.env.BASE_URL}data/earnings.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then(setEarnings)
      .catch(() => {});
    fetch(`${import.meta.env.BASE_URL}data/fundamentals.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then(setFundamentals)
      .catch(() => {});
  }, []);

  // 業種ごとにグループ化（元データの順序を維持）
  const sections = useMemo(() => {
    const q = filter.trim();
    let list = q
      ? stocks.filter((s) => s.code.includes(q) || s.name.includes(q))
      : stocks;
    if (crossFilter !== "all") {
      list = list.filter((s) => signals[s.code] === crossFilter);
    }
    const map = new Map<string, Stock[]>();
    for (const s of list) {
      if (!map.has(s.sector)) map.set(s.sector, []);
      map.get(s.sector)!.push(s);
    }
    return [...map.entries()];
  }, [filter, crossFilter, signals]);

  // 業種平均PER/PBR（絞り込みの影響を受けないよう全225銘柄から計算）
  const sectorAverages = useMemo(() => {
    const sums: Record<string, { perSum: number; perN: number; pbrSum: number; pbrN: number }> = {};
    for (const s of stocks) {
      const f = fundamentals[s.code];
      const bucket = (sums[s.sector] ??= { perSum: 0, perN: 0, pbrSum: 0, pbrN: 0 });
      if (f?.per != null) {
        bucket.perSum += f.per;
        bucket.perN++;
      }
      if (f?.pbr != null) {
        bucket.pbrSum += f.pbr;
        bucket.pbrN++;
      }
    }
    const result: Record<string, { avgPer: number | null; avgPbr: number | null }> = {};
    for (const [sector, b] of Object.entries(sums)) {
      result[sector] = {
        avgPer: b.perN ? b.perSum / b.perN : null,
        avgPbr: b.pbrN ? b.pbrSum / b.pbrN : null,
      };
    }
    return result;
  }, [fundamentals]);

  const totalCount = sections.reduce((n, [, list]) => n + list.length, 0);

  return (
    <div className="app">
      <header className="header">
        <h1>日経225 ミニチャート一覧</h1>
        <div className="toolbar">
          <div className="periods">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                className={p.days === days ? "active" : ""}
                onClick={() => setDays(p.days)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            className={"ma-toggle" + (showMa ? " active" : "")}
            onClick={() => setShowMa((v) => !v)}
            title="50日線・200日線の表示切替"
          >
            移動平均線
          </button>
          <div className={"ma-legend" + (showMa ? "" : " dim")}>
            <span className="ma-legend-item">
              <span className="ma-legend-swatch" style={{ background: MA_SHORT_COLOR }} />
              {MA_SHORT_PERIOD}日
            </span>
            <span className="ma-legend-item">
              <span className="ma-legend-swatch" style={{ background: MA_LONG_COLOR }} />
              {MA_LONG_PERIOD}日
            </span>
          </div>
          <button
            className={"ma-toggle" + (showStop ? " active" : "")}
            onClick={() => setShowStop((v) => !v)}
            title="ATR(14日)ベースのシャンデリア・エグジット（トレーリングストップ）の表示切替"
          >
            損切りライン
          </button>
          <div className={"ma-legend" + (showStop ? "" : " dim")}>
            <span className="ma-legend-item">
              <span className="ma-legend-swatch dashed" style={{ borderColor: STOP_COLOR }} />
              ATR損切り
            </span>
          </div>
          <div className="periods cross-filter">
            {CROSS_FILTERS.map((f) => (
              <button
                key={f.value}
                className={f.value === crossFilter ? "active" : ""}
                onClick={() => setCrossFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            placeholder="コード・銘柄名で絞り込み"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {crossFilter !== "all" && <span className="updated">{totalCount}銘柄</span>}
          {meta && (
            <span className="updated">
              更新: {new Date(meta.updated).toLocaleString("ja-JP")}
            </span>
          )}
        </div>
      </header>
      <section>
        <h2 className="sector-head">市場指標</h2>
        <div className="grid index-grid">
          {INDICES.map((idx) => (
            <IndexCard key={idx.code} code={idx.code} name={idx.name} days={days} showMa={showMa} />
          ))}
        </div>
      </section>
      {sections.map(([sector, list]) => (
        <section key={sector}>
          <h2 className="sector-head">{sector}</h2>
          <div className="grid">
            {list.map((s) => (
              <StockCard
                key={s.code}
                stock={s}
                days={days}
                showMa={showMa}
                showStop={showStop}
                signal={signals[s.code] ?? null}
                earnings={earnings[s.code] ?? null}
                fundamentals={fundamentals[s.code] ?? null}
                sectorAvg={sectorAverages[s.sector] ?? null}
              />
            ))}
          </div>
        </section>
      ))}
      <footer className="footer">
        データ: Yahoo Finance（日足・終値ベース） / 銘柄リストは手動更新
      </footer>
    </div>
  );
}
