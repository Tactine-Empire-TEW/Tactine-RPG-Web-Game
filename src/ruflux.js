import { fetchMarketData, getCurrentRFValue, getTrendPct, drawRFChart, BASE_RF_USD } from './market.js';

const STORAGE_KEY = 'tew_ruflux_balance';

// BASE_RF_USD = $0.001  →  1000 RF = $1.00
// Daily in-game earnings cap: ~150 RF/day × 30 = 4,500 RF/month ≈ $4.50 max.
// 6 purchase tiers, ~10% margin: user pays $X, receives RF worth ~$X × 0.90.
const PACKAGES = [
  { id: 'starter', label: 'Starter Pouch',   amount:    900, price: '$0.99',  img: 'Assets/coins/gold-coin.png',        desc: 'A handful of Rufluxes to begin your reign' },
  { id: 'satchel', label: 'Coin Satchel',    amount:  4_500, price: '$4.99',  img: 'Assets/coins/three-gold-coins.png', desc: 'A well-stocked satchel for early expansion' },
  { id: 'dragon',  label: "Dragon's Hoard",  amount:  9_000, price: '$9.99',  img: 'Assets/coins/dragon-coin.png',      desc: 'Ancient coins plundered from dragon coffers' },
  { id: 'elven',   label: 'Elven Treasury',  amount: 22_500, price: '$24.99', img: 'Assets/coins/elven-coin.png',       desc: 'Masterwork coins forged by elven artificers', bestValue: true },
  { id: 'bar',     label: 'Gold Bar Cache',  amount: 45_000, price: '$49.99', img: 'Assets/coins/gold-bar.png',         desc: 'Solid gold bars melted into Rufluxes' },
  { id: 'empire',  label: 'Golden Empire',   amount: 90_000, price: '$99.99', img: 'Assets/coins/golden-cup.png',       desc: 'The ultimate treasury of the empire' },
];

// ── State ─────────────────────────────────────────────────────────────
let _marketData   = null;
let _currentRFVal = BASE_RF_USD;

// ── Public API ────────────────────────────────────────────────────────

export function getRuflux() {
  return parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10);
}

export function addRuflux(amount) {
  const next = getRuflux() + amount;
  localStorage.setItem(STORAGE_KEY, String(next));
  _updateAllDisplays(next);
  return next;
}

export async function setupRuflux() {
  _buildShop();
  _updateAllDisplays();

  document.getElementById('btn-ruflux-add').addEventListener('click', _openShop);
  const overlay = document.getElementById('ruflux-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) _closeShop(); });
  document.getElementById('ruflux-close').addEventListener('click', _closeShop);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') _closeShop(); });

  // Load market data in the background — UI works even before it arrives.
  _refreshMarket();
}

// ── Internal ──────────────────────────────────────────────────────────

function _fmtUSD(rfAmount, rfVal) {
  const v = rfVal ?? _currentRFVal;
  return (rfAmount * v).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function _updateAllDisplays(n) {
  const balance  = n ?? getRuflux();
  const countFmt = balance.toLocaleString();
  const valueFmt = _fmtUSD(balance);

  const hudCount = document.getElementById('ruflux-count');
  if (hudCount) hudCount.textContent = countFmt;
  const modCount = document.getElementById('ruflux-modal-count');
  if (modCount) modCount.textContent = countFmt;
  const modValue = document.getElementById('ruflux-modal-value');
  if (modValue) modValue.textContent = `≈ ${valueFmt}`;
}

async function _refreshMarket() {
  try {
    _marketData   = await fetchMarketData();
    _currentRFVal = getCurrentRFValue(_marketData);
    _updateAllDisplays();
    _updateRateBar();
    _renderChart();
  } catch (_) { /* already handled inside fetchMarketData */ }
}

function _updateRateBar() {
  const rfPerDollar = Math.round(1 / _currentRFVal);
  const el1 = document.getElementById('rate-pill-1');
  const el2 = document.getElementById('rate-pill-2');
  if (el1) el1.innerHTML = `100 Rufluxes = <strong>${(100 * _currentRFVal).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong>`;
  if (el2) el2.innerHTML = `$1.00 = <strong>${rfPerDollar.toLocaleString()} Rufluxes</strong>`;
}

function _renderChart() {
  const canvas = document.getElementById('rf-market-chart');
  if (!canvas || !_marketData?.points) return;

  const trendPct = getTrendPct(_marketData);
  const isUp     = trendPct >= 0;
  const sign     = isUp ? '+' : '';

  const trendEl = document.getElementById('market-trend');
  if (trendEl) {
    trendEl.textContent  = `${sign}${trendPct.toFixed(2)}% (7d)`;
    trendEl.className    = 'market-trend-val ' + (isUp ? 'trend-up' : 'trend-down');
  }

  const rateEl = document.getElementById('market-current-rate');
  if (rateEl) {
    rateEl.textContent = `1 RF = ${_currentRFVal.toFixed(4)} USD`;
  }

  const srcEl = document.getElementById('market-source');
  if (srcEl) {
    srcEl.textContent = _marketData.source === 'live'
      ? 'Live · EUR/USD via ECB · updates daily'
      : 'Offline — showing baseline rate';
  }

  drawRFChart(canvas, _marketData.points);
}

function _openShop() {
  _updateAllDisplays();
  document.getElementById('ruflux-overlay').classList.add('open');
  _refreshMarket();
}

function _closeShop() {
  document.getElementById('ruflux-overlay').classList.remove('open');
}

function _buildShop() {
  const grid = document.getElementById('ruflux-packages');
  if (!grid) return;
  grid.innerHTML = '';

  for (const pkg of PACKAGES) {
    const card = document.createElement('div');
    card.className = 'ruflux-pkg' + (pkg.bestValue ? ' best-value' : '');
    card.innerHTML = `
      <img src="${pkg.img}" class="pkg-img" alt="${pkg.label}">
      <div class="pkg-amount">${pkg.amount.toLocaleString()}</div>
      <div class="pkg-unit">Rufluxes</div>
      <div class="pkg-worth" data-rf="${pkg.amount}">≈ ${_fmtUSD(pkg.amount)} value</div>
      <div class="pkg-label">${pkg.label}</div>
      <div class="pkg-desc">${pkg.desc}</div>
      <button class="pkg-buy-btn">${pkg.price}</button>
    `;

    const btn = card.querySelector('.pkg-buy-btn');
    btn.addEventListener('click', () => {
      addRuflux(pkg.amount);
      const orig = btn.textContent;
      btn.textContent = '✔ Added!';
      btn.classList.add('pkg-buy-confirmed');
      setTimeout(() => {
        btn.textContent = orig;
        btn.classList.remove('pkg-buy-confirmed');
      }, 1500);
    });

    grid.appendChild(card);
  }
}
