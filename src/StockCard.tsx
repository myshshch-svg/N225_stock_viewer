import { useEffect, useRef, useState } from "react";
import { drawChart, formatPrice, getWeek52Range, getLatestStop, UP_COLOR, DOWN_COLOR, STOP_COLOR, FUNDAMENTALS_COLOR } from "./chart";
import type { StockData } from "./chart";

export interface Stock {
  code: string;
  name: string;
  sector: string;
  n225: boolean;
  topix500: boolean;
}

type CrossSignal = "golden" | "dead" | null;
export interface Earnings {
  date: string;
  estimate: boolean;
}
export interface Fundamentals {
  per: number | null;
  pbr: number | null;
  dividendYield: number | null;
  targetMeanPrice: number | null;
  recommendationKey: string | null;
  numberOfAnalysts: number | null;
  currentRatio: number | null;
  roe: number | null;
  roa: number | null;
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  strong_buy: "強気買い",
  buy: "買い",
  hold: "中立",
  underperform: "弱気",
  sell: "売り",
  strong_sell: "強気売り",
};
interface SectorAvg {
  avgPer: number | null;
  avgPbr: number | null;
}

interface Props {
  stock: Stock;
  days: number;
  showMa: boolean;
  showStop: boolean;
  signal: CrossSignal;
  earnings: Earnings | null;
  fundamentals: Fundamentals | null;
  sectorAvg: SectorAvg | null;
}

const EARNINGS_SOON_DAYS = 30; // 数ヶ月保有で気にすべき「もうすぐ決算」のしきい値

export default function StockCard({ stock, days, showMa, showStop, signal, earnings, fundamentals, sectorAvg }: Props) {
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
    if (data && canvasRef.current) drawChart(canvasRef.current, data, days, { showMa, showStop });
  }, [data, days, showMa, showStop]);

  const last = data ? data.c[data.c.length - 1] : null;
  const prev = data && data.c.length > 1 ? data.c[data.c.length - 2] : null;
  const change = last != null && prev != null ? last - prev : null;
  const changePct = change != null && prev ? (change / prev) * 100 : null;
  const changeColor = change == null ? undefined : change >= 0 ? UP_COLOR : DOWN_COLOR;

  const week52 = data ? getWeek52Range(data) : null;
  const week52Pct =
    week52 && last != null && week52.high > week52.low
      ? Math.min(100, Math.max(0, ((last - week52.low) / (week52.high - week52.low)) * 100))
      : null;

  const crossClass = signal === "golden" ? " cross-golden" : signal === "dead" ? " cross-dead" : "";

  const stop = data ? getLatestStop(data) : null;

  const targetUpside =
    fundamentals?.targetMeanPrice != null && last != null
      ? ((fundamentals.targetMeanPrice - last) / last) * 100
      : null;
  const targetColor = targetUpside == null ? undefined : targetUpside >= 0 ? UP_COLOR : DOWN_COLOR;
  const recommendationLabel = fundamentals?.recommendationKey
    ? (RECOMMENDATION_LABELS[fundamentals.recommendationKey] ?? fundamentals.recommendationKey)
    : null;

  const daysUntilEarnings = earnings
    ? Math.ceil((new Date(earnings.date).getTime() - Date.now()) / 86400000)
    : null;
  const earningsSoon = daysUntilEarnings != null && daysUntilEarnings >= 0 && daysUntilEarnings <= EARNINGS_SOON_DAYS;
  const earningsLabel = earnings
    ? `${Number(earnings.date.slice(5, 7))}/${Number(earnings.date.slice(8, 10))}${earnings.estimate ? "予" : ""}`
    : null;

  return (
    <div className={"card" + crossClass} ref={cardRef}>
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
        {signal === "golden" && (
          <span className="cross-badge golden" title="直近15営業日以内に50日線が200日線を上抜け">GC</span>
        )}
        {signal === "dead" && (
          <span className="cross-badge dead" title="直近15営業日以内に50日線が200日線を下抜け">DC</span>
        )}
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
      {week52 && week52Pct != null && (
        <div className="range52" title={`52週高値 ${formatPrice(week52.high)} / 安値 ${formatPrice(week52.low)}`}>
          <span className="range52-label">{formatPrice(week52.low)}</span>
          <div className="range52-track">
            <div className="range52-dot" style={{ left: `${week52Pct}%` }} />
          </div>
          <span className="range52-label">{formatPrice(week52.high)}</span>
        </div>
      )}
      {showStop && stop && (
        <div className="stop-info" style={{ color: STOP_COLOR }} title="ATR(14日)ベースのシャンデリア・エグジット（トレーリングストップ目安）">
          損切り目安 {formatPrice(stop.stop)} ({stop.pct.toFixed(1)}%)
        </div>
      )}
      {fundamentals &&
        (fundamentals.per != null ||
          fundamentals.pbr != null ||
          fundamentals.dividendYield != null ||
          fundamentals.roe != null ||
          fundamentals.roa != null ||
          fundamentals.currentRatio != null) && (
        <div
          className="fundamentals-info"
          style={{ color: FUNDAMENTALS_COLOR }}
          title="PER・PBR・配当利回り・ROE・ROA・流動比率（実績ベース）。PER/PBRの（）内は同業種平均"
        >
          {fundamentals.per != null && (
            <span>
              PER {fundamentals.per.toFixed(1)}
              {sectorAvg?.avgPer != null && `(業種平均${sectorAvg.avgPer.toFixed(1)})`}
            </span>
          )}
          {fundamentals.pbr != null && (
            <span>
              PBR {fundamentals.pbr.toFixed(2)}
              {sectorAvg?.avgPbr != null && `(業種平均${sectorAvg.avgPbr.toFixed(2)})`}
            </span>
          )}
          {fundamentals.dividendYield != null && <span>利回り{fundamentals.dividendYield.toFixed(2)}%</span>}
          {fundamentals.roe != null && <span>ROE {fundamentals.roe.toFixed(1)}%</span>}
          {fundamentals.roa != null && <span>ROA {fundamentals.roa.toFixed(1)}%</span>}
          {fundamentals.currentRatio != null && <span>流動比率 {fundamentals.currentRatio.toFixed(2)}</span>}
        </div>
      )}
      {fundamentals?.targetMeanPrice != null && (
        <div
          className="analyst-info"
          style={{ color: targetColor }}
          title={`アナリスト平均目標株価（${fundamentals.numberOfAnalysts ?? "?"}人予想）`}
        >
          目標株価 {formatPrice(fundamentals.targetMeanPrice)}
          {targetUpside != null && (
            <> ({targetUpside >= 0 ? "+" : ""}{targetUpside.toFixed(1)}%)</>
          )}
          {recommendationLabel && ` ${recommendationLabel}`}
          {fundamentals.numberOfAnalysts != null && `(${fundamentals.numberOfAnalysts})`}
        </div>
      )}
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
        {earningsLabel && (
          <span
            className={"card-earnings" + (earningsSoon ? " soon" : "")}
            title={`次回決算発表${earnings?.estimate ? "（予想日）" : ""}: ${earnings?.date}`}
          >
            決算{earningsLabel}
          </span>
        )}
        <span className="card-sector">{stock.sector}</span>
      </div>
    </div>
  );
}
