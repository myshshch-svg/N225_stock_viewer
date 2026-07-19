import { useEffect, useRef, useState } from "react";
import { drawChart, formatPrice, UP_COLOR, DOWN_COLOR } from "./chart";
import type { StockData } from "./chart";

interface Props {
  code: string;
  name: string;
  days: number;
  showMa: boolean;
}

// 日経平均・S&P500・ドル円など、銘柄一覧とは別枠で表示する市場指標カード。
// 業種・売買判断リンク・52週レンジは持たず、チャートと現在値のみのシンプルな表示。
export default function IndexCard({ code, name, days, showMa }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<StockData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/${code}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setError(true));
  }, [code]);

  useEffect(() => {
    if (data && canvasRef.current) drawChart(canvasRef.current, data, days, { showMa });
  }, [data, days, showMa]);

  const last = data ? data.c[data.c.length - 1] : null;
  const prev = data && data.c.length > 1 ? data.c[data.c.length - 2] : null;
  const change = last != null && prev != null ? last - prev : null;
  const changePct = change != null && prev ? (change / prev) * 100 : null;
  const changeColor = change == null ? undefined : change >= 0 ? UP_COLOR : DOWN_COLOR;

  return (
    <div className="card index-card">
      <div className="card-head">
        <span className="card-title">{name}</span>
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
        {error ? <span className="card-error">データ取得失敗</span> : <canvas ref={canvasRef} />}
      </div>
    </div>
  );
}
