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

// 直近days日分のローソク足をcanvasに描画する
export function drawCandles(
  canvas: HTMLCanvasElement,
  data: StockData,
  days: number
): void {
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
  const highs = data.h.slice(start);
  const lows = data.l.slice(start);
  let max = Math.max(...highs);
  let min = Math.min(...lows);
  const pad = (max - min) * 0.05 || max * 0.01;
  max += pad;
  min -= pad;

  const left = 4;
  const right = 44; // 価格ラベル用の余白
  const top = 4;
  const bottom = 16; // 日付ラベル用の余白
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const y = (price: number) => top + ((max - price) / (max - min)) * plotH;
  const step = plotW / n;
  const bodyW = Math.max(1, Math.min(step * 0.7, 8));

  // 横グリッド線と価格ラベル
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

  // 月替わりの縦グリッド線と月ラベル（表示期間が長いときは偶数月のみラベル）
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  const labelEveryOtherMonth = n > 130;
  for (let i = 1; i < n; i++) {
    const cur = data.t[start + i].slice(5, 7);
    const prev = data.t[start + i - 1].slice(5, 7);
    if (cur !== prev) {
      const x = left + step * (i + 0.5);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + plotH);
      ctx.stroke();
      if (!labelEveryOtherMonth || Number(cur) % 2 === 0) {
        ctx.fillText(String(Number(cur)) + "月", x, top + plotH + 3);
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
    // ヒゲ
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(xc, y(data.h[j]));
    ctx.lineTo(xc, y(data.l[j]));
    ctx.stroke();
    // 実体
    const yo = y(data.o[j]);
    const yc = y(data.c[j]);
    const bodyTop = Math.min(yo, yc);
    const bodyH = Math.max(Math.abs(yo - yc), 1);
    ctx.fillStyle = color;
    ctx.fillRect(xc - bodyW / 2, bodyTop, bodyW, bodyH);
  }
}

export function formatPrice(p: number): string {
  if (p >= 10000) return Math.round(p).toLocaleString();
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
