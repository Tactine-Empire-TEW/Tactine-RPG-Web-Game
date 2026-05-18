import {
  TILE_SRC, CHAR_TYPES, CHAR_COLORS, CHAR_COLORS_BY_TYPE, CHAR_TYPE_LABELS,
  getObjectDisplayName, getUnitDisplayName,
  isBuildingLvl1, isWallLvl1Tile, isHiddenTile,
  BLDG_BOT_KEYS, BLDG_TOP_BOT_PAIRS,
} from './constants.js';
import { getSheet, getChar, loadChar } from './assets.js';
import { getRuflux, addRuflux } from './ruflux.js';

const PURCHASE_KEY = 'tew_store_purchases';
const CARD = 64; // card size in px

// Tutorial hook — when set, only this building name is purchasable
let _tutAllowedBuilding = null;
export function setTutStoreFilter(name) {
  _tutAllowedBuilding = name ?? null;
  _buildGrid();
}

// Called when a building is bought (closes store and arms placement)
// or when a wall is selected (arms wall-paint mode without upfront purchase)
let _onItemReady = null;
export function setOnItemReady(fn) { _onItemReady = fn; }

// ── RF prices by display name (buildings) ────────────────────────────
const BUILDING_PRICES = {
  'Family House':         200,
  'Bank':               1_000,
  'Dojo':                 500,
  'Villagers Hut':        150,
  'Windmill':             800,
  'Farmers Market':       600,
  'Ore Refiner':        1_200,
  'Fields Land':          300,
  'Water Springs':        400,
  'Gold Mine':          1_500,
  'Abandoned Mine':       100,
  "Dragon's Incubator": 2_000,
  // Townhall is not purchasable — it is pre-placed at the map centre
};
export const WALL_PRICE = 50; // all Lvl1 wall tiles share the same price

// ── RF prices by unit type ───────────────────────────────────────────
export const UNIT_PRICES = {
  Soldier: 100, Archer: 120, Vanguard: 150, Sapper: 180,
  Healer: 200, Scout: 130, Siege: 500, Ram: 400,
  Beast: 2_000, BeastRider: 1_500, Elemental: 1_800,
  Acolyte: 300, Villager: 80,
  Battleship: 1_000, Frigate: 700, FishingBoat: 200, TransportShip: 500,
};

// ── Helpers ───────────────────────────────────────────────────────────
function _getPurchases() {
  try { return JSON.parse(localStorage.getItem(PURCHASE_KEY) ?? '[]'); }
  catch { return []; }
}
function _savePurchase(entry) {
  const list = _getPurchases();
  list.push({ ...entry, ts: Date.now() });
  localStorage.setItem(PURCHASE_KEY, JSON.stringify(list));
}

function _buildingPrice(name) {
  // Strip " Top" / " Bot" suffix for 2-tile buildings
  const base = name.replace(/ (Top|Bot)$/, '');
  return BUILDING_PRICES[base] ?? 250;
}

// ── Store state ───────────────────────────────────────────────────────
let _category = 'buildings';
let _panel, _grid, _rfEl, _infoEl;
let _qtyModal, _qtyOverlay, _pendingEntry = null;

// ── Public ────────────────────────────────────────────────────────────
export function setupStore() {
  _panel    = document.getElementById('store-panel');
  _grid     = document.getElementById('store-grid');
  _rfEl     = document.getElementById('store-rf-count');
  _infoEl   = document.getElementById('store-info');
  _qtyModal   = document.getElementById('qty-modal');
  _qtyOverlay = document.getElementById('qty-overlay');

  document.getElementById('btn-store').addEventListener('click', _open);
  document.getElementById('store-close').addEventListener('click', _close);
  document.getElementById('store-overlay').addEventListener('click', _close);

  document.querySelectorAll('.store-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      _category = btn.dataset.cat;
      document.querySelectorAll('.store-cat').forEach(b => b.classList.toggle('active', b === btn));
      _buildGrid();
    });
  });

  // Quantity modal wiring
  document.getElementById('qty-cancel').addEventListener('click', _closeQtyModal);
  _qtyOverlay.addEventListener('click', _closeQtyModal);
  document.getElementById('qty-dec').addEventListener('click', () => _stepQty(-1));
  document.getElementById('qty-inc').addEventListener('click', () => _stepQty(+1));
  document.getElementById('qty-input').addEventListener('input', _syncQtyTotal);
  document.getElementById('qty-confirm').addEventListener('click', _confirmQty);
}

