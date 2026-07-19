import { useEffect, useMemo, useState } from "react";
import StockCard from "./StockCard";
import type { Stock } from "./StockCard";
import stocksJson from "./n225.json";
import "./App.css";

const stocks = stocksJson as Stock[];

const PERIODS = [
  { label: "1ヶ月", days: 22 },
  { label: "4ヶ月", days: 82 },
  { label: "1年", days: 260 },
  { label: "3年", days: 780 },
  { label: "5年", days: 1300 },
];

interface Meta {
  updated: string;
  count: number;
  failed: string[];
}

export default function App() {
  const [days, setDays] = useState(82);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/meta.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMeta)
      .catch(() => {});
  }, []);

  // 業種ごとにグループ化（元データの順序を維持）
  const sections = useMemo(() => {
    const q = filter.trim();
    const list = q
      ? stocks.filter((s) => s.code.includes(q) || s.name.includes(q))
      : stocks;
    const map = new Map<string, Stock[]>();
    for (const s of list) {
      if (!map.has(s.sector)) map.set(s.sector, []);
      map.get(s.sector)!.push(s);
    }
    return [...map.entries()];
  }, [filter]);

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
          <input
            type="search"
            placeholder="コード・銘柄名で絞り込み"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {meta && (
            <span className="updated">
              更新: {new Date(meta.updated).toLocaleString("ja-JP")}
            </span>
          )}
        </div>
      </header>
      {sections.map(([sector, list]) => (
        <section key={sector}>
          <h2 className="sector-head">{sector}</h2>
          <div className="grid">
            {list.map((s) => (
              <StockCard key={s.code} stock={s} days={days} />
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
