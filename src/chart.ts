export interface StockData {
  code: string;
  updated: string;
  t: string[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
}

export const UP_COLOR = "#d6484f";
export const DOWN_COLOR = "#3b6fc4";
export const MA_SHORT_COLOR = "#f2a900";
export const MA_LONG_COLOR = "#8e6bcf";

// 数ヶ月単位の売買を想定し、ゴールデンクロス/デッドクロスの定番組み合わせ（50日線・200日線）を採用。
// scripts/fetch-data.mjs のクロス判定と揃えること。
export const MA_SHORT_PERIOD = 50;
export const MA_LONG_PERIOD = 200;

const WEEK52_DAYS = 252; // 週5営業日 x 52週

// 単純移動平均。系列全体に対して計算し、期間に満たない先頭はnullにする。
function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

// 直近52週（営業日ベース）の高値・安値。表示期間の選択に関わらず全履歴の末尾から計算する。
export function getWeek52Range(data: StockData): { high: number; low: number } {
  const n = Math.min(WEEK52_DAYS, data.h.length);
  const start = data.h.length - n;
  return {
    high: Math.max(...data.h.slice(start)),
    low: Math.min(...data.l.slice(start)),
  };
}

// 直近days日分のローソク足・移動平均線・出来高をcanvasに描画する
export function drawChart(
  canvas: HTMLCanvasElement,
  data: StockData,
  days: number,
  options: { showMa?: boolean } = {}
): void {
  const showMa = options.showMa ?? true;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const n = Math.min(days, data.c.length);
  const start = data.c.length - n;
  const maShort = sma(data.c, MA_SHORT_PERIOD);
  const maLong = sma(data.c, MA_LONG_PERIOD);

  const highs = data.h.slice(start);
  const lows = data.l.slice(start);
  let max = Math.max(...highs);
  let min = Math.min(...lows);
  if (showMa) {
    for (let i = start; i < data.c.length; i++) {
      const a = maShort[i];
      const b = maLong[i];
      if (a != null) {
        max = Math.max(max, a);
        min = Math.min(min, a);
      }
      if (b != null) {
        max = Math.max(max, b);
        min = Math.min(min, b);
      }
    }
  }
  const pad = (max - min) * 0.05 || max * 0.01;
  max += pad;
  min -= pad;

  const left = 4;
  const right = 44; // 価格ラベル用の余白
  const top = 4;
  const dateLabelH = 16;
  const gap = 3;
  const availH = h - top - dateLabelH;
  const volH = Math.round(availH * 0.2);
  const priceH = availH - volH - gap;
  const volTop = top + priceH + gap;

  const plotW = w - left - right;
  const y = (price: number) => top + ((max - price) / (max - min)) * priceH;
  const step = plotW / n;
  const bodyW = Math.max(1, Math.min(step * 0.7, 8));

  // 価格パネル: 横グリッド線と価格ラベル
  ctx.font = "9px sans-serif";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(128,128,128,0.18)";
  ctx.fillStyle = "rgba(120,120,120,0.9)";
  const gridN = 4;
  for (let i = 0; i <= gridN; i++) {
    const price = min + ((max - min) * i) / gridN;
    const yy = y(price);
    ctx.beginPath();
    ctx.moveTo(left, yy);
    ctx.lineTo(left + plotW, yy);
    ctx.stroke();
    ctx.fillText(formatPrice(price), left + plotW + 3, yy);
  }

  // 縦グリッド線と日付ラベル（価格・出来高パネル共通のx軸）。
  // 表示期間が長い（3年・5年）ときは月替わりだと密集しすぎるため年替わりのみに切り替える。
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  const byYear = n > 400;
  const labelEveryOtherMonth = n > 130;
  for (let i = 1; i < n; i++) {
    const cur = data.t[start + i].slice(0, byYear ? 4 : 7);
    const prev = data.t[start + i - 1].slice(0, byYear ? 4 : 7);
    if (cur !== prev) {
      const x = left + step * (i + 0.5);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, volTop + volH);
      ctx.stroke();
      if (byYear) {
        ctx.fillText(cur.slice(2) + "年", x, volTop + volH + 3);
      } else if (!labelEveryOtherMonth || Number(cur.slice(5, 7)) % 2 === 0) {
        ctx.fillText(String(Number(cur.slice(5, 7))) + "月", x, volTop + volH + 3);
      }
    }
  }
  ctx.textAlign = "start";

  // ローソク足
  for (let i = 0; i < n; i++) {
    const j = start + i;
    const up = data.c[j] >= data.o[j];
    const color = up ? UP_COLOR : DOWN_COLOR;
    const xc = left + step * (i + 0.5);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(xc, y(data.h[j]));
    ctx.lineTo(xc, y(data.l[j]));
    ctx.stroke();
    const yo = y(data.o[j]);
    const yc = y(data.c[j]);
    const bodyTop = Math.min(yo, yc);
    const bodyH = Math.max(Math.abs(yo - yc), 1);
    ctx.fillStyle = color;
    ctx.fillRect(xc - bodyW / 2, bodyTop, bodyW, bodyH);
  }

  // 移動平均線（50日・200日）
  if (showMa) {
    drawMaLine(ctx, maShort, start, n, left, step, y, MA_SHORT_COLOR);
    drawMaLine(ctx, maLong, start, n, left, step, y, MA_LONG_COLOR);
  }

  // 出来高パネル
  const maxVol = Math.max(...data.v.slice(start, start + n), 1);
  ctx.strokeStyle = "rgba(128,128,128,0.18)";
  ctx.beginPath();
  ctx.moveTo(left, volTop);
  ctx.lineTo(left + plotW, volTop);
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const j = start + i;
    const up = data.c[j] >= data.o[j];
    const xc = left + step * (i + 0.5);
    const barH = Math.max(1, (data.v[j] / maxVol) * volH);
    ctx.fillStyle = up ? UP_COLOR : DOWN_COLOR;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(xc - bodyW / 2, volTop + volH - barH, bodyW, barH);
  }
  ctx.globalAlpha = 1;
}

function drawMaLine(
  ctx: CanvasRenderingContext2D,
  ma: (number | null)[],
  start: number,
  n: number,
  left: number,
  step: number,
  y: (price: number) => number,
  color: string
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  let drawing = false;
  for (let i = 0; i < n; i++) {
    const v = ma[start + i];
    const xc = left + step * (i + 0.5);
    if (v == null) {
      drawing = false;
      continue;
    }
    if (!drawing) {
      ctx.moveTo(xc, y(v));
      drawing = true;
    } else {
      ctx.lineTo(xc, y(v));
    }
  }
  ctx.stroke();
  ctx.lineWidth = 1;
}

export function formatPrice(p: number): string {
  if (p >= 10000) return Math.round(p).toLocaleString();
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