// ── Open / close ──────────────────────────────────────────────────────
function _open() {
  _panel.classList.add('open');
  document.getElementById('store-overlay').classList.add('open');
  _updateRF();
  _buildGrid();
}
function _close() {
  _panel.classList.remove('open');
  document.getElementById('store-overlay').classList.remove('open');
}

function _updateRF() {
  if (_rfEl) _rfEl.textContent = getRuflux().toLocaleString();
}

// ── Grid builders ─────────────────────────────────────────────────────
function _buildGrid() {
  _grid.innerHTML = '';
  _infoEl.textContent = '';
  if (_category === 'buildings') _buildBuildingGrid();
  else if (_category === 'walls') _buildWallGrid();
}

function _buildBuildingGrid() {
  const biome = document.getElementById('biome-sel')?.value ?? 'normal';
  const sheet = getSheet(biome);

  // Rows 50-62, all 23 columns — filter to Lvl1 only, skip bot tiles
  const seen = new Set();
  for (let ty = 50; ty <= 62; ty++) {
    for (let tx = 0; tx < 23; tx++) {
      if (!isBuildingLvl1(tx, ty)) continue;
      if (isHiddenTile(tx, ty)) continue;
      if (BLDG_BOT_KEYS.has(`${tx},${ty}`)) continue;
      const name  = getObjectDisplayName(tx, ty).replace(' Top', '');
      if (name === 'Townhall') continue; // pre-placed at map centre, not purchasable
      if (seen.has(name)) continue;
      seen.add(name);
      const bot   = BLDG_TOP_BOT_PAIRS.get(`${tx},${ty}`) ?? null;
      const price = _buildingPrice(name);
      _addCard({ kind: 'building', tx, ty, bot, name, price, sheet });
    }
  }
}

function _buildWallGrid() {
  const biome = document.getElementById('biome-sel')?.value ?? 'normal';
  const sheet = getSheet(biome);

  for (let ty = 33; ty <= 40; ty++) {
    for (let tx = 0; tx < 30; tx++) {
      if (!isWallLvl1Tile(tx, ty)) continue;
      if (isHiddenTile(tx, ty)) continue;
      const name = getObjectDisplayName(tx, ty);
      _addCard({ kind: 'wall', tx, ty, bot: null, name, price: WALL_PRICE, sheet });
    }
  }
}

function _buildUnitGrid() {
  for (const type of CHAR_TYPES) {
    const lbl = document.createElement('div');
    lbl.className = 'store-section-lbl';
    lbl.textContent = CHAR_TYPE_LABELS[type] ?? type;
    _grid.appendChild(lbl);

    const colors = CHAR_COLORS_BY_TYPE[type] ?? CHAR_COLORS;
    const price  = UNIT_PRICES[type] ?? 200;

    for (const color of colors) {
      const name = getUnitDisplayName(type, color);
      const card = _makeCanvas(CARD, CARD, ctx => {
        ctx.fillStyle = '#0a1020';
        ctx.fillRect(0, 0, CARD, CARD);
        const img = getChar(type, color);
        if (img) ctx.drawImage(img, 0, 0, 16, 16, 0, 0, CARD, CARD);
      });

      // Lazy-load sprite
      if (!getChar(type, color)) {
        loadChar(type, color).then(() => {
          const ctx = card.getContext('2d');
          ctx.fillStyle = '#0a1020'; ctx.fillRect(0, 0, CARD, CARD);
          const img = getChar(type, color);
          if (img) ctx.drawImage(img, 0, 0, 16, 16, 0, 0, CARD, CARD);
        });
      }

      _wrapCard(card, name, price, { kind: 'unit', type, color, name, price });
    }
  }
}

