import { useEffect, useRef, useState } from "react";
import { drawCandles, formatPrice, UP_COLOR, DOWN_COLOR } from "./chart";
import type { StockData } from "./chart";

export interface Stock {
  code: string;
  name: string;
  sector: string;
}

interface Props {
  stock: Stock;
  days: number;
}

export default function StockCard({ stock, days }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<StockData | null>(null);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(false);

  // 画面に近づいたらデータを読み込む（225銘柄の一括読み込みを避ける）
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "600px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    fetch(`${import.meta.env.BASE_URL}data/${stock.code}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setError(true));
  }, [visible, stock.code]);

  useEffect(() => {
    if (data && canvasRef.current) drawCandles(canvasRef.current, data, days);
  }, [data, days]);

  const last = data ? data.c[data.c.length - 1] : null;
  const prev = data && data.c.length > 1 ? data.c[data.c.length - 2] : null;
  const change = last != null && prev != null ? last - prev : null;
  const changePct = change != null && prev ? (change / prev) * 100 : null;
  const changeColor = change == null ? undefined : change >= 0 ? UP_COLOR : DOWN_COLOR;

  return (
    <div className="card" ref={cardRef}>
      <div className="card-head">
        <a
          className="card-title"
          href={`https://kabutan.jp/stock/?code=${stock.code}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`${stock.name} を株探で開く`}
        >
          {stock.code} {stock.name}
        </a>
        {last != null && (
          <span className="card-price">
            {formatPrice(last)}
            {change != null && changePct != null && (
              <span className="card-change" style={{ color: changeColor }}>
                {change >= 0 ? "+" : ""}
                {formatPrice(change)} ({changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%)
              </span>
            )}
          </span>
        )}
      </div>
      <div className="card-chart">
        {error ? (
          <span className="card-error">データ取得失敗</span>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>
      <div className="card-links">
        <a href={`https://finance.yahoo.co.jp/quote/${stock.code}.T`} target="_blank" rel="noopener noreferrer">Y!</a>
        <a href={`https://kabutan.jp/stock/news?code=${stock.code}`} target="_blank" rel="noopener noreferrer">ニュース</a>
        <a href={`https://irbank.net/${stock.code}`} target="_blank" rel="noopener noreferrer">IR</a>
        <a href={`https://karauri.net/${stock.code}/`} target="_blank" rel="noopener noreferrer">空売り</a>
        <span className="card-sector">{stock.sector}</span>
      </div>
    </div>
  );
}
