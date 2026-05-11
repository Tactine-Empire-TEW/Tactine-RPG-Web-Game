/**
 * market.js — Real-time dollar-strength tracking via EUR/USD (Frankfurter/ECB).
 *
 * RF value formula:
 *   rfValue = BASE_RF_USD × (BASELINE_USD_TO_EUR / current_USD_to_EUR)
 *   → dollar weakens (USD buys fewer EUR) → rfValue rises
 *   → dollar strengthens → rfValue falls
 */

const API_BASE = 'https://api.frankfurter.app';

export const BASELINE_USD_TO_EUR = 0.925; // long-run USD→EUR average
export const BASE_RF_USD         = 0.001; // 1 RF = $0.001 baseline (1000 RF = $1)

let _cache   = null;
let _cacheTs = 0;
const CACHE_MS = 10 * 60 * 1000; // 10-minute cache

// ── Public ────────────────────────────────────────────────────────────

/**
 * Fetch last 7 trading days of EUR/USD and return processed points.
 * Falls back to synthetic flat data on network failure.
 */
export async function fetchMarketData() {
  if (_cache && Date.now() - _cacheTs < CACHE_MS) return _cache;

  try {
    const end   = new Date();
    const start = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000); // 12 days → ≥7 trading days
    const fmt   = d => d.toISOString().split('T')[0];
    const url   = `${API_BASE}/${fmt(start)}..${fmt(end)}?from=USD&to=EUR`;

    // AbortController-based timeout (works everywhere)
    const ctrl    = new AbortController();
    const timer   = setTimeout(() => ctrl.abort(), 7000);
    let res;
    try {
      res = await fetch(url, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const points = Object.entries(json.rates)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, rates]) => {
        const usdToEur = rates.EUR;
        const rfValue  = BASE_RF_USD * (BASELINE_USD_TO_EUR / usdToEur);
        return { date, usdToEur, rfValue };
      });

    _cache   = { points, source: 'live' };
    _cacheTs = Date.now();
    return _cache;

  } catch (err) {
    // Generate synthetic data with slight realistic variation so chart isn't flat
    const points = _syntheticPoints();
    return { points, source: 'offline' };
  }
}

export function getCurrentRFValue(data) {
  return data?.points?.at(-1)?.rfValue ?? BASE_RF_USD;
}

/** Returns % change in RF value over the 7-day window. */
export function getTrendPct(data) {
  const pts = data?.points;
  if (!pts || pts.length < 2) return 0;
  return ((pts.at(-1).rfValue - pts[0].rfValue) / pts[0].rfValue) * 100;
}

/** Draw a line chart of RF/USD history onto a canvas element. */
export function drawRFChart(canvas, points) {
  const ctx = canvas.getContext('2d');
  const W   = canvas.width;
  const H   = canvas.height;
  const PAD = { top: 14, right: 16, bottom: 28, left: 64 };
  const cW  = W - PAD.left - PAD.right;
  const cH  = H - PAD.top  - PAD.bottom;

  ctx.clearRect(0, 0, W, H);
  if (!points || points.length < 2) return;

  const vals = points.map(p => p.rfValue);
  const raw  = Math.max(...vals) - Math.min(...vals);
  // Guarantee enough vertical spread to look interesting even when EUR/USD is flat
  const MIN_SPREAD = BASE_RF_USD * 0.008;
  const spread = Math.max(raw, MIN_SPREAD);
  const mid  = (Math.max(...vals) + Math.min(...vals)) / 2;
  const lo   = mid - spread * 0.8;
  const hi   = mid + spread * 0.8;

  const xOf = i => PAD.left + (i / (points.length - 1)) * cW;
  const yOf = v => PAD.top  + cH - ((v - lo) / (hi - lo)) * cH;

  // ── Grid ──────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,200,50,.07)';
  ctx.lineWidth   = 1;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (i / 4) * cH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
  }

  // ── Baseline dashed line ──────────────────────────────────────────
  const baseY = yOf(BASE_RF_USD);
  if (baseY >= PAD.top && baseY <= PAD.top + cH) {
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(180,180,180,.3)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, baseY); ctx.lineTo(W - PAD.right, baseY); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(180,180,180,.45)';
    ctx.font      = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`$${BASE_RF_USD.toFixed(4)}`, PAD.left - 4, baseY + 3);
  }

  // ── Gradient fill ─────────────────────────────────────────────────
  const trendUp = vals.at(-1) >= vals[0];
  const c1 = trendUp ? 'rgba(70,210,50,.32)'  : 'rgba(220,60,60,.32)';
  const c2 = trendUp ? 'rgba(70,210,50,.0)'   : 'rgba(220,60,60,.0)';
  const gr = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
  gr.addColorStop(0, c1); gr.addColorStop(1, c2);
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(vals[0]));
  for (let i = 1; i < points.length; i++) ctx.lineTo(xOf(i), yOf(vals[i]));
  ctx.lineTo(xOf(points.length - 1), PAD.top + cH);
  ctx.lineTo(xOf(0), PAD.top + cH);
  ctx.closePath();
  ctx.fillStyle = gr;
  ctx.fill();

  // ── Line ──────────────────────────────────────────────────────────
  const lineCol = trendUp ? '#58d840' : '#e04848';
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(vals[0]));
  for (let i = 1; i < points.length; i++) ctx.lineTo(xOf(i), yOf(vals[i]));
  ctx.strokeStyle = lineCol;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // ── Dots ──────────────────────────────────────────────────────────
  for (let i = 0; i < points.length; i++) {
    const isLast = i === points.length - 1;
    ctx.beginPath();
    ctx.arc(xOf(i), yOf(vals[i]), isLast ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle   = isLast ? '#fff' : lineCol;
    ctx.strokeStyle = lineCol;
    ctx.lineWidth   = 1.5;
    ctx.fill(); ctx.stroke();
  }

  // ── Y labels ──────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(180,150,80,.65)';
  ctx.font      = '9px monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((4 - i) / 4) * (hi - lo);
    ctx.fillText(`$${v.toFixed(5)}`, PAD.left - 4, PAD.top + (i / 4) * cH + 3);
  }

  // ── X labels ──────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(180,150,80,.5)';
  ctx.font      = '8px sans-serif';
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(points.length / 4));
  for (let i = 0; i < points.length; i += step) {
    ctx.fillText(points[i].date.slice(5), xOf(i), H - 8);
  }
  ctx.fillText(points.at(-1).date.slice(5), xOf(points.length - 1), H - 8);
}

// ── Private ───────────────────────────────────────────────────────────

/** Realistic-looking synthetic points for offline mode. */
function _syntheticPoints() {
  const today = new Date();
  // Tiny random walk around the baseline so the chart has visible shape
  let usdToEur = BASELINE_USD_TO_EUR;
  return Array.from({ length: 7 }, (_, i) => {
    usdToEur += (Math.random() - 0.5) * 0.004;
    const d = new Date(today - (6 - i) * 24 * 60 * 60 * 1000);
    return {
      date:     d.toISOString().split('T')[0],
      usdToEur,
      rfValue:  BASE_RF_USD * (BASELINE_USD_TO_EUR / usdToEur),
    };
  });
}