// ── Card creation ─────────────────────────────────────────────────────
function _addCard({ kind, tx, ty, bot, name, price, sheet }) {
  const h   = bot ? CARD * 2 : CARD;
  const cvs = _makeCanvas(CARD, h, ctx => {
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(0, 0, CARD, h);
    if (sheet) {
      ctx.drawImage(sheet, tx * TILE_SRC, ty * TILE_SRC, TILE_SRC, TILE_SRC, 0, 0, CARD, CARD);
      if (bot) ctx.drawImage(sheet, bot.tx * TILE_SRC, bot.ty * TILE_SRC, TILE_SRC, TILE_SRC, 0, CARD, CARD, CARD);
    }
  });
  _wrapCard(cvs, name, price, { kind, tx, ty, bot, name, price });
}

function _makeCanvas(w, h, draw) {
  const cvs = document.createElement('canvas');
  cvs.width = w; cvs.height = h;
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  return cvs;
}

function _wrapCard(canvas, name, price, entry) {
  const wrap = document.createElement('div');
  wrap.className = 'store-card';
  wrap.title = name;

  const tutLocked = _tutAllowedBuilding !== null && name !== _tutAllowedBuilding;
  if (tutLocked) wrap.style.opacity = '0.35';

  const btn = document.createElement('button');
  btn.className = 'store-buy-btn';
  btn.innerHTML = `<img src="Assets/coins/gold-coin.png" class="store-coin-icon" alt="RF"> ${price.toLocaleString()}`;
  if (tutLocked) { btn.disabled = true; btn.style.cursor = 'default'; }

  wrap.appendChild(canvas);

  const nameEl = document.createElement('div');
  nameEl.className = 'store-card-name';
  nameEl.textContent = name;
  wrap.appendChild(nameEl);
  wrap.appendChild(btn);

  wrap.addEventListener('mouseenter', () => { if (_infoEl) _infoEl.textContent = `${name} — ${price.toLocaleString()} RF each`; });
  wrap.addEventListener('mouseleave', () => { if (_infoEl) _infoEl.textContent = ''; });

  btn.addEventListener('click', () => {
    if (tutLocked) return;
    if (entry.kind === 'wall') {
      // Wall paint mode — no upfront purchase, charges per tile placed
      if (_onItemReady) _onItemReady({ ...entry, wallPaint: true });
    } else {
      // Buy exactly 1 immediately and arm placement
      const result = _buy(entry, 1);
      if (result === 'ok') {
        window.dispatchEvent(new CustomEvent('tew:purchased', { detail: { name: entry.name } }));
        btn.textContent = '✔ Placing…';
        btn.classList.add('store-buy-confirmed');
        setTimeout(() => { btn.innerHTML = `<img src="Assets/coins/gold-coin.png" class="store-coin-icon" alt="RF"> ${price.toLocaleString()}`; btn.classList.remove('store-buy-confirmed'); }, 1500);
        if (_onItemReady) _onItemReady(entry);
      } else {
        btn.textContent = '✗ Not enough RF';
        btn.classList.add('store-buy-broke');
        setTimeout(() => { btn.innerHTML = `<img src="Assets/coins/gold-coin.png" class="store-coin-icon" alt="RF"> ${price.toLocaleString()}`; btn.classList.remove('store-buy-broke'); }, 1500);
      }
    }
  });

  _grid.appendChild(wrap);
}

// ── Quantity modal ────────────────────────────────────────────────────
function _openQtyModal(canvas, name, price, entry, triggerBtn) {
  _pendingEntry = { entry, price, triggerBtn };

  // Preview — cloneNode doesn't copy canvas pixels; draw instead
  const slot = document.getElementById('qty-preview');
  slot.innerHTML = '';
  const clone = document.createElement('canvas');
  clone.width  = canvas.width;
  clone.height = canvas.height;
  const cloneCtx = clone.getContext('2d');
  cloneCtx.imageSmoothingEnabled = false;
  cloneCtx.drawImage(canvas, 0, 0);
  slot.appendChild(clone);

  // Name + price
  document.getElementById('qty-item-name').textContent = name;
  document.getElementById('qty-price-per').textContent = price.toLocaleString();

  // Reset qty to 1 (but cap at what user can afford)
  const rf  = getRuflux();
  const max = Math.max(1, Math.floor(rf / price));
  const inp = document.getElementById('qty-input');
  inp.min = 1;
  inp.max = max;
  inp.value = 1;

  _syncQtyTotal();

  _qtyOverlay.classList.add('open');
  _qtyModal.classList.add('open');
  inp.focus();
}

function _closeQtyModal() {
  _qtyModal.classList.remove('open');
  _qtyOverlay.classList.remove('open');
  _pendingEntry = null;
}

function _stepQty(delta) {
  const inp = document.getElementById('qty-input');
  const val = Math.max(1, Math.min(parseInt(inp.max) || 999, (parseInt(inp.value) || 1) + delta));
  inp.value = val;
  _syncQtyTotal();
}

function _syncQtyTotal() {
  if (!_pendingEntry) return;
  const { price } = _pendingEntry;
  const rf  = getRuflux();
  const inp = document.getElementById('qty-input');
  const qty = Math.max(1, parseInt(inp.value) || 1);
  const total = qty * price;

  document.getElementById('qty-total').textContent = total.toLocaleString();

  const canAfford = total <= rf;
  const confirmBtn = document.getElementById('qty-confirm');
  confirmBtn.disabled = !canAfford;

  const noteEl = document.getElementById('qty-balance-note');
  noteEl.textContent = canAfford
    ? `(${(rf - total).toLocaleString()} RF remaining)`
    : `✗ Need ${(total - rf).toLocaleString()} more RF`;
  noteEl.style.color = canAfford ? '#7a9a5a' : '#e05050';
}

function _confirmQty() {
  if (!_pendingEntry) return;
  const { entry, price, triggerBtn } = _pendingEntry;
  const qty = Math.max(1, parseInt(document.getElementById('qty-input').value) || 1);
  const result = _buy(entry, qty);
  _closeQtyModal();

  if (result === 'ok') {
    window.dispatchEvent(new CustomEvent('tew:purchased', { detail: { name: entry.name } }));
    const orig = triggerBtn.innerHTML;
    triggerBtn.textContent = `✔ ×${qty} Bought!`;
    triggerBtn.classList.add('store-buy-confirmed');
    setTimeout(() => { triggerBtn.innerHTML = orig; triggerBtn.classList.remove('store-buy-confirmed'); }, 1800);
    _updateRF();
  } else {
    triggerBtn.textContent = '✗ Not enough RF';
    triggerBtn.classList.add('store-buy-broke');
    setTimeout(() => {
      triggerBtn.innerHTML = `<img src="Assets/coins/gold-coin.png" class="store-coin-icon" alt="RF"> ${price.toLocaleString()}`;
      triggerBtn.classList.remove('store-buy-broke');
    }, 1500);
  }
}

export function openQtyModal(canvas, name, price, entry, triggerBtn) {
  _openQtyModal(canvas, name, price, entry, triggerBtn);
}

function _buy(entry, qty = 1) {
  const total = entry.price * qty;
  if (getRuflux() < total) return 'broke';
  addRuflux(-total);
  for (let i = 0; i < qty; i++) _savePurchase(entry);
  return 'ok';
}
